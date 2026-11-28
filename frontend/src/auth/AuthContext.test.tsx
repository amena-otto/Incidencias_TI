import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";
import { getCsrfToken, setCsrfToken } from "../lib/api";

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  } as Response;
}

function Probe() {
  const { authenticated, user, login } = useAuth();
  return (
    <div>
      <span data-testid="auth">{String(authenticated)}</span>
      <span data-testid="user">{user?.fullName ?? ""}</span>
      <button type="button" onClick={() => void login("admin@example.edu", "contraseña-de-prueba")}>Entrar</button>
    </div>
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    setCsrfToken("");
    vi.unstubAllGlobals();
  });

  it("marca la sesión autenticada aunque el login herede una respuesta sin authenticated", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true, data: { authenticated: false, permissions: [] } }))
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        data: {
          user: { id: "u-1", fullName: "Administrador TI", email: "admin@example.edu", role: "admin" },
          csrfToken: "csrf-de-prueba",
          expiresAt: "2026-11-27T10:00:00.000Z",
          permissions: ["incidents:read"],
        },
      }));
    vi.stubGlobal("fetch", fetchMock);

    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("auth").textContent).toBe("false"));

    fireEvent.click(screen.getByText("Entrar"));

    await waitFor(() => expect(screen.getByTestId("auth").textContent).toBe("true"));
    expect(screen.getByTestId("user").textContent).toBe("Administrador TI");
    expect(getCsrfToken()).toBe("csrf-de-prueba");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
