import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveRuntimeStateForRow } from "../taskRepo.js";

test("deriveRuntimeStateForRow preserves failed stage semantics for legacy rows without runtime_json", () => {
  const runtime = deriveRuntimeStateForRow({
    stage: "failed",
    runtime_json: null,
  });

  assert.equal(runtime.status, "failed");
  assert.equal(runtime.retryable, true);
});

test("deriveRuntimeStateForRow preserves ready stage semantics for legacy rows without runtime_json", () => {
  const runtime = deriveRuntimeStateForRow({
    stage: "ready",
    runtime_json: null,
  });

  assert.equal(runtime.status, "succeeded");
  assert.equal(runtime.retryable, false);
});
