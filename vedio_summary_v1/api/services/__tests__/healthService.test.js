import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeHealth } from "../healthSummary.js";

test("summarizeHealth: marks required dependency gaps and ignores optional warnings", () => {
  const result = summarizeHealth({
    dataDir: { ok: true, label: "数据目录", required: true, detail: "ok" },
    aiConfig: {
      ok: false,
      label: "AI 摘要配置",
      required: true,
      detail: "缺少 API Key",
      missing: ["apiKey"],
    },
    cookies: {
      ok: false,
      label: "cookies.txt",
      required: false,
      detail: "未检测到 cookies.txt",
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "needs_attention");
  assert.match(result.summary, /AI 摘要配置/);
});

test("summarizeHealth: returns ready when all required checks pass", () => {
  const result = summarizeHealth({
    dataDir: { ok: true, label: "数据目录", required: true, detail: "ok" },
    aiConfig: { ok: true, label: "AI 摘要配置", required: true, detail: "已配置" },
    ytDlp: { ok: true, label: "yt-dlp", required: true, detail: "使用本地内置二进制" },
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "ready");
  assert.equal(result.summary, "运行基线已满足");
});
