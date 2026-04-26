import path from "path";

let taskOutputDirOverride: string | undefined;

export function setTaskOutputDir(outputDir?: string): void {
  const normalized = outputDir?.trim();
  taskOutputDirOverride = normalized ? path.resolve(normalized) : undefined;
}

export function resolveDataDir(): string {
  return path.join(process.cwd(), ".data");
}

export function resolveDbPath(): string {
  return path.join(resolveDataDir(), "app.db");
}

export function resolveTasksDir(outputDir = taskOutputDirOverride): string {
  return outputDir || path.join(resolveDataDir(), "tasks");
}

export function resolveTaskDir(taskId: string, outputDir = taskOutputDirOverride): string {
  return path.join(resolveTasksDir(outputDir), taskId);
}
