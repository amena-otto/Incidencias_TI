# Informe de pruebas

**Fecha:** 2026-11-28

**Rama:** `feat/smartdesk-final-release` (HEAD `26cd26c`, árbol de trabajo sin commitear)

**Sistema:** Windows (win32), Node v24.20.0, npm 12.2.0

**CI prevista:** Node 20 en GitHub Actions

**Estado global:** verificación final en verde con el clasificador V4 integrado: backend 61/61, frontend 27/27, evaluación sintética 28/28, typecheck y builds correctos; integración real de autenticación 19/19 previamente ejecutada y aún vigente porque no cambió el módulo de autenticación. La migración `0003` está generada pero **no aplicada**, por lo que V4 usa el diccionario semilla en memoria y no se hicieron escrituras nuevas en Neon. **No apto para declarar lanzamiento final** hasta completar UAT, la decisión sobre Drive/OAuth y la autorización de push/PR/despliegue.

## 1. Resumen ejecutivo

| Ámbito | Resultado |
| --- | --- |
| Backend typecheck | ✅ `tsc --noEmit` sin errores |
| Backend unitarias | ✅ 61/61 pruebas en 10 suites, incluidas 9 del clasificador V4, 0 fallos |
| Backend evaluación V4 | ✅ 28 casos enero–diciembre: F1=1 en clasificación y asociación; fidelidad=1 |
| Backend build | ✅ `tsc -p tsconfig.json` correcto |
| Backend audit | ✅ `found 0 vulnerabilities` (verificación previa; sin dependencias nuevas) |
| Frontend typecheck | ✅ `tsc --noEmit` sin errores |
| Frontend unitarias | ✅ 27/27 pruebas, 6 archivos, incluidas 4 de `ClasificadorPage` |
| Frontend build | ✅ Vite 8.4.0, sin aviso de chunk grande; `ClasificadorPage` en chunk propio |
| Frontend audit | ✅ `found 0 vulnerabilities` (verificación previa; sin dependencias nuevas) |
| Integración de autenticación con Neon | ✅ 19/19 comprobaciones previas: login, cookie, `/me`, RBAC y logout; no se repitió para evitar nuevas escrituras en Neon |
| Favicon institucional | ✅ `/favicon.svg` y `/favicon.ico` responden HTTP 200 en Vite |
| Migraciones SQL | ✅ `0000`–`0003` generadas y revisadas; sin `DROP`, `TRUNCATE` ni `DELETE FROM`; `0003` NO aplicada |
| CI GitHub Actions | 📄 workflow creado; no ejecutado porque no hubo push |
| Integración real con Neon | ✅ `0000`, `0001` y `0002` aplicadas; seed ejecutado y verificado en Neon |
| `/api/health` en Neon | ✅ `ok: true`, `database.connected: true`, latencia real, `America/Lima` |
| Arranque backend y frontend | ✅ API y Vite respondieron correctamente |
| Diagnóstico de datos en Neon | ✅ 13 categorías y 3 ajustes tras el seed; 0 filas operativas |
| UAT / validación en sala | ⛔ pendiente |
| Google Drive OAuth | ⛔ deshabilitado deliberadamente |

## 2. Comandos ejecutados

### Backend

```bash
cd backend
npm run typecheck
npm test
npm run eval:v4
npm run build
npm audit --audit-level=moderate

# Integración aislada; usa el puerto 3101 para no interferir con `npm run dev`
npm run test:integration
```

Salida relevante:

```text
> tsc --noEmit

▶ Clasificador V3                     7 pruebas  ✔
▶ Importador de WhatsApp              7 pruebas  ✔
▶ Correlación de contexto             5 pruebas  ✔
▶ Perfil de importación Incidencias TI 9 pruebas  ✔
▶ Coincidencia de docentes            5 pruebas  ✔
▶ Excel de docentes                   4 pruebas  ✔
▶ Validación central                 7 pruebas  ✔
▶ Paginación compartida              3 pruebas  ✔
▶ Contraseñas                        3 pruebas  ✔
▶ Clasificador V4                    9 pruebas  ✔

ℹ tests 61
ℹ pass 61
ℹ fail 0

> tsx scripts/eval-v4.ts
Evaluación V4 (28 casos)
Clasificación V4: P=1 R=1 F1=1
Clasificación V3: P=1 R=0.1429 F1=0.25
Asociación V4: 1 · Asociación V3: 0.8
Fidelidad de contextualización: 1

> tsc -p tsconfig.json
```

La suite de correlación incluye un caso deliberado de reportes concurrentes con espera de 4.4 s. `npm run eval:v4` regenera `backend/reports/v4-eval.json`; el dataset es sintético, tiene 28 casos con al menos dos por mes y está separado del seed y de los ejemplos de noviembre de 2026.

`npm run test:integration` levantó `dist/server.js` en el puerto aislado 3101 contra Neon y devolvió **19/19 comprobaciones en verde**: 10 fallos → `401`, undécimo fallo → `429`, login correcto → `200` con `authenticated: true`, cookie `smartdesk_session` con `HttpOnly`, `SameSite=Strict` y `Path=/api` (sin `Secure` en desarrollo), `GET /api/auth/me` autenticado, acceso a `/api/incidents` con cookie y `401` sin ella, persistencia de sesión, logout con CSRF y borrado de la sesión. El perfil sintético `consulta` creado para la prueba se eliminó al final; no se tocó la cuenta del administrador. Tras el refactor de importación, tablas y paginación no se modificaron las rutas de autenticación, por lo que no se repitió la integración: hacerla implicaría crear y borrar otro perfil sintético en Neon.

### Frontend

```bash
cd frontend
npm run typecheck
npm test
npm run build
npm audit --audit-level=moderate
```

Salida relevante:

```text
> tsc --noEmit

 RUN  v5.1.2
 Test Files  6 passed (6)
      Tests  27 passed (27)

> tsc --noEmit && vite build
✓ 1959 modules transformed.

dist/index.html                              0.51 kB │ gzip:   0.31 kB
dist/assets/index-BjbzZe8s.css              14.00 kB │ gzip:   3.85 kB
dist/assets/ConfiguracionPage-Bz5Vsvn5.js    4.11 kB │ gzip:   1.69 kB
dist/assets/CategoriasPage-BlVi4DQi.js       4.81 kB │ gzip:   1.81 kB
dist/assets/UsuariosPage-HEiEcSW5.js         6.04 kB │ gzip:   2.18 kB
dist/assets/ReportesPage-CKwSliHb.js         6.20 kB │ gzip:   2.29 kB
dist/assets/ClasificadorPage-B4rk6zgM.js     8.96 kB │ gzip:   2.88 kB
dist/assets/DocentesPage-DPmvup0N.js        11.00 kB │ gzip:   3.52 kB
dist/assets/IncidenciasPage-CPG0L2z2.js     11.19 kB │ gzip:   3.55 kB
```

Antes de la división de chunks, el bundle principal era de **625.06 kB** y Vite emitía una advertencia de tamaño. Las vistas ahora se cargan con `React.lazy()` y `Suspense`; la nueva vista administrativa del clasificador se genera como chunk independiente y la advertencia de tamaño no aparece.

## 3. Cobertura por suite

### Backend (61 pruebas)

| Suite | Pruebas | Aspectos verificados |
| --- | ---: | --- |
| Clasificador V3 | 7 | 13 categorías canónicas, exclusión de respuestas/comunicados/multimedia, ambigüedad, reglas coloquiales, explicación y conservación del mensaje |
| Importador de WhatsApp | 7 | Android 2 dígitos y multilínea, iOS 4 dígitos con AM/PM y Unicode, escritorio con BOM,_system/deleted/multimedia, fechas inválidas e identificadores estables |
| Correlación de contexto | 5 | seguimiento y solución de TI, redacción de marcación, incertidumbre por reportes concurrentes, ausencia de invención, ventana temporal |
| Perfil de importación Incidencias TI | 9 | exclusiones no TI sin borrar categorías, reglas concretas antes que genéricas, audiovisuales con «apoyo en aula», plataforma sobre marcación, apoyo sin detalle, `ack` con contexto, «ok» aislado, casos mixtos y remitente original |
| Coincidencia de docentes | 5 | nombre exacto, alias, ambigüedad sin enlace automático, sugerencias aproximadas, conservación del nombre original |
| Excel de docentes | 4 | plantilla, validación de nombres/correos/duplicados, encabezados alternativos, exportación sin correos inventados |
| Validación central | 7 | fechas reales, reloj 24 h, conversión Lima→UTC, caracteres de control, UUID/rangos, paginación y nombres de archivo |
| Paginación compartida | 3 | tamaños 5/10/20, totales y página actual, cambio de página sin perder registros |
| Contraseñas | 3 | verificación bcrypt, sal aleatoria, rechazo de contraseñas cortas y hash ausente |
| Clasificador V4 | 9 | detección ponderada y ambigüedad, normalización peruana, perfil `TI_INSTITUCIONAL`, correlación con evidencia, contextualización fiel, adaptador a `Candidate[]`, versionado y feedback |

### Frontend (27 pruebas)

| Archivo | Pruebas | Aspectos verificados |
| --- | ---: | --- |
| `src/lib/api.test.ts` | 6 | URL relativa, descargas con sesión, `credentials: include`, `Content-Type`, CSRF, `FormData`, envelope de errores, limpieza de CSRF en 401 y errores de red |
| `src/auth/AuthContext.test.tsx` | 1 | regresión del login: se marca `authenticated: true` y se guarda el CSRF aunque la respuesta herede un `authenticated` ausente |
| `src/components/table.test.tsx` | 5 | paginación 5/10/20 con totales, navegación conservando selección, selección de filtrados, reinicio de página al filtrar y cabecera indeterminada |
| `src/pages/ImportWizardPage.test.tsx` | 8 | total real, commit con token opaco/`candidateId`, categorías del servidor, una sola columna Docente, paginación y selección persistentes, excluidos con motivo y detalle, mensaje original sin «resuelto» automático |
| `src/pages/ClasificadorPage.test.tsx` | 4 | versión y migración pendiente, cambio a V3, generación/resolución de sugerencias sin activar reglas, registro de sinónimos, auditoría de correcciones y bloqueo sin `config:write` |

## 4. Defectos corregidos y cubiertos

| Defecto | Corrección | Evidencia |
| --- | --- | --- |
| `toHour24()` rechazaba hora `0` y variantes `a. m.` | Acepta 0–23 y normaliza `a.m.`/`am`/`pm` con rango 12 h | Suite Importador y Validación |
| Regla de electricidad no reconocía “no hay corriente en el tomacorriente” | Regla V3 ampliada sin usar IA | Suite Clasificador |
| `sanitizeFilename()` devolvía cadena vacía con sólo separadores | Devuelve `reporte` | Suite Validación |
| Frontend fijaba `localhost` | `VITE_API_URL` relativo por defecto y proxy configurable | `api.test.ts` |
| `preview.totalMessages` no se mostraba ni usaba | Se muestra en resumen y se reporta desde el backend | `ImportWizardPage.test.tsx` |
| Commit no enviaba token/candidateId | Contrato corregido con token opaco y filas seleccionadas | `ImportWizardPage.test.tsx` |
| Incidencias importadas no parecían gestionables | Listado P0 con filtros, detalle, estados, responsable y respuestas | Implementación revisada; requiere UAT |
| Categorías hardcodeadas en frontend | Catálogo persistido y servido por `/api/categories` | `ImportWizardPage.test.tsx` |
| Vista JSON y bundle único | Vistas por módulo y lazy loading | Build con chunks separados |
| Advertencia de chunk >500 kB | Lazy loading de páginas | Build sin advertencia |
| `API.md` indicaba que `/api/auth/logout` exigía sesión y CSRF | El endpoint es idempotente y público; se corrigió la documentación | Llamada sin sesión → HTTP 200 con `loggedOut: true` |
| `POST /api/auth/login` devolvía 200 pero sin `authenticated: true`; el frontend nunca abandonaba la pantalla de login | El backend incluye `authenticated: true` y el `AuthContext` normaliza la respuesta y fuerza el estado tras `login()` | `AuthContext.test.tsx`; integración real: `authenticated=true` |
| El rate limiter contaba los logins correctos y bloqueaba al usuario tras 10 aciertos | Sólo cuentan los fallos; `reset()` libera el bucket tras un acierto y, si ya se agotó el presupuesto, el `429` se aplica únicamente a contraseñas incorrectas | Integración: 10 fallos → 401, undécimo → 429, login correcto posterior → 200 |
| Envíos duplicados del formulario de login | Guard `useRef` en `LoginPage` | Revisión de código; una sola petición por envío |
| `404` de `favicon.ico` en DevTools | `favicon.svg` y `favicon.ico` institucionales enlazados desde `index.html` | `/favicon.ico` y `/favicon.svg` → HTTP 200 en Vite |
| Solicitudes no TI y casos mixtos entraban al flujo de importación | Módulo `ti-scope.ts` filtra por pertinencia; exclusiones y motivos se devuelven en memoria; casos mixtos van a revisión sin reescribir el mensaje | Suite `import-scope.test.ts`; 9 pruebas |
| «Me acerco» podía interpretarse como solución | Rol `ack` y `tiAttendance`; la sugerencia de resuelto exige confirmación explícita de personal TI | Suite `import-scope.test.ts` y detalle del asistente |
| Solicitante y Docente competían como columnas editables | Una sola columna «Docente» del catálogo; remitente original queda en el detalle para trazabilidad y deduplicación | `ImportWizardPage.test.tsx` |
| Paginación fija y selección frágil | Tamaños 5/10/20 con default 10, hooks locales/remotos, cabecera indeterminada, selección de filtrados y conservación de ediciones | `pagination.test.ts`, `table.test.tsx`, `ImportWizardPage.test.tsx` |
| Tablas anchas con scroll horizontal en laptop | `data-table`, texto truncado, acciones visibles y detalle en drawer; scroll confinado a `<=980px` | Build CSS y revisión de estilos |
| V4 no reconocía `interneet` | Se agregó la variante junto a `intermet`/`interneeet` en `normalize.ts` | Suite Clasificador V4 y `eval:v4` |
| La contextualización no incluía el reporte en `evidence` | `evidenceOf()` ahora incluye primero el mensaje reportado y luego los vinculados | Suite Clasificador V4 |
| `ambiguous` era siempre `true` | El cálculo comparaba el ganador consigo mismo con `slice(0, 2)`; ahora compara sólo alternativas con `slice(1, 3)` | Suite Clasificador V4 y `eval:v4` |

## 5. Seguridad verificada localmente

- `npm audit --audit-level=moderate`: 0 vulnerabilidades en ambos paquetes.
- Overrides `uuid@^11.1.1` y `esbuild@^0.25.12` presentes en `backend/package.json`.
- Logged redaction implementada; las pruebas no exponen secretos.
- Las migraciones no contienen sentencias destructivas (búsqueda literal de `DROP`, `TRUNCATE` y `DELETE FROM` sin resultados).
- Los fixtures usan únicamente nombres sintéticos: “Docente Prueba”, “Personal TI” y “Ana Pérez”.
- `.env`, `.env.*` y `dist` están ignorados; sólo se versionan plantillas `.env.example`.

## 6. Diagnóstico real de Neon (solo lectura)

Diagnóstico inicial ejecutado antes de cualquier escritura; tras la autorización del responsable se aplicaron migraciones y seed y se verificó el resultado. No se mostraron credenciales, no se sobrescribió `backend/.env` y no se eliminaron datos.

| Comprobación | Resultado |
| --- | --- |
| `backend/.env` | Existe. Claves declaradas: `DATABASE_URL`, `PORT`, `FRONTEND_ORIGIN`. No se sobreescribió. |
| `DATABASE_URL` | Configurada; valor mantenido oculto en pantalla e informe. |
| Conexión | `connected: true`, PostgreSQL `18.7 (3190d2f)`, SSL inferido por el dominio `neon.tech`. |
| Tabla de migraciones | `drizzle.__drizzle_migrations`, columnas `id`, `hash`, `created_at`. Una fila: `id=1`, hash `5807dffaa36d…`, `created_at=1795653136488`. |
| Migración aplicada inicialmente | `0000_heavy_thundra.sql` (`when=1795653136488`); hash LF canónico `5807dffaa36d`. |
| Migraciones aplicadas tras autorización | `0001_loving_ravenous.sql` (`when=1795709341324`) y `0002_unknown_luke_cage.sql` (`when=1795709627778`); registros `id=2` e `id=3` en `drizzle.__drizzle_migrations`. Los hashes guardados corresponden al contenido CRLF del checkout de Windows (`3767a1ecabb1` y `036735544e2a`), sin impacto funcional. |
| Esquema actual | 13 tablas en `public`: las 9 originales más `audit_logs`, `user_sessions`, `app_settings` y `staff_directory`. |
| Datos | `categories`: 13 filas; `app_settings`: 3 filas; `incidents`, `staff_directory`, mensajes e importaciones: 0 filas. El operador creó posteriormente 1 perfil `admin` activo (credenciales nunca mostradas ni modificadas) y las pruebas manuales dejaron 10 sesiones. La prueba de integración usó un perfil `consulta` sintético que se eliminó al final. |
| Objetos creados por `0001`/`0002` | Verificadas las 15 columnas nuevas y los 7 índices, incluido `incidents_message_hash_uq`. `profiles.password_hash` ya existe; aún no hay usuarios. |
| Datos conservados | Las 13 categorías canónicas se conservaron; el seed sólo actualizó/insertó categorías y 3 ajustes. No se eliminó ni sobrescribió dato operativo. |
| Migración `0003_material_swordsman.sql` | Generada y revisada: 4 tablas nuevas (`classifier_concepts`, `classifier_feedback`, `classifier_rule_versions`, `classifier_suggestions`), 6 FKs y 5 índices. **NO aplicada**; no hubo escrituras nuevas en Neon durante esta fase. |

Nota sobre hashes: el árbol de trabajo en Windows tiene saltos CRLF, por lo que `Get-FileHash` muestra prefijos distintos (`3EC3…`, `3767…`, `0367…`). El contenido versionado en LF produce los prefijos `5807…`, `4721…` y `0e3b…`. `git diff 275e149..HEAD -- backend/drizzle/0000_heavy_thundra.sql` no muestra cambios de contenido. Drizzle decide qué migrations ejecutar comparando `created_at`, no el hash, por lo que `0000` no se volverá a aplicar y sólo quedan pendientes `0001` y `0002`.

### Cambios introducidos por `0001` y `0002` (verificados)

| Migración | Tablas nuevas | Columnas nuevas | Índices / restricciones nuevas |
| --- | --- | --- | --- |
| `0001_loving_ravenous.sql` | `audit_logs`, `user_sessions`, `app_settings`, `staff_directory` | `incident_messages.position`; `incident_responses.association_confidence` (por defecto `'media'`) e `is_uncertain` (por defecto `false`); `incidents.message_hash`, `normalized_message`, `conversation_key`, `confidence_level`, `confidence_explanation`, `suggested_status`, `solution`, `teacher_match`, `message_position`; `profiles.password_hash` | FK `audit_logs.actor_id → profiles.id` (`ON DELETE set null`); FK `user_sessions.profile_id → profiles.id` (`ON DELETE cascade`); índices `audit_logs_created_idx`, `audit_logs_actor_idx`, `user_sessions_profile_idx`, `incidents_normalized_message_idx`, `incidents_requester_idx`, `incidents_assigned_idx`; índice único `incidents_message_hash_uq` |
| `0002_unknown_luke_cage.sql` | — | `chat_imports.duplicates_omitted` y `chat_imports.rejected_count` (`integer DEFAULT 0 NOT NULL`) | — |

Compatibilidad revisada: todas las columnas nuevas son anulables o tienen valor por defecto; las tablas nuevas no existen actualmente; las claves foráneas apuntan a `profiles.id`, que ya existe. No hay `DROP TABLE`, `TRUNCATE`, `DELETE FROM`, `RENAME` ni alteraciones destructivas. El índice único sobre `message_hash` es seguro con 0 filas en `incidents`.

**Autorización ejecutada:** `npm run db:migrate` y `npm run db:seed` se ejecutaron en la base autorizada y se verificó el esquema resultante. El administrador fue creado por el operador; no se cambió su contraseña ni se recreó la cuenta.

## 7. Pruebas no ejecutadas y por qué

| Prueba | Motivo | Requerido para lanzamiento |
| --- | --- | --- |
| `GET /api/health` contra Neon | ✅ ejecutado: `ok: true`, PostgreSQL conectado, latencia real | Completado |
| Arranque de backend y frontend | ✅ `node dist/server.js` y Vite dev respondieron correctamente | Completado |
| `npm run db:migrate` y `db:seed` | ✅ `0000`–`0002` ejecutados en la base autorizada; esquema y datos verificados | Completado |
| `0003_material_swordsman.sql` | ⛔ generada y revisada, pero no aplicada: V4 usa el diccionario semilla en memoria | Requiere autorización explícita |
| `npm run create:admin` | ✅ ejecutado por el operador; credenciales inyectadas sin exponerlas en este informe | Completado |
| Login y RBAC end-to-end | ✅ ejecutado con perfil `consulta` sintético en Neon: 19/19 comprobaciones | Completado |
| Login con la cuenta real del administrador | El operador ya validó el flujo desde el navegador; no se reintentó aquí para no consumir intentos ni revelar credenciales | UAT en sala |
| Preview → commit → listado → Excel con datos reales | Depende de Neon y de autorización de datos | Sí |
| Descarga Excel abierta en Excel/LibreOffice | No se ejecutó validación visual en sala | Sí |
| OAuth/Drive | Integración deshabilitada en esta versión | Sólo si se decide habilitar |
| CI en GitHub Actions | No se hizo push del workflow | Recomendado antes de merge |
| E2E con navegador real (Playwright/Cypress) | No implementado en esta fase | Recomendado, no bloqueante para candidato |
| UAT con personal institucional | Sin acceso a sala/validadores | Sí |

## 8. Alcance de la corrección final de importación

- Backend: `backend/src/classifier/ti-scope.ts`, prioridad de reglas concretas, rol `ack`, `tiAttendance`, exclusiones y motivos en memoria, persistencia de `requestType`/`categoryId`, paginación opcional 5/10/20 en categorías, docentes, usuarios e incidencias, y búsqueda backend en categorías y usuarios.
- Frontend: asistente con una sola columna Docente, excluidos revisables, motivos y estados, paginación local de candidatos, selección persistente, confirmación inline, drawers de detalle y tablas compactas. Componentes compartidos en `frontend/src/components/table.tsx`.
- Seguridad: no se desactivaron CSRF, Origin guard, rate limiter ni protecciones de sesión. No se cambió la contraseña del administrador, no se recreó la cuenta y no se aplicaron migraciones ni escrituras nuevas en Neon durante esta corrección. Sólo se ejecutaron pruebas sintéticas y compilaciones locales.
- Clasificador V4: núcleo en `backend/src/classifier/v4/` (normalización, diccionario de 17 conceptos, detección ponderada, perfil `TI_INSTITUCIONAL`, correlación con evidencia, contextualización y repositorio con fallback), adaptador a `Candidate[]`, flag `classifier_engine`, API `/api/classifier`, interfaz `ClasificadorPage` y evaluación enero–diciembre. V3 queda intacto como línea base.
- Los 3 fallos detectados en la primera ejecución V4 (variante `interneet`, evidencia del reporte y cálculo de `ambiguous`) quedaron corregidos y cubiertos; las 61 pruebas y la evaluación pasan después del fix.

## 9. Conclusión

El código está listo como **versión candidata**: compila, pasa todas las pruebas automáticas disponibles, no tiene vulnerabilidades conocidas en dependencias y no contiene operaciones destructivas en migraciones o scripts versionados.

No debe emitirse el informe final de 20 puntos ni declararse lanzamiento hasta que:

1. la migración y el seed ya aplicados en la base autorizada se consideran verificados;
2. se autorice y aplique `0003` si se quiere persistir el diccionario, el feedback y las versiones del clasificador V4 en Neon;
3. el administrador creado por el operador se valide en la sesión de UAT correspondiente;
4. se complete la validación en sala/UAT con datos institucionales, más allá del corpus sintético enero–diciembre;
5. se decida formalmente mantener Drive deshabilitado o habilitarlo con credenciales OAuth;
6. se autorice push/PR/merge y despliegue.

El incidente de login quedó resuelto en esta rama: la causa raíz era la ausencia de `authenticated: true` en la respuesta de `/api/auth/login`, agravada por un rate limiter que contabilizaba los inicios de sesión correctos. No se desactivaron CSRF, Origin guard ni las protecciones de autenticación.

El seguimiento punto por punto está en [RELEASE-STATUS.md](RELEASE-STATUS.md). El guion de presentación está en [DEMO-GUIDE.md](DEMO-GUIDE.md).
