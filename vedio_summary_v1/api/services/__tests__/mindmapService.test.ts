import assert from "node:assert/strict";
import { test } from "node:test";
import * as mindmapService from "../mindmapService.js";

test("normalizeMarkmapMarkdown extracts fenced markdown output", () => {
  const normalize = (mindmapService as any).normalizeMarkmapMarkdown;
  assert.equal(typeof normalize, "function");

  const markdown = normalize(`
\`\`\`markdown
# 视频要点

## 核心问题
- 背景
- 冲突
\`\`\`
`);

  assert.match(markdown, /^# 视频要点/m);
  assert.match(markdown, /^## 核心问题/m);
  assert.match(markdown, /^- 背景/m);
});

test("normalizeMarkmapMarkdown wraps plain text into valid markmap markdown", () => {
  const normalize = (mindmapService as any).normalizeMarkmapMarkdown;
  assert.equal(typeof normalize, "function");

  const markdown = normalize(`
第一点
第二点
第三点
`);

  assert.match(markdown, /^# 视频要点/m);
  assert.match(markdown, /- 第一点/);
  assert.match(markdown, /- 第二点/);
  assert.doesNotMatch(markdown, /^mindmap/m);
});
