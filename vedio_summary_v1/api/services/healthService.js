import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { loadSettings } from "../repositories/settingsRepo.js";
import { resolveDataDir } from "../lib/paths.js";
import { summarizeHealth } from "./healthSummary.js";
import { detectYtDlp } from "./ytdlpHealth.js";
import {
  buildWhisperHealthChecks,
  getLocalWhisperPaths,
} from "./whisperHealth.js";
import { probeLocalWhisperRuntime } from "./whisperRuntime.js";

const require = createRequire(import.meta.url);

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function getAiMissingFields(settings) {
  const missing = [];
  if (!settings.ai.baseUrl?.trim()) missing.push("baseUrl");
  if (!settings.ai.apiKey?.trim()) missing.push("apiKey");
  if (!settings.ai.model?.trim()) missing.push("model");
  return missing;
}

function detectMarkmap() {
  const missing = [];

  for (const name of ["markmap-lib", "markmap-view"]) {
    try {
      require.resolve(name);
    } catch {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    return {
      ok: false,
      detail: `缺少依赖：${missing.join(", ")}`,
      missing,
    };
  }

  return {
    ok: true,
    detail: "Markmap 运行依赖已安装",
    missing: [],
  };
}

export async function getHealthSnapshot() {
  const settings = await loadSettings();
  const dataDir = resolveDataDir();
  await fs.mkdir(dataDir, { recursive: true });
  const whisperPaths = getLocalWhisperPaths(process.cwd());
  const bundledYtDlpPath = path.join(resolveDataDir(), "bin", "yt-dlp");

  const aiMissing = getAiMissingFields(settings);
  const cookiesPath =
    settings.download.cookiesPath?.trim() || path.join(dataDir, "cookies.txt");
  const [
    cookiesExists,
    ytDlp,
    markmap,
    localWhisperRuntime,
    localWhisperExists,
    localWhisperConfigExists,
    whisperWeightsExists,
  ] = await Promise.all([
    exists(cookiesPath),
    detectYtDlp({
      configuredPath: settings.download.ytdlpPath?.trim(),
      bundledPath: bundledYtDlpPath,
      fileExists: exists,
    }),
    Promise.resolve(detectMarkmap()),
    probeLocalWhisperRuntime(),
    exists(whisperPaths.modelDir),
    exists(whisperPaths.configPath),
    exists(whisperPaths.weightsPath),
  ]);
  const whisperChecks = buildWhisperHealthChecks({
    modelDir: whisperPaths.modelDir,
    configPath: whisperPaths.configPath,
    weightsPath: whisperPaths.weightsPath,
    modelDirExists: localWhisperExists,
    configExists: localWhisperConfigExists,
    weightsExists: whisperWeightsExists,
    runtimeOk: localWhisperRuntime.ok,
    runtimeDetail: localWhisperRuntime.detail,
  });

  const checks = {
    dataDir: {
      ok: true,
      label: "数据目录",
      required: true,
      detail: `使用目录：${dataDir}`,
      path: dataDir,
    },
    aiConfig: {
      ok: aiMissing.length === 0,
      label: "AI 摘要配置",
      required: true,
      detail:
        aiMissing.length === 0
          ? "Base URL / API Key / Model 已配置，可继续用“测试 AI”验证连通性"
          : `缺少字段：${aiMissing.join(", ")}`,
      missing: aiMissing,
    },
    ytDlp: {
      ok: ytDlp.ok,
      label: "yt-dlp",
      required: true,
      detail: ytDlp.detail,
      path: ytDlp.path,
      source: ytDlp.source,
    },
    markmap: {
      ok: markmap.ok,
      label: "Markmap 依赖",
      required: true,
      detail: markmap.detail,
      missing: markmap.missing,
    },
    localWhisper: whisperChecks.localWhisper,
    whisperWeights: whisperChecks.whisperWeights,
    cookies: {
      ok: cookiesExists,
      label: "cookies.txt",
      required: false,
      detail: cookiesExists
        ? `已检测到：${cookiesPath}`
        : `未检测到：${cookiesPath}`,
      path: cookiesPath,
    },
  };

  return {
    checkedAt: new Date().toISOString(),
    ...summarizeHealth(checks),
    checks,
  };
}
