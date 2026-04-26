import { dbGet, dbRun, getDb } from "../lib/sqlite.js";

type SummaryRow = {
  markdown: string;
};

export async function getSummary(taskId: string): Promise<string | undefined> {
  const db = await getDb();
  const row = await dbGet<SummaryRow>(db, "SELECT markdown FROM summaries WHERE task_id = ?", [taskId]);
  return row?.markdown;
}

export async function upsertSummary(taskId: string, markdown: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await dbRun(
    db,
    `INSERT INTO summaries (task_id, markdown, created_at)
     VALUES (?, ?, ?)
     ON CONFLICT(task_id) DO UPDATE SET markdown = excluded.markdown, created_at = excluded.created_at`,
    [taskId, markdown, now],
  );
}

