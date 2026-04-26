import { randomUUID } from "crypto";
import { dbAll, dbRun, getDb } from "../lib/sqlite.js";
import { type QAMessageDTO } from "../../shared/types.js";

type QAMessageMeta = {
  citations?: QAMessageDTO["citations"];
  insufficientEvidence?: boolean;
};

type QAMessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  metadata_json: string | null;
  created_at: string;
};

function parseMeta(row: Pick<QAMessageRow, "metadata_json">): QAMessageMeta {
  if (!row.metadata_json) return {};
  try {
    return JSON.parse(row.metadata_json) as QAMessageMeta;
  } catch {
    return {};
  }
}

export async function appendMessage(
  taskId: string,
  role: "user" | "assistant",
  content: string,
  meta?: QAMessageMeta,
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await dbRun(
    db,
    "INSERT INTO qa_messages (id, task_id, role, content, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [randomUUID(), taskId, role, content, meta ? JSON.stringify(meta) : null, now],
  );
}

export async function listMessages(taskId: string): Promise<QAMessageDTO[]> {
  const db = await getDb();
  const rows = await dbAll<QAMessageRow>(
    db,
    "SELECT id, role, content, metadata_json, created_at FROM qa_messages WHERE task_id = ? ORDER BY created_at ASC",
    [taskId],
  );
  return rows.map((r) => {
    const meta = parseMeta(r);
    return {
      id: r.id,
      role: r.role,
      content: r.content,
      createdAt: r.created_at,
      citations: meta.citations,
      insufficientEvidence: meta.insufficientEvidence,
    };
  });
}
