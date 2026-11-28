import { z } from "zod";

/** Tamaños de página permitidos en todas las vistas del proyecto. */
export const PAGE_SIZES = [5, 10, 20] as const;
export const DEFAULT_PAGE_SIZE = 10;

// Express expone query params como strings ("10"), no como números (10).
// Los tamaños se coerciona antes de validarlos para no rechazar `/?limit=10`.
const queryNumber = (value: unknown) =>
  value === "" || value === null || value === undefined ? undefined : value;

export const pagerSchema = z.object({
  page: z.preprocess(queryNumber, z.coerce.number().int().min(1).optional()),
  limit: z.preprocess(queryNumber, z.coerce.number().int().refine(
    (value) => (PAGE_SIZES as readonly number[]).includes(value),
    { message: `limit debe ser uno de ${PAGE_SIZES.join(", ")}` },
  ).optional()),
});

export type Pager = z.infer<typeof pagerSchema>;
export type PageMeta = { page: number; limit: number; total: number; totalPages: number };

export function pageInfo(pager: Pager, total: number): PageMeta {
  const limit = pager.limit ?? DEFAULT_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(pager.page ?? 1, totalPages);
  return { page, limit, total, totalPages };
}

export function offsetFor(pager: Pager): number {
  const limit = pager.limit ?? DEFAULT_PAGE_SIZE;
  return ((pager.page ?? 1) - 1) * limit;
}

export function paginateRows<T>(rows: readonly T[], pager: Pager): { rows: T[]; meta?: PageMeta } {
  if (pager.page === undefined && pager.limit === undefined) return { rows: [...rows] };
  const meta = pageInfo(pager, rows.length);
  return {
    rows: rows.slice((meta.page - 1) * meta.limit, meta.page * meta.limit),
    meta,
  };
}
