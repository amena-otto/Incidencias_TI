# Clasificador V4 · detección, correlación y contextualización explicables

**Versión del motor:** `V4.0.0` · **Diccionario semilla:** `V4.0.0-seed` · **Perfil:** `TI_INSTITUCIONAL`  
**Estado:** implementado y verificado localmente. La persistencia real depende de aplicar la migración `0003` con autorización; hasta entonces el motor usa un diccionario semilla en memoria. V3 permanece intacto como línea base.

## 1. Objetivo y principios

V4 convierte conversaciones de WhatsApp en candidatos de incidencia con una decisión **explicable, verificable y reversible**, sin IA externa de pago ni servicios nuevos. Principios obligatorios:

1. **El mensaje original nunca se reescribe.** La normalización produce una vista canónica que sólo se usa para análisis; `originalMessage` conserva el texto, el remitente, la fecha y la hora tal como se importaron.
2. **Toda conclusión lleva evidencia.** Cada puntuación, vínculo y frase de contextualización se apoya en términos, mensajes o fechas identificables.
3. **No se inventa resolución.** «Ok», «voy», «ya quedó» sin autor verificable y tema compartido no bastan para dar un asunto por resuelto.
4. **El alcance no destruye el catálogo.** Los asuntos no TI se excluyen del flujo TI, pero sus categorías siguen existiendo y se muestran en revisión.
5. **La corrección humana manda.** Los cambios de categoría se registran como retroalimentación; nunca generan reglas globales de forma automática.
6. **El histórico no se reclasifica.** Cambiar de motor o revertir el diccionario afecta a las nuevas importaciones, no a incidencias ya confirmadas.

## 2. Arquitectura

```text
backend/src/classifier/
├── rules.ts              V3 intacto: línea base de comparación
├── context.ts            V3 intacto: correlación anterior
├── ti-scope.ts           V3 intacto: contrato de alcance compartido
└── v4/
    ├── types.ts          Contratos: Concept, DetectionResult, MessageLink, V4Decision…
    ├── normalize.ts      Vista canónica en español peruano; conserva el original
    ├── dictionary.ts     17 conceptos semilla sobre las 13 categorías canónicas
    ├── detector.ts       Puntuación ponderada, alternativas y explicación
    ├── scope.ts          Perfil TI_INSTITUCIONAL; inclusión/exclusión sin borrar categorías
    ├── conversation.ts   Correlación con autores, tema, ubicación, dispositivo y tiempo
    ├── contextualizer.ts Redacción con hechos, inferencias y evidencia
    ├── repository.ts     Neon con fallback en memoria; versiones y sugerencias
    ├── classifier.ts     Orquestación de reglas, alcance y modelo opcional
    ├── adapter.ts        Convierte V4 al Candidate[] de V3 para import-service
    ├── evaluation-dataset.ts  28 casos sintéticos enero–diciembre
    └── v4.test.ts        9 pruebas unitarias
```

El adaptador es el único punto de integración: devuelve el mismo `Candidate[]` que consume `import-service.ts`, por lo que no cambian el parser, la deduplicación, el preview con token opaco, la paginación, el historial, el dashboard ni los reportes Excel. `createImportPreview()` lee el flag `classifier_engine` y ejecuta V4 o V3. El texto original y la huella estable se calculan igual en ambos motores.

## 3. Fases implementadas

| Fase | Implementación | Resultado observable |
| --- | --- | --- |
| Diccionario dinámico | 17 conceptos persistentes en `classifier_concepts` (semilla mientras `0003` no se aplica) | Sinónimos, expresiones, variantes, abreviaturas, relacionados, negaciones, peso, prioridad, `active` y versión |
| Normalización española peruana | `normalize.ts`: plegado de acentos, emojis, typos (`interneet`, `wiffi`, `kaptop`, `markacion`), abreviaturas (`lab`, `xfa`, `prof`) y detección de aula/dispositivo | «No tengo interneeet en el aula 203» se analiza como `no tengo internet en el aula 203`; el original se conserva |
| Detección ponderada | Multiplicadores por tipo de término, ventanas de hasta 4 tokens, negación de capacidad, contexto con peso reducido y bonificación por mensajes vecinos | Categoría ganadora, alternativas con puntuación, confianza `alta`/`media`/`baja`, `ambiguous` y explicación con cada coincidencia |
| Perfil `TI_INSTITUCIONAL` | Categorías permitidas y condicionales configurables; marcación admisible sólo con atención TI verificable | `ti_detectada`, `atencion_ti`, `requiere_revision`, `fuera_alcance`, `no_pertinente`; los motivos se devuelven al preview |
| Correlación conversacional | Ventana temporal absoluta configurable (por defecto 90 min), etapas de conversación y umbrales por tipo de autor | Vínculos con `evidence[]`, `score`, `uncertain` y flags `topicEvidence`/`locationEvidence`/`authorEvidence` |
| Contextualización verificable | Hechos, inferencias explícitas, evidencia y validación de fecha/hora | Texto profesional sin afirmar resolución no probada; la contextualización del preview y del incidente es la misma |
| Retroalimentación y administración | `classifier_feedback`, `classifier_suggestions`, versiones y API con RBAC `config:write` + auditoría | Correcciones trazables; sugerencias pendientes de aprobación; `rulesActivated: false` al resolver |
| Interfaz ML local | `OptionalStatisticalClassifier` desacoplado y deshabilitado | Sin predicciones inventadas; si se activa, sólo agrega una alternativa sugerida que no sustituye a las reglas |
| Pruebas multi-mes | 28 casos sintéticos enero–diciembre, separados del seed y de los ejemplos de noviembre | `npm run eval:v4` escribe `backend/reports/v4-eval.json` |

## 4. Diccionario y normalización

Cada concepto pertenece a una de las 13 categorías canónicas y define:

- `synonyms`: equivalencias directas (peso ×0.7).
- `expressions`: frases completas (peso ×1).
- `variants` y `abbreviations`: deformaciones y abreviaturas (peso ×0.9).
- `related`: señales de apoyo (peso ×0.4) que también habilitan ventanas de contexto.
- `negatives`: términos que reducen —nunca eliminan— la puntuación de esa categoría.
- `weight` y `priority`: peso numérico y desempate de reglas concretas frente a genéricas.
- `active` y `version`: control de vigencia y trazabilidad.

La normalización elimina diacríticos, unifica `wi-fi`/`wi fi`/`wifi`, colapsa repeticiones de letras, mapea typos y extrae ubicación (`aula`, `salón`, `laboratorio`, `piso`) y dispositivo (`laptop`, `proyector`, `impresora`, etc.). No modifica nombres de docentes ni palabras almacenadas.

## 5. Detección y explicación

`detect()` recorre los conceptos activos y genera coincidencias con `kind`, `matchedTerm`, `position`, `weight`, `priority` y una cadena `evidence` legible. La puntuación de una categoría suma esas coincidencias; los términos puramente contextuales (`aula`, `clase`, `hojas`, `cursor`) se penalizan a ×0.15 para que no definan una categoría por sí solos. Las ventanas combinan dos términos relacionados cercanos y las negaciones de capacidad («no levanta», «no imprime») cuentan como evidencia del problema con un factor 0.85.

La categoría ganadora se ordena por puntuación, especificidad, prioridad y nombre. La confianza es `alta` si la diferencia con la segunda supera 2 y la puntuación es ≥5; `media` si la diferencia es ≥1 y la puntuación ≥3; en caso contrario `baja`. Se marca `ambiguous` cuando hay puntuaciones cercanas. La explicación incluye hasta tres alternativas y se guarda en `confidence_explanation` con el prefijo `[V4.0.0|V4.0.0-seed]`, que permite recuperar la versión que clasificó cada incidencia sin necesitar aún una columna dedicada.

## 6. Perfil TI_INSTITUCIONAL

Configuración por defecto:

```json
{
  "profile": "TI_INSTITUCIONAL",
  "allowedCategories": [
    "TI · Redes e Internet",
    "TI · Equipos audiovisuales",
    "TI · Hardware y periféricos",
    "TI · Software y plataformas",
    "TI · Impresoras"
  ],
  "conditionalCategories": ["Asistencia · Marcación y asistencia"],
  "excludeNonTiByDefault": true,
  "requireTiEvidenceForNonTi": true
}
```

Se puede ajustar con `PATCH /api/config` (`tiScope`). La marcación y los asuntos ajenos a TI se admiten como `atencion_ti` **sólo** cuando la correlación prueba atención de personal TI; si no, quedan en `requiere_revision` o `fuera_alcance`. Ninguna ruta elimina categorías del catálogo ni reclasifica incidencias confirmadas.

## 7. Correlación conversacional

`analyzeConversation()` examina los mensajes posteriores dentro de la ventana configurada y, hacia atrás, hasta tres mensajes de contexto. Un vínculo requiere diferencia temporal válida y al menos una señal verificable: autor reconocido como personal, mismo remitente, tema compartido, misma ubicación, mismo dispositivo o mención del reportante. La puntuación suma esas señales y la etapa detectada; el umbral es 5 para personal TI identificado, 7 para otro personal y 9 para terceros. Los mensajes débiles se marcan `uncertain` y se conservan como no vinculados si no alcanzan el umbral.

Etapas: `reporte`, `respuesta_ti`, `solicitud_ubicacion`, `desplazamiento`, `accion_tecnica`, `seguimiento`, `confirmacion_solucion` y `no_relacionado`. «Me acerco» es desplazamiento/atención, nunca resolución. Una respuesta fechada antes del reporte no se vincula. `suggestedStatus` es `resuelto` sólo con confirmación vinculada y autor verificable; si hay acción o seguimiento, `en_atencion`; en caso contrario `pendiente`. El estado sugerido siempre pasa por revisión humana en el preview.

## 8. Contextualización verificable

`contextualize()` produce cuatro capas:

- **Hechos:** el reporte original con autor y marca de tiempo; la acción o confirmación vinculada, cuando existe.
- **Inferencias:** se escriben explícitamente («la atención se infiere…», «no se infirió resolución…», «la ausencia de respuesta no significa…»).
- **Evidencia:** primero el mensaje reportado y después los mensajes vinculados, con `messageId`, `position`, `date` y `time`.
- **Verificación:** `verifiedDates` es falso si alguna fecha/hora es inválida o si el orden cronológico no puede demostrarse; en ese caso se añade una advertencia y no se afirma un orden.

El texto adjudica la acción a «personal TI» únicamente cuando el autor está en el directorio de personal TI; si no, dice «el remitente» y advierte que no se pudo confirmar su pertenencia.

## 9. Retroalimentación, administración y versionado

- Al confirmar una importación, `recordCategoryFeedback()` compara la categoría sugerida en el preview con la categoría enviada en el commit. Si cambió, registra texto original, hash, conceptos detectados, regla aplicada, revisor, fecha y las versiones de clasificador y diccionario extraídas del prefijo de la explicación. No crea ni activa reglas.
- `POST /api/classifier/suggestions/generate` agrupa correcciones repetidas (mínimo 3 iguales) y crea sugerencias `pendiente`. `PATCH /api/classifier/suggestions/:id` las aprueba o rechaza con notas y responde `rulesActivated: false`: el cambio debe hacerse de forma explícita desde el diccionario.
- Toda edición de un concepto captura una instantánea en `classifier_rule_versions`. `POST /api/classifier/versions/:version/revert` restaura una versión anterior generando una nueva versión; no sobrescribe silenciosamente ni toca incidencias ya guardadas.
- Las rutas administrativas están en `/api/classifier` y requieren sesión y `config:write`; cada mutación se escribe en `audit_logs`.
- La interfaz **Clasificador V4** (en `Configuración` → menú, sólo para `config:write`) permite cambiar el motor, buscar/editar conceptos, agregar sinónimos, revisar correcciones, generar y resolver sugerencias, y revertir versiones. Muestra explícitamente si la migración está pendiente.

## 10. Persistencia y migración pendiente

La migración `backend/drizzle/0003_material_swordsman.sql` está **generada y revisada, pero NO aplicada**. Crea cuatro tablas aditivas:

- `classifier_concepts` (índices por categoría y estado; FK a `profiles`).
- `classifier_feedback` (índices por fecha y revisor; FKs a `profiles` y `chat_imports`).
- `classifier_rule_versions` (FK a `profiles`).
- `classifier_suggestions` (índice por estado; FKs a `profiles`).

No contiene `DROP`, `TRUNCATE` ni `DELETE FROM`. Mientras no se autorice `npm run db:migrate`, `repository.ts` detecta la ausencia de tablas y usa `seedDictionary()` en memoria para conceptos, feedback, sugerencias y versiones; la interfaz lo indica con `storage: "memoria"` y `migrationPending: true`. **No se han hecho escrituras nuevas en Neon durante esta fase.**

## 11. Evaluación sintética

```bash
cd backend && npm run eval:v4
```

Dataset: 28 casos sintéticos, al menos dos por mes, con redacciones distintas del seed y sin depender de noviembre de 2026. Se comparan V4 y V3 en clasificación y correlación; se mide además fidelidad de la contextualización (términos exigidos y prohibidos). Resultado registrado en `backend/reports/v4-eval.json`:

| Métrica | V4 | V3 |
| --- | ---: | ---: |
| Clasificación: precisión / recall / F1 | 1 / 1 / **1** | 1 / 0.1429 / 0.25 |
| Asociación conversacional: precisión / recall / F1 | 1 / 1 / **1** | 0.8 / 0.8 / 0.8 |
| Fidelidad de contextualización | **1** | no aplica |

Estas cifras son evidencia del corpus sintético, **no una medición sobre datos institucionales reales**. Casos representativos: respuesta cruzando medianoche, «ok» aislado que no se vincula, respuesta anterior al reporte que no se asocia, marcación sin evidencia TI, typos y sinónimos coloquiales.

## 12. Modelo estadístico local: plan, no simulación

La interfaz `OptionalStatisticalClassifier` existe para un futuro modelo local entrenado con correcciones humanas ya aprobadas. Hoy `enabled: false` y `/api/config` publica `capabilities.localStatisticalModel: false`. Un modelo sólo podrá activarse cuando haya suficientes etiquetas humanas, con validación separada, versión propia y comparación contra V4; hasta entonces sus predicciones no existen. No se usa IA externa de pago ni se envían conversaciones fuera del servidor.

## 13. Límites y operación segura

- No ejecutar `npm run db:migrate`, `db:push`, seed ni reimportaciones sin autorización explícita.
- No borrar registros ni reclasificar históricos; el rollback es el flag `classifier_engine: "v3"`, no una migración destructiva.
- No hacer push, PR, merge ni despliegue sin autorización.
- No tocar autenticación, RBAC, catálogo de docentes, paginación, selección múltiple, historial, deduplicación, dashboard ni reportes Excel.
- Antes de aplicar `0003`, conviene previsualizar el DDL y confirmar que el esquema de Neon sigue en `0002`.

## 14. Verificación local de esta entrega

- Backend: `npm run typecheck`, `npm test` (61/61), `npm run eval:v4` y `npm run build` correctos.
- Frontend: `npm run typecheck`, `npm test` (27/27) y `npm run build` correctos; `ClasificadorPage` se genera como chunk independiente.
- Sin migraciones nuevas aplicadas y sin escrituras nuevas en Neon.
