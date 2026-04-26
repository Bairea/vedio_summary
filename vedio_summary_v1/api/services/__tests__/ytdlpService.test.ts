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
