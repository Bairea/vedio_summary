import { chatComplete } from "./openaiCompatible.js";
import { type TranscriptSegment, segmentsToText } from "../lib/subtitleParse.js";

function extractMarkdownFence(raw: string): string | undefined {
  const fenced = raw.match(/```(?:markdown|md)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  return undefined;
}

function normalizeLine(line: string): string {
  return line
    .replace(/^\s*[-*+]\s*/, "")
    .replace(/^\s*\d+[.)]\s*/, "")
    .replace(/^\s*#+\s*/, "")
    .trim();
}

export function normalizeMarkmapMarkdown(raw: string): string {
  const extracted = extractMarkdownFence(raw) || raw;
  const cleaned = extracted.trim();
  if (!cleaned) {
    return "# 视频要点\n\n- 暂无内容";
  }

  if (/^#/m.test(cleaned)) {
    return cleaned;
  }

  const lines = cleaned
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean)
    .slice(0, 12);

  if (!lines.length) {
    return "# 视频要点\n\n- 暂无内容";
  }

  return `# 视频要点\n\n${lines.map((line) => `- ${line}`).join("\n")}`;
}

export async function generateMindmap(segments: TranscriptSegment[], signal?: AbortSignal): Promise<string> {
  const text = segmentsToText(segments);
  const clipped = text.slice(0, 12000);

  const out = await chatComplete({
    signal,
    messages: [
      {
        role: "system",
        content:
          "你是一个知识整理助手。根据字幕生成适用于 Markmap 的 Markdown 导图。仅输出 Markdown，可包含 ```markdown 代码块。要求：第一行是一级标题；后续使用二级标题和简洁列表项；不要输出 Mermaid 语法。",
      },
      { role: "user", content: clipped },
    ],
  });

  return normalizeMarkmapMarkdown(out);
}
