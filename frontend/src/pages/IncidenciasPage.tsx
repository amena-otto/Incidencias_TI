import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Filter, PencilLine, RefreshCw, X } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { api, errorMessage, query } from "../lib/api";
import { formatDateTime, truncate } from "../lib/format";
import {
  ALLOWED_TRANSITIONS, REQUEST_TYPE_LABELS, STATUS_LABELS,
  type FilterOptions, type IncidentDetail, type IncidentListItem, type Status,
} from "../lib/types";
import {
  Badge, Button, EmptyState, ErrorBanner, Field, Input, Loading, NoPermission, Pagination,
  Panel, Select, SuccessBanner, TextArea, type PageSize,
} from "../components/ui";
import { SearchBox } from "../components/table";

export function IncidenciasPage() {
  const { can } = useAuth();
  const [items, setItems] = useState<IncidentListItem[]>([]);
  const [filtersMeta, setFiltersMeta] = useState<FilterOptions | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<PageSize>(10);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [requestType, setRequestType] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, meta } = await api.get<IncidentListItem[]>(`/incidents${query({
        page, limit, search, from, to, status, requestType, categoryId, teacherId, assignedTo,
      })}`);
      setItems(data);
      setTotal(Number(meta?.total ?? data.length));
      setTotalPages(Number(meta?.totalPages ?? 1));
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, from, to, status, requestType, categoryId, teacherId, assignedTo]);

  useEffect(() => {
    if (!can("incidents:read")) return;
    void load();
  }, [can, load]);

  useEffect(() => {
    if (!can("incidents:read")) return;
    api.get<FilterOptions>("/incidents/filters").then(({ data }) => setFiltersMeta(data)).catch(setError);
  }, [can]);

  if (!can("incidents:read")) return <NoPermission permission="incidents:read" />;

  async function openDetail(id: string) {
    setDetailLoading(true);
    setError(null);
    try {
      const { data } = await api.get<IncidentDetail>(`/incidents/${id}`);
      setDetail(data);
    } catch (caught) {
      setError(caught);
    } finally {
      setDetailLoading(false);
    }
  }

  function resetFilters() {
    setSearch(""); setFrom(""); setTo(""); setStatus(""); setRequestType("");
    setCategoryId(""); setTeacherId(""); setAssignedTo(""); setPage(1);
  }

  return (
    <>
      <Panel title="Registro de incidencias" subtitle="Consulta, filtra y gestiona los registros persistidos en PostgreSQL.">
        <ErrorBanner error={error} onClose={() => setError(null)} />
        <SuccessBanner>{notice}</SuccessBanner>
        <div className="filter-grid">
          <SearchBox value={search} onChange={(value) => { setSearch(value); setPage(1); }}
            placeholder="Docente, mensaje o contextualización" />
          <Field label="Desde"><Input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /></Field>
          <Field label="Hasta"><Input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></Field>
          <Field label="Estado">
            <Select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="">Todos</option>
              {(filtersMeta?.statuses ?? []).map((value) => <option key={value} value={value}>{STATUS_LABELS[value] ?? value}</option>)}
            </Select>
          </Field>
          <Field label="Tipo">
            <Select value={requestType} onChange={(event) => { setRequestType(event.target.value); setPage(1); }}>
              <option value="">Todos</option>
              {(filtersMeta?.requestTypes ?? []).map((value) => <option key={value} value={value}>{REQUEST_TYPE_LABELS[value] ?? value}</option>)}
            </Select>
          </Field>
          <Field label="Categoría">
            <Select value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setPage(1); }}>
              <option value="">Todas</option>
              {(filtersMeta?.categories ?? []).map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}
            </Select>
          </Field>
          <Field label="Docente">
            <Select value={teacherId} onChange={(event) => { setTeacherId(event.target.value); setPage(1); }}>
              <option value="">Todos</option>
              {(filtersMeta?.teachers ?? []).map((value) => <option key={value.id} value={value.id}>{value.fullName}</option>)}
            </Select>
          </Field>
          <Field label="Responsable">
            <Select value={assignedTo} onChange={(event) => { setAssignedTo(event.target.value); setPage(1); }}>
              <option value="">Todos</option>
              {(filtersMeta?.responsibles ?? []).map((value) => <option key={value.id} value={value.id}>{value.fullName}</option>)}
            </Select>
          </Field>
        </div>
        <div className="panel-actions">
          <Button onClick={() => void load()}><RefreshCw size={15} /> Actualizar</Button>
          <Button variant="ghost" onClick={resetFilters}><Filter size={15} /> Limpiar filtros</Button>
        </div>

        {loading && <Loading label="Consultando incidencias…" />}
        {!loading && items.length === 0 ? <EmptyState title="Sin incidencias" description="Ajusta los filtros o importa una conversación." /> : (
          <div className="tablewrap">
            <table className="data-table">
              <thead>
                <tr><th className="date-col">Fecha</th><th className="teacher-col">Docente</th><th>Problema detectado</th><th className="category-col">Categoría</th><th>Estado</th><th className="action-col">Detalle</th></tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="nowrap">{item.incidentDate}<br /><small>{item.incidentTime}</small></td>
                    <td>{item.teacherName ?? "Docente no identificado"}</td>
                    <td className="message-cell"><span>{truncate(item.originalMessage, 110)}</span>{item.possibleDuplicate && <Badge tone="warning">Duplicado posible</Badge>}</td>
                    <td><div className="clamp-cell" title={item.categoryLabel}>{item.categoryLabel}</div></td>
                    <td><StatusBadge status={item.status} /></td>
                    <td><button type="button" className="icon-btn" aria-label={`Abrir ${item.id}`}
                      onClick={() => void openDetail(item.id)}><PencilLine size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage}
          limit={limit} onLimitChange={(next) => { setLimit(next); setPage(1); }} />
      </Panel>

      {detailLoading && <Panel><Loading label="Cargando detalle…" /></Panel>}
      {detail && (
        <IncidentDrawer
          detail={detail}
          responsibles={filtersMeta?.responsibles ?? []}
          canWrite={can("incidents:write")}
          onClose={() => setDetail(null)}
          onSaved={(message, updated) => {
            setNotice(message);
            if (updated) setDetail(updated);
            void load();
          }}
        />
      )}
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "resuelto" || status === "cerrado" ? "success" : status === "pendiente" ? "warning" : status === "descartado" ? "danger" : "info";
  return <Badge tone={tone}>{STATUS_LABELS[status] ?? status}</Badge>;
}

function IncidentDrawer({ detail, responsibles, canWrite, onClose, onSaved }: {
  detail: IncidentDetail;
  responsibles: Array<{ id: string; fullName: string }>;
  canWrite: boolean;
  onClose: () => void;
  onSaved: (message: string, updated?: IncidentDetail) => void;
}) {
  const [status, setStatus] = useState("");
  const [assignedTo, setAssignedTo] = useState(detail.assignedTo ?? "");
  const [solution, setSolution] = useState(detail.solution ?? "");
  const [responseText, setResponseText] = useState("");
  const [responseType, setResponseType] = useState<"respuesta" | "seguimiento" | "confirmacion">("respuesta");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const transitions = ALLOWED_TRANSITIONS[detail.status as Status] ?? [];

  async function save(event: FormEvent) {
    event.preventDefault();
    if (status === "resuelto" && solution.trim().length < 5) {
      setError("Para marcar como resuelto se requiere una solución de al menos 5 caracteres.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      if (status) body.status = status;
      if (assignedTo !== (detail.assignedTo ?? "")) body.assignedTo = assignedTo || null;
      if (solution.trim() && solution.trim() !== (detail.solution ?? "")) body.solution = solution.trim();
      const { data } = await api.patch<IncidentDetail>(`/incidents/${detail.id}`, body);
      const refreshed = await api.get<IncidentDetail>(`/incidents/${detail.id}`);
      setStatus("");
      onSaved("Incidencia actualizada correctamente.", refreshed.data ?? data);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function addResponse(event: FormEvent) {
    event.preventDefault();
    if (responseText.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/incidents/${detail.id}/responses`, { text: responseText.trim(), type: responseType });
      const refreshed = await api.get<IncidentDetail>(`/incidents/${detail.id}`);
      setResponseText("");
      onSaved("Respuesta registrada.", refreshed.data);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="drawer" aria-label="Detalle de incidencia">
        <div className="drawer-head">
          <div>
            <small>{detail.id}</small>
            <h2>{detail.categoryLabel}</h2>
            <p className="muted">{formatDateTime(detail.incidentDate)} · {detail.incidentTime}</p>
          </div>
          <button className="icon-btn" aria-label="Cerrar detalle" onClick={onClose}><X size={18} /></button>
        </div>
        <ErrorBanner error={error} />
        <div className="drawer-body">
          <Panel title="Solicitud original">
            <p className="quote">{detail.originalMessage}</p>
            <p className="muted">Solicitante: {detail.requesterName} · Docente: {detail.teacherName ?? "sin identificar"}</p>
            {detail.contextualization && <p className="context-box">{detail.contextualization}</p>}
            <div className="badge-row">
              <StatusBadge status={detail.status} />
              <Badge>{REQUEST_TYPE_LABELS[detail.requestType] ?? detail.requestType}</Badge>
              <Badge tone="info">Confianza: {detail.confidenceLevel ?? "no registrada"}</Badge>
            </div>
          </Panel>

          <Panel title="Mensajes y respuestas" subtitle="El historial se conserva íntegramente.">
            {detail.messages.map((message) => (
              <div key={message.id} className="timeline-item">
                <Badge tone={message.isStaff ? "info" : "neutral"}>{message.type}</Badge>
                <strong>{message.senderName}</strong>
                <span>{message.messageText}</span>
                <small className="muted">{message.messageTime}</small>
              </div>
            ))}
            {detail.responses.map((response) => (
              <div key={response.id} className="timeline-item response">
                <Badge tone={response.isUncertain ? "warning" : "success"}>{response.associationConfidence}</Badge>
                <strong>{response.responderName}</strong>
                <span>{response.responseText}</span>
                <small className="muted">{response.responseTime}</small>
              </div>
            ))}
          </Panel>

          <Panel title="Historial de cambios">
            {detail.history.length === 0 ? <p className="muted">Sin cambios registrados.</p> : detail.history.map((entry) => (
              <div key={entry.id} className="history-item">
                <strong>{entry.action}</strong>
                <span>{entry.actor ?? "sistema"} · {formatDateTime(entry.createdAt)}</span>
                {entry.notes && <small>{entry.notes}</small>}
              </div>
            ))}
          </Panel>

          {canWrite && (
            <Panel title="Gestión" subtitle="Las transiciones y la solución se validan también en el backend.">
              <form onSubmit={save} className="form-stack">
                <Field label="Nuevo estado">
                  <Select value={status} onChange={(event) => setStatus(event.target.value as Status | "")}>
                    <option value="">Sin cambio</option>
                    {transitions.map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}
                  </Select>
                </Field>
                <Field label="Responsable">
                  <Select value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
                    <option value="">Sin asignar</option>
                    {responsibles.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}
                  </Select>
                </Field>
                <Field label="Solución" hint="Obligatoria para pasar a resuelto.">
                  <TextArea rows={3} value={solution} onChange={(event) => setSolution(event.target.value)} />
                </Field>
                <Button type="submit" variant="primary" disabled={busy}>Guardar cambios</Button>
              </form>
              <form onSubmit={addResponse} className="form-stack separated">
                <Field label="Registrar respuesta o seguimiento">
                  <TextArea rows={3} value={responseText} onChange={(event) => setResponseText(event.target.value)} placeholder="Texto de la atención" />
                </Field>
                <div className="inline-fields">
                  <Field label="Tipo">
                    <Select value={responseType} onChange={(event) => setResponseType(event.target.value as typeof responseType)}>
                      <option value="respuesta">Respuesta</option>
                      <option value="seguimiento">Seguimiento</option>
                      <option value="confirmacion">Confirmación</option>
                    </Select>
                  </Field>
                  <Button type="submit" variant="secondary" disabled={busy || responseText.trim().length < 2}>Agregar</Button>
                </div>
              </form>
            </Panel>
          )}
        </div>
      </aside>
    </div>
  );
}
