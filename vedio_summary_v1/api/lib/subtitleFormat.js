function pad2(n) {
  return String(n).padStart(2, "0");
}

function pad3(n) {
  return String(n).padStart(3, "0");
}

function msToSrtTime(ms) {
  const t = Math.max(0, Math.floor(ms));
  const hh = Math.floor(t / 3600000);
  const mm = Math.floor((t % 3600000) / 60000);
  const ss = Math.floor((t % 60000) / 1000);
  const mmm = t % 1000;
  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)},${pad3(mmm)}`;
}

function msToVttTime(ms) {
  const t = Math.max(0, Math.floor(ms));
  const hh = Math.floor(t / 3600000);
  const mm = Math.floor((t % 3600000) / 60000);
  const ss = Math.floor((t % 60000) / 1000);
  const mmm = t % 1000;
  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}.${pad3(mmm)}`;
}

function clean(s) {
  return String(s ?? "")
    .replace(/\r/g, "")
    .trim();
}

export function segmentsToSrt(segments) {
  const blocks = (segments || []).map((s, idx) => {
    const start = msToSrtTime(s.startMs);
    const end = msToSrtTime(s.endMs);
    const text = clean(s.text);
    return `${idx + 1}\n${start} --> ${end}\n${text}\n`;
  });
  return blocks.join("\n").trimEnd() + "\n";
}

export function segmentsToVtt(segments) {
  const blocks = (segments || []).map((s) => {
    const start = msToVttTime(s.startMs);
    const end = msToVttTime(s.endMs);
    const text = clean(s.text);
    return `${start} --> ${end}\n${text}\n`;
  });
  return `WEBVTT\n\n${blocks.join("\n").trimEnd()}\n`;
}

