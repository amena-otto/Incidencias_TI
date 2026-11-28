import type { Msg } from "../importer/whatsapp.js";
import { canonicalize, normalize } from "../lib/text.js";

export type MessageRole =
  | "reporte"
  | "respuesta"
  | "seguimiento"
  | "confirmacion"
  | "ack"
  | "agradecimiento"
  | "comunicado"
  | "multimedia"
  | "sistema"
  | "no_relacionado";

const SOLUTION_VERB = "(?:solucionado|solucionada|soluciono|resuelto|resuelta|resolvio|regularizado|regularizo|regularizada|reparado|habilitado|corregido|abierto|conectado|cambiado|actualizado|configurado)";
const SOLUTION = new RegExp(`\\b(?:se|ya|listo|quedo)\\b.{0,50}\\b${SOLUTION_VERB}\\b|\\b${SOLUTION_VERB}\\b`, "i");
const FOLLOW_UP = /\b(?:se verifica|voy a verificar|voy a revisar|verificando|me acerco|me estoy acercando|ya voy|voy|en camino|revisando|estoy revisando|lo reviso|recepcionado|recibido|se estar[aá] coordinando|en un momento me acerco)\b/i;
const ACK = /\b(?:ok|okey|okay|listo|ya|entendido|aceptado|de acuerdo)\b/i;
const THANKS = /^\s*(?:muchas )?gracias\b|\bgracias por (?:reportar|informar|avizar|avisar)\b/i;
const BROADCAST = /\b(?:comunicado|se les comunica|se les recuerda|se les informa|recordatorio|tengan presente)\b/i;

/**
 * Confirmaciones cortas tipo "ok". Por sí solas NO prueban intervención de TI:
 * la correlación exige además identidad de personal y señales contextuales.
 */
export function isAcknowledgement(text: string): boolean {
  const canonical = canonicalize(text);
  return ACK.test(canonical) && canonical.split(" ").length <= 6 && !isExplicitSolution(text) && !FOLLOW_UP.test(canonical);
}

export function isStaffSender(sender: string, staffNames: ReadonlySet<string>): boolean {
  return staffNames.has(normalize(sender));
}

export function isExplicitSolution(text: string): boolean {
  return SOLUTION.test(canonicalize(text));
}

export function isFollowUp(text: string): boolean {
  return FOLLOW_UP.test(canonicalize(text)) && !isExplicitSolution(text);
}

/** Distingue solicitudes, respuestas, seguimientos, soluciones y comunicados. */
export function detectRole(message: Msg, staffNames: ReadonlySet<string>): MessageRole {
  if (message.kind === "multimedia") return "multimedia";
  if (message.kind === "system" || message.kind === "deleted") return "sistema";
  const text = canonicalize(message.text);
  if (!text) return "no_relacionado";
  if (isExplicitSolution(message.text)) return "confirmacion";
  if (BROADCAST.test(text)) return "comunicado";
  if (THANKS.test(text)) return "agradecimiento";
  if (isAcknowledgement(message.text)) return "ack";
  const staff = isStaffSender(message.sender, staffNames);
  if (staff) return isFollowUp(message.text) ? "seguimiento" : "respuesta";
  if (FOLLOW_UP.test(text)) return "seguimiento";
  return "reporte";
}
