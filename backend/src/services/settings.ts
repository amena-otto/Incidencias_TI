import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { settings } from "../db/schema.js";
import { env } from "../config/env.js";
import { normalizeScopeConfig } from "../classifier/v4/scope.js";
import type { ScopeConfig } from "../classifier/v4/types.js";

/** Ventana de correlación configurable desde la base de datos. */
export async function getContextWindowMinutes(): Promise<number> {
  const [row] = await db.select().from(settings).where(eq(settings.key, "context_window_minutes")).limit(1);
  const value = Number(row?.value ?? env.CONTEXT_WINDOW_MINUTES);
  return Number.isFinite(value) && value >= 5 && value <= 10080 ? value : env.CONTEXT_WINDOW_MINUTES;
}

export type ClassifierEngine = "v3" | "v4";

async function readSetting(key: string): Promise<string | null> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).limit(1);
  return row?.value ?? null;
}

async function writeSetting(key: string, value: string): Promise<void> {
  await db.insert(settings).values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

/** Feature flag: permite volver a V3 sin desplegar ni reclasificar el histórico. */
export async function getClassifierEngine(): Promise<ClassifierEngine> {
  const value = await readSetting("classifier_engine");
  return value === "v3" ? "v3" : "v4";
}

export async function setClassifierEngine(engine: ClassifierEngine): Promise<void> {
  await writeSetting("classifier_engine", engine);
}

export async function getTiScopeConfig(): Promise<ScopeConfig> {
  const value = await readSetting("ti_scope_profile");
  if (!value) return normalizeScopeConfig(null);
  try {
    return normalizeScopeConfig(JSON.parse(value) as Partial<ScopeConfig>);
  } catch {
    return normalizeScopeConfig(null);
  }
}

export async function setTiScopeConfig(config: ScopeConfig): Promise<void> {
  await writeSetting("ti_scope_profile", JSON.stringify(config));
}
