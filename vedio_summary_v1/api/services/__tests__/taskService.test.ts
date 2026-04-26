import assert from "node:assert/strict";
import { test } from "node:test";
import { TaskService } from "../taskService.js";
import type { CreateTaskRequest, TaskArtifactsDTO } from "../../../shared/types.js";

function createRequest(pipeline: Partial<CreateTaskRequest["pipeline"]>): CreateTaskRequest {
  return {
    url: "https://example.com/video",
    language: "zh-CN",
    pipeline: {
      parse: false,
      download: false,
      subtitles: false,
      summary: false,
      mindmap: false,
      qaIndex: false,
      ...pipeline,
    },
  };
}

function getArtifacts(
  runtime: Record<string, unknown> | undefined,
): TaskArtifactsDTO | undefined {
  return runtime?.artifacts as TaskArtifactsDTO | undefined;
}

test("runPipeline only executes parse stage for parse-only pipeline", async () => {
  const stageCalls: Array<{ stage: string; runtime?: Record<string, unknown> }> = [];
  const service = new TaskService(
    {
      enqueue() {},
      cancel() {
        return false;
      },
    } as any,
    {
      dumpInfo: async () => ({ title: "Test Video", duration: 31 }),
      downloadMedia: async () => {
        throw new Error("downloadMedia should not run for parse-only pipeline");
      },
      fetchSubtitles: async () => {
        throw new Error("fetchSubtitles should not run for parse-only pipeline");
      },
      generateSummary: async () => {
        throw new Error("generateSummary should not run for parse-only pipeline");
      },
      generateMindmap: async () => {
        throw new Error("generateMindmap should not run for parse-only pipeline");
      },
      replaceTranscript: async () => {},
      upsertSummary: async () => {},
      upsertMindmap: async () => {},
      ensureTaskDir: async () => "/tmp/task-1",
      taskFile: () => "/tmp/task-1/subtitles.json",
      loadSettings: async () => ({
        ai: { provider: "openai_compatible", asrEnabled: true },
        download: { outputDir: "/tmp/custom-output" },
        storage: { maxTasks: 200 },
      }),
      setTaskOutputDir: () => {},
      updateTaskStage: async (taskId: string, stage: string, opts?: Record<string, unknown>) => {
        assert.equal(taskId, "task-parse-only");
        stageCalls.push({ stage, runtime: opts?.runtime as Record<string, unknown> | undefined });
      },
      markTaskCanceled: async () => {
        throw new Error("markTaskCanceled should not run for successful parse-only pipeline");
      },
      readFile: async () => "[]",
      writeFile: async () => {},
    } as any,
  );

  await (service as any).runPipeline("task-parse-only", createRequest({ parse: true }), new AbortController().signal);

  assert.deepEqual(
    stageCalls.map((call) => call.stage),
    ["parsing", "parsing", "ready"],
  );
  assert.equal(stageCalls.at(-1)?.runtime?.lastCompletedStage, "parse");
});

test("runPipeline stops after summary for subtitles-summary pipeline", async () => {
  const stageCalls: Array<{ stage: string; runtime?: Record<string, unknown> }> = [];
  const callCounts = {
    fetchSubtitles: 0,
    generateSummary: 0,
    generateMindmap: 0,
  };
  const service = new TaskService(
    {
      enqueue() {},
      cancel() {
        return false;
      },
    } as any,
    {
      dumpInfo: async () => ({ title: "Test Video", duration: 31 }),
      downloadMedia: async () => {},
      fetchSubtitles: async () => {
        callCounts.fetchSubtitles += 1;
        return {
          source: "platform",
          segments: [{ startMs: 0, endMs: 1000, text: "hello" }],
          formats: ["json", "srt", "txt", "vtt"],
          hasSrt: true,
          hasVtt: true,
        };
      },
      generateSummary: async () => {
        callCounts.generateSummary += 1;
        return "# Summary";
      },
      generateMindmap: async () => {
        callCounts.generateMindmap += 1;
        return "mindmap";
      },
      replaceTranscript: async () => {},
      upsertSummary: async () => {},
      upsertMindmap: async () => {},
      ensureTaskDir: async () => "/tmp/task-2",
      taskFile: () => "/tmp/task-2/subtitles.json",
      loadSettings: async () => ({
        ai: { provider: "openai_compatible", asrEnabled: true },
        download: {},
        storage: { maxTasks: 200 },
      }),
      setTaskOutputDir: () => {},
      updateTaskStage: async (_taskId: string, stage: string, opts?: Record<string, unknown>) => {
        stageCalls.push({ stage, runtime: opts?.runtime as Record<string, unknown> | undefined });
      },
      markTaskCanceled: async () => {
        throw new Error("markTaskCanceled should not run for successful subtitles-summary pipeline");
      },
      readFile: async () => JSON.stringify([{ startMs: 0, endMs: 1000, text: "hello" }]),
      writeFile: async () => {},
    } as any,
  );

  await (service as any).runPipeline(
    "task-subtitles-summary",
    createRequest({ subtitles: true, summary: true }),
    new AbortController().signal,
  );

  assert.equal(callCounts.fetchSubtitles, 1);
  assert.equal(callCounts.generateSummary, 1);
  assert.equal(callCounts.generateMindmap, 0);
  assert.equal(stageCalls.at(-1)?.runtime?.lastCompletedStage, "summary");
  const artifacts = getArtifacts(stageCalls.at(-1)?.runtime);
  assert.equal(artifacts?.summaryReady, true);
  assert.equal(artifacts?.mindmapReady, false);
});

test("create uses configured outputDir when preparing task storage", async () => {
  let ensureTaskDirArgs: { taskId: string; outputDir?: string } | undefined;
  let queuedTaskId: string | undefined;
  const service = new TaskService(
    {
      enqueue(taskId: string) {
        queuedTaskId = taskId;
      },
      cancel() {
        return false;
      },
    } as any,
    {
      createTask: async () => ({
        id: "task-output-dir",
        url: "https://example.com/video",
        platform: "youtube",
        stage: "created",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      deleteTask: async () => {},
      getTask: async () => undefined,
      getTaskRequest: async () => undefined,
      listTasks: async () => [],
      markTaskCanceled: async () => {},
      resetTaskForRetry: async () => {},
      updateTaskStage: async () => {},
      replaceTranscript: async () => {},
      upsertSummary: async () => {},
      upsertMindmap: async () => {},
      ensureTaskDir: async (taskId: string, outputDir?: string) => {
        ensureTaskDirArgs = { taskId, outputDir };
        return "/tmp/task-output-dir";
      },
      removeTaskDir: async () => {},
      taskFile: () => "/tmp/task-output-dir/subtitles.json",
      dumpInfo: async () => ({ title: "Test Video", duration: 31 }),
      downloadMedia: async () => {},
      fetchSubtitles: async () => ({
        source: "platform",
        segments: [],
        formats: [],
        hasSrt: false,
        hasVtt: false,
      }),
      generateSummary: async () => "# Summary",
      generateMindmap: async () => "# Mindmap",
      loadSettings: async () => ({
        ai: { provider: "openai_compatible", asrEnabled: true },
        download: { outputDir: "/tmp/custom-output" },
        storage: { maxTasks: 200 },
      }),
      readFile: async () => "[]",
      writeFile: async () => {},
      setTaskOutputDir: () => {},
    } as any,
  );

  const task = await service.create(createRequest({ parse: true }));

  assert.equal(task.id, "task-output-dir");
  assert.deepEqual(ensureTaskDirArgs, { taskId: "task-output-dir", outputDir: "/tmp/custom-output" });
  assert.equal(queuedTaskId, "task-output-dir");
});

test("retry requeues task and clears failure metadata before running again", async () => {
  let resetCalledWith: string | undefined;
  let queuedTaskId: string | undefined;
  const service = new TaskService(
    {
      enqueue(taskId: string) {
        queuedTaskId = taskId;
      },
      cancel() {
        return false;
      },
    } as any,
    {
      createTask: async () => {
        throw new Error("createTask should not run during retry");
      },
      deleteTask: async () => {},
      getTask: async () => ({
        id: "task-retry",
        url: "https://example.com/video",
        platform: "youtube",
        stage: "created",
        status: "queued",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      getTaskRequest: async () => createRequest({ subtitles: true, summary: true }),
      listTasks: async () => [],
      markTaskCanceled: async () => {},
      resetTaskForRetry: async (taskId: string) => {
        resetCalledWith = taskId;
      },
      updateTaskStage: async () => {},
      replaceTranscript: async () => {},
      upsertSummary: async () => {},
      upsertMindmap: async () => {},
      ensureTaskDir: async () => "/tmp/task-retry",
      removeTaskDir: async () => {},
      taskFile: () => "/tmp/task-retry/subtitles.json",
      dumpInfo: async () => ({ title: "Test Video", duration: 31 }),
      downloadMedia: async () => {},
      fetchSubtitles: async () => ({
        source: "platform",
        segments: [],
        formats: [],
        hasSrt: false,
        hasVtt: false,
      }),
      generateSummary: async () => "# Summary",
      generateMindmap: async () => "# Mindmap",
      loadSettings: async () => ({
        ai: { provider: "openai_compatible", asrEnabled: true },
        download: {},
        storage: { maxTasks: 200 },
      }),
      readFile: async () => "[]",
      writeFile: async () => {},
      setTaskOutputDir: () => {},
    } as any,
  );

  const task = await service.retry("task-retry");

  assert.equal(resetCalledWith, "task-retry");
  assert.equal(queuedTaskId, "task-retry");
  assert.equal(task.status, "queued");
});

test("runPipeline marks abort-like failures as canceled instead of failed", async () => {
  let canceledTaskId: string | undefined;
  let failedStageSeen = false;
  const service = new TaskService(
    {
      enqueue() {},
      cancel() {
        return false;
      },
    } as any,
    {
      dumpInfo: async () => ({ title: "Test Video", duration: 31 }),
      downloadMedia: async () => {},
      fetchSubtitles: async () => ({
        source: "platform",
        segments: [{ startMs: 0, endMs: 1000, text: "hello" }],
        formats: ["json", "srt", "txt", "vtt"],
        hasSrt: true,
        hasVtt: true,
      }),
      generateSummary: async () => {
        throw new Error("aborted by user");
      },
      generateMindmap: async () => "mindmap",
      replaceTranscript: async () => {},
      upsertSummary: async () => {},
      upsertMindmap: async () => {},
      ensureTaskDir: async () => "/tmp/task-canceled",
      taskFile: () => "/tmp/task-canceled/subtitles.json",
      loadSettings: async () => ({
        ai: { provider: "openai_compatible", asrEnabled: true },
        download: {},
        storage: { maxTasks: 200 },
      }),
      setTaskOutputDir: () => {},
      updateTaskStage: async (_taskId: string, stage: string) => {
        if (stage === "failed") failedStageSeen = true;
      },
      markTaskCanceled: async (taskId: string) => {
        canceledTaskId = taskId;
      },
      readFile: async () => JSON.stringify([{ startMs: 0, endMs: 1000, text: "hello" }]),
      writeFile: async () => {},
    } as any,
  );

  await (service as any).runPipeline(
    "task-canceled",
    createRequest({ subtitles: true, summary: true }),
    new AbortController().signal,
  );

  assert.equal(canceledTaskId, "task-canceled");
  assert.equal(failedStageSeen, false);
});

test("runPipeline records the active stage when summary fails after subtitles succeeded", async () => {
  let failedRuntime: Record<string, unknown> | undefined;
  const service = new TaskService(
    {
      enqueue() {},
      cancel() {
        return false;
      },
    } as any,
    {
      dumpInfo: async () => ({ title: "Test Video", duration: 31 }),
      downloadMedia: async () => {},
      fetchSubtitles: async () => ({
        source: "asr",
        segments: [{ startMs: 0, endMs: 1000, text: "hello" }],
        formats: ["json", "srt", "txt", "vtt"],
        hasSrt: true,
        hasVtt: true,
      }),
      generateSummary: async () => {
        throw new Error("AI 请求失败: 401 invalid api key");
      },
      generateMindmap: async () => "mindmap",
      replaceTranscript: async () => {},
      upsertSummary: async () => {},
      upsertMindmap: async () => {},
      ensureTaskDir: async () => "/tmp/task-summary-failed",
      taskFile: () => "/tmp/task-summary-failed/subtitles.json",
      loadSettings: async () => ({
        ai: { provider: "openai_compatible", asrEnabled: true },
        download: {},
        storage: { maxTasks: 200 },
      }),
      setTaskOutputDir: () => {},
      updateTaskStage: async (_taskId: string, stage: string, opts?: Record<string, unknown>) => {
        if (stage === "failed") {
          failedRuntime = opts?.runtime as Record<string, unknown> | undefined;
        }
      },
      markTaskCanceled: async () => {
        throw new Error("markTaskCanceled should not run for summary failure");
      },
      readFile: async () => JSON.stringify([{ startMs: 0, endMs: 1000, text: "hello" }]),
      writeFile: async () => {},
    } as any,
  );

  await (service as any).runPipeline(
    "task-summary-failed",
    createRequest({ parse: true, subtitles: true, summary: true }),
    new AbortController().signal,
  );

  assert.equal(failedRuntime?.lastCompletedStage, "subtitles");
  assert.equal(failedRuntime?.failureStage, "summary");
});
