import { SCOPE_PROFILE, type DetectionResult, type ScopeConfig, type ScopeDecision } from "./types.js";

export const DEFAULT_TI_SCOPE: ScopeConfig = {
  profile: SCOPE_PROFILE,
  allowedCategories: [
    "TI · Redes e Internet",
    "TI · Equipos audiovisuales",
    "TI · Hardware y periféricos",
    "TI · Software y plataformas",
    "TI · Impresoras",
  ],
  conditionalCategories: ["Asistencia · Marcación y asistencia"],
  excludeNonTiByDefault: true,
  requireTiEvidenceForNonTi: true,
};

const MARKING = "Asistencia · Marcación y asistencia";

export function normalizeScopeConfig(input: Partial<ScopeConfig> | null | undefined): ScopeConfig {
  const allowed = Array.isArray(input?.allowedCategories)
    ? input!.allowedCategories.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : DEFAULT_TI_SCOPE.allowedCategories;
  const conditional = Array.isArray(input?.conditionalCategories)
    ? input!.conditionalCategories.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : DEFAULT_TI_SCOPE.conditionalCategories;
  return {
    profile: typeof input?.profile === "string" && input.profile.trim() ? input.profile : DEFAULT_TI_SCOPE.profile,
    allowedCategories: [...new Set(allowed)],
    conditionalCategories: [...new Set(conditional)],
    excludeNonTiByDefault: input?.excludeNonTiByDefault ?? DEFAULT_TI_SCOPE.excludeNonTiByDefault,
    requireTiEvidenceForNonTi: input?.requireTiEvidenceForNonTi ?? DEFAULT_TI_SCOPE.requireTiEvidenceForNonTi,
  };
}

/**
 * Perfil TI_INSTITUCIONAL: decide qué entra al flujo TI sin borrar categorías.
 * La marcación se admite cuando hay atención TI verificable; si no, revisión.
 */
export function analyzeScope(
  detection: DetectionResult,
  options: { config?: ScopeConfig; tiAttendance?: boolean; tiAttendanceReason?: string } = {},
): ScopeDecision {
  const config = normalizeScopeConfig(options.config);
  const topScore = detection.alternatives[0]?.score ?? detection.score;
  const significant = detection.alternatives
    .filter((entry) => entry.score >= Math.max(2, topScore * 0.8))
    .map((entry) => entry.category);
  const categories = significant.length ? significant : [detection.categoryLabel];
  const tiTopics = categories.filter((category) => config.allowedCategories.includes(category));
  const conditional = categories.filter((category) => config.conditionalCategories.includes(category));
  const nonTiTopics = categories.filter((category) => !tiTopics.includes(category) && !conditional.includes(category));
  const mixed = tiTopics.length > 0 && nonTiTopics.length > 0;
  const tiAttendance = Boolean(options.tiAttendance);

  let status: ScopeDecision["status"] = "requiere_revision";
  let reason = `Perfil ${config.profile}: se conserva la categoría para revisión humana.`;

  if (tiTopics.length && !nonTiTopics.length) {
    status = mixed ? "requiere_revision" : "ti_detectada";
    reason = `Perfil ${config.profile}: categoría TI permitida (${tiTopics.join(", ")}).`;
  } else if (conditional.includes(detection.categoryLabel) || (conditional.length && !tiTopics.length)) {
    if (tiAttendance) {
      status = "atencion_ti";
      reason = `Perfil ${config.profile}: categoría condicional con atención TI verificable. ${options.tiAttendanceReason ?? ""}`.trim();
    } else {
      status = "requiere_revision";
      reason = `Perfil ${config.profile}: ${MARKING} requiere evidencia de atención TI antes de registrarla como incidencia TI.`;
    }
  } else if (config.excludeNonTiByDefault) {
    if (config.requireTiEvidenceForNonTi && tiAttendance) {
      status = "atencion_ti";
      reason = `Perfil ${config.profile}: asunto ajeno a TI con atención TI verificable. ${options.tiAttendanceReason ?? ""}`.trim();
    } else {
      status = "fuera_alcance";
      reason = `Perfil ${config.profile}: ${detection.categoryLabel} queda fuera del alcance TI. La categoría se conserva en el catálogo y en la revisión.`;
    }
  }

  if (detection.generic) {
    status = "requiere_revision";
    reason = `Perfil ${config.profile}: solicitud sin detalle; no se registra automáticamente.`;
  }

  return { status, reason, profile: config.profile, allowedCategories: config.allowedCategories, tiTopics, nonTiTopics, mixed };
}
