<<<<<<< Updated upstream
import { useState } from "react";
import { Upload, Inbox, LayoutDashboard, Search, CheckCircle2, Download, MessageSquareText, Database, AlertCircle } from "lucide-react";

const API = "http://localhost:3001/api";
type Row = {
  date: string; time: string; requesterName: string; originalMessage: string;
  categoryLabel: string; contextualization: string; selected: boolean; reason: string; confidence: string;
};
const CATEGORIES = [
  "TI · Redes e Internet", "TI · Equipos audiovisuales", "TI · Hardware y periféricos",
  "TI · Software y plataformas", "TI · Impresoras", "Asistencia · Marcación y asistencia",
  "Infraestructura · Electricidad y mantenimiento", "Operaciones · Apertura y acceso a ambientes",
  "Operaciones · Mobiliario y materiales", "Operaciones · Programación de laboratorios",
  "Operaciones · Limpieza y ambiente", "Seguridad · Salud y ambiente", "Otros · Solicitud de apoyo sin detalle",
];

=======
import {
  lazy, Suspense, useEffect, useMemo, useState,
  type ComponentType, type LazyExoticComponent,
} from "react";
import {
  Cpu, Database, FileBarChart2, GraduationCap, Inbox, LayoutDashboard, LogOut, Menu,
  Settings, ShieldCheck, Tags, Upload, Users, type LucideIcon,
} from "lucide-react";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { Loading } from "./components/ui";

/**
 * Las vistas se cargan bajo demanda para no enviar Recharts ni el resto de
 * formularios en el paquete inicial. La sesión y el login permanecen activos.
 */
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const ImportWizardPage = lazy(() => import("./pages/ImportWizardPage").then((m) => ({ default: m.ImportWizardPage })));
const IncidenciasPage = lazy(() => import("./pages/IncidenciasPage").then((m) => ({ default: m.IncidenciasPage })));
const DocentesPage = lazy(() => import("./pages/DocentesPage").then((m) => ({ default: m.DocentesPage })));
const CategoriasPage = lazy(() => import("./pages/CategoriasPage").then((m) => ({ default: m.CategoriasPage })));
const ReportesPage = lazy(() => import("./pages/ReportesPage").then((m) => ({ default: m.ReportesPage })));
const UsuariosPage = lazy(() => import("./pages/UsuariosPage").then((m) => ({ default: m.UsuariosPage })));
const ConfiguracionPage = lazy(() => import("./pages/ConfiguracionPage").then((m) => ({ default: m.ConfiguracionPage })));
const ClasificadorPage = lazy(() => import("./pages/ClasificadorPage").then((m) => ({ default: m.ClasificadorPage })));

type PageId = "dashboard" | "import" | "incidents" | "teachers" | "categories" | "reports" | "users" | "config" | "classifier";

type NavItem = {
  id: PageId;
  label: string;
  icon: LucideIcon;
  permission?: string;
  component: ComponentType | LazyExoticComponent<ComponentType>;
};

const NAV: NavItem[] = [
  { id: "dashboard", label: "Panel", icon: LayoutDashboard, permission: "incidents:read", component: DashboardPage },
  { id: "import", label: "Importar chat", icon: Upload, permission: "import", component: ImportWizardPage },
  { id: "incidents", label: "Incidencias", icon: Inbox, permission: "incidents:read", component: IncidenciasPage },
  { id: "teachers", label: "Docentes", icon: GraduationCap, component: DocentesPage },
  { id: "categories", label: "Categorías", icon: Tags, component: CategoriasPage },
  { id: "reports", label: "Reportes", icon: FileBarChart2, permission: "reports:read", component: ReportesPage },
  { id: "users", label: "Usuarios", icon: Users, permission: "users:write", component: UsuariosPage },
  { id: "config", label: "Configuración", icon: Settings, component: ConfiguracionPage },
  { id: "classifier", label: "Clasificador V4", icon: Cpu, permission: "config:write", component: ClasificadorPage },
];

const TITLES: Record<PageId, { title: string; subtitle: string }> = {
  dashboard: { title: "Panel de indicadores", subtitle: "Mesa de ayuda TI" },
  import: { title: "Importar conversación", subtitle: "Revisión humana antes de guardar" },
  incidents: { title: "Incidencias", subtitle: "Registros persistidos y gestionables" },
  teachers: { title: "Docentes", subtitle: "Catálogo institucional y alias" },
  categories: { title: "Categorías", subtitle: "Catálogo único del clasificador" },
  reports: { title: "Reportes", subtitle: "Exportación institucional en Excel" },
  users: { title: "Usuarios", subtitle: "Acceso nominal y RBAC" },
  config: { title: "Configuración", subtitle: "Parámetros y estado operativo" },
  classifier: { title: "Clasificador V4", subtitle: "Diccionario, evidencia y aprobación humana" },
};

function Shell() {
  const { loading, authenticated, user, logout, can } = useAuth();
  const [active, setActive] = useState<PageId>("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const visible = useMemo(() => NAV.filter((item) => !item.permission || can(item.permission)), [can]);

  useEffect(() => {
    if (!visible.some((item) => item.id === active)) setActive(visible[0]?.id ?? "dashboard");
  }, [visible, active]);

  if (loading) {
    return <div className="app-loading"><Loading label="Verificando sesión…" /></div>;
  }
  if (!authenticated) return <LoginPage />;

  const current = visible.find((item) => item.id === active) ?? visible[0];
  const Page = current?.component ?? DashboardPage;
  const heading = TITLES[current?.id ?? "dashboard"];

  async function signOut() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="layout">
      <aside className={menuOpen ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <span className="brand-mark">◈</span>
          <div><strong>TI SmartDesk</strong><small>Mesa de ayuda institucional</small></div>
        </div>
        <nav>
          {visible.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={active === item.id ? "nav-item active" : "nav-item"}
                onClick={() => { setActive(item.id); setMenuOpen(false); }}>
                <Icon size={17} /> {item.label}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <p><ShieldCheck size={14} /> Acceso nominal · sesión HttpOnly</p>
          <p><Database size={14} /> PostgreSQL · sin IA de pago</p>
        </div>
      </aside>

      <main className="main-content">
        <header className="app-header">
          <button className="icon-btn menu-toggle" aria-label="Abrir menú" onClick={() => setMenuOpen((value) => !value)}><Menu size={20} /></button>
          <div>
            <small>{heading.subtitle.toUpperCase()}</small>
            <h1>{heading.title}</h1>
          </div>
          <div className="header-right">
            <div className="user-chip">
              <span className="avatar">{user?.fullName.slice(0, 1).toUpperCase() ?? "U"}</span>
              <div><strong>{user?.fullName}</strong><small>{user?.role}</small></div>
            </div>
            <button className="icon-btn" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={() => void signOut()} disabled={loggingOut}>
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <div className="page-content">
          <Suspense fallback={<Loading label="Cargando vista…" />}>
            <Page />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

>>>>>>> Stashed changes
export default function App() {
  const [tab, setTab] = useState("import");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [importHash, setImportHash] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [importChannel, setImportChannel] = useState<"whatsapp_txt" | "texto_pegado">("texto_pegado");
  const [totalMessages, setTotalMessages] = useState(0);

  async function analyze() {
    setBusy(true); setMessage("");
    try {
      const form = new FormData();
      if (file) form.append("file", file); else form.append("text", text);
      const response = await fetch(`${API}/imports/preview`, { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "No se pudo analizar el chat.");
      setRows(data.candidates); setImportHash(data.hash); setSourceName(data.sourceName); setImportChannel(data.channel);
      setMessage(`Análisis terminado: ${data.totalMessages} mensajes reconocidos, ${data.candidates.length} candidatos y ${data.unclassifiedMessages} mensajes no clasificados.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error inesperado al analizar.");
    } finally { setBusy(false); }
  }

  function edit(index: number, key: keyof Row, value: string | boolean) {
    setRows((current) => current.map((row, i) => i === index ? { ...row, [key]: value } : row));
  }

  async function save() {
    const selected = rows.filter((row) => row.selected);
    if (!selected.length || !importHash) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`${API}/imports/commit`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hash: importHash, sourceName, channel: importChannel, totalMessages,
          rows: selected.map(({ date, time, requesterName, originalMessage, categoryLabel, contextualization }) =>
            ({ date, time, requesterName, originalMessage, categoryLabel, contextualization })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "No se pudo guardar.");
      setMessage(`Importación registrada. Se guardaron ${data.saved} incidencias en Neon.`);
      setRows([]); setText(""); setFile(null); setImportHash(""); setSourceName(""); setTotalMessages(0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error inesperado al guardar.");
    } finally { setBusy(false); }
  }

  return <div className="layout">
    <aside>
      <h2>◈ TI SmartDesk</h2><p>Registro de incidencias y requerimientos</p>
      <button onClick={() => setTab("import")}><Upload /> Importar chat</button>
      <button onClick={() => setTab("list")}><Inbox /> Registros</button>
      <button onClick={() => setTab("report")}><LayoutDashboard /> Reportes</button>
      <small>Atención continúa por WhatsApp</small>
    </aside>
    <main>
      <header><div><small>MESA DE AYUDA TI</small><h1>{tab === "import" ? "Importar conversación" : tab === "list" ? "Registros" : "Reportes"}</h1></div><span><Database size={16} /> Neon PostgreSQL · Sin IA</span></header>
      {message && <p className="notice"><AlertCircle size={16} /> {message}</p>}
      {tab === "import" && <>
        <section className="panel intro"><MessageSquareText /><div><b>Convierte conversaciones en registros organizados</b><p>Sube una exportación TXT de WhatsApp o pega el contenido. Revisa cada candidato antes de guardarlo en Neon.</p></div></section>
        <section className="panel">
          <h3>1. Conversación de WhatsApp</h3>
          <input type="file" accept=".txt,text/plain" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRows([]); setImportHash(""); }} />
          <p className="muted">O pega el texto:</p>
          <textarea rows={8} value={text} onChange={(e) => { setText(e.target.value); setFile(null); setRows([]); setImportHash(""); }} placeholder="2/11/26 20:01 - Docente: No tengo conexión a Internet..." />
          <button className="primary" disabled={busy || (!file && !text.trim())} onClick={analyze}><Search /> {busy ? "Procesando..." : "Analizar conversación"}</button>
        </section>
        {rows.length > 0 && <section className="panel">
          <h3>2. Revisa los requerimientos ({rows.filter((row) => row.selected).length} seleccionados)</h3>
          <p className="muted">Origen: {sourceName}. SHA-256 evita volver a importar el mismo contenido.</p>
          <div className="tablewrap"><table><thead><tr><th>Guardar</th><th>Fecha/hora</th><th>Solicitante</th><th>Mensaje</th><th>Categoría</th><th>Contextualización</th></tr></thead>
            <tbody>{rows.map((row, index) => <tr key={`${row.date}-${row.time}-${index}`}>
              <td><input type="checkbox" checked={row.selected} onChange={(e) => edit(index, "selected", e.target.checked)} /><small>{row.confidence}</small></td>
              <td>{row.date}<br />{row.time}</td>
              <td><input value={row.requesterName} onChange={(e) => edit(index, "requesterName", e.target.value)} /></td>
              <td>{row.originalMessage}<small>{row.reason}</small></td>
              <td><select value={row.categoryLabel} onChange={(e) => edit(index, "categoryLabel", e.target.value)}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></td>
              <td><textarea rows={2} value={row.contextualization} onChange={(e) => edit(index, "contextualization", e.target.value)} /></td>
            </tr>)}</tbody>
          </table></div>
          <button className="primary" onClick={save} disabled={busy || !rows.some((row) => row.selected)}><CheckCircle2 /> {busy ? "Guardando..." : "Confirmar e importar a Neon"}</button>
        </section>}
      </>}
      {tab === "list" && <section className="panel"><h3>Registros guardados</h3><p>Consulta las incidencias persistidas en Neon.</p><a href={`${API}/incidents`} target="_blank" rel="noreferrer">Abrir registros en JSON</a></section>}
      {tab === "report" && <section className="panel"><h3><Download /> Exportar Excel</h3><Report /></section>}
    </main>
  </div>;
}

function Report() {
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  return <div className="dates">
    <label>Desde<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
    <label>Hasta<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
    <a className="primary" href={`${API}/reports/xlsx?from=${from}&to=${to}`}><Download /> Descargar Excel</a>
  </div>;
}
