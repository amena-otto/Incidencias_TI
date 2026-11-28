import { DICTIONARY_VERSION, type Concept, type DictionarySnapshot } from "./types.js";

const REDES = "TI · Redes e Internet";
const AUDIOVISUALES = "TI · Equipos audiovisuales";
const HARDWARE = "TI · Hardware y periféricos";
const SOFTWARE = "TI · Software y plataformas";
const IMPRESORAS = "TI · Impresoras";
const ASISTENCIA = "Asistencia · Marcación y asistencia";
const ELECTRICIDAD = "Infraestructura · Electricidad y mantenimiento";
const ACCESO = "Operaciones · Apertura y acceso a ambientes";
const MOBILIARIO = "Operaciones · Mobiliario y materiales";
const LABORATORIOS = "Operaciones · Programación de laboratorios";
const LIMPIEZA = "Operaciones · Limpieza y ambiente";
const SEGURIDAD = "Seguridad · Salud y ambiente";
const OTROS = "Otros · Solicitud de apoyo sin detalle";

const UPDATED_AT = "2026-11-28T00:00:00.000Z";

function concept(
  key: string,
  category: string,
  name: string,
  description: string,
  synonyms: string[],
  expressions: string[],
  variants: string[],
  abbreviations: string[],
  related: string[],
  negatives: string[],
  weight: number,
  priority: number,
): Concept {
  return {
    id: `concept-${key}`,
    key,
    category,
    name,
    description,
    synonyms,
    expressions,
    variants,
    abbreviations,
    related,
    negatives,
    weight,
    priority,
    active: true,
    updatedAt: UPDATED_AT,
    version: DICTIONARY_VERSION,
  };
}

/**
 * Diccionario semilla. No contiene frases de un mes concreto: describe
 * conceptos y familias de expresiones que pueden aparecer en cualquier mes.
 */
export const SEED_CONCEPTS: Concept[] = [
  concept(
    "red-sin-conectividad", REDES, "Sin conectividad",
    "Falta de acceso a Internet o a la red institucional.",
    ["internet", "conexion", "conectividad", "red", "wifi", "inalambrico", "inalambrica"],
    ["no tengo internet", "se cayo la red", "no agarra la red", "sin conexion", "no se conecta", "no hay senal", "sin acceso a la red"],
    ["no tengo intermet", "no ay wifi", "sin coneccion", "no hay wi fi", "no conecta"],
    ["wifi", "wi fi", "wi-fi"],
    ["aula", "salon", "laboratorio", "conectar", "conectarme", "conectarse", "conectando", "levanta", "punto", "navegar", "acceso"],
    ["proyector", "impresora", "marcacion", "sillas", "limpieza"],
    5, 10,
  ),
  concept(
    "red-intermitente", REDES, "Conectividad intermitente",
    "La conexión se corta, es lenta o se pierde de forma repetida.",
    ["intermitente", "lenta", "se corta", "cae", "pierde senal"],
    ["el internet se corta seguido", "la conexion es muy lenta", "se pierde la senal", "se desconecta constantemente", "wifi debil"],
    ["se corta el internet", "senal baja", "conexion lenta"],
    [],
    ["aula", "wifi", "red", "internet", "conectividad"],
    ["proyector", "impresora", "electricidad", "mobiliario"],
    4, 8,
  ),
  concept(
    "av-proyeccion", AUDIOVISUALES, "Falla de proyección",
    "El proyector, la pantalla o la señal de video no funcionan.",
    ["proyector", "proyeccion", "retroproyector", "pantalla", "video"],
    ["el proyector no funciona", "no proyecta", "no se ve la pantalla", "falla el retroproyector", "no sale imagen"],
    ["proyektor", "no proyekta", "pantalla en blanco"],
    ["tv", "hdmi"],
    ["hdmi", "cable", "aula", "salon", "computadora", "laptop", "control remoto", "imagen", "entra"],
    ["internet", "impresora", "sillas", "marcacion"],
    5, 10,
  ),
  concept(
    "av-hdmi-audio", AUDIOVISUALES, "Video o audio por HDMI",
    "Problemas con el cable HDMI, la entrada de video o el sonido.",
    ["hdmi", "cable", "audio", "sonido", "parlante"],
    ["no suena el proyector", "falla el cable hdmi", "no se ve por hdmi", "sin audio en la pantalla", "el parlante no suena"],
    ["no suena", "cable hdmi suelto"],
    ["hdmi", "tv"],
    ["proyector", "pantalla", "cable", "conector", "salon"],
    ["internet", "impresora", "limpieza", "marcacion"],
    4, 9,
  ),
  concept(
    "hw-equipo-no-enciende", HARDWARE, "Equipo que no enciende",
    "Una laptop, computadora o equipo no arranca o se apaga.",
    ["laptop", "computadora", "pc", "equipo", "encender", "portatil"],
    ["la laptop no enciende", "el equipo no arranca", "la computadora no prende", "se apaga sola", "no boots"],
    ["mi kaptop no enciende", "la compu no prende", "el pc no enciende"],
    ["pc", "compu"],
    ["aula", "laboratorio", "cargador", "bateria", "monitor", "teclado", "apaga", "abre", "plataforma"],
    ["proyector", "internet", "impresora", "marcacion"],
    5, 10,
  ),
  concept(
    "hw-perifericos", HARDWARE, "Periféricos y monitor",
    "Fallas de teclado, mouse, monitor u otros dispositivos conectados.",
    ["teclado", "mouse", "raton", "monitor", "periferico", "dispositivo"],
    ["no funciona el teclado", "el mouse no responde", "el monitor no muestra imagen", "falla un periferico"],
    ["teclado dañado", "mouse sin respuesta"],
    [],
    ["laptop", "computadora", "pc", "cable", "aula", "cursor"],
    ["proyector", "internet", "impresora", "sillas"],
    4, 8,
  ),
  concept(
    "sw-acceso-plataforma", SOFTWARE, "Acceso a sistemas y plataformas",
    "El usuario no puede entrar a una plataforma institucional o al correo.",
    ["plataforma", "sistema", "jaguar", "correo", "acceso", "password"],
    ["no puedo entrar a la plataforma", "falla el acceso al sistema", "no puedo abrir mi correo", "no acepta mi password", "no puedo ingresar a jaguar"],
    ["no ingreso a jaguar", "clave no funciona", "correo institucional no abre"],
    ["sjs"],
    ["usuario", "clave", "password", "correo", "buzon", "correo electronico", "evaluaciones", "sistema", "plataforma", "abrir"],
    ["laboratorio cerrado", "internet", "proyector", "sillas", "aula cerrada"],
    5, 10,
  ),
  concept(
    "sw-rendimiento", SOFTWARE, "Sistema lento o con error",
    "Una aplicación institucional presenta errores o rendimiento deficiente.",
    ["error", "lento", "se traba", "no guarda", "aplicacion"],
    ["el sistema se traba", "la plataforma es muy lenta", "no guarda el registro", "sale error al ingresar"],
    ["sale un error", "sistema trabado"],
    [],
    ["plataforma", "sistema", "jaguar", "correo", "evaluaciones"],
    ["internet", "proyector", "impresora", "marcacion"],
    3, 7,
  ),
  concept(
    "imp-impresion", IMPRESORAS, "Impresión fallida",
    "La impresora no imprime, se atora o falla el trabajo de impresión.",
    ["impresora", "imprimir", "impresion", "toner", "tinta"],
    ["la impresora no imprime", "no sale la impresion", "la impresora se atoro", "no puedo imprimir", "se acabo el toner"],
    ["emprenta no imprime", "sin tinta", "no imprime"],
    [],
    ["impresion", "toner", "tinta", "papel", "aula", "oficina", "pasillo", "hojas", "blanco"],
    ["proyector", "internet", "laptop", "marcacion"],
    5, 10,
  ),
  concept(
    "asist-marcacion", ASISTENCIA, "Marcación de ingreso o salida",
    "No se pudo registrar la marcación de entrada o salida.",
    ["marcacion", "asistencia", "ingreso", "salida", "fichaje", "firmar"],
    ["no pude marcar mi ingreso", "no registra mi salida", "falla la marcacion", "no puedo firmar la asistencia", "no aparece mi ingreso"],
    ["no pude marcar", "marcaje no funciona", "no firmo salida"],
    ["marcaje"],
    ["ingreso", "salida", "asistencia", "reloj", "sistema", "regularizar", "hoy"],
    ["internet", "proyector", "impresora", "sillas"],
    4, 8,
  ),
  concept(
    "infra-corriente", ELECTRICIDAD, "Falta de energía eléctrica",
    "No hay corriente, el tomacorriente falla o hay problemas de instalación.",
    ["corriente", "electricidad", "tomacorriente", "enchufe", "energia"],
    ["no hay corriente en el aula", "no funciona el tomacorriente", "se corto la luz", "no hay energia", "el enchufe no da corriente"],
    ["sin corriente", "no hay luz", "toma corriente malo"],
    [],
    ["aula", "salon", "laboratorio", "cable", "laptop", "proyector", "corto", "energia"],
    ["internet", "impresora", "marcacion", "limpieza"],
    4, 8,
  ),
  concept(
    "op-apertura", ACCESO, "Apertura de ambientes",
    "Se solicita abrir un aula, laboratorio u otro ambiente.",
    ["apertura", "abrir", "aula", "laboratorio", "acceso"],
    ["el aula esta cerrada", "necesito que abran el laboratorio", "no puedo entrar al salon", "solicito apertura del aula"],
    ["abrir el lab", "aula cerrada", "no puedo ingresar al laboratorio"],
    ["lab"],
    ["aula", "salon", "laboratorio", "llave", "cerrado", "acceso", "ambiente"],
    ["internet", "proyector", "impresora", "plataforma"],
    4, 8,
  ),
  concept(
    "op-mobiliario", MOBILIARIO, "Mobiliario y materiales",
    "Faltan sillas, taburetes, materiales u otros bienes del ambiente.",
    ["sillas", "taburetes", "mobiliario", "materiales", "mesas"],
    ["faltan sillas en el aula", "no hay taburetes", "hace falta material", "faltan mesas"],
    ["falta sillas", "sin sillas"],
    [],
    ["aula", "salon", "laboratorio", "materiales", "mobiliario", "asientos", "estudiantes"],
    ["internet", "proyector", "impresora", "marcacion"],
    4, 7,
  ),
  concept(
    "op-programacion", LABORATORIOS, "Programación de laboratorios",
    "Solicitud de uso, programación o reserva de laboratorios.",
    ["programacion", "reserva", "laboratorio", "horario", "rol"],
    ["solicito programacion de laboratorio", "necesito reservar el laboratorio", "requiero horario de laboratorio", "pido el rol de laboratorio"],
    ["reservar lab", "programar laboratorio"],
    ["lab"],
    ["laboratorio", "horario", "reserva", "programacion", "clase", "computo", "espacio"],
    ["internet", "proyector", "impresora", "sillas"],
    3, 7,
  ),
  concept(
    "op-limpieza", LIMPIEZA, "Limpieza y ambiente",
    "Condiciones de limpieza, ruido o ambiente inadecuado.",
    ["limpieza", "ruido", "ambiente", "suciedad", "basura"],
    ["falta limpieza en el aula", "hay mucho ruido", "el ambiente esta sucio", "no recogieron la basura"],
    ["sin limpieza", "mucho ruido"],
    [],
    ["aula", "salon", "ambiente", "clase", "pasillo", "evento"],
    ["internet", "proyector", "impresora", "marcacion"],
    3, 6,
  ),
  concept(
    "seg-riesgo", SEGURIDAD, "Riesgo sanitario o de seguridad",
    "Situaciones que representan riesgo para la salud o la seguridad.",
    ["mercurio", "dengue", "zancudos", "riesgo", "seguridad", "derrame"],
    ["hay derrame de mercurio", "hay riesgo de dengue", "hay muchos zancudos", "hay una situacion de riesgo"],
    ["derrame de mercurio", "muchos zancudos"],
    [],
    ["mercurio", "dengue", "zancudos", "riesgo", "salud", "seguridad", "aula", "gas", "olor", "humo"],
    ["internet", "proyector", "impresora", "sillas"],
    5, 9,
  ),
  concept(
    "otros-apoyo-generico", OTROS, "Apoyo sin detalle",
    "Solicitud genérica de ayuda que requiere revisión humana.",
    ["apoyo", "ayuda", "solicitud", "colaboracion"],
    ["necesito apoyo", "requiero ayuda", "solicito su apoyo", "pido colaboracion"],
    ["nesecito ayuda", "pidoo apoyo"],
    ["xfa", "x favor"],
    ["urgente", "aula", "salon"],
    ["internet", "wifi", "proyector", "laptop", "impresora", "jaguar", "marcacion", "sillas", "corriente", "mercurio"],
    1, 1,
  ),
];

export function seedDictionary(): DictionarySnapshot {
  return {
    version: DICTIONARY_VERSION,
    concepts: SEED_CONCEPTS.map((entry) => ({ ...entry })),
    source: "memoria",
  };
}
