import { randomUUID } from "crypto";
import { dbAll, dbRun, getDb } from "../lib/sqlite.js";
import { type TranscriptSegment } from "../lib/subtitleParse.js";

type TranscriptRow = {
  start_ms: number;
  end_ms: number;
  text: string;
  idx: number;
};

export async function replaceTranscript(taskId: string, segments: TranscriptSegment[]): Promise<void> {
  const db = await getDb();
  await dbRun(db, "DELETE FROM transcript_segments WHERE task_id = ?", [taskId]);

  let idx = 0;
  for (const seg of segments) {
    await dbRun(
      db,
      `INSERT INTO transcript_segments (id, task_id, start_ms, end_ms, text, idx)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [randomUUID(), taskId, seg.startMs, seg.endMs, seg.text, idx],
    );
    idx += 1;
  }
}

export async function getTranscript(taskId: string): Promise<TranscriptSegment[]> {
  const db = await getDb();
  const rows = await dbAll<TranscriptRow>(
    db,
    "SELECT start_ms, end_ms, text, idx FROM transcript_segments WHERE task_id = ? ORDER BY idx ASC",
    [taskId],
  );
  return rows.map((r) => ({ startMs: r.start_ms, endMs: r.end_ms, text: r.text }));
}

