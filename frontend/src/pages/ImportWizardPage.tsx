import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, MessageSquareText, Search, Upload } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { api, errorMessage, query } from "../lib/api";
import {
  INCLUSION_LABELS, type Category, type CommitResult, type ExcludedMessage,
  type ImportPreview, type InclusionStatus, type PreviewCandidate, type Teacher,
} from "../lib/types";
import {
  Badge, Button, ErrorBanner, Field, Input, Loading, NoPermission, Pagination,
  Panel, Select, SuccessBanner, TextArea, type PageSize,
} from "../components/ui";
import {
  DetailDrawer, SearchBox, SelectCheckbox, SelectionToolbar, useLocalPager,
} from "../components/table";

type CandidatePatch = Partial<PreviewCandidate>;

type CandidateFilter = "" | InclusionStatus | "duplicado";

const STATUS_FILTERS: Array<{ value: CandidateFilter; label: string }> = [
  { value: "", label: "Todos los estados" },
  { value: "ti_detectada", label: "Incidencia TI detectada" },
  { value: "atencion_ti", label: "Atención de TI vinculada" },
  { value: "requiere_revision", label: "Requiere revisión" },
  { value: "fuera_alcance", label: "Fuera del alcance TI" },
  { value: "no_pertinente", label: "Mensaje no pertinente" },
  { value: "duplicado", label: "Posible duplicado" },
];

function toneFor(status: InclusionStatus | "duplicado" | string): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "ti_detectada") return "success";
  if (status === "atencion_ti") return "info";
  if (status === "requiere_revision" || status === "duplicado") return "warning";
  if (status === "fuera_alcance" || status === "no_pertinente") return "danger";
  return "neutral";
}

export function ImportWizardPage() {
  const { can } = useAuth();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [conversationKey, setConversationKey] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [candidates, setCandidates] = useState<PreviewCandidate[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [excludedDetail, setExcludedDetail] = useState<ExcludedMessage | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CandidateFilter>("");
  const [confidenceFilter, setConfidenceFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [excludedSearch, setExcludedSearch] = useState("");

  useEffect(() => {
    if (!can("import")) return;
    Promise.all([
      api.get<Category[]>(`/categories${query({ all: "true" })}`),
      api.get<Teacher[]>(`/teachers${query({ active: "true" })}`),
    ]).then(([categoryResult, teacherResult]) => {
      setCategories(categoryResult.data);
      setTeachers(teacherResult.data);
    }).catch(setError);
  }, [can]);

  const filteredCandidates = useMemo(() => candidates.filter((candidate) => {
    if (search && !`${candidate.originalMessage} ${candidate.teacherName ?? ""} ${candidate.requesterName} ${candidate.inclusionReason}`
      .toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"))) return false;
    if (statusFilter === "duplicado" && !candidate.possibleDuplicate) return false;
    if (statusFilter && statusFilter !== "duplicado" && candidate.inclusionStatus !== statusFilter) return false;
    if (confidenceFilter && candidate.confidence !== confidenceFilter) return false;
    if (categoryFilter && candidate.categoryLabel !== categoryFilter) return false;
    if (teacherFilter === "identificado" && !candidate.teacherId) return false;
    if (teacherFilter === "no_identificado" && candidate.teacherId) return false;
    return true;
  }), [candidates, search, statusFilter, confidenceFilter, categoryFilter, teacherFilter]);

  const filteredExcluded = useMemo(() => (preview?.excluded ?? []).filter((row) => {
    if (!excludedSearch) return true;
    return `${row.originalMessage} ${row.sender} ${row.reason}`.toLocaleLowerCase("es")
      .includes(excludedSearch.toLocaleLowerCase("es"));
  }), [preview, excludedSearch]);

  const pager = useLocalPager(filteredCandidates);
  const excludedPager = useLocalPager(filteredExcluded);

  if (!can("import")) return <NoPermission permission="import" />;

  function resetSource() {
    setPreview(null);
    setCandidates([]);
    setCommitResult(null);
    setNotice("");
    setError(null);
    setConfirming(false);
    setDetailId(null);
    setExcludedDetail(null);
    pager.reset();
    excludedPager.reset();
  }

  function patchCandidate(candidateId: string, patch: CandidatePatch) {
    setCandidates((current) => current.map((candidate) =>
      candidate.candidateId === candidateId ? { ...candidate, ...patch } : candidate));
  }

  function setAllFiltered(selected: boolean) {
    const ids = new Set(filteredCandidates.map((candidate) => candidate.candidateId));
    setCandidates((current) => current.map((candidate) =>
      ids.has(candidate.candidateId) ? { ...candidate, selected } : candidate));
  }

  function setCurrentPage(selected: boolean) {
    const ids = new Set(pager.visible.map((candidate) => candidate.candidateId));
    setCandidates((current) => current.map((candidate) =>
      ids.has(candidate.candidateId) ? { ...candidate, selected } : candidate));
  }

  async function analyze() {
    setBusy(true);
    setError(null);
    setNotice("");
    setCommitResult(null);
    setConfirming(false);
    pager.reset();
    excludedPager.reset();
    try {
      const form = new FormData();
      if (file) form.append("file", file);
      else form.append("text", text);
      if (conversationKey.trim()) form.append("conversationKey", conversationKey.trim());

      const { data } = await api.post<ImportPreview>("/imports/preview", form);
      setPreview(data);
      setCandidates(data.candidates);
      setNotice(
        `Análisis terminado: ${data.totalMessages} mensajes reconocidos, ${data.stats.detected} candidatos, ` +
        `${data.stats.low} de baja confianza y ${data.stats.discarded} descartados.`,
      );
    } catch (caught) {
      setError(caught);
      resetSource();
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!preview) return;
    if (!candidates.some((candidate) => candidate.selected)) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post<CommitResult>("/imports/commit", {
        token: preview.token,
        rows: candidates.map((candidate) => ({
          candidateId: candidate.candidateId,
          selected: candidate.selected,
          categoryLabel: candidate.categoryLabel,
          contextualization: candidate.contextualization,
          teacherId: candidate.teacherId,
        })),
      });
      setCommitResult(data);
      setNotice(`Importación confirmada: ${data.saved} registros guardados, ${data.duplicateMessages} duplicados omitidos y ${data.responsesSaved} respuestas asociadas.`);
      setConfirming(false);
      setText("");
      setFile(null);
      setPreview(null);
      setCandidates([]);
    } catch (caught) {
      setError(caught);
      setNotice(`No se pudo completar la importación: ${errorMessage(caught)}`);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  const selectedCount = candidates.filter((candidate) => candidate.selected).length;
  const allFilteredSelected = filteredCandidates.length > 0 && filteredCandidates.every((candidate) => candidate.selected);
  const someFilteredSelected = filteredCandidates.some((candidate) => candidate.selected);
  const detailCandidate = candidates.find((candidate) => candidate.candidateId === detailId) ?? null;

  return (
    <>
      <Panel
        title="Importación guiada de WhatsApp"
        subtitle="Perfil «Incidencias TI». El texto se analiza, se revisa manualmente y sólo se guarda tras confirmación explícita."
      >
        <ErrorBanner error={error} onClose={() => setError(null)} />
        <SuccessBanner tone="info">{notice}</SuccessBanner>
        {commitResult && <SuccessBanner>{commitResult.duplicateConversation
          ? "La conversación ya había sido importada; no se duplicaron registros."
          : `Registros Guardados: ${commitResult.saved}`}</SuccessBanner>}

        <div className="wizard-source">
          <Field label="Archivo TXT de WhatsApp" hint="Formatos Android, iOS y escritorio; tamaño máximo configurado en el backend.">
            <Input
              type="file"
              accept=".txt,text/plain"
              onChange={(event) => { setFile(event.target.files?.[0] ?? null); resetSource(); }}
            />
          </Field>
          <Field label="Clave de conversación (opcional)" hint="Distingue grupos con mensajes idénticos; se guarda como hash.">
            <Input value={conversationKey} onChange={(event) => setConversationKey(event.target.value)} placeholder="grupo-ti-2026" />
          </Field>
        </div>
        <Field label="O pega el contenido de la conversación">
          <TextArea
            rows={7}
            value={text}
            onChange={(event) => { setText(event.target.value); setFile(null); resetSource(); }}
            placeholder="26/11/26 20:01 - Docente: No tengo conexión a Internet"
          />
        </Field>
        <Button variant="primary" disabled={busy || (!file && !text.trim())} onClick={() => void analyze()}>
          {busy ? <Loading label="Procesando…" /> : <><Search size={16} /> Analizar conversación</>}
        </Button>
      </Panel>

      {preview && (
        <>
          <Panel title="Resumen del perfil Incidencias TI" subtitle={`Archivo: ${preview.sourceName} · formato: ${preview.format}`}>
            <div className="stat-grid compact">
              <div className="mini-stat"><span>Mensajes analizados</span><strong>{preview.stats.analyzed}</strong></div>
              <div className="mini-stat"><span>Incidencias TI detectadas</span><strong>{preview.stats.includedTi}</strong></div>
              <div className="mini-stat"><span>Con atención TI vinculada</span><strong>{preview.stats.tiWithAttention}</strong></div>
              <div className="mini-stat"><span>Requieren revisión</span><strong>{preview.stats.requiresReview}</strong></div>
              <div className="mini-stat"><span>Fuera del alcance TI</span><strong>{preview.stats.excludedOutOfScope}</strong></div>
              <div className="mini-stat"><span>No pertinentes</span><strong>{preview.stats.excludedNotRelevant}</strong></div>
              <div className="mini-stat"><span>Duplicados potenciales</span><strong>{preview.stats.possibleDuplicates}</strong></div>
              <div className="mini-stat"><span>Candidatos visibles</span><strong>{preview.stats.detected}</strong></div>
              <div className="mini-stat"><span>Fechas inválidas</span><strong>{preview.invalidDates}</strong></div>
            </div>
            {preview.invalidDates > 0 && <p className="hint-warning"><AlertTriangle size={15} /> Se omitieron fechas imposibles; no se convirtieron silenciosamente.</p>}
          </Panel>

          <Panel
            title={`Revisión de candidatos (${selectedCount} seleccionados)`}
            subtitle="Una sola columna de Docente, tomada del catálogo institucional. El remitente original queda en el detalle para trazabilidad."
            actions={<Button variant="primary" disabled={busy || selectedCount === 0} onClick={() => setConfirming(true)}>
              <CheckCircle2 size={16} /> Confirmar e importar
            </Button>}
          >
            <div className="filter-grid">
              <SearchBox value={search} onChange={(value) => { setSearch(value); pager.reset(); }}
                placeholder="Problema, docente o motivo" />
              <Field label="Estado">
                <Select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as CandidateFilter); pager.reset(); }}>
                  {STATUS_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </Select>
              </Field>
              <Field label="Confianza">
                <Select value={confidenceFilter} onChange={(event) => { setConfidenceFilter(event.target.value); pager.reset(); }}>
                  <option value="">Todas</option>
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </Select>
              </Field>
              <Field label="Categoría">
                <Select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); pager.reset(); }}>
                  <option value="">Todas</option>
                  {[...new Set(candidates.map((candidate) => candidate.categoryLabel))].map((name) =>
                    <option key={name} value={name}>{name}</option>)}
                </Select>
              </Field>
              <Field label="Docente">
                <Select value={teacherFilter} onChange={(event) => { setTeacherFilter(event.target.value); pager.reset(); }}>
                  <option value="">Todos</option>
                  <option value="identificado">Identificado</option>
                  <option value="no_identificado">Docente no identificado</option>
                </Select>
              </Field>
            </div>

            <SelectionToolbar
              selectedCount={selectedCount}
              filteredCount={filteredCandidates.length}
              pageCount={pager.visible.length}
              onSelectPage={() => setCurrentPage(true)}
              onSelectFiltered={() => setAllFiltered(true)}
              onClear={() => setAllFiltered(false)}
            />

            {filteredCandidates.length === 0 ? (
              <p className="muted">No hay candidatos con estos filtros. Revisa los mensajes excluidos más abajo.</p>
            ) : (
              <div className="tablewrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="checkbox-col">
                        <SelectCheckbox
                          checked={allFilteredSelected}
                          indeterminate={someFilteredSelected && !allFilteredSelected}
                          onChange={setAllFiltered}
                          label="Seleccionar todos los candidatos filtrados"
                        />
                      </th>
                      <th className="date-col">Fecha y hora</th>
                      <th className="teacher-col">Docente</th>
                      <th>Problema detectado</th>
                      <th className="category-col">Categoría</th>
                      <th className="confidence-col">Confianza</th>
                      <th className="action-col">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pager.visible.map((candidate) => (
                      <CandidateRow
                        key={candidate.candidateId}
                        candidate={candidate}
                        categories={categories}
                        teachers={teachers}
                        onSelect={(selected) => patchCandidate(candidate.candidateId, { selected })}
                        onOpenDetail={() => setDetailId(candidate.candidateId)}
                        onPatch={(patch) => patchCandidate(candidate.candidateId, patch)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination page={pager.page} totalPages={pager.totalPages} total={pager.total}
              limit={pager.limit} onLimitChange={(limit: PageSize) => pager.setLimit(limit)}
              onChange={pager.setPage} />
          </Panel>

          <Panel title={`Mensajes excluidos del perfil TI (${filteredExcluded.length})`}
            subtitle="Se conserva la evidencia del análisis, pero no se seleccionan automáticamente para guardar.">
            <div className="filter-row">
              <SearchBox value={excludedSearch} onChange={(value) => { setExcludedSearch(value); excludedPager.reset(); }}
                placeholder="Buscar en excluidos" label="Buscar excluidos" />
              <Button variant="ghost" onClick={() => { setExcludedSearch(""); excludedPager.reset(); }}>Limpiar</Button>
            </div>
            {preview.excludedReasons.length > 0 && (
              <div className="badge-row">
                {preview.excludedReasons.slice(0, 8).map((entry) => (
                  <Badge key={`${entry.status}-${entry.reason}`} tone={toneFor(entry.status)}>{entry.reason}: {entry.count}</Badge>
                ))}
              </div>
            )}
            {filteredExcluded.length === 0 ? (
              <p className="muted">No hay mensajes excluidos con este filtro.</p>
            ) : (
              <div className="tablewrap">
                <table className="data-table">
                  <thead>
                    <tr><th className="date-col">Fecha y hora</th><th>Mensaje</th><th>Estado</th><th>Motivo</th><th className="action-col">Detalle</th></tr>
                  </thead>
                  <tbody>
                    {excludedPager.visible.map((row) => (
                      <tr key={`${row.position}-${row.date}-${row.time}`}>
                        <td className="nowrap">{row.date}<br /><small>{row.time}</small></td>
                        <td><div className="clamp-cell" title={row.originalMessage}>{row.originalMessage}</div></td>
                        <td><Badge tone={toneFor(row.status)}>{row.status === "duplicado" ? "Posible duplicado" : INCLUSION_LABELS[row.status] ?? row.status}</Badge></td>
                        <td><div className="clamp-cell muted" title={row.reason}>{row.reason}</div></td>
                        <td><button type="button" className="icon-btn" aria-label={`Ver detalle del excluido ${row.position}`}
                          onClick={() => setExcludedDetail(row)}><FileText size={15} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination page={excludedPager.page} totalPages={excludedPager.totalPages} total={excludedPager.total}
              limit={excludedPager.limit} onLimitChange={(limit: PageSize) => excludedPager.setLimit(limit)}
              onChange={excludedPager.setPage} />
          </Panel>
        </>
      )}

      {confirming && (
        <DetailDrawer title="Confirmar importación" subtitle="Revisión humana final" label="Confirmación de importación"
          onClose={() => setConfirming(false)}>
          <p>Se guardarán <strong>{selectedCount}</strong> incidencias TI seleccionadas. Los mensajes excluidos y no seleccionados no se guardarán.</p>
          <p className="muted">La operación se audita y la deduplicación se aplica en el backend.</p>
          <div className="button-row">
            <Button variant="primary" disabled={busy} onClick={() => void commit()}>
              {busy ? "Guardando…" : "Sí, guardar selección"}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>Cancelar</Button>
          </div>
        </DetailDrawer>
      )}

      {detailCandidate && (
        <CandidateDetail
          candidate={detailCandidate}
          categories={categories}
          teachers={teachers}
          onClose={() => setDetailId(null)}
          onPatch={(patch) => patchCandidate(detailCandidate.candidateId, patch)}
        />
      )}

      {excludedDetail && (
        <DetailDrawer title="Mensaje excluido" subtitle={`Posición ${excludedDetail.position}`} label="Detalle de mensaje excluido"
          onClose={() => setExcludedDetail(null)}>
          <div className="badge-row"><Badge tone={toneFor(excludedDetail.status)}>
            {excludedDetail.status === "duplicado" ? "Posible duplicado" : INCLUSION_LABELS[excludedDetail.status] ?? excludedDetail.status}
          </Badge></div>
          <p className="quote">{excludedDetail.originalMessage}</p>
          <p className="muted">Remitente original: {excludedDetail.sender} · {excludedDetail.date} {excludedDetail.time}</p>
          <p className="context-box">{excludedDetail.reason}</p>
        </DetailDrawer>
      )}
    </>
  );
}

function CandidateRow({ candidate, categories, teachers, onSelect, onPatch, onOpenDetail }: {
  candidate: PreviewCandidate;
  categories: Category[];
  teachers: Teacher[];
  onSelect: (selected: boolean) => void;
  onPatch: (patch: CandidatePatch) => void;
  onOpenDetail: () => void;
}) {
  const options = new Map<string, string>(teachers.map((teacher) => [teacher.id, teacher.fullName]));
  for (const suggestion of candidate.teacherCandidates) {
    if (!options.has(suggestion.teacherId)) options.set(suggestion.teacherId, `${suggestion.fullName} (${suggestion.method})`);
  }
  const categoryOptions = categories.some((category) => category.name === candidate.categoryLabel)
    ? categories
    : [{ id: "temp", name: candidate.categoryLabel, group: "otros" as const, description: null, keywords: [], active: true }, ...categories];

  return (
    <tr className={candidate.possibleDuplicate ? "row-warning" : ""}>
      <td>
        <input type="checkbox" checked={candidate.selected} aria-label={`Guardar mensaje de ${candidate.candidateId}`}
          onChange={(event) => onSelect(event.target.checked)} />
      </td>
      <td className="nowrap">{candidate.date}<br /><small>{candidate.time}</small></td>
      <td>
        <select aria-label={`Docente de ${candidate.candidateId}`} value={candidate.teacherId ?? ""}
          onChange={(event) => onPatch({ teacherId: event.target.value || null })}>
          <option value="">Docente no identificado</option>
          {[...options.entries()].map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </td>
      <td>
        <div className="clamp-cell" title={candidate.originalMessage}>{candidate.originalMessage}</div>
        <div className="badge-row compact-badges">
          <Badge tone={toneFor(candidate.inclusionStatus)}>{INCLUSION_LABELS[candidate.inclusionStatus] ?? candidate.inclusionStatus}</Badge>
          {candidate.mixed && <Badge tone="warning">Caso mixto</Badge>}
          {candidate.possibleDuplicate && <Badge tone="warning">Posible duplicado</Badge>}
        </div>
        <small className="muted clamp-cell" title={candidate.inclusionReason}>{candidate.inclusionReason}</small>
      </td>
      <td>
        <select aria-label={`Categoría de ${candidate.candidateId}`} value={candidate.categoryLabel}
          onChange={(event) => onPatch({ categoryLabel: event.target.value })}>
          {categoryOptions.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
        </select>
      </td>
      <td><Badge tone={candidate.confidence === "alta" ? "success" : candidate.confidence === "media" ? "info" : "warning"}>{candidate.confidence}</Badge></td>
      <td>
        <button type="button" className="icon-btn" aria-label={`Ver detalle de ${candidate.candidateId}`} onClick={onOpenDetail}>
          <FileText size={15} />
        </button>
      </td>
    </tr>
  );
}

function CandidateDetail({ candidate, categories, teachers, onClose, onPatch }: {
  candidate: PreviewCandidate;
  categories: Category[];
  teachers: Teacher[];
  onClose: () => void;
  onPatch: (patch: CandidatePatch) => void;
}) {
  const options = new Map<string, string>(teachers.map((teacher) => [teacher.id, teacher.fullName]));
  for (const suggestion of candidate.teacherCandidates) {
    if (!options.has(suggestion.teacherId)) options.set(suggestion.teacherId, `${suggestion.fullName} (${suggestion.method})`);
  }

  return (
    <DetailDrawer title="Detalle del candidato" subtitle={`${candidate.date} ${candidate.time}`} label="Detalle de candidato" onClose={onClose}>
      <div className="badge-row">
        <Badge tone={toneFor(candidate.inclusionStatus)}>{INCLUSION_LABELS[candidate.inclusionStatus] ?? candidate.inclusionStatus}</Badge>
        <Badge tone={candidate.confidence === "alta" ? "success" : candidate.confidence === "media" ? "info" : "warning"}>
          Confianza: {candidate.confidence}
        </Badge>
        {candidate.possibleDuplicate && <Badge tone="warning">Posible duplicado</Badge>}
      </div>
      <p className="context-box">{candidate.inclusionReason}</p>

      <div className="drawer-section">
        <h3>Problema detectado</h3>
        <p className="quote">{candidate.originalMessage}</p>
        <p className="muted">Remitente original (trazabilidad, no editable): {candidate.requesterName}</p>
        {candidate.tiTopics.length > 0 && <p className="muted">Temas TI: {candidate.tiTopics.join("; ")}</p>}
        {candidate.nonTiTopics.length > 0 && <p className="muted">Otros temas: {candidate.nonTiTopics.join("; ")}</p>}
        {candidate.mixed && <p className="hint-warning"><AlertTriangle size={14} /> Caso mixto: se conserva el mensaje completo; revisión humana antes de guardar.</p>}
      </div>

      <div className="drawer-section form-stack">
        <h3>Corrección manual</h3>
        <Field label="Docente" hint="Nombre institucional del catálogo; las coincidencias ambiguas no se enlazan solas.">
          <select aria-label="Docente seleccionado" value={candidate.teacherId ?? ""}
            onChange={(event) => onPatch({ teacherId: event.target.value || null })}>
            <option value="">Docente no identificado</option>
            {[...options.entries()].map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </Field>
        {candidate.teacherSuggestion && !candidate.teacherId && (
          <p className="muted">Sugerencia no Vinculada automáticamente: {candidate.teacherSuggestion.fullName} ({candidate.teacherSuggestion.method}).</p>
        )}
        <Field label="Categoría">
          <select aria-label="Categoría seleccionada" value={candidate.categoryLabel}
            onChange={(event) => onPatch({ categoryLabel: event.target.value })}>
            {(categories.some((category) => category.name === candidate.categoryLabel)
              ? categories
              : [{ id: "temp", name: candidate.categoryLabel }, ...categories]).map((category) =>
              <option key={category.id} value={category.name}>{category.name}</option>)}
          </select>
        </Field>
        <Field label="Contextualización">
          <TextArea rows={3} value={candidate.contextualization}
            onChange={(event) => onPatch({ contextualization: event.target.value })} />
        </Field>
      </div>

      <div className="drawer-section">
        <h3>Respuestas y seguimiento ({candidate.responses.length})</h3>
        {candidate.responses.length === 0 ? <p className="muted">Sin respuestas dentro de la ventana de contexto.</p> : (
          <ul className="response-list">
            {candidate.responses.map((response) => (
              <li key={`${response.date}-${response.time}-${response.sender}`}>
                <Badge tone={response.role === "confirmacion" ? "success" : response.role === "ack" ? "info" : "neutral"}>{response.role}</Badge>
                <span><b>{response.sender}</b>{response.isStaff ? " · personal" : ""} · {response.date} {response.time}</span>
                <span>{response.text}</span>
                {response.uncertain && <Badge tone="warning">Asociación incierta</Badge>}
              </li>
            ))}
          </ul>
        )}
        <p className="muted">Categorías coincidentes: {candidate.matchedCategories.join("; ")} · estado sugerido: {candidate.suggestedStatus}</p>
        {candidate.suggestedStatus === "en_atencion" && (
          <p className="hint-warning">La atención iniciada («me acerco», «voy a revisar») no implica incidencia resuelta.</p>
        )}
        <p className="muted">Regla: {candidate.explanation}</p>
      </div>
    </DetailDrawer>
  );
}

export function ImportSourceIcon() {
  return <><Upload size={16} /><FileText size={16} /><MessageSquareText size={16} /></>;
}
