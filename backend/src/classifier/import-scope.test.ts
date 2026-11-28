import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseChat } from "../importer/whatsapp.js";
import { stableMessageFingerprint } from "../lib/text.js";
import { classify, classifyMessage } from "./rules.js";
import { correlate } from "./context.js";
import { analyzeTiScope } from "./ti-scope.js";

const REPORT_DATE = "26/11/26 10:00";
const staffNames = new Set(["personal ti"]);

function classifyText(text: string) {
  return classifyMessage(parseChat(`${REPORT_DATE} - Docente Prueba: ${text}`)[0], staffNames);
}

describe("Perfil de importación Incidencias TI", () => {
  it("excluye solicitudes ajenas al área TI sin borrar su categoría", () => {
    const chairs = classifyText("Faltan sillas en el aula");
    assert.ok(chairs);
    assert.equal(chairs.categoryLabel, "Operaciones · Mobiliario y materiales");
    assert.equal(chairs.inclusionStatus, "fuera_alcance");
    assert.equal(chairs.selected, false);

    const cleaning = classifyText("Falta personal de limpieza");
    assert.equal(cleaning?.inclusionStatus, "fuera_alcance");
    assert.equal(cleaning?.selected, false);

    const opening = classifyText("Abrir el laboratorio");
    assert.equal(opening?.inclusionStatus, "fuera_alcance");
  });

  it("detecta problemas concretos de red e Internet", () => {
    for (const text of [
      "Internet lento en el aula 203",
      "No tengo conexión a Internet",
      "Solicito apoyo para conectarme al Internet aula 203 pabellón D",
    ]) {
      const result = classifyText(text);
      assert.ok(result, text);
      assert.equal(result.categoryLabel, "TI · Redes e Internet", text);
      assert.equal(result.inclusionStatus, "ti_detectada", text);
      assert.equal(result.selected, true, text);
    }
  });

  it("detecta fallas audiovisuales aunque digan «apoyo en aula»", () => {
    const result = classifyText("Apoyo en aula 105 C problemas con el proyector");
    assert.ok(result);
    assert.equal(result.categoryLabel, "TI · Equipos audiovisuales");
    assert.equal(result.inclusionStatus, "ti_detectada");
    assert.equal(result.selected, true);
  });

  it("prioriza la plataforma concreta sobre la marcación mencionada", () => {
    const result = classifyText("Necesito apoyo técnico, no puedo ingresar a Jaguar para marcar mi asistencia");
    assert.ok(result);
    assert.equal(result.categoryLabel, "TI · Software y plataformas");
    assert.equal(result.inclusionStatus, "ti_detectada");
    assert.equal(result.mixed, false);
    assert.equal(result.selected, true);
  });

  it("no selecciona solicitudes genéricas de apoyo", () => {
    const result = classifyText("Necesito apoyo urgente");
    assert.ok(result);
    assert.equal(result.inclusionStatus, "requiere_revision");
    assert.equal(result.selected, false);
  });

  it("reconoce una confirmación corta de TI sólo con contexto suficiente", () => {
    const messages = parseChat([
      "26/11/26 10:00 - Docente Uno: No funciona el proyector en el aula 3",
      "26/11/26 10:02 - Personal TI: Ok, aula 3",
    ].join("\n"));
    const result = correlate(messages, 0, "TI · Equipos audiovisuales", { staffNames, windowMinutes: 90 });
    assert.equal(result.responses.length, 1);
    assert.equal(result.responses[0].role, "ack");
    assert.ok(result.responses[0].score >= 6);
    assert.equal(result.suggestedStatus, "en_atencion");
    assert.equal(result.solutionEvidence, null);
    assert.match(result.tiAttendanceReason, /No implica resolución/);
  });

  it("no asocia un «ok» aislado ni una respuesta de otro docente", () => {
    const withBareAck = parseChat([
      "26/11/26 10:00 - Docente Uno: No funciona el proyector",
      "26/11/26 10:02 - Personal TI: Ok",
    ].join("\n"));
    assert.equal(correlate(withBareAck, 0, "TI · Equipos audiovisuales", { staffNames, windowMinutes: 90 }).responses.length, 0);

    const withOtherTeacher = parseChat([
      "26/11/26 10:00 - Docente Uno: No funciona el proyector",
      "26/11/26 10:02 - Docente Dos: Ok",
    ].join("\n"));
    assert.equal(correlate(withOtherTeacher, 0, "TI · Equipos audiovisuales", { staffNames, windowMinutes: 90 }).responses.length, 0);
  });

  it("detecta la parte TI en casos mixtos sin reescribir el mensaje", () => {
    const scope = analyzeTiScope("Apertura de laboratorio y después conectar Internet a la laptop");
    assert.equal(scope.mixed, true);
    assert.equal(scope.status, "requiere_revision");
    assert.ok(scope.tiTopics.length >= 1);
    assert.ok(scope.nonTiTopics.some((topic) => topic.includes("Apertura")));

    const [candidate] = classify(parseChat(`${REPORT_DATE} - Docente Uno: Apertura de laboratorio y después conectar Internet a la laptop`));
    assert.ok(candidate);
    assert.equal(candidate.originalMessage, "Apertura de laboratorio y después conectar Internet a la laptop");
    assert.equal(candidate.inclusionStatus, "requiere_revision");
    assert.equal(candidate.selected, false);
    assert.match(candidate.inclusionReason, /Asunto mixto/);
  });

  it("conserva el remitente original para trazabilidad y deduplicación", () => {
    const input = {
      date: "2026-11-26", time: "10:00", text: "No funciona el proyector", conversationKey: "sala-ti", position: 1,
    };
    const first = stableMessageFingerprint({ ...input, sender: "Ana Pérez" });
    assert.equal(first, stableMessageFingerprint({ ...input, sender: "Ana Pérez" }));
    assert.notEqual(first, stableMessageFingerprint({ ...input, sender: "Otro Docente" }));

    const [candidate] = classify(parseChat(`${REPORT_DATE} - Ana Pérez: No funciona el proyector`));
    assert.equal(candidate.requesterName, "Ana Pérez");
  });
});
