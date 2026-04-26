import fs from "fs/promises";
import path from "path";
import { resolveDataDir } from "../lib/paths.js";

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function ensureLocalYtDlp(): Promise<string> {
  const binDir = path.join(resolveDataDir(), "bin");
  const binPath = path.join(binDir, "yt-dlp");

  if (await exists(binPath)) return binPath;

  await fs.mkdir(binDir, { recursive: true });

  const url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`yt-dlp 下载失败: ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  await fs.writeFile(binPath, buf);
  await fs.chmod(binPath, 0o755);
  return binPath;
}

