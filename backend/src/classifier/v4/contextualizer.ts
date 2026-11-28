import type { Msg } from "../../importer/whatsapp.js";
import { normalizeForAnalysis } from "./normalize.js";
import type { Contextualization, ConversationAnalysis, DetectionResult, MessageLink } from "./types.js";

const TOPIC_LABELS: Record<string, string> = {
  "TI · Redes e Internet": "la conectividad",
  "TI · Equipos audiovisuales": "el equipo audiovisual",
  "TI · Hardware y periféricos": "el equipo y sus periféricos",
  "TI · Software y plataformas": "el acceso a la plataforma institucional",
  "TI · Impresoras": "la impresión",
  "Asistencia · Marcación y asistencia": "la marcación",
  "Infraestructura · Electricidad y mantenimiento": "el suministro eléctrico",
  "Operaciones · Apertura y acceso a ambientes": "la apertura del ambiente",
  "Operaciones · Mobiliario y materiales": "el mobiliario y los materiales",
  "Operaciones · Programación de laboratorios": "la programación del laboratorio",
  "Operaciones · Limpieza y ambiente": "la limpieza del ambiente",
  "Seguridad · Salud y ambiente": "la condición de seguridad",
  "Otros · Solicitud de apoyo sin detalle": "la solicitud de apoyo",
};

function clean(text: string, max = 240): string {
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

type Stamped = { date: string | Date; time: string; dateString?: string };

function dateOf(item: Stamped): string {
  if (item.dateString) return item.dateString;
  return typeof item.date === "string" ? item.date : item.date.toISOString().slice(0, 10);
}

function stamp(item: Stamped): string {
  return `${dateOf(item)} ${item.time}`;
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function validTime(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return Boolean(match && Number(match[1]) <= 23 && Number(match[2]) <= 59);
}

function evidenceOf(report: Msg, links: MessageLink[]): Contextualization["evidence"] {
  return [
    { messageId: report.id, position: report.position, date: report.dateString, time: report.time },
    ...links.map((link) => ({ messageId: link.messageId, position: link.position, date: link.date, time: link.time })),
  ];
}

/** Genera texto profesional sólo con hechos verificables y marca las inferencias. */
export function contextualize(
  report: Msg,
  analysis: ConversationAnalysis,
  detection: DetectionResult,
): Contextualization {
  const reportNorm = normalizeForAnalysis(report.text);
  const topic = TOPIC_LABELS[detection.categoryLabel] ?? clean(detection.categoryLabel.replace(/^.*·\s*/, ""));
  const place = reportNorm.location ? ` en ${reportNorm.location}` : "";
  const facts = [`Reporte de ${report.sender} (${stamp(report)}): «${clean(report.text, 180)}».`];
  const inferences: string[] = [];
  const used: MessageLink[] = [];
  const verifiedDates = [report, ...analysis.links].every((item) => validDate(dateOf(item)) && validTime(item.time));
  const ordered = verifiedDates && analysis.links.every((link) =>
    Date.parse(`${link.date}T${link.time}:00Z`) >= Date.parse(`${dateOf(report)}T${report.time}:00Z`));

  let text: string;
  if (analysis.solution) {
    const solution = analysis.solution;
    const action = analysis.technicalAction;
    used.push(solution);
    if (action && action !== solution) used.push(action);
    const author = solution.isTiStaff ? "El personal TI" : `El remitente ${solution.sender}`;
    if (action && action !== solution) {
      text = `Se registró la acción «${clean(action.text, 180)}» y ${author} confirmó «${clean(solution.text, 180)}». Se considera resuelta ${topic}${place} según la evidencia disponible.`;
    } else {
      text = `${author} confirmó «${clean(solution.text, 180)}». Se considera resuelta ${topic}${place} según la evidencia disponible.`;
    }
    facts.push(`Confirmación de ${solution.sender} (${stamp(solution)}): «${clean(solution.text, 180)}».`);
    if (solution.uncertain) inferences.push("La asociación de la confirmación tiene incertidumbre y requiere validación humana.");
  } else if (analysis.technicalAction) {
    const action = analysis.technicalAction;
    used.push(action);
    const author = action.isTiStaff ? "El personal TI" : `El remitente ${action.sender}`;
    text = `${author} registró «${clean(action.text, 180)}» respecto de ${topic}${place}. No se confirmó una solución.`;
    facts.push(`Acción registrada por ${action.sender} (${stamp(action)}): «${clean(action.text, 180)}».`);
    inferences.push("No se infirió resolución sin confirmación explícita.");
  } else if (analysis.attendance || analysis.followUp || analysis.displacement) {
    const link = analysis.attendance ?? analysis.displacement ?? analysis.followUp!;
    used.push(link);
    const author = link.isTiStaff ? "El personal TI" : `El remitente ${link.sender}`;
    const intent = link.stage === "desplazamiento" ? "indicó que acudiría a revisar" : link.stage === "solicitud_ubicacion" ? "solicitó la ubicación de" : "indicó que revisaría";
    text = `${author} ${intent} ${topic}${place} (${stamp(link)}). No se confirmó una solución.`;
    facts.push(`Atención registrada por ${link.sender} (${stamp(link)}): «${clean(link.text, 180)}».`);
    inferences.push("La atención se infiere de la respuesta vinculada; no implica resolución.");
    if (!link.isTiStaff) inferences.push("No se pudo confirmar que el remitente pertenezca al personal TI.");
  } else {
    text = `Se registró el reporte de ${report.sender} sobre ${topic}${place} (${stamp(report)}). No se identificó una atención vinculada dentro de la ventana configurada.`;
    inferences.push("La ausencia de respuesta vinculada no significa que el asunto esté resuelto.");
  }

  if (analysis.requestLocation && !used.includes(analysis.requestLocation)) used.push(analysis.requestLocation);
  if (!verifiedDates || !ordered) {
    inferences.push("Las fechas u horas no pudieron validarse como secuencia cronológica; no se afirma un orden entre mensajes.");
  }

  return {
    text,
    facts,
    inferences,
    evidence: evidenceOf(report, used),
    verifiedDates: verifiedDates && ordered,
    explanation: `${analysis.explanation} Contextualización construida con el reporte y ${used.length} mensaje(s) vinculados.`,
  };
}
