import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  classifierConcepts, classifierFeedback, classifierRuleVersions, classifierSuggestions,
} from "../../db/schema.js";
import { errors } from "../../lib/http.js";
import { logger } from "../../lib/logger.js";
import { sha256 } from "../../lib/validation.js";
import { seedDictionary } from "./dictionary.js";
import { CLASSIFIER_VERSION } from "./types.js";
import type { Concept, DictionarySnapshot, FeedbackEntry, FeedbackRepository } from "./types.js";

type ConceptRow = typeof classifierConcepts.$inferSelect;
type FeedbackRecord = FeedbackEntry & { candidateId?: string; importId?: string | null };

export type SuggestionRecord = {
  id: string;
  kind: string;
  conceptKey: string | null;
  title: string;
  payload: unknown;
  evidenceCount: number;
  status: string;
  notes: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

export type RuleVersionRecord = {
  id: string;
  version: string;
  snapshot: DictionarySnapshot;
  notes: string | null;
  active: boolean;
  createdAt: string;
};

let memory = seedDictionary();
let memoryFeedback: FeedbackRecord[] = [];
let memorySuggestions: SuggestionRecord[] = [];
let memoryVersions: RuleVersionRecord[] = [];

function unavailable(error: unknown): boolean {
  const value = error as { code?: unknown; message?: unknown };
  return value?.code === "42P01" || value?.code === "42703" || /does not exist|no existe/i.test(String(value?.message ?? ""));
}

function fallback(error: unknown, action: string): void {
  if (unavailable(error)) logger.warn(`V4 usa almacenamiento en memoria: ${action}`);
  else logger.error(`V4 no pudo usar Neon (${action})`, { code: (error as { code?: unknown })?.code });
}

function conceptFromRow(row: ConceptRow): Concept {
  return {
    id: row.id,
    key: row.conceptKey,
    category: row.category,
    name: row.name,
    description: row.description,
    synonyms: row.synonyms,
    expressions: row.expressions,
    variants: row.variants,
    abbreviations: row.abbreviations,
    related: row.related,
    negatives: row.negatives,
    weight: row.weight,
    priority: row.priority,
    active: row.active,
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

function snapshotFromConcepts(concepts: Concept[], version: string, source: DictionarySnapshot["source"]): DictionarySnapshot {
  return { version, concepts, source };
}

function versionLabel(): string {
  return `${CLASSIFIER_VERSION}-dict-${Date.now()}`;
}

/** Diccionario persistido en Neon; si 0003 aún no está aplicada, usa seed en memoria. */
export const dictionaryRepository = {
  async snapshot(): Promise<DictionarySnapshot> {
    try {
      const rows = await db.select().from(classifierConcepts).orderBy(classifierConcepts.category).limit(1000);
      if (!rows.length) return { ...memory, source: "memoria" };
      memory = snapshotFromConcepts(rows.map(conceptFromRow), rows[0].version, "neon");
      return memory;
    } catch (error) {
      fallback(error, "lectura del diccionario");
      return { ...memory, source: "memoria" };
    }
  },

  async saveConcept(concept: Concept, actorId: string | null, reason = "concepto actualizado"): Promise<Concept> {
    const next = { ...concept, updatedAt: new Date().toISOString(), version: versionLabel() };
    memory = snapshotFromConcepts(memory.concepts.some((item) => item.key === next.key)
      ? memory.concepts.map((item) => item.key === next.key ? next : item)
      : [...memory.concepts, next], next.version, "memoria");
    try {
      await db.insert(classifierConcepts).values({
        conceptKey: next.key, category: next.category, name: next.name, description: next.description,
        synonyms: next.synonyms, expressions: next.expressions, variants: next.variants,
        abbreviations: next.abbreviations, related: next.related, negatives: next.negatives,
        weight: next.weight, priority: next.priority, active: next.active, version: next.version,
        updatedBy: actorId,
      }).onConflictDoUpdate({
        target: classifierConcepts.conceptKey,
        set: {
          category: next.category, name: next.name, description: next.description,
          synonyms: next.synonyms, expressions: next.expressions, variants: next.variants,
          abbreviations: next.abbreviations, related: next.related, negatives: next.negatives,
          weight: next.weight, priority: next.priority, active: next.active, version: next.version,
          updatedAt: new Date(), updatedBy: actorId,
        },
      });
    } catch (error) {
      fallback(error, "escritura del diccionario");
    }
    await this.captureVersion(actorId, reason);
    return next;
  },

  async captureVersion(actorId: string | null, notes: string): Promise<RuleVersionRecord> {
    const snapshot = snapshotFromConcepts(memory.concepts, memory.version, memory.source);
    const record: RuleVersionRecord = {
      id: randomUUID(), version: memory.version, snapshot, notes, active: true, createdAt: new Date().toISOString(),
    };
    memoryVersions = [record, ...memoryVersions.filter((item) => item.version !== record.version)].slice(0, 100);
    try {
      await db.insert(classifierRuleVersions).values({
        version: record.version, snapshot: record.snapshot, notes, active: true, createdBy: actorId,
      }).onConflictDoNothing();
    } catch (error) {
      fallback(error, "versión del diccionario");
    }
    return record;
  },

  async versions(): Promise<RuleVersionRecord[]> {
    try {
      const rows = await db.select().from(classifierRuleVersions).orderBy(desc(classifierRuleVersions.createdAt)).limit(100);
      if (rows.length) return rows.map((row) => ({
        id: row.id, version: row.version, snapshot: row.snapshot as DictionarySnapshot, notes: row.notes,
        active: row.active, createdAt: row.createdAt.toISOString(),
      }));
    } catch (error) {
      fallback(error, "lectura de versiones");
    }
    return [...memoryVersions];
  },

  async revert(version: string, actorId: string | null): Promise<DictionarySnapshot> {
    const stored = memoryVersions.find((item) => item.version === version)
      ?? (await this.versions()).find((item) => item.version === version);
    if (!stored) throw errors.notFound("No existe esa versión del diccionario");
    for (const concept of stored.snapshot.concepts) await this.saveConcept(concept, actorId, `reversión a ${version}`);
    return this.snapshot();
  },
};

export const feedbackRepository: FeedbackRepository = {
  async record(entry: FeedbackRecord): Promise<void> {
    memoryFeedback = [{ ...entry }, ...memoryFeedback].slice(0, 2000);
    try {
      await db.insert(classifierFeedback).values({
        candidateId: entry.candidateId ?? null,
        originalText: entry.originalText, originalHash: entry.originalHash,
        suggestedCategory: entry.suggestedCategory, correctedCategory: entry.correctedCategory,
        reason: entry.reason, concepts: entry.concepts, ruleApplied: entry.ruleApplied,
        reviewerId: entry.reviewerId, reviewerName: entry.reviewerName, reviewedAt: new Date(entry.reviewedAt),
        classifierVersion: entry.classifierVersion, dictionaryVersion: entry.dictionaryVersion,
        importId: entry.importId ?? null,
      });
    } catch (error) {
      fallback(error, "registro de retroalimentación");
    }
  },

  async list(limit = 200): Promise<FeedbackEntry[]> {
    try {
      const rows = await db.select().from(classifierFeedback).orderBy(desc(classifierFeedback.reviewedAt)).limit(Math.min(limit, 500));
      if (rows.length) return rows.map((row) => ({
        originalText: row.originalText, originalHash: row.originalHash,
        suggestedCategory: row.suggestedCategory, correctedCategory: row.correctedCategory,
        reason: row.reason, concepts: Array.isArray(row.concepts) ? row.concepts as string[] : [],
        ruleApplied: row.ruleApplied ?? "", reviewerId: row.reviewerId, reviewerName: row.reviewerName,
        reviewedAt: row.reviewedAt.toISOString(), classifierVersion: row.classifierVersion,
        dictionaryVersion: row.dictionaryVersion,
      }));
    } catch (error) {
      fallback(error, "lectura de retroalimentación");
    }
    return memoryFeedback.slice(0, limit).map(({ candidateId: _candidateId, importId: _importId, ...entry }) => entry);
  },
};

export const suggestionRepository = {
  async list(): Promise<SuggestionRecord[]> {
    try {
      const rows = await db.select().from(classifierSuggestions).orderBy(desc(classifierSuggestions.createdAt)).limit(200);
      if (rows.length) return rows.map((row) => ({
        id: row.id, kind: row.kind, conceptKey: row.conceptKey, title: row.title,
        payload: row.payload, evidenceCount: row.evidenceCount, status: row.status,
        notes: row.notes, createdAt: row.createdAt.toISOString(), resolvedAt: row.resolvedAt?.toISOString() ?? null,
      }));
    } catch (error) {
      fallback(error, "lectura de sugerencias");
    }
    return [...memorySuggestions];
  },

  /** Las correcciones repetidas generan propuestas; nunca reglas activas automáticamente. */
  async buildFromFeedback(actorId: string | null): Promise<SuggestionRecord[]> {
    const feedback = await feedbackRepository.list(500);
    const groups = new Map<string, { from: string; to: string; count: number }>();
    for (const entry of feedback) {
      if (entry.suggestedCategory === entry.correctedCategory) continue;
      const key = `${entry.suggestedCategory}\u0000${entry.correctedCategory}`;
      const current = groups.get(key) ?? { from: entry.suggestedCategory, to: entry.correctedCategory, count: 0 };
      current.count += 1;
      groups.set(key, current);
    }
    const existing = await this.list();
    const created: SuggestionRecord[] = [];
    for (const group of groups.values()) {
      if (group.count < 3) continue;
      const title = `Revisar regla: «${group.from}» corregida a «${group.to}» (${group.count} veces)`;
      if (existing.some((item) => item.title === title)) continue;
      const record: SuggestionRecord = {
        id: randomUUID(), kind: "correccion_repetida", conceptKey: null, title,
        payload: { from: group.from, to: group.to, count: group.count },
        evidenceCount: group.count, status: "pendiente", notes: null,
        createdAt: new Date().toISOString(), resolvedAt: null,
      };
      memorySuggestions = [record, ...memorySuggestions];
      created.push(record);
      try {
        await db.insert(classifierSuggestions).values({
          kind: record.kind, conceptKey: null, title: record.title, payload: record.payload,
          evidenceCount: record.evidenceCount, status: record.status, createdBy: actorId,
        });
      } catch (error) {
        fallback(error, "sugerencia desde correcciones");
      }
    }
    return created;
  },

  async resolve(id: string, status: "aprobada" | "rechazada", actorId: string | null, notes = ""): Promise<SuggestionRecord> {
    const current = memorySuggestions.find((item) => item.id === id)
      ?? (await this.list()).find((item) => item.id === id);
    if (!current) throw errors.notFound("No existe la sugerencia");
    if (current.status !== "pendiente") throw errors.conflict("La sugerencia ya fue resuelta");
    const updated: SuggestionRecord = {
      ...current, status, notes, resolvedAt: new Date().toISOString(),
    };
    memorySuggestions = memorySuggestions.map((item) => item.id === id ? updated : item);
    try {
      await db.update(classifierSuggestions).set({
        status, notes, resolvedBy: actorId, resolvedAt: new Date(updated.resolvedAt!),
      }).where(eq(classifierSuggestions.id, id));
    } catch (error) {
      fallback(error, "resolución de sugerencia");
    }
    return updated;
  },
};

export function feedbackHash(text: string): string {
  return sha256(text);
}
