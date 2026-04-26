const HEADER_PREFIX = "# Netscape HTTP Cookie File";

export function isProbablyNetscapeCookies(content) {
  const s = String(content || "");
  if (!s.trim()) return false;
  if (s.includes(HEADER_PREFIX)) return true;
  const lines = s.split(/\r?\n/).filter(Boolean);
  const hasTabs = lines.some((l) => l.split("\t").length >= 7);
  return hasTabs;
}

function parseCookieHeader(header) {
  const s = String(header || "");
  return s
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf("=");
      if (idx <= 0) return null;
      const name = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      if (!name) return null;
      return { name, value };
    })
    .filter(Boolean);
}

export function cookieHeaderToNetscape(header, opts) {
  const domain = opts?.domain || ".bilibili.com";
  const path = opts?.path || "/";
  const includeSub = opts?.includeSubdomains ?? true;
  const secure = opts?.secure ?? true;
  const now = Math.floor(Date.now() / 1000);
  const expires = now + 365 * 24 * 60 * 60;

  const cookies = parseCookieHeader(header);
  const lines = [
    HEADER_PREFIX,
    "# https://curl.se/docs/http-cookies.html",
    "# This file was generated from Cookie header string.",
    "",
  ];

  for (const c of cookies) {
    const cols = [
      domain,
      includeSub ? "TRUE" : "FALSE",
      path,
      secure ? "TRUE" : "FALSE",
      String(expires),
      c.name,
      c.value,
    ];
    lines.push(cols.join("\t"));
  }

  return lines.join("\n") + "\n";
}

