import { useCallback, useEffect, useState } from "react";
import { Download, FileSpreadsheet, HardDriveDownload } from "lucide-react";
import { api, downloadUrl, query } from "../lib/api";
import { limaToday, truncate } from "../lib/format";
import {
  REQUEST_TYPE_LABELS, STATUS_LABELS, type FilterOptions, type IncidentListItem,
} from "../lib/types";
import {
  Badge, Button, EmptyState, ErrorBanner, Field, Input, Loading, NoPermission,
  Pagination, Panel, Select, type PageSize,
} from "../components/ui";
import { useAuth } from "../auth/AuthContext";

type ReportMeta = { sheets: string[]; chartsNative: boolean; note: string };
type DriveStatus = { configured: boolean; enabled: boolean; reason: string; downloadAlwaysAvailable: boolean };

export function ReportesPage() {
  const { can } = useAuth();
  const [from, setFrom] = useState(limaToday(-29));
  const [to, setTo] = useState(limaToday());
  const [status, setStatus] = useState("");
  const [requestType, setRequestType] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [filtersMeta, setFiltersMeta] = useState<FilterOptions | null>(null);
  const [meta, setMeta] = useState<ReportMeta | null>(null);
  const [drive, setDrive] = useState<DriveStatus | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [rows, setRows] = useState<IncidentListItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<PageSize>(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingRows, setLoadingRows] = useState(false);

  const loadRows = useCallback(async () => {
    if (!can("incidents:read")) return;
    setLoadingRows(true);
    try {
      const { data, meta: pageMeta } = await api.get<IncidentListItem[]>(`/incidents${query({
        from, to, status, requestType, categoryId, teacherId, page, limit,
      })}`);
      setRows(data);
      setTotal(Number(pageMeta?.total ?? data.length));
      setTotalPages(Number(pageMeta?.totalPages ?? 1));
    } catch (caught) {
      setError(caught);
    } finally {
      setLoadingRows(false);
    }
  }, [can, from, to, status, requestType, categoryId, teacherId, page, limit]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (!can("reports:read")) return;
    Promise.all([
      api.get<ReportMeta>("/reports/meta"),
      api.get<FilterOptions>("/incidents/filters"),
      api.get<DriveStatus>("/drive/status"),
    ]).then(([metaResult, filterResult, driveResult]) => {
      setMeta(metaResult.data);
      setFiltersMeta(filterResult.data);
      setDrive(driveResult.data);
    }).catch(setError);
  }, [can]);

  if (!can("reports:read")) return <NoPermission permission="reports:read" />;

  const params = query({ from, to, status, requestType, categoryId, teacherId });
  const filename = `TI_SmartDesk_${from}_${to}.xlsx`;

  return (
    <>
      <Panel title="Reporte institucional en Excel" subtitle="Cuatro hojas generadas con datos reales de PostgreSQL. La descarga queda registrada en auditoría.">
        <ErrorBanner error={error} onClose={() => setError(null)} />
        <div className="filter-grid">
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
        </div>
        <a className="btn btn-primary" href={downloadUrl(`/reports/xlsx${params}`)} download={filename}>
          <Download size={16} /> Descargar Excel
        </a>
        {from > to && <p className="hint-warning">La fecha “desde” no puede ser posterior a “hasta”. El backend rechazará el rango.</p>}
      </Panel>

      {can("incidents:read") && (
        <Panel title="Vista previa paginada del reporte" subtitle="Los mismos filtros alimentan la descarga en Excel y esta vista de sólo lectura.">
          <ErrorBanner error={error} onClose={() => setError(null)} />
          {loadingRows ? <Loading label="Consultando incidencias…" /> : rows.length === 0 ? (
            <EmptyState title="Sin incidencias en el rango" description="Ajusta los filtros o el periodo." />
          ) : (
            <div className="tablewrap">
              <table className="data-table">
                <thead><tr><th className="date-col">Fecha</th><th className="teacher-col">Docente</th><th>Problema detectado</th><th className="category-col">Categoría</th><th>Estado</th></tr></thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="nowrap">{row.incidentDate}<br /><small>{row.incidentTime}</small></td>
                      <td>{row.teacherName ?? "Docente no identificado"}</td>
                      <td><div className="clamp-cell" title={row.originalMessage}>{truncate(row.originalMessage, 110)}</div></td>
                      <td><div className="clamp-cell" title={row.categoryLabel}>{row.categoryLabel}</div></td>
                      <td><Badge tone={row.status === "resuelto" || row.status === "cerrado" ? "success" : row.status === "pendiente" ? "warning" : "info"}>{STATUS_LABELS[row.status] ?? row.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage}
            limit={limit} onLimitChange={(next) => { setLimit(next); setPage(1); }} />
        </Panel>
      )}

      <Panel title="Contenido del archivo" subtitle="Las hojas se generan con ExcelJS; no se simulan gráficos nativos.">
        <div className="sheet-list">
          {(meta?.sheets ?? []).map((sheet, index) => (
            <div key={sheet} className="sheet-item">
              <FileSpreadsheet size={18} />
              <strong>{index + 1}. {sheet}</strong>
            </div>
          ))}
        </div>
        {meta && <p className="muted">{meta.note}</p>}
      </Panel>

      <Panel title="Google Drive (opcional)" subtitle="Integración preparada pero deshabilitada: nunca se simula una subida exitosa.">
        {drive ? (
          <>
            <Badge tone={drive.enabled ? "success" : "warning"}>{drive.enabled ? "Habilitado" : "Deshabilitado"}</Badge>
            <p className="muted">{drive.reason}</p>
            {drive.downloadAlwaysAvailable && <p className="muted"><HardDriveDownload size={14} /> La descarga local siempre está disponible.</p>}
          </>
        ) : <p className="muted">Consultando estado…</p>}
        <Button disabled title="No habilitado en esta versión"><Download size={15} /> Subir a Drive</Button>
      </Panel>
    </>
  );
}
