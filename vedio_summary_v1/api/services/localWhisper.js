import { fileURLToPath } from "node:url";

export function ensureLocalWhisperReady({
  configExists,
  weightsExists,
  configPath,
  weightsPath,
}) {
  if (!configExists) {
    throw new Error(`未检测到 Whisper 配置文件：${configPath}`);
  }
  if (!weightsExists) {
    throw new Error(`未检测到 Whisper 权重文件：${weightsPath}`);
  }
}

export function getLocalWhisperScriptPath(importMetaUrl) {
  return fileURLToPath(
    new URL("../scripts/mlx_whisper_transcribe.py", importMetaUrl),
  );
}

export function buildLocalWhisperCommand({
  pythonBin,
  pythonArgsPrefix = [],
  scriptPath,
  audioPath,
  modelDir,
  language,
}) {
  const args = [...pythonArgsPrefix, scriptPath, audioPath, modelDir];
  if (language) args.push(language);
  return {
    command: pythonBin || "python3",
    args,
  };
}

export function parseLocalWhisperOutput(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error("本地 Whisper 返回了无法解析的 JSON");
  }

  const segments = Array.isArray(parsed?.segments) ? parsed.segments : [];
  const normalized = segments
    .map((segment) => ({
      startMs: Math.round(Number(segment?.start || 0) * 1000),
      endMs: Math.round(Number(segment?.end || 0) * 1000),
      text: String(segment?.text || "").trim(),
    }))
    .filter((segment) => segment.text.length > 0);

  if (!normalized.length) {
    throw new Error("本地 Whisper 未返回有效字幕片段");
  }

  return normalized;
}
