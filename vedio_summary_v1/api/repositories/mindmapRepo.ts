import { dbGet, dbRun, getDb } from "../lib/sqlite.js";

type MindmapRow = {
  mermaid: string;
};

export async function getMindmap(taskId: string): Promise<string | undefined> {
  const db = await getDb();
  const row = await dbGet<MindmapRow>(db, "SELECT mermaid FROM mindmaps WHERE task_id = ?", [taskId]);
  return row?.mermaid;
}

export async function upsertMindmap(taskId: string, content: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await dbRun(
    db,
    `INSERT INTO mindmaps (task_id, mermaid, created_at)
     VALUES (?, ?, ?)
     ON CONFLICT(task_id) DO UPDATE SET mermaid = excluded.mermaid, created_at = excluded.created_at`,
    [taskId, content, now],
  );
}
