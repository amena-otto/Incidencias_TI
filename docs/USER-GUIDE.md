# Guía de uso

La interfaz está organizada en ocho vistas. El menú sólo muestra las vistas permitidas para el rol de la sesión; el backend vuelve a verificar cada permiso en la API.

Todas las tablas usan los mismos controles: búsqueda propia por módulo, filtros, paginación de **5/10/20** (por defecto 10), selección con casilla individual y de cabecera, contador de seleccionados y confirmación antes de guardar. Los textos largos se recortan en la tabla y se abren completos en un panel lateral de detalle.

## 1. Inicio de sesión

1. Abre `http://localhost:5173` (o la URL desplegada).
2. Ingresa correo y contraseña nominativos.
3. El servidor crea una sesión opaca, devuelve permisos y un token CSRF, y establece la cookie `smartdesk_session` con `HttpOnly`, `SameSite=Strict` y `Secure` en producción.
4. Cierra sesión con el icono de salida: se elimina la fila de sesión en PostgreSQL y se expira la cookie.

No hay cuentas genéricas ni contraseñas por defecto.

## 2. Roles y permisos

| Permiso | `admin` | `tecnico` | `consulta` |
| --- | :---: | :---: | :---: |
| `import` | ✔ | ✔ | — |
| `incidents:read` | ✔ | ✔ | ✔ |
| `incidents:write` | ✔ | ✔ | — |
| `teachers:write` | ✔ | — | — |
| `categories:write` | ✔ | — | — |
| `reports:read` | ✔ | ✔ | ✔ |
| `users:write` | ✔ | — | — |
| `config:write` | ✔ | — | — |
| `history:read` | ✔ | ✔ | — |

Todas las vistas de consulta requieren sesión. Las acciones de escritura requieren además el permiso correspondiente.

## 3. Panel de indicadores

Muestra totales de incidencias, pendientes, en atención, resueltos, cerrados, descartados, docentes identificados, importaciones y tasa de resolución.

- **Tasa de resolución** = `(resueltos + cerrados) / total del periodo × 100`.
- Las series diaria, semanal y mensual se agrupan en `America/Lima`.
- Con un rango `desde`/`hasta`, se calcula comparación contra el periodo inmediatamente anterior.
- Los gráficos se cargan bajo demanda; la primera apertura de esta vista puede tardar unos instantes.

No se estiman tiempos de atención ni se inventan datos cuando no hay registros: los indicadores muestran cero real.

## 4. Importar conversación

Ruta: **Importar chat**.

### 4.1 Preparar el archivo

Se acepta un `.txt` de WhatsApp exportado desde Android, iOS o escritorio, o texto pegado directamente. El analizador reconoce:

- fechas con separadores `/`, `-` o `.` y años de dos o cuatro dígitos;
- reloj de 24 horas y formatos `a. m.`, `a.m.`, `am`, `pm`;
- mensajes multilínea;
- BOM UTF-8 y marcas de dirección del texto.

Los mensajes del sistema, eliminados y multimedia sin descripción se omiten. Las fechas imposibles se cuentan como `Fechas inválidas` y **no** se convierten silenciosamente.

Si varios grupos comparten mensajes idénticos, completa **Clave de conversación**. La clave se usa en la huella y se almacena como parte del hash, no como texto visible en la base.

### 4.2 Analizar

Pulsa **Analizar conversación**. El resumen muestra mensajes reconocidos, candidatos detectados, alta/media/baja confianza, respuestas correlacionadas, duplicados posibles y fechas inválidas, además del desglose del **perfil Incidencias TI**:

- incidencias TI detectadas y con atención de TI vinculada;
- candidatos que requieren revisión;
- mensajes fuera del alcance TI, no pertinentes y duplicados.

El clasificador aplica primero reglas concretas y después las genéricas. Solicitudes de mobiliario, limpieza, apertura de ambientes, marcación o salud se conservan como **excluidas revisables** con su motivo, pero no se seleccionan solas. Los casos mixtos mantienen el mensaje original y pasan a revisión humana. Un «me acerco» o «voy a revisar» se muestra como atención de TI, **nunca como incidencia resuelta**.

Esta etapa **no guarda nada** en `incidents`: crea una previsualización en memoria con token opaco y caducidad.

### 4.3 Revisar y corregir

La tabla de candidatos tiene una sola columna editable de **Docente**, tomada del catálogo institucional importado. El remitente original se ve en el detalle para trazabilidad y deduplicación; no hay una segunda columna editable de solicitante.

Para cada candidato puedes:

- marcar o desmarcar si se guardará;
- corregir docente, categoría y contextualización;
- ver el estado de inclusión, el motivo y los temas TI/ajenos detectados;
- abrir el detalle para revisar mensaje original, remitente, respuestas y su confianza;
- filtrar por estado, confianza, categoría y docente identificado;
- seleccionar la página actual o todos los filtrados, con cabecera indeterminada y contador;
- paginar de 5 en 5, 10 en 10 o 20 en 20 sin perder selecciones ni ediciones.

Las coincidencias de docente exactas o por alias configurado se enlazan automáticamente. Las aproximadas o ambiguas sólo se sugieren: **si no hay coincidencia segura, elige «Docente no identificado» y corrige manualmente**. No se inventan docentes.

### 4.4 Confirmar

Pulsa **Confirmar e importar**. El backend:

1. valida el token y que cada `candidateId` pertenezca a esa previsualización;
2. ignora cualquier categoría no presente en el catálogo activo;
3. ignora docentes que no existan en el catálogo;
4. guarda incidencia, mensaje original, mensajes de respuesta, historial y registro de importación en una transacción;
5. omite duplicados por huella de mensaje y bloquea la conversación repetida por hash de contenido.

El resultado indica registros guardados, duplicados omitidos y respuestas asociadas. Ningún mensaje se guarda sin esta confirmación explícita: antes de guardar se abre un panel que indica cuántas incidencias TI seleccionadas se persistirán. Los excluidos y no seleccionados quedan fuera.

## 5. Incidencias

Ruta: **Incidencias**.

- Filtros: texto, rango de fechas, estado, tipo, categoría, docente y responsable.
- Paginación de 5/10/20 registros por página, por defecto 10; al cambiar un filtro se vuelve a una página válida.
- La tabla muestra fecha, **Docente**, problema detectado, categoría y estado; las acciones están visibles y no hay scroll horizontal en escritorio.
- Al abrir un registro se muestran mensaje original, contexto, respuestas e historial de cambios.

### 5.1 Cambiar estado

Transiciones permitidas:

```text
pendiente   → en_atencion | resuelto | descartado
en_atencion → pendiente | resuelto | cerrado | descartado
resuelto    → en_atencion | cerrado
cerrado     → (sin transiciones)
descartado  → pendiente
```

Para marcar **resuelto** se requiere una solución de al menos 5 caracteres. Todo cambio queda en el historial con actor, valores anteriores y nuevos.

### 5.2 Asignar y responder

- **Responsable:** selecciona un usuario activo desde el detalle.
- **Respuesta:** registra texto de al menos 2 caracteres y tipo `respuesta`, `seguimiento` o `confirmacion`.
- Las respuestas nuevas quedan marcadas como personal TI y se añaden al historial.

El rol `consulta` puede leer pero no modificar ni responder.

## 6. Docentes

Ruta: **Docentes**.

- Buscar y listar docentes activos/inactivos con paginación 5/10/20 y detalle lateral.
- Registrar docente con nombre, correo opcional y alias inicial opcional.
- Agregar alias para reconocer variantes usadas en WhatsApp.
- Activar o desactivar docentes.
- Descargar plantilla `.xlsx`, previsualizar con búsqueda, paginación local, selección de filas válidas y confirmación antes de importar.
- Exportar el catálogo, incluidos alias y estado.
- Probar coincidencia de un nombre antes de importar.

Columnas de la plantilla: `Nombres`, `Apellidos`, `Nombre completo`, `Correo institucional`, `Código de docente`, `Alias`. Se requiere `Nombre completo` o `Nombres` + `Apellidos`. Las filas con errores o duplicados internos no se pueden importar.

**Regla de seguridad:** una coincidencia aproximada nunca se enlaza automáticamente.

## 7. Categorías

Ruta: **Categorías**. Muestra el catálogo canónico persistido en PostgreSQL, con búsqueda, paginación 5/10/20 y detalle lateral. El administrador puede crear categorías o activar/desactivar las existentes.

El frontend no contiene categorías hardcodeadas: las opciones de importación, filtros y reportes provienen de `/api/categories`. El clasificador ignora etiquetas que no estén en el catálogo activo.

## 8. Reportes

Ruta: **Reportes**.

1. Selecciona rango `desde`/`hasta` y filtros opcionales de estado, tipo, categoría y docente.
2. Revisa la vista previa paginada con los mismos filtros (5/10/20, por defecto 10).
3. Pulsa **Descargar Excel**.
4. El archivo se genera en el servidor con datos reales y la descarga se registra en auditoría.

Hojas incluidas:

| Hoja | Contenido |
| --- | --- |
| `Dashboard` | Indicadores, tasa de resolución y barras visuales por categoría |
| `Incidencias` | Detalle filtrado con estado, responsable, solución y contexto |
| `Resumen` | Totales y participación por categoría y estado, con fórmulas |
| `Importaciones` | Origen, fecha, mensajes, guardados y duplicados del periodo |

ExcelJS genera tablas y barras con caracteres; **no gráficos nativos de Excel**. No se muestran cifras estimadas.

### Google Drive

La tarjeta **Google Drive (opcional)** muestra el estado real. En esta versión `enabled: false` y el botón está deshabilitado. `/api/drive/upload` devuelve `503`: no se simula una subida exitosa. La descarga local siempre funciona.

## 9. Usuarios

Ruta: **Usuarios**, sólo para administradores.

- Buscar usuarios por nombre o correo y paginar 5/10/20 con detalle lateral.
- Crear usuario con nombre, correo, contraseña de al menos 12 caracteres y rol.
- Cambiar rol o estado activo.
- Restablecer contraseña.
- La tabla indica si existe hash, pero nunca muestra contraseñas.

Comparte contraseñas iniciales por un canal seguro y solicita cambio en primer uso.

## 10. Configuración

Ruta: **Configuración**.

- Zona horaria fija `America/Lima`.
- Ventana de contexto (5–10080 minutos), editable por administradores.
- Tamaño máximo de carga y entorno, leídos del backend.
- Salud de PostgreSQL con latencia real; `503` cuando no responde.
- Capacidades activas y motivo por el que Drive está deshabilitado.
- Notas operativas sobre migraciones, administrador, importaciones y reportes.

La interfaz no duplica reglas de negocio: todo proviene de `/api/config`, `/api/health` y `/api/drive/status`.

## 11. Buenas prácticas

- Revisa siempre la previsualización antes de confirmar; la confianza baja no significa error, sino revisión humana necesaria.
- No importes conversaciones reales en entornos de prueba.
- Usa correos institucionales nominales y desactiva cuentas de personas que ya no operen.
- Descarga reportes sólo con fines institucionales; cada descarga queda auditada.
- Si aparece un duplicado posible, verifica el registro existente antes de guardar.
- Ante un error `403` o `429`, espera o contacta al administrador; no intentes eludir los controles.
