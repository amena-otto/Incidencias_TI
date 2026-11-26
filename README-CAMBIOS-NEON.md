# Esquema inicial Neon
Reemplaza `backend/src/db/schema.ts` y `backend/src/db/seed.ts`.
Incluye perfiles, docentes, alias, categorías, importaciones, incidencias, mensajes, respuestas e historial.
Desde `backend`: `npm run db:generate`, revisa el SQL de `drizzle/`, luego `npm run db:migrate` y `npm run db:seed`.
No uses db:push ni borres tablas. Los campos nuevos de incidencias tienen defaults o permiten null para mantener compatibilidad con las rutas actuales.
