import assert from "node:assert/strict";
import { test } from "node:test";
import { formatWhisperExecError } from "../whisperTranscribe.js";

test("formatWhisperExecError adds uv guidance when mlx_whisper module is missing", () => {
  const error = {
    message: "Command failed: python3 transcribe.py audio.m4a whisper zh",
    stderr: "Traceback (most recent call last):\nModuleNotFoundError: No module named 'mlx_whisper'\n",
  };

  const message = formatWhisperExecError(error);

  assert.match(message, /mlx_whisper/);
  assert.match(message, /uv venv \.venv/);
});

test("formatWhisperExecError keeps stderr context when command exits with other runtime error", () => {
  const error = {
    message: "Command failed: python3 transcribe.py audio.m4a whisper zh",
    stderr: "ValueError: invalid model config\n",
  };

  const message = formatWhisperExecError(error);

  assert.match(message, /invalid model config/);
});

test("formatWhisperExecError surfaces ffmpeg dynamic library issues with actionable hint", () => {
  const error = {
    message: "Command failed",
    stderr:
      "mlx-whisper 转写失败：Failed to load audio: dyld: Library not loaded: /opt/homebrew/opt/libvpx/lib/libvpx.11.dylib",
  };

  const message = formatWhisperExecError(error);

  assert.match(message, /ffmpeg/);
  assert.match(message, /brew reinstall ffmpeg libvpx/);
});
