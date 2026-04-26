import { chatComplete } from "./openaiCompatible.js";
import { type TranscriptSegment } from "../lib/subtitleParse.js";
import { type AskResponse } from "../../shared/types.js";

type Citation = { startMs: number; endMs: number; text: string };

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .slice(0, 50);
}

function scoreSegment(qTokens: string[], seg: TranscriptSegment): number {
  const t = seg.text.toLowerCase();
  let score = 0;
  for (const tok of qTokens) {
    if (t.includes(tok)) score += 1;
  }
  return score;
}

function pickContext(question: string, segments: TranscriptSegment[]): TranscriptSegment[] {
  const qTokens = tokenize(question);
  const scored = segments
    .map((s) => ({ s, score: scoreSegment(qTokens, s) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((x) => x.s);

  if (scored.length > 0) return scored;
  return segments.slice(0, 10);
}

function safeJsonParse<T>(s: string): T | undefined {
  try {
    return JSON.parse(s) as T;
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (!m) return undefined;
    try {
      return JSON.parse(m[0]) as T;
    } catch {
      return undefined;
    }
  }
}

type QAServiceDeps = {
  chatComplete: typeof chatComplete;
};

const defaultDeps: QAServiceDeps = {
  chatComplete,
};

export async function answerQuestion(opts: {
  question: string;
  mode?: "concise" | "detailed";
  segments: TranscriptSegment[];
  signal?: AbortSignal;
}, deps: QAServiceDeps = defaultDeps): Promise<AskResponse> {
  const ctx = pickContext(opts.question, opts.segments);
  const ctxText = ctx
    .map((s) => `[${s.startMs}-${s.endMs}] ${s.text}`)
    .join("\n");

  const raw = await deps.chatComplete({
    signal: opts.signal,
    messages: [
      {
        role: "system",
        content:
          '你是一个基于字幕的问答助手。只使用提供的字幕上下文回答；不确定就明确说明证据不足。输出严格 JSON：{"answer": "...", "insufficientEvidence": false, "citations": [{"startMs":0,"endMs":0,"text":"..."}]}。当无法确认时，insufficientEvidence 必须为 true，且 citations 可以为空。',
      },
      {
        role: "user",
        content: `问题：${opts.question}\n\n回答风格：${opts.mode === "detailed" ? "详细" : "简洁"}\n\n字幕上下文：\n${ctxText}`,
      },
    ],
  });

  const parsed = safeJsonParse<{ answer?: string; insufficientEvidence?: boolean; citations?: Citation[] }>(raw);
  const answer = parsed?.answer?.trim() || raw.trim();
  const citations = Array.isArray(parsed?.citations)
    ? parsed!.citations!.filter((c) => typeof c?.text === "string").slice(0, 8)
    : [];
  const insufficientEvidence = parsed?.insufficientEvidence === true || citations.length === 0;

  return { answer, citations, insufficientEvidence };
}
