import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { loadSettings } from "../repositories/settingsRepo.js";
import { ensureLocalYtDlp } from "./ytdlpInstaller.js";
import { retry } from "../lib/retry.js";
import { resolveDataDir } from "../lib/paths.js";

type RunResult = { stdout: string; stderr: string };

function splitLines(s: string): string[] {
  return s.split(/\r?\n/).filter(Boolean);
}

export function getBiliWorkaroundArgs(url: string): string[] {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    host = "";
  }

  const isBili = host.includes("bilibili.com") || host === "b23.tv";
  if (!isBili) return [];

  const ua =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  return [
    "--user-agent",
    ua,
    "--add-header",
    "Referer:https://www.bilibili.com",
    "--add-header",
    "Origin:https://www.bilibili.com",
    "--add-header",
    "Accept-Language:zh-CN,zh;q=0.9,en;q=0.8",
    "--sleep-interval",
    "1",
    "--max-sleep-interval",
    "3",
    "--concurrent-fragments",
    "1",
  ];
}

async function resolveYtDlpBin(): Promise<string> {
  const settings = await loadSettings();
  const configured = settings.download.ytdlpPath?.trim();
  if (configured) return configured;

  const preferred = "yt-dlp";
  const ok = await probeBin(preferred);
  if (ok) return preferred;

  return ensureLocalYtDlp();
}

export async function resolveCookiesPath({
  configuredCookiesPath,
  defaultCookiesPath,
  fileExists: fileExistsFn = fileExists,
}: {
  configuredCookiesPath?: string;
  defaultCookiesPath: string;
  fileExists?: (filePath: string) => Promise<boolean>;
}): Promise<string | undefined> {
  const configured = configuredCookiesPath?.trim();
  if (configured && (await fileExistsFn(configured))) {
    return configured;
  }
  if (await fileExistsFn(defaultCookiesPath)) {
    return defaultCookiesPath;
  }
  return undefined;
}

async function getCommonArgs(): Promise<string[]> {
  const settings = await loadSettings();
  const args: string[] = [];
  if (settings.download.proxy?.trim()) args.push("--proxy", settings.download.proxy.trim());
  const configuredCookies = settings.download.cookiesPath?.trim();
  const defaultCookies = path.join(resolveDataDir(), "cookies.txt");
  const cookiesPath = await resolveCookiesPath({
    configuredCookiesPath: configuredCookies,
    defaultCookiesPath: defaultCookies,
  });
  if (cookiesPath) args.push("--cookies", cookiesPath);
  args.push("--retries", "5");
  args.push("--fragment-retries", "5");
  args.push("--extractor-retries", "5");
  args.push("--socket-timeout", "15");
  args.push("--retry-sleep", "1:3");
  return args;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function probeBin(bin: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(bin, ["--version"], { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

async function run(bin: string, args: string[], opts?: { cwd?: string; signal?: AbortSignal }): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd: opts?.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    const abort = () => {
      child.kill("SIGTERM");
    };

    if (opts?.signal) {
      if (opts.signal.aborted) abort();
      opts.signal.addEventListener("abort", abort, { once: true });
    }

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (opts?.signal) opts.signal.removeEventListener("abort", abort);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`yt-dlp failed (${code}): ${splitLines(stderr).slice(-8).join(" | ") || "unknown"}`));
    });
  });
}

export type YtDlpInfo = {
  title?: string;
  duration?: number;
  webpage_url?: string;
  extractor_key?: string;
  uploader?: string;
  thumbnail?: string;
};

export async function dumpInfo(url: string, signal?: AbortSignal): Promise<YtDlpInfo> {
  const bin = await resolveYtDlpBin();
  const common = await getCommonArgs();
  const workaround = getBiliWorkaroundArgs(url);
  const { stdout } = await retry(
    () => run(bin, ["--dump-single-json", "--no-warnings", "--no-playlist", ...common, ...workaround, url], { signal }),
    { retries: 2, baseDelayMs: 300, maxDelayMs: 1200, signal },
  );
  return JSON.parse(stdout) as YtDlpInfo;
}

export async function downloadMedia(
  url: string,
  outDir: string,
  opts: { audioOnly?: boolean; quality?: "best" | "1080p" | "720p" | "480p"; signal?: AbortSignal },
): Promise<void> {
  const bin = await resolveYtDlpBin();
  const common = await getCommonArgs();
  const workaround = getBiliWorkaroundArgs(url);
  await fs.mkdir(outDir, { recursive: true });

  const outTpl = path.join(outDir, opts.audioOnly ? "audio.%(ext)s" : "video.%(ext)s");
  const args: string[] = ["--no-warnings", "--no-playlist", ...common, ...workaround, "-o", outTpl];

  if (opts.audioOnly) {
    args.push("-f", "bestaudio/best");
  } else if (opts.quality && opts.quality !== "best") {
    const h = opts.quality.replace("p", "");
    args.push("-f", `best[height<=${h}]/best`);
  } else {
    args.push("-f", "best");
  }

  args.push(url);
  try {
    await retry(() => run(bin, args, { cwd: outDir, signal: opts.signal }), {
      retries: 2,
      baseDelayMs: 600,
      maxDelayMs: 2500,
      signal: opts.signal,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/HTTP Error 412/i.test(msg) || /Precondition Failed/i.test(msg)) {
      throw new Error("B 站请求被风控(412)：请更新 cookies.txt（登录态），并建议开启代理/降低请求频率后重试");
    }
    throw e;
  }
}

export async function downloadSubtitles(
  url: string,
  outDir: string,
  opts: { language?: string; signal?: AbortSignal },
): Promise<void> {
  const bin = await resolveYtDlpBin();
  const common = await getCommonArgs();
  const workaround = getBiliWorkaroundArgs(url);
  await fs.mkdir(outDir, { recursive: true });

  const outTpl = path.join(outDir, "video.%(ext)s");
  const args: string[] = [
    "--no-warnings",
    "--no-playlist",
    ...common,
    ...workaround,
    "--skip-download",
    "--write-subs",
    "--write-auto-subs",
    "--sub-format",
    "vtt",
    "-o",
    outTpl,
  ];

  if (opts.language) args.push("--sub-langs", opts.language);

  args.push(url);
  try {
    await retry(() => run(bin, args, { cwd: outDir, signal: opts.signal }), {
      retries: 3,
      baseDelayMs: 800,
      maxDelayMs: 4000,
      signal: opts.signal,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/sign in|login|cookies|403|forbidden/i.test(msg)) {
      throw new Error("字幕拉取失败：可能需要 cookies.txt（B 站登录态）或代理");
    }
    if (/HTTP Error 412/i.test(msg) || /Precondition Failed/i.test(msg)) {
      throw new Error("B 站请求被风控(412)：请更新 cookies.txt（登录态），并建议开启代理/降低请求频率后重试");
    }
    throw e;
  }
}
