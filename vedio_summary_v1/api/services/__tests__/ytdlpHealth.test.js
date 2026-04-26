import { test } from "node:test";
import assert from "node:assert/strict";
import { detectYtDlp } from "../ytdlpHealth.js";

test("detectYtDlp: configured path must be executable, not just present", async () => {
  const result = await detectYtDlp({
    configuredPath: "/tmp/yt-dlp",
    bundledPath: "/tmp/.data/bin/yt-dlp",
    fileExists: async (p) => p === "/tmp/yt-dlp",
    runVersion: async () => {
      throw new Error("permission denied");
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.source, "configured");
  assert.match(result.detail, /不可执行|执行失败/);
});

test("detectYtDlp: falls back to system yt-dlp when bundled binary is not executable", async () => {
  const result = await detectYtDlp({
    bundledPath: "/tmp/.data/bin/yt-dlp",
    fileExists: async (p) => p === "/tmp/.data/bin/yt-dlp",
    runVersion: async (bin) => {
      if (bin === "/tmp/.data/bin/yt-dlp") throw new Error("bad cpu type");
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.source, "system");
  assert.equal(result.path, "yt-dlp");
  assert.match(result.detail, /回退到系统 PATH/);
});
