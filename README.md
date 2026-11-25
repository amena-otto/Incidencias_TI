# TI SmartDesk v1
Registro y análisis de incidencias provenientes de conversaciones de WhatsApp.
Stack: React + TypeScript + Vite, Node.js + Express, Neon PostgreSQL, Drizzle ORM, ExcelJS.

## Inicio
1. Requiere Node.js 20+ y una base Neon PostgreSQL.
2. Copia `backend/.env.example` a `backend/.env` y configura `DATABASE_URL`.
3. `cd backend && npm install && npm run db:generate && npm run db:migrate && npm run db:seed && npm run dev`
4. En otra terminal: `cd frontend && npm install && npm run dev`
5. Frontend http://localhost:5173; API http://localhost:3001/api.

Importación de TXT/texto pegado con revisión obligatoria. Clasificación por reglas, sin IA. La exportación Excel inicial genera hoja Incidencias y Resumen. OAuth Drive se integra en la siguiente etapa; no se guardan credenciales de Google en frontend.
