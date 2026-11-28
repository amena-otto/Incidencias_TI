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

export type EvalCase = {
  id: string;
  month: number;
  lines: string[];
  expectedCategory: string | null;
  expectedStatus?: "pendiente" | "en_atencion" | "resuelto";
  fidelity?: string[];
  forbidden?: string[];
  note: string;
};

/**
 * Conjunto sintético enero–diciembre. Está separado del seed: no repite sus
 * expresiones literales y usa docentes, aulas y redacciones distintas.
 */
export const EVAL_CASES: EvalCase[] = [
  { id: "ene-01", month: 1, lines: ["05/01/26 08:15 - Profesora Ana: El acceso inalámbrico del salón 204 no levanta"], expectedCategory: REDES, note: "Variante sin la palabra wifi" },
  { id: "ene-02", month: 1, lines: ["11/01/26 15:40 - Profesor Luis: Mi equipo portátil se apaga al abrir la plataforma"], expectedCategory: HARDWARE, note: "Dos categorías posibles; gana la concreta" },
  { id: "ene-03", month: 1, lines: ["23/01/26 23:58 - Profesora Ana: No levanta la red del aula 401", "24/01/26 00:05 - TI Soporte: Se reinició el punto de acceso del aula 401 y ya conecta"], expectedCategory: REDES, expectedStatus: "resuelto", fidelity: ["aula 401", "conecta"], note: "Respuesta cruzando medianoche" },
  { id: "feb-01", month: 2, lines: ["02/02/26 09:05 - Profesora Rosa: No entra la imagen del proyector en el aula 110"], expectedCategory: AUDIOVISUALES, note: "Proyección sin verbo funciona" },
  { id: "feb-02", month: 2, lines: ["11/02/26 09:00 - TI Soporte: Ya quedó el proyector del aula 120", "11/02/26 09:05 - Profesor Miguel: El proyector del aula 120 no muestra imagen"], expectedCategory: AUDIOVISUALES, expectedStatus: "pendiente", forbidden: ["resuelta"], note: "Respuesta anterior no se asocia" },
  { id: "feb-03", month: 2, lines: ["18/02/26 11:20 - Profesor Miguel: El control remoto dejó de responder"], expectedCategory: AUDIOVISUALES, note: "Solicitud breve" },
  { id: "mar-01", month: 3, lines: ["07/03/26 10:10 - Profesora Elena: La impresora del pasillo escupe hojas en blanco"], expectedCategory: IMPRESORAS, note: "Problema de impresión no literal" },
  { id: "mar-02", month: 3, lines: ["14/03/26 07:55 - Profesor Carlos: No registran mi ingreso de hoy"], expectedCategory: ASISTENCIA, note: "Marcación condicionada a TI" },
  { id: "abr-01", month: 4, lines: ["03/04/26 13:30 - Profesora Patricia: Se cortó la energía en el laboratorio 2"], expectedCategory: ELECTRICIDAD, note: "Electricidad con error ortográfico" },
  { id: "abr-02", month: 4, lines: ["08/04/26 10:00 - Profesora Lucía: La impresora no suelta hojas", "08/04/26 10:01 - Profesor Otro: Ok"], expectedCategory: IMPRESORAS, expectedStatus: "pendiente", forbidden: ["personal TI indicó"], note: "Ack aislado no se vincula" },
  { id: "abr-03", month: 4, lines: ["21/04/26 16:45 - Profesor Javier: El aula 305 permanece con llave"], expectedCategory: ACCESO, note: "Apertura sin la palabra abrir" },
  { id: "may-01", month: 5, lines: ["09/05/26 08:00 - Profesora Lucía: Faltan asientos para los estudiantes"], expectedCategory: MOBILIARIO, note: "Mobiliario sin decir sillas" },
  { id: "may-02", month: 5, lines: ["12/05/26 10:00 - Profesora Teresa: La plataforma jaguar no me abre en el aula 210", "12/05/26 10:04 - TI Soporte: Voy a revisar el acceso del aula 210"], expectedCategory: SOFTWARE, expectedStatus: "en_atencion", fidelity: ["No se confirmó"], note: "Seguimiento de TI sin solución" },
  { id: "may-03", month: 5, lines: ["17/05/26 12:15 - Profesor Diego: Requiero el espacio de cómputo para el viernes"], expectedCategory: LABORATORIOS, note: "Programación con sinónimo" },
  { id: "jun-01", month: 6, lines: ["04/06/26 10:25 - Profesora Mariana: Hay olor a gas en el pasillo"], expectedCategory: SEGURIDAD, note: "Riesgo sanitario" },
  { id: "jun-02", month: 6, lines: ["19/06/26 09:10 - Profesor Andrés: Solicito su colaboración"], expectedCategory: OTROS, expectedStatus: "pendiente", note: "Solicitud genérica no seleccionable" },
  { id: "jul-01", month: 7, lines: ["08/07/26 14:05 - Profesora Carmen: No logro abrir mi buzón institucional"], expectedCategory: SOFTWARE, note: "Correo sin la palabra correo" },
  { id: "jul-02", month: 7, lines: ["22/07/26 11:35 - Profesor Ricardo: El ratón no desplaza el cursor"], expectedCategory: HARDWARE, note: "Periférico coloquial" },
  { id: "ago-01", month: 8, lines: ["06/08/26 08:50 - Profesora Silvia: El wifi se cae cada cinco minutos"], expectedCategory: REDES, note: "Intermitencia breve" },
  { id: "ago-02", month: 8, lines: ["20/08/26 15:15 - Profesor Omar: La pantalla del aula 118 parpadea y suelta el cable"], expectedCategory: AUDIOVISUALES, note: "Falla audiovisual extensa" },
  { id: "sep-01", month: 9, lines: ["05/09/26 09:40 - Profesora Beatriz: No hay tinta para el equipo de impresión"], expectedCategory: IMPRESORAS, note: "Suministro" },
  { id: "sep-02", month: 9, lines: ["18/09/26 07:30 - Profesor Fernando: No puedo firmar la salida"], expectedCategory: ASISTENCIA, note: "Salida" },
  { id: "oct-01", month: 10, lines: ["02/10/26 10:00 - Profesora Teresa: Hay zancudos en el aula 207"], expectedCategory: SEGURIDAD, note: "Salud" },
  { id: "oct-02", month: 10, lines: ["16/10/26 13:20 - Profesor Hugo: Se solicitó limpieza del salón después del evento"], expectedCategory: LIMPIEZA, note: "Comunicado administrativo con solicitud" },
  { id: "nov-01", month: 11, lines: ["04/11/26 09:05 - Profesora Valeria: Necesito ayuda para conectarme a internet"], expectedCategory: REDES, note: "Ejemplo del usuario, no frase del seed" },
  { id: "nov-02", month: 11, lines: ["17/11/26 10:45 - Profesor Alfredo: La laptop del aula 203 no prende"], expectedCategory: HARDWARE, note: "Error de escritura" },
  { id: "dic-01", month: 12, lines: ["03/12/26 08:30 - Profesora Natalia: No tengo acceso a la red institucional"], expectedCategory: REDES, note: "Sin la palabra internet" },
  { id: "dic-02", month: 12, lines: ["15/12/26 17:10 - Profesor Sergio: El ventilador del laboratorio hace ruido"], expectedCategory: LIMPIEZA, note: "Ambiente, no problema técnico" },
];
