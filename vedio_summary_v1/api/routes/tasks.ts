import { Router, type Request, type Response } from "express";
import { type AskRequest, type CreateTaskRequest, type SubtitleFormat } from "../../shared/types.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { taskService } from "../services/singletons.js";
import fs from "fs/promises";
import { taskFile } from "../services/fileStore.js";
import { exportSubtitles } from "../services/subtitleService.js";
import { replaceTranscript, getTranscript } from "../repositories/transcriptRepo.js";
import { getSummary } from "../repositories/summaryRepo.js";
import { getMindmap } from "../repositories/mindmapRepo.js";
import { answerQuestion } from "../services/qaService.js";
import { appendMessage, listMessages } from "../repositories/qaRepo.js";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
  const tasks = await taskService.list();
  res.json(tasks);
  }),
);

router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreateTaskRequest;
  if (!body?.url) {
    res.status(400).json({ error: "url required" });
    return;
  }

  const task = await taskService.create(body);
  res.status(201).json(task);
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
  const task = await taskService.get(req.params.id);
  if (!task) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json(task);
  }),
);

router.get(
  "/:id/subtitles",
  asyncHandler(async (req: Request, res: Response) => {
    const format = ((req.query.format as string) || "srt") as SubtitleFormat;
    if (!["srt", "vtt", "txt", "json"].includes(format)) {
      res.status(400).json({ error: "invalid format" });
      return;
    }
    let file: Awaited<ReturnType<typeof exportSubtitles>>;
    try {
      file = await exportSubtitles(req.params.id, format);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("ENOENT")) {
        res.status(404).json({ error: "not found" });
        return;
      }
      throw e;
    }
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
    res.send(file.body);
  }),
);

router.put(
  "/:id/subtitles",
  asyncHandler(async (req: Request, res: Response) => {
    const content = String((req.body as { content?: string })?.content ?? "");
    if (!content.trim()) {
      res.status(400).json({ error: "content required" });
      return;
    }
    await fs.writeFile(taskFile(req.params.id, "subtitles.txt"), content, "utf-8");
    const segments = [{ startMs: 0, endMs: 0, text: content.trim() }];
    await fs.writeFile(taskFile(req.params.id, "subtitles.json"), JSON.stringify(segments), "utf-8");
    await replaceTranscript(req.params.id, segments);
    res.json({ ok: true });
  }),
);

router.get(
  "/:id/summary",
  asyncHandler(async (req: Request, res: Response) => {
    const markdown = await getSummary(req.params.id);
    if (!markdown) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json({ markdown });
  }),
);

router.get(
  "/:id/mindmap",
  asyncHandler(async (req: Request, res: Response) => {
    const content = await getMindmap(req.params.id);
    if (!content) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json({ format: "markmap", content });
  }),
);

router.post(
  "/:id/ask",
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as AskRequest;
    if (!body?.question?.trim()) {
      res.status(400).json({ error: "question required" });
      return;
    }
    const segments = await getTranscript(req.params.id);
    if (!segments.length) {
      res.status(400).json({ error: "该任务暂无字幕内容" });
      return;
    }

    await appendMessage(req.params.id, "user", body.question);
    const out = await answerQuestion({
      question: body.question,
      mode: body.mode,
      segments,
    });
    await appendMessage(req.params.id, "assistant", out.answer, {
      citations: out.citations,
      insufficientEvidence: out.insufficientEvidence,
    });

    res.json(out);
  }),
);

router.get(
  "/:id/qa/messages",
  asyncHandler(async (req: Request, res: Response) => {
    const messages = await listMessages(req.params.id);
    res.json({ messages });
  }),
);

router.post(
  "/:id/cancel",
  asyncHandler(async (req: Request, res: Response) => {
  await taskService.cancel(req.params.id);
  res.json({ ok: true });
  }),
);

router.post(
  "/:id/retry",
  asyncHandler(async (req: Request, res: Response) => {
  const task = await taskService.retry(req.params.id);
  res.json({ task });
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
  await taskService.remove(req.params.id);
  res.json({ ok: true });
  }),
);

export default router;
