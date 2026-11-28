import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ImportWizardPage } from "./ImportWizardPage";
import type {
  Category, CommitResult, ExcludedMessage, ImportPreview, PreviewCandidate, Teacher,
} from "../lib/types";

const { get, post, can } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  can: vi.fn((permission: string) => permission === "import"),
}));

vi.mock("../lib/api", () => ({
  api: { get: (...args: unknown[]) => get(...args), post: (...args: unknown[]) => post(...args) },
  errorMessage: (error: unknown) => error instanceof Error ? error.message : "Error inesperado",
  query: () => "",
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ can }),
}));

const category: Category = {
  id: "cat-1",
  name: "TI · Redes e Internet",
  group: "ti",
  description: "Conectividad",
  keywords: ["internet"],
  active: true,
};

const teacher: Teacher = {
  id: "teacher-1",
  fullName: "Docente Prueba",
  normalizedName: "docente prueba",
  email: null,
  active: true,
  aliases: [],
};

function makeCandidate(index: number, patch: Partial<PreviewCandidate> = {}): PreviewCandidate {
  const id = `candidato-${index}`;
  return {
    candidateId: id,
    position: index,
    date: "2026-11-26",
    time: `10:${String(index % 60).padStart(2, "0")}`,
    requesterName: "Remitente Original",
    originalMessage: `No tengo conexión a Internet ${index}`,
    categoryLabel: category.name,
    contextualization: "",
    confidence: "alta",
    explanation: "Regla con peso 4",
    matchedCategories: [category.name],
    ambiguous: false,
    suggestedStatus: "pendiente",
    responses: [],
    teacherId: "teacher-1",
    teacherSuggestion: null,
    teacherCandidates: [],
    teacherName: "Docente Prueba",
    requestType: "ti",
    inclusionStatus: "ti_detectada",
    inclusionReason: "Incidencia TI detectada: Redes e Internet.",
    tiTopics: ["Redes e Internet"],
    nonTiTopics: [],
    mixed: false,
    possibleDuplicate: false,
    selected: true,
    ...patch,
  };
}

function makePreview(candidates: PreviewCandidate[], excluded: ExcludedMessage[] = []): ImportPreview {
  return {
    token: "token-opaco-de-preview-1234567890",
    sourceName: "chat_prueba",
    channel: "texto_pegado",
    totalMessages: 120,
    contentHash: "hash-opaco",
    candidates,
    excluded,
    excludedReasons: excluded.length
      ? [{ status: excluded[0].status, reason: excluded[0].reason, count: excluded.length }]
      : [],
    stats: {
      analyzed: 120,
      detected: candidates.length,
      high: candidates.length,
      medium: 0,
      low: 0,
      ambiguous: 0,
      responses: 0,
      discarded: 120 - candidates.length,
      possibleDuplicates: 0,
      includedTi: candidates.length,
      tiWithAttention: 0,
      requiresReview: 0,
      excludedOutOfScope: excluded.filter((row) => row.status === "fuera_alcance").length,
      excludedNotRelevant: excluded.filter((row) => row.status === "no_pertinente").length,
      excludedDuplicates: excluded.filter((row) => row.status === "duplicado").length,
    },
    format: "desktop",
    invalidDates: 0,
  };
}

const commitResult: CommitResult = {
  analyzed: 120,
  detected: 1,
  confirmed: 1,
  saved: 1,
  duplicateMessages: 0,
  rejected: 0,
  responsesSaved: 0,
  importId: "import-1",
  duplicateConversation: false,
};

async function analyzeChat() {
  fireEvent.change(screen.getByPlaceholderText(/No tengo conexión a Internet/), {
    target: { value: "26/11/26 10:00 - Docente Prueba: No tengo conexión a Internet" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Analizar conversación/i }));
  await screen.findByText(/120 mensajes reconocidos/);
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  get.mockImplementation((path: string) => {
    if (path.includes("/categories")) return Promise.resolve({ data: [category] });
    if (path.includes("/teachers")) return Promise.resolve({ data: [teacher] });
    return Promise.resolve({ data: [] });
  });
  post.mockImplementation((path: string) => {
    if (path.endsWith("/preview")) return Promise.resolve({ data: makePreview([makeCandidate(1)]) });
    if (path.endsWith("/commit")) return Promise.resolve({ data: commitResult });
    return Promise.resolve({ data: {} });
  });
});

describe("Asistente de importación", () => {
  it("muestra el total real de mensajes del preview", async () => {
    render(<ImportWizardPage />);
    await analyzeChat();
    expect(screen.getByText("120")).toBeTruthy();
  });

  it("confirma con el token opaco y candidateId tras confirmación explícita", async () => {
    render(<ImportWizardPage />);
    await analyzeChat();

    fireEvent.click(screen.getByRole("button", { name: /Confirmar e importar/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Sí, guardar selección/i }));

    await waitFor(() => {
      const call = post.mock.calls.find(([path]) => path === "/imports/commit");
      expect(call).toBeDefined();
    });
    const [, body] = post.mock.calls.find(([path]) => path === "/imports/commit")!;
    expect(body).toMatchObject({
      token: "token-opaco-de-preview-1234567890",
      rows: [expect.objectContaining({
        candidateId: "candidato-1",
        selected: true,
        categoryLabel: category.name,
        teacherId: teacher.id,
      })],
    });
    expect(JSON.stringify(body)).not.toContain("hash-opaco");
    expect(Object.keys(body as object)).toEqual(["token", "rows"]);
  });

  it("usa categorías del servidor y no una lista hardcodeada", async () => {
    render(<ImportWizardPage />);
    await analyzeChat();
    expect(get).toHaveBeenCalledWith("/categories");
    expect(screen.getAllByRole("option").some((option) => option.textContent === category.name)).toBe(true);
  });

  it("muestra una sola columna Docente del catálogo, sin Solicitante editable", async () => {
    post.mockImplementation((path: string) => {
      if (path.endsWith("/preview")) return Promise.resolve({ data: makePreview([makeCandidate(1, {
        teacherId: null,
        teacherName: null,
        teacherSuggestion: { teacherId: teacher.id, fullName: teacher.fullName, method: "aproximado", score: 72 },
      })]) });
      return Promise.resolve({ data: commitResult });
    });
    render(<ImportWizardPage />);
    await analyzeChat();

    const headers = screen.getAllByRole("columnheader").map((header) => header.textContent);
    expect(headers).not.toContain("Solicitante");
    expect(headers.filter((header) => header === "Docente")).toHaveLength(1);

    const docenteSelect = screen.getByRole("combobox", { name: "Docente de candidato-1" }) as HTMLSelectElement;
    expect(docenteSelect.value).toBe("");
    expect(screen.getAllByRole("option").some((option) => option.textContent === "Docente no identificado")).toBe(true);
    expect(screen.getAllByRole("option").some((option) => option.textContent === "Docente Prueba")).toBe(true);
    expect(screen.queryByRole("textbox", { name: /Solicitante/ })).toBeNull();
  });

  it("pagina candidatos localmente y conserva la selección entre páginas", async () => {
    const candidates = Array.from({ length: 12 }, (_, index) => makeCandidate(index + 1, { selected: false }));
    post.mockImplementation((path: string) => {
      if (path.endsWith("/preview")) return Promise.resolve({ data: makePreview(candidates) });
      return Promise.resolve({ data: commitResult });
    });
    render(<ImportWizardPage />);
    await analyzeChat();

    const pageSelector = screen.getAllByRole("combobox", { name: "Registros por página" })[0];
    fireEvent.change(pageSelector, { target: { value: "5" } });
    expect(screen.getAllByRole("checkbox", { name: /Guardar mensaje de candidato-/ })).toHaveLength(5);
    expect(screen.getByText(/12 registro\(s\) · página 1 de 3/)).toBeTruthy();

    fireEvent.click(screen.getByRole("checkbox", { name: "Guardar mensaje de candidato-1" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Siguiente" })[0]);
    expect(screen.queryByRole("checkbox", { name: "Guardar mensaje de candidato-1" })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Guardar mensaje de candidato-6" })).toBeTruthy();
    expect(document.querySelector(".selection-count")?.textContent).toMatch(/1 seleccionado\(s\) de 12/);

    fireEvent.click(screen.getAllByRole("button", { name: "Anterior" })[0]);
    expect((screen.getByRole("checkbox", { name: "Guardar mensaje de candidato-1" }) as HTMLInputElement).checked).toBe(true);
  });

  it("selecciona todos los filtrados desde el encabezado indeterminado", async () => {
    const candidates = [makeCandidate(1, { selected: false }), makeCandidate(2, { selected: false })];
    post.mockImplementation((path: string) => {
      if (path.endsWith("/preview")) return Promise.resolve({ data: makePreview(candidates) });
      return Promise.resolve({ data: commitResult });
    });
    render(<ImportWizardPage />);
    await analyzeChat();

    const header = screen.getByRole("checkbox", { name: "Seleccionar todos los candidatos filtrados" }) as HTMLInputElement;
    expect(header.checked).toBe(false);
    fireEvent.click(screen.getByRole("checkbox", { name: "Guardar mensaje de candidato-1" }));
    expect(header.indeterminate).toBe(true);
    fireEvent.click(header);
    expect((screen.getByRole("checkbox", { name: "Guardar mensaje de candidato-2" }) as HTMLInputElement).checked).toBe(true);
    expect(document.querySelector(".selection-count")?.textContent).toMatch(/2 seleccionado\(s\) de 2/);
    fireEvent.click(screen.getByRole("button", { name: "Deseleccionar todos" }));
    expect(header.checked).toBe(false);
  });

  it("muestra excluidos revisables y no seleccionables con su motivo", async () => {
    const excluded: ExcludedMessage[] = [{
      position: 9,
      date: "2026-11-26",
      time: "11:00",
      sender: "Área de mantenimiento",
      originalMessage: "Faltan sillas en el aula",
      status: "fuera_alcance",
      reason: "Fuera del alcance TI: Mobiliario y materiales. No se selecciona automáticamente.",
    }];
    post.mockImplementation((path: string) => {
      if (path.endsWith("/preview")) return Promise.resolve({ data: makePreview([makeCandidate(1)], excluded) });
      return Promise.resolve({ data: commitResult });
    });
    render(<ImportWizardPage />);
    await analyzeChat();

    const heading = screen.getByRole("heading", { name: /Mensajes excluidos del perfil TI/ });
    const section = heading.closest("section")!;
    expect(within(section).getAllByText(/Fuera del alcance TI: Mobiliario y materiales/).length).toBeGreaterThan(0);
    expect(within(section).queryByRole("checkbox")).toBeNull();
    expect(screen.getAllByText("Fuera del alcance TI").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Ver detalle del excluido 9" }));
    const drawer = screen.getByRole("complementary", { name: "Detalle de mensaje excluido" });
    expect(within(drawer).getByText("Faltan sillas en el aula")).toBeTruthy();
  });

  it("conserva el mensaje original y no presenta «me acerco» como resolución", async () => {
    post.mockImplementation((path: string) => {
      if (path.endsWith("/preview")) return Promise.resolve({ data: makePreview([makeCandidate(1, {
        requesterName: "Ana Pérez",
        suggestedStatus: "en_atencion",
        responses: [{
          sender: "Personal TI", text: "Me acerco al aula 203", date: "2026-11-26", time: "10:02",
          role: "seguimiento", uncertain: false, score: 8, isStaff: true,
        }],
      })]) });
      return Promise.resolve({ data: commitResult });
    });
    render(<ImportWizardPage />);
    await analyzeChat();

    fireEvent.click(screen.getByRole("button", { name: "Ver detalle de candidato-1" }));
    const drawer = screen.getByRole("complementary", { name: "Detalle de candidato" });
    expect(within(drawer).getByText("No tengo conexión a Internet 1")).toBeTruthy();
    expect(screen.getByText(/Remitente original \(trazabilidad, no editable\): Ana Pérez/)).toBeTruthy();
    expect(screen.getByText(/no implica incidencia resuelta/)).toBeTruthy();
    expect(screen.queryByText(/Ya quedó solucionado/)).toBeNull();
  });
});
