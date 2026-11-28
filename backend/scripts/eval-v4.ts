import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { classifyMessage } from "../src/classifier/rules.js";
import { correlate } from "../src/classifier/context.js";
import { analyzeConversation } from "../src/classifier/v4/conversation.js";
import { contextualize } from "../src/classifier/v4/contextualizer.js";
import { EVAL_CASES } from "../src/classifier/v4/evaluation-dataset.js";
import { detect } from "../src/classifier/v4/detector.js";
import { normalizeForAnalysis } from "../src/classifier/v4/normalize.js";
import { seedDictionary } from "../src/classifier/v4/dictionary.js";
import { analyzeScope, DEFAULT_TI_SCOPE } from "../src/classifier/v4/scope.js";
import { CLASSIFIER_VERSION } from "../src/classifier/v4/types.js";
import { parseConversation } from "../src/importer/whatsapp.js";

const dictionary = seedDictionary();
const staffNames = new Set(["TI Soporte"].map((name) => normalizeForAnalysis(name).tokens.join(" ")));

type Metrics = { precision: number; recall: number; f1: number; tp: number; fp: number; fn: number };

function score(predictions: Array<{ expected: string | null; actual: string | null }>): Metrics {
  const tp = predictions.filter((row) => row.expected !== null && row.actual === row.expected).length;
  const fp = predictions.filter((row) => row.actual !== null && row.actual !== row.expected).length;
  const fn = predictions.filter((row) => row.expected !== null && row.actual !== row.expected).length;
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  return {
    precision: Number(precision.toFixed(4)), recall: Number(recall.toFixed(4)),
    f1: Number((precision + recall ? 2 * precision * recall / (precision + recall) : 0).toFixed(4)),
    tp, fp, fn,
  };
}

const classifications: Array<{ expected: string | null; actual: string | null }> = [];
const v3Classifications: Array<{ expected: string | null; actual: string | null }> = [];
const associations: Array<{ expected: string | null; actual: string | null }> = [];
const v3Associations: Array<{ expected: string | null; actual: string | null }> = [];
const fidelity: Array<{ expected: string | null; actual: string | null }> = [];
const details: Array<Record<string, unknown>> = [];

for (const testCase of EVAL_CASES) {
  const parsed = parseConversation(testCase.lines.join("\n"));
  const report = parsed.messages[0];
  const v4 = detect(report.text, dictionary, { messages: parsed.messages, index: 0 });
  const v3 = classifyMessage(report, staffNames);
  const conversation = analyzeConversation(parsed.messages, 0, {
    staffNames, tiStaffNames: staffNames, windowMinutes: 90,
    topicTerms: v4?.concepts.map((match) => match.matchedTerm) ?? [],
  });
  const scope = v4 ? analyzeScope(v4, { config: DEFAULT_TI_SCOPE, tiAttendance: conversation.tiAttendance }) : null;
  const text = v4 ? contextualize(report, conversation, v4).text : "";

  classifications.push({ expected: testCase.expectedCategory, actual: v4?.categoryLabel ?? null });
  v3Classifications.push({ expected: testCase.expectedCategory, actual: v3?.categoryLabel ?? null });
  if (testCase.expectedStatus) {
    associations.push({ expected: testCase.expectedStatus, actual: conversation.suggestedStatus });
    const v3Correlation = correlate(parsed.messages, 0, v3?.categoryLabel ?? "", {
      staffNames, tiStaffNames: staffNames, windowMinutes: 90,
    });
    v3Associations.push({ expected: testCase.expectedStatus, actual: v3Correlation.suggestedStatus });
  }
  if (testCase.fidelity || testCase.forbidden) {
    const ok = (testCase.fidelity ?? []).every((term) => text.toLowerCase().includes(term.toLowerCase()))
      && (testCase.forbidden ?? []).every((term) => !text.toLowerCase().includes(term.toLowerCase()));
    fidelity.push({ expected: "fiel", actual: ok ? "fiel" : "infiel" });
  }

  details.push({
    id: testCase.id, month: testCase.month, note: testCase.note,
    expected: testCase.expectedCategory, v4: v4?.categoryLabel ?? null, v3: v3?.categoryLabel ?? null,
    v4Score: v4?.score ?? 0, confidence: v4?.confidence ?? null,
    alternatives: v4?.alternatives.map((entry) => `${entry.category}:${entry.score}`) ?? [],
    scope: scope?.status ?? null, status: conversation.suggestedStatus,
    expectedStatus: testCase.expectedStatus ?? null,
    links: conversation.links.length,
    contextualization: text,
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  classifierVersion: CLASSIFIER_VERSION,
  dictionaryVersion: dictionary.version,
  dataset: "enero-diciembre sintético, separado del seed",
  cases: EVAL_CASES.length,
  classificationV4: score(classifications),
  classificationV3: score(v3Classifications),
  associationV4: score(associations),
  associationV3: score(v3Associations),
  contextualizationFidelity: score(fidelity),
  details,
};

const output = resolve(process.cwd(), "reports/v4-eval.json");
mkdirSync(resolve(process.cwd(), "reports"), { recursive: true });
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`Evaluación V4 (${report.cases} casos)`);
console.log(`Clasificación V4: P=${report.classificationV4.precision} R=${report.classificationV4.recall} F1=${report.classificationV4.f1}`);
console.log(`Clasificación V3: P=${report.classificationV3.precision} R=${report.classificationV3.recall} F1=${report.classificationV3.f1}`);
console.log(`Asociación V4: ${report.associationV4.precision} · Asociación V3: ${report.associationV3.precision}`);
console.log(`Fidelidad de contextualización: ${report.contextualizationFidelity.precision}`);
console.log(`Detalle: ${output}`);
