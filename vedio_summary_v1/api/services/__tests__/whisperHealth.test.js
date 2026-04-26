import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  buildWhisperHealthChecks,
  getLocalWhisperPaths,
} from "../whisperHealth.js";

test("getLocalWhisperPaths: resolves workspace whisper assets from app directory", () => {
  const appDir = path.join("/tmp", "workspace", "vedio_summary_v1");
  const expectedWhisperDir = path.join("/tmp", "workspace", "whisper");
  const paths = getLocalWhisperPaths(appDir);

  assert.equal(paths.modelDir, expectedWhisperDir);
  assert.equal(paths.configPath, path.join(expectedWhisperDir, "config.json"));
  assert.equal(paths.weightsPath, path.join(expectedWhisperDir, "weights.npz"));
});

test("buildWhisperHealthChecks: reports local whisper and weights separately", () => {
  const checks = buildWhisperHealthChecks({
    modelDir: "/tmp/whisper",
    configPath: "/tmp/whisper/config.json",
    weightsPath: "/tmp/whisper/weights.npz",
    modelDirExists: true,
    configExists: true,
    weightsExists: false,
    runtimeOk: true,
    runtimeDetail: "mlx_whisper 可用",
  });

  assert.equal(checks.localWhisper.ok, true);
  assert.equal(checks.localWhisper.required, false);
  assert.match(checks.localWhisper.detail, /已检测到本地 Whisper 目录/);

  assert.equal(checks.whisperWeights.ok, false);
  assert.equal(checks.whisperWeights.required, false);
  assert.match(checks.whisperWeights.detail, /未检测到权重文件/);
});

test("buildWhisperHealthChecks: surfaces missing mlx_whisper runtime", () => {
  const checks = buildWhisperHealthChecks({
    modelDir: "/tmp/whisper",
    configPath: "/tmp/whisper/config.json",
    weightsPath: "/tmp/whisper/weights.npz",
    modelDirExists: true,
    configExists: true,
    weightsExists: true,
    runtimeOk: false,
    runtimeDetail: "无法导入 mlx_whisper，请先执行 `pip install mlx-whisper`",
  });

  assert.equal(checks.localWhisper.ok, false);
  assert.match(checks.localWhisper.detail, /pip install mlx-whisper/);
});
