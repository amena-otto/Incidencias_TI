import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { AlertCircle, CheckCircle2, Inbox } from "lucide-react";
import { errorMessage } from "../lib/api";

export function Panel({ title, subtitle, actions, children, className = "" }: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <div className="panel-head">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          {actions && <div className="panel-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Button({ variant = "secondary", className = "", children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "link";
}) {
  return <button className={`btn btn-${variant} ${className}`} {...props}>{children}</button>;
}

export function Field({ label, hint, children, className = "" }: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      {children}
      {hint && <small className="muted">{hint}</small>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} />;
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "info" | "success" | "warning" | "danger"; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function ErrorBanner({ error, onClose }: { error: unknown; onClose?: () => void }) {
  if (!error) return null;
  return (
    <div className="notice notice-error" role="alert">
      <AlertCircle size={17} />
      <span>{errorMessage(error)}</span>
      {onClose && <button className="icon-btn" aria-label="Cerrar aviso" onClick={onClose}>×</button>}
    </div>
  );
}

export function SuccessBanner({ children, tone = "success" }: { children: ReactNode; tone?: "success" | "info" }) {
  if (!children) return null;
  return <div className={`notice notice-${tone}`}><CheckCircle2 size={17} /><span>{children}</span></div>;
}

export function EmptyState({ title = "Sin datos", description }: { title?: string; description?: string }) {
  return (
    <div className="empty-state">
      <Inbox size={26} />
      <strong>{title}</strong>
      {description && <p className="muted">{description}</p>}
    </div>
  );
}

export function Loading({ label = "Cargando…" }: { label?: string }) {
  return <div className="loading" role="status"><span className="spinner" />{label}</div>;
}

export function StatCard({ label, value, hint, tone = "info" }: { label: string; value: string | number; hint?: string; tone?: "info" | "success" | "warning" | "danger" }) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}

/** Tamaños de página compartidos por todas las tablas del proyecto. */
export const PAGE_SIZES = [5, 10, 20] as const;
export const DEFAULT_PAGE_SIZE = 10;
export type PageSize = (typeof PAGE_SIZES)[number];

export function Pagination({ page, totalPages, total, onChange, limit, onLimitChange }: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
  limit?: PageSize;
  onLimitChange?: (limit: PageSize) => void;
}) {
  return (
    <div className="pagination">
      <div className="pagination-info">
        <span>{total} registro(s) · página {page} de {Math.max(1, totalPages)}</span>
        {limit !== undefined && onLimitChange && (
          <label className="page-size">
            <span>Por página</span>
            <select aria-label="Registros por página" value={limit}
              onChange={(event) => onLimitChange(Number(event.target.value) as PageSize)}>
              {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
        )}
      </div>
      <div className="pagination-actions">
        <Button disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</Button>
        <Button disabled={page >= Math.max(1, totalPages)} onClick={() => onChange(page + 1)}>Siguiente</Button>
      </div>
    </div>
  );
}

export function NoPermission({ permission }: { permission: string }) {
  return <ErrorBanner error={{ message: `Tu perfil no tiene el permiso ${permission}.` }} />;
}
