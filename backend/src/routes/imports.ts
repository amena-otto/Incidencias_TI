import { Router } from "express";
import multer from "multer";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { parseChat } from "../importer/whatsapp.js";
import { classify } from "../classifier/rules.js";
import { db } from "../db/client.js";
import { imports as chatImports, incidents, categories, incidentMessages, incidentHistory } from "../db/schema.js";

const r = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const candidateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  requesterName: z.string().trim().min(1).max(180),
  originalMessage: z.string().trim().min(1),
  categoryLabel: z.string().trim().min(1).max(120),
  contextualization: z.string().optional().default(""),
});
const commitSchema = z.object({
  hash: z.string().regex(/^[a-f0-9]{64}$/i),
  sourceName: z.string().max(255).optional().default("Conversación WhatsApp"),
  channel: z.enum(["whatsapp_txt", "texto_pegado"]),
  totalMessages: z.number().int().nonnegative(),
  rows: z.array(candidateSchema).min(1).max(500),
});

function requestTypeFor(label: string) {
  if (label.startsWith("TI ·")) return "ti" as const;
  if (label.startsWith("Asistencia ·")) return "asistencia" as const;
  if (label.startsWith("Operaciones ·")) return "operaciones" as const;
  if (label.startsWith("Infraestructura ·")) return "infraestructura" as const;
  if (label.startsWith("Seguridad ·")) return "seguridad" as const;
  return "otros" as const;
}

r.post("/preview", upload.single("file"), (req, res) => {
  const text = req.file?.buffer.toString("utf8") ?? String(req.body.text ?? "");
  if (!text.trim()) return res.status(400).json({ message: "Carga un TXT o pega una conversación" });
  const messages = parseChat(text);
  const candidates = classify(messages);
  return res.json({
    hash: createHash("sha256").update(text).digest("hex"),
    sourceName: req.file?.originalname ?? "Texto pegado",
    channel: req.file ? "whatsapp_txt" : "texto_pegado",
    totalMessages: messages.length,
    candidates,
    unclassifiedMessages: messages.length - candidates.length,
  });
});

r.post("/commit", async (req, res) => {
  const parsed = commitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Datos de importación inválidos", errors: parsed.error.flatten() });
  const payload = parsed.data;

  try {
    const result = await db.transaction(async (tx) => {
      const [createdImport] = await tx.insert(chatImports).values({
        sourceName: payload.sourceName,
        channel: payload.channel,
        contentHash: payload.hash,
        totalMessages: payload.totalMessages,
        candidateCount: payload.rows.length,
      }).onConflictDoNothing({ target: chatImports.contentHash }).returning({ id: chatImports.id });

      if (!createdImport) return { duplicate: true as const, saved: 0, importId: null };

      let saved = 0;
      for (const row of payload.rows) {
        const [category] = await tx.select({ id: categories.id }).from(categories)
          .where(and(eq(categories.name, row.categoryLabel), eq(categories.active, true))).limit(1);
        const incidentDate = new Date(`${row.date}T12:00:00-05:00`);

        const [incident] = await tx.insert(incidents).values({
          incidentDate,
          incidentTime: row.time,
          requesterName: row.requesterName,
          originalMessage: row.originalMessage,
          categoryId: category?.id ?? null,
          categoryLabel: row.categoryLabel,
          requestType: requestTypeFor(row.categoryLabel),
          contextualization: row.contextualization || null,
          channel: payload.channel,
          importId: createdImport.id,
        }).returning({ id: incidents.id });

        await tx.insert(incidentMessages).values({
          incidentId: incident.id,
          senderName: row.requesterName,
          messageText: row.originalMessage,
          messageDate: incidentDate,
          messageTime: row.time,
          type: "reporte",
          isStaff: false,
        });

        await tx.insert(incidentHistory).values({
          incidentId: incident.id,
          action: "incidencia_importada",
          newValue: { categoryLabel: row.categoryLabel, requestType: requestTypeFor(row.categoryLabel), sourceName: payload.sourceName },
          notes: "Registro creado desde una importación revisada de WhatsApp.",
        });
        saved += 1;
      }
      return { duplicate: false as const, saved, importId: createdImport.id };
    });

    if (result.duplicate) return res.status(409).json({
      message: "Esta conversación ya fue importada. No se guardaron registros duplicados.",
      duplicate: true,
    });
    return res.status(201).json({ message: "Importación guardada correctamente.", saved: result.saved, importId: result.importId });
  } catch (error) {
    console.error("Error al confirmar importación:", error);
    return res.status(500).json({ message: "No se pudo guardar la importación." });
  }
});

export default r;
