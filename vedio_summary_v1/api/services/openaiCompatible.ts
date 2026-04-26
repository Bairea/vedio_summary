import { loadSettings } from "../repositories/settingsRepo.js";
import { normalizeOpenAIBaseUrl } from "./openaiBaseUrl.js";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function chatComplete(opts: {
  messages: ChatMessage[];
  temperature?: number;
  signal?: AbortSignal;
}): Promise<string> {
  const settings = await loadSettings();
  const baseUrl = settings.ai.baseUrl ? normalizeOpenAIBaseUrl(settings.ai.baseUrl) : undefined;
  const apiKey = settings.ai.apiKey;
  const model = settings.ai.model;

  if (!baseUrl || !apiKey || !model) {
    throw new Error("AI 未配置（需要 Base URL / API Key / Model）");
  }

  const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.2,
      stream: false,
    }),
    signal: opts.signal,
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`AI 请求失败: ${resp.status} ${text}`.slice(0, 300));
  }

  const json = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI 返回为空");
  return content;
}
