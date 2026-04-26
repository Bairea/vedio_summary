import { randomUUID } from "crypto";
import {
  type CreateTaskRequest,
  type TaskArtifactsDTO,
  type TaskDTO,
  type TaskExecutionStage,
  type TaskStage,
  type TaskStatus,
  type VideoPlatform,
} from "../../shared/types.js";
import { dbAll, dbGet, dbRun, getDb } from "../lib/sqlite.js";

type TaskRow = {
  id: string;
  url: string;
  platform: VideoPlatform;
  title: string | null;
  duration_sec: number | null;
  stage: TaskStage;
  progress: number | null;
  error: string | null;
  pipeline_json: string | null;
  request_json: string | null;
  runtime_json: string | null;
  language: string | null;
  created_at: string;
  updated_at: string;
};

type TaskRuntimeState = {
  status?: TaskStatus;
  currentStage?: TaskExecutionStage;
  lastCompletedStage?: TaskExecutionStage;
  failureStage?: TaskExecutionStage;
  failureCode?: string;
  retryable?: boolean;
  artifacts?: TaskArtifactsDTO;
};

type UpdateTaskStageOptions = {
  progress?: number | null;
  error?: string | null;
  title?: string | null;
  durationSec?: number | null;
  runtime?: Partial<TaskRuntimeState>;
};

function emptyArtifacts(): TaskArtifactsDTO {
  return {
    transcriptReady: false,
    summaryReady: false,
    mindmapReady: false,
    qaReady: false,
    subtitleFormats: [],
  };
}

function fallbackRuntimeFromStage(stage?: TaskStage): TaskRuntimeState {
  if (stage === "ready") {
    return {
      status: "succeeded",
      retryable: false,
      artifacts: emptyArtifacts(),
    };
  }
  if (stage === "failed") {
    return {
      status: "failed",
      retryable: true,
      artifacts: emptyArtifacts(),
    };
  }
  if (stage === "canceled") {
    return {
      status: "canceled",
      retryable: false,
      artifacts: emptyArtifacts(),
    };
  }
  if (stage && stage !== "created") {
    return {
      status: "running",
      retryable: false,
      artifacts: emptyArtifacts(),
    };
  }
  return {
    status: "queued",
    retryable: false,
    artifacts: emptyArtifacts(),
  };
}

export function deriveRuntimeStateForRow(row?: Pick<TaskRow, "runtime_json" | "stage">): TaskRuntimeState {
  if (!row?.runtime_json) {
    return fallbackRuntimeFromStage(row?.stage);
  }
  try {
    const parsed = JSON.parse(row.runtime_json) as TaskRuntimeState;
    return {
      status: parsed.status ?? "queued",
      retryable: parsed.retryable ?? false,
      currentStage: parsed.currentStage,
      lastCompletedStage: parsed.lastCompletedStage,
      failureStage: parsed.failureStage,
      failureCode: parsed.failureCode,
      artifacts: { ...emptyArtifacts(), ...parsed.artifacts },
    };
  } catch {
    return fallbackRuntimeFromStage(row.stage);
  }
}

function rowToDto(row: TaskRow): TaskDTO {
  const runtime = deriveRuntimeStateForRow(row);
  return {
    id: row.id,
    url: row.url,
    platform: row.platform,
    title: row.title ?? undefined,
    durationSec: row.duration_sec ?? undefined,
    stage: row.stage,
    status: runtime.status,
    progress: row.progress ?? undefined,
    error: row.error ?? undefined,
    currentStage: runtime.currentStage,
    lastCompletedStage: runtime.lastCompletedStage,
    failureStage: runtime.failureStage,
    failureCode: runtime.failureCode,
    retryable: runtime.retryable,
    artifacts: runtime.artifacts,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createTask(req: CreateTaskRequest & { platform: VideoPlatform }): Promise<TaskDTO> {
  const db = await getDb();
  const now = new Date().toISOString();
  const id = randomUUID();
  await dbRun(
    db,
    `INSERT INTO tasks (id, url, platform, stage, progress, pipeline_json, request_json, runtime_json, language, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      req.url,
      req.platform,
      "created",
      0,
      JSON.stringify(req.pipeline),
      JSON.stringify(req),
      JSON.stringify({
        status: "queued",
        retryable: false,
        artifacts: emptyArtifacts(),
      } satisfies TaskRuntimeState),
      req.language ?? null,
      now,
      now,
    ],
  );

  const row = await dbGet<TaskRow>(db, "SELECT * FROM tasks WHERE id = ?", [id]);
  if (!row) throw new Error("Task create failed");
  return rowToDto(row);
}

export async function listTasks(): Promise<TaskDTO[]> {
  const db = await getDb();
  const rows = await dbAll<TaskRow>(db, "SELECT * FROM tasks ORDER BY created_at DESC");
  return rows.map(rowToDto);
}

export async function getTask(id: string): Promise<TaskDTO | undefined> {
  const db = await getDb();
  const row = await dbGet<TaskRow>(db, "SELECT * FROM tasks WHERE id = ?", [id]);
  return row ? rowToDto(row) : undefined;
}

export async function getTaskRow(id: string): Promise<TaskRow | undefined> {
  const db = await getDb();
  return dbGet<TaskRow>(db, "SELECT * FROM tasks WHERE id = ?", [id]);
}

export async function updateTaskStage(
  id: string,
  stage: TaskStage,
  opts?: UpdateTaskStageOptions,
): Promise<void> {
  const db = await getDb();
  const current = await getTaskRow(id);
  const currentRuntime = deriveRuntimeStateForRow(current);
  const now = new Date().toISOString();

  const progress = opts && "progress" in opts ? opts.progress ?? null : current?.progress ?? null;
  const error = opts && "error" in opts ? opts.error ?? null : current?.error ?? null;
  const title = opts && "title" in opts ? opts.title ?? null : current?.title ?? null;
  const durationSec = opts && "durationSec" in opts ? opts.durationSec ?? null : current?.duration_sec ?? null;
  const runtime: TaskRuntimeState = {
    ...currentRuntime,
    ...opts?.runtime,
    artifacts: {
      ...emptyArtifacts(),
      ...currentRuntime.artifacts,
      ...opts?.runtime?.artifacts,
    },
  };

  await dbRun(
    db,
    `UPDATE tasks
     SET stage = ?,
         progress = ?,
         error = ?,
         title = ?,
         duration_sec = ?,
         runtime_json = ?,
         updated_at = ?
     WHERE id = ?`,
    [stage, progress, error, title, durationSec, JSON.stringify(runtime), now, id],
  );
}

export async function markTaskCanceled(id: string): Promise<void> {
  await updateTaskStage(id, "canceled", {
    progress: null,
    error: null,
    runtime: {
      status: "canceled",
      retryable: false,
    },
  });
}

export async function getTaskRequest(id: string): Promise<CreateTaskRequest | undefined> {
  const row = await getTaskRow(id);
  if (!row?.request_json) return undefined;
  try {
    return JSON.parse(row.request_json) as CreateTaskRequest;
  } catch {
    return undefined;
  }
}

export async function resetTaskForRetry(id: string): Promise<void> {
  const row = await getTaskRow(id);
  const db = await getDb();
  const now = new Date().toISOString();
  const runtime = deriveRuntimeStateForRow(row);
  await dbRun(
    db,
    `UPDATE tasks
     SET stage = ?,
         progress = ?,
         error = ?,
         runtime_json = ?,
         updated_at = ?
     WHERE id = ?`,
    [
      "created",
      0,
      null,
      JSON.stringify({
        ...runtime,
        status: "queued",
        currentStage: undefined,
        lastCompletedStage: undefined,
        failureStage: undefined,
        failureCode: undefined,
        retryable: false,
        artifacts: emptyArtifacts(),
      } satisfies TaskRuntimeState),
      now,
      id,
    ],
  );
}

export async function deleteTask(id: string): Promise<void> {
  const db = await getDb();
  await dbRun(db, "DELETE FROM transcript_segments WHERE task_id = ?", [id]);
  await dbRun(db, "DELETE FROM summaries WHERE task_id = ?", [id]);
  await dbRun(db, "DELETE FROM mindmaps WHERE task_id = ?", [id]);
  await dbRun(db, "DELETE FROM qa_messages WHERE task_id = ?", [id]);
  await dbRun(db, "DELETE FROM tasks WHERE id = ?", [id]);
}
