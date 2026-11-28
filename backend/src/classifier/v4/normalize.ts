import type { NormalizedMessage } from "./types.js";

/**
 * Normalización propia de V4. Nunca reescribe el mensaje original: el texto
 * canónico sólo se usa para análisis y trazabilidad.
 */
const EMOJI_WORDS: Array<[RegExp, string]> = [
  [/[\u{1F4F6}\u{1F4E1}]/gu, " senal "],
  [/[\u{1F4BB}\u{1F5A5}\u{FE0F}?]/gu, " laptop "],
  [/[\u{1F5A8}\u{FE0F}?]/gu, " monitor "],
  [/[\u{1F5B8}\u{FE0F}?]/gu, " impresora "],
  [/[\u{1F50C}\u{26A1}\u{FE0F}?]/gu, " corriente "],
  [/[\u{2705}\u{1F197}]/gu, " solucionado "],
  [/[\u{274C}\u{1F6AB}]/gu, " no "],
  [/[\u{1F4AC}\u{1F4AD}]/gu, " mensaje "],
];

const TYPOS: Record<string, string> = {
  kaptop: "laptop",
  laptopa: "laptop",
  laptos: "laptop",
  compu: "computadora",
  computador: "computadora",
  coneccion: "conexion",
  conectandose: "conectando",
  intermet: "internet",
  interneet: "internet",
  interneeet: "internet",
  interne: "internet",
  interner: "internet",
  internett: "internet",
  wiffi: "wifi",
  wifi: "wifi",
  proyektor: "proyector",
  proyectos: "proyector",
  proyeccion: "proyeccion",
  emprenta: "impresora",
  imprimiendose: "imprimiendo",
  escribe: "escribe",
  teclado: "teclado",
  mouse: "mouse",
  markacion: "marcacion",
  marcaje: "marcacion",
  asitencia: "asistencia",
  kiero: "quiero",
  qiero: "quiero",
  qno: "no",
  xfa: "por favor",
  xfavor: "por favor",
  urgente: "urgente",
  salon: "salon",
  laboratorio: "laboratorio",
  lab: "laboratorio",
  aula: "aula",
  profundidad: "profundidad",
};

const ABBREVIATIONS: Record<string, string> = {
  xfa: "por favor",
  xfavor: "por favor",
  "x favor": "por favor",
  lab: "laboratorio",
  compu: "computadora",
  prof: "profesor",
  aud: "audiovisual",
  tv: "televisor",
  hdmi: "hdmi",
  wifi: "wifi",
  pc: "pc",
  sjs: "sistema",
};

const NEGATIONS = new Set(["no", "sin", "ni", "nunca", "jamas", "tampoco"]);

const LOCATION = /\b(?:aula|salon|sala|laboratorio|lab|auditorio|oficina|piso)\s*(?:\d{1,3}[a-z]?)?\b/g;
const DEVICE = /\b(?:laptop|computadora|pc|cpu|proyector|retroproyector|pantalla|televisor|impresora|teclado|mouse|monitor|parlante|hdmi|cable|celular)\b/g;

function fold(value: string): string {
  return value
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function replaceEmojis(value: string): string {
  let result = value;
  for (const [pattern, word] of EMOJI_WORDS) result = result.replace(pattern, ` ${word} `);
  return result;
}

function normalizeWiFi(value: string): string {
  return value
    .replace(/\bwi[\s\-_.]*fi\b/g, "wifi")
    .replace(/\bwifi\b/g, "wifi");
}

function canonicalWords(value: string): string[] {
  let result = replaceEmojis(value);
  result = normalizeWiFi(fold(result));
  result = result.replace(/([a-z])\1{2,}/g, "$1");
  result = result.replace(/[^\p{L}\p{N}\s]/gu, " ");
  result = result.replace(/\s+/g, " ").trim();

  const words = result.split(" ").filter(Boolean).map((word) => {
    const corrected = TYPOS[word] ?? word;
    return ABBREVIATIONS[corrected] ?? corrected;
  });
  return words.flatMap((word) => word.split(" ")).filter(Boolean);
}

export function phraseTokens(phrase: string): string[] {
  return canonicalWords(phrase);
}

export function containsPhrase(tokens: readonly string[], phrase: string): boolean {
  const needle = phraseTokens(phrase);
  if (!needle.length || needle.length > tokens.length) return false;
  for (let index = 0; index <= tokens.length - needle.length; index += 1) {
    if (needle.every((token, offset) => tokens[index + offset] === token)) return true;
  }
  return false;
}

/** Normaliza para análisis conservando el texto original en `original`. */
export function normalizeForAnalysis(original: string): NormalizedMessage {
  const tokens = canonicalWords(original);
  const canonical = tokens.join(" ");
  const location = canonical.match(LOCATION)?.[0]?.trim() ?? null;
  const device = canonical.match(DEVICE)?.[0]?.trim() ?? null;
  const negations = tokens.filter((token) => NEGATIONS.has(token));
  const emojis = Array.from(original.matchAll(/[\p{Extended_Pictographic}]/gu), (match) => match[0]);

  return { original, canonical, tokens, negations, emojis, location, device };
}

export function isNegation(token: string): boolean {
  return NEGATIONS.has(token);
}
