import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildLocalWhisperCommand,
  ensureLocalWhisperReady,
  parseLocalWhisperOutput,
  resolveAsarUnpackedPath,
} from "../localWhisper.js";

test("buildLocalWhisperCommand: builds python command with optional language", () => {
  const result = buildLocalWhisperCommand({
    pythonBin: "python3",
    scriptPath: "/tmp/mlx_whisper_transcribe.py",
    audioPath: "/tmp/audio.m4a",
    modelDir: "/tmp/whisper",
    language: "zh",
  });

  assert.equal(result.command, "python3");
  assert.deepEqual(result.args, [
    "/tmp/mlx_whisper_transcribe.py",
    "/tmp/audio.m4a",
    "/tmp/whisper",
    "zh",
  ]);
});

test("resolveAsarUnpackedPath: points external Python to unpacked helper scripts", () => {
  assert.equal(
    resolveAsarUnpackedPath("/Applications/App.app/Contents/Resources/app.asar/dist-electron/scripts/mlx_whisper_transcribe.py"),
    "/Applications/App.app/Contents/Resources/app.asar.unpacked/dist-electron/scripts/mlx_whisper_transcribe.py",
  );
});

test("ensureLocalWhisperReady: throws explicit error when weights file is missing", async () => {
  await assert.rejects(
    async () =>
      ensureLocalWhisperReady({
        configExists: true,
        weightsExists: false,
        configPath: "/tmp/whisper/config.json",
        weightsPath: "/tmp/whisper/weights.npz",
      }),
    /未检测到 Whisper 权重文件：\/tmp\/whisper\/weights\.npz/,
  );
});

test("parseLocalWhisperOutput: normalizes segments from mlx-whisper JSON", () => {
  const segments = parseLocalWhisperOutput(
    JSON.stringify({
      segments: [
        { start: 0.12, end: 1.6, text: " 你好 " },
        { start: 2, end: 2.5, text: " " },
      ],
    }),
  );

  assert.deepEqual(segments, [{ startMs: 120, endMs: 1600, text: "你好" }]);
});
