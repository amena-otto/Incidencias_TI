import type { Msg } from "../importer/whatsapp.js";
<<<<<<< Updated upstream
=======
import type { Confidence, RequestType } from "../db/schema.types.js";
import { canonicalize, normalize } from "../lib/text.js";
import { CATEGORY_NAMES, OTHER_CATEGORY, requestTypeFor } from "./categories.js";
import { detectRole, type MessageRole } from "./message-kind.js";
import { correlate, type Correlation } from "./context.js";
import { analyzeTiScope, type ScopeStatus, type TiScope } from "./ti-scope.js";
>>>>>>> Stashed changes

export type Candidate = {
  date: string;
  time: string;
  requesterName: string;
  originalMessage: string;
  categoryLabel: string;
  contextualization: string;
  confidence: "alta" | "media" | "baja";
  selected: boolean;
  reason: string;
  scope: TiScope;
  inclusionStatus: ScopeStatus;
  inclusionReason: string;
  excluded: boolean;
};

type Rule = {
  category: string;
  patterns: RegExp[];
  reason: string;
};

const RULES: Rule[] = [
  {
    category: "Asistencia · Marcación y asistencia",
    reason: "No puede registrar, firmar o visualizar una marcación",
    patterns: [
<<<<<<< Updated upstream
      /\bno puedo marcar\b/,
      /\bno marque\s+(?:mi\s+)?(?:salida|ingreso|entrada)\b/,
      /\bproblemas?\s+para\s+ingresar\s+(?:mi\s+)?asistencia\b/,
      /\bno (?:me )?(?:permite|deja|figura|aparece)\b.{0,40}\b(?:marcar|marcaci[oó]n|asistencia|ingreso|salida)\b/,
      /\b(?:no|qno)\s+(?:logr[eé]|pude)\s+(?:marcar|firmar|registrar)\b/,
      /\bno marqué\s+(?:mi\s+)?(?:salida|ingreso|entrada)\b/,
      /\bproblemas?\s+(?:para|con)\s+(?:marcar|marcaci[oó]n|registrar asistencia)\b/,
      /\bno puedo ingresar mi asistencia\b/,
      /\bno figura\b.{0,30}\b(?:marcar|ingreso|asistencia)\b/,
      /\bno se puede marcar\b/,
      /\bno aparece (?:la opci[oó]n|el bot[oó]n|recuadro)\b.{0,30}\b(?:finalizar|marcar)\b/,
    ],
  },


  {
    category: "TI · Redes e Internet",
    reason: "Problema de conexión, cobertura, lentitud o red",
    patterns: [
      /\bproblemas?\s+(?:con|para)\s+(?:conectarme|conectarse|conectar|el internet|la red|wifi|wi fi)\b/,
      /\bno puedo conect(?:arme|ar)\b/,
      /\b(?:solicito|pido|necesito) apoyo para conectarme\b.{0,35}\binternet\b/,
      /\b(?:internet|wifi|wi fi|conectividad|conexi[oó]n)\b.{0,65}\b(?:lento|lenta|fallas?|problemas?|intermitente|inestable|no funciona|no puedo|no permite|sin servicio|muy bajo|s[uú]per lento)\b/,
      /\b(?:fallas?|problemas?|dificultad)\b.{0,55}\b(?:internet|wifi|red|conectividad|conexi[oó]n)\b/,
      /\bno (?:hay|tengo|cuenta con)\s+(?:internet|wifi|señal|cobertura)\b/,
      /\bno (?:tengo|hay) (?:conexi[oó]n|servicio) (?:a )?(?:internet|wifi)?\b/,
=======
      [/\b(?:no tengo|no hay|sin)\s+(?:conexion|internet|wifi|senal|cobertura)\b/, 4],
      [/\b(?:internet|wifi|conexion|red|conectividad)\b.{0,55}\b(?:no funciona|falla|fallas|lento|intermitente|inestable|no sirve|muy bajo)\b/, 4],
      [/\b(?:problemas?|dificultad|fallas?)\b.{0,40}\b(?:internet|wifi|red|conexion|conectividad)\b/, 3],
      [/\bno puedo conect(?:ar|arme)\b/, 3],
      // "Solicito apoyo para conectarme al Internet aula 203" es una falla concreta.
      [/\b(?:conectarme|conectarse|conectar)\b.{0,35}\b(?:internet|wifi|red)\b/, 4],
      [/\b(?:internet|wifi|red)\b.{0,40}\b(?:aula|salon|laboratorio|pabellon)\b/, 3],
>>>>>>> Stashed changes
    ],
  },
  {
    category: "TI · Equipos audiovisuales",
    reason: "Incidencia en proyector, TV, pantalla, HDMI, audio o control",
    patterns: [
<<<<<<< Updated upstream
      /\b(?:proyector|retroproyector|televisor|pantalla|tv|hdmi)\b.{0,65}\b(?:no enciende|no funciona|falla|fallando|problema|dificultad|apoyo|ayuda|no puedo|no se puede)\b/,
      /\b(?:problemas?|dificultad|apoyo|ayuda)\b.{0,55}\b(?:proyector|televisor|pantalla|tv|hdmi|proyecci[oó]n)\b/,
      /\b(?:necesito|requiere|solicito|falta|no hay)\b.{0,35}\b(?:control remoto|control del tv|control para encender|parlante)\b/,
      /\bno hay control\b.{0,35}\b(?:pantalla|tv|televisor|aula)\b/,
      /\b(?:laptop|computadora)\b.{0,45}\bno se puede conectar\b.{0,25}\bparlante\b/,
=======
      [/\b(?:no funciona|no enciende|falla|fallando|problemas?|dificultad)\b.{0,40}\b(?:proyector|pantalla|televisor|tv|hdmi|parlante|audio)\b/, 4],
      [/\b(?:proyector|pantalla|televisor|hdmi|parlante|proyeccion)\b.{0,45}\b(?:no funciona|no enciende|falla|no se puede|no hay)\b/, 4],
      [/\bapoyo en (?:el )?aula\b.{0,30}\bproblemas? (?:con|de)\b.{0,20}\bproyector\b/, 4],
      [/\b(?:falta|necesito|solicito)\b.{0,30}\b(?:control remoto|cable hdmi|parlante)\b/, 3],
>>>>>>> Stashed changes
    ],
  },
  {
    category: "TI · Hardware y periféricos",
    reason: "Falla o solicitud de revisión/cambio de laptop o equipo",
    patterns: [
      /\b(?:inconvenientes?|problemas?|fallas?|falla|no funciona|no enciende)\b.{0,45}\b(?:laptop|computadora|teclado|mouse|monitor|equipo)\b/,
      /\b(?:laptop|computadora|teclado|mouse|monitor)\b.{0,55}\b(?:presenta fallas?|está fallando|no funciona|no enciende|no responde|no puedo|cambio|revisi[oó]n)\b/,
      /\b(?:cambio|cambiar|reemplazo|reemplazar)\s+(?:de\s+)?laptop\b/,
      /\bno s[eé] qu[eé] le pas[oó]\s+a\s+mi\s+(?:laptop|kaptop)\b/,
    ],
  },

  {
    category: "TI · Software y plataformas",
    reason: "Problema de acceso, enlace, evaluación o plataforma",
    patterns: [
<<<<<<< Updated upstream
      /\bno puedo (?:ingresar|ingresar a|entrar|acceder)\b/,
      /\bno (?:me )?(?:aparece|figura|encuentro)\b.{0,45}\b(?:link|enlace|bot[oó]n|recuadro|evaluaci[oó]n|plataforma|sistema)\b/,
      /\b(?:jaguar|plataforma|sistema|evaluaci[oó]n|evaluaciones|correo institucional)\b.{0,60}\b(?:no puedo|no permite|cerrad[ao]s?|fallas?|problemas?|no aparece|no encuentro|bloquead[ao]s?)\b/,
      /\b(?:evaluaciones|evaluaci[oó]n)\b.{0,35}\b(?:cerrad[ao]s?|no habilitad[ao]s?)\b/,
      /\bno me permite (?:ingresar|acceder|finalizar)\b/,
=======
      [/\bno puedo (?:ingresar|entrar|acceder) (?:a |al |la )?(?:jaguar|plataforma|sistema|correo|evaluacion)\b/, 4],
      [/\bno puedo ingresar\b.{0,35}\bjaguar\b/, 4],
      [/\b(?:jaguar|plataforma|sistema|correo institucional|evaluaciones?)\b.{0,50}\b(?:no funciona|no puedo|no permite|cerradas?|bloqueadas?|fallas?|no aparece|no encuentro)\b/, 4],
      [/\bevaluaciones?\b.{0,30}\b(?:cerradas?|no habilitadas?)\b/, 3],
>>>>>>> Stashed changes
    ],
  },
  {
    category: "TI · Impresoras",
    reason: "Problema de impresión o impresora",
    patterns: [
<<<<<<< Updated upstream
      /\b(?:impresora|imprimir|impresi[oó]n|t[oó]ner|tinta)\b.{0,55}\b(?:no funciona|no imprime|atascad[ao]|falla|problema|ayuda|apoyo)\b/,
      /\b(?:problemas?|fallas?)\b.{0,35}\b(?:impresora|impresi[oó]n)\b/,
=======
      [/\b(?:impresora|imprimir|impresion|tinta|toner)\b.{0,45}\b(?:no funciona|no imprime|atascado|falla|problema)\b/, 4],
      [/\b(?:problemas?|fallas?)\b.{0,25}\b(?:impresora|impresion)\b/, 3],
    ],
  },
  {
    category: "Asistencia · Marcación y asistencia",
    patterns: [
      [/\bno puedo marcar\b/, 4],
      [/\bno (?:marque|logre|pude|puedo) (?:mi )?(?:firmar|marcar)\b.{0,25}\b(?:salida|ingreso|entrada)\b/, 4],
      [/\bno pude marcacion (?:mi )?(?:salida|ingreso|entrada)\b/, 4],
      [/\bno (?:logre|pude) marcacion (?:mi )?(?:salida|ingreso)\b/, 4],
      [/\bno aparece (?:la opcion|el boton)\b.{0,30}\b(?:salida|marcar)\b/, 3],
      [/\bproblemas? (?:para|con) (?:marcar|marcacion|asistencia)\b/, 3],
      [/\bno figura\b.{0,30}\b(?:marcacion|ingreso|asistencia|salida)\b/, 3],
>>>>>>> Stashed changes
    ],
  },
  {
    category: "Infraestructura · Electricidad y mantenimiento",
    reason: "Falla de corriente, tomacorriente, iluminación o mantenimiento",
    patterns: [
<<<<<<< Updated upstream
      /\b(?:tomacorrientes?|enchufes?|corriente|electricidad|cuchilla|iluminaci[oó]n)\b.{0,65}\b(?:cambio|fallas?|problemas?|no hay|no funciona|revisi[oó]n|urgente|dificulta)\b/,
      /\b(?:problemas?|fallas?)\s+(?:de|con)\s+(?:corriente|electricidad|luz)\b/,
      /\b(?:ventilador|escritorio|mobiliario)\b.{0,45}\b(?:roto|dañado|cambio|reparaci[oó]n|no funciona)\b/,
=======
      [/\b(?:tomacorriente|enchufe|corriente|electricidad|luz|iluminacion)\b.{0,50}\b(?:no funciona|falla|no hay|problema|cambio|revision)\b/, 4],
      [/\b(?:no hay|sin|no funciona|falla|problema)\b.{0,50}\b(?:tomacorriente|enchufe|corriente|electricidad|luz|iluminacion)\b/, 4],
      [/\b(?:ventilador|escritorio|mobiliario)\b.{0,35}\b(?:roto|danado|cambio|reparacion|no funciona)\b/, 3],
>>>>>>> Stashed changes
    ],
  },
  {
    category: "Operaciones · Apertura y acceso a ambientes",
    reason: "Solicitud de apertura o acceso a aula, laboratorio o baño",
    patterns: [
      /\b(?:aperturar|apertura|abrir|abran)\b.{0,65}\b(?:laboratorio|aula|baños?|lab)\b/,
      /\b(?:laboratorio|aula|baños?|lab\.?\s*[a-záéíóú0-9 -]*)\b.{0,45}\b(?:est[aá] cerrado|no est[aá] abierto|no est[aá] abierta|inhabilitad[ao])\b/,
      /\bno est[aá] abierto\b.{0,35}\b(?:laboratorio|aula|baños?)\b/,
    ],
  },
  {
    category: "Operaciones · Mobiliario y materiales",
    reason: "Solicitud o reporte de sillas, taburetes, controles o materiales",
    patterns: [
      /\b(?:faltan?|necesito|solicito|facilitar|alcanzar|reponer|cambiar)\b.{0,60}\b(?:sillas?|taburetes?|biopacks?|materiales?|escritorios?|controles?)\b/,
      /\b(?:sillas?|taburetes?|biopacks?|materiales?|escritorios?)\b.{0,55}\b(?:faltan?|necesito|solicito|dañad[ao]s?|mal estado)\b/,
      /\b(?:pedido|solicitud)\s+de\s+(?:materiales|biopacks|sillas)\b/,
      /\bse encontr[oó]\s+(?:silla|taburete)\s+en\s+(?:ese|mal)\s+estado\b/,
    ],
  },
  {
    category: "Operaciones · Programación de laboratorios",
    reason: "Envío, consulta o solicitud de programación de laboratorio",
    patterns: [
      /\b(?:env[ií]o|remito|solicitud|pedido)\b.{0,55}\b(?:programaci[oó]n|rol|laboratorios?)\b/,
      /\b(?:solicitud|pedido)\s+de\s+laboratorio\b/,
      /\b(?:oportunidad|plazo)\s+de\s+enviar\s+(?:solicitud|programaci[oó]n)\s+de\s+laboratorio\b/,
    ],
  },
  {
    category: "Operaciones · Limpieza y ambiente",
    reason: "Solicitud de limpieza o reporte de condiciones del ambiente",
    patterns: [
      /\b(?:personal de limpieza|servicio de limpieza|enviar al personal de limpieza)\b/,
      /\b(?:mucho ruido|generando mucho ruido|ruido por los trabajos)\b/,
    ],
  },
  {
    category: "Seguridad · Salud y ambiente",
    reason: "Reporte de riesgo sanitario, plagas o incidente con material peligroso",
    patterns: [
      /\b(?:derrame de mercurio|mercurio|term[oó]metro de mercurio)\b/,
      /\b(?:zancudos|dengue|picadura)\b.{0,90}\b(?:estudiantes|laboratorio|instituto|molestias)\b/,
    ],
  },
];

const STAFF_NAMES = new Set([
  "OTTO TONSMANN",
  "ABEL SISTEMAS",
  "GIULLIANO OTTO",
  "JULIO OTTO",
  "ROGER MORI CURWEN",
]);
const STAFF_SENDERS_NORMALIZED = new Set(["+51923977337", "+51968246054", "+51977278918"]);

<<<<<<< Updated upstream
=======
export type Classification = {
  categoryLabel: string;
  confidence: Confidence;
  explanation: string;
  matchedCategories: string[];
  ambiguous: boolean;
  score: number;
  selected: boolean;
  scope: TiScope;
  mixed: boolean;
  inclusionStatus: ScopeStatus;
  inclusionReason: string;
};
>>>>>>> Stashed changes

const NON_REQUEST_PATTERNS = [
  /\bgracias por (?:reportar|informar)\b/,
  /\b(?:recepcionado|recibido)\b/,
  /\bme estoy acercando\b/,
  /\bme acerco\b/,
  /\bse solucion[oó]\b/,
  /\bse resolvi[oó]\b/,
  /\bse regulariz[oó]\b/,
  /\bse le marcar[aá]\b/,
  /\bse abri[oó]\b/,
  /\bse conect[oó]\b/,
  /\bse cambi[oó]\b/,
  /\bse habilit[oó]\b/,
  /\bse estar[aá] coordinando\b/,
  /\bcomunicado\b/,
  /\bse les comunica\b/,
  /\bse les recuerda\b/,
  /\bdocente .{0,55} aun no (?:est[aá]|llega)\b/,
  /\bingresa a (?:aula|laboratorio|c[oó]mputo)\b/,
];

const SOLUTION_PATTERNS = [
  /\bse soluciono\b/,
  /\bse resolvio\b/,
  /\bproblema .{0,30} solucionado\b/,
  /\bse regularizo\b/,
  /\bse le regularizo\b/,
  /\bse abrio\b/,
  /\bse conecto\b/,
  /\bse cambio\b/,
  /\bse habilito\b/,
  /\bse actualizo\b/,
  /\bse configuro\b/,
  /\bse agrego\b/,
  /\bse ayudo\b/,
];

<<<<<<< Updated upstream
function normalize(value: string): string {
  return value
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
=======
  // El perfil TI se evalúa ANTES de elegir candidatos. Las reglas concretas
  // compiten primero; "ayuda", "apoyo" y "urgente" sólo alimentan la regla
  // genérica cuando no hay evidencia tecnológica específica.
  const scope = analyzeTiScope(message.text);

  const scores = RULES.map((rule) => {
    const positive = rule.patterns.reduce((sum, [pattern, weight]) => sum + (pattern.test(text) ? weight : 0), 0);
    const negative = rule.negatives?.reduce((sum, pattern) => sum + (pattern.test(text) ? 2 : 0), 0) ?? 0;
    return { category: rule.category, score: Math.max(0, positive - negative) };
  }).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score);
>>>>>>> Stashed changes

function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function minutesBetween(a: Msg, b: Msg): number {
  const aDate = new Date(a.date.getFullYear(), a.date.getMonth(), a.date.getDate(), Number(a.time.slice(0, 2)), Number(a.time.slice(3, 5)));
  const bDate = new Date(b.date.getFullYear(), b.date.getMonth(), b.date.getDate(), Number(b.time.slice(0, 2)), Number(b.time.slice(3, 5)));
  return (bDate.getTime() - aDate.getTime()) / 60000;
}

function isStaff(sender: string): boolean {
  return STAFF_NAMES.has(normalize(sender).toLocaleUpperCase("es")) || STAFF_SENDERS_NORMALIZED.has(sender.replace(/[^0-9+]/g, ""));
}

function isNonRequest(message: Msg): boolean {
  const text = normalize(message.text);
  if (!text || text === "multimedia omitido" || text === "se elimino este mensaje") return true;
  if (NON_REQUEST_PATTERNS.some((pattern) => pattern.test(text))) return true;
  // Los teléfonos del grupo que publican controles de ingreso no son reportes del docente.
  if (/^\+?\d[\d\s-]{7,}$/.test(message.sender) && /\b(?:docente .{0,50} aun no|ingresa a aula|ingresa a laboratorio|ingresa a computo)\b/.test(text)) return true;
  return false;
}

function classifyCategory(message: Msg): { category: string; confidence: Candidate["confidence"]; reason: string } | null {
  if (isStaff(message.sender) || isNonRequest(message)) return null;

  const text = normalize(message.text);
  const matched = RULES.filter((rule) => rule.patterns.some((pattern) => pattern.test(text)));
  if (matched.length === 0) {
    const genericSupport = /\b(?:necesito|requiero|solicito|pido)\s+(?:su\s+)?(?:apoyo|ayuda)\b|\bapoyo\s+en\s+(?:el\s+)?aula\b/.test(text);
    if (!genericSupport) return null;
    return {
      category: "Otros · Solicitud de apoyo sin detalle",
      confidence: "baja",
<<<<<<< Updated upstream
      reason: "Se solicita apoyo, pero el mensaje no describe el problema",
=======
      explanation: "Se solicita apoyo, pero el mensaje no describe el problema. Requiere revisión humana.",
      matchedCategories: [OTHER_CATEGORY],
      ambiguous: false,
      score: 1,
      selected: false,
      scope,
      mixed: scope.mixed,
      inclusionStatus: scope.status === "no_pertinente" ? "no_pertinente" : "requiere_revision",
      inclusionReason: scope.reason,
>>>>>>> Stashed changes
    };
  }

  // En mensajes extensos de coordinación se exige una frase clara de solicitud.
  if (text.length > 450 && !/\b(?:solicito|por favor|necesito|no puedo|no me permite|apoyo|ayuda|problema|falla|favor)\b/.test(text)) {
    return null;
  }

  const selected = matched[0];
  const confidence: Candidate["confidence"] =
    matched.length > 1 ? "media" : text.length < 18 ? "baja" : "alta";

  return {
    category: selected.category,
    confidence,
<<<<<<< Updated upstream
    reason: `${selected.reason}${matched.length > 1 ? `; también coincide con: ${matched.slice(1).map((item) => item.category).join(", ")}` : ""}`,
  };
}

function findContextualization(messages: Msg[], index: number, category: string): string {
  const report = messages[index];
  const reportText = normalize(report.text);
  if (category === "Otros · Solicitud de apoyo sin detalle") return "";

  for (let i = index + 1; i < messages.length; i += 1) {
    const reply = messages[i];
    const elapsed = minutesBetween(report, reply);
    if (elapsed < 0 || elapsed > 90) break;
=======
    explanation,
    matchedCategories,
    ambiguous: close || scope.mixed,
    score: best.score,
    selected: confidence !== "baja" && !close && !scope.mixed && scope.status === "ti_detectada",
    scope,
    mixed: scope.mixed,
    inclusionStatus: scope.status,
    inclusionReason: scope.reason,
  };
}

export type ClassifyOptions = {
  staffNames?: ReadonlySet<string>;
  tiStaffNames?: ReadonlySet<string>;
  windowMinutes?: number;
  conversationKey?: string;
};

export function classify(messages: Msg[], options: ClassifyOptions = {}): Candidate[] {
  const staffNames = options.staffNames ?? new Set<string>();
  const tiStaffNames = options.tiStaffNames ?? staffNames;
  const windowMinutes = options.windowMinutes ?? 90;
>>>>>>> Stashed changes

    // Las respuestas del personal pueden intercalarse. Si escribe otro docente,
    // se corta la búsqueda para no adjudicar una solución al reporte equivocado.
    if (reply.sender !== report.sender && !isStaff(reply.sender)) break;

    if (!SOLUTION_PATTERNS.some((pattern) => pattern.test(normalize(reply.text)))) continue;

    if (category === "Asistencia · Marcación y asistencia") {
      if (/\b(?:salida|firmar mi salida|marcar salida)\b/.test(reportText)) {
        return `Regularización de marcación de salida hecha (${report.date.getDate().toString().padStart(2, "0")}/${(report.date.getMonth() + 1).toString().padStart(2, "0")}, ${reply.time}).`;
      }
      if (/\b(?:ingreso|entrada|marcar mi ingreso|marcar ingreso)\b/.test(reportText)) {
        return `Regularización de marcación de entrada hecha (${report.date.getDate().toString().padStart(2, "0")}/${(report.date.getMonth() + 1).toString().padStart(2, "0")}, ${reply.time}).`;
      }
    }

    return reply.text.replace(/\s+/g, " ").trim();
  }

  return "";
}

export function classify(messages: Msg[]): Candidate[] {
  return messages.flatMap((message, index) => {
    const result = classifyCategory(message);
    if (!result) return [];

<<<<<<< Updated upstream
=======
    const correlation = correlate(messages, index, result.categoryLabel, { staffNames, tiStaffNames, windowMinutes });
    let inclusionStatus: ScopeStatus = result.inclusionStatus;
    let excluded = false;
    let inclusionReason = result.inclusionReason;

    if (result.scope.status === "fuera_alcance") {
      if (correlation.tiAttendance) {
        inclusionStatus = "atencion_ti";
        inclusionReason = `${result.scope.reason} ${correlation.tiAttendanceReason}`;
      } else {
        excluded = true;
        inclusionReason = result.scope.reason;
      }
    }
    if (result.categoryLabel === OTHER_CATEGORY || result.scope.mixed) {
      inclusionStatus = "requiere_revision";
    }
    if (result.scope.status === "no_pertinente") excluded = true;

>>>>>>> Stashed changes
    return [{
      date: localDate(message.date),
      time: message.time,
      requesterName: message.sender,
      originalMessage: message.text,
      categoryLabel: result.category,
      contextualization: findContextualization(messages, index, result.category),
      confidence: result.confidence,
<<<<<<< Updated upstream
      selected: true,
      reason: result.reason,
=======
      explanation: result.explanation,
      matchedCategories: CATEGORY_NAMES.filter((name) => result.matchedCategories.includes(name)),
      ambiguous: result.ambiguous,
      role: detectRole(message, staffNames),
      suggestedStatus: correlation.suggestedStatus,
      responses: correlation.responses,
      associationUncertain: correlation.uncertain,
      selected: result.selected && !excluded && inclusionStatus === "ti_detectada",
      reason: result.explanation,
      scope: result.scope,
      inclusionStatus,
      inclusionReason,
      excluded,
>>>>>>> Stashed changes
    }];
  });
}
