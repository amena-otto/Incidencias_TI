# TI SmartDesk v1
Registro y análisis de incidencias provenientes de conversaciones de WhatsApp.
Stack: React + TypeScript + Vite, Node.js + Express, Neon PostgreSQL, Drizzle ORM, ExcelJS.

<<<<<<< Updated upstream
## Inicio
1. Requiere Node.js 20+ y una base Neon PostgreSQL.
2. Copia `backend/.env.example` a `backend/.env` y configura `DATABASE_URL`.
3. `cd backend && npm install && npm run db:generate && npm run db:migrate && npm run db:seed && npm run dev`
4. En otra terminal: `cd frontend && npm install && npm run dev`
5. Frontend http://localhost:5173; API http://localhost:3001/api.

Importación de TXT/texto pegado con revisión obligatoria. Clasificación por reglas, sin IA. La exportación Excel inicial genera hoja Incidencias y Resumen. OAuth Drive se integra en la siguiente etapa; no se guardan credenciales de Google en frontend.
=======
Registro, revisión y análisis de incidencias institucionales originadas en conversaciones de WhatsApp. La clasificación es **heurística, basada en reglas y explicable** (motor V4): no se usa IA de pago ni se envían conversaciones a servicios externos.

> **Estado:** versión candidata con backend y frontend verificados localmente. Las migraciones `0000`–`0002` están aplicadas en Neon y el administrador fue creado por el operador. La migración `0003` del clasificador V4 está **generada y revisada, pero no aplicada**: mientras tanto se usa el diccionario semilla en memoria. **No se declara lanzamiento final** hasta completar UAT, decidir formalmente sobre OAuth/Google Drive y autorizar push/PR/despliegue. Esta corrección no aplicó migraciones nuevas ni hizo escrituras adicionales en Neon. Drive sigue deshabilitado.

## Capacidades

- Importación guiada de TXT de WhatsApp (Android, iOS y escritorio) o texto pegado.
- Previsualización obligatoria: total real de mensajes, candidatos, confianza, motivos de inclusión/exclusión, respuestas y posibles duplicados.
- **Clasificador V4 explicable**: diccionario dinámico de 17 conceptos, normalización en español peruano, puntuación con alternativas y evidencia por término. Conserva siempre el mensaje original.
- **Perfil exclusivo de Incidencias TI**: reglas concretas antes que genéricas, exclusión de asuntos ajenos, casos mixtos enviados a revisión y mensaje original preservado. «Me acerco» cuenta como atención, nunca como resolución.
- **Correlación conversacional verificable**: vincula respuestas por autor, tema, ubicación, dispositivo y tiempo absoluto; un «ok» aislado o una respuesta anterior no se asocian. La contextualización distingue hechos de inferencias y muestra su evidencia.
- **Administración del clasificador**: interfaz con permiso `config:write` para editar conceptos, revisar correcciones humanas, generar sugerencias y revertir versiones. Las correcciones nunca activan reglas globales automáticamente; V3 sigue disponible como línea base mediante `classifierEngine`.
- Una sola columna editable de **Docente** desde el catálogo importado; el remitente original se conserva sólo para trazabilidad y deduplicación.
- Corrección humana de docente, categoría y contextualización antes de guardar; selección nunca automática en casos ambiguos o fuera de alcance.
- Paginación universal 5/10/20 (por defecto 10) con selección persistente, cabecera indeterminada, contadores y confirmación antes de guardar.
- Persistencia transaccional en PostgreSQL/Neon con deduplicación por huella de mensaje y de conversación; se guardan `requestType` y `categoryId`.
- Catálogo de docentes con alias, importación/exportación Excel, plantilla y previsualización con selección; coincidencias dudosas nunca automáticas.
- Catálogo único de 13 categorías canónicas, gestionable desde la interfaz; el perfil TI sólo limita qué se importa, no elimina categorías.
- Panel de indicadores con Recharts, filtros por periodo y comparación con el periodo anterior.
- Gestión de incidencias: estados, responsable, solución obligatoria para `resuelto`, respuestas e historial.
- Reporte Excel de cuatro hojas (`Dashboard`, `Incidencias`, `Resumen`, `Importaciones`) generado con ExcelJS.
- Acceso nominal con RBAC (`admin`, `tecnico`, `consulta`), sesiones opacas HttpOnly, CSRF, Origin guard, rate limiting y auditoría.
- `/api/health` comprueba realmente `select 1` contra PostgreSQL y devuelve `503` si la base no responde.

## Arquitectura

```text
Incidencias_TI/
├── backend/                 # Express + TypeScript + Zod + Drizzle + ExcelJS
│   ├── src/auth/            # sesiones, contraseñas, RBAC, CSRF, auditoría
│   ├── src/classifier/      # reglas V3, ti-scope, categorías y motor V4 explicable
│   │   └── v4/              # normalización, detección, alcance, correlación y contextualización
│   ├── scripts/             # evaluación sintética enero–diciembre del clasificador
│   ├── src/config/          # variables de entorno validadas
│   ├── src/importer/        # parser V3 de WhatsApp
│   ├── src/lib/             # paginación compartida y utilidades
│   ├── src/services/        # preview, commit y configuración
│   ├── src/routes/          # API REST
│   ├── src/teachers/        # catálogo, Excel y matching
│   └── drizzle/             # migraciones generadas, sin DDL destructivo
├── frontend/                # React + TypeScript + Vite + CSS + Lucide + Recharts
│   ├── src/auth/            # sesión y permisos del cliente
│   ├── src/components/      # UI, búsqueda, selección, tablas y drawers
│   ├── src/lib/             # API, tipos y formato
│   └── src/pages/           # vistas cargadas bajo demanda
├── docs/                    # instalación, uso, API, seguridad, despliegue y pruebas
└── .github/workflows/ci.yml # typecheck, test, build y audit de ambos paquetes
```

## Requisitos

- Node.js 20 o superior (se validó localmente con Node v24.20.0 y npm 12.2.0).
- Neon PostgreSQL con una cadena `DATABASE_URL` válida.
- No se requieren credenciales de Google para operar: Drive está deshabilitado.

## Inicio local

1. Copia los ejemplos de entorno:

   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env.local
   ```

2. Edita `backend/.env` y define al menos `DATABASE_URL` y `FRONTEND_ORIGIN`.

3. Instala dependencias:

   ```bash
   cd backend && npm ci
   cd ../frontend && npm ci
   ```

4. **Sólo con autorización**, aplica migraciones y seed en la base destinada:

   ```bash
   cd backend
   npm run db:migrate
   npm run db:seed
   ```

   Estos comandos escriben en PostgreSQL. No ejecutes `db:push`, `DROP TABLE` ni `TRUNCATE`.

5. **Sólo con autorización**, crea el primer administrador inyectando credenciales por entorno:

   ```bash
   ADMIN_EMAIL=admin@institucion.edu.pe \
   ADMIN_PASSWORD='contraseña-larga-y-única' \
   ADMIN_FULL_NAME='Administrador TI' \
   npm run create:admin
   ```

   No existen usuarios ni contraseñas predeterminadas.

6. Inicia los servicios en dos terminales:

   ```bash
   cd backend && npm run dev     # http://localhost:3001
   cd frontend && npm run dev    # http://localhost:5173
   ```

   En desarrollo, Vite proxya `/api` hacia `VITE_API_PROXY_TARGET` (por defecto `http://localhost:3001`). El frontend no fija `localhost` en el código: usa una URL relativa salvo que definas `VITE_API_URL` para un despliegue con dominio separado.

## Verificación

```bash
cd backend && npm run typecheck && npm test && npm run eval:v4 && npm run build && npm audit
cd frontend && npm run typecheck && npm test && npm run build && npm audit
```

Resultados finales de esta rama: backend **61/61** pruebas, frontend **27/27** pruebas en 6 archivos, typecheck y builds correctos en ambos paquetes. `npm run eval:v4` evalúa 28 casos sintéticos enero–diciembre: V4 obtiene F1=1 en clasificación y asociación, con fidelidad de contextualización 1; V3 queda como línea base (F1=0.25 en clasificación). Vite genera chunks separados por vista, incluido `ClasificadorPage`; el aviso de chunk grande ya no aparece. El detalle está en [docs/TEST-REPORT.md](docs/TEST-REPORT.md) y [docs/CLASSIFIER-V4.md](docs/CLASSIFIER-V4.md).

## Documentación

- [Instalación y configuración](docs/INSTALLATION.md)
- [Guía de uso](docs/USER-GUIDE.md)
- [API REST](docs/API.md)
- [Clasificador V4](docs/CLASSIFIER-V4.md)
- [Seguridad](docs/SECURITY.md)
- [Despliegue](docs/DEPLOYMENT.md)
- [Informe de pruebas](docs/TEST-REPORT.md)
- [Estado de lanzamiento · 20 puntos](docs/RELEASE-STATUS.md)
- [Guía de demostración · 5 minutos](docs/DEMO-GUIDE.md)
- [Roadmap](docs/ROADMAP.md)

## Restricciones operativas

- Migraciones `0000`, `0001` y `0002` aplicadas en Neon y seed ejecutado; el administrador fue creado por el operador. `0003_material_swordsman.sql` (tablas del clasificador V4) está generada, es aditiva y **no se aplicó** ni se hicieron nuevas escrituras en esta corrección.
- No se usan datos reales en pruebas: los fixtures son sintéticos.
- No se realizó push, PR, merge ni despliegue; la rama de trabajo es `feat/smartdesk-final-release`.
- La descarga local de Excel siempre está disponible; `/api/drive/upload` responde `503` hasta que se habilite de forma explícita.
>>>>>>> Stashed changes
