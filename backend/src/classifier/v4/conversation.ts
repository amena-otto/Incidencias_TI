import type { Msg } from "../../importer/whatsapp.js";
import { isAcknowledgement, isStaffSender } from "../message-kind.js";
import { normalizeForAnalysis } from "./normalize.js";
import type { ConversationAnalysis, ConversationStage, MessageLink } from "./types.js";

const SOLUTION = /\b(?:ya\s+(?:quedo|listo|solucionado|resuelto|proyecta|conecta|funciona)|se\s+(?:soluciono|resolvio|regularizo|habilito|restablecio|cambio|configuro)|solucionado|resuelto|restablecido|habilitado|regularizado)\b/i;
const TECHNICAL_ACTION = /\b(?:se\s+(?:ajusto|cambio|configuro|reinicie|conecto|habilito|regularizo|reparo)|ajuste|reinicie|cambie|configure|conecte|reparo|restableci)\b/i;
const LOCATION_REQUEST = /\b(?:en que aula|que aula|numero de aula|donde esta|donde se encuentra|ubicacion|piso|salon)\b/i;
const DISPLACEMENT = /\b(?:me acerco|me estoy acercando|ya voy|voy para alla|estoy llegando|en camino|me dirijo)\b/i;
const FOLLOW_UP = /\b(?:voy a revisar|voy a verificar|estoy verificando|estoy revisando|revisando|verificando|lo reviso|recepcionado|recibido|se coordina|en un momento)\b/i;

const STOPWORDS = new Set(["el", "la", "los", "las", "un", "una", "de", "del", "en", "y", "o", "para", "por", "mi", "su", "se", "no", "sin", "hay", "tengo", "necesito", "requiero", "solicito", "porfavor", "favor"]);

export type ConversationOptions = {
  staffNames: ReadonlySet<string>;
  tiStaffNames: ReadonlySet<string>;
  windowMinutes: number;
  topicTerms?: readonly string[];
};

function meaningfulTokens(message: Msg): string[] {
  return [...new Set(normalizeForAnalysis(message.text).tokens.filter((token) => token.length > 2 && !STOPWORDS.has(token)))];
}

function stageFor(message: Msg, report: Msg, options: ConversationOptions): ConversationStage {
  const normalized = normalizeForAnalysis(message.text);
  const text = normalized.canonical;
  const staff = isStaffSender(message.sender, options.staffNames);
  const requester = message.sender === report.sender;

  if ((SOLUTION.test(message.text) || /\b(?:ya quedo|ya proyecta|ya conecta|ya funciona)\b/i.test(text)) && (staff || requester)) return "confirmacion_solucion";
  if (TECHNICAL_ACTION.test(text)) return "accion_tecnica";
  if (LOCATION_REQUEST.test(text)) return "solicitud_ubicacion";
  if (DISPLACEMENT.test(text)) return "desplazamiento";
  if (FOLLOW_UP.test(text) || isAcknowledgement(message.text)) return "seguimiento";
  if (staff) return "respuesta_ti";
  if (/\b(?:gracias|comunicado|recordatorio|se les informa)\b/i.test(text)) return "no_relacionado";
  return "reporte";
}

function stageWeight(stage: ConversationStage): number {
  if (stage === "accion_tecnica" || stage === "confirmacion_solucion") return 2;
  if (stage === "respuesta_ti" || stage === "desplazamiento") return 1;
  return 0;
}

function describeStage(stage: ConversationStage): string {
  const labels: Record<ConversationStage, string> = {
    reporte: "reporte",
    respuesta_ti: "respuesta de personal",
    solicitud_ubicacion: "solicitud de ubicación",
    desplazamiento: "confirmación de desplazamiento",
    accion_tecnica: "acción técnica",
    seguimiento: "seguimiento",
    confirmacion_solucion: "confirmación de solución",
    no_relacionado: "no relacionado",
  };
  return labels[stage];
}

function toLink(
  message: Msg,
  stage: ConversationStage,
  score: number,
  uncertain: boolean,
  evidence: string[],
  flags: { topic: boolean; location: boolean; author: boolean },
  options: ConversationOptions,
): MessageLink {
  const staff = isStaffSender(message.sender, options.staffNames);
  return {
    messageId: message.id,
    position: message.position,
    sender: message.sender,
    text: message.text,
    date: message.dateString,
    time: message.time,
    stage,
    score,
    uncertain,
    isStaff: staff,
    isTiStaff: staff && options.tiStaffNames.has(normalizeForAnalysis(message.sender).tokens.join(" ")),
    evidence,
    topicEvidence: flags.topic,
    locationEvidence: flags.location,
    authorEvidence: flags.author,
  };
}

/**
 * Correlaciona por autor, tema, secuencia, aula/dispositivo y tiempo absoluto.
 * Una respuesta cercana sin esas señales se conserva como no vinculada.
 */
export function analyzeConversation(
  messages: readonly Msg[],
  reportIndex: number,
  options: ConversationOptions,
): ConversationAnalysis {
  const report = messages[reportIndex];
  const reportNorm = normalizeForAnalysis(report.text);
  const reportTokens = meaningfulTokens(report);
  const topicTerms = (options.topicTerms ?? []).flatMap((term) => normalizeForAnalysis(term).tokens);
  const vocabulary = [...new Set([...reportTokens, ...topicTerms.filter((token) => token.length > 2 && !STOPWORDS.has(token))])];
  const requesterFirst = reportNorm.tokens.find((token) => !STOPWORDS.has(token) && token.length > 3) ?? "";
  const links: MessageLink[] = [];
  const previousContext: MessageLink[] = [];
  let concurrentReports = 0;

  for (let index = reportIndex - 1; index >= 0 && reportIndex - index <= 3; index -= 1) {
    const prior = messages[index];
    if (prior.kind !== "chat") continue;
    const shared = meaningfulTokens(prior).filter((token) => vocabulary.includes(token));
    if (shared.length < 2) continue;
    previousContext.push(toLink(
      prior,
      "reporte",
      shared.length,
      false,
      [`Contexto previo (posición ${prior.position}) comparte: ${shared.slice(0, 3).join(", ")}.`],
      { topic: true, location: false, author: false },
      options,
    ));
  }
  previousContext.reverse();

  for (let index = reportIndex + 1; index < messages.length; index += 1) {
    const candidate = messages[index];
    const elapsedMinutes = (candidate.date.getTime() - report.date.getTime()) / 60_000;
    if (elapsedMinutes > options.windowMinutes) break;
    if (elapsedMinutes < 0 || candidate.kind !== "chat") continue;

    const stage = stageFor(candidate, report, options);
    const staff = isStaffSender(candidate.sender, options.staffNames);
    const tiStaff = staff && options.tiStaffNames.has(normalizeForAnalysis(candidate.sender).tokens.join(" "));
    const candidateNorm = normalizeForAnalysis(candidate.text);
    if (!candidateNorm.tokens.length) continue;
    if (["comunicado", "no_relacionado"].includes(stage)) continue;
    if (!staff && candidate.sender !== report.sender && stage === "reporte") {
      concurrentReports += 1;
      continue;
    }

    const shared = meaningfulTokens(candidate).filter((token) => vocabulary.includes(token));
    const topicEvidence = shared.length > 0;
    const locationEvidence = Boolean(reportNorm.location && candidateNorm.location === reportNorm.location);
    const deviceEvidence = Boolean(reportNorm.device && candidateNorm.device === reportNorm.device);
    const mention = Boolean(requesterFirst && candidateNorm.tokens.includes(requesterFirst));
    const contentSignals = Math.min(shared.length, 3) * 2 + (locationEvidence ? 3 : 0) + (deviceEvidence ? 2 : 0) + (mention ? 2 : 0);
    const weak = contentSignals < 2 && (stage === "seguimiento" || stage === "no_relacionado");

    const evidence: string[] = [];
    let score = 0;
    if (staff) {
      score += 3;
      evidence.push(`Autor «${candidate.sender}» reconocido como personal.`);
    } else if (candidate.sender === report.sender) {
      score += 1;
      evidence.push(`Autor «${candidate.sender}» coincide con quien reportó.`);
    } else {
      evidence.push(`Autor «${candidate.sender}» no reconocido como personal TI.`);
    }
    if (tiStaff) {
      score += 2;
      evidence.push("Autor incluido en el directorio de personal TI.");
    }
    if (shared.length) {
      score += Math.min(shared.length, 3) * 2;
      evidence.push(`Tema compartido: ${shared.slice(0, 4).join(", ")}.`);
    }
    if (locationEvidence) {
      score += 3;
      evidence.push(`Ubicación coincidente: ${reportNorm.location}.`);
    }
    if (deviceEvidence) {
      score += 2;
      evidence.push(`Dispositivo coincidente: ${reportNorm.device}.`);
    }
    if (mention) {
      score += 2;
      evidence.push(`Se menciona a «${requesterFirst}».`);
    }
    score += stageWeight(stage);
    if (candidate.position - report.position <= 2) score += 1;
    score += 1; // diferencia temporal válida y dentro de la ventana
    if (weak) score -= 2;

    const threshold = tiStaff ? 5 : staff ? 7 : 9;
    if (score < threshold || (!topicEvidence && !locationEvidence && !deviceEvidence && !mention)) continue;
    const uncertain = weak || (concurrentReports > 0 && score < 9) || score < threshold + 2;
    evidence.push(`Etapa ${describeStage(stage)}; puntuación ${score}/umbral ${threshold}; diferencia temporal ${Math.round(elapsedMinutes)} min.`);
    links.push(toLink(candidate, stage, score, uncertain, evidence, { topic: topicEvidence, location: locationEvidence, author: staff || candidate.sender === report.sender }, options));
  }

  const technicalAction = links.find((link) => TECHNICAL_ACTION.test(normalizeForAnalysis(link.text).canonical) || link.stage === "accion_tecnica") ?? null;
  const solution = links.find((link) => (SOLUTION.test(normalizeForAnalysis(link.text).canonical) || link.stage === "confirmacion_solucion") && link.authorEvidence) ?? null;
  const attendance = links.find((link) => link.isTiStaff && ["respuesta_ti", "seguimiento", "desplazamiento", "accion_tecnica", "confirmacion_solucion"].includes(link.stage) && link.score >= 6) ?? null;
  const followUp = links.find((link) => ["seguimiento", "desplazamiento", "respuesta_ti"].includes(link.stage)) ?? null;
  const displacement = links.find((link) => link.stage === "desplazamiento" || DISPLACEMENT.test(link.text)) ?? null;
  const requestLocation = links.find((link) => link.stage === "solicitud_ubicacion") ?? null;
  const uncertain = links.some((link) => link.uncertain);
  const tiAttendanceReason = attendance
    ? `Atención TI vinculada (${attendance.sender}, ${attendance.date} ${attendance.time}): ${attendance.text.replace(/\s+/g, " ").slice(0, 160)}.`
    : "";

  const suggestedStatus = solution ? "resuelto" : technicalAction || attendance || followUp ? "en_atencion" : "pendiente";
  const explanation = links.length
    ? `${links.length} mensaje(s) vinculados con evidencia. ${solution ? "Hay confirmación de solución." : "No hay confirmación de solución."}`
    : "No se vincularon mensajes: la cercanía temporal sin autor, tema o ubicación no es suficiente.";

  return {
    reportId: report.id,
    reportPosition: report.position,
    links,
    requestLocation,
    displacement,
    technicalAction,
    followUp,
    attendance,
    solution,
    previousContext,
    suggestedStatus,
    uncertain,
    tiAttendance: Boolean(attendance),
    tiAttendanceReason,
    explanation,
  };
}
