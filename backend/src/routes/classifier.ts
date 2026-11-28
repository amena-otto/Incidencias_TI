import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { audit, requireAuth, requirePermission } from "../auth/middleware.js";
import { asyncHandler, errors, ok } from "../lib/http.js";
import { CATEGORY_NAMES } from "../classifier/categories.js";
import { normalizeForAnalysis } from "../classifier/v4/normalize.js";
import {
  dictionaryRepository, feedbackRepository, suggestionRepository,
} from "../classifier/v4/repository.js";
import { CLASSIFIER_VERSION } from "../classifier/v4/types.js";
import type { Concept } from "../classifier/v4/types.js";
import { getClassifierEngine, getTiScopeConfig } from "../services/settings.js";

const r = Router();
r.use(requireAuth);

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

const textList = z.array(z.string().min(1).max(240)).max(200);
const conceptSchema = z.object({
  key: z.string().min(3).max(120).optional(),
  category: z.string().refine((value) => CATEGORY_NAMES.includes(value), "Categoría no autorizada"),
  name: z.string().min(2).max(180),
  description: z.string().min(2).max(2000),
  synonyms: textList.default([]),
  expressions: textList.default([]),
  variants: textList.default([]),
  abbreviations: textList.default([]),
  related: textList.default([]),
  negatives: textList.default([]),
  weight: z.number().int().min(0).max(10),
  priority: z.number().int().min(0).max(10),
  active: z.boolean().default(true),
});

async function findConcept(key: string): Promise<Concept> {
  const snapshot = await dictionaryRepository.snapshot();
  const concept = snapshot.concepts.find((item) => item.key === key);
  if (!concept) throw errors.notFound("No existe el concepto solicitado");
  return concept;
}

r.get("/", asyncHandler(async (_req, res) => {
  const [dictionary, engine, scope, versions] = await Promise.all([
    dictionaryRepository.snapshot(), getClassifierEngine(), getTiScopeConfig(), dictionaryRepository.versions(),
  ]);
  return ok(res, {
    classifierVersion: CLASSIFIER_VERSION,
    dictionaryVersion: dictionary.version,
    storage: dictionary.source,
    migrationPending: dictionary.source === "memoria",
    engine,
    scope,
    concepts: dictionary.concepts.length,
    activeConcepts: dictionary.concepts.filter((concept) => concept.active).length,
    categories: CATEGORY_NAMES.length,
    ruleVersions: versions.length,
    statisticalModel: { enabled: false, reason: "Sin datos etiquetados suficientes; interfaz preparada." },
  });
}));

r.get("/concepts", asyncHandler(async (req, res) => {
  const snapshot = await dictionaryRepository.snapshot();
  const category = typeof req.query.category === "string" ? req.query.category : "";
  const search = typeof req.query.q === "string" ? normalizeForAnalysis(req.query.q).canonical : "";
  const active = req.query.active === "true" ? true : req.query.active === "false" ? false : null;
  const concepts = snapshot.concepts.filter((concept) => {
    if (category && concept.category !== category) return false;
    if (active !== null && concept.active !== active) return false;
    if (!search) return true;
    const haystack = normalizeForAnalysis([
      concept.name, concept.description, ...concept.synonyms, ...concept.expressions,
      ...concept.variants, ...concept.abbreviations, ...concept.related,
    ].join(" ")).canonical;
    return haystack.includes(search);
  });
  return ok(res, { version: snapshot.version, concepts });
}));

r.post("/concepts", requirePermission("config:write"), asyncHandler(async (req, res) => {
  const parsed = conceptSchema.safeParse(req.body);
  if (!parsed.success) throw errors.badRequest("Concepto inválido", parsed.error.flatten());
  const key = parsed.data.key ?? `concept-${normalizeForAnalysis(parsed.data.name).tokens.join("-").slice(0, 80)}`;
  const snapshot = await dictionaryRepository.snapshot();
  if (snapshot.concepts.some((concept) => concept.key === key)) throw errors.conflict("Ya existe un concepto con ese identificador");
  const now = new Date().toISOString();
  const concept: Concept = { ...parsed.data, key, id: randomUUID(), updatedAt: now, version: snapshot.version };
  const saved = await dictionaryRepository.saveConcept(concept, req.user?.id ?? null, "concepto creado");
  await audit(req, "classifier_concept_created", "classifier_concept", key, { category: saved.category });
  return ok(res, saved, undefined, 201);
}));

r.patch("/concepts/:key", requirePermission("config:write"), asyncHandler(async (req, res) => {
  const current = await findConcept(param(req.params.key));
  const parsed = conceptSchema.partial().safeParse(req.body);
  if (!parsed.success) throw errors.badRequest("Concepto inválido", parsed.error.flatten());
  const next: Concept = { ...current, ...parsed.data, key: current.key, id: current.id };
  const saved = await dictionaryRepository.saveConcept(next, req.user?.id ?? null, "regla editada");
  await audit(req, "classifier_concept_updated", "classifier_concept", current.key, parsed.data);
  return ok(res, saved);
}));

r.post("/concepts/:key/synonyms", requirePermission("config:write"), asyncHandler(async (req, res) => {
  const current = await findConcept(param(req.params.key));
  const parsed = z.object({ terms: z.array(z.string().min(1).max(240)).min(1).max(50) }).safeParse(req.body);
  if (!parsed.success) throw errors.badRequest("Sinónimos inválidos", parsed.error.flatten());
  const saved = await dictionaryRepository.saveConcept({
    ...current,
    synonyms: [...new Set([...current.synonyms, ...parsed.data.terms])],
  }, req.user?.id ?? null, "sinónimos añadidos");
  await audit(req, "classifier_synonyms_added", "classifier_concept", current.key, { terms: parsed.data.terms });
  return ok(res, saved);
}));

r.get("/feedback", requirePermission("config:write"), asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit ?? 200);
  return ok(res, { entries: await feedbackRepository.list(Number.isFinite(limit) ? limit : 200) });
}));

r.get("/suggestions", requirePermission("config:write"), asyncHandler(async (_req, res) => {
  return ok(res, { suggestions: await suggestionRepository.list() });
}));

r.post("/suggestions/generate", requirePermission("config:write"), asyncHandler(async (req, res) => {
  const created = await suggestionRepository.buildFromFeedback(req.user?.id ?? null);
  await audit(req, "classifier_suggestions_generated", "classifier_suggestion", undefined, { created: created.length });
  return ok(res, { created });
}));

r.patch("/suggestions/:id", requirePermission("config:write"), asyncHandler(async (req, res) => {
  const parsed = z.object({
    status: z.enum(["aprobada", "rechazada"]),
    notes: z.string().max(1000).default(""),
  }).safeParse(req.body);
  if (!parsed.success) throw errors.badRequest("Resolución inválida", parsed.error.flatten());
  const updated = await suggestionRepository.resolve(param(req.params.id), parsed.data.status, req.user?.id ?? null, parsed.data.notes);
  await audit(req, "classifier_suggestion_resolved", "classifier_suggestion", updated.id, parsed.data);
  return ok(res, { ...updated, rulesActivated: false });
}));

r.get("/versions", requirePermission("config:write"), asyncHandler(async (_req, res) => {
  return ok(res, { versions: await dictionaryRepository.versions() });
}));

r.post("/versions/:version/revert", requirePermission("config:write"), asyncHandler(async (req, res) => {
  const version = param(req.params.version);
  const snapshot = await dictionaryRepository.revert(version, req.user?.id ?? null);
  await audit(req, "classifier_dictionary_reverted", "classifier_dictionary", version);
  return ok(res, { version: snapshot.version, concepts: snapshot.concepts.length });
}));

export default r;
