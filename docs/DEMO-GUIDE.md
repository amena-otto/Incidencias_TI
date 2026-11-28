# Guía de demostración · 5 minutos

Guion para presentar TI SmartDesk con **datos sintéticos**. No uses conversaciones ni credenciales institucionales reales. Las credenciales del administrador las introduce el operador; no hay cuentas ni contraseñas públicas.

**Requisitos previos (fuera del cronómetro):**

1. Base autorizada con `0001` y `0002` aplicadas y `npm run db:seed` ejecutado.
2. Primer administrador creado con `npm run create:admin` y variables inyectadas por el operador.
3. Backend en `http://localhost:3001` y frontend en `http://localhost:5173`.
4. Opcional para enriquecer la demo: crear el docente sintético **Ana Pérez** con alias `Ana` en **Docentes**, y registrar **Personal TI** como usuario o en el directorio de personal para que las respuestas se reconozcan como personal TI. Sin esto, la solución explícita todavía se detecta por el texto.

| Tiempo | Acción | Qué mostrar |
| --- | --- | --- |
| 0:00–0:30 | Abrir **Configuración** y `GET /api/health` | PostgreSQL en verde con latencia real, zona horaria `America/Lima`, `Drive: enabled=false`. Estado real, no simulado. |
| 0:30–1:15 | Iniciar sesión con el administrador creado | Menú según rol, `GET /api/auth/me` con permisos y `csrfToken`, cookie `HttpOnly`. Sin cuentas genéricas. |
| 1:15–2:15 | **Importar chat** → pegar el TXT siguiente → **Analizar conversación** | Formato Android, mensajes reconocidos, candidatos TI, confianza, respuestas correlacionadas y motivos de exclusión. La previsualización **no escribe en la base**. |
| 2:15–3:00 | Abrir el detalle del candidato del proyector | Mensaje original, remitente de trazabilidad, regla concreta, seguimiento y confirmación. «Voy a verificar» es atención, no resolución; la confirmación explícita sí permite estado sugerido `resuelto`. |
| 3:00–3:30 | **Confirmar e importar** | Registros guardados, respuestas asociadas, token opaco consumido; el servidor reconstruye los datos. |
| 3:30–4:15 | **Incidencias** → filtrar por categoría → abrir → cambiar estado | `pendiente → en_atencion → resuelto` con solución de al menos 5 caracteres; historial con actor y cambios. |
| 4:15–4:45 | **Dashboard** y **Reportes** → descargar Excel | Indicadores reales y archivo `.xlsx` con cuatro hojas. La tarjeta de Drive sigue deshabilitada; la descarga directa funciona igual. |
| 4:45–5:00 | Recargar listado y volver a importar el mismo TXT → **Cerrar sesión** | Persistencia en Neon, prevención de duplicados por huella/hash y sesión eliminada al salir. |

## Conversación sintética

Pegar exactamente este contenido en el cuadro de texto de **Importar chat**:

```text
[26/11/26, 10:00:05] Ana Pérez: No funciona el proyector del aula 3
[26/11/26, 10:02:10] Personal TI: Voy a verificar el proyector del aula 3
[26/11/26, 10:05:30] Personal TI: Ya se solucionó el proyector del aula 3
[26/11/26, 10:07:00] Ana Pérez: Gracias por reportar
[26/11/26, 10:09:00] Sistema: Ana Pérez cambió el asunto del grupo a "Aula 3"
[26/11/26, 10:11:00] Docente Prueba: No hay corriente en el tomacorriente del laboratorio
[26/11/26, 10:13:00] Personal TI: Se coordinará la revisión del tomacorriente
[26/11/26, 10:15:00] Docente Prueba: Faltan sillas en el aula
[26/11/26, 10:17:00] Docente Prueba: No funciona el proyector y faltan sillas en el aula
```

Resultado esperado del análisis con el **perfil Incidencias TI**:

- 9 mensajes reconocidos; 0 fechas inválidas.
- **Proyector**: incidencia TI detectada, alta confianza, seleccionada. Muestra dos respuestas correlacionadas (`seguimiento` y `confirmacion`) y estado sugerido `resuelto` por la frase explícita «Ya se solucionó». Si se registró `Ana Pérez` con alias `Ana`, queda enlazada como único Docente.
- **Caso mixto** «No funciona el proyector y faltan sillas»: se conserva el mensaje completo, se marca `requiere_revision` y **no se selecciona automáticamente**.
- **Sillas**: excluido con motivo «Fuera del alcance TI: Mobiliario y materiales». Revisable en la sección de excluidos, sin casilla de selección.
- **Tomacorriente**: asunto no TI; aparece como fuera de alcance o, si el seguimiento de `Personal TI` quedó correlacionado, como `atencion_ti`. En ningún caso se presenta como incidencia resuelta por «se coordinará la revisión».
- Sistema, agradecimiento y respuestas sin solicitud propia figuran como no pertinentes, con su motivo.
- La tabla sólo tiene una columna **Docente**; el remitente original se muestra en el panel de detalle.

## Puntos de seguridad para comentar

- Ningún mensaje se guarda sin confirmación explícita; el preview vive en memoria con token opaco y caducidad.
- El commit valida categorías y docentes contra el servidor; no acepta totales ni hashes enviados por el cliente. Guarda `requestType` y `categoryId` derivados en servidor.
- La coincidencia aproximada de docente no se enlaza sola; el remitente original se conserva para trazabilidad, sin segunda columna editable.
- «Me acerco», «voy a verificar» y «se coordinará» son atención de TI, no resolución; sólo una confirmación explícita permite dar por resuelto.
- Duplicados: se omiten por huella de mensaje y se bloquea la conversación repetida por hash de contenido.
- RBAC: `consulta` lee pero no escribe; `tecnico` importa y gestiona; `admin` además administra usuarios, categorías y configuración.
- Drive es complementario: `/api/drive/status` devuelve `enabled=false` y `/api/drive/upload` responde `503`. La descarga de Excel no depende de OAuth.

## Si algo no sale como lo previsto

| Síntoma | Acción en la demo |
| --- | --- |
| `/api/health` en rojo | No simular éxito: revisar `DATABASE_URL`, SSL y red. Mostrar el estado real. |
| `403` con "Falta el token CSRF válido" | Recargar la página para renovar `/api/auth/me` y reintentar la mutación. |
| `429 RATE_LIMITED` | Son demasiados intentos fallidos; esperar 15 minutos. Un login correcto libera el contador, así que no reintentar con la contraseña correcta tras corregir el origen del error. |
| Tablas o columnas nuevas ausentes | Detener la demo: faltan `0001`/`0002`. No improvisar DDL ni usar `db:push`. |
| Drive preguntado por credenciales OAuth | Mostrar que está deshabilitado a propósito y continuar con la descarga local. |

El detalle de la validación está en [TEST-REPORT.md](TEST-REPORT.md) y el estado punto por punto en [RELEASE-STATUS.md](RELEASE-STATUS.md).
