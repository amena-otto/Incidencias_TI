import { Router } from "express";
import { and, asc, count, eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { categories } from "../db/schema.js";
import { asyncHandler, errors, ok } from "../lib/http.js";
import { boundedText, uuidSchema } from "../lib/validation.js";
import { offsetFor, pagerSchema, pageInfo } from "../lib/pagination.js";
import { audit, requireAuth, requirePermission } from "../auth/middleware.js";

const r = Router();
r.use(requireAuth);

const schema = z.object({
  name: boundedText(120),
  group: z.enum(["ti", "asistencia", "operaciones", "infraestructura", "seguridad", "otros"]),
  description: z.string().trim().max(500).optional(),
  keywords: z.array(z.string().trim().max(40)).max(50).default([]),
  active: z.boolean().default(true),
});

r.get("/", asyncHandler(async (req, res) => {
  const pager = pagerSchema.parse(req.query);
  const filters = [];
  if (req.query.all !== "true") filters.push(eq(categories.active, true));
  const search = String(req.query.search ?? "").trim();
  if (search) filters.push(ilike(categories.name, `%${search.replace(/[%$]/g, "")}%`));
  const where = filters.length ? and(...filters) : undefined;
  const paged = pager.page !== undefined || pager.limit !== undefined;
  const [rows, totalRows] = await Promise.all([
    db.select().from(categories).where(where).orderBy(asc(categories.name))
      .limit(paged ? (pager.limit ?? 10) : 500).offset(paged ? offsetFor(pager) : 0),
    paged ? db.select({ value: count() }).from(categories).where(where) : Promise.resolve([{ value: 0 }]),
  ]);
  return ok(res, rows, paged ? pageInfo(pager, Number(totalRows[0]?.value ?? 0)) : undefined);
}));

r.post("/", requirePermission("categories:write"), asyncHandler(async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw errors.badRequest("Categoría inválida", parsed.error.flatten());
  const [created] = await db.insert(categories).values(parsed.data).onConflictDoNothing().returning();
  if (!created) throw errors.conflict("Ya existe una categoría con ese nombre");
  await audit(req, "category_created", "categories", created.id, { name: created.name });
  return ok(res, created, undefined, 201);
}));

r.patch("/:id", requirePermission("categories:write"), asyncHandler(async (req, res) => {
  const id = uuidSchema.parse(req.params.id);
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) throw errors.badRequest("Categoría inválida", parsed.error.flatten());
  const [updated] = await db.update(categories).set(parsed.data).where(eq(categories.id, id)).returning();
  if (!updated) throw errors.notFound("Categoría no encontrada");
  await audit(req, "category_updated", "categories", id, { fields: Object.keys(parsed.data) });
  return ok(res, updated);
}));

export default r;
