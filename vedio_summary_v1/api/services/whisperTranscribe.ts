import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { type TranscriptSegment } from "../lib/subtitleParse.js";
import { getLocalWhisperPaths } from "./whisperHealth.js";
import {
  buildLocalWhisperCommand,
  ensureLocalWhisperReady,
  getLocalWhisperScriptPath,
  parseLocalWhisperOutput,
} from "./localWhisper.js";
import { resolvePythonRuntime } from "./pythonRuntime.js";

const execFileAsync = promisify(execFile);

export function formatWhisperExecError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "unknown error");
  const stderr =
    typeof error === "object" && error !== null && "stderr" in error ? String((error as { stderr?: unknown }).stderr || "") : "";
  const combined = [message, stderr].filter(Boolean).join("\n").trim();

  if (/No module named 'mlx_whisper'|ModuleNotFoundError: No module named 'mlx_whisper'/.test(combined)) {
    return "未检测到 `mlx_whisper` 运行时；如使用 uv，请先执行 `uv venv .venv && uv pip install --python .venv/bin/python mlx-whisper`";
  }

  if (/Library not loaded: .*libvpx/i.test(combined) || /Failed to load audio: .*libvpx/i.test(combined)) {
    return "本地 Whisper 转写依赖的 ffmpeg 动态库缺失（libvpx）；请执行 `brew reinstall ffmpeg libvpx` 后重试";
  }

  return combined || "unknown error";
}

export async function transcribeWithWhisper(opts: {
  audioPath: string;
  language?: string;
  signal?: AbortSignal;
}): Promise<TranscriptSegment[]> {
  const whisperPaths = getLocalWhisperPaths(process.cwd());
  const [configExists, weightsExists] = await Promise.all([
    fileExists(whisperPaths.configPath),
    fileExists(whisperPaths.weightsPath),
  ]);

  ensureLocalWhisperReady({
    configExists,
    weightsExists,
    configPath: whisperPaths.configPath,
    weightsPath: whisperPaths.weightsPath,
  });

  const scriptPath = getLocalWhisperScriptPath(import.meta.url);
  const pythonRuntime = await resolvePythonRuntime();
  const { command, args } = buildLocalWhisperCommand({
    pythonBin: pythonRuntime.command,
    pythonArgsPrefix: pythonRuntime.argsPrefix,
    scriptPath,
    audioPath: opts.audioPath,
    modelDir: whisperPaths.modelDir,
    language: opts.language,
  });

  try {
    const { stdout } = await execFileAsync(command, args, {
      signal: opts.signal,
      timeout: 1000 * 60 * 20,
      maxBuffer: 1024 * 1024 * 16,
    });
    return parseLocalWhisperOutput(stdout);
  } catch (error) {
    throw new Error(`本地 Whisper 转写失败：${formatWhisperExecError(error)}`.slice(0, 320));
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
