import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ClasificadorPage } from "./ClasificadorPage";
import type {
  ClassifierConcept, ClassifierFeedback, ClassifierOverview,
  ClassifierRuleVersion, ClassifierSuggestion,
} from "../lib/types";

const { get, post, patch, can } = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), patch: vi.fn(), can: vi.fn(),
}));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    api: {
      get: (path: string) => get(path),
      post: (path: string, body?: unknown) => post(path, body),
      patch: (path: string, body?: unknown) => patch(path, body),
      del: vi.fn(),
    },
  };
});

vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ can }) }));

const overview: ClassifierOverview = {
  classifierVersion: "V4.0.0",
  dictionaryVersion: "V4.0.0-seed",
  storage: "memoria",
  migrationPending: true,
  engine: "v4",
  scope: {
    profile: "TI_INSTITUCIONAL",
    allowedCategories: ["TI · Redes e Internet"],
    conditionalCategories: ["Asistencia · Marcación y asistencia"],
    excludeNonTiByDefault: true,
    requireTiEvidenceForNonTi: true,
  },
  concepts: 2,
  activeConcepts: 2,
  categories: 13,
  ruleVersions: 1,
  statisticalModel: { enabled: false, reason: "Sin datos etiquetados suficientes." },
};

const concept: ClassifierConcept = {
  id: "concept-1", key: "red-sin-conectividad", category: "TI · Redes e Internet",
  name: "Sin conectividad", description: "Falta de acceso a Internet",
  synonyms: ["internet"], expressions: ["no tengo internet"], variants: [],
  abbreviations: [], related: ["aula"], negatives: ["impresora"],
  weight: 5, priority: 10, active: true, updatedAt: "2026-11-28T00:00:00.000Z", version: "V4.0.0-seed",
};

const feedback: ClassifierFeedback = {
  originalText: "Faltan sillas", suggestedCategory: "TI · Hardware y periféricos",
  correctedCategory: "Operaciones · Mobiliario y materiales", reason: "Corrección humana",
  concepts: [], ruleApplied: "", reviewerName: "Ana", reviewedAt: "2026-11-28T10:00:00.000Z",
  classifierVersion: "V4.0.0", dictionaryVersion: "V4.0.0-seed",
};

const suggestion: ClassifierSuggestion = {
  id: "sug-1", kind: "correccion_repetida", conceptKey: null,
  title: "Revisar regla: corregida 3 veces", payload: {}, evidenceCount: 3,
  status: "pendiente", notes: null, createdAt: "2026-11-28T10:00:00.000Z", resolvedAt: null,
};

const version: ClassifierRuleVersion = {
  id: "ver-1", version: "V4.0.0-seed", snapshot: { version: "V4.0.0-seed", concepts: [concept], source: "memoria" },
  notes: "semilla", active: true, createdAt: "2026-11-28T10:00:00.000Z",
};

beforeEach(() => {
  get.mockReset(); post.mockReset(); patch.mockReset(); can.mockReset();
  can.mockImplementation(() => true);
  get.mockImplementation((path: string) => {
    if (path.startsWith("/classifier")) {
      if (path.startsWith("/classifier/concepts")) return Promise.resolve({ data: { version: "V4.0.0-seed", concepts: [concept] } });
      if (path.startsWith("/classifier/feedback")) return Promise.resolve({ data: { entries: [feedback] } });
      if (path.startsWith("/classifier/suggestions")) return Promise.resolve({ data: { suggestions: [suggestion] } });
      if (path.startsWith("/classifier/versions")) return Promise.resolve({ data: { versions: [version] } });
      return Promise.resolve({ data: overview });
    }
    return Promise.resolve({ data: {} });
  });
  post.mockImplementation(() => Promise.resolve({ data: {} }));
  patch.mockImplementation(() => Promise.resolve({ data: {} }));
});

describe("Administración del clasificador V4", () => {
  it("muestra versión, migración pendiente y permite volver a V3", async () => {
    render(<ClasificadorPage />);
    expect(await screen.findByText(/Migración 0003 pendiente/)).toBeTruthy();
    expect(screen.getAllByText("V4.0.0-seed").length).toBeGreaterThan(0);
    expect(screen.getByText("Sin conectividad")).toBeTruthy();

    fireEvent.change(screen.getByRole("combobox", { name: "Motor de clasificación" }), { target: { value: "v3" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar motor" }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/config", { classifierEngine: "v3" }));
  });

  it("genera sugerencias y las resuelve sin activar reglas automáticamente", async () => {
    render(<ClasificadorPage />);
    await screen.findByText("Revisar regla: corregida 3 veces");

    fireEvent.click(screen.getByRole("button", { name: "Generar sugerencias" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/classifier/suggestions/generate", undefined));

    fireEvent.click(screen.getByRole("button", { name: "Aprobar" }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/classifier/suggestions/sug-1", {
      status: "aprobada", notes: "Aprobada por revisión humana.",
    }));
    expect(await screen.findByText(/Reglas sin activar automáticamente/)).toBeTruthy();
  });

  it("registra sinónimos y conserva la auditoría de la corrección", async () => {
    render(<ClasificadorPage />);
    await screen.findByText("Sin conectividad");
    expect(screen.getByText(/TI · Hardware y periféricos → Operaciones · Mobiliario y materiales/)).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox", { name: "Sinónimos para Sin conectividad" }), { target: { value: "inalámbrico" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/classifier/concepts/red-sin-conectividad/synonyms", { terms: ["inalámbrico"] }));
  });

  it("no muestra controles administrativos sin config:write", async () => {
    can.mockImplementation(() => false);
    render(<ClasificadorPage />);
    expect(await screen.findByText(/Tu perfil no tiene el permiso config:write/)).toBeTruthy();
    expect(get).not.toHaveBeenCalled();
  });
});
