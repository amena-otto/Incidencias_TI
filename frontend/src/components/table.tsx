import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import {
  DEFAULT_PAGE_SIZE, EmptyState, Input, PAGE_SIZES, type PageSize,
} from "./ui";

export { PAGE_SIZES, DEFAULT_PAGE_SIZE, type PageSize };

export type PageInfo = { page: number; limit: PageSize; total: number; totalPages: number };

/**
 * Paginación local para candidatos no guardados. La selección y las ediciones
 * viven en el arreglo original, así que cambiar de página nunca las pierde.
 */
export function useLocalPager<T>(items: readonly T[], initialLimit: PageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const [limit, setLimitState] = useState<PageSize>(initialLimit);
  const totalPages = Math.max(1, Math.ceil(items.length / limit));
  const safePage = Math.min(page, totalPages);
  const visible = useMemo(
    () => items.slice((safePage - 1) * limit, safePage * limit),
    [items, safePage, limit],
  );

  function setLimit(next: PageSize) {
    setLimitState(next);
    setPage(1);
  }

  return {
    page: safePage, limit, setPage, setLimit, visible,
    total: items.length, totalPages,
    reset: () => setPage(1),
    meta: { page: safePage, limit, total: items.length, totalPages } satisfies PageInfo,
  };
}

/** Paginación de registros persistidos: el backend devuelve `meta`. */
export function useRemotePager(initialLimit: PageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const [limit, setLimitState] = useState<PageSize>(initialLimit);
  const [meta, setMeta] = useState<PageInfo | null>(null);

  function setLimit(next: PageSize) {
    setLimitState(next);
    setPage(1);
  }

  function applyMeta(value: PageInfo | null) {
    setMeta(value);
    if (value && page > value.totalPages) setPage(value.totalPages);
  }

  return {
    page, limit, setPage, setLimit, applyMeta,
    reset: () => setPage(1),
    meta: meta ?? { page, limit, total: 0, totalPages: 1 },
  };
}

export function SearchBox({ value, onChange, placeholder = "Buscar", label = "Buscar", className = "" }: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  return (
    <label className={`field search-box ${className}`}>
      <span>{label}</span>
      <span className="search-input">
        <Search size={14} aria-hidden="true" />
        <Input aria-label={label} value={value} placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)} />
        {value && (
          <button type="button" className="icon-btn" aria-label="Limpiar búsqueda" onClick={() => onChange("")}>
            <X size={13} />
          </button>
        )}
      </span>
    </label>
  );
}

/** Checkbox de cabecera con estado indeterminado real (bulk selection). */
export function SelectCheckbox({ checked, indeterminate = false, onChange, label }: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);
  return (
    <input ref={ref} type="checkbox" checked={checked} aria-label={label}
      onChange={(event) => onChange(event.target.checked)} />
  );
}

export function SelectionToolbar({ selectedCount, filteredCount, pageCount, onSelectFiltered, onClear, onSelectPage, children }: {
  selectedCount: number;
  filteredCount: number;
  pageCount: number;
  onSelectFiltered?: () => void;
  onClear: () => void;
  onSelectPage?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="selection-toolbar" role="toolbar" aria-label="Selección múltiple">
      <span className="selection-count" aria-live="polite"><strong>{selectedCount}</strong> seleccionado(s) de {filteredCount}</span>
      <div className="panel-actions">
        {onSelectPage && pageCount > 0 && <button type="button" className="btn btn-ghost" onClick={onSelectPage}>Seleccionar página</button>}
        {onSelectFiltered && filteredCount > 0 && <button type="button" className="btn btn-ghost" onClick={onSelectFiltered}>Seleccionar todos los filtrados</button>}
        <button type="button" className="btn btn-ghost" disabled={selectedCount === 0} onClick={onClear}>Deseleccionar todos</button>
        {children}
      </div>
    </div>
  );
}

export function DetailDrawer({ title, subtitle, onClose, children, label = "Panel de detalle" }: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  label?: string;
}) {
  return (
    <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="drawer" aria-label={label}>
        <div className="drawer-head">
          <div>
            {subtitle && <small>{subtitle}</small>}
            <h2>{title}</h2>
          </div>
          <button className="icon-btn" aria-label="Cerrar detalle" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

export function TableEmptyState({ title, description }: { title: string; description?: string }) {
  return <EmptyState title={title} description={description} />;
}
