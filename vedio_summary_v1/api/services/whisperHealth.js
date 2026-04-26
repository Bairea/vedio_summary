import path from "node:path";

export function getLocalWhisperPaths(appDir = process.cwd()) {
  const workspaceDir = path.resolve(appDir, "..");
  const modelDir = path.join(workspaceDir, "whisper");

  return {
    workspaceDir,
    modelDir,
    configPath: path.join(modelDir, "config.json"),
    weightsPath: path.join(modelDir, "weights.npz"),
  };
}

export function buildWhisperHealthChecks({
  modelDir,
  configPath,
  weightsPath,
  modelDirExists,
  configExists,
  weightsExists,
  runtimeOk = true,
  runtimeDetail,
}) {
  const runtimeIssue = !runtimeOk && runtimeDetail ? `；${runtimeDetail}` : "";
  return {
    localWhisper: {
      ok: modelDirExists && configExists && runtimeOk,
      label: "本地 Whisper",
      required: false,
      detail:
        modelDirExists && configExists
          ? `已检测到本地 Whisper 目录：${modelDir}${runtimeIssue}`
          : `未检测到完整本地 Whisper 目录，期望包含：${configPath}`,
      path: modelDir,
    },
    whisperWeights: {
      ok: weightsExists,
      label: "Whisper 权重",
      required: false,
      detail: weightsExists
        ? `已检测到权重文件：${weightsPath}`
        : `未检测到权重文件：${weightsPath}`,
      path: weightsPath,
    },
  };
}
