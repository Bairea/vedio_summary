import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeOpenAIBaseUrl } from "../openaiBaseUrl.js";

test("normalizeOpenAIBaseUrl: strips trailing /v1 and trailing slash", () => {
  assert.equal(normalizeOpenAIBaseUrl("https://api.openai.com"), "https://api.openai.com");
  assert.equal(normalizeOpenAIBaseUrl("https://api.openai.com/"), "https://api.openai.com");
  assert.equal(normalizeOpenAIBaseUrl("https://api.openai.com/v1"), "https://api.openai.com");
  assert.equal(normalizeOpenAIBaseUrl("https://api.openai.com/v1/"), "https://api.openai.com");
});

