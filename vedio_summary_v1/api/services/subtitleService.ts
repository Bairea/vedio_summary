import fs from "fs/promises";
import path from "path";
import { parseSrt, parseVtt, segmentsToText, type TranscriptSegment } from "../lib/subtitleParse.js";
import { segmentsToSrt, segmentsToVtt } from "../lib/subtitleFormat.js";
import { ensureTaskDir, taskFile } from "./fileStore.js";
import { downloadSubtitles } from "./ytdlpService.js";
import { downloadMedia } from "./ytdlpService.js";
import { loadSettings } from "../repositories/settingsRepo.js";
import { transcribeWithWhisper } from "./whisperTranscribe.js";

export type SubtitleSource = "platform" | "asr";
export type SubtitleFormat = "srt" | "vtt" | "txt" | "json";

type SubtitleArtifacts = {
  source: SubtitleSource;
  segments: TranscriptSegment[];
  formats: SubtitleFormat[];
  hasSrt: boolean;
  hasVtt: boolean;
};

type SubtitleServiceDeps = {
  downloadSubtitles: typeof downloadSubtitles;
  downloadMedia: typeof downloadMedia;
  loadSettings: typeof loadSettings;
  transcribeWithWhisper: typeof transcribeWithWhisper;
};

const defaultDeps: SubtitleServiceDeps = {
  downloadSubtitles,
  downloadMedia,
  loadSettings,
  transcribeWithWhisper,
};

async function writeSubtitleArtifacts(
  taskId: string,
  segments: TranscriptSegment[],
  source: SubtitleSource,
): Promise<SubtitleArtifacts> {
  const srt = segmentsToSrt(segments);
  const vtt = segmentsToVtt(segments);
  await fs.writeFile(taskFile(taskId, "subtitles.srt"), srt, "utf-8");
  await fs.writeFile(taskFile(taskId, "subtitles.vtt"), vtt, "utf-8");
  await fs.writeFile(taskFile(taskId, "subtitles.txt"), segmentsToText(segments), "utf-8");
  await fs.writeFile(taskFile(taskId, "subtitles.json"), JSON.stringify(segments), "utf-8");
  return {
    source,
    segments,
    formats: ["srt", "vtt", "txt", "json"],
    hasSrt: true,
    hasVtt: true,
  };
}

function normalizeAsrLanguage(language?: string): string | undefined {
  if (!language) return undefined;
  if (language.includes(",")) return undefined;
  const first = language.trim();
  if (!first) return undefined;
  if (first.toLowerCase().startsWith("zh")) return "zh";
  if (first.length >= 2) return first.slice(0, 2).toLowerCase();
  return undefined;
}

async function findFirstByExt(dir: string, exts: string[]): Promise<string | undefined> {
  const items = await fs.readdir(dir);
  for (const ext of exts) {
    const f = items.find((x) => x.toLowerCase().endsWith(ext));
    if (f) return path.join(dir, f);
  }
  return undefined;
}

async function findAudioFile(dir: string): Promise<string | undefined> {
  const items = await fs.readdir(dir);
  const f = items.find((x) => x.startsWith("audio.") && !x.endsWith(".part"));
  if (f) return path.join(dir, f);
  return undefined;
}

export async function fetchSubtitles(opts: {
  taskId: string;
  url: string;
  language?: string;
  signal?: AbortSignal;
}, deps: SubtitleServiceDeps = defaultDeps): Promise<SubtitleArtifacts> {
  const dir = await ensureTaskDir(opts.taskId);
  await deps.downloadSubtitles(opts.url, dir, { language: opts.language, signal: opts.signal });

  const srtPath = await findFirstByExt(dir, [".srt"]);
  const vttPath = await findFirstByExt(dir, [".vtt"]);

  let segments: TranscriptSegment[] = [];
  let hasSrt = false;
  let hasVtt = false;

  if (srtPath) {
    const content = await fs.readFile(srtPath, "utf-8");
    segments = parseSrt(content);
    await fs.writeFile(taskFile(opts.taskId, "subtitles.srt"), content, "utf-8");
    hasSrt = true;
  }

  if (!segments.length && vttPath) {
    const content = await fs.readFile(vttPath, "utf-8");
    segments = parseVtt(content);
    await fs.writeFile(taskFile(opts.taskId, "subtitles.vtt"), content, "utf-8");
    hasVtt = true;
  }

  if (segments.length) {
    if (!hasSrt) {
      await fs.writeFile(taskFile(opts.taskId, "subtitles.srt"), segmentsToSrt(segments), "utf-8");
      hasSrt = true;
    }
    if (!hasVtt) {
      await fs.writeFile(taskFile(opts.taskId, "subtitles.vtt"), segmentsToVtt(segments), "utf-8");
      hasVtt = true;
    }
    await fs.writeFile(taskFile(opts.taskId, "subtitles.txt"), segmentsToText(segments), "utf-8");
    await fs.writeFile(taskFile(opts.taskId, "subtitles.json"), JSON.stringify(segments), "utf-8");
    return {
      source: "platform",
      segments,
      formats: ["srt", "vtt", "txt", "json"],
      hasSrt,
      hasVtt,
    };
  } else {
    const settings = await deps.loadSettings();
    if (!settings.ai.asrEnabled) {
      throw new Error("未获取到平台字幕，且已关闭“无字幕自动 ASR”");
    }

    await deps.downloadMedia(opts.url, dir, { audioOnly: true, quality: "best", signal: opts.signal });
    const audioPath = await findAudioFile(dir);
    if (!audioPath) throw new Error("平台字幕不可用，且 ASR 音频下载失败");

    const asrSegments = await deps.transcribeWithWhisper({
      audioPath,
      language: normalizeAsrLanguage(opts.language),
      signal: opts.signal,
    });

    return writeSubtitleArtifacts(opts.taskId, asrSegments, "asr");
  }
}

export async function exportSubtitles(taskId: string, format: "srt" | "vtt" | "txt" | "json"): Promise<{
  fileName: string;
  contentType: string;
  body: string;
}> {
  if (format === "srt") {
    const p = taskFile(taskId, "subtitles.srt");
    const body = await fs.readFile(p, "utf-8");
    return { fileName: "subtitles.srt", contentType: "application/x-subrip", body };
  }
  if (format === "vtt") {
    const p = taskFile(taskId, "subtitles.vtt");
    const body = await fs.readFile(p, "utf-8");
    return { fileName: "subtitles.vtt", contentType: "text/vtt", body };
  }
  if (format === "txt") {
    const p = taskFile(taskId, "subtitles.txt");
    const body = await fs.readFile(p, "utf-8");
    return { fileName: "subtitles.txt", contentType: "text/plain; charset=utf-8", body };
  }

  const p = taskFile(taskId, "subtitles.json");
  const body = await fs.readFile(p, "utf-8");
  return { fileName: "subtitles.json", contentType: "application/json; charset=utf-8", body };
}
