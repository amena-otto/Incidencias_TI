import type { Msg } from "../importer/whatsapp.js";
import { canonicalize, extractLocation, normalize, sharedTokens } from "../lib/text.js";
import { detectRole, isExplicitSolution, isStaffSender, type MessageRole } from "./message-kind.js";

export type RelatedResponse = {
  id: string;
  position: number;
  sender: string;
  text: string;
  date: string;
  time: string;
  role: MessageRole;
  score: number;
  uncertain: boolean;
  isStaff: boolean;
};

export type Correlation = {
  contextualization: string;
  responses: RelatedResponse[];
  solutionEvidence: RelatedResponse | null;
  suggestedStatus: "pendiente" | "en_atencion" | "resuelto";
  uncertain: boolean;
  explanation: string;
  tiAttendance: boolean;
  tiAttendanceReason: string;
};

type Options = {
  staffNames: ReadonlySet<string>;
  windowMinutes: number;
  tiStaffNames?: ReadonlySet<string>;
};

function minutesBetween(a: Msg, b: Msg): number {
  return (b.date.getTime() - a.date.getTime()) / 60_000;
}

function shortDate(message: Msg): string {
  const [, month, day] = message.dateString.split("-");
  return `${day}/${month}`;
}

function relevance(report: Msg, candidate: Msg, staff: boolean, staffNames: ReadonlySet<string>): number {
  const tokens = sharedTokens(report.text, candidate.text);
  const locationMatch = Boolean(extractLocation(report.text) && extractLocation(report.text) === extractLocation(candidate.text));
  const senderFirst = normalize(report.sender).split(" ").find((part) => part.length > 3) ?? "";
  const mention = senderFirst.length > 0 && normalize(candidate.text).includes(senderFirst);
  const role = detectRole(candidate, staffNames);
  const proximity = candidate.position - report.position <= 2 ? 1 : 0;

  return (staff ? 3 : 0)
    + Math.min(tokens.length, 3) * 2
    + (locationMatch ? 2 : 0)
    + (mention ? 2 : 0)
    + (role === "confirmacion" ? 2 : 0)
    + proximity;
}

/**
 * Correlaciona una solicitud con respuestas, seguimientos y soluciones.
 * Una respuesta cercana en el tiempo NO se asocia automáticamente: se exige
 * identidad del personal, similitud, menciones o ubicación compartida.
 * Las soluciones sólo se infieren de lenguaje explícito.
 */
export function correlate(messages: Msg[], reportIndex: number, categoryLabel: string, options: Options): Correlation {
  const report = messages[reportIndex];
  const staffNames = options.staffNames;
  const responses: RelatedResponse[] = [];
  let concurrentReports = 0;

  for (let index = reportIndex + 1; index < messages.length; index += 1) {
    const candidate = messages[index];
    const elapsed = minutesBetween(report, candidate);
    if (elapsed > options.windowMinutes) break;
    if (elapsed < 0 || candidate.kind !== "chat") continue;

    const staff = isStaffSender(candidate.sender, staffNames);
    const role = detectRole(candidate, staffNames);
    const reportRole = detectRole(report, staffNames);

    if (!staff && candidate.sender !== report.sender && role === reportRole) {
      concurrentReports += 1;
      continue;
    }
    if (!staff && candidate.sender !== report.sender && role !== "confirmacion") continue;
    if (["comunicado", "agradecimiento", "multimedia", "sistema", "no_relacionado"].includes(role)) continue;

    const score = relevance(report, candidate, staff, staffNames);
    const tokens = sharedTokens(report.text, candidate.text);
    const locationMatch = Boolean(extractLocation(report.text) && extractLocation(report.text) === extractLocation(candidate.text));
    const senderFirst = normalize(report.sender).split(" ").find((part) => part.length > 3) ?? "";
    const mention = senderFirst.length > 0 && normalize(candidate.text).includes(senderFirst);
    const contentSignals = Math.min(tokens.length, 3) * 2 + (locationMatch ? 2 : 0) + (mention ? 2 : 0);
    const weakAcknowledgement = role === "ack" || (role === "seguimiento" && contentSignals === 0);
    // Un "ok" o un "me acerco" aislado no basta: se exige evidencia de contexto.
    const threshold = staff ? (weakAcknowledgement ? 6 : 3) : 5;
    if (score < threshold) continue;

    const uncertain = (concurrentReports > 0 && score < 8) || weakAcknowledgement;
    responses.push({
      id: candidate.id,
      position: candidate.position,
      sender: candidate.sender,
      text: candidate.text,
      date: candidate.dateString,
      time: candidate.time,
      role,
      score,
      uncertain,
      isStaff: staff,
    });
  }

  const solutionEvidence = responses.find((response) => response.role === "confirmacion" && isExplicitSolution(response.text)) ?? null;
  const initialResponse = responses.find((response) => ["seguimiento", "respuesta", "ack"].includes(response.role)) ?? null;
  const uncertain = responses.some((response) => response.uncertain);
  const tiStaff = options.tiStaffNames ?? staffNames;
  const attendance = responses.find((response) => response.isStaff
    && tiStaff.has(normalize(response.sender))
    && ["seguimiento", "respuesta", "ack", "confirmacion"].includes(response.role)
    && response.score >= 6) ?? null;
  const tiAttendance = Boolean(attendance);
  const tiAttendanceReason = attendance
    ? `Atención de personal TI vinculada (${attendance.sender}, ${attendance.time}): ${attendance.text.replace(/\s+/g, " ").slice(0, 160)}. No implica resolución.`
    : "";

  if (solutionEvidence) {
    const reportText = canonicalize(report.text);
    const isAttendance = categoryLabel.includes("Marcación y asistencia");
    if (isAttendance && /\bsalida\b/.test(reportText)) {
      return {
        contextualization: `Regularización de marcación de salida hecha (${shortDate(report)}, ${solutionEvidence.time}).`,
        responses,
        solutionEvidence,
        suggestedStatus: "resuelto",
        uncertain,
        tiAttendance,
        tiAttendanceReason,
        explanation: "Solución explícita detectada. Estado sugerido pendiente de validación humana.",
      };
    }
    if (isAttendance && /\b(?:ingreso|entrada)\b/.test(reportText)) {
      return {
        contextualization: `Regularización de marcación de entrada hecha (${shortDate(report)}, ${solutionEvidence.time}).`,
        responses,
        solutionEvidence,
        suggestedStatus: "resuelto",
        uncertain,
        tiAttendance,
        tiAttendanceReason,
        explanation: "Solución explícita detectada. Estado sugerido pendiente de validación humana.",
      };
    }
    return {
      contextualization: `Evidencia de solución (${shortDate(report)}, ${solutionEvidence.time}): ${solutionEvidence.text.replace(/\s+/g, " ").slice(0, 240)}`,
      responses,
      solutionEvidence,
      suggestedStatus: "resuelto",
      uncertain,
      tiAttendance,
      tiAttendanceReason,
      explanation: "Solución explícita detectada. Estado sugerido pendiente de validación humana.",
    };
  }

  if (initialResponse) {
    return {
      contextualization: `Respuesta inicial (${shortDate(report)}, ${initialResponse.time}): ${initialResponse.text.replace(/\s+/g, " ").slice(0, 240)}`,
      responses,
      solutionEvidence: null,
      suggestedStatus: "en_atencion",
      uncertain,
      tiAttendance,
      tiAttendanceReason,
      explanation: "Hay una respuesta institucional, pero no hay evidencia explícita de solución.",
    };
  }

  return {
    contextualization: "",
    responses,
    solutionEvidence: null,
    suggestedStatus: "pendiente",
    uncertain,
    tiAttendance,
    tiAttendanceReason,
    explanation: "Sin respuesta relacionada dentro de la ventana configurada.",
  };
}
