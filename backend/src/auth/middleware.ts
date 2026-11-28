import type { NextFunction, Request, Response } from "express";
import { db } from "../db/client.js";
import { auditLogs } from "../db/schema.js";
import { env } from "../config/env.js";
import { errors } from "../lib/http.js";
import { sha256 } from "../lib/validation.js";
import type { Role } from "../db/schema.types.js";
import { getSession } from "./session.js";

export const permissions: Record<Role, string[]> = {
  admin: ["import", "incidents:write", "incidents:read", "teachers:write", "categories:write", "reports:read", "users:write", "config:write", "history:read"],
  tecnico: ["import", "incidents:write", "incidents:read", "reports:read", "history:read"],
  consulta: ["incidents:read", "reports:read"],
};

/** Defensa contra CSRF: SameSite=Strict en la cookie + verificación de Origin cuando está presente. */
export function originGuard(req: Request, _res: Response, next: NextFunction): void {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next(); // Clientes sin navegador; la cookie SameSite ya bloquea peticiones cross-site.
  const allowed = new Set([env.FRONTEND_ORIGIN, `${req.protocol}://${req.get("host")}`]);
  if (!allowed.has(origin)) return next(errors.forbidden("Origen de la solicitud no autorizado"));
  next();
}

/** Doble verificación para rutas autenticadas: token CSRF emitido por /api/auth/me. */
export function csrfGuard(req: Request, _res: Response, next: NextFunction): void {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  if (!req.sessionInfo) return next();
  const provided = req.header("x-csrf-token");
  if (!provided || provided !== req.sessionInfo.csrfToken) {
    return next(errors.forbidden("Falta el token CSRF válido"));
  }
  next();
}

export async function attachSession(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const context = await getSession(req);
    if (context) {
      req.user = context.user;
      req.sessionInfo = { tokenHash: context.tokenHash, csrfToken: context.csrfToken };
    }
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(errors.unauthorized());
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(errors.unauthorized());
    if (!roles.includes(req.user.role)) return next(errors.forbidden());
    next();
  };
}

export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(errors.unauthorized());
    if (!permissions[req.user.role].includes(permission)) return next(errors.forbidden());
    next();
  };
}

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export type RateLimiter = ((req: Request, res: Response, next: NextFunction) => void) & {
  /** Libera la cuenta tras un inicio de sesión correcto. */
  reset: (req: Request) => void;
  /** Indica si esta solicitud superó el presupuesto de intentos fallidos. */
  isLimited: (req: Request) => boolean;
};

function bucketKey(keyPrefix: string, req: Request): string {
  return `${keyPrefix}:${sha256(req.ip ?? "unknown")}`;
}

/**
 * Rate limiter en memoria (una instancia). Cuenta intentos de login y marca la
 * solicitud cuando se agota el presupuesto; el handler de login decide
 * devolver 429 sólo si la contraseña es incorrecta. Así un usuario válido
 * nunca queda bloqueado por sus propios aciertos, sin desactivar la defensa
 * contra fuerza bruta. Para despliegues multi-instancia, migrar a Redis/Neon.
 */
export function rateLimit(keyPrefix: string, max: number, windowMs: number): RateLimiter {
  const limitedRequests = new WeakSet<Request>();

  const middleware = ((req: Request, _res: Response, next: NextFunction): void => {
    const key = bucketKey(keyPrefix, req);
    const now = Date.now();
    const current = buckets.get(key);
    if (!current || current.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    current.count += 1;
    if (current.count > max) limitedRequests.add(req);
    next();
  }) as RateLimiter;

  middleware.reset = (req: Request): void => {
    buckets.delete(bucketKey(keyPrefix, req));
    limitedRequests.delete(req);
  };
  middleware.isLimited = (req: Request): boolean => limitedRequests.has(req);
  return middleware;
}

export async function audit(req: Request, action: string, entity: string, entityId?: string, details?: Record<string, unknown>): Promise<void> {
  await db.insert(auditLogs).values({
    actorId: req.user?.id ?? null,
    action,
    entity,
    entityId: entityId ?? null,
    details: details ?? null,
    ipHash: sha256(req.ip ?? "unknown"),
  });
}
