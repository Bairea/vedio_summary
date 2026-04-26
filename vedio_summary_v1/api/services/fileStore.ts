import fs from "fs/promises";
import path from "path";
import { resolveTaskDir, resolveTasksDir } from "../lib/paths.js";

export async function ensureTasksDir(outputDir?: string): Promise<void> {
  await fs.mkdir(resolveTasksDir(outputDir), { recursive: true });
}

export async function ensureTaskDir(taskId: string, outputDir?: string): Promise<string> {
  await ensureTasksDir(outputDir);
  const dir = resolveTaskDir(taskId, outputDir);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export function taskFile(taskId: string, ...parts: string[]): string {
  return path.join(resolveTaskDir(taskId), ...parts);
}

export async function removeTaskDir(taskId: string, outputDir?: string): Promise<void> {
  await fs.rm(resolveTaskDir(taskId, outputDir), { recursive: true, force: true });
}
