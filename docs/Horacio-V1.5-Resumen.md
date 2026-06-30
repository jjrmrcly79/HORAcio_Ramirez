# Horacio V1.5 — Resumen (qué es y qué quedó vivo)
> 2026-06-29 · Puente entre Horacio V1 (en producción) y V2 (meta automática, en construcción).

## Qué es V1.5
**El banco de pruebas instrumentado que de-riesga V2.** No saltamos a la meta 100% automática:
primero ponemos a la gente en el lazo (sugerir → confirmar/ajustar) y cada decisión deja un dato
que le dice a V2 dónde el estándar es confiable y dónde no. La "rana": subir gradual, no de golpe.

## Qué quedó vivo (panel V1 · `…/horacio-panel`)
1. **Metas del día** — Marco/Gaby/Jessica fijan la meta/hr por tablero **desde el panel** (ya no
   solo por `/orden` en Telegram). Escribe la **misma** `ordenes_tablero` que el bot.
2. **Meta sugerida** — al elegir la OT, el panel propone la meta = **estándar (teórico) × prorrateo**
   (tiempo productivo de `calendario_config`), acotada por lo que falta de la OT. Ajustar pide **motivo**.
3. **OT desde el sistema** — la OT ya no se teclea: se **elige** del export "en proceso" (48 OT
   vigentes cargadas con `import_ot_proceso.py`), filtrada por área del tablero.
4. **Estándar capturable en V1** — tab para que **Gaby** llene/corrija el estándar por estación,
   sin ver V2. Prioriza las partes de OT en proceso que aún no tienen estándar.
5. **Paros vivos** — tablero con **cronómetro que corre solo** + a quién se escaló.

## Gobierno (quién puede)
- **Meta:** Marco, Gaby, Jessica (`personas.puede_meta`) + admins.
- **Estándar:** solo Gaby (`personas.puede_estandar`) + admins.
- Una sola fuente de verdad: todo termina en `ordenes_tablero` / `estandar_proceso`.

## El loop V1.5 → V2 (por qué esto alimenta al nuevo Horacio)
| Señal de V1.5 | Dónde vive | Qué decide en V2 |
|---|---|---|
| Meta sugerida vs capturada + motivo | `ordenes_tablero` (`meta_sugerida`, `meta_motivo`, `origen`) | Cuándo graduar un tablero a automático (sugerida≈capturada N veces) |
| Estándares faltantes / corregidos | `estandar_proceso` (y la lista priorizada) | El gap que V2 debe cerrar antes de automatizar |
| Calidad del export de OT | `ordenes_trabajo` (status, `_SMT`, fechas) | Qué debe tragar el ingest de V2; confirma pareo 1:N |
| Acuse/tiempo de paros (con C) | `paros` (propuesto) | Lógica de andon/escalamiento de V2 |
| Tasa de llenado | `hora_por_hora` | Si bajar fricción mejora adopción (valida UX de V2) |

## Pendientes que esto destapó
- **Alta de Gaby** en `personas` + PIN (para que capture estándar/meta).
- **Escalamiento robusto (C)** — propuesta pendiente de Vibe Check (acuse + nag + escalera).
- **Pareo SMT↔PTH 1:N** — parqueado; debe venir del **BOM del sistema** (Advanta), no de un Excel.
- **Estándares SMT contaminados** en piezas de PTH (limpiar) · **fechas sucias** del ERP.

## Docs hermanos
- `Horacio-V1.5-Propuesta-Captura-y-Sugerencia-Meta.md` (diseño detallado)
- `Horacio-Propuesta-Escalamiento-Robusto.md` (C)
- `Horacio-V2-Propuesta-Pareo-SMT-PTH.md` (pareo)
- `Horacio-V1-Onboarding-Marco.md` · `Horacio-Panel-Manual-Usuario.md`
