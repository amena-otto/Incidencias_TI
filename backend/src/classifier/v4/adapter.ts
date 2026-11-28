import { CATEGORY_NAMES, OTHER_CATEGORY, requestTypeFor } from "../categories.js";
import { detectRole, type MessageRole } from "../message-kind.js";
import type { Candidate, ClassifyOptions } from "../rules.js";
import type { TiScope } from "../ti-scope.js";
import type { Msg } from "../../importer/whatsapp.js";
import { ClassificationDecisionService } from "./classifier.js";
import { dictionaryRepository } from "./repository.js";
import { DEFAULT_TI_SCOPE, normalizeScopeConfig } from "./scope.js";
import {
  CLASSIFIER_VERSION,
  type ClassificationOptions,
  type ConversationStage,
  type DictionarySnapshot,
  type ScopeConfig,
  type V4Decision,
} from "./types.js";

export type V4ClassifyOptions = ClassifyOptions & {
  dictionary?: DictionarySnapshot;
  scope?: Partial<ScopeConfig>;
  statistical?: ClassificationOptions["statistical"];
};

const STAGE_ROLE: Record<ConversationStage, MessageRole> = {
  reporte: "reporte",
  respuesta_ti: "respuesta",
  solicitud_ubicacion: "respuesta",
  desplazamiento: "seguimiento",
  accion_tecnica: "respuesta",
  seguimiento: "seguimiento",
  confirmacion_solucion: "confirmacion",
  no_relacionado: "no_relacionado",
};

function explanationFor(decision: V4Decision): string {
  const { detection, conversation, contextualization, dictionaryVersion } = decision;
  const alternatives = detection.alternatives.slice(0, 3)
    .map((entry) => `${entry.category} (${entry.score}): ${entry.justification}`)
    .join(" | ");
  return `[${CLASSIFIER_VERSION}|${dictionaryVersion}] ${detection.explanation} Alternativas: ${alternatives}. ${contextualization.explanation} ${conversation.explanation}`;
}

function toScope(decision: V4Decision): TiScope {
  return {
    status: decision.scope.status,
    reason: decision.scope.reason,
    tiTopics: decision.scope.tiTopics,
    nonTiTopics: decision.scope.nonTiTopics,
    mixed: decision.scope.mixed,
  };
}

function isSelected(decision: V4Decision): boolean {
  return decision.scope.status === "ti_detectada"
    && !decision.detection.ambiguous
    && !decision.detection.generic
    && decision.detection.confidence !== "baja"
    && decision.detection.categoryLabel !== OTHER_CATEGORY;
}

/** Convierte V4 al contrato `Candidate[]` que ya consume import-service. */
export async function classifyV4(messages: Msg[], options: V4ClassifyOptions = {}): Promise<Candidate[]> {
  const dictionary = options.dictionary ?? await dictionaryRepository.snapshot();
  const scopeConfig = normalizeScopeConfig({ ...DEFAULT_TI_SCOPE, ...options.scope });
  const service = new ClassificationDecisionService({ statistical: options.statistical ?? null }, dictionaryRepository);
  const staffNames = options.staffNames ?? new Set<string>();
  const tiStaffNames = options.tiStaffNames ?? staffNames;
  const windowMinutes = options.windowMinutes ?? 90;
  const rows: Candidate[] = [];

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    const role = detectRole(message, staffNames);
    if (role !== "reporte" || message.kind !== "chat") continue;

    const decision = await service.classify(message, {
      staffNames,
      tiStaffNames,
      windowMinutes,
      messages,
      messageIndex: index,
      dictionary,
      scope: scopeConfig,
      statistical: options.statistical ?? null,
    });
    if (!decision) continue;

    const { detection, conversation, contextualization, scope } = decision;
    const excluded = scope.status === "fuera_alcance" || scope.status === "no_pertinente";
    rows.push({
      id: message.id || `${message.position}-${message.sender}-${index}`,
      position: message.position,
      date: message.dateString,
      time: message.time,
      requesterName: message.sender,
      originalMessage: message.text,
      categoryLabel: detection.categoryLabel,
      requestType: requestTypeFor(detection.categoryLabel),
      contextualization: contextualization.text,
      confidence: detection.confidence,
      explanation: explanationFor(decision),
      matchedCategories: CATEGORY_NAMES.filter((name) => detection.matchedCategories.includes(name)),
      ambiguous: detection.ambiguous || scope.mixed,
      role,
      suggestedStatus: conversation.suggestedStatus,
      responses: conversation.links.map((link) => ({
        id: link.messageId,
        position: link.position,
        sender: link.sender,
        text: link.text,
        date: link.date,
        time: link.time,
        role: STAGE_ROLE[link.stage],
        score: link.score,
        uncertain: link.uncertain,
        isStaff: link.isStaff,
      })),
      associationUncertain: conversation.uncertain,
      selected: isSelected(decision) && !excluded,
      reason: explanationFor(decision),
      scope: toScope(decision),
      inclusionStatus: scope.status,
      inclusionReason: scope.reason,
      excluded,
    });
  }

  return rows;
}
