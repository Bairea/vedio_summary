import fs from "node:fs/promises";
import path from "node:path";

export type PythonRuntime = {
  command: string;
  argsPrefix: string[];
  label: string;
};

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function resolvePythonRuntime(opts?: {
  appDir?: string;
  env?: NodeJS.ProcessEnv;
  fileExists?: (filePath: string) => Promise<boolean>;
}): Promise<PythonRuntime> {
  const appDir = opts?.appDir || process.cwd();
  const env = opts?.env || process.env;
  const fileExistsFn = opts?.fileExists || fileExists;

  const explicitPython = env.MLX_WHISPER_PYTHON?.trim();
  if (explicitPython) {
    return {
      command: explicitPython,
      argsPrefix: [],
      label: explicitPython,
    };
  }

  const venvPython = path.join(appDir, ".venv", "bin", "python");
  if (await fileExistsFn(venvPython)) {
    return {
      command: venvPython,
      argsPrefix: [],
      label: venvPython,
    };
  }

  return {
    command: "python3",
    argsPrefix: [],
    label: "python3",
  };
}
