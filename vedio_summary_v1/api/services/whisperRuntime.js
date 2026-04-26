import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolvePythonRuntime } from "./pythonRuntime.js";

const execFileAsync = promisify(execFile);

export async function probeLocalWhisperRuntime() {
  const pythonRuntime = await resolvePythonRuntime();
  try {
    await execFileAsync(
      pythonRuntime.command,
      [
        ...pythonRuntime.argsPrefix,
        "-c",
        "import mlx_whisper; print('mlx_whisper ok')",
      ],
      { timeout: 3000 },
    );
    return {
      ok: true,
      detail: `运行时可用：${pythonRuntime.label}`,
      pythonBin: pythonRuntime.label,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error || "unknown error");
    return {
      ok: false,
      detail: `无法导入 mlx_whisper；如使用 uv，请先执行 \`uv venv .venv && uv pip install --python .venv/bin/python mlx-whisper\`（${message.slice(0, 120)}）`,
      pythonBin: pythonRuntime.label,
    };
  }
}
