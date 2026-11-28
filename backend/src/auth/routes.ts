import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { profiles } from "../db/schema.js";
import { asyncHandler, errors, ok } from "../lib/http.js";
import { permissions, rateLimit, requireAuth, audit } from "./middleware.js";
import { verifyPassword } from "./password.js";
import { createSession, destroySession } from "./session.js";

const r = Router();
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email(),
  password: z.string().min(1).max(200),
});

const loginLimiter = rateLimit("login", 10, 15 * 60 * 1000);

r.post("/login", loginLimiter, asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) throw errors.badRequest("Credenciales inválidas", parsed.error.flatten());

  const [profile] = await db.select().from(profiles)
    .where(eq(profiles.email, parsed.data.email.toLocaleLowerCase("es"))).limit(1);

  // Se ejecuta siempre una comparación para no revelar si el correo existe.
  const valid = await verifyPassword(parsed.data.password, profile?.passwordHash ?? null);
  if (!profile || !profile.active || !valid) {
    await audit(req, "login_failed", "auth");
    // El límite se aplica a fallos: si la petición ya excedió el presupuesto,
    // se devuelve 429 aunque las credenciales sean incorrectas.
    if (loginLimiter.isLimited(req)) {
      throw errors.tooMany("Demasiados intentos fallidos. Intenta nuevamente en unos minutos");
    }
    throw errors.unauthorized("Correo o contraseña incorrectos");
  }

  const { csrfToken, expiresAt } = await createSession(profile.id, res);
  // Un login correcto no debe consumir el presupuesto de intentos fallidos.
  loginLimiter.reset(req);
  await audit(req, "login_success", "auth", profile.id);
  return ok(res, {
    authenticated: true,
    user: { id: profile.id, fullName: profile.fullName, email: profile.email, role: profile.role },
    csrfToken,
    expiresAt: expiresAt.toISOString(),
    permissions: permissions[profile.role],
  });
}));

r.post("/logout", asyncHandler(async (req, res) => {
  await destroySession(req, res);
  await audit(req, "logout", "auth", req.user?.id);
  return ok(res, { loggedOut: true });
}));

r.get("/me", asyncHandler(async (req, res) => {
  if (!req.user) return ok(res, { authenticated: false, permissions: [] });
  return ok(res, {
    authenticated: true,
    user: req.user,
    permissions: permissions[req.user.role],
    csrfToken: req.sessionInfo?.csrfToken,
  });
}));

r.get("/permissions", requireAuth, (req, res) => {
  return ok(res, { role: req.user!.role, permissions: permissions[req.user!.role] });
});

export default r;
