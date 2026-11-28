import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DocentesPage } from "./DocentesPage";
import type { Teacher, TeacherImportRow } from "../lib/types";

const { get, post, patch, can } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  can: vi.fn(),
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

const teachers: Teacher[] = Array.from({ length: 31 }, (_, index) => {
  const fullName = `Docente ${String(index + 1).padStart(2, "0")}`;
  return {
    id: `teacher-${index + 1}`,
    fullName,
    normalizedName: fullName.toLocaleLowerCase("es"),
    email: null,
    active: true,
    aliases: [],
  };
});

const previewRow: TeacherImportRow = {
  rowNumber: 2,
  nombres: "Ana",
  apellidos: "Pérez",
  fullName: "Ana Pérez",
  email: "ana@institucion.edu.pe",
  code: "",
  alias: "",
  errors: [],
  duplicate: false,
  selected: true,
};

const teacherPreview = {
  token: "token-opaco-de-preview-1234567890",
  rows: [previewRow],
  totalRows: 1,
  validRows: 1,
  invalidRows: 0,
};

function teachersResponse(path: string) {
  const url = new URL(path, "http://localhost");
  const limit = Number(url.searchParams.get("limit") ?? 10);
  const requestedPage = Number(url.searchParams.get("page") ?? 1);
  const totalPages = Math.max(1, Math.ceil(teachers.length / limit));
  const page = Math.min(requestedPage, totalPages);
  return {
    data: teachers.slice((page - 1) * limit, page * limit),
    meta: { page, limit, total: teachers.length, totalPages },
  };
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  patch.mockReset();
  can.mockReset();
  can.mockImplementation(() => true);
  get.mockImplementation((path: string) => Promise.resolve(teachersResponse(path)));
  post.mockImplementation((path: string) => {
    if (path.endsWith("/import/preview")) return Promise.resolve({ data: teacherPreview });
    if (path.endsWith("/import/commit")) return Promise.resolve({ data: { created: 1, skipped: 0 } });
    return Promise.resolve({ data: {} });
  });
});

describe("Catálogo de docentes", () => {
  it("interpreta el envelope y muestra los 31 docentes activos con paginación remota", async () => {
    render(<DocentesPage />);

    expect(await screen.findByText("31 registro(s) · página 1 de 4")).toBeTruthy();
    expect(get).toHaveBeenCalledWith("/teachers?page=1&limit=10");
    expect(screen.getAllByRole("row")).toHaveLength(11);
    expect(screen.getAllByText("Activo")).toHaveLength(10);
    expect(screen.queryByRole("alert")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => expect(get).toHaveBeenCalledWith("/teachers?page=2&limit=10"));
    expect(screen.getByText("Docente 11")).toBeTruthy();
    expect(screen.getByText("31 registro(s) · página 2 de 4")).toBeTruthy();
  });

  it("solicita y respeta tamaños de 5, 10 y 20 registros", async () => {
    render(<DocentesPage />);
    await screen.findByText("31 registro(s) · página 1 de 4");

    const selector = screen.getByRole("combobox", { name: "Registros por página" });
    for (const [limit, totalPages] of [[5, 7], [20, 2], [10, 4]] as const) {
      fireEvent.change(selector, { target: { value: String(limit) } });
      await waitFor(() => expect(get).toHaveBeenLastCalledWith(`/teachers?page=1&limit=${limit}`));
      expect(await screen.findByText(`31 registro(s) · página 1 de ${totalPages}`)).toBeTruthy();
      expect(screen.getAllByRole("row")).toHaveLength(limit + 1);
    }
  });

  it("recarga el listado después de confirmar una importación", async () => {
    render(<DocentesPage />);
    await screen.findByText("31 registro(s) · página 1 de 4");
    const callsBeforeImport = get.mock.calls.length;

    const file = new File(["contenido sintético"], "docentes.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    fireEvent.change(screen.getByLabelText("Archivo .xlsx"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /Previsualizar/i }));
    await screen.findByText(/1 filas leídas/);
    fireEvent.click(screen.getByRole("button", { name: /Confirmar importación/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Sí, importar docentes/i }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/teachers/import/commit", {
      token: teacherPreview.token,
      rows: [{ rowNumber: 2, selected: true }],
    }));
    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(callsBeforeImport));
  });
});
