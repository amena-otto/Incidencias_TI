import type { Msg } from "../importer/whatsapp.js";

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
    ],
  },
  {
    category: "TI · Equipos audiovisuales",
    reason: "Incidencia en proyector, TV, pantalla, HDMI, audio o control",
    patterns: [
      /\b(?:proyector|retroproyector|televisor|pantalla|tv|hdmi)\b.{0,65}\b(?:no enciende|no funciona|falla|fallando|problema|dificultad|apoyo|ayuda|no puedo|no se puede)\b/,
      /\b(?:problemas?|dificultad|apoyo|ayuda)\b.{0,55}\b(?:proyector|televisor|pantalla|tv|hdmi|proyecci[oó]n)\b/,
      /\b(?:necesito|requiere|solicito|falta|no hay)\b.{0,35}\b(?:control remoto|control del tv|control para encender|parlante)\b/,
      /\bno hay control\b.{0,35}\b(?:pantalla|tv|televisor|aula)\b/,
      /\b(?:laptop|computadora)\b.{0,45}\bno se puede conectar\b.{0,25}\bparlante\b/,
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
      /\bno puedo (?:ingresar|ingresar a|entrar|acceder)\b/,
      /\bno (?:me )?(?:aparece|figura|encuentro)\b.{0,45}\b(?:link|enlace|bot[oó]n|recuadro|evaluaci[oó]n|plataforma|sistema)\b/,
      /\b(?:jaguar|plataforma|sistema|evaluaci[oó]n|evaluaciones|correo institucional)\b.{0,60}\b(?:no puedo|no permite|cerrad[ao]s?|fallas?|problemas?|no aparece|no encuentro|bloquead[ao]s?)\b/,
      /\b(?:evaluaciones|evaluaci[oó]n)\b.{0,35}\b(?:cerrad[ao]s?|no habilitad[ao]s?)\b/,
      /\bno me permite (?:ingresar|acceder|finalizar)\b/,
    ],
  },
  {
    category: "TI · Impresoras",
    reason: "Problema de impresión o impresora",
    patterns: [
      /\b(?:impresora|imprimir|impresi[oó]n|t[oó]ner|tinta)\b.{0,55}\b(?:no funciona|no imprime|atascad[ao]|falla|problema|ayuda|apoyo)\b/,
      /\b(?:problemas?|fallas?)\b.{0,35}\b(?:impresora|impresi[oó]n)\b/,
    ],
  },
  {
    category: "Infraestructura · Electricidad y mantenimiento",
    reason: "Falla de corriente, tomacorriente, iluminación o mantenimiento",
    patterns: [
      /\b(?:tomacorrientes?|enchufes?|corriente|electricidad|cuchilla|iluminaci[oó]n)\b.{0,65}\b(?:cambio|fallas?|problemas?|no hay|no funciona|revisi[oó]n|urgente|dificulta)\b/,
      /\b(?:problemas?|fallas?)\s+(?:de|con)\s+(?:corriente|electricidad|luz)\b/,
      /\b(?:ventilador|escritorio|mobiliario)\b.{0,45}\b(?:roto|dañado|cambio|reparaci[oó]n|no funciona)\b/,
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

function normalize(value: string): string {
  return value
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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
      reason: "Se solicita apoyo, pero el mensaje no describe el problema",
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

    return [{
      date: localDate(message.date),
      time: message.time,
      requesterName: message.sender,
      originalMessage: message.text,
      categoryLabel: result.category,
      contextualization: findContextualization(messages, index, result.category),
      confidence: result.confidence,
      selected: true,
      reason: result.reason,
    }];
  });
}
