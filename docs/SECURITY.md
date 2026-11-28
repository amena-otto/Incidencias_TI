# Seguridad

Este documento describe los controles implementados en la versión candidata y los riesgos que permanecen abiertos. La seguridad se aplica en el backend: la interfaz oculta opciones, pero **no** decide permisos.

## 1. Modelo de confianza

| Activo | Protección principal |
| --- | --- |
| Conversaciones importadas | Revisión humana obligatoria y persistencia transaccional |
| Cuentas y contraseñas | Hash bcrypt, sin credenciales por defecto |
| Sesiones | Token opaco, hash SHA-256 en base, cookie HttpOnly |
| Operaciones de escritura | CSRF + Origin guard + RBAC |
| Archivos cargados | Límite de tamaño, extensión/MIME permitidos, almacenamiento en memoria |
| Reportes | Descarga autenticada y auditada |
| Secretos | Variables de entorno y logger con redacción |
| Base de datos | Drizzle con consultas parametrizadas; sin DDL destructivo en el repo |

Se asume que la red entre navegador y servidor es de confianza sólo cuando usa HTTPS. En desarrollo se permite HTTP para `localhost`.

## 2. Autenticación y sesiones

- `POST /api/auth/login` valida correo y contraseña con Zod y bcrypt.
- La comparación de hash se ejecuta siempre, incluso si el correo no existe, para evitar enumeración de cuentas por tiempo de respuesta.
- El token de sesión se genera con `crypto.randomBytes(32)` en `base64url`.
- En PostgreSQL se guarda `sha256(token)`, **nunca el token en claro**.
- La cookie `smartdesk_session` usa `HttpOnly`, `SameSite=Strict`, `path=/api`, `maxAge` configurable y `Secure` cuando `NODE_ENV=production`.
- `getSession()` exige que la sesión no haya expirado y que el perfil siga activo.
- `logout` elimina la fila de sesión y expira la cookie.

No se usan JWT, tokens permanentes ni credenciales compartidas.

## 3. CSRF y Origin guard

`backend/src/auth/middleware.ts` aplica dos capas a `POST`, `PUT`, `PATCH` y `DELETE`:

1. **Origin guard:** si el navegador envía `Origin`, debe coincidir con `FRONTEND_ORIGIN` o con el esquema/host de la propia petición.
2. **CSRF guard:** si existe sesión, la cabecera `X-CSRF-Token` debe coincidir exactamente con el token opaco devuelto por `/api/auth/me` y almacenado en la sesión.

La cookie `SameSite=Strict` bloquea además el envío automático desde contextos cross-site. El frontend obtiene el token al iniciar sesión y lo adjunta en cada mutación.

El login no exige CSRF porque todavía no hay sesión, pero sí pasa por Origin guard y rate limiting.

## 4. RBAC

| Rol | Permisos |
| --- | --- |
| `admin` | importar, leer/escribir incidencias, docentes, categorías, reportes, usuarios, configuración e historial |
| `tecnico` | importar, leer/escribir incidencias, reportes e historial |
| `consulta` | leer incidencias y reportes |

Cada ruta sensible usa `requirePermission(...)` en el backend. La interfaz filtra el menú con la misma lista, pero un cambio en el DOM no otorga permisos.

## 5. Validación y manejo de errores

- Zod valida cuerpo, query, UUID, fechas, rangos, longitud y roles.
- Las fechas imposibles se rechazan; el parser de WhatsApp las cuenta y omite, sin convertirlas en otra fecha.
- `toHour24()` acepta 0–23 en reloj de 24 horas y normaliza `a. m.`, `a.m.`, `am` y `pm` con rango 1–12.
- Las horas de Lima se convierten a UTC con offset fijo `-05:00`.
- `sanitizeFilename()` elimina separadores y caracteres de control; si sólo hay separadores devuelve `reporte`.
- El manejador global devuelve estructuras `{ ok: false, error }` uniformes y **no expone stack traces**.
- En producción, `INTERNAL_ERROR` muestra un mensaje genérico.

## 6. Archivos y previsualizaciones

- Multer usa `memoryStorage()` con límite de `MAX_UPLOAD_MB` (por defecto 5 MB).
- Importación de chat: extensión `.txt`/`.text` y MIME `text/plain`, `application/octet-stream` o `text/x-log`.
- Docentes: extensión `.xlsx` y MIME de workbook u `application/octet-stream`.
- Los resultados de preview se guardan en memoria con token opaco y caducidad; nunca se envían como datos de confianza al commit.
- `/api/imports/commit` e `/api/incidents/bulk` reconstruyen cada registro desde el preview por `candidateId`.
- Categorías y docentes propuestos por el cliente se validan contra catálogos activos en el servidor.
- Mensaje, fecha, remitente, confianza y huella no pueden ser modificados por el cliente en el commit.
- La deduplicación usa huellas estables por posición/fecha/hora/remitente/texto/clave de conversación y hash de contenido por importación.

## 7. Base de datos y auditoría

- Drizzle genera consultas parametrizadas; no se concatenan valores del usuario en SQL.
- Las escrituras de importación ocurren en una transacción: incidencia, mensajes, respuestas, historial y contadores.
- `auditLogs` registra login exitoso/fallido, logout, preview y commit de importaciones, altas/cambios de usuarios, categorías, docentes, incidencias, respuestas, configuración y descarga de reportes.
- La IP se guarda como `sha256(ip)`, no en claro.
- Las migraciones versionadas no contienen `DROP TABLE`, `TRUNCATE` ni `DELETE FROM`.
- No se ejecutó `db:push` ni ninguna migración en Neon desde este repositorio.

## 8. Registro y secretos

- `backend/src/lib/logger.ts` redacta claves que coinciden con `password|secret|token|authorization|cookie|database_url|connectionstring|api[_-]?key`.
- `config/env.ts` valida variables al arrancar y, si hay error, imprime nombres de campos, nunca valores.
- `.env`, `.env.*` y `dist` están ignorados por Git; `!.env.example` permite versionar sólo plantillas sin secretos.
- Los ejemplos no contienen contraseñas reales ni cadenas Neon válidas.
- Las pruebas usan datos sintéticos: “Docente Prueba”, “Personal TI” y “Ana Pérez”.

## 9. Rate limiting

- Login: 10 intentos fallidos por IP cada 15 minutos.
- El limitador usa buckets en memoria con la IP hasheada.
- Un inicio de sesión correcto llama a `reset()` y libera el contador: los aciertos nunca generan `429`.
- Al agotar el presupuesto, el middleware marca la solicitud; el handler devuelve `429 RATE_LIMITED` sólo si la contraseña es incorrecta. Así se mantiene la defensa contra fuerza bruta sin bloquear al usuario legítimo.
- Devuelve `429 RATE_LIMITED` con el envelope estándar.

`TRUST_PROXY` controla cuántos proxies de confianza tiene Express (0 en local, 1 detrás de un único reverse proxy TLS). Con `TRUST_PROXY=1`, `req.ip` usa `X-Forwarded-For` del proxy y `req.protocol` usa `X-Forwarded-Proto`.

**Residuo:** en despliegues con varias réplicas, cada proceso tiene su propio contador. Para producción multi-instancia se requiere un store compartido y un proxy que normalice la IP del cliente. No actives `TRUST_PROXY` si el cliente puede falsificar esas cabeceras.

## 10. Dependencias y CI

- Backend: Helmet, CORS restringido, Zod 4, Drizzle 0.45, Multer 1.4 LTS y bcryptjs.
- Frontend: React 18, Vite 8, Vitest 5 y jsdom 31.
- Overrides: `uuid@^11.1.1` y `esbuild@^0.25.12`.
- `npm audit --audit-level=high` pasa con 0 vulnerabilidades en backend y frontend.
- `.github/workflows/ci.yml` ejecuta `npm ci`, `typecheck`, `test`, `build` y `audit` en cada paquete con Node 20.

## 11. Riesgos abiertos y decisiones pendientes

| Riesgo / limitación | Estado | Recomendación |
| --- | --- | --- |
| Migraciones y administrador no aplicados en Neon | Bloqueante para lanzamiento | Aplicar con autorización y backup verificado |
| UAT/validación en sala pendiente | Bloqueante para lanzamiento | Ejecutar guion con datos sintéticos y firmar aceptación |
| Google Drive deshabilitado | Decisión deliberada | Mantener `503` hasta implementar OAuth completo y autorizarlo |
| CSP desactivada en Helmet | Aceptado temporalmente | Definir CSP estricta acorde al build antes de exponer a Internet |
| Preview y rate limit en memoria | Aceptado para una instancia | Usar store compartido o afinidad de sesión si escala |
| Filas de sesión expiradas no se depuran automáticamente | Residuo menor | Programar limpieza periódica autorizada |
| Sin pruebas E2E de navegador | Residuo conocido | Añadir Playwright/Cypress en una fase posterior |
| No se verificó el comportamiento de un proxy TLS real | Pendiente de despliegue | Validar HTTPS, `Secure` y `FRONTEND_ORIGIN` en el entorno destino |

## 12. Líneas base antes de exponer el sistema

1. HTTPS obligatorio y `NODE_ENV=production`.
2. `DATABASE_URL` secreta, con SSL y permisos mínimos.
3. `FRONTEND_ORIGIN` exacto y `VITE_API_URL` coherente.
4. Migraciones aplicadas y seed verificado.
5. Administrador creado con credenciales inyectadas, nunca versionadas.
6. `/api/health` en verde.
7. Usuarios nominativos y roles revisados.
8. Backups de Neon verificados.
9. Logging central con redacción intacta.
10. UAT firmada antes de declarar lanzamiento final.
