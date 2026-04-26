import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { fetchSubtitles } from "../subtitleService.js";

const originalCwd = process.cwd();
const tempDirs: string[] = [];

afterEach(async () => {
  process.chdir(originalCwd);
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

async function createTempProjectDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "subtitle-service-"));
  tempDirs.push(dir);
  return dir;
}

function buildSettings(asrEnabled: boolean) {
  return {
    ai: {
      provider: "openai_compatible" as const,
      baseUrl: "https://example.com",
      apiKey: "test-key",
      model: "test-model",
      transcriptionModel: "unused",
      asrEnabled,
    },
    download: {},
    storage: {
      maxTasks: 200,
    },
  };
}

test("fetchSubtitles reuses platform subtitles when available", async () => {
  const projectDir = await createTempProjectDir();
  process.chdir(projectDir);

  const result = await (fetchSubtitles as any)(
    {
      taskId: "task-platform",
      url: "https://example.com/video",
      language: "zh-CN",
    },
    {
      downloadSubtitles: async (_url: string, outDir: string) => {
        await fs.mkdir(outDir, { recursive: true });
        await fs.writeFile(
          path.join(outDir, "video.zh.vtt"),
          `WEBVTT

00:00:00.000 --> 00:00:01.000
你好 世界
`,
          "utf-8",
        );
      },
      downloadMedia: async () => {
        throw new Error("downloadMedia should not be called when platform subtitles exist");
      },
      loadSettings: async () => buildSettings(true),
      transcribeWithWhisper: async () => {
        throw new Error("transcribeWithWhisper should not be called when platform subtitles exist");
      },
    },
  );

  assert.equal(result.source, "platform");
  assert.deepEqual(result.formats.sort(), ["json", "srt", "txt", "vtt"]);
  assert.equal(result.hasSrt, true);
  assert.equal(result.hasVtt, true);
  assert.equal(result.segments[0]?.text, "你好 世界");
});

test("fetchSubtitles fails with actionable error when whisper weights are missing", async () => {
  const projectDir = await createTempProjectDir();
  process.chdir(projectDir);

  await assert.rejects(
    () =>
      (fetchSubtitles as any)(
        {
          taskId: "task-missing-weights",
          url: "https://example.com/video",
          language: "en",
        },
        {
          downloadSubtitles: async () => {},
          downloadMedia: async (_url: string, outDir: string) => {
            await fs.mkdir(outDir, { recursive: true });
            await fs.writeFile(path.join(outDir, "audio.m4a"), "audio", "utf-8");
          },
          loadSettings: async () => buildSettings(true),
          transcribeWithWhisper: async () => {
            throw new Error("未检测到 Whisper 权重文件：/tmp/whisper/weights.npz");
          },
        },
      ),
    /权重文件|weights\.npz/,
  );
});

test("fetchSubtitles surfaces local whisper execution failures", async () => {
  const projectDir = await createTempProjectDir();
  process.chdir(projectDir);

  await assert.rejects(
    () =>
      (fetchSubtitles as any)(
        {
          taskId: "task-asr-failure",
          url: "https://example.com/video",
          language: "ja",
        },
        {
          downloadSubtitles: async () => {},
          downloadMedia: async (_url: string, outDir: string) => {
            await fs.mkdir(outDir, { recursive: true });
            await fs.writeFile(path.join(outDir, "audio.m4a"), "audio", "utf-8");
          },
          loadSettings: async () => buildSettings(true),
          transcribeWithWhisper: async () => {
            throw new Error("本地 Whisper 转写失败：python exited with code 1");
          },
        },
      ),
    /本地 Whisper 转写失败/,
  );
});
