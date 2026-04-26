import { type AppSettings } from "../../shared/types.js";
import { dbGet, dbRun, getDb } from "../lib/sqlite.js";

type SettingsRow = {
  key: string;
  value_json: string;
  updated_at: string;
};

const SETTINGS_KEY = "app_settings_v1";

export function getDefaultSettings(): AppSettings {
  return {
    ai: {
      provider: "openai_compatible",
      baseUrl: "https://api.openai.com",
      model: "gpt-4o-mini",
      transcriptionModel: "whisper-1",
      asrEnabled: true,
    },
    download: {},
    storage: {
      maxTasks: 200,
    },
  };
}

export async function loadSettings(): Promise<AppSettings> {
  const db = await getDb();
  const row = await dbGet<SettingsRow>(db, "SELECT * FROM settings WHERE key = ?", [SETTINGS_KEY]);
  if (!row) return getDefaultSettings();

  try {
    const parsed = JSON.parse(row.value_json) as AppSettings;
    return {
      ...getDefaultSettings(),
      ...parsed,
      ai: { ...getDefaultSettings().ai, ...parsed.ai },
      download: { ...getDefaultSettings().download, ...parsed.download },
      storage: { ...getDefaultSettings().storage, ...parsed.storage },
    };
  } catch {
    return getDefaultSettings();
  }
}

export async function saveSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
  const merged = await mergeSettings(partial);
  const db = await getDb();
  const now = new Date().toISOString();
  await dbRun(
    db,
    "INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at",
    [SETTINGS_KEY, JSON.stringify(merged), now],
  );
  return merged;
}

async function mergeSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
  const current = await loadSettings();
  return {
    ...current,
    ...partial,
    ai: { ...current.ai, ...partial.ai },
    download: { ...current.download, ...partial.download },
    storage: { ...current.storage, ...partial.storage },
  };
}
