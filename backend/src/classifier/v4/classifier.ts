import { analyzeConversation } from "./conversation.js";
import { contextualize } from "./contextualizer.js";
import { detect } from "./detector.js";
import { analyzeScope } from "./scope.js";
import { dictionaryRepository } from "./repository.js";
import {
  CLASSIFIER_VERSION,
  type ClassificationOptions,
  type Contextualization,
  type ConversationAnalysis,
  type DetectionResult,
  type DictionarySnapshot,
  type OptionalStatisticalClassifier,
  type ScopeDecision,
  type V4Decision,
} from "./types.js";
import type { Msg } from "../../importer/whatsapp.js";

/** Reglas explicables: siempre funcionan, sin servicios externos. */
export class RuleBasedClassifier {
  constructor(private readonly dictionary: DictionarySnapshot) {}

  analyze(message: Msg, options: ClassificationOptions = {}): DetectionResult | null {
    return detect(message.text, this.dictionary, {
      messages: options.messages,
      index: options.messageIndex,
    });
  }
}

/** Analiza y redacta con evidencia; no modifica el mensaje original. */
export class ContextualAnalyzer {
  analyze(messages: readonly Msg[], index: number, options: ClassificationOptions): ConversationAnalysis {
    return analyzeConversation(messages, index, {
      staffNames: options.staffNames ?? new Set<string>(),
      tiStaffNames: options.tiStaffNames ?? options.staffNames ?? new Set<string>(),
      windowMinutes: options.windowMinutes ?? 90,
      topicTerms: options.messages && options.messageIndex !== undefined
        ? [messages[options.messageIndex]?.text ?? ""]
        : [],
    });
  }

  write(report: Msg, conversation: ConversationAnalysis, detection: DetectionResult): Contextualization {
    return contextualize(report, conversation, detection);
  }
}

/**
 * Orquesta reglas, alcance, conversación y un modelo opcional. Si el modelo
 * estadístico no está activo, la decisión es exclusivamente basada en reglas.
 */
export class ClassificationDecisionService {
  constructor(
    private readonly options: { statistical?: OptionalStatisticalClassifier | null } = {},
    private readonly reader: { snapshot: () => Promise<DictionarySnapshot> } = dictionaryRepository,
  ) {}

  async classify(message: Msg, options: ClassificationOptions = {}): Promise<V4Decision | null> {
    const dictionary = options.dictionary ?? await this.reader.snapshot();
    const rules = new RuleBasedClassifier(dictionary);
    const detection = rules.analyze(message, options);
    if (!detection) return null;

    const analyzer = new ContextualAnalyzer();
    const conversation = analyzer.analyze(options.messages ?? [message], options.messageIndex ?? 0, options);
    const scope: ScopeDecision = analyzeScope(detection, {
      config: options.scope,
      tiAttendance: conversation.tiAttendance,
      tiAttendanceReason: conversation.tiAttendanceReason,
    });
    const contextualization = analyzer.write(message, conversation, detection);
    const statistical = options.statistical ?? this.options.statistical;
    if (statistical?.enabled) {
      const prediction = await statistical.predict({ text: message.text, original: message.text });
      if (prediction) {
        detection.alternatives.push({
          category: prediction.category,
          score: prediction.score,
          justification: `Sugerencia del modelo local ${prediction.modelVersion}; no sustituye a las reglas sin validación.`,
          concepts: [],
        });
      }
    }

    return {
      detection,
      scope,
      conversation,
      contextualization,
      version: CLASSIFIER_VERSION,
      dictionaryVersion: dictionary.version,
    };
  }
}
