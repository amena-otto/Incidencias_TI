import type { Msg } from "../../importer/whatsapp.js";
import type { Confidence } from "../../db/schema.types.js";

/** Versión inmutable del motor. Se guarda con cada nueva incidencia. */
export const CLASSIFIER_VERSION = "V4.0.0";
export const DICTIONARY_VERSION = "V4.0.0-seed";
export const SCOPE_PROFILE = "TI_INSTITUCIONAL";

export type Concept = {
  id: string;
  key: string;
  category: string;
  name: string;
  description: string;
  synonyms: string[];
  expressions: string[];
  variants: string[];
  abbreviations: string[];
  related: string[];
  negatives: string[];
  weight: number;
  priority: number;
  active: boolean;
  updatedAt: string;
  version: string;
};

export type DictionarySnapshot = {
  version: string;
  concepts: Concept[];
  source: "neon" | "memoria";
};

export type NormalizedMessage = {
  original: string;
  canonical: string;
  tokens: string[];
  negations: string[];
  emojis: string[];
  location: string | null;
  device: string | null;
};

export type MatchKind = "expresion" | "sinonimo" | "variante" | "abreviatura" | "relacionado" | "ventana";

export type ConceptMatch = {
  conceptKey: string;
  conceptName: string;
  category: string;
  matchedTerm: string;
  kind: MatchKind;
  weight: number;
  priority: number;
  position: number;
  negated: boolean;
  evidence: string;
  window?: string[];
};

export type CategoryAlternative = {
  category: string;
  score: number;
  justification: string;
  concepts: string[];
};

export type DetectionResult = {
  categoryLabel: string;
  alternatives: CategoryAlternative[];
  matchedCategories: string[];
  confidence: Confidence;
  score: number;
  explanation: string;
  ambiguous: boolean;
  ruleApplied: string;
  concepts: ConceptMatch[];
  generic: boolean;
};

export type ScopeStatus =
  | "ti_detectada"
  | "atencion_ti"
  | "requiere_revision"
  | "fuera_alcance"
  | "no_pertinente";

export type ScopeConfig = {
  profile: string;
  allowedCategories: string[];
  conditionalCategories: string[];
  excludeNonTiByDefault: boolean;
  requireTiEvidenceForNonTi: boolean;
};

export type ScopeDecision = {
  status: ScopeStatus;
  reason: string;
  profile: string;
  allowedCategories: string[];
  tiTopics: string[];
  nonTiTopics: string[];
  mixed: boolean;
};

export type ConversationStage =
  | "reporte"
  | "respuesta_ti"
  | "solicitud_ubicacion"
  | "desplazamiento"
  | "accion_tecnica"
  | "seguimiento"
  | "confirmacion_solucion"
  | "no_relacionado";

/** Cada vínculo conserva la evidencia que lo justifica; nunca se infiere sólo por cercanía. */
export type MessageLink = {
  messageId: string;
  position: number;
  sender: string;
  text: string;
  date: string;
  time: string;
  stage: ConversationStage;
  score: number;
  uncertain: boolean;
  isStaff: boolean;
  isTiStaff: boolean;
  evidence: string[];
  topicEvidence: boolean;
  locationEvidence: boolean;
  authorEvidence: boolean;
};

export type ConversationAnalysis = {
  reportId: string;
  reportPosition: number;
  links: MessageLink[];
  requestLocation: MessageLink | null;
  displacement: MessageLink | null;
  technicalAction: MessageLink | null;
  followUp: MessageLink | null;
  attendance: MessageLink | null;
  solution: MessageLink | null;
  previousContext: MessageLink[];
  suggestedStatus: "pendiente" | "en_atencion" | "resuelto";
  uncertain: boolean;
  tiAttendance: boolean;
  tiAttendanceReason: string;
  explanation: string;
};

export type Contextualization = {
  text: string;
  facts: string[];
  inferences: string[];
  evidence: Array<{ messageId: string; position: number; date: string; time: string }>;
  verifiedDates: boolean;
  explanation: string;
};

/** Interfaz preparada para un modelo estadístico local futuro. No está activa. */
export type StatisticalPrediction = {
  category: string;
  score: number;
  modelVersion: string;
};

export interface OptionalStatisticalClassifier {
  readonly enabled: boolean;
  readonly modelVersion: string;
  predict(input: { text: string; original: string }): Promise<StatisticalPrediction | null>;
}

export interface DictionaryReader {
  snapshot(): Promise<DictionarySnapshot>;
}

export interface FeedbackRepository {
  record(entry: FeedbackEntry & { candidateId?: string; importId?: string | null }): Promise<void>;
  list(limit?: number): Promise<FeedbackEntry[]>;
}

export type FeedbackEntry = {
  originalText: string;
  originalHash: string;
  suggestedCategory: string;
  correctedCategory: string;
  reason: string;
  concepts: string[];
  ruleApplied: string;
  reviewerId: string | null;
  reviewerName: string;
  reviewedAt: string;
  classifierVersion: string;
  dictionaryVersion: string;
};

export type ClassificationOptions = {
  staffNames?: ReadonlySet<string>;
  tiStaffNames?: ReadonlySet<string>;
  windowMinutes?: number;
  messages?: readonly Msg[];
  messageIndex?: number;
  scope?: ScopeConfig;
  dictionary?: DictionarySnapshot;
  statistical?: OptionalStatisticalClassifier | null;
};

export type V4Decision = {
  detection: DetectionResult;
  scope: ScopeDecision;
  conversation: ConversationAnalysis;
  contextualization: Contextualization;
  version: string;
  dictionaryVersion: string;
};
