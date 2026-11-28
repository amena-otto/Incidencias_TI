# API REST

Base URL en desarrollo: `http://localhost:3001/api`. En producción se recomienda servir interfaz y API bajo el mismo dominio y usar `/api`.

## 1. Convenciones

### Respuesta correcta

```json
{
  "ok": true,
  "data": { "...": "..." },
  "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 }
}
```

`meta` aparece sólo cuando se solicita paginación con `page` o `limit`. Los tamaños permitidos son `5`, `10` y `20`; si se omite `limit`, el valor por defecto es `10`. `data` sigue siendo un arreglo para no romper clientes existentes.

### Respuesta de error

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Datos inválidos",
    "details": { "...": "..." }
  }
}
```

| Código | Estado | Significado |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Zod rechazó el cuerpo, query o parámetros |
| `INVALID_JSON` | 400 | Cuerpo JSON mal formado |
| `UPLOAD_ERROR` | 400 | Archivo inválido o superior a `MAX_UPLOAD_MB` |
| `UNAUTHORIZED` | 401 | Falta sesión vigente |
| `FORBIDDEN` | 403 | Sin permiso, CSRF inválido u origen no permitido |
| `NOT_FOUND` | 404 | Ruta o recurso inexistente |
| `CONFLICT` | 409 | Correo duplicado o conversación ya importada |
| `EXPIRED` | 410 | Previsualización caducada o consumida |
| `RATE_LIMITED` | 429 | Demasiados intentos fallidos de login (10 cada 15 min por IP); un login correcto libera la cuenta |
| `SERVICE_UNAVAILABLE` | 503 | Drive deshabilitado u otra función no disponible |
| `DATABASE_UNAVAILABLE` | 503 | `select 1` falló en PostgreSQL |
| `INTERNAL_ERROR` | 500 | Error no controlado; en producción no se exponen detalles |

### Formatos

- Fechas de filtro y reporte: `YYYY-MM-DD` en `America/Lima`.
- Fechas de respuesta: ISO 8601 (`2026-11-26T15:30:00.000Z`).
- Horas de incidencia: `HH:mm` de 24 horas, normalizadas desde 12 horas cuando corresponde.
- Identificadores: UUID v4.
- Zona horaria institucional: `America/Lima` (UTC-05:00, sin horario de verano).

### Sesión, CSRF y Origin

1. `GET /api/auth/me` entrega `csrfToken` cuando hay sesión.
2. `POST /api/auth/login` establece la cookie `smartdesk_session` (`HttpOnly`, `SameSite=Strict`, `path=/api`, `Secure` en producción).
3. Toda petición `POST`, `PUT`, `PATCH` o `DELETE` con sesión debe enviar `X-CSRF-Token` con el valor devuelto.
4. Si el navegador envía `Origin`, debe coincidir con `FRONTEND_ORIGIN` o con el host de la petición.
5. Las peticiones `GET` no requieren CSRF.

```bash
# 1) Obtener CSRF si ya hay sesión
curl -s -c cookies.txt http://localhost:3001/api/auth/me

# 2) Iniciar sesión (datos sintéticos de ejemplo)
curl -s -c cookies.txt -b cookies.txt \
  -H 'Content-Type: application/json' \
  -d '{"email":"docente.prueba@example.edu","password":"contraseña-de-prueba"}' \
  http://localhost:3001/api/auth/login
```

Guarda el `data.csrfToken` devuelto y envíalo en mutaciones:

```bash
curl -X PATCH http://localhost:3001/api/incidents/<uuid> \
  -b cookies.txt \
  -H 'Content-Type: application/json' \
  -H 'X-CSRF-Token: <csrfToken>' \
  -d '{"status":"en_atencion"}'
```

## 2. Matriz de endpoints

| Método | Ruta | Permiso | Descripción |
| --- | --- | --- | --- |
| `GET` | `/api/health` | público | Estado real de PostgreSQL y uptime |
| `POST` | `/api/auth/login` | público | Inicia sesión; limitado por IP |
| `POST` | `/api/auth/logout` | público, idempotente | Cierra la sesión si existe y borra la fila |
| `GET` | `/api/auth/me` | público | Estado de sesión, usuario, permisos y CSRF |
| `GET` | `/api/auth/permissions` | sesión | Rol y permisos del usuario |
| `POST` | `/api/imports/preview` | `import` | Analiza TXT o texto pegado; no persiste |
| `POST` | `/api/imports/commit` | `import` | Confirma candidatos revisados |
| `POST` | `/api/incidents/bulk` | `import` | Alias controlado del mismo flujo de commit |
| `GET` | `/api/incidents` | `incidents:read` | Lista paginada (5/10/20) y filtrada |
| `GET` | `/api/incidents/filters` | `incidents:read` | Catálogos para filtros |
| `GET` | `/api/incidents/:id` | `incidents:read` | Detalle, mensajes, respuestas e historial |
| `PATCH` | `/api/incidents/:id` | `incidents:write` | Estado, responsable y solución |
| `POST` | `/api/incidents/:id/responses` | `incidents:write` | Registra respuesta interna |
| `GET` | `/api/dashboard` | `incidents:read` | Indicadores y series |
| `GET` | `/api/reports/xlsx` | `reports:read` | Descarga Excel de cuatro hojas |
| `GET` | `/api/reports/meta` | `reports:read` | Metadatos del reporte |
| `GET` | `/api/categories` | sesión | Categorías activas, `?all=true`, búsqueda y paginación |
| `POST` | `/api/categories` | `categories:write` | Crea categoría |
| `PATCH` | `/api/categories/:id` | `categories:write` | Actualiza categoría |
| `GET` | `/api/teachers` | sesión | Catálogo con alias, búsqueda y paginación |
| `POST` | `/api/teachers` | `teachers:write` | Crea docente |
| `PATCH` | `/api/teachers/:id` | `teachers:write` | Edita o activa/desactiva |
| `POST` | `/api/teachers/:id/aliases` | `teachers:write` | Agrega alias |
| `GET` | `/api/teachers/import/template` | `teachers:write` | Descarga plantilla XLSX |
| `POST` | `/api/teachers/import/preview` | `teachers:write` | Valida XLSX en memoria |
| `POST` | `/api/teachers/import/commit` | `teachers:write` | Guarda filas seleccionadas |
| `GET` | `/api/teachers/export` | sesión | Exporta catálogo XLSX |
| `POST` | `/api/teachers/match` | sesión | Prueba coincidencia de nombre |
| `GET` | `/api/users` | `users:write` | Lista usuarios sin contraseñas, con búsqueda y paginación |
| `POST` | `/api/users` | `users:write` | Crea usuario |
| `PATCH` | `/api/users/:id` | `users:write` | Cambia nombre, rol o estado |
| `POST` | `/api/users/:id/reset-password` | `users:write` | Restablece contraseña |
| `GET` | `/api/config` | sesión | Configuración, capacidades, motor y perfil V4 |
| `PATCH` | `/api/config` | `config:write` | Actualiza ventana, `classifierEngine` y `tiScope` |
| `GET` | `/api/classifier` | sesión | Estado del motor, diccionario, perfil y modelo local |
| `GET` | `/api/classifier/concepts` | sesión | Conceptos con filtros `q`, `category`, `active` |
| `POST` | `/api/classifier/concepts` | `config:write` | Crea concepto del diccionario |
| `PATCH` | `/api/classifier/concepts/:key` | `config:write` | Edita concepto y registra versión |
| `POST` | `/api/classifier/concepts/:key/synonyms` | `config:write` | Agrega sinónimos sin duplicar |
| `GET` | `/api/classifier/feedback?limit=200` | `config:write` | Correcciones humanas registradas |
| `GET` | `/api/classifier/suggestions` | `config:write` | Sugerencias pendientes y resueltas |
| `POST` | `/api/classifier/suggestions/generate` | `config:write` | Genera sugerencias desde correcciones repetidas |
| `PATCH` | `/api/classifier/suggestions/:id` | `config:write` | Aprueba o rechaza una sugerencia; no activa reglas |
| `GET` | `/api/classifier/versions` | `config:write` | Instantáneas versionadas del diccionario |
| `POST` | `/api/classifier/versions/:version/revert` | `config:write` | Revierte a una versión guardada |
| `GET` | `/api/drive/status` | sesión | Estado real de Drive |
| `POST` | `/api/drive/upload` | `reports:read` | Siempre `503` en esta versión |

## 3. Salud

```bash
curl http://localhost:3001/api/health
```

Respuesta correcta:

```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "database": { "connected": true, "latencyMs": 3 },
    "uptimeSeconds": 128,
    "environment": "development",
    "timezone": "America/Lima"
  }
}
```

Si PostgreSQL no responde, el estado HTTP es `503` y `error.code` es `DATABASE_UNAVAILABLE`. Nunca se devuelve un estado falso de éxito.

## 4. Autenticación

### `POST /api/auth/login`

```json
{ "email": "docente.prueba@example.edu", "password": "contraseña-de-prueba" }
```

Respuesta `data`:

```json
{
  "authenticated": true,
  "user": {
    "id": "uuid",
    "fullName": "Docente Prueba",
    "email": "docente.prueba@example.edu",
    "role": "consulta"
  },
  "csrfToken": "token-opaco",
  "expiresAt": "2026-11-26T22:00:00.000Z",
  "permissions": ["incidents:read", "reports:read"]
}
```

`authenticated: true` es obligatorio en la respuesta: el frontend actualiza el estado de React con este campo y deja la pantalla de login en cuanto lo recibe.

La comparación de contraseña se ejecuta incluso si el correo no existe, para no revelar cuentas válidas. Los fallos se auditorían. El contador del rate limiter se libera tras un inicio de sesión correcto, de modo que los aciertos no provocan `429`; aunque el contador ya esté agotado, una contraseña correcta sigue iniciando sesión y libera el bucket, mientras que una incorrecta recibe `429`.

### `GET /api/auth/me`

Con sesión devuelve `authenticated: true`, `user`, `permissions` y `csrfToken`. Sin sesión devuelve `authenticated: false` y `permissions: []`, con HTTP 200.

### `POST /api/auth/logout`

Es idempotente: con o sin sesión devuelve HTTP 200 y `{ "ok": true, "data": { "loggedOut": true } }`. Si hay sesión, elimina la fila y expira la cookie. No expone si existía una sesión previa.

### Permisos por rol

```json
{
  "admin": ["import", "incidents:write", "incidents:read", "teachers:write", "categories:write", "reports:read", "users:write", "config:write", "history:read"],
  "tecnico": ["import", "incidents:write", "incidents:read", "reports:read", "history:read"],
  "consulta": ["incidents:read", "reports:read"]
}
```

## 5. Importación

### `POST /api/imports/preview`

`multipart/form-data`:

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `file` | archivo | `.txt` o `.text`, máximo `MAX_UPLOAD_MB` |
| `text` | texto | Alternativa al archivo |
| `conversationKey` | texto | Opcional, distingue grupos con mensajes idénticos |

Resumen de `data` (simplificado; se omiten campos repetidos):

```json
{
  "token": "token-opaco-de-previsualización",
  "sourceName": "chat_prueba.txt",
  "channel": "whatsapp_txt",
  "totalMessages": 12,
  "contentHash": "sha256",
  "format": "android",
  "invalidDates": 0,
  "candidates": [
    {
      "candidateId": "huella-estable",
      "position": 4,
      "date": "2026-11-26",
      "time": "20:01",
      "requesterName": "Ana Pérez",
      "originalMessage": "No tengo conexión a Internet en el laboratorio",
      "categoryLabel": "TI · Redes e Internet",
      "requestType": "ti",
      "contextualization": "",
      "confidence": "alta",
      "explanation": "Regla concreta: conexión + Internet",
      "matchedCategories": ["TI · Redes e Internet"],
      "ambiguous": false,
      "selected": true,
      "responses": [
        {
          "sender": "Personal TI",
          "text": "Me acerco al laboratorio",
          "date": "2026-11-26",
          "time": "20:03",
          "role": "ack",
          "uncertain": false,
          "score": 8,
          "isStaff": true
        }
      ],
      "teacherId": null,
      "teacherName": null,
      "inclusionStatus": "ti_detectada",
      "inclusionReason": "Incidencia TI detectada: Redes e Internet.",
      "tiTopics": ["Redes e Internet"],
      "nonTiTopics": [],
      "mixed": false,
      "possibleDuplicate": false
    }
  ],
  "excluded": [
    {
      "position": 5,
      "date": "2026-11-26",
      "time": "20:04",
      "sender": "Docente Prueba",
      "originalMessage": "Faltan sillas en el aula",
      "status": "fuera_alcance",
      "reason": "Fuera del alcance TI: Mobiliario y materiales. No se selecciona automáticamente."
    }
  ],
  "excludedReasons": [
    { "status": "fuera_alcance", "reason": "Fuera del alcance TI: Mobiliario y materiales. No se selecciona automáticamente.", "count": 1 }
  ],
  "stats": {
    "analyzed": 12,
    "detected": 1,
    "high": 1,
    "medium": 0,
    "low": 0,
    "ambiguous": 0,
    "responses": 1,
    "discarded": 11,
    "possibleDuplicates": 0,
    "includedTi": 1,
    "tiWithAttention": 1,
    "requiresReview": 0,
    "excludedOutOfScope": 1,
    "excludedNotRelevant": 0,
    "excludedDuplicates": 0
  }
}
```

`inclusionStatus` puede ser `ti_detectada`, `atencion_ti`, `requiere_revision`, `fuera_alcance` o `no_pertinente`. `atencion_ti` significa que hay seguimiento de personal TI vinculado; **`ack` no implica resolución**. Los mensajes `fuera_alcance`, `no_pertinente` y duplicados se devuelven en `excluded`, nunca como candidatos seleccionables. Los casos mixtos conservan el mensaje original y llegan como `requiere_revision`.

La previsualización se guarda en memoria con token opaco y caducidad. No se persiste en PostgreSQL, incluidos motivos y excluidos.

### `POST /api/imports/commit`

```json
{
  "token": "token-opaco-de-previsualización",
  "rows": [
    {
      "candidateId": "huella-estable",
      "selected": true,
      "categoryLabel": "Infraestructura · Electricidad y mantenimiento",
      "contextualization": "Revisado por soporte",
      "teacherId": null
    }
  ]
}
```

Respuesta `201`:

```json
{
  "data": {
    "message": "Importación confirmada",
    "analyzed": 12,
    "detected": 1,
    "confirmed": 1,
    "saved": 1,
    "duplicateMessages": 0,
    "rejected": 0,
    "responsesSaved": 0,
    "importId": "uuid",
    "duplicateConversation": false
  }
}
```

**Contrato de seguridad:** la petición no puede inventar mensaje, fecha, remitente, confianza ni huella. El servidor recupera el candidato original por `candidateId`; sólo acepta una categoría activa y un docente existente, y valida los límites de contextualización. La incidencia persistida conserva el `categoryLabel` revisado y deriva `requestType`/`categoryId` en el servidor, sin aceptarlos del cliente. Si el token expiró o ya se consumió, responde `410 EXPIRED`. Si el hash de contenido ya fue importado, responde `409 CONFLICT` sin guardar duplicados.

Cuando V4 está activo, si una fila confirmada cambia la categoría que tenía en la previsualización, el servidor registra automáticamente una entrada en `classifier_feedback` con el texto original, la versión del clasificador y del diccionario, los conceptos detectados y el revisor. Esta corrección **no crea ni activa reglas globales**.

`POST /api/incidents/bulk` acepta el mismo cuerpo y aplica exactamente el mismo servicio. No es una ruta para guardar registros arbitrarios.

## 6. Incidencias

### Listado

```bash
curl -b cookies.txt \
  'http://localhost:3001/api/incidents?page=1&limit=20&from=2026-11-01&to=2026-11-26&status=pendiente'
```

Filtros admitidos: `page`, `limit` (`5`, `10` o `20`; por defecto `10`), `sortBy`, `sortDir`, `from`, `to`, `status`, `requestType`, `categoryId`, `teacherId`, `assignedTo`, `search`.

`meta` incluye `page`, `limit`, `total` y `totalPages`.

### Detalle

`GET /api/incidents/:id` devuelve la incidencia más `messages`, `responses` e `history`.

### Actualización

```json
{ "status": "resuelto", "assignedTo": "uuid-o-null", "solution": "Se restableció la conexión" }
```

El servidor rechaza transiciones no permitidas y exige solución de al menos 5 caracteres para `resuelto`.

### Respuesta interna

```json
{ "text": "Se revisó el tomacorriente", "type": "seguimiento" }
```

Tipos válidos: `respuesta`, `seguimiento`, `confirmacion`.

## 7. Dashboard

`GET /api/dashboard?from=2026-11-01&to=2026-11-26&categoryId=...&requestType=...&status=...`

Devuelve `period`, `indicators`, `charts` (por categoría, estado, tipo, series diaria/semanal/mensual, top categorías y comparación) y `formulas` con el cálculo de cada indicador.

## 8. Reportes

```bash
curl -b cookies.txt -o reporte.xlsx \
  'http://localhost:3001/api/reports/xlsx?from=2026-11-01&to=2026-11-26'
```

Devuelve `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` con `Content-Disposition: attachment`. Filtros opcionales: `categoryId`, `status`, `requestType`, `teacherId`. Cada descarga se auditoría con rango y número de filas.

`GET /api/reports/meta` devuelve:

```json
{
  "data": {
    "sheets": ["Dashboard", "Incidencias", "Resumen", "Importaciones"],
    "chartsNative": false,
    "note": "ExcelJS genera tablas visuales y barras de caracteres; no gráficos nativos de Excel."
  }
}
```

## 9. Catálogos y configuración

### Categorías

```json
{
  "name": "TI · Redes e Internet",
  "group": "ti",
  "description": "Conectividad, Wi-Fi e Internet",
  "keywords": ["internet", "wifi", "conexion"],
  "active": true
}
```

`GET /api/categories?all=true` incluye inactivas. Admite `search` por nombre, `page` y `limit` (`5`/`10`/`20`). Con paginación, `meta` incluye totales; sin esos parámetros devuelve hasta 500 filas para compatibilidad.

### Docentes

`GET /api/teachers` admite `search` por nombre normalizado, `page` y `limit` (`5`/`10`/`20`). `POST /api/teachers` acepta `fullName`, `email` opcional, `code` opcional y `alias` opcional. `POST /api/teachers/:id/aliases` acepta `{ "alias": "La profe Ana" }`.

La importación Excel sigue el mismo patrón de dos fases:

1. `POST /api/teachers/import/preview` con `multipart/form-data` y campo `file`.
2. `POST /api/teachers/import/commit` con `{ "token": "...", "rows": [{ "rowNumber": 2, "selected": true }] }`.

### Usuarios

```json
{ "fullName": "Personal TI", "email": "ti@example.edu", "password": "mínimo-12-caracteres", "role": "tecnico" }
```

`GET /api/users` admite `search` por nombre o correo, `page` y `limit` (`5`/`10`/`20`). `PATCH /api/users/:id` acepta `fullName`, `role` y `active`. `POST /api/users/:id/reset-password` acepta `password`.

### Configuración

`PATCH /api/config` acepta una o más de estas opciones:

```json
{
  "contextWindowMinutes": 120,
  "classifierEngine": "v4",
  "tiScope": {
    "profile": "TI_INSTITUCIONAL",
    "allowedCategories": ["TI · Redes e Internet"],
    "conditionalCategories": ["Asistencia · Marcación y asistencia"],
    "excludeNonTiByDefault": true,
    "requireTiEvidenceForNonTi": true
  }
}
```

`classifierEngine` es `v4` (por defecto) o `v3` (línea base). Cambiarlo afecta sólo a nuevas previsualizaciones: **no reclasifica incidencias confirmadas**. `tiScope` se fusiona con la configuración actual y se valida en el servidor; no elimina categorías del catálogo.

`GET /api/config` devuelve timezone, ventana, tamaño de carga, entorno, versión, `classifierEngine`, `classifierVersion`, `dictionaryVersion`, `dictionarySource` (`neon` o `memoria`), `tiScope` y `capabilities` (`classifierV4: true`, `localStatisticalModel: false`, `googleDrive` según credenciales).

## 10. Clasificador V4

Todas las rutas `/api/classifier` exigen sesión. Las operaciones de diccionario, feedback, sugerencias y versiones requieren además `config:write` y se auditorizan.

### Estado

`GET /api/classifier` devuelve:

```json
{
  "classifierVersion": "V4.0.0",
  "dictionaryVersion": "V4.0.0-seed",
  "storage": "memoria",
  "migrationPending": true,
  "engine": "v4",
  "scope": {
    "profile": "TI_INSTITUCIONAL",
    "allowedCategories": ["TI · Redes e Internet"],
    "conditionalCategories": ["Asistencia · Marcación y asistencia"],
    "excludeNonTiByDefault": true,
    "requireTiEvidenceForNonTi": true
  },
  "concepts": 17,
  "activeConcepts": 17,
  "categories": 13,
  "ruleVersions": 1,
  "statisticalModel": { "enabled": false, "reason": "Sin datos etiquetados suficientes; interfaz preparada." }
}
```

`migrationPending: true` indica que la migración `0003` no está aplicada y el motor usa el diccionario semilla en memoria. No es un error de la API.

### Conceptos

`GET /api/classifier/concepts?q=internet&category=TI%20%C2%B7%20Redes%20e%20Internet&active=true` devuelve `{ "version": "...", "concepts": [...] }`. El filtro `q` se normaliza antes de buscar en nombre, descripción y listas de términos.

`POST /api/classifier/concepts` acepta `category` (una de las 13 categorías canónicas), `name`, `description`, `weight` (0–10), `priority` (0–10), `active` y las listas `synonyms`, `expressions`, `variants`, `abbreviations`, `related`, `negatives`. `key` es opcional y se deriva del nombre. Responde `201`.

`PATCH /api/classifier/concepts/:key` acepta los mismos campos de forma parcial; `key` e `id` no se pueden cambiar. `POST /api/classifier/concepts/:key/synonyms` acepta `{ "terms": ["inalámbrico"] }` (1–50 términos) y elimina duplicados. Cada escritura captura una versión nueva del diccionario.

### Retroalimentación y sugerencias

`GET /api/classifier/feedback?limit=200` devuelve `{ "entries": [...] }` (máximo 500 en servidor). Cada entrada contiene `originalText`, `originalHash`, `suggestedCategory`, `correctedCategory`, `concepts`, `ruleApplied`, `reviewerName`, `reviewedAt`, `classifierVersion` y `dictionaryVersion`.

`POST /api/classifier/suggestions/generate` responde `{ "created": n }` con las propuestas nuevas. Una corrección repetida al menos 3 veces genera una sugerencia `pendiente`; no modifica reglas. `PATCH /api/classifier/suggestions/:id` acepta:

```json
{ "status": "aprobada", "notes": "Aprobada por revisión humana." }
```

`status` es `aprobada` o `rechazada`. La respuesta incluye `rulesActivated: false`: aprobar registra la decisión humana, pero la regla debe editarse explícitamente desde el diccionario. Una sugerencia ya resuelta devuelve `409 CONFLICT`.

### Versiones

`GET /api/classifier/versions` devuelve `{ "versions": [...] }` ordenadas por fecha, con `snapshot`, `notes`, `active` y `createdAt`. `POST /api/classifier/versions/:version/revert` restaura la instantánea y responde `{ "version": "...", "concepts": 17 }`. La reversión crea una versión nueva; no elimina la anterior ni altera incidencias guardadas. Si la versión no existe, responde `404 NOT_FOUND`.

El detalle arquitectónico, los límites de correlación y el plan del modelo local están en [CLASSIFIER-V4.md](CLASSIFIER-V4.md).

## 11. Drive

`GET /api/drive/status` devuelve `configured`, `enabled: false`, `reason` y `downloadAlwaysAvailable: true`.

`POST /api/drive/upload` responde:

```json
{
  "ok": false,
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Google Drive no está habilitado en esta versión. Descarga el Excel localmente."
  }
}
```

No existe simulación de subida ni OAuth activo. Las variables `GOOGLE_*` sólo preparan la integración futura.
