export function normalizeOpenAIBaseUrl(input) {
  const s = String(input || "").trim();
  if (!s) return "";
  const noSlash = s.replace(/\/+$/, "");
  return noSlash.replace(/\/v1$/i, "");
}

