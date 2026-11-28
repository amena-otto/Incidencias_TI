# Estado de lanzamiento · 20 puntos

Este es el seguimiento previo al informe final. **No es aún el informe final de lanzamiento**: los puntos bloqueantes siguen abiertos.

**Leyenda:** ✅ verificado localmente · ⚠️ implementado, pendiente de validación en entorno destino · ⛔ bloqueante para lanzamiento.

| # | Punto | Estado | Evidencia / pendiente |
| ---: | --- | --- | --- |
| 1 | Rama de trabajo correcta y base actualizada | ✅ | `feat/smartdesk-final-release` desde `4d60d3b` (`Merge PR #3`). Sin push, PR ni merge a `main`. |
| 2 | Stack solicitado respetado | ✅ | React 18 + TS + Vite 8 + CSS + Lucide; Node 20+ + Express + TS + Zod + Multer + Helmet + CORS; Neon + Drizzle; ExcelJS. |
| 3 | Backend reorganizado por módulos | ✅ | `config`, `lib`, `auth`, `classifier`, `importer`, `services`, `routes`, `teachers`, `tests`. |
| 4 | Frontend refactorizado por módulos | ✅ | `auth`, `components`, `lib`, `pages`, `tests`; vistas con lazy loading; eliminadas categorías hardcodeadas y vista JSON. |
| 5 | Salud, errores y validación central | ✅ | `/api/health` ejecutado contra Neon: `ok: true`, PostgreSQL conectado con latencia real, `America/Lima`. Envelope uniforme y Zod en body/query/UUID/fechas. |
| 6 | Autenticación, sesiones, CSRF y RBAC | ✅ | Token opaco, SHA-256 en DB, HttpOnly/SameSite/Secure, Origin guard, CSRF, rate limit y auditoría implementados. Administrador creado por el operador. Login/cookie/`/me`/RBAC/logout verificados en Neon con perfil sintético: 19/19. Causa raíz del login corregida y cubierta por prueba unitaria. |
| 7 | Parser V3 de WhatsApp y regresiones | ✅ | Android/iOS/escritorio, BOM, AM/PM, 24 h, multilínea, system/deleted/multimedia, fechas inválidas; 7 pruebas. |
| 8 | Clasificador V3 y catálogo canónico | ✅ | 13 categorías confirmadas en Neon (solo lectura), reglas heurísticas, explicación, ambigüedad y sin IA de pago; 7 pruebas. El perfil TI adicional tiene 9 pruebas y no elimina categorías. |
| 9 | Docentes, alias, Excel y matching | ✅ | Plantilla/validación/exportación, coincidencias exactas y alias automáticos, aproximadas sólo sugeridas; 9 pruebas. Catálogo con búsqueda, paginación 5/10/20, previsualización Excel con selección y confirmación. |
| 10 | Importación segura en dos fases | ⚠️ | Perfil exclusivo TI: exclusiones y motivos en memoria, casos mixtos a revisión, `ack`/atención no resolución, una sola columna Docente, excluidos no seleccionables, paginación/selección persistentes y confirmación inline. Preview con token opaco; commit valida categorías/docentes, guarda `requestType`/`categoryId` y reconstruye datos en servidor. Falta ejecutar flujo completo con datos sintéticos en Neon. |
| 11 | Gestión de incidencias | ⚠️ | Listado con paginación 5/10/20, filtros, tabla compacta, detalle en drawer, transiciones, solución obligatoria, responsable, respuestas e historial implementados. Falta UAT. |
| 12 | Panel de indicadores | ⚠️ | Cálculos y series implementados con Recharts y fórmulas documentadas. Sin datos institucionales cargados. |
| 13 | Reporte Excel de cuatro hojas | ⚠️ | `Dashboard`, `Incidencias`, `Resumen`, `Importaciones` generados con ExcelJS y auditados. Falta abrir/validar el XLSX en sala. |
| 14 | Google Drive sin simulación | ✅ | `/api/drive/status` reporta `enabled: false`; `/api/drive/upload` responde 503. Descarga local siempre disponible. |
| 15 | Plantillas de entorno | ✅ | `backend/.env` existente y no sobrescrito; `DATABASE_URL` configurada con valor oculto; plantillas `.env.example` sin secretos. |
| 16 | Documentación extensa | ✅ | README, instalación, guía de uso, API, seguridad, despliegue, informe de pruebas, guía de demo de 5 minutos, roadmap y este estado, actualizados con el perfil TI, paginación, selección, drawers y resultados finales. |
| 17 | CI GitHub Actions | ⚠️ | `.github/workflows/ci.yml` con typecheck/test/build/audit para ambos paquetes. No ejecutado en GitHub porque no hubo push. |
| 18 | Pruebas automáticas y auditoría | ✅ | Backend 50/50 (9 suites), frontend 20/20 (4 archivos), integración de autenticación 19/19 previa, typecheck y builds finales correctos, `npm audit` con 0 vulnerabilidades en verificación previa. |
| 19 | Migraciones SQL aplicadas | ✅ | `0000`, `0001` y `0002` aplicadas en Neon tras autorización; 13 tablas, 15 columnas nuevas y 7 índices verificados por consulta de solo lectura. |
| 20 | Lanzamiento real y reporte final | ⛔ | Faltan: UAT en sala, decisión formal sobre Drive/OAuth y autorización para push/PR/merge/despliegue. `/api/health`, administrador y autenticación end-to-end ya están verificados; esta corrección no aplicó migraciones ni hizo escrituras nuevas en Neon. |

## Diagnóstico real de Neon

Diagnóstico inicial del 2026-11-26: conexión correcta (`connected: true`, PostgreSQL 18.7), sólo `0000` aplicada, 13 categorías canónicas y 0 filas operativas. Con autorización del responsable se aplicaron `0001` y `0002` y se ejecutó el seed. Verificación posterior: 13 tablas, `app_settings` con 3 filas, 15 columnas nuevas y 7 índices presentes; 0 incidencias y docentes. El operador creó después 1 administrador. La integración de autenticación usó un perfil `consulta` sintético y lo eliminó al final; no se eliminaron datos institucionales ni se modificó la contraseña del administrador. El detalle está en [TEST-REPORT.md](TEST-REPORT.md#6-diagnóstico-real-de-neon-solo-lectura).

## Condiciones para emitir el informe final

El informe final de 20 puntos sólo se emitirá cuando:

1. los puntos 11–13 se validen con datos sintéticos en sala;
2. el punto 17 se ejecute en GitHub Actions tras autorización de push;
3. los puntos 6 y 19 ya aplicados se consideren verificados en la base autorizada;
4. se valide en UAT la cuenta del administrador creada por el operador, sin valores públicos;
5. el punto 20 quede sin bloqueantes.

Hasta entonces, TI SmartDesk es **versión candidata verificada localmente**, no lanzamiento final.
