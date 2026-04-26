import fs from "fs/promises";
import sqlite3 from "sqlite3";
import { resolveDataDir, resolveDbPath } from "./paths.js";

sqlite3.verbose();

export type SqliteDatabase = sqlite3.Database;

let dbPromise: Promise<SqliteDatabase> | undefined;

function openDb(dbPath: string): Promise<SqliteDatabase> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

export function dbRun(db: SqliteDatabase, sql: string, params: unknown[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function dbGet<T>(
  db: SqliteDatabase,
  sql: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T | undefined);
    });
  });
}

export function dbAll<T>(db: SqliteDatabase, sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

export async function getDb(): Promise<SqliteDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    await fs.mkdir(resolveDataDir(), { recursive: true });
    const db = await openDb(resolveDbPath());
    await initSchema(db);
    return db;
  })();

  return dbPromise;
}

async function initSchema(db: SqliteDatabase): Promise<void> {
  await dbRun(
    db,
    `CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      platform TEXT NOT NULL,
      title TEXT,
      duration_sec INTEGER,
      stage TEXT NOT NULL,
      progress INTEGER,
      error TEXT,
      pipeline_json TEXT,
      language TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  );
  await ensureColumn(db, "tasks", "request_json", "TEXT");
  await ensureColumn(db, "tasks", "runtime_json", "TEXT");

  await dbRun(
    db,
    `CREATE TABLE IF NOT EXISTS transcript_segments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      start_ms INTEGER NOT NULL,
      end_ms INTEGER NOT NULL,
      text TEXT NOT NULL,
      idx INTEGER NOT NULL,
      FOREIGN KEY(task_id) REFERENCES tasks(id)
    )`,
  );

  await dbRun(
    db,
    `CREATE TABLE IF NOT EXISTS summaries (
      task_id TEXT PRIMARY KEY,
      markdown TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(task_id) REFERENCES tasks(id)
    )`,
  );

  await dbRun(
    db,
    `CREATE TABLE IF NOT EXISTS mindmaps (
      task_id TEXT PRIMARY KEY,
      mermaid TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(task_id) REFERENCES tasks(id)
    )`,
  );

  await dbRun(
    db,
    `CREATE TABLE IF NOT EXISTS qa_messages (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(task_id) REFERENCES tasks(id)
    )`,
  );
  await ensureColumn(db, "qa_messages", "metadata_json", "TEXT");

  await dbRun(
    db,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  );
}

type TableInfoRow = {
  name: string;
};

async function ensureColumn(db: SqliteDatabase, table: string, column: string, typeSql: string): Promise<void> {
  const rows = await dbAll<TableInfoRow>(db, `PRAGMA table_info(${table})`);
  if (rows.some((row) => row.name === column)) return;
  await dbRun(db, `ALTER TABLE ${table} ADD COLUMN ${column} ${typeSql}`);
}
