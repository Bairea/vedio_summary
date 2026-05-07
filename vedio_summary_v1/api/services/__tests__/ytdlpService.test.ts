import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveCookiesPath } from "../ytdlpService.js";

test("resolveCookiesPath falls back to default cookies file when configured path is missing", async () => {
  const selected = await resolveCookiesPath({
    configuredCookiesPath: "/missing/cookies.txt",
    defaultCookiesPath: "/project/.data/cookies.txt",
    fileExists: async (filePath) => filePath === "/project/.data/cookies.txt",
  });

  assert.equal(selected, "/project/.data/cookies.txt");
});

test("resolveCookiesPath ignores missing configured path when no fallback file exists", async () => {
  const selected = await resolveCookiesPath({
    configuredCookiesPath: "/missing/cookies.txt",
    defaultCookiesPath: "/project/.data/cookies.txt",
    fileExists: async () => false,
  });

  assert.equal(selected, undefined);
});

test("resolveCookiesPath keeps configured path when the file exists", async () => {
  const selected = await resolveCookiesPath({
    configuredCookiesPath: "/custom/cookies.txt",
    defaultCookiesPath: "/project/.data/cookies.txt",
    fileExists: async (filePath) => filePath === "/custom/cookies.txt",
  });

  assert.equal(selected, "/custom/cookies.txt");
});

test("Bilibili smoke URL uses browser-like yt-dlp safeguards", async () => {
  const { getBiliWorkaroundArgs } = await import("../ytdlpService.js");
  const args = getBiliWorkaroundArgs(
    "https://www.bilibili.com/video/BV196oZB8E4e/?spm_id_from=333.337.search-card.all.click&vd_source=4b1e7ee91746c43e976596a40a3d3e6f",
  );

  assert.ok(args.includes("--user-agent"));
  assert.ok(args.includes("Referer:https://www.bilibili.com"));
  assert.ok(args.includes("Origin:https://www.bilibili.com"));
  assert.ok(args.includes("Accept-Language:zh-CN,zh;q=0.9,en;q=0.8"));
  assert.deepEqual(args.slice(-6), ["--sleep-interval", "1", "--max-sleep-interval", "3", "--concurrent-fragments", "1"]);
});
