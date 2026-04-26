export type TranscriptSegment = {
  startMs: number;
  endMs: number;
  text: string;
};

function timeToMs(s: string): number {
  const m = s.match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if (!m) return 0;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  const ss = Number(m[3]);
  const ms = Number(m[4].padEnd(3, "0").slice(0, 3));
  return (((hh * 60 + mm) * 60 + ss) * 1000 + ms) | 0;
}

function cleanText(s: string): string {
  return s
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseSrt(content: string): TranscriptSegment[] {
  const blocks = content
    .replace(/\r/g, "")
    .split("\n\n")
    .map((b) => b.trim())
    .filter(Boolean);

  const segments: TranscriptSegment[] = [];
  for (const b of blocks) {
    const lines = b.split("\n").filter(Boolean);
    if (lines.length < 2) continue;
    const timeLineIdx = lines[0].includes("-->") ? 0 : 1;
    const timeLine = lines[timeLineIdx];
    const m = timeLine.match(/(.+?)\s*-->\s*(.+)/);
    if (!m) continue;
    const startMs = timeToMs(m[1].trim());
    const endMs = timeToMs(m[2].trim().split(" ")[0]);
    const text = cleanText(lines.slice(timeLineIdx + 1).join(" "));
    if (!text) continue;
    segments.push({ startMs, endMs, text });
  }
  return segments;
}

export function parseVtt(content: string): TranscriptSegment[] {
  const raw = content.replace(/\r/g, "");
  const lines = raw.split("\n");
  const segments: TranscriptSegment[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i += 1;
      continue;
    }
    if (line.startsWith("WEBVTT")) {
      i += 1;
      continue;
    }
    const timeLine = line.includes("-->") ? line : lines[i + 1]?.trim();
    if (!timeLine || !timeLine.includes("-->")) {
      i += 1;
      continue;
    }
    const m = timeLine.match(/(.+?)\s*-->\s*(.+)/);
    if (!m) {
      i += 1;
      continue;
    }
    const startMs = timeToMs(m[1].trim());
    const endMs = timeToMs(m[2].trim().split(" ")[0]);
    i += line.includes("-->") ? 1 : 2;

    const textLines: string[] = [];
    while (i < lines.length && lines[i].trim()) {
      textLines.push(lines[i].trim());
      i += 1;
    }
    const text = cleanText(textLines.join(" "));
    if (text) segments.push({ startMs, endMs, text });
  }

  return segments;
}

export function segmentsToText(segments: TranscriptSegment[]): string {
  return segments.map((s) => s.text).join("\n");
}

