import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseChat } from "../../importer/whatsapp.js";
import { classifyV4 } from "./adapter.js";
import { analyzeConversation } from "./conversation.js";
import { contextualize } from "./contextualizer.js";
import { seedDictionary } from "./dictionary.js";
import { detect } from "./detector.js";
import { normalizeForAnalysis } from "./normalize.js";
import { analyzeScope, DEFAULT_TI_SCOPE } from "./scope.js";
import { CLASSIFIER_VERSION } from "./types.js";

const dictionary = seedDictionary();
const staff = new Set(["ti soporte"]);

function messages(lines: string[]) {
  return parseChat(lines.join("\n"));
}

describe("Clasificador V4", () => {
  it("normaliza sin reescribir el original", () => {
    const original = "¡NO TENGO INTERNEET en el AULA 203! 📶";
    const result = normalizeForAnalysis(original);
    assert.equal(result.original, original);
    assert.match(result.canonical, /\bno tengo internet\b/);
    assert.match(result.canonical, /\baula 203\b/);
    assert.ok(result.negations.includes("no"));
    assert.ok(result.emojis.includes("📶"));
  });

  it("detecta conceptos con expresiones nunca vistas y explica alternativas", () => {
    const result = detect("El acceso inalámbrico del salón 301 no levanta", dictionary);
    assert.ok(result);
    assert.equal(result.categoryLabel, "TI · Redes e Internet");
    assert.ok(result.score > 0);
    assert.match(result.explanation, /Redes e Internet/);
    assert.ok(result.alternatives.length >= 2);
    assert.ok(result.concepts.length > 0);
  });

  it("cuenta la negación de capacidad como evidencia del problema", () => {
    const result = detect("No levanta la red del aula 401", dictionary);
    assert.ok(result);
    assert.equal(result.categoryLabel, "TI · Redes e Internet");
    assert.ok(result.concepts.some((match) => match.negated));
  });

  it("no selecciona apoyo genérico sin detalle", () => {
    const result = detect("Solicito su colaboración", dictionary);
    assert.equal(result?.categoryLabel, "Otros · Solicitud de apoyo sin detalle");
    assert.equal(result?.generic, true);
  });

  it("aplica el perfil TI_INSTITUCIONAL sin borrar otras categorías", () => {
    const network = detect("No levanta la red del aula 401", dictionary);
    const networkScope = analyzeScope(network!, { config: DEFAULT_TI_SCOPE });
    assert.equal(networkScope.status, "ti_detectada");
    assert.equal(networkScope.profile, "TI_INSTITUCIONAL");

    const furniture = detect("Faltan asientos para los estudiantes", dictionary);
    const furnitureScope = analyzeScope(furniture!, { config: DEFAULT_TI_SCOPE });
    assert.equal(furnitureScope.status, "fuera_alcance");
    assert.ok(furnitureScope.nonTiTopics.includes("Operaciones · Mobiliario y materiales"));
  });

  it("no vincula un ok aislado ni una respuesta anterior", () => {
    const isolated = messages([
      "04/04/26 10:00 - Profesora Ana: La impresora no suelta hojas",
      "04/04/26 10:01 - Otro Docente: Ok",
    ]);
    const analysis = analyzeConversation(isolated, 0, {
      staffNames: staff, tiStaffNames: staff, windowMinutes: 90,
    });
    assert.equal(analysis.links.length, 0);
    assert.equal(analysis.suggestedStatus, "pendiente");

    const reversed = messages([
      "11/02/26 09:00 - TI Soporte: Ya quedó el proyector del aula 120",
      "11/02/26 09:05 - Profesor Miguel: El proyector del aula 120 no muestra imagen",
    ]);
    const reversedAnalysis = analyzeConversation(reversed, 1, {
      staffNames: staff, tiStaffNames: staff, windowMinutes: 90,
    });
    assert.equal(reversedAnalysis.solution, null);
    assert.equal(reversedAnalysis.suggestedStatus, "pendiente");
  });

  it("vincula personal TI por autor, tema y aula, incluso cruzando medianoche", () => {
    const chat = messages([
      "23/01/26 23:58 - Profesora Ana: No levanta la red del aula 401",
      "24/01/26 00:05 - TI Soporte: Se reinició el punto de acceso del aula 401 y ya conecta",
    ]);
    const analysis = analyzeConversation(chat, 0, {
      staffNames: staff, tiStaffNames: staff, windowMinutes: 90,
    });
    assert.equal(analysis.links.length, 1);
    assert.equal(analysis.links[0].isTiStaff, true);
    assert.equal(analysis.suggestedStatus, "resuelto");
    assert.ok(analysis.links[0].evidence.some((entry) => entry.includes("Ubicación coincidente")));
  });

  it("redacta atención sin inventar solución y conserva evidencia", () => {
    const chat = messages([
      "12/05/26 10:00 - Profesora Teresa: La plataforma jaguar no me abre en el aula 210",
      "12/05/26 10:04 - TI Soporte: Voy a revisar el acceso del aula 210",
    ]);
    const detection = detect(chat[0].text, dictionary)!;
    const analysis = analyzeConversation(chat, 0, {
      staffNames: staff, tiStaffNames: staff, windowMinutes: 90,
      topicTerms: detection.concepts.map((match) => match.matchedTerm),
    });
    const text = contextualize(chat[0], analysis, detection);
    assert.equal(analysis.suggestedStatus, "en_atencion");
    assert.match(text.text, /personal TI/);
    assert.match(text.text, /No se confirmó una solución/);
    assert.ok(text.facts.length >= 2);
    assert.ok(text.inferences.length >= 1);
    assert.equal(text.evidence[0].position, 1);
    assert.equal(text.evidence.at(-1)?.position, 2);
  });

  it("devuelve el contrato Candidate y guarda la versión en la explicación", async () => {
    const chat = messages(["04/11/26 09:05 - Profesora Valeria: Necesito ayuda para conectarme a internet"]);
    const candidates = await classifyV4(chat, { dictionary, staffNames: staff, tiStaffNames: staff });
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].categoryLabel, "TI · Redes e Internet");
    assert.equal(candidates[0].originalMessage, chat[0].text);
    assert.match(candidates[0].explanation, new RegExp(`\\[${CLASSIFIER_VERSION}\\|`));
    assert.equal(candidates[0].selected, true);
  });
});
