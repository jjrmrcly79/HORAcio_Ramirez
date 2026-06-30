# Horacio V2 — Propuesta: arreglar el pareo SMT↔PTH (1:N)
> 2026-06-29 · Basada en hallazgos de la sesión con Nayeli (Planeación).
> Fuente: `Horacio-V2 - Hallazgos Pareo SMT-PTH y Descarga Semiterminado (2026-06-29).md`.

## 1. La causa raíz (en una frase)
V2 liga el subensamble SMT con su producto final **asumiendo que son partidas (`-01/-02/-03`)
del mismo `orden_base` y en relación 1:1**. En planta el SMT es **otra parte/OT**, un SMT
alimenta **muchos** finales (**1:N**), y el export de OTs en proceso **no trae el sufijo `-SMT`**
que la normalización necesita. Por eso el plan no cuadra **y** se cuelan estándares de SMT a
piezas de PTH (caso `9519-G29`: su SMT real es `Focaris Control F-SMT` @60/hr, no @44).

## 2. Qué cambia (modelo)
Sustituir la **inferencia por `orden_base`/partida** por un **catálogo explícito de parejas**.

### P1 — Catálogo `pareo_smt` (1:N) + marca del lado SMT  *(desbloquea pareo y meta)*
- Tabla `horacio.pareo_smt(parte_final, parte_smt, fuente, vigente)` — la llena Nayeli.
- `partes.es_subensamble_smt boolean` — marcar las partes que son SMT (no por sufijo, que el export no trae).
- `v_ot_parte`: si la OT no tiene estándar propio, resolver su SMT **vía `pareo_smt`** (no por hermano `-01`).
- **Efecto inmediato:** desaparece la contaminación de estándares SMT en piezas de PTH
  (sustituye al parche de borrar `PP_481/PP_411_481` a mano por parte).

### P1 — Ingest filtrado a "en proceso"  *(calidad del dato de entrada)*
- `ordenes_trabajo.estatus_origen` + al cargar `WHERE estatus_origen ILIKE '%proceso%'`.
- Vista `v_ot_cerrar` = "proceso" con `cant_terminada >= cant_ordenada` (candidatas a cierre).
- Mata el ruido de las ~1,854 tarjetas "abiertas" (sucias) y las 447 con todos los estatus.

### P2 — WIP a nivel parte-SMT (1:N), reemplazo de `v_vibora_ot`  *(exactitud del WIP)*
- `v_wip_smt`: `Σ terminado del SMT − Σ consumido por todos sus finales` (agregado por `parte_smt`).
- **Separar buffer de atoro:** `smt_term − consumo` incluye el **stock de seguridad SMT**
  (decisión de Nayeli, semiterminado en burbuja, inventariado por Brenda en Excel). Añadir
  `pareo_smt.buffer_objetivo` (o tabla `stock_seguridad_smt`) cuando llegue ese dato; mientras,
  **no pintar todo el delta como problema** (etiquetarlo "WIP+buffer").

### P2 — Bandera de semiterminado no descargado  *(dato no confiable)*
- La descarga de semiterminado a la OT es **manual y sin dueño**; si se cierra sin descargar,
  se pierde trazabilidad. Marcar en `v_ot_inconsistencias` las OT SMT con avance de PT pero sin
  descarga → su `cant_terminada` no es confiable para el WIP.

### P3 — Inventario de scrap / análisis de falla  *(fuera de alcance V2, pero bloquea cierre limpio)*
- No existe hoy. Sin él no se puede cerrar OT con certeza ni calcular WIP neto. Candidato a SN-03.

## 3. Secuencia e insumos que destraban
| Paso | Necesita | Dueño | Estado |
|---|---|---|---|
| `pareo_smt` (P1) | Tabla de parejas SMT↔PTH | Nayeli | prometida |
| Ingest "en proceso" (P1) | Export limpio de OTs en proceso | Pamela/Nayeli | prometido |
| Estándar SMT real (P1/P2) | Std SMT por NP (ej. grupo 29 = 60/hr) | Gabriela (Manuf.) | por solicitar |
| Separar buffer (P2) | Stock de seguridad SMT | Brenda/Producción | por solicitar |
| Cierre limpio (P3) | Inventario scrap/falla | Calidad | no existe |

## 4. Qué se puede hacer YA (sin esperar insumos)
1. **Crear el esqueleto P1** vacío: tabla `pareo_smt` + columnas `es_subensamble_smt`/`estatus_origen`
   (inertes hasta cargar datos; no rompen nada — patrón "V2 read-only").
2. **Tab "Pareo" en el panel V2**: capturar/editar parejas a mano (semilla con los 4 ejemplos de
   Nayeli: Andromeda-SMT, Focaris/Control F-SMT, Sensor de Velocidad-SMT, Centauro-SMT) → así
   Nayeli (o Marco) lo llena en pantalla en vez de Excel.
3. **Limpiar la contaminación actual** de estándares SMT en piezas de PTH (parche puente,
   reemplazado por `v_ot_parte`-por-catálogo cuando P1 esté completo).

## 5. Riesgo de sostenimiento (#riesgo-sustain)
La descarga de semiterminado y la depuración de OTs **no tienen dueño**. Cualquier mejora de
trazabilidad que no fije **dueño + indicador en tablero** se cae. Proponer a Marco/Producción
asignar dueño + MOT como parte del Sprint 1.
