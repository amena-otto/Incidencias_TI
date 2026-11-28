import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  categories, imports as chatImports, incidentHistory, incidentMessages, incidentResponses, incidents,
  profiles, staffDirectory, teacherAliases, teachers,
} from "../db/schema.js";
import { env } from "../config/env.js";
import { AppError, errors } from "../lib/http.js";
import { createPreview, consumePreview } from "../lib/preview-store.js";
import { normalize, stableMessageFingerprint } from "../lib/text.js";
import { boundedText, limaDateTime, sanitizeFilename, sha256 } from "../lib/validation.js";
import { classify } from "../classifier/rules.js";
import { classifyV4 } from "../classifier/v4/adapter.js";
import { feedbackRepository } from "../classifier/v4/repository.js";
import { CLASSIFIER_VERSION } from "../classifier/v4/types.js";
import type { ScopeStatus } from "../classifier/ti-scope.js";
import { detectRole } from "../classifier/message-kind.js";
import { parseConversation } from "../importer/whatsapp.js";
import { matchTeacher } from "../teachers/matching.js";
import { getClassifierEngine, getContextWindowMinutes, getTiScopeConfig } from "./settings.js";
import type { Confidence, RequestType } from "../db/schema.types.js";

export type PreviewCandidate = {
  candidateId: string;
  position: number;
  date: string;
  time: string;
  requesterName: string;
  originalMessage: string;
  categoryLabel: string;
  contextualization: string;
  confidence: Confidence;
  explanation: string;
  matchedCategories: string[];
  ambiguous: boolean;
  suggestedStatus: string;
  responses: Array<{ sender: string; text: string; date: string; time: string; role: string; uncertain: boolean; score: number; isStaff: boolean }>;
  teacherId: string | null;
  teacherSuggestion: ReturnType<typeof matchTeacher>["suggestion"];
  teacherCandidates: ReturnType<typeof matchTeacher>["suggestions"];
  teacherName: string | null;
  requestType: string;
  inclusionStatus: ScopeStatus;
  inclusionReason: string;
  tiTopics: string[];
  nonTiTopics: string[];
  mixed: boolean;
  possibleDuplicate: boolean;
  selected: boolean;
};

export type ExcludedMessage = {
  position: number;
  date: string;
  time: string;
  sender: string;
  originalMessage: string;
  status: ScopeStatus | "duplicado";
  reason: string;
};

export type ImportPreview = {
  token: string;
  sourceName: string;
  channel: "whatsapp_txt" | "texto_pegado";
  totalMessages: number;
  contentHash: string;
  conversationKey?: string;
  candidates: PreviewCandidate[];
  excluded: ExcludedMessage[];
  excludedReasons: Array<{ status: string; reason: string; count: number }>;
  stats: {
    analyzed: number;
    detected: number;
    high: number;
    medium: number;
    low: number;
    ambiguous: number;
    responses: number;
    discarded: number;
    possibleDuplicates: number;
    includedTi: number;
    tiWithAttention: number;
    requiresReview: number;
    excludedOutOfScope: number;
    excludedNotRelevant: number;
    excludedDuplicates: number;
  };
  format: string;
  invalidDates: number;
};

export type CommitRow = {
  candidateId: string;
  selected: boolean;
  categoryLabel?: string;
  contextualization?: string;
  teacherId?: string | null;
};

export type CommitResult = {
  analyzed: number;
  detected: number;
  confirmed: number;
  saved: number;
  duplicateMessages: number;
  rejected: number;
  responsesSaved: number;
  importId: string | null;
  duplicateConversation: boolean;
};

async function catalogs() {
  const [staffRows, profileRows, categoryRows, teacherRows, aliasRows] = await Promise.all([
    db.select({ fullName: staffDirectory.fullName }).from(staffDirectory).where(eq(staffDirectory.active, true)).limit(2000),
    db.select({ fullName: profiles.fullName, role: profiles.role }).from(profiles).where(eq(profiles.active, true)).limit(2000),
    db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.active, true)).limit(500),
    db.select({ id: teachers.id, fullName: teachers.fullName, normalizedName: teachers.normalizedName }).from(teachers).where(eq(teachers.active, true)).limit(2000),
    db.select({ teacherId: teacherAliases.teacherId, alias: teacherAliases.alias, normalizedAlias: teacherAliases.normalizedAlias }).from(teacherAliases).limit(5000),
  ]);
  const tiStaffNames = new Set([
    ...staffRows.map((row) => normalize(row.fullName)),
    ...profileRows.filter((row) => row.role === "admin" || row.role === "tecnico").map((row) => normalize(row.fullName)),
  ]);
  return {
    staffNames: new Set([...staffRows, ...profileRows].map((row) => normalize(row.fullName))),
    tiStaffNames,
    categoryNames: new Set(categoryRows.map((row) => row.name)),
    categoryIds: new Map(categoryRows.map((row) => [row.name, row.id])),
    teacherRows,
    aliasRows,
  };
}

export async function createImportPreview(input: {
  text: string;
  sourceName: string;
  channel: "whatsapp_txt" | "texto_pegado";
  conversationKey?: string;
}): Promise<ImportPreview> {
  const [{ staffNames, tiStaffNames, categoryNames, teacherRows, aliasRows }, windowMinutes, engine, tiScope] = await Promise.all([
    catalogs(), getContextWindowMinutes(), getClassifierEngine(), getTiScopeConfig(),
  ]);
  const parsed = parseConversation(input.text, { conversationKey: input.conversationKey });
  const classifyOptions = {
    staffNames, tiStaffNames, windowMinutes, conversationKey: input.conversationKey,
  };
  // V3 permanece intacto como línea base; el flag decide qué motor se ejecuta.
  const classified = engine === "v4"
    ? await classifyV4(parsed.messages, { ...classifyOptions, scope: tiScope })
    : classify(parsed.messages, classifyOptions);

  const normalizedValues = [...new Set(classified.map((row) => normalize(row.originalMessage)))].slice(0, 500);
  const existing = normalizedValues.length
    ? await db.select({ normalizedMessage: incidents.normalizedMessage, requesterName: incidents.requesterName })
      .from(incidents).where(inArray(incidents.normalizedMessage, normalizedValues)).limit(5000)
    : [];
  const duplicateKeys = new Set(existing.map((row) => `${normalize(row.requesterName)}|${row.normalizedMessage ?? ""}`));
  const isDuplicate = (sender: string, text: string): boolean =>
    duplicateKeys.has(`${normalize(sender)}|${normalize(text)}`);

  const toCandidate = (row: (typeof classified)[number]): PreviewCandidate => {
    const match = matchTeacher(row.requesterName, teacherRows, aliasRows);
    const candidateId = stableMessageFingerprint({
      date: row.date, time: row.time, sender: row.requesterName, text: row.originalMessage,
      conversationKey: input.conversationKey, position: row.position,
    });
    return {
      candidateId,
      position: row.position,
      date: row.date,
      time: row.time,
      requesterName: row.requesterName,
      originalMessage: row.originalMessage,
      categoryLabel: row.categoryLabel,
      contextualization: row.contextualization,
      confidence: row.confidence,
      explanation: row.explanation,
      matchedCategories: row.matchedCategories,
      ambiguous: row.ambiguous,
      suggestedStatus: row.suggestedStatus,
      responses: row.responses,
      teacherId: match.autoLink ? match.suggestion?.teacherId ?? null : null,
      teacherSuggestion: match.suggestion,
      teacherCandidates: match.suggestions,
      teacherName: match.autoLink ? match.suggestion?.fullName ?? null : null,
      requestType: row.requestType,
      inclusionStatus: row.inclusionStatus,
      inclusionReason: row.inclusionReason,
      tiTopics: row.scope.tiTopics,
      nonTiTopics: row.scope.nonTiTopics,
      mixed: row.scope.mixed,
      possibleDuplicate: isDuplicate(row.requesterName, row.originalMessage),
      selected: row.selected,
    };
  };

  const candidates = classified
    .filter((row) => !row.excluded && categoryNames.has(row.categoryLabel))
    .map(toCandidate);

  const excluded: ExcludedMessage[] = classified
    .filter((row) => row.excluded || !categoryNames.has(row.categoryLabel))
    .map((row) => ({
      position: row.position,
      date: row.date,
      time: row.time,
      sender: row.requesterName,
      originalMessage: row.originalMessage,
      status: row.excluded ? row.inclusionStatus : "fuera_alcance" as ScopeStatus,
      reason: categoryNames.has(row.categoryLabel)
        ? row.inclusionReason
        : `La categoría ${row.categoryLabel} no está activa en el catálogo; requiere revisión.`,
    }));

  const classifiedIds = new Set(classified.map((row) => row.id));
  for (const message of parsed.messages) {
    if (classifiedIds.has(message.id)) continue;
    const role = detectRole(message, staffNames);
    const reason = message.kind === "system"
      ? "Mensaje del sistema o eliminado; no es una solicitud."
      : role === "agradecimiento"
        ? "Agradecimiento aislado sin solicitud TI."
        : role === "comunicado"
          ? "Comunicado institucional, no una incidencia."
          : ["seguimiento", "respuesta", "confirmacion", "ack"].includes(role)
            ? "Respuesta sin solicitud TI propia; se conserva como contexto."
            : "Mensaje no pertinente para el perfil Incidencias TI.";
    excluded.push({
      position: message.position,
      date: message.dateString,
      time: message.time,
      sender: message.sender,
      originalMessage: message.text,
      status: "no_pertinente",
      reason,
    });
  }

  for (const row of excluded) {
    if (isDuplicate(row.sender, row.originalMessage)) {
      row.status = "duplicado";
      row.reason = `Posible duplicado. ${row.reason}`;
    }
  }
  excluded.sort((a, b) => a.position - b.position);

  const reasonCounts = new Map<string, number>();
  for (const row of excluded) {
    const key = `${row.status}\u0000${row.reason}`;
    reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
  }
  const excludedReasons = [...reasonCounts].map(([key, count]) => {
    const [status, reason] = key.split("\u0000");
    return { status, reason, count };
  }).sort((a, b) => b.count - a.count || a.status.localeCompare(b.status));

  const contentHash = sha256(input.text);
  const sourceName = sanitizeFilename(input.sourceName);
  const token = createPreview({
    sourceName,
    channel: input.channel,
    totalMessages: parsed.messages.length,
    contentHash,
    conversationKey: input.conversationKey,
    candidates,
    excluded,
    excludedReasons,
    format: parsed.detectedFormat,
    invalidDates: parsed.invalidDates,
  });

  return {
    token,
    sourceName,
    channel: input.channel,
    totalMessages: parsed.messages.length,
    contentHash,
    conversationKey: input.conversationKey,
    candidates,
    excluded,
    excludedReasons,
    stats: {
      analyzed: parsed.messages.length,
      detected: candidates.length,
      high: candidates.filter((row) => row.confidence === "alta").length,
      medium: candidates.filter((row) => row.confidence === "media").length,
      low: candidates.filter((row) => row.confidence === "baja").length,
      ambiguous: candidates.filter((row) => row.ambiguous).length,
      responses: candidates.reduce((sum, row) => sum + row.responses.length, 0),
      discarded: parsed.messages.length - candidates.length,
      possibleDuplicates: candidates.filter((row) => row.possibleDuplicate).length + excluded.filter((row) => row.status === "duplicado").length,
      includedTi: candidates.filter((row) => row.inclusionStatus === "ti_detectada").length,
      tiWithAttention: candidates.filter((row) => row.responses.some((response) => response.isStaff)).length,
      requiresReview: candidates.filter((row) => row.inclusionStatus === "requiere_revision" || row.ambiguous || row.possibleDuplicate).length,
      excludedOutOfScope: excluded.filter((row) => row.status === "fuera_alcance").length,
      excludedNotRelevant: excluded.filter((row) => row.status === "no_pertinente").length,
      excludedDuplicates: excluded.filter((row) => row.status === "duplicado").length,
    },
    format: parsed.detectedFormat,
    invalidDates: parsed.invalidDates,
  };
}

type StoredPreview = Omit<ImportPreview, "token">;

function classifierMetadata(explanation: string): { classifierVersion: string; dictionaryVersion: string } {
  const match = /\[([^\]|]+)\|([^\]]+)\]/.exec(explanation);
  return {
    classifierVersion: match?.[1] ?? CLASSIFIER_VERSION,
    dictionaryVersion: match?.[2] ?? "desconocida",
  };
}

function detectedConcepts(explanation: string): string[] {
  return [...new Set([...explanation.matchAll(/Concepto «([^»]+)»/g)].map((match) => match[1]))];
}

async function recordCategoryFeedback(
  rows: Array<PreviewCandidate & { selected: boolean }>,
  originals: Map<string, PreviewCandidate>,
  actorId: string | undefined,
  importId: string | null,
): Promise<void> {
  const corrections = rows.filter((row) => row.selected && originals.has(row.candidateId)
    && originals.get(row.candidateId)!.categoryLabel !== row.categoryLabel);
  if (!corrections.length) return;
  const reviewer = actorId
    ? (await db.select({ fullName: profiles.fullName }).from(profiles).where(eq(profiles.id, actorId)).limit(1))[0]
    : undefined;
  for (const row of corrections) {
    const original = originals.get(row.candidateId)!;
    const metadata = classifierMetadata(original.explanation);
    await feedbackRepository.record({
      originalText: row.originalMessage,
      originalHash: sha256(row.originalMessage),
      suggestedCategory: original.categoryLabel,
      correctedCategory: row.categoryLabel,
      reason: "Corrección humana al confirmar la importación.",
      concepts: detectedConcepts(original.explanation),
      ruleApplied: detectedConcepts(original.explanation).join(" + ") || "sin concepto",
      reviewerId: actorId ?? null,
      reviewerName: reviewer?.fullName ?? "revisor no identificado",
      reviewedAt: new Date().toISOString(),
      classifierVersion: metadata.classifierVersion,
      dictionaryVersion: metadata.dictionaryVersion,
      candidateId: row.candidateId,
      importId,
    });
  }
}

export async function commitImport(token: string, incoming: CommitRow[], actorId?: string): Promise<CommitResult> {
  const preview = consumePreview<StoredPreview>(token);
  const byId = new Map(preview.candidates.map((row) => [row.candidateId, row]));
  const chosen = new Map<string, CommitRow>();
  for (const row of incoming) {
    if (!byId.has(row.candidateId)) throw errors.badRequest("Uno de los candidatos no pertenece a la previsualización");
    if (chosen.has(row.candidateId)) throw errors.badRequest("Hay candidatos duplicados en la solicitud");
    chosen.set(row.candidateId, row);
  }

  const { categoryNames, categoryIds } = await catalogs();
  const teacherIds = [...new Set(incoming.map((row) => row.teacherId).filter((value): value is string => Boolean(value)))];
  const validTeachers = teacherIds.length
    ? new Set((await db.select({ id: teachers.id }).from(teachers).where(inArray(teachers.id, teacherIds))).map((row) => row.id))
    : new Set<string>();

  const finalRows = [...chosen.values()].map((row) => {
    const original = byId.get(row.candidateId)!;
    if (row.categoryLabel && !categoryNames.has(row.categoryLabel)) {
      throw errors.badRequest(`Categoría no autorizada: ${row.categoryLabel}`);
    }
    if (row.teacherId && !validTeachers.has(row.teacherId)) {
      throw errors.badRequest("El docente indicado no existe en el catálogo");
    }
    const cleanedContext = row.contextualization === undefined
      ? original.contextualization
      : boundedText(4000).parse(row.contextualization);
    return { ...original, ...(row.categoryLabel ? { categoryLabel: row.categoryLabel } : {}), contextualization: cleanedContext, ...(row.teacherId !== undefined ? { teacherId: row.teacherId } : {}), selected: row.selected };
  });

  const confirmed = finalRows.filter((row) => row.selected);
  const result = await db.transaction(async (tx) => {
    const [createdImport] = await tx.insert(chatImports).values({
      sourceName: preview.sourceName,
      channel: preview.channel,
      contentHash: preview.contentHash,
      totalMessages: preview.totalMessages,
      candidateCount: confirmed.length,
      importedBy: actorId ?? null,
    }).onConflictDoNothing({ target: chatImports.contentHash }).returning({ id: chatImports.id });

    if (!createdImport) {
      return { analyzed: preview.totalMessages, detected: preview.candidates.length, confirmed: confirmed.length, saved: 0, duplicateMessages: 0, rejected: 0, responsesSaved: 0, importId: null, duplicateConversation: true };
    }

    let saved = 0;
    let duplicateMessages = 0;
    let responsesSaved = 0;
    for (const row of confirmed) {
      const incidentDate = limaDateTime(row.date, row.time);
      const messageHash = stableMessageFingerprint({
        date: row.date, time: row.time, sender: row.requesterName, text: row.originalMessage,
        conversationKey: preview.conversationKey, position: row.position,
      });
      const [incident] = await tx.insert(incidents).values({
        incidentDate,
        incidentTime: row.time,
        requesterName: row.requesterName,
        teacherId: row.teacherId ?? null,
        originalMessage: row.originalMessage,
        normalizedMessage: normalize(row.originalMessage),
        messageHash,
        messagePosition: row.position,
        conversationKey: preview.conversationKey ?? null,
        categoryLabel: row.categoryLabel,
        categoryId: categoryIds.get(row.categoryLabel) ?? null,
        requestType: row.requestType as RequestType,
        confidenceLevel: row.confidence,
        confidenceExplanation: row.explanation,
        contextualization: row.contextualization || null,
        suggestedStatus: row.suggestedStatus,
        teacherMatch: row.teacherSuggestion ?? null,
        channel: preview.channel,
        importId: createdImport.id,
      }).onConflictDoNothing({ target: incidents.messageHash }).returning({ id: incidents.id });

      if (!incident) {
        duplicateMessages += 1;
        continue;
      }

      const [originalMessage] = await tx.insert(incidentMessages).values({
        incidentId: incident.id,
        senderName: row.requesterName,
        messageText: row.originalMessage,
        messageDate: incidentDate,
        messageTime: row.time,
        type: "reporte",
        contentHash: sha256(messageHash, "reporte"),
        isStaff: false,
        position: row.position,
      }).onConflictDoNothing().returning({ id: incidentMessages.id });

      for (const response of row.responses) {
        const responseDate = limaDateTime(response.date, response.time);
        const [storedMessage] = await tx.insert(incidentMessages).values({
          incidentId: incident.id,
          senderName: response.sender,
          messageText: response.text,
          messageDate: responseDate,
          messageTime: response.time,
          type: response.role === "confirmacion" ? "confirmacion" : response.role === "seguimiento" ? "seguimiento" : "respuesta",
          contentHash: sha256(messageHash, response.sender, response.text),
          isStaff: true,
        }).onConflictDoNothing().returning({ id: incidentMessages.id });
        if (!storedMessage) continue;
        await tx.insert(incidentResponses).values({
          incidentId: incident.id,
          messageId: storedMessage.id,
          responderName: response.sender,
          responseText: response.text,
          responseDate: responseDate,
          responseTime: response.time,
          associationConfidence: response.score >= 6 ? "alta" : response.score >= 3 ? "media" : "baja",
          isUncertain: response.uncertain,
        });
        responsesSaved += 1;
      }

      await tx.insert(incidentHistory).values({
        incidentId: incident.id,
        actorId: actorId ?? null,
        action: "incidencia_importada",
        newValue: {
          categoryLabel: row.categoryLabel,
          confidence: row.confidence,
          explanation: row.explanation,
          sourceName: preview.sourceName,
          suggestedStatus: row.suggestedStatus,
          contextualization: row.contextualization || null,
          teacherId: row.teacherId ?? null,
          responsesAssociated: row.responses.length,
        },
        notes: originalMessage ? "Registro creado desde una importación revisada." : "Registro creado; el mensaje original ya existía.",
      });
      saved += 1;
    }
    await tx.update(chatImports).set({
      candidateCount: saved,
      duplicatesOmitted: duplicateMessages,
      rejectedCount: preview.candidates.length - confirmed.length,
    }).where(eq(chatImports.id, createdImport.id));
    return { analyzed: preview.totalMessages, detected: preview.candidates.length, confirmed: confirmed.length, saved, duplicateMessages, rejected: preview.candidates.length - confirmed.length, responsesSaved, importId: createdImport.id, duplicateConversation: false };
  });

  if (result.duplicateConversation) {
    throw errors.conflict("Esta conversación ya fue importada. No se guardaron registros duplicados.", result);
  }
  // Las correcciones se registran sólo tras un commit válido; nunca crean reglas globales.
  await recordCategoryFeedback(finalRows, byId, actorId, result.importId);
  return result;
}
