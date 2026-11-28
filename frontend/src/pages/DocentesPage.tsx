import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Download, FileSpreadsheet, FileText, Search, Upload } from "lucide-react";
import { api, downloadUrl, query } from "../lib/api";
import type { Teacher, TeacherImportRow, TeacherSuggestion } from "../lib/types";
import {
  Badge, Button, EmptyState, ErrorBanner, Field, Input, Loading, Pagination, Panel,
  SuccessBanner, type PageSize,
} from "../components/ui";
import {
  DetailDrawer, SearchBox, SelectCheckbox, SelectionToolbar, useLocalPager,
} from "../components/table";
import { useAuth } from "../auth/AuthContext";

type TeacherPreview = {
  token: string;
  rows: TeacherImportRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
};

type MatchResult = {
  suggestion: TeacherSuggestion | null;
  suggestions: TeacherSuggestion[];
  ambiguous: boolean;
  autoLink: boolean;
  explanation: string;
};

function isSelectable(row: TeacherImportRow): boolean {
  return row.errors.length === 0 && !row.duplicate;
}

export function DocentesPage() {
  const { can } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
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
  const [alias, setAlias] = useState("");
  const [aliasFor, setAliasFor] = useState<Record<string, string>>({});
  const [importFile, setImportFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<TeacherPreview | null>(null);
  const [previewSearch, setPreviewSearch] = useState("");
  const [confirmingImport, setConfirmingImport] = useState(false);
  const [teacherDetailId, setTeacherDetailId] = useState<string | null>(null);
  const [matchName, setMatchName] = useState("");
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);

  const filteredPreviewRows = useMemo(() => (preview?.rows ?? []).filter((row) =>
    !previewSearch || `${row.fullName} ${row.email} ${row.alias}`.toLocaleLowerCase("es")
      .includes(previewSearch.toLocaleLowerCase("es"))), [preview, previewSearch]);
  const previewPager = useLocalPager(filteredPreviewRows);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, meta } = await api.get<Teacher[]>(`/teachers${query({ search, page, limit })}`);
      setTeachers(data);
      setTotal(Number(meta?.total ?? data.length));
      setTotalPages(Number(meta?.totalPages ?? 1));
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, [search, page, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createTeacher(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const { data } = await api.post<Teacher>("/teachers", {
        fullName,
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(alias.trim() ? { alias: alias.trim() } : {}),
      });
      setNotice(`Docente ${data.fullName} registrado.`);
      setFullName(""); setEmail(""); setAlias("");
      void load();
    } catch (caught) {
      setError(caught);
    }
  }

  async function toggle(teacher: Teacher) {
    try {
      await api.patch(`/teachers/${teacher.id}`, { active: !teacher.active });
      setNotice(teacher.active ? "Docente desactivado." : "Docente activado.");
      setTeacherDetailId(null);
      void load();
    } catch (caught) {
      setError(caught);
    }
  }

  async function addAlias(teacher: Teacher) {
    const value = (aliasFor[teacher.id] ?? "").trim();
    if (!value) return;
    try {
      await api.post(`/teachers/${teacher.id}/aliases`, { alias: value });
      setAliasFor((current) => ({ ...current, [teacher.id]: "" }));
      setNotice("Alias agregado.");
      void load();
    } catch (caught) {
      setError(caught);
    }
  }

  async function uploadExcel() {
    if (!importFile) return;
    setError(null);
    try {
      const form = new FormData();
      form.append("file", importFile);
      const { data } = await api.post<TeacherPreview>("/teachers/import/preview", form);
      setPreview(data);
      setPreviewSearch("");
      previewPager.reset();
      setNotice(`${data.totalRows} filas leídas: ${data.validRows} válidas y ${data.invalidRows} con observaciones.`);
    } catch (caught) {
      setError(caught);
      setPreview(null);
    }
  }

  async function commitExcel() {
    if (!preview) return;
    try {
      const { data } = await api.post<{ created: number; skipped: number }>("/teachers/import/commit", {
        token: preview.token,
        rows: preview.rows.map((row) => ({ rowNumber: row.rowNumber, selected: row.selected })),
      });
      setNotice(`Importación finalizada: ${data.created} creados y ${data.skipped} omitidos por existir previamente.`);
      setPreview(null);
      setConfirmingImport(false);
      setImportFile(null);
      void load();
    } catch (caught) {
      setError(caught);
      setConfirmingImport(false);
    }
  }

  async function findMatch(event: FormEvent) {
    event.preventDefault();
    try {
      const { data } = await api.post<MatchResult>("/teachers/match", { name: matchName });
      setMatchResult(data);
    } catch (caught) {
      setError(caught);
    }
  }

  function setFilteredRowsSelected(selected: boolean) {
    const rows = new Set(filteredPreviewRows.filter(isSelectable).map((row) => row.rowNumber));
    setPreview((current) => current ? {
      ...current,
      rows: current.rows.map((row) => rows.has(row.rowNumber) ? { ...row, selected } : row),
    } : null);
  }

  function setVisibleRowsSelected(selected: boolean) {
    const rows = new Set(previewPager.visible.filter(isSelectable).map((row) => row.rowNumber));
    setPreview((current) => current ? {
      ...current,
      rows: current.rows.map((row) => rows.has(row.rowNumber) ? { ...row, selected } : row),
    } : null);
  }

  const selectableFiltered = filteredPreviewRows.filter(isSelectable);
  const allFilteredSelected = selectableFiltered.length > 0 && selectableFiltered.every((row) => row.selected);
  const someFilteredSelected = selectableFiltered.some((row) => row.selected);
  const selectedCount = (preview?.rows ?? []).filter((row) => row.selected && isSelectable(row)).length;
  const detailTeacher = teachers.find((teacher) => teacher.id === teacherDetailId) ?? null;

  return (
    <>
      <Panel title="Catálogo de docentes" subtitle="El catálogo permite vincular el nombre de WhatsApp con el nombre institucional. Las coincidencias dudosas nunca se enlazan automáticamente.">
        <ErrorBanner error={error} onClose={() => setError(null)} />
        <SuccessBanner>{notice}</SuccessBanner>
        <div className="filter-row">
          <SearchBox value={search} onChange={(value) => { setSearch(value); setPage(1); }}
            placeholder="Nombre del docente" label="Buscar docente" />
          <Button onClick={() => { setPage(1); void load(); }}><Search size={15} /> Buscar</Button>
        </div>
        {loading ? <Loading label="Cargando docentes…" /> : teachers.length === 0 ? (
          <EmptyState title="Sin docentes" description="Registra docentes o importa la plantilla de Excel." />
        ) : (
          <div className="tablewrap">
            <table className="data-table">
              <thead><tr><th className="teacher-col">Nombre completo</th><th>Correo</th><th>Alias</th><th>Estado</th><th className="action-col">Detalle</th></tr></thead>
              <tbody>
                {teachers.map((teacher) => (
                  <tr key={teacher.id}>
                    <td>{teacher.fullName}</td>
                    <td><div className="clamp-cell" title={teacher.email ?? ""}>{teacher.email ?? "—"}</div></td>
                    <td><div className="clamp-cell" title={teacher.aliases.join("; ")}>{teacher.aliases.length ? teacher.aliases.join("; ") : "—"}</div></td>
                    <td><Badge tone={teacher.active ? "success" : "neutral"}>{teacher.active ? "Activo" : "Inactivo"}</Badge></td>
                    <td><button type="button" className="icon-btn" aria-label={`Ver detalle de ${teacher.fullName}`}
                      onClick={() => setTeacherDetailId(teacher.id)}><FileText size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage}
          limit={limit} onLimitChange={(next) => { setLimit(next); setPage(1); }} />
      </Panel>

      {can("teachers:write") && (
        <>
          <div className="two-columns">
            <Panel title="Registrar docente">
              <form onSubmit={createTeacher} className="form-stack">
                <Field label="Nombre completo"><Input value={fullName} onChange={(event) => setFullName(event.target.value)} required minLength={4} /></Field>
                <Field label="Correo institucional (opcional)"><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
                <Field label="Alias inicial (opcional)" hint="Ejemplo: La profe Ana"><Input value={alias} onChange={(event) => setAlias(event.target.value)} /></Field>
                <Button type="submit" variant="primary">Guardar docente</Button>
              </form>
            </Panel>
            <Panel title="Importar desde Excel" subtitle="Plantilla, validación previa, selección y confirmación.">
              <div className="button-row">
                <a className="btn btn-secondary" href={downloadUrl("/teachers/import/template")}><Download size={15} /> Plantilla</a>
                <a className="btn btn-secondary" href={downloadUrl("/teachers/export")}><FileSpreadsheet size={15} /> Exportar catálogo</a>
              </div>
              <Field label="Archivo .xlsx">
                <Input type="file" accept=".xlsx" onChange={(event) => { setImportFile(event.target.files?.[0] ?? null); setPreview(null); }} />
              </Field>
              <Button variant="primary" disabled={!importFile} onClick={() => void uploadExcel()}><Upload size={15} /> Previsualizar</Button>
              {preview && (
                <div className="import-preview">
                  <p className="muted">{preview.totalRows} filas · {preview.validRows} válidas · {preview.invalidRows} con errores</p>
                  <SearchBox value={previewSearch} onChange={(value) => { setPreviewSearch(value); previewPager.reset(); }}
                    placeholder="Buscar en la previsualización" label="Buscar filas" />
                  <SelectionToolbar selectedCount={selectedCount} filteredCount={selectableFiltered.length}
                    pageCount={previewPager.visible.filter(isSelectable).length}
                    onSelectPage={() => setVisibleRowsSelected(true)}
                    onSelectFiltered={() => setFilteredRowsSelected(true)}
                    onClear={() => setFilteredRowsSelected(false)}>
                    <Button variant="primary" disabled={selectedCount === 0} onClick={() => setConfirmingImport(true)}>Confirmar importación</Button>
                  </SelectionToolbar>
                  <div className="tablewrap compact-table">
                    <table className="data-table">
                      <thead><tr>
                        <th className="checkbox-col">
                          <SelectCheckbox checked={allFilteredSelected} indeterminate={someFilteredSelected && !allFilteredSelected}
                            onChange={setFilteredRowsSelected} label="Seleccionar todas las filas válidas filtradas" />
                        </th>
                        <th>Fila</th><th>Nombre</th><th>Correo</th><th>Observaciones</th><th>Importar</th>
                      </tr></thead>
                      <tbody>
                        {previewPager.visible.map((row) => (
                          <tr key={row.rowNumber}>
                            <td>{row.rowNumber}</td>
                            <td><div className="clamp-cell">{row.fullName || "—"}</div></td>
                            <td><div className="clamp-cell">{row.email || "—"}</div></td>
                            <td><div className="clamp-cell muted" title={row.errors.join("; ")}>{row.errors.length ? row.errors.join("; ") : <Badge tone="success">OK</Badge>}</div></td>
                            <td><input type="checkbox" checked={row.selected && isSelectable(row)} disabled={!isSelectable(row)}
                              aria-label={`Importar fila ${row.rowNumber}`}
                              onChange={(event) => setPreview((current) => current ? {
                                ...current,
                                rows: current.rows.map((item) => item.rowNumber === row.rowNumber ? { ...item, selected: event.target.checked } : item),
                              } : null)} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination page={previewPager.page} totalPages={previewPager.totalPages} total={previewPager.total}
                    limit={previewPager.limit} onLimitChange={previewPager.setLimit} onChange={previewPager.setPage} />
                </div>
              )}
            </Panel>
          </div>
        </>
      )}

      <Panel title="Probar coincidencia de nombre" subtitle="Útil para verificar alias antes de importar un chat.">
        <form onSubmit={findMatch} className="form-stack">
          <Field label="Nombre tal como aparece en WhatsApp">
            <Input value={matchName} onChange={(event) => setMatchName(event.target.value)} required placeholder="La profe Ana" />
          </Field>
          <Button type="submit">Ver sugerencia</Button>
        </form>
        {matchResult && (
          <div className="match-result">
            <p>{matchResult.explanation}</p>
            <p className="muted">Vinculación automática: {matchResult.autoLink ? "sí" : "no"} · ambiguo: {matchResult.ambiguous ? "sí" : "no"}</p>
            {matchResult.suggestions.map((suggestion) => (
              <Badge key={`${suggestion.teacherId}-${suggestion.method}`} tone="info">
                {suggestion.fullName} · {suggestion.method} · {Math.round(suggestion.score)}
              </Badge>
            ))}
            {!matchResult.suggestions.length && <p className="muted">Sin coincidencias en el catálogo.</p>}
          </div>
        )}
      </Panel>

      {detailTeacher && can("teachers:write") && (
        <DetailDrawer title={detailTeacher.fullName} subtitle="Catálogo institucional" label="Detalle de docente"
          onClose={() => setTeacherDetailId(null)}>
          <div className="badge-row"><Badge tone={detailTeacher.active ? "success" : "neutral"}>{detailTeacher.active ? "Activo" : "Inactivo"}</Badge></div>
          <p className="muted">Correo: {detailTeacher.email ?? "sin registrar"}</p>
          <div className="drawer-section form-stack">
            <h3>Aliases</h3>
            {detailTeacher.aliases.length === 0 ? <p className="muted">Sin aliases registrados.</p> : (
              <div className="badge-row">{detailTeacher.aliases.map((value) => <Badge key={value} tone="info">{value}</Badge>)}</div>
            )}
            <Field label="Agregar alias" hint="Se usa para vincular nombres de WhatsApp al nombre institucional.">
              <Input aria-label={`Alias para ${detailTeacher.fullName}`} value={aliasFor[detailTeacher.id] ?? ""}
                onChange={(event) => setAliasFor((current) => ({ ...current, [detailTeacher.id]: event.target.value }))}
                placeholder="Nuevo alias" />
            </Field>
            <div className="button-row">
              <Button variant="primary" onClick={() => void addAlias(detailTeacher)}>Agregar</Button>
              <Button onClick={() => void toggle(detailTeacher)}>{detailTeacher.active ? "Desactivar" : "Activar"}</Button>
            </div>
          </div>
        </DetailDrawer>
      )}

      {confirmingImport && (
        <DetailDrawer title="Confirmar importación de docentes" subtitle="Revisión final" label="Confirmación de docentes"
          onClose={() => setConfirmingImport(false)}>
          <p>Se importarán <strong>{selectedCount}</strong> filas válidas seleccionadas. Las filas con errores o duplicados se omiten.</p>
          <div className="button-row">
            <Button variant="primary" onClick={() => void commitExcel()}>Sí, importar docentes</Button>
            <Button variant="ghost" onClick={() => setConfirmingImport(false)}>Cancelar</Button>
          </div>
        </DetailDrawer>
      )}
    </>
  );
}
