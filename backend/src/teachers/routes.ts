import { Router } from "express";
import multer from "multer";
import { and, asc, count, eq, inArray, like } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { teacherAliases, teachers } from "../db/schema.js";
import { env } from "../config/env.js";
import { asyncHandler, errors, ok } from "../lib/http.js";
import { createPreview, consumePreview } from "../lib/preview-store.js";
import { normalize } from "../lib/text.js";
import { boundedText, uuidSchema } from "../lib/validation.js";
import { offsetFor, pagerSchema, pageInfo } from "../lib/pagination.js";
import { audit, requireAuth, requirePermission } from "../auth/middleware.js";
import { matchTeacher } from "./matching.js";
import { buildTeacherExport, buildTeacherTemplate, parseTeacherWorkbook, type TeacherImportRow } from "./excel.js";

const r = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowed = /\.xlsx$/i.test(file.originalname)
      && ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"].includes(file.mimetype);
    callback(null, allowed);
  },
});

const teacherSchema = z.object({
  fullName: boundedText(180),
  email: z.string().trim().email().max(254).optional(),
  code: z.string().trim().max(40).optional(),
  alias: boundedText(180).optional(),
});

const updateSchema = z.object({
  fullName: boundedText(180).optional(),
  email: z.string().trim().email().max(254).nullable().optional(),
  active: z.boolean().optional(),
});

async function aliasesFor(ids: string[]): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (!ids.length) return result;
  const rows = await db.select().from(teacherAliases).where(inArray(teacherAliases.teacherId, ids));
  for (const row of rows) {
    const list = result.get(row.teacherId) ?? [];
    list.push(row.alias);
    result.set(row.teacherId, list);
  }
  return result;
}

r.use(requireAuth);

r.get("/", asyncHandler(async (req, res) => {
  const search = String(req.query.search ?? "").trim();
  const active = req.query.active === undefined ? undefined : req.query.active === "true";
  const filters = [];
  if (search) filters.push(like(teachers.normalizedName, `%${normalize(search)}%`));
  if (active !== undefined) filters.push(eq(teachers.active, active));
  const pager = pagerSchema.parse(req.query);
  const where = filters.length ? and(...filters) : undefined;
  const paged = pager.page !== undefined || pager.limit !== undefined;
  const [rows, totalRows] = await Promise.all([
    db.select().from(teachers).where(where).orderBy(asc(teachers.fullName))
      .limit(paged ? (pager.limit ?? 10) : 500).offset(paged ? offsetFor(pager) : 0),
    paged ? db.select({ value: count() }).from(teachers).where(where) : Promise.resolve([{ value: 0 }]),
  ]);
  const aliases = await aliasesFor(rows.map((row) => row.id));
  const meta = paged ? pageInfo(pager, Number(totalRows[0]?.value ?? 0)) : undefined;
  return ok(res, rows.map((row) => ({ ...row, aliases: aliases.get(row.id) ?? [] })), meta);
}));

r.post("/", requirePermission("teachers:write"), asyncHandler(async (req, res) => {
  const parsed = teacherSchema.safeParse(req.body);
  if (!parsed.success) throw errors.badRequest("Datos de docente inválidos", parsed.error.flatten());
  const { fullName, email, code, alias } = parsed.data;
  const created = await db.transaction(async (tx) => {
    const [teacher] = await tx.insert(teachers).values({
      fullName,
      normalizedName: normalize(fullName),
      email: email?.toLocaleLowerCase("es") ?? null,
    }).returning();
    if (alias) {
      await tx.insert(teacherAliases).values({ teacherId: teacher.id, alias, normalizedAlias: normalize(alias) });
    }
    return teacher;
  });
  await audit(req, "teacher_created", "teachers", created.id, { hasEmail: Boolean(email), hasCode: Boolean(code), hasAlias: Boolean(alias) });
  return ok(res, created, undefined, 201);
}));

r.patch("/:id", requirePermission("teachers:write"), asyncHandler(async (req, res) => {
  const id = uuidSchema.parse(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) throw errors.badRequest("Datos de docente inválidos", parsed.error.flatten());
  const data = parsed.data;
  const [updated] = await db.update(teachers).set({
    ...(data.fullName ? { fullName: data.fullName, normalizedName: normalize(data.fullName) } : {}),
    ...(data.email !== undefined ? { email: data.email?.toLocaleLowerCase("es") ?? null } : {}),
    ...(data.active !== undefined ? { active: data.active } : {}),
  }).where(eq(teachers.id, id)).returning();
  if (!updated) throw errors.notFound("Docente no encontrado");
  await audit(req, "teacher_updated", "teachers", id, { fields: Object.keys(data) });
  return ok(res, updated);
}));

r.post("/:id/aliases", requirePermission("teachers:write"), asyncHandler(async (req, res) => {
  const teacherId = uuidSchema.parse(req.params.id);
  const parsed = z.object({ alias: boundedText(180) }).safeParse(req.body);
  if (!parsed.success) throw errors.badRequest("Alias inválido", parsed.error.flatten());
  const [alias] = await db.insert(teacherAliases).values({
    teacherId, alias: parsed.data.alias, normalizedAlias: normalize(parsed.data.alias),
  }).onConflictDoNothing().returning();
  if (!alias) throw errors.conflict("El alias ya está registrado para otro docente");
  await audit(req, "teacher_alias_created", "teachers", teacherId);
  return ok(res, alias, undefined, 201);
}));

r.get("/import/template", requirePermission("teachers:write"), asyncHandler(async (_req, res) => {
  const buffer = await buildTeacherTemplate();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="plantilla_docentes_smartdesk.xlsx"');
  res.send(buffer);
}));

r.post("/import/preview", requirePermission("teachers:write"), upload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) throw errors.badRequest("Carga un archivo .xlsx");
  let parsed: Awaited<ReturnType<typeof parseTeacherWorkbook>>;
  try {
    parsed = await parseTeacherWorkbook(req.file.buffer);
  } catch (error) {
    throw errors.badRequest(error instanceof Error ? error.message : "No se pudo leer el Excel");
  }
  const token = createPreview({ rows: parsed.rows });
  return ok(res, {
    token,
    rows: parsed.rows,
    totalRows: parsed.totalRows,
    validRows: parsed.rows.filter((row) => !row.errors.length && !row.duplicate).length,
    invalidRows: parsed.rows.filter((row) => row.errors.length > 0).length,
  });
}));

r.post("/import/commit", requirePermission("teachers:write"), asyncHandler(async (req, res) => {
  const parsed = z.object({
    token: z.string().min(20),
    rows: z.array(z.object({ rowNumber: z.number().int().positive(), selected: z.boolean() })).min(1).max(2000),
  }).safeParse(req.body);
  if (!parsed.success) throw errors.badRequest("Datos de importación inválidos", parsed.error.flatten());

  const preview = consumePreview<{ rows: TeacherImportRow[] }>(parsed.data.token);
  const selectedNumbers = new Set(parsed.data.rows.filter((row) => row.selected).map((row) => row.rowNumber));
  const selected = preview.rows.filter((row) => selectedNumbers.has(row.rowNumber) && !row.errors.length && !row.duplicate);

  const result = await db.transaction(async (tx) => {
    let created = 0;
    let skipped = 0;
    for (const row of selected) {
      const normalized = normalize(row.fullName);
      const [existing] = await tx.select({ id: teachers.id }).from(teachers).where(eq(teachers.normalizedName, normalized)).limit(1);
      if (existing) {
        skipped += 1;
        continue;
      }
      const [teacher] = await tx.insert(teachers).values({
        fullName: row.fullName,
        normalizedName: normalized,
        email: row.email ? row.email.toLocaleLowerCase("es") : null,
      }).returning();
      if (row.alias) {
        await tx.insert(teacherAliases).values({ teacherId: teacher.id, alias: row.alias, normalizedAlias: normalize(row.alias) })
          .onConflictDoNothing();
      }
      created += 1;
    }
    return { created, skipped };
  });

  await audit(req, "teachers_imported", "teachers", undefined, result);
  return ok(res, { message: "Importación de docentes finalizada", ...result });
}));

r.get("/export", asyncHandler(async (_req, res) => {
  const rows = await db.select().from(teachers).orderBy(asc(teachers.fullName)).limit(2000);
  const aliases = await aliasesFor(rows.map((row) => row.id));
  const buffer = await buildTeacherExport(rows.map((row) => ({
    fullName: row.fullName, email: row.email, active: row.active, aliases: aliases.get(row.id) ?? [],
  })));
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="catalogo_docentes_smartdesk.xlsx"');
  res.send(buffer);
}));

r.post("/match", asyncHandler(async (req, res) => {
  const parsed = z.object({ name: boundedText(180) }).safeParse(req.body);
  if (!parsed.success) throw errors.badRequest("Nombre inválido", parsed.error.flatten());
  const [allTeachers, allAliases] = await Promise.all([
    db.select({ id: teachers.id, fullName: teachers.fullName, normalizedName: teachers.normalizedName }).from(teachers).where(eq(teachers.active, true)).limit(2000),
    db.select({ teacherId: teacherAliases.teacherId, alias: teacherAliases.alias, normalizedAlias: teacherAliases.normalizedAlias }).from(teacherAliases).limit(5000),
  ]);
  return ok(res, matchTeacher(parsed.data.name, allTeachers, allAliases));
}));

export default r;
