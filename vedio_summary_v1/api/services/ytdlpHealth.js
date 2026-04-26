import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function defaultRunVersion(bin) {
  await execFileAsync(bin, ["--version"], { timeout: 3000 });
}

async function defaultFileExists() {
  return false;
}

function formatExecError(error) {
  const msg =
    error instanceof Error ? error.message : String(error || "unknown error");
  return msg.slice(0, 120);
}

export async function detectYtDlp({
  configuredPath,
  bundledPath,
  fileExists = defaultFileExists,
  runVersion = defaultRunVersion,
}) {
  if (configuredPath) {
    if (!(await fileExists(configuredPath))) {
      return {
        ok: false,
        detail: `设置中的路径不存在：${configuredPath}`,
        path: configuredPath,
        source: "configured",
      };
    }

    try {
      await runVersion(configuredPath);
      return {
        ok: true,
        detail: `使用设置中的路径：${configuredPath}`,
        path: configuredPath,
        source: "configured",
      };
    } catch (error) {
      return {
        ok: false,
        detail: `设置中的 yt-dlp 不可执行：${configuredPath}（${formatExecError(error)}）`,
        path: configuredPath,
        source: "configured",
      };
    }
  }

  let bundledFailure;
  if (bundledPath && (await fileExists(bundledPath))) {
    try {
      await runVersion(bundledPath);
      return {
        ok: true,
        detail: `使用项目内置二进制：${bundledPath}`,
        path: bundledPath,
        source: "bundled",
      };
    } catch (error) {
      bundledFailure = {
        ok: false,
        detail: `项目内置 yt-dlp 不可执行：${bundledPath}（${formatExecError(error)}）`,
        path: bundledPath,
        source: "bundled",
      };
    }
  }

  try {
    await runVersion("yt-dlp");
    return {
      ok: true,
      detail: bundledFailure
        ? `项目内置 yt-dlp 不可执行，已回退到系统 PATH 中的 yt-dlp`
        : "使用系统 PATH 中的 yt-dlp",
      path: "yt-dlp",
      source: "system",
    };
  } catch {
    if (bundledFailure) return bundledFailure;
    return {
      ok: false,
      detail:
        "未检测到可用的 yt-dlp，可在设置中指定路径或放置到 .data/bin/yt-dlp",
      source: "missing",
    };
  }
}
