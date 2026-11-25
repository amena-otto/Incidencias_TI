# TI SmartDesk — Clasificador V2

Este paquete contiene reemplazos puntuales para la V1:

- `backend/src/importer/whatsapp.ts`: parser compatible con los dos formatos de exportación de WhatsApp y conservación correcta de mensajes multilínea.
- `backend/src/classifier/rules.ts`: clasificación por categorías separadas, exclusión de mensajes de respuesta/comunicados y contextualización basada en respuestas explícitas.
- `frontend/src/App.tsx`: selector actualizado con las categorías V2 y etiquetas de confianza.

## Aplicación local

1. Haz una copia de seguridad de esos tres archivos en tu repositorio local.
2. Reemplaza los archivos manteniendo exactamente las rutas indicadas.
3. En `backend`, ejecuta `npm run dev`.
4. En `frontend`, ejecuta `npm run dev`.
5. Importa `noviembre(1).txt` y revisa los candidatos. No confirmes la importación de prueba en Neon si estás usando tu base real.

## Límites conocidos de esta iteración

- La identificación de docentes sigue usando el nombre del remitente; todavía falta el catálogo Excel y la normalización de alias.
- La correlación de respuestas es heurística y debe revisarse manualmente.
- Las solicitudes de apoyo sin detalle se etiquetan con confianza baja; los mensajes que contienen solo multimedia no se inventan ni se clasifican automáticamente.
- La exportación de noviembre termina el 24/11/2026; no representa el mes completo.

## Prueba automatizada

En `backend`, ejecuta `npm run test:classifier` para verificar parser, clasificación de Internet, regularización de salida y exclusión de una respuesta.
