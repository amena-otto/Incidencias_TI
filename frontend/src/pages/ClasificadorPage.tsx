import { useEffect, useState, type FormEvent } from "react";
import { Cpu } from "lucide-react";
import { api, query } from "../lib/api";
import type {
  ClassifierConcept, ClassifierEngine, ClassifierFeedback, ClassifierOverview,
  ClassifierRuleVersion, ClassifierSuggestion,
} from "../lib/types";
import {
  Badge, Button, EmptyState, ErrorBanner, Field, Input, Loading, NoPermission,
  Panel, Select, SuccessBanner, TextArea,
} from "../components/ui";
import { useAuth } from "../auth/AuthContext";

type ConceptList = { version: string; concepts: ClassifierConcept[] };

/** Administración del clasificador V4. Las reglas y la auditoría viven en el backend. */
export function ClasificadorPage() {
  const { can } = useAuth();
  const allowed = can("config:write");
  const [overview, setOverview] = useState<ClassifierOverview | null>(null);
  const [engine, setEngine] = useState<ClassifierEngine>("v4");
  const [concepts, setConcepts] = useState<ClassifierConcept[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [feedback, setFeedback] = useState<ClassifierFeedback[]>([]);
  const [suggestions, setSuggestions] = useState<ClassifierSuggestion[]>([]);
  const [versions, setVersions] = useState<ClassifierRuleVersion[]>([]);
  const [newSynonyms, setNewSynonyms] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!allowed) return;
    setError(null);
    try {
      const [overviewResult, conceptsResult, feedbackResult, suggestionsResult, versionsResult] = await Promise.all([
        api.get<ClassifierOverview>("/classifier"),
        api.get<ConceptList>(`/classifier/concepts${query({ q: search, category })}`),
        api.get<{ entries: ClassifierFeedback[] }>("/classifier/feedback?limit=50"),
        api.get<{ suggestions: ClassifierSuggestion[] }>("/classifier/suggestions"),
        api.get<{ versions: ClassifierRuleVersion[] }>("/classifier/versions"),
      ]);
      setOverview(overviewResult.data);
      setEngine(overviewResult.data.engine);
      setConcepts(conceptsResult.data.concepts);
      setFeedback(feedbackResult.data.entries);
      setSuggestions(suggestionsResult.data.suggestions);
      setVersions(versionsResult.data.versions);
    } catch (caught) {
      setError(caught);
    }
  }

  useEffect(() => {
    void load();
    // Los filtros se recargan explícitamente desde el formulario; aquí sólo el permiso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      await action();
      setNotice(success);
      await load();
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  function saveEngine(event: FormEvent) {
    event.preventDefault();
    void run(() => api.patch("/config", { classifierEngine: engine }), "Motor de clasificación actualizado.");
  }

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    void load();
  }

  if (!allowed) return <NoPermission permission="config:write" />;

  return (
    <>
      <ErrorBanner error={error} onClose={() => setError(null)} />
      <SuccessBanner>{notice}</SuccessBanner>
      {!overview ? <Loading label="Cargando clasificador…" /> : (
        <>
          <Panel title="Motor de clasificación" subtitle="V3 permanece disponible como línea base; el cambio no reclasifica el histórico.">
            <div className="config-grid">
              <div><span>Motor activo</span><strong>{overview.engine}</strong></div>
              <div><span>Versión del clasificador</span><strong>{overview.classifierVersion}</strong></div>
              <div><span>Versión del diccionario</span><strong>{overview.dictionaryVersion}</strong></div>
              <div><span>Almacenamiento</span><strong>{overview.storage}</strong></div>
              <div><span>Conceptos activos</span><strong>{overview.activeConcepts} / {overview.concepts}</strong></div>
              <div><span>Modelo estadístico local</span><strong>{overview.statisticalModel.enabled ? "activo" : "deshabilitado"}</strong></div>
            </div>
            <div className="badge-row">
              <Badge tone={overview.migrationPending ? "warning" : "success"}>
                {overview.migrationPending ? "Migración 0003 pendiente: se usa el diccionario semilla en memoria" : "Diccionario persistido en Neon"}
              </Badge>
              <Badge tone="info">Perfil {overview.scope.profile}</Badge>
            </div>
            <form onSubmit={saveEngine} className="form-stack narrow">
              <Field label="Motor de clasificación" hint="V4 es el valor por defecto. V3 permite comparar sin desplegar.">
                <Select aria-label="Motor de clasificación" value={engine} onChange={(event) => setEngine(event.target.value as ClassifierEngine)}>
                  <option value="v4">V4 · reglas explicables</option>
                  <option value="v3">V3 · línea base</option>
                </Select>
              </Field>
              <Button type="submit" variant="primary" disabled={busy}>Guardar motor</Button>
            </form>
          </Panel>

          <Panel title="Diccionario semántico" subtitle="Sinónimos, expresiones, peso y prioridad por concepto.">
            <form onSubmit={applyFilters} className="form-row">
              <Field label="Buscar concepto">
                <Input aria-label="Buscar concepto" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="wifi, marcación, impresora…" />
              </Field>
              <Field label="Categoría">
                <Input aria-label="Categoría" value={category} onChange={(event) => setCategory(event.target.value)} placeholder="TI · Redes e Internet" />
              </Field>
              <Button type="submit" disabled={busy}>Filtrar</Button>
            </form>
            {concepts.length === 0 ? <EmptyState title="Sin conceptos" description="Ajusta los filtros o crea un concepto desde la API." /> : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Concepto</th><th>Categoría</th><th>Peso</th><th>Prioridad</th><th>Estado</th><th>Acciones</th></tr></thead>
                  <tbody>
                    {concepts.map((concept) => (
                      <tr key={concept.key}>
                        <td><strong>{concept.name}</strong><br /><small className="muted">{concept.key}</small></td>
                        <td>{concept.category}</td>
                        <td>{concept.weight}</td>
                        <td>{concept.priority}</td>
                        <td><Badge tone={concept.active ? "success" : "neutral"}>{concept.active ? "activo" : "inactivo"}</Badge></td>
                        <td>
                          <div className="inline-form">
                            <Input aria-label={`Sinónimos para ${concept.name}`} value={newSynonyms[concept.key] ?? ""}
                              onChange={(event) => setNewSynonyms((current) => ({ ...current, [concept.key]: event.target.value }))}
                              placeholder="nuevo sinónimo" />
                            <Button disabled={busy} onClick={() => {
                              const term = (newSynonyms[concept.key] ?? "").trim();
                              if (!term) return;
                              void run(() => api.post(`/classifier/concepts/${encodeURIComponent(concept.key)}/synonyms`, { terms: [term] }), "Sinónimo registrado.");
                            }}>Agregar</Button>
                            <Button disabled={busy} onClick={() => void run(
                              () => api.patch(`/classifier/concepts/${encodeURIComponent(concept.key)}`, { active: !concept.active }),
                              concept.active ? "Concepto desactivado." : "Concepto activado.",
                            )}>{concept.active ? "Desactivar" : "Activar"}</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <div className="two-columns">
            <Panel title="Retroalimentación" subtitle="Correcciones humanas al confirmar una importación. Nunca crean reglas globales solas.">
              {feedback.length === 0 ? <EmptyState title="Sin correcciones" /> : (
                <ul className="formula-list">
                  {feedback.slice(0, 20).map((entry, index) => (
                    <li key={`${entry.reviewedAt}-${index}`}>
                      <strong>{entry.suggestedCategory} → {entry.correctedCategory}</strong>
                      <br /><small className="muted">{entry.reviewerName} · {entry.reviewedAt} · {entry.classifierVersion}</small>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="Sugerencias" subtitle="Requieren aprobación humana; aprobar no activa reglas automáticamente."
              actions={<Button disabled={busy} onClick={() => void run(() => api.post("/classifier/suggestions/generate"), "Sugerencias generadas desde correcciones repetidas.")}>Generar sugerencias</Button>}>
              {suggestions.length === 0 ? <EmptyState title="Sin sugerencias" /> : (
                <ul className="formula-list">
                  {suggestions.map((item) => (
                    <li key={item.id}>
                      <strong>{item.title}</strong>
                      <br /><small className="muted">{item.status} · {item.evidenceCount} evidencia(s)</small>
                      {item.status === "pendiente" && (
                        <div className="inline-form">
                          <Button disabled={busy} variant="primary" onClick={() => void run(
                            () => api.patch(`/classifier/suggestions/${item.id}`, { status: "aprobada", notes: "Aprobada por revisión humana." }),
                            "Sugerencia aprobada. Reglas sin activar automáticamente.",
                          )}>Aprobar</Button>
                          <Button disabled={busy} onClick={() => void run(
                            () => api.patch(`/classifier/suggestions/${item.id}`, { status: "rechazada", notes: "Rechazada por revisión humana." }),
                            "Sugerencia rechazada.",
                          )}>Rechazar</Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <Panel title="Versiones del diccionario" subtitle="Cada cambio guarda una instantánea reversible. La incidencia conserva la versión que la clasificó.">
            {versions.length === 0 ? <EmptyState title="Sin versiones" /> : (
              <ul className="formula-list">
                {versions.slice(0, 20).map((item) => (
                  <li key={item.id}>
                    <strong>{item.version}</strong> <Badge tone={item.active ? "success" : "neutral"}>{item.active ? "activa" : "histórica"}</Badge>
                    <br /><small className="muted">{item.createdAt} · {item.notes}</small>
                    <div className="inline-form">
                      <TextArea aria-label={`Notas de reversión a ${item.version}`} placeholder="Motivo de la reversión" rows={1}
                        value={newSynonyms[`version-${item.id}`] ?? ""}
                        onChange={(event) => setNewSynonyms((current) => ({ ...current, [`version-${item.id}`]: event.target.value }))} />
                      <Button disabled={busy} onClick={() => void run(
                        () => api.post(`/classifier/versions/${encodeURIComponent(item.version)}/revert`),
                        `Diccionario revertido a ${item.version}.`,
                      )}>Revertir</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Límites del motor" subtitle="Decisiones verificables sin IA externa de pago.">
            <ul className="formula-list">
              <li><Cpu size={14} /> La normalización es sólo para análisis: el mensaje original permanece intacto.</li>
              <li>La correlación exige autor, tema o ubicación verificables; un «ok» aislado nunca prueba una solución.</li>
              <li>El perfil {overview.scope.profile} excluye asuntos no TI del flujo sin eliminar sus categorías del catálogo.</li>
              <li>El modelo estadístico local no está activo: no hay datos etiquetados suficientes.</li>
            </ul>
          </Panel>
        </>
      )}
    </>
  );
}
