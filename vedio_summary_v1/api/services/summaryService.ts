import { chatComplete } from "./openaiCompatible.js";
import { type TranscriptSegment, segmentsToText } from "../lib/subtitleParse.js";

function chunkText(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + maxChars);
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks.filter((c) => c.trim().length > 0);
}

export async function generateSummary(segments: TranscriptSegment[], signal?: AbortSignal): Promise<string> {
  const text = segmentsToText(segments);
  const chunks = chunkText(text, 9000);

  const partials: string[] = [];
  for (const c of chunks.slice(0, 6)) {
    const out = await chatComplete({
      signal,
      messages: [
        {
          role: "system",
          content:
            "你是一个视频学习助手。请根据给定字幕内容，输出结构化中文摘要，包含：一句话摘要、章节要点（分点）、行动项、关键词（#标签）。输出 Markdown。",
        },
        { role: "user", content: c },
      ],
    });
    partials.push(out);
  }

  if (partials.length === 1) return partials[0];

  const merged = await chatComplete({
    signal,
    messages: [
      {
        role: "system",
        content:
          "你将收到多段摘要草稿。请合并去重，形成一份最终 Markdown，总体保持精炼但信息密度高，包含：一句话摘要、章节要点、行动项、关键词。",
      },
      { role: "user", content: partials.join("\n\n---\n\n") },
    ],
  });

  return merged;
}

