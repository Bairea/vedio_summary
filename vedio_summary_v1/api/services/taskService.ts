import {
  type CreateTaskRequest,
  type TaskArtifactsDTO,
  type TaskDTO,
  type TaskExecutionStage,
  type VideoPlatform,
} from "../../shared/types.js";
import {
  createTask,
  deleteTask,
  getTask,
  getTaskRequest,
  listTasks,
  markTaskCanceled,
  resetTaskForRetry,
  updateTaskStage,
} from "../repositories/taskRepo.js";
import { replaceTranscript } from "../repositories/transcriptRepo.js";
import { upsertSummary } from "../repositories/summaryRepo.js";
import { upsertMindmap } from "../repositories/mindmapRepo.js";
import { loadSettings } from "../repositories/settingsRepo.js";
import { JobQueue } from "./jobQueue.js";
import { ensureTaskDir, removeTaskDir, taskFile } from "./fileStore.js";
import { dumpInfo, downloadMedia } from "./ytdlpService.js";
import { fetchSubtitles } from "./subtitleService.js";
import { generateSummary } from "./summaryService.js";
import { generateMindmap } from "./mindmapService.js";
import fs from "fs/promises";
import { setTaskOutputDir } from "../lib/paths.js";

function detectPlatform(url: string): VideoPlatform {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host.includes("bilibili.com") || host === "b23.tv") return "bilibili";
    if (host.includes("youtube.com") || host === "youtu.be") return "youtube";
    return "unknown";
  } catch {
    return "unknown";
  }
}

export class TaskService {
  constructor(
    private queue: JobQueue,
    private deps: TaskServiceDeps = defaultTaskServiceDeps,
  ) {}

  async create(req: CreateTaskRequest): Promise<TaskDTO> {
    const normalized: CreateTaskRequest = {
      ...req,
      pipeline: {
        ...req.pipeline,
        subtitles: req.pipeline.subtitles || req.pipeline.summary || req.pipeline.mindmap || req.pipeline.qaIndex,
      },
    };

    const platform = detectPlatform(req.url);
    const settings = await this.deps.loadSettings();
    this.deps.setTaskOutputDir(settings.download.outputDir);
    const task = await this.deps.createTask({ ...normalized, platform });
    await this.deps.ensureTaskDir(task.id, settings.download.outputDir);
    this.queue.enqueue(task.id, async ({ signal }) => this.runPipeline(task.id, normalized, signal));
    return task;
  }

  async list(): Promise<TaskDTO[]> {
    return this.deps.listTasks();
  }

  async get(id: string): Promise<TaskDTO | undefined> {
    return this.deps.getTask(id);
  }

  async cancel(id: string): Promise<boolean> {
    const canceled = this.queue.cancel(id);
    await this.deps.markTaskCanceled(id);
    return canceled;
  }

  async remove(id: string): Promise<void> {
    this.queue.cancel(id);
    await this.deps.deleteTask(id);
    await this.deps.removeTaskDir(id);
  }

  async retry(id: string): Promise<TaskDTO> {
    const req = await this.deps.getTaskRequest(id);
    if (!req) {
      throw new Error("未找到可重试的任务请求参数");
    }

    const settings = await this.deps.loadSettings();
    this.deps.setTaskOutputDir(settings.download.outputDir);
    await this.deps.resetTaskForRetry(id);
    this.queue.enqueue(id, async ({ signal }) => this.runPipeline(id, req, signal));
    const task = await this.deps.getTask(id);
    if (!task) throw new Error("任务不存在");
    return task;
  }

  private async runPipeline(taskId: string, req: CreateTaskRequest, signal: AbortSignal): Promise<void> {
    const settings = await this.deps.loadSettings();
    this.deps.setTaskOutputDir(settings.download.outputDir);
    await this.deps.ensureTaskDir(taskId, settings.download.outputDir);

    let lastCompletedStage: TaskExecutionStage | undefined;
    let artifacts = emptyArtifacts();

    try {
      if (signal.aborted) {
        await this.deps.markTaskCanceled(taskId);
        return;
      }

      let info: Awaited<ReturnType<TaskServiceDeps["dumpInfo"]>> | undefined;

      if (req.pipeline.parse) {
        await this.deps.updateTaskStage(taskId, "parsing", {
          progress: 10,
          error: null,
          runtime: buildRunningRuntime("parse", lastCompletedStage, artifacts),
        });
        info = await this.deps.dumpInfo(req.url, signal);
        lastCompletedStage = "parse";
        await this.deps.updateTaskStage(taskId, "parsing", {
          progress: 18,
          error: null,
          title: info.title ?? null,
          durationSec: info.duration ? Math.round(info.duration) : null,
          runtime: buildRunningRuntime("parse", lastCompletedStage, artifacts),
        });
      }

      if (signal.aborted) {
        await this.deps.markTaskCanceled(taskId);
        return;
      }

      if (req.pipeline.download) {
        await this.deps.updateTaskStage(taskId, "downloading", {
          progress: 30,
          error: null,
          runtime: buildRunningRuntime("download", lastCompletedStage, artifacts),
        });
        await this.deps.downloadMedia(req.url, this.deps.taskFile(taskId), {
          audioOnly: req.download?.audioOnly,
          quality: req.download?.quality,
          signal,
        });
        lastCompletedStage = "download";
        await this.deps.updateTaskStage(taskId, "downloading", {
          progress: 45,
          error: null,
          runtime: buildRunningRuntime("download", lastCompletedStage, artifacts),
        });
      }

      if (signal.aborted) {
        await this.deps.markTaskCanceled(taskId);
        return;
      }

      if (req.pipeline.subtitles) {
        await this.deps.updateTaskStage(taskId, "transcribing", {
          progress: 55,
          error: null,
          runtime: buildRunningRuntime("subtitles", lastCompletedStage, artifacts),
        });
        const { segments, formats } = await this.deps.fetchSubtitles({
          taskId,
          url: req.url,
          language: req.language,
          signal,
        });
        if (!segments.length) throw new Error("未能获取字幕（平台无字幕或需要 Cookies/登录）");
        await this.deps.replaceTranscript(taskId, segments);
        await this.deps.writeFile(this.deps.taskFile(taskId, "subtitles.json"), JSON.stringify(segments), "utf-8");
        artifacts = {
          ...artifacts,
          transcriptReady: true,
          subtitleFormats: formats,
        };
        lastCompletedStage = "subtitles";
        await this.deps.updateTaskStage(taskId, "transcribing", {
          progress: 65,
          error: null,
          runtime: buildRunningRuntime("subtitles", lastCompletedStage, artifacts),
        });
      }

      if (signal.aborted) {
        await this.deps.markTaskCanceled(taskId);
        return;
      }

      if (req.pipeline.summary) {
        await this.deps.updateTaskStage(taskId, "summarizing", {
          progress: 75,
          error: null,
          runtime: buildRunningRuntime("summary", lastCompletedStage, artifacts),
        });
        const segJson = await this.deps.readFile(this.deps.taskFile(taskId, "subtitles.json"), "utf-8");
        const segments = JSON.parse(segJson) as Array<{ startMs: number; endMs: number; text: string }>;
        const markdown = await this.deps.generateSummary(segments, signal);
        await this.deps.upsertSummary(taskId, markdown);
        artifacts = {
          ...artifacts,
          summaryReady: true,
        };
        lastCompletedStage = "summary";
        await this.deps.updateTaskStage(taskId, "summarizing", {
          progress: 82,
          error: null,
          runtime: buildRunningRuntime("summary", lastCompletedStage, artifacts),
        });
      }

      if (signal.aborted) {
        await this.deps.markTaskCanceled(taskId);
        return;
      }

      if (req.pipeline.mindmap) {
        await this.deps.updateTaskStage(taskId, "mindmap", {
          progress: 88,
          error: null,
          runtime: buildRunningRuntime("mindmap", lastCompletedStage, artifacts),
        });
        const segJson = await this.deps.readFile(this.deps.taskFile(taskId, "subtitles.json"), "utf-8");
        const segments = JSON.parse(segJson) as Array<{ startMs: number; endMs: number; text: string }>;
        const mindmap = await this.deps.generateMindmap(segments, signal);
        await this.deps.upsertMindmap(taskId, mindmap);
        artifacts = {
          ...artifacts,
          mindmapReady: true,
        };
        lastCompletedStage = "mindmap";
        await this.deps.updateTaskStage(taskId, "mindmap", {
          progress: 92,
          error: null,
          runtime: buildRunningRuntime("mindmap", lastCompletedStage, artifacts),
        });
      }

      if (signal.aborted) {
        await this.deps.markTaskCanceled(taskId);
        return;
      }

      if (req.pipeline.qaIndex) {
        artifacts = {
          ...artifacts,
          qaReady: artifacts.transcriptReady,
        };
        lastCompletedStage = "qaIndex";
        await this.deps.updateTaskStage(taskId, "indexing", {
          progress: 96,
          error: null,
          runtime: buildRunningRuntime("qaIndex", lastCompletedStage, artifacts),
        });
      }

      await this.deps.updateTaskStage(taskId, "ready", {
        progress: 100,
        error: null,
        runtime: {
          status: "succeeded",
          currentStage: undefined,
          lastCompletedStage,
          failureStage: undefined,
          failureCode: undefined,
          retryable: false,
          artifacts,
        },
      });
    } catch (e) {
      if (isAbortLikeError(e, signal)) {
        await this.deps.markTaskCanceled(taskId);
        return;
      }
      const msg = e instanceof Error ? e.message : "Unknown error";
      await this.deps.updateTaskStage(taskId, "failed", {
        progress: null,
        error: msg,
        runtime: {
          status: "failed",
          currentStage: undefined,
          lastCompletedStage,
          failureStage: inferFailureStage(req, lastCompletedStage),
          failureCode: inferFailureCode(msg),
          retryable: true,
          artifacts,
        },
      });
    }
  }
}

type TaskServiceDeps = {
  createTask: typeof createTask;
  deleteTask: typeof deleteTask;
  getTask: typeof getTask;
  getTaskRequest: typeof getTaskRequest;
  listTasks: typeof listTasks;
  markTaskCanceled: typeof markTaskCanceled;
  resetTaskForRetry: typeof resetTaskForRetry;
  updateTaskStage: typeof updateTaskStage;
  replaceTranscript: typeof replaceTranscript;
  upsertSummary: typeof upsertSummary;
  upsertMindmap: typeof upsertMindmap;
  ensureTaskDir: typeof ensureTaskDir;
  removeTaskDir: typeof removeTaskDir;
  taskFile: typeof taskFile;
  dumpInfo: typeof dumpInfo;
  downloadMedia: typeof downloadMedia;
  fetchSubtitles: typeof fetchSubtitles;
  generateSummary: typeof generateSummary;
  generateMindmap: typeof generateMindmap;
  loadSettings: typeof loadSettings;
  readFile: typeof fs.readFile;
  writeFile: typeof fs.writeFile;
  setTaskOutputDir: typeof setTaskOutputDir;
};

const defaultTaskServiceDeps: TaskServiceDeps = {
  createTask,
  deleteTask,
  getTask,
  getTaskRequest,
  listTasks,
  markTaskCanceled,
  resetTaskForRetry,
  updateTaskStage,
  replaceTranscript,
  upsertSummary,
  upsertMindmap,
  ensureTaskDir,
  removeTaskDir,
  taskFile,
  dumpInfo,
  downloadMedia,
  fetchSubtitles,
  generateSummary,
  generateMindmap,
  loadSettings,
  readFile: fs.readFile.bind(fs),
  writeFile: fs.writeFile.bind(fs),
  setTaskOutputDir,
};

function emptyArtifacts(): TaskArtifactsDTO {
  return {
    transcriptReady: false,
    summaryReady: false,
    mindmapReady: false,
    qaReady: false,
    subtitleFormats: [],
  };
}

function buildRunningRuntime(
  currentStage: TaskExecutionStage,
  lastCompletedStage: TaskExecutionStage | undefined,
  artifacts: TaskArtifactsDTO,
): {
  status: "running";
  currentStage: TaskExecutionStage;
  lastCompletedStage: TaskExecutionStage | undefined;
  retryable: false;
  artifacts: TaskArtifactsDTO;
} {
  return {
    status: "running",
    currentStage,
    lastCompletedStage,
    retryable: false,
    artifacts,
  };
}

function isAbortLikeError(error: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) return true;
  if (!(error instanceof Error)) return false;
  return /abort|aborted|canceled/i.test(error.message);
}

function inferFailureCode(message: string): string {
  if (/weights\.npz|权重文件/.test(message)) return "whisper_weights_missing";
  if (/mlx_whisper|本地 Whisper 转写失败|Whisper 运行时/.test(message)) return "whisper_runtime_missing";
  if (/cookies|风控|412|403/i.test(message)) return "upstream_auth_required";
  if (/subtitle|字幕/.test(message)) return "subtitle_failed";
  return "pipeline_failed";
}

function inferFailureStage(
  req: CreateTaskRequest,
  lastCompletedStage: TaskExecutionStage | undefined,
): TaskExecutionStage | undefined {
  const order: TaskExecutionStage[] = ["parse", "download", "subtitles", "summary", "mindmap", "qaIndex"];
  const lastCompletedIndex = lastCompletedStage ? order.indexOf(lastCompletedStage) : -1;

  for (let index = lastCompletedIndex + 1; index < order.length; index += 1) {
    const stage = order[index];
    if (req.pipeline[stage]) {
      return stage;
    }
  }

  return undefined;
}
