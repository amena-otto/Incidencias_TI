export type Role = "admin" | "tecnico" | "consulta";

export type User = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
};

export type AuthState = {
  authenticated: boolean;
  user?: User;
  permissions: string[];
  csrfToken?: string;
  expiresAt?: string;
};

export type Category = {
  id: string;
  name: string;
  group: "ti" | "asistencia" | "operaciones" | "infraestructura" | "seguridad" | "otros";
  description: string | null;
  keywords: string[];
  active: boolean;
};

export type TeacherSuggestion = {
  teacherId: string;
  fullName: string;
  method: string;
  score: number;
};

export type Teacher = {
  id: string;
  fullName: string;
  normalizedName: string;
  email: string | null;
  active: boolean;
  aliases: string[];
};

export type TeacherImportRow = {
  rowNumber: number;
  nombres: string;
  apellidos: string;
  fullName: string;
  email: string;
  code: string;
  alias: string;
  errors: string[];
  duplicate: boolean;
  selected: boolean;
};

export type InclusionStatus =
  | "ti_detectada"
  | "atencion_ti"
  | "requiere_revision"
  | "fuera_alcance"
  | "no_pertinente";

export const INCLUSION_LABELS: Record<InclusionStatus, string> = {
  ti_detectada: "Incidencia TI detectada",
  atencion_ti: "Atención de TI vinculada",
  requiere_revision: "Requiere revisión",
  fuera_alcance: "Fuera del alcance TI",
  no_pertinente: "Mensaje no pertinente",
};

export type PreviewCandidate = {
  candidateId: string;
  position: number;
  date: string;
  time: string;
  /** Remitente original: se conserva para trazabilidad, no se muestra como columna editable. */
  requesterName: string;
  originalMessage: string;
  categoryLabel: string;
  contextualization: string;
  confidence: "alta" | "media" | "baja";
  explanation: string;
  matchedCategories: string[];
  ambiguous: boolean;
  suggestedStatus: string;
  responses: Array<{
    sender: string;
    text: string;
    date: string;
    time: string;
    role: string;
    uncertain: boolean;
    score: number;
    isStaff: boolean;
  }>;
  teacherId: string | null;
  teacherSuggestion: TeacherSuggestion | null;
  teacherCandidates: TeacherSuggestion[];
  teacherName: string | null;
  requestType: string;
  inclusionStatus: InclusionStatus;
  inclusionReason: string;
  tiTopics: string[];
  nonTiTopics: string[];
  mixed: boolean;
  possibleDuplicate: boolean;
  selected: boolean;
};

export type ExcludedMessage = {
  position: number;
  date: string;
  time: string;
  sender: string;
  originalMessage: string;
  status: InclusionStatus | "duplicado";
  reason: string;
};

export type ImportPreview = {
  token: string;
  sourceName: string;
  channel: "whatsapp_txt" | "texto_pegado";
  totalMessages: number;
  contentHash: string;
  conversationKey?: string;
  candidates: PreviewCandidate[];
  excluded: ExcludedMessage[];
  excludedReasons: Array<{ status: string; reason: string; count: number }>;
  stats: {
    analyzed: number;
    detected: number;
    high: number;
    medium: number;
    low: number;
    ambiguous: number;
    responses: number;
    discarded: number;
    possibleDuplicates: number;
    includedTi: number;
    tiWithAttention: number;
    requiresReview: number;
    excludedOutOfScope: number;
    excludedNotRelevant: number;
    excludedDuplicates: number;
  };
  format: string;
  invalidDates: number;
};

export type CommitResult = {
  analyzed: number;
  detected: number;
  confirmed: number;
  saved: number;
  duplicateMessages: number;
  rejected: number;
  responsesSaved: number;
  importId: string | null;
  duplicateConversation: boolean;
};

export type IncidentListItem = {
  id: string;
  incidentDate: string;
  incidentTime: string;
  requesterName: string;
  originalMessage: string;
  categoryLabel: string;
  requestType: string;
  status: string;
  contextualization: string | null;
  confidenceLevel: string | null;
  possibleDuplicate: string | null;
  teacherName: string | null;
  assignedName: string | null;
  createdAt: string;
};

export type IncidentDetail = IncidentListItem & {
  solution: string | null;
  suggestedStatus: string | null;
  teacherId: string | null;
  assignedTo: string | null;
  messages: Array<{ id: string; senderName: string; messageText: string; messageTime: string; type: string; isStaff: boolean }>;
  responses: Array<{ id: string; responderName: string; responseText: string; responseTime: string; associationConfidence: string; isUncertain: boolean }>;
  history: Array<{ id: string; action: string; previousValue: unknown; newValue: unknown; notes: string | null; createdAt: string; actor: string | null }>;
};

export type FilterOptions = {
  categories: Array<{ id: string; name: string }>;
  teachers: Array<{ id: string; fullName: string }>;
  responsibles: Array<{ id: string; fullName: string }>;
  statuses: string[];
  requestTypes: string[];
};

export type Status = "pendiente" | "en_atencion" | "resuelto" | "cerrado" | "descartado";

export const STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  en_atencion: "En atención",
  resuelto: "Resuelto",
  cerrado: "Cerrado",
  descartado: "Descartado",
};

export const REQUEST_TYPE_LABELS: Record<string, string> = {
  ti: "TI",
  asistencia: "Asistencia",
  operaciones: "Operaciones",
  infraestructura: "Infraestructura",
  seguridad: "Seguridad",
  otros: "Otros",
};

/** Debe coincidir con la matriz de transiciones del backend. */
export const ALLOWED_TRANSITIONS: Record<Status, Status[]> = {
  pendiente: ["en_atencion", "resuelto", "descartado"],
  en_atencion: ["pendiente", "resuelto", "cerrado", "descartado"],
  resuelto: ["en_atencion", "cerrado"],
  cerrado: [],
  descartado: ["pendiente"],
};

export type DashboardData = {
  period: { from: string | null; to: string | null };
  indicators: {
    total: number;
    pendientes: number;
    enAtencion: number;
    resueltos: number;
    cerrados: number;
    descartados: number;
    resolutionRate: number;
    teachersIdentified: number;
    totalImports: number;
  };
  charts: {
    byCategory: Array<{ label: string; value: number }>;
    byStatus: Array<{ label: string; value: number }>;
    byRequestType: Array<{ label: string; value: number }>;
    daily: Array<{ label: string; value: number }>;
    weekly: Array<{ label: string; value: number }>;
    monthly: Array<{ label: string; value: number }>;
    topCategories: Array<{ label: string; value: number }>;
    comparison: { current: number; previous: number; delta: number };
  };
  formulas: Record<string, string>;
};

export type AppConfig = {
  timezone: string;
  contextWindowMinutes: number;
  maxUploadMb: number;
  environment: string;
  version: string;
  capabilities: Record<string, boolean>;
  classifierEngine?: ClassifierEngine;
  classifierVersion?: string;
  dictionaryVersion?: string;
  dictionarySource?: "neon" | "memoria";
  tiScope?: ClassifierScope;
};

/** V4: tipos del clasificador explicable. El backend es la única fuente de reglas. */
export type ClassifierEngine = "v3" | "v4";

export type ClassifierScope = {
  profile: string;
  allowedCategories: string[];
  conditionalCategories: string[];
  excludeNonTiByDefault: boolean;
  requireTiEvidenceForNonTi: boolean;
};

export type ClassifierConcept = {
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

export type ClassifierOverview = {
  classifierVersion: string;
  dictionaryVersion: string;
  storage: "neon" | "memoria";
  migrationPending: boolean;
  engine: ClassifierEngine;
  scope: ClassifierScope;
  concepts: number;
  activeConcepts: number;
  categories: number;
  ruleVersions: number;
  statisticalModel: { enabled: boolean; reason: string };
};

export type ClassifierFeedback = {
  originalText: string;
  suggestedCategory: string;
  correctedCategory: string;
  reason: string;
  concepts: string[];
  ruleApplied: string;
  reviewerName: string;
  reviewedAt: string;
  classifierVersion: string;
  dictionaryVersion: string;
};

export type ClassifierSuggestion = {
  id: string;
  kind: string;
  conceptKey: string | null;
  title: string;
  payload: unknown;
  evidenceCount: number;
  status: "pendiente" | "aprobada" | "rechazada";
  notes: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

export type ClassifierRuleVersion = {
  id: string;
  version: string;
  snapshot: { version: string; concepts: ClassifierConcept[]; source: string };
  notes: string | null;
  active: boolean;
  createdAt: string;
};

export type HealthData = {
  status: string;
  database: { connected: boolean; latencyMs: number };
  uptimeSeconds: number;
  environment: string;
  timezone: string;
};

export type SystemUser = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
  hasPassword: boolean;
};
