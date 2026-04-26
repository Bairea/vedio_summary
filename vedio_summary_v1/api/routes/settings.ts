import { Router, type Request, type Response } from "express";
import { type AppSettings } from "../../shared/types.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { loadSettings, saveSettings } from "../repositories/settingsRepo.js";
import fs from "fs/promises";
import path from "path";
import { resolveDataDir, setTaskOutputDir } from "../lib/paths.js";
import { normalizeOpenAIBaseUrl } from "../services/openaiBaseUrl.js";
import { cookieHeaderToNetscape, isProbablyNetscapeCookies } from "../lib/cookiesConvert.js";
import { resolveCookiesPath } from "../services/ytdlpService.js";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
  const settings = await loadSettings();
  const effectiveCookiesPath = await resolveCookiesPath({
    configuredCookiesPath: settings.download.cookiesPath,
    defaultCookiesPath: path.join(resolveDataDir(), "cookies.txt"),
  });
  res.json({
    ...settings,
    download: {
      ...settings.download,
      cookiesPath: effectiveCookiesPath,
    },
  });
  }),
);

router.put(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
  const partial = req.body as Partial<AppSettings>;
  const settings = await saveSettings(partial);
  setTaskOutputDir(settings.download.outputDir);
  res.json({ ok: true, settings });
  }),
);

router.post(
  "/test-ai",
  asyncHandler(async (req: Request, res: Response) => {
  const settings = await loadSettings();
  const baseUrl = settings.ai.baseUrl ? normalizeOpenAIBaseUrl(settings.ai.baseUrl) : undefined;
  const apiKey = settings.ai.apiKey;
  const model = settings.ai.model;
  if (!baseUrl || !apiKey || !model) {
    res.status(400).json({ ok: false, message: "未配置 Base URL / API Key / Model" });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "ping" }],
        temperature: 0,
        max_tokens: 1,
        stream: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      const extra =
        resp.status === 404
          ? "（请确认 Base URL 不要重复包含 /v1，例如填 https://api.openai.com 而不是 https://api.openai.com/v1）"
          : "";
      res.status(200).json({ ok: false, message: `请求失败: ${resp.status} ${extra} ${text}`.trim().slice(0, 260) });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    clearTimeout(timeout);
    const msg = e instanceof Error ? e.message : "unknown error";
    res.status(200).json({ ok: false, message: msg });
  }
  }),
);

router.get(
  "/cookies/status",
  asyncHandler(async (req: Request, res: Response) => {
    const settings = await loadSettings();
    const p =
      (await resolveCookiesPath({
        configuredCookiesPath: settings.download.cookiesPath,
        defaultCookiesPath: path.join(resolveDataDir(), "cookies.txt"),
      })) || path.join(resolveDataDir(), "cookies.txt");
    let exists = false;
    try {
      await fs.access(p);
      exists = true;
    } catch {
      exists = false;
    }
    res.json({ exists, path: p });
  }),
);

router.post(
  "/cookies",
  asyncHandler(async (req: Request, res: Response) => {
    const content = String((req.body as { content?: string })?.content ?? "");
    if (!content.trim()) {
      res.status(400).json({ ok: false, message: "content required" });
      return;
    }

    const p = path.join(resolveDataDir(), "cookies.txt");
    await fs.mkdir(resolveDataDir(), { recursive: true });
    const body = isProbablyNetscapeCookies(content)
      ? content
      : cookieHeaderToNetscape(content, { domain: ".bilibili.com", secure: true });
    await fs.writeFile(p, body, "utf-8");
    const settings = await saveSettings({ download: { cookiesPath: p } });
    res.json({ ok: true, path: p, settings });
  }),
);

export default router;
