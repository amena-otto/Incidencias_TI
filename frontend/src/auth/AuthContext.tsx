import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiFetch, setCsrfToken } from "../lib/api";
import type { AuthState } from "../lib/types";

type AuthContextValue = AuthState & {
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  can: (permission: string) => boolean;
};

const anonymous: AuthState = { authenticated: false, permissions: [] };
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(anonymous);
  const [loading, setLoading] = useState(true);

  const apply = useCallback((data: AuthState) => {
    setCsrfToken(data.csrfToken);
    setState({
      // El backend incluye `authenticated: true` en /login y /me. Si una
      // respuesta anterior no lo trae, la presencia de usuario acredita la sesión.
      authenticated: data.authenticated ?? Boolean(data.user),
      user: data.user,
      permissions: data.permissions,
      expiresAt: data.expiresAt,
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const { data } = await apiFetch<AuthState>("/auth/me");
      apply(data);
    } catch {
      setCsrfToken("");
      setState(anonymous);
    } finally {
      setLoading(false);
    }
  }, [apply]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await apiFetch<AuthState>("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    apply({ ...data, authenticated: true });
  }, [apply]);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } finally {
      setCsrfToken("");
      setState(anonymous);
    }
  }, []);

  const can = useCallback((permission: string) => state.permissions.includes(permission), [state.permissions]);

  const value = useMemo<AuthContextValue>(() => ({
    ...state,
    loading,
    login,
    logout,
    refresh,
    can,
  }), [state, loading, login, logout, refresh, can]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
}
