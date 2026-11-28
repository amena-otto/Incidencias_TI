import { useCallback, useEffect, useState, type FormEvent } from "react";
import { FileText, KeyRound, ShieldCheck } from "lucide-react";
import { api, query } from "../lib/api";
import { formatDateTime } from "../lib/format";
import type { Role, SystemUser } from "../lib/types";
import {
  Badge, Button, ErrorBanner, Field, Input, Loading, NoPermission, Pagination,
  Panel, Select, SuccessBanner, type PageSize,
} from "../components/ui";
import { DetailDrawer, SearchBox } from "../components/table";
import { useAuth } from "../auth/AuthContext";

const ROLES: Role[] = ["admin", "tecnico", "consulta"];
const ROLE_LABELS: Record<Role, string> = { admin: "Administrador", tecnico: "Técnico", consulta: "Consulta" };

export function UsuariosPage() {
  const { can } = useAuth();
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<PageSize>(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("consulta");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, meta } = await api.get<SystemUser[]>(`/users${query({ search, page, limit })}`);
      setUsers(data);
      setTotal(Number(meta?.total ?? data.length));
      setTotalPages(Number(meta?.totalPages ?? 1));
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, [search, page, limit]);

  useEffect(() => {
    if (can("users:write")) void load();
  }, [can, load]);

  if (!can("users:write")) return <NoPermission permission="users:write" />;

  async function create(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api.post("/users", { fullName, email, password, role });
      setNotice("Usuario creado. Comparte la contraseña por un canal seguro.");
      setFullName(""); setEmail(""); setPassword(""); setRole("consulta");
      void load();
    } catch (caught) {
      setError(caught);
    }
  }

  async function update(user: SystemUser, patch: Partial<Pick<SystemUser, "role" | "active">>) {
    try {
      await api.patch(`/users/${user.id}`, patch);
      setNotice("Usuario actualizado.");
      void load();
    } catch (caught) {
      setError(caught);
    }
  }

  async function resetPassword(event: FormEvent) {
    event.preventDefault();
    if (!resetFor) return;
    try {
      await api.post(`/users/${resetFor}/reset-password`, { password: newPassword });
      setNotice("Contraseña actualizada.");
      setResetFor(null);
      setNewPassword("");
      setDetailId(null);
      void load();
    } catch (caught) {
      setError(caught);
    }
  }

  const detail = users.find((user) => user.id === detailId) ?? null;

  return (
    <>
      <Panel title="Usuarios y permisos" subtitle="RBAC en backend: administrador, técnico y consulta. Ninguna contraseña se muestra ni se almacena en texto plano.">
        <ErrorBanner error={error} onClose={() => setError(null)} />
        <SuccessBanner>{notice}</SuccessBanner>
        <div className="filter-row">
          <SearchBox value={search} onChange={(value) => { setSearch(value); setPage(1); }}
            placeholder="Nombre o correo" label="Buscar usuario" />
        </div>
        {loading ? <Loading label="Cargando usuarios…" /> : (
          <div className="tablewrap">
            <table className="data-table">
              <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Contraseña</th><th className="action-col">Detalle</th></tr></thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.fullName}</td>
                    <td><div className="clamp-cell" title={user.email}>{user.email}</div></td>
                    <td>{ROLE_LABELS[user.role] ?? user.role}</td>
                    <td><Badge tone={user.active ? "success" : "neutral"}>{user.active ? "Activo" : "Inactivo"}</Badge></td>
                    <td><Badge tone={user.hasPassword ? "info" : "warning"}>{user.hasPassword ? "Configurada" : "Sin hash"}</Badge></td>
                    <td><button type="button" className="icon-btn" aria-label={`Ver detalle de ${user.fullName}`}
                      onClick={() => setDetailId(user.id)}><FileText size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage}
          limit={limit} onLimitChange={(next) => { setLimit(next); setPage(1); }} />
      </Panel>

      <div className="two-columns">
        <Panel title="Nuevo usuario">
          <form onSubmit={create} className="form-stack">
            <Field label="Nombre completo"><Input value={fullName} onChange={(event) => setFullName(event.target.value)} required minLength={3} /></Field>
            <Field label="Correo"><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></Field>
            <Field label="Contraseña" hint="Mínimo 12 caracteres"><Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} /></Field>
            <Field label="Rol">
              <Select value={role} onChange={(event) => setRole(event.target.value as Role)}>
                {ROLES.map((value) => <option key={value} value={value}>{ROLE_LABELS[value]}</option>)}
              </Select>
            </Field>
            <Button type="submit" variant="primary"><ShieldCheck size={15} /> Crear usuario</Button>
          </form>
        </Panel>
        {resetFor && (
          <Panel title="Restablecer contraseña">
            <form onSubmit={resetPassword} className="form-stack">
              <Field label="Nueva contraseña" hint="Mínimo 12 caracteres">
                <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={12} />
              </Field>
              <div className="button-row">
                <Button type="submit" variant="primary">Guardar</Button>
                <Button variant="ghost" onClick={() => setResetFor(null)}>Cancelar</Button>
              </div>
            </form>
          </Panel>
        )}
      </div>

      {detail && (
        <DetailDrawer title={detail.fullName} subtitle="Gestión de usuario" label="Detalle de usuario" onClose={() => setDetailId(null)}>
          <div className="badge-row">
            <Badge tone="info">{ROLE_LABELS[detail.role] ?? detail.role}</Badge>
            <Badge tone={detail.active ? "success" : "neutral"}>{detail.active ? "Activo" : "Inactivo"}</Badge>
          </div>
          <p className="muted">{detail.email} · creado {formatDateTime(detail.createdAt)}</p>
          <div className="drawer-section form-stack">
            <h3>Permisos y estado</h3>
            <Field label="Rol">
              <Select aria-label={`Rol de ${detail.fullName}`} value={detail.role}
                onChange={(event) => void update(detail, { role: event.target.value as Role })}>
                {ROLES.map((value) => <option key={value} value={value}>{ROLE_LABELS[value]}</option>)}
              </Select>
            </Field>
            <div className="button-row">
              <Button onClick={() => void update(detail, { active: !detail.active })}>{detail.active ? "Desactivar" : "Activar"}</Button>
              <Button variant="ghost" onClick={() => { setResetFor(detail.id); setNewPassword(""); }}>
                <KeyRound size={14} /> Restablecer contraseña
              </Button>
            </div>
          </div>
        </DetailDrawer>
      )}
    </>
  );
}
