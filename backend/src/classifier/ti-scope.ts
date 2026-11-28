import { canonicalize } from "../lib/text.js";

/**
 * Perfil de importación «Incidencias TI». No modifica el catálogo de 13
 * categorías: sólo decide qué mensajes entran al flujo de importación.
 * Los asuntos ajenos se conservan como excluidos para revisión humana.
 */
export type ScopeStatus =
  | "ti_detectada"
  | "atencion_ti"
  | "requiere_revision"
  | "fuera_alcance"
  | "no_pertinente";

export type TiScope = {
  status: ScopeStatus;
  reason: string;
  tiTopics: string[];
  nonTiTopics: string[];
  mixed: boolean;
};

const TI_TOPICS: Array<[string, RegExp]> = [
  ["Redes e Internet", /\b(?:internet|wifi|conexion|conectividad|red|senal|cobertura)\b/],
  ["Equipos audiovisuales", /\b(?:proyector|proyeccion|retroproyector|pantalla|televisor|tv|hdmi|parlante|audio|control remoto)\b/],
  ["Hardware y periféricos", /\b(?:laptop|computadora|pc|cpu|teclado|mouse|monitor|equipo)\b/],
  ["Software y plataformas", /\b(?:jaguar|plataforma|sistema|correo institucional|software|evaluaciones?)\b/],
  ["Impresoras", /\b(?:impresora|imprimir|impresion|toner|tinta)\b/],
];

const NON_TI_TOPICS: Array<[string, RegExp]> = [
  ["Mobiliario y materiales", /\b(?:sillas?|taburetes?|biopacks?|mobiliario|materiales?)\b/],
  ["Limpieza y ambiente", /\b(?:limpieza|servicio de limpieza|ruido por los trabajos|generando ruido|obras)\b/],
  ["Apertura de ambientes", /\b(?:apertura|abrir|abran|aperturar)\b.{0,40}\b(?:laboratorio|aula|bano|ambiente)\b|\b(?:laboratorio|aula|bano)\b.{0,30}\b(?:cerrad[ao]|inhabilitad[ao])\b/],
  ["Programación de laboratorios", /\b(?:programacion|rol de laboratorio)\b/],
  ["Electricidad y mantenimiento", /\b(?:tomacorriente|enchufe|corriente|electricidad|iluminacion|ventilador)\b/],
  ["Marcación y asistencia", /\b(?:marcacion|firmar mi (?:salida|ingreso)|asistencia)\b/],
  ["Salud y ambiente", /\b(?:mercurio|dengue|zancudos|riesgo sanitario)\b/],
];

const BROADCAST = /\b(?:comunicado|se les comunica|se les informa|se les recuerda|recordatorio|tengan presente)\b/;
const THANKS = /^\s*(?:muchas )?gracias\b|\bgracias por (?:reportar|informar|avisar)\b/;
const SOCIAL = /^\s*(?:hola|buenos dias|buenas tardes|buenas noches|que tal|feliz)\b/;
const TECHNICAL_FAILURE = /\b(?:no funciona|no enciende|falla|fallas|fallando|no hay|no tengo|sin|lento|intermitente|inestable|no sirve|no responde|no imprime|atascado|bloqueado|bloqueada|error|problema|problemas|dificultad|conectar|conectarme|acceder|ingresar|verificar|revisar|ayuda|apoyo)\b/;

function matches(text: string, patterns: Array<[string, RegExp]>): string[] {
  return patterns.filter(([, pattern]) => pattern.test(text)).map(([topic]) => topic);
}

/**
 * Evalúa el alcance TI antes de marcar candidatos. Un mensaje con asuntos
 * mixtos mantiene su texto original y se envía a revisión: la parte TI se
 * detecta, pero la solicitud completa nunca se convierte automáticamente en
 * una incidencia del área ajena.
 */
export function analyzeTiScope(rawText: string): TiScope {
  const text = canonicalize(rawText);
  const tiTopics = matches(text, TI_TOPICS);
  const rawNonTi = matches(text, NON_TI_TOPICS);
  // "No puedo ingresar a Jaguar para marcar mi asistencia" es un problema de
  // acceso a plataforma: mencionar asistencia no lo vuelve un asunto de RRHH.
  const nonTiTopics = tiTopics.includes("Software y plataformas")
    ? rawNonTi.filter((topic) => topic !== "Marcación y asistencia")
    : rawNonTi;

  if (BROADCAST.test(text) || THANKS.test(text) || SOCIAL.test(text)) {
    return {
      status: "no_pertinente",
      reason: "Comunicado, agradecimiento o mensaje social sin solicitud TI.",
      tiTopics,
      nonTiTopics,
      mixed: false,
    };
  }

  if (tiTopics.length) {
    const mixed = nonTiTopics.length > 0;
    const hasFailure = TECHNICAL_FAILURE.test(text);
    if (mixed) {
      return {
        status: "requiere_revision",
        reason: `Asunto mixto: se detecta ${tiTopics.join(", ")} junto con ${nonTiTopics.join(", ")}. El mensaje original se conserva; revisión humana antes de guardar.`,
        tiTopics,
        nonTiTopics,
        mixed: true,
      };
    }
    if (!hasFailure) {
      return {
        status: "requiere_revision",
        reason: `Se menciona ${tiTopics.join(", ")} sin una falla concreta; requiere revisión humana.`,
        tiTopics,
        nonTiTopics,
        mixed: false,
      };
    }
    return {
      status: "ti_detectada",
      reason: `Incidencia TI detectada: ${tiTopics.join(", ")}.`,
      tiTopics,
      nonTiTopics,
      mixed: false,
    };
  }

  if (nonTiTopics.length) {
    return {
      status: "fuera_alcance",
      reason: `Fuera del alcance TI: ${nonTiTopics.join(", ")}. No se selecciona automáticamente.`,
      tiTopics,
      nonTiTopics,
      mixed: false,
    };
  }

  return {
    status: "requiere_revision",
    reason: "Solicitud sin detalle tecnológico; requiere revisión humana.",
    tiTopics,
    nonTiTopics,
    mixed: false,
  };
}
