import { useEffect, useRef, useState, type FormEvent } from "react";
import { Database, LockKeyhole } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { api, errorMessage } from "../lib/api";
import type { HealthData } from "../lib/types";
import { Badge, Button, ErrorBanner, Field, Input } from "../components/ui";

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<HealthData | null>(null);
  const submitting = useRef(false);

  useEffect(() => {
    api.get<HealthData>("/health").then(({ data }) => setHealth(data)).catch(() => setHealth(null));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (caught) {
      setError(caught);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand"><LockKeyhole size={22} /> TI SmartDesk</div>
        <h1>Ingreso al sistema</h1>
        <p className="muted">Registro y gestión de incidencias institucionales. El acceso es nominal y queda registrado en auditoría.</p>
        <Field label="Correo institucional">
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="username" placeholder="usuario@institucion.edu.pe" />
        </Field>
        <Field label="Contraseña">
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" placeholder="Mínimo 12 caracteres" />
        </Field>
        <ErrorBanner error={error} />
        <Button type="submit" variant="primary" disabled={busy} className="full-width">
          {busy ? "Ingresando…" : "Iniciar sesión"}
        </Button>
        <div className="login-foot">
          <Database size={15} />
          <span>
            Estado de la base: {" "}
            {health?.database.connected
              ? <Badge tone="success">Conectada ({health.database.latencyMs} ms)</Badge>
              : <Badge tone="danger">No disponible</Badge>}
          </span>
        </div>
        <p className="muted small">Las cuentas se crean con <code>npm run create:admin</code> en el backend. No existen credenciales por defecto.</p>
        {error ? <p className="muted small">{errorMessage(error)}</p> : null}
      </form>
    </div>
  );
}
