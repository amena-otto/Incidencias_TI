import { useCallback, useEffect, useState, type FormEvent } from "react";
import { FileText } from "lucide-react";
import { api, query } from "../lib/api";
import type { Category } from "../lib/types";
import {
  Badge, Button, ErrorBanner, Field, Input, Loading, Pagination, Panel,
  Select, SuccessBanner, type PageSize,
} from "../components/ui";
import { DetailDrawer, SearchBox } from "../components/table";
import { useAuth } from "../auth/AuthContext";

const GROUPS = ["ti", "asistencia", "operaciones", "infraestructura", "seguridad", "otros"] as const;

export function CategoriasPage() {
  const { can } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<PageSize>(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [group, setGroup] = useState<(typeof GROUPS)[number]>("ti");
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, meta } = await api.get<Category[]>(`/categories${query({ all: "true", search, page, limit })}`);
      setCategories(data);
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

  async function create(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api.post("/categories", {
        name: name.trim(),
        group,
        description: description.trim() || undefined,
        keywords: keywords.split(",").map((value) => value.trim()).filter(Boolean),
      });
      setNotice("Categoría creada.");
      setName(""); setDescription(""); setKeywords("");
      void load();
    } catch (caught) {
      setError(caught);
    }
  }

  async function toggle(category: Category) {
    try {
      await api.patch(`/categories/${category.id}`, { active: !category.active });
      setNotice(category.active ? "Categoría desactivada." : "Categoría activada.");
      setDetailId(null);
      void load();
    } catch (caught) {
      setError(caught);
    }
  }

  const detail = categories.find((category) => category.id === detailId) ?? null;

  return (
    <>
      <Panel title="Catálogo único de categorías" subtitle="Este mismo catálogo alimenta el clasificador, la importación, los filtros y los reportes. El perfil TI limita qué categorías se importan.">
        <ErrorBanner error={error} onClose={() => setError(null)} />
        <SuccessBanner>{notice}</SuccessBanner>
        <div className="filter-row">
          <SearchBox value={search} onChange={(value) => { setSearch(value); setPage(1); }}
            placeholder="Nombre de categoría" label="Buscar categoría" />
        </div>
        {loading ? <Loading label="Cargando categorías…" /> : (
          <div className="tablewrap">
            <table className="data-table">
              <thead><tr><th>Categoría</th><th>Grupo</th><th>Descripción</th><th>Estado</th><th className="action-col">Detalle</th></tr></thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td><div className="clamp-cell" title={category.name}>{category.name}</div></td>
                    <td><Badge tone="info">{category.group}</Badge></td>
                    <td><div className="clamp-cell muted" title={category.description ?? ""}>{category.description ?? "—"}</div></td>
                    <td><Badge tone={category.active ? "success" : "neutral"}>{category.active ? "Activa" : "Inactiva"}</Badge></td>
                    <td><button type="button" className="icon-btn" aria-label={`Ver detalle de ${category.name}`}
                      onClick={() => setDetailId(category.id)}><FileText size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage}
          limit={limit} onLimitChange={(next) => { setLimit(next); setPage(1); }} />
      </Panel>

      {can("categories:write") && (
        <Panel title="Nueva categoría" subtitle="El nombre debe ser único. El backend valida el grupo y las palabras clave.">
          <form onSubmit={create} className="form-stack narrow">
            <Field label="Nombre"><Input value={name} onChange={(event) => setName(event.target.value)} required minLength={3} placeholder="TI · Nueva categoría" /></Field>
            <Field label="Grupo">
              <Select value={group} onChange={(event) => setGroup(event.target.value as typeof group)}>
                {GROUPS.map((value) => <option key={value} value={value}>{value}</option>)}
              </Select>
            </Field>
            <Field label="Descripción"><Input value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
            <Field label="Palabras clave" hint="Separadas por coma"><Input value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder="keyword1, keyword2" /></Field>
            <Button type="submit" variant="primary">Crear categoría</Button>
          </form>
        </Panel>
      )}

      {detail && (
        <DetailDrawer title={detail.name} subtitle="Catálogo de categorías" label="Detalle de categoría" onClose={() => setDetailId(null)}>
          <div className="badge-row">
            <Badge tone="info">{detail.group}</Badge>
            <Badge tone={detail.active ? "success" : "neutral"}>{detail.active ? "Activa" : "Inactiva"}</Badge>
          </div>
          <div className="drawer-section">
            <h3>Descripción</h3>
            <p className="muted">{detail.description ?? "Sin descripción."}</p>
            <h3>Palabras clave</h3>
            <div className="badge-row">{detail.keywords.length
              ? detail.keywords.map((value) => <Badge key={value}>{value}</Badge>)
              : <span className="muted">Sin palabras clave.</span>}</div>
            {can("categories:write") && (
              <Button onClick={() => void toggle(detail)}>{detail.active ? "Desactivar" : "Activar"}</Button>
            )}
          </div>
        </DetailDrawer>
      )}
    </>
  );
}
