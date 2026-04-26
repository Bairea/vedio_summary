import assert from "node:assert/strict";
import { test } from "node:test";
import { resolvePythonRuntime } from "../pythonRuntime.js";

test("resolvePythonRuntime prefers explicit MLX_WHISPER_PYTHON", async () => {
  const runtime = await resolvePythonRuntime({
    appDir: "/project",
    env: {
      MLX_WHISPER_PYTHON: "/custom/python",
    },
    fileExists: async () => false,
  });

  assert.equal(runtime.command, "/custom/python");
  assert.equal(runtime.label, "/custom/python");
});

test("resolvePythonRuntime uses uv-managed .venv python when present", async () => {
  const runtime = await resolvePythonRuntime({
    appDir: "/project",
    env: {},
    fileExists: async (filePath) => filePath === "/project/.venv/bin/python",
  });

  assert.equal(runtime.command, "/project/.venv/bin/python");
  assert.equal(runtime.label, "/project/.venv/bin/python");
});

test("resolvePythonRuntime falls back to python3 when no override exists", async () => {
  const runtime = await resolvePythonRuntime({
    appDir: "/project",
    env: {},
    fileExists: async () => false,
  });

  assert.equal(runtime.command, "python3");
  assert.equal(runtime.label, "python3");
});
