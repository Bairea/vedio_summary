import assert from "node:assert/strict";
import { test } from "node:test";
import { answerQuestion } from "../qaService.js";

const segments = [
  { startMs: 0, endMs: 2000, text: "这个视频介绍了视频总结器的目标和背景。" },
  { startMs: 2000, endMs: 5000, text: "作者重点解释了本地转写、摘要和导图的整体流程。" },
];

test("answerQuestion returns insufficientEvidence when citations are missing", async () => {
  const result = await (answerQuestion as any)(
    {
      question: "这个视频讲了什么？",
      mode: "detailed",
      segments,
    },
    {
      chatComplete: async () =>
        JSON.stringify({
          answer: "我不确定。",
          citations: [],
        }),
    },
  );

  assert.equal(result.insufficientEvidence, true);
  assert.deepEqual(result.citations, []);
});

test("answerQuestion returns citations and marks evidence as sufficient when model provides them", async () => {
  const result = await (answerQuestion as any)(
    {
      question: "作者重点解释了什么？",
      mode: "detailed",
      segments,
    },
    {
      chatComplete: async () =>
        JSON.stringify({
          answer: "作者重点解释了本地转写、摘要和导图的整体流程。",
          citations: [segments[1]],
        }),
    },
  );

  assert.equal(result.insufficientEvidence, false);
  assert.equal(result.citations.length, 1);
  assert.equal(result.citations[0]?.text, segments[1].text);
});
