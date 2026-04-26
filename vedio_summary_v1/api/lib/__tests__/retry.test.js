import { test } from "node:test";
import assert from "node:assert/strict";
import { retry } from "../retry.js";

test("retry: retries until success", async () => {
  let attempts = 0;

  const result = await retry(
    async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("fail");
      return "ok";
    },
    { retries: 5, baseDelayMs: 1, maxDelayMs: 3 },
  );

  assert.equal(result, "ok");
  assert.equal(attempts, 3);
});

test("retry: throws after exhausting retries", async () => {
  let attempts = 0;

  await assert.rejects(
    () =>
      retry(
        async () => {
          attempts += 1;
          throw new Error("always");
        },
        { retries: 2, baseDelayMs: 1, maxDelayMs: 2 },
      ),
    /always/,
  );

  assert.equal(attempts, 3);
});

