import { Router } from "express";
import { asc, count, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { profiles } from "../db/schema.js";
import { asyncHandler, errors, ok } from "../lib/http.js";
import { boundedText, uuidSchema } from "../lib/validation.js";
import { offsetFor, pagerSchema, pageInfo } from "../lib/pagination.js";
import { audit, requirePermission } from "../auth/middleware.js";
import { hashPassword } from "../auth/password.js";

const r = Router();
r.use(requirePermission("users:write"));

const roleSchema = z.enum(["admin", "tecnico", "consulta"]);
const createSchema = z.object({
  fullName: boundedText(180),
  email: z.string().trim().toLowerCase().max(254).email(),
  password: z.string().min(12).max(200),
  role: roleSchema.default("consulta"),
});

r.get("/", asyncHandler(async (req, res) => {
  const pager = pagerSchema.parse(req.query);
  const search = String(req.query.search ?? "").trim();
  const where = search
    ? or(ilike(profiles.fullName, `%${search.replace(/[%$]/g, "")}%`), ilike(profiles.email, `%${search.replace(/[%$]/g, "")}%`))
    : undefined;
  const paged = pager.page !== undefined || pager.limit !== undefined;
  const [rows, totalRows] = await Promise.all([
    db.select().from(profiles).where(where).orderBy(asc(profiles.fullName))
      .limit(paged ? (pager.limit ?? 10) : 500).offset(paged ? offsetFor(pager) : 0),
    paged ? db.select({ value: count() }).from(profiles).where(where) : Promise.resolve([{ value: 0 }]),
  ]);
  const meta = paged ? pageInfo(pager, Number(totalRows[0]?.value ?? 0)) : undefined;
  return ok(res, rows.map((row) => ({
    id: row.id, fullName: row.fullName, email: row.email, role: row.role,
    active: row.active, createdAt: row.createdAt, hasPassword: Boolean(row.passwordHash),
  })), meta);
}));

r.post("/", asyncHandler(async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) throw errors.badRequest("Usuario inválido", parsed.error.flatten());
  const passwordHash = await hashPassword(parsed.data.password);
  const [created] = await db.insert(profiles).values({
    fullName: parsed.data.fullName,
    email: parsed.data.email,
    passwordHash,
    role: parsed.data.role,
  }).onConflictDoNothing().returning({
    id: profiles.id, fullName: profiles.fullName, email: profiles.email, role: profiles.role, active: profiles.active,
  });
  if (!created) throw errors.conflict("El correo ya está registrado");
  await audit(req, "user_created", "users", created.id, { role: created.role });
  return ok(res, created, undefined, 201);
}));

r.patch("/:id", asyncHandler(async (req, res) => {
  const id = uuidSchema.parse(req.params.id);
  const parsed = z.object({ fullName: boundedText(180).optional(), role: roleSchema.optional(), active: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) throw errors.badRequest("Datos inválidos", parsed.error.flatten());
  const [updated] = await db.update(profiles).set(parsed.data).where(eq(profiles.id, id)).returning({
    id: profiles.id, fullName: profiles.fullName, email: profiles.email, role: profiles.role, active: profiles.active,
  });
  if (!updated) throw errors.notFound("Usuario no encontrado");
  await audit(req, "user_updated", "users", id, { fields: Object.keys(parsed.data) });
  return ok(res, updated);
}));

r.post("/:id/reset-password", asyncHandler(async (req, res) => {
  const id = uuidSchema.parse(req.params.id);
  const parsed = z.object({ password: z.string().min(12).max(200) }).safeParse(req.body);
  if (!parsed.success) throw errors.badRequest("La contraseña debe tener al menos 12 caracteres");
  const passwordHash = await hashPassword(parsed.data.password);
  const [updated] = await db.update(profiles).set({ passwordHash }).where(eq(profiles.id, id)).returning({ id: profiles.id });
  if (!updated) throw errors.notFound("Usuario no encontrado");
  await audit(req, "user_password_reset", "users", id);
  return ok(res, { message: "Contraseña actualizada" });
}));

export default r;
