# Despliegue

Esta guía describe la topología recomendada y la secuencia segura para publicar TI SmartDesk. **No autoriza** despliegue, migraciones ni creación de usuarios: esos pasos requieren aprobación del responsable.

## 1. Topología recomendada

```text
Navegador
   │ HTTPS
   ▼
Reverse proxy TLS (Nginx / Caddy / balanceador)
   ├── /            → frontend/dist (SPA, fallback a index.html)
   └── /api/*       → Node/Express en 127.0.0.1:3001
                         │ SSL
                         ▼
                    Neon PostgreSQL
```

Ventajas de un solo dominio:

- no se necesita CORS entre dominios;
- la cookie `SameSite=Strict` funciona sin excepciones;
- `VITE_API_URL` permanece como `/api`;
- el Origin del navegador coincide con `FRONTEND_ORIGIN`.

Si se usa un dominio separado para la API, configura `VITE_API_URL=https://api.ejemplo.edu.pe/api` en el build del frontend y `FRONTEND_ORIGIN=https://app.ejemplo.edu.pe` en el backend. Revisa la sección 8.

## 2. Preparación del servidor

```bash
# Node.js 20+ (verificar)
node --version
npm --version

# Obtener código en la rama candidata
git clone https://github.com/amena-otto/Incidencias_TI.git
cd Incidencias_TI
git checkout feat/smartdesk-final-release
```

Se validó localmente con Node v24.20.0 / npm 12.2.0; CI usa Node 20.

## 3. Variables de entorno de producción

`backend/.env`:

```dotenv
NODE_ENV=production
PORT=3001
FRONTEND_ORIGIN=https://app.ejemplo.edu.pe
TRUST_PROXY=1
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require
SESSION_TTL_HOURS=8
CONTEXT_WINDOW_MINUTES=90
BCRYPT_ROUNDS=12
MAX_UPLOAD_MB=5
LOG_LEVEL=info
```

`frontend/.env.local` para el build:

```dotenv
VITE_API_URL=/api
```

Reglas:

- `NODE_ENV=production` activa cookies `Secure` y mensajes de error genéricos.
- `TRUST_PROXY=1` permite que Express use `X-Forwarded-Proto` y `X-Forwarded-For` de **un** proxy de confianza. Déjalo en `0` si Node está expuesto directamente. No lo actives si el cliente puede falsificar esas cabeceras.
- `FRONTEND_ORIGIN` debe ser exacto: `https`, host y puerto.
- Nunca pongas `DATABASE_URL`, contraseñas ni `GOOGLE_CLIENT_SECRET` en el repositorio ni en el bundle frontend.
- Las variables `VITE_*` se incrustan en el build: no uses ahí secretos.

## 4. Instalación y compilación

```bash
cd backend && npm ci && npm run build
cd ../frontend && npm ci && npm run build
```

Resultados esperados:

- `backend/dist/server.js`
- `frontend/dist/index.html` y `frontend/dist/assets/`
- Chunks separados por vista; el panel con Recharts se carga bajo demanda.

## 5. Base de datos y administrador

Sólo con autorización y después de verificar backup:

```bash
cd backend
npm run db:migrate
npm run db:seed
ADMIN_EMAIL='...' ADMIN_PASSWORD='...' ADMIN_FULL_NAME='...' npm run create:admin
```

Estado verificado en la base autorizada: `0000`, `0001` y `0002` aplicadas y seed ejecutado. Falta crear el primer administrador. No ejecutar `db:push`, `DROP TABLE`, `TRUNCATE` ni migraciones contra una base incorrecta. El seed es idempotente y no crea usuarios.

## 6. Proceso del backend

Ejemplo con `systemd`:

```ini
[Unit]
Description=TI SmartDesk API
After=network.target

[Service]
Type=simple
User=smartdesk
WorkingDirectory=/srv/smartdesk/backend
EnvironmentFile=/srv/smartdesk/backend/.env
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now smartdesk-api
sudo systemctl status smartdesk-api
```

El backend escucha en `127.0.0.1:3001` detrás del proxy. No lo expongas directamente sin TLS.

## 7. Reverse proxy

Ejemplo Nginx para un solo dominio:

```nginx
server {
    listen 443 ssl http2;
    server_name app.ejemplo.edu.pe;

    ssl_certificate     /etc/ssl/app.ejemplo.edu.pe.crt;
    ssl_certificate_key /etc/ssl/app.ejemplo.edu.pe.key;

    root /srv/smartdesk/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        client_max_body_size 8m;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Ajusta `client_max_body_size` por encima de `MAX_UPLOAD_MB`. Redirige HTTP a HTTPS.

## 8. Dominio separado

Si la API está en `api.ejemplo.edu.pe`:

- construye el frontend con `VITE_API_URL=https://api.ejemplo.edu.pe/api`;
- configura `FRONTEND_ORIGIN=https://app.ejemplo.edu.pe`;
- habilita CORS con `credentials: true` (ya implementado) y asegúrate de que el proxy no elimine la cabecera `Origin`;
- mantén HTTPS en ambos dominios y `SameSite=Strict`;
- verifica que el navegador envíe la cookie en las peticiones `fetch` con `credentials: "include"` (ya implementado).

**No** definas `VITE_API_URL=http://localhost:3001/api` en un build público.

## 9. Verificación posterior

| Comando / acción | Esperado |
| --- | --- |
| `curl https://app.ejemplo.edu.pe/api/health` | `database.connected: true` |
| Abrir la app en navegador | Login visible; sin errores de CORS/CSRF |
| Login con administrador nominal | Cookie `Secure; HttpOnly; SameSite=Strict` |
| `GET /api/auth/me` | `authenticated: true` y `csrfToken` |
| Importar TXT sintético | Preview con total real y confirmación |
| Descargar reporte | XLSX de cuatro hojas |
| `GET /api/drive/status` | `enabled: false` |
| `npm audit --audit-level=high` en ambos paquetes | 0 vulnerabilidades |
| Revisar `journalctl -u smartdesk-api` | Sin secretos ni cuerpos de conversación en logs |

## 10. Observabilidad

- `/api/health` es la sonda de liveness/readiness; devuelve `503` si PostgreSQL falla.
- Los logs se escriben en `stderr` con nivel `LOG_LEVEL` y redacción de claves sensibles.
- Las mutaciones relevantes están en `auditLogs`: login, importaciones, usuarios, categorías, docentes, incidencias, configuración y reportes.
- La latencia de base en `/api/health` es real, no estimada.

No expongas `DEBUG` en producción: `LOG_LEVEL=debug` puede aumentar el volumen de metadatos técnicos, aunque la redacción sigue activa.

## 11. Backup y recuperación

- Antes de migrar, confirma backup de Neon y su restauración en entorno aislado.
- Guarda los archivos `.env` cifrados fuera del repositorio.
- Para rollback de código: detener el servicio, restaurar el commit/build anterior y reiniciar. **No** revertir esquemas con DDL destructivo sin un plan aprobado.
- El rollback de datos debe hacerse con el procedimiento de Neon, nunca con `DROP` o `TRUNCATE` improvisados.

## 12. Escalado

La versión candidata está preparada para **una instancia**. Si se escala:

- el store de previsualizaciones y el rate limiter son en memoria y no se comparten;
- habilita afinidad de sesión o migra ambos a un store centralizado;
- ajusta `TRUST_PROXY` al número real de hops de confianza;
- revisa la limpieza programada de sesiones expiradas.

## 13. Checklist de publicación

1. Node 20+ y dependencias instaladas con `npm ci`.
2. Build de backend y frontend correctos.
3. CI verde: typecheck, test, build y audit en ambos paquetes.
4. Migraciones aplicadas en la base correcta y con autorización.
5. Seed verificado: 13 categorías activas.
6. Administrador creado con credenciales inyectadas.
7. HTTPS y proxy configurados; `TRUST_PROXY` coherente.
8. `/api/health` en verde.
9. Usuarios nominativos y roles revisados.
10. UAT/validación en sala ejecutada y aceptada.
11. Drive confirmado como deshabilitado o habilitado sólo tras decisión explícita.
12. Backups y plan de rollback verificados.

Mientras los pasos 4, 6, 10 o 11 estén pendientes, el sistema es **candidato**, no lanzamiento final.
