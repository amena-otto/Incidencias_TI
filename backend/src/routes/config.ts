import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { settings } from "../db/schema.js";
import { env } from "../config/env.js";
import { asyncHandler, errors, ok } from "../lib/http.js";
import { audit, requireAuth, requirePermission } from "../auth/middleware.js";
import {
  getClassifierEngine, getContextWindowMinutes, getTiScopeConfig, setClassifierEngine, setTiScopeConfig,
} from "../services/settings.js";
import { dictionaryRepository } from "../classifier/v4/repository.js";
import { CLASSIFIER_VERSION } from "../classifier/v4/types.js";
import { normalizeScopeConfig } from "../classifier/v4/scope.js";

const r = Router();
r.use(requireAuth);

r.get("/", asyncHandler(async (_req, res) => {
  const [contextWindowMinutes, classifierEngine, tiScope, dictionary] = await Promise.all([
    getContextWindowMinutes(), getClassifierEngine(), getTiScopeConfig(), dictionaryRepository.snapshot(),
  ]);
  return ok(res, {
    timezone: "America/Lima",
    contextWindowMinutes,
    maxUploadMb: env.MAX_UPLOAD_MB,
    environment: env.NODE_ENV,
    version: "1.0.0-final-candidate",
    classifierEngine,
    classifierVersion: CLASSIFIER_VERSION,
    dictionaryVersion: dictionary.version,
    dictionarySource: dictionary.source,
    tiScope,
    capabilities: {
      whatsappImport: true,
      teachersCatalog: true,
      dashboards: true,
      excelReports: true,
      googleDrive: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      classifierV4: true,
      localStatisticalModel: false,
    },
  });
}));

const patchSchema = z.object({
  contextWindowMinutes: z.number().int().min(5).max(10080).optional(),
  classifierEngine: z.enum(["v3", "v4"]).optional(),
  tiScope: z.object({
    profile: z.string().min(1).max(60).optional(),
    allowedCategories: z.array(z.string().min(1)).max(13).optional(),
    conditionalCategories: z.array(z.string().min(1)).max(13).optional(),
    excludeNonTiByDefault: z.boolean().optional(),
    requireTiEvidenceForNonTi: z.boolean().optional(),
  }).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: "No se envió ninguna opción" });

r.patch("/", requirePermission("config:write"), asyncHandler(async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) throw errors.badRequest("Configuración inválida", parsed.error.flatten());
  const applied: Record<string, unknown> = {};

  if (parsed.data.contextWindowMinutes !== undefined) {
    const value = String(parsed.data.contextWindowMinutes);
    await db.insert(settings).values({ key: "context_window_minutes", value })
      .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
    applied.contextWindowMinutes = parsed.data.contextWindowMinutes;
  }
  if (parsed.data.classifierEngine) {
    await setClassifierEngine(parsed.data.classifierEngine);
    applied.classifierEngine = parsed.data.classifierEngine;
  }
  if (parsed.data.tiScope) {
    const current = await getTiScopeConfig();
    const next = normalizeScopeConfig({ ...current, ...parsed.data.tiScope });
    await setTiScopeConfig(next);
    applied.tiScope = next;
  }

  await audit(req, "config_updated", "settings", Object.keys(applied).join(","), applied);
  return ok(res, applied);
}));

export default r;
