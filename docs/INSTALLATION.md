# Instalación y configuración

Esta guía describe cómo preparar TI SmartDesk en un entorno local o de servidor sin modificar datos institucionales. Todas las operaciones que escriben en PostgreSQL requieren autorización explícita del responsable de la base.

## 1. Requisitos previos

| Requisito | Detalle |
| --- | --- |
| Node.js | 20 o superior (`engines.node: >=20` en ambos paquetes) |
| npm | 10 o superior recomendado; se validó con npm 12.2.0 |
| PostgreSQL | Neon PostgreSQL con SSL y cadena de conexión válida |
| Red | Acceso HTTPS desde el servidor hacia Neon |
| Navegador | Chrome/Edge/Firefox moderno con cookies habilitadas |

No se necesita Google Drive, OAuth ni una API de IA para instalar la versión candidata.

## 2. Obtener el código

```bash
git clone https://github.com/amena-otto/Incidencias_TI.git
cd Incidencias_TI
git checkout feat/smartdesk-final-release
git pull --ff-only   # sólo si el responsable autoriza actualizar la rama
```

La rama de trabajo actual parte de `4d60d3b` (`Merge pull request #3`). No se ha hecho push ni merge desde esta sesión.

## 3. Variables de entorno del backend

Copia `backend/.env.example` a `backend/.env`. Nunca versiones el archivo resultante.

```bash
cp backend/.env.example backend/.env
```

| Variable | Obligatoria | Valor por defecto | Uso |
| --- | --- | --- | --- |
| `NODE_ENV` | No | `development` | `development`, `test` o `production`; controla mensajes de error y cookie `Secure` |
| `PORT` | No | `3001` | Puerto HTTP de Express |
| `FRONTEND_ORIGIN` | No | `http://localhost:5173` | Origen exacto permitido por CORS y Origin guard |
| `TRUST_PROXY` | No | `0` | Proxies de confianza para Express (0 local; 1 tras un proxy TLS) |
| `DATABASE_URL` | Sí para operar | — | Cadena Neon, idealmente con `sslmode=require` |
| `SESSION_TTL_HOURS` | No | `8` | Vigencia de la cookie y fila de sesión (1–168 h) |
| `CONTEXT_WINDOW_MINUTES` | No | `90` | Ventana por defecto para correlacionar respuestas (5–10080 min) |
| `BCRYPT_ROUNDS` | No | `12` | Costo de hash de contraseñas (10–15) |
| `MAX_UPLOAD_MB` | No | `5` | Límite de TXT y XLSX en memoria (1–25 MB) |
| `LOG_LEVEL` | No | `info` | `error`, `warn`, `info` o `debug` |
| `ADMIN_EMAIL` | Sólo al crear admin | — | Correo del primer administrador |
| `ADMIN_PASSWORD` | Sólo al crear admin | — | Contraseña; no se imprime ni se guarda en el repo |
| `ADMIN_FULL_NAME` | Sólo al crear admin | — | Nombre visible del administrador |
| `ADMIN_RESET_PASSWORD` | No | `0` | `1` permite actualizar la contraseña de un correo existente |
| `GOOGLE_CLIENT_ID` | No | — | Preparación OAuth; **no habilita Drive por sí sola** |
| `GOOGLE_CLIENT_SECRET` | No | — | Preparación OAuth |
| `GOOGLE_REDIRECT_URI` | No | — | Debe ser URL válida si se define |
| `GOOGLE_DRIVE_FOLDER_ID` | No | — | Carpeta destino prevista |

`backend/src/config/env.ts` valida el tipo y rango de todas las variables al arrancar. Si hay un valor inválido, muestra **sólo los nombres** de los campos, nunca sus valores. No se imprime `DATABASE_URL`.

### Ejemplo mínimo

```dotenv
NODE_ENV=development
PORT=3001
FRONTEND_ORIGIN=http://localhost:5173
TRUST_PROXY=0
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require
```

En producción, `FRONTEND_ORIGIN` debe coincidir exactamente con el origen del navegador (esquema, host y puerto). Si la API está en otro dominio, además define `VITE_API_URL` en el frontend y autoriza ese origen en CORS.

## 4. Variables de entorno del frontend

Copia `frontend/.env.example` a `frontend/.env.local`.

```bash
cp frontend/.env.example frontend/.env.local
```

| Variable | Valor por defecto | Uso |
| --- | --- | --- |
| `VITE_API_URL` | `/api` | Base de la API. Déjala vacía o como `/api` si interfaz y API comparten dominio |
| `VITE_API_PROXY_TARGET` | `http://localhost:3001` | Destino del proxy de Vite en `dev` y `preview` |

La app nunca fija `localhost` en el código fuente. En producción con dominio separado, usa por ejemplo `VITE_API_URL=https://api.tudominio.edu.pe/api` y configura `FRONTEND_ORIGIN=https://app.tudominio.edu.pe` en el backend.

## 5. Instalación de dependencias

```bash
cd backend && npm ci
cd ../frontend && npm ci
```

`npm ci` respeta los lockfiles versionados. Tras cambiar dependencias se usó `npm install` y los lockfiles quedaron actualizados.

## 6. Base de datos

Las migraciones generadas están en `backend/drizzle/`:

- `0001_loving_ravenous.sql`
- `0002_unknown_luke_cage.sql`

Ambas fueron revisadas: **no contienen `DROP TABLE`, `TRUNCATE` ni `DELETE FROM`**. Tras autorización se aplicaron `0001` y `0002` y se ejecutó el seed; la verificación de solo lectura confirmó las 13 tablas, las 15 columnas nuevas y los 7 índices.

Sólo después de autorizar la escritura en la base destino:

```bash
cd backend
npm run db:migrate
npm run db:seed
```

`db:migrate` aplica el esquema con Drizzle Kit. `db:seed` es idempotente: inserta o actualiza las 13 categorías canónicas y crea ajustes iniciales (`context_window_minutes`, `timezone` y `schema_version`). **No crea usuarios ni contraseñas**.

No ejecutes `npm run db:push`, comandos destructivos de SQL ni migraciones contra una base de producción sin backup y autorización.

## 7. Primer administrador

No hay credenciales por defecto. Inyecta los valores por entorno en el servidor:

**bash / PowerShell 7+**

```bash
ADMIN_EMAIL='admin@institucion.edu.pe' \
ADMIN_PASSWORD='contraseña-larga-y-única' \
ADMIN_FULL_NAME='Administrador TI' \
npm run create:admin
```

**Windows PowerShell**

```powershell
$env:ADMIN_EMAIL='admin@institucion.edu.pe'
$env:ADMIN_PASSWORD='contraseña-larga-y-única'
$env:ADMIN_FULL_NAME='Administrador TI'
npm run create:admin
```

El script:

- usa bcrypt con el costo configurado;
- guarda sólo el hash;
- no imprime la contraseña;
- rechaza correos ya existentes salvo `ADMIN_RESET_PASSWORD=1`;
- cierra el pool de PostgreSQL al terminar.

Después, crea el resto de usuarios desde **Usuarios** en la interfaz o mediante `/api/users`.

## 8. Arranque

Terminal 1:

```bash
cd backend && npm run dev
```

Terminal 2:

```bash
cd frontend && npm run dev
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:3001/api`
- Salud: `http://localhost:3001/api/health`

Para simular compilación de producción:

```bash
cd backend && npm run build && npm start
cd frontend && npm run build && npm run preview
```

`npm start` ejecuta `dist/server.js`; `npm run preview` sirve `dist/` en `http://localhost:4173` y mantiene el proxy `/api`.

## 9. Comprobación posterior a la instalación

| Comprobación | Resultado esperado |
| --- | --- |
| `GET /api/health` | `ok: true`, `database.connected: true`, latencia en ms |
| Login con el administrador creado | Devuelve `user`, `permissions` y `csrfToken`; cookie `smartdesk_session` HttpOnly |
| `GET /api/config` | Zona horaria `America/Lima`, versión `1.0.0-final-candidate` |
| `GET /api/categories` | 13 categorías activas |
| `GET /api/drive/status` | `enabled: false` con motivo explícito |
| Descarga de `/api/reports/xlsx` | Archivo `.xlsx` de cuatro hojas |
| Importación de un TXT sintético | Preview con total real y confirmación explícita |

Si `/api/health` devuelve `503` con `DATABASE_UNAVAILABLE`, revisa `DATABASE_URL`, SSL, red y que la base exista. El frontend mostrará el estado real en **Configuración**.

## 10. Solución de problemas

| Síntoma | Causa probable | Acción |
| --- | --- | --- |
| `Variables de entorno inválidas: ...` | Valor con formato/rango incorrecto | Corrige el campo indicado en `.env`; el mensaje no revela valores |
| `Falta DATABASE_URL` | Variable ausente | Configura la cadena Neon y reinicia |
| `503 DATABASE_UNAVAILABLE` | Base inalcanzable | Verificar credenciales, SSL y conectividad; no simular éxito |
| `403 Origen de la solicitud no autorizado` | `FRONTEND_ORIGIN` distinto del navegador | Igualar esquema/host/puerto o ajustar el despliegue |
| `403 Falta el token CSRF válido` | Cliente sin `/api/auth/me` o token desactualizado | Recargar sesión; las mutaciones exigen `X-CSRF-Token` |
| `429 RATE_LIMITED` | Demasiados intentos fallidos de login desde la misma IP | Esperar la ventana de 15 minutos; un login correcto libera el contador |
| `UPLOAD_ERROR` | TXT/XLSX mayor que `MAX_UPLOAD_MB` | Reducir el archivo o ajustar el límite con criterio |
| `No se detectaron requerimientos clasificables` | Formato de exportación no reconocido | Revisar encabezados de WhatsApp o pegar el texto |
| Build frontend sin chunks separados | `App.tsx` modificado | Verificar que las vistas sigan cargándose con `lazy()` |
