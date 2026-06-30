# Horacio V1.5 — Propuesta de build (Captura de meta in-app + Sugerencia desde estándar)
> 2026-06-29 · Revisión de la nota "Horacio - Evolución V1 (Captura de Meta y Estándar)" + aterrizaje al código real.
> Surface: panel V1 con login por PIN (`horacio-panel`, workflow `4sJAO9urzrgQowJB`). NO toca V2.

## 0. Veredicto de la revisión
La nota está bien razonada y la secuencia manual → sugerido → automático es correcta.
**El ajuste grande tras revisar el código:** V1.5-B **no es trabajo nuevo de datos** — el motor
ya existe en V2. Esto baja el esfuerzo de "medio" a "bajo-medio".

| Lo que la nota asume | Lo que confirma el código |
|---|---|
| "Subir el estándar a V1" (V1.5-B) | Ya está: `horacio.estandar_proceso` **1,072 estándares**, `linea_proceso` **37 líneas mapeadas**, función `meta_sugerida(parte, proceso)` (sql/026). Solo falta **surfacearlo** en el panel V1. |
| "Agregar campo de meta en el panel" (V1.5-A) | Genuinamente nuevo: el panel **no** escribe `ordenes_tablero` hoy (solo la lee al registrar la hora). |
| "Misma fuente de verdad" | Confirmado: `/orden` escribe `ordenes_tablero` (`UPDATE vigente=false` + `INSERT`). El panel debe **replicar ese mismo patrón**. |
| Prorrateo con 55 min/turno no productivo | Ya modelado: `calendario_config` (sql/035) tiene turno + liberación + comida → **reusar esa config**, no crear otra. |

## 1. V1.5-A — Fijar la meta desde el panel (lo que Juan se comprometió HOY)
**Qué:** nueva acción `set_meta` en el panel + UI (input meta/hr + OT por tablero del día).

**Cómo (replica exacta de `/orden`, misma tabla):**
```sql
-- al guardar meta de un tablero:
UPDATE horacio.ordenes_tablero SET vigente=false
  WHERE linea_id=$lid AND fecha=(now() AT TIME ZONE 'America/Mexico_City')::date AND vigente;
INSERT INTO horacio.ordenes_tablero(linea_id,fecha,orden,modelo,meta_hr,vigente,set_by_chat)
  VALUES($lid, today_mx, $orden, $modelo, $meta, true, NULL);   -- set_by_chat NULL = vía panel
```
- **Gobierno:** solo `es_admin` (Marco/Gaby ya admin). PIN ya existe en el panel (login por PIN) → reusar.
- **Trazabilidad:** añadir a `ordenes_tablero` columnas `set_by_panel text` (quién, por nombre) y `origen text` (`telegram`/`panel`), análogas al `origen`/`capturado_por` que ya usa `hora_por_hora`.
- **Esfuerzo:** bajo. **Desbloquea a Marco hoy.** Telegram `/orden` sigue como respaldo.

## 2. V1.5-B — Sugerir la meta desde el estándar (humano en el lazo)
**Qué:** en la misma UI de meta, mostrar **"Meta sugerida: N/hr"** junto al campo editable.

**Motor (ya existe, solo conectar):**
1. Tablero → proceso vía `linea_proceso` (37 mapeadas).
2. OT → `numero_parte` vía `v_ot_meta`/`ordenes_trabajo` (si la OT está en el export).
3. `meta_sugerida(numero_parte, proceso)` → pz/hr del estándar.
4. **Prorrateo con `calendario_config`:** `sugerida = std_pzhr × (min_productivos_ventana / 60)`.
5. **Acotar por la OT:** `meta = min(sugerida, pendiente_de_la_OT)`.

**UX (acordada en HV1-ONB):**
- Acepta → queda. Ajusta → **PIN + 5-porqués** (motivo obligatorio) + bandera "a validar".
- Bandera visual cuando lo capturado choca con el estándar (ej. 170 vs 106).

**Crux técnico (el único diseño real):** la sugerencia solo aplica si la OT existe en el export
(`ordenes_trabajo`). Para OT de texto libre → **fallback a manual** (V1.5-A). Es degradación limpia,
no bloqueo.

**Esfuerzo:** bajo-medio (motor reutilizado). Cada vez que Gaby acepta/corrige, **depura el estándar para V2**.

## 3. Cómo conviven (un solo `plan`, tres puertas)
| Modo | Escribe | Puerta | Estado |
|---|---|---|---|
| Manual | `ordenes_tablero` | `/orden` (Telegram) **+ panel (nuevo)** | A = hoy |
| Sugerido | `ordenes_tablero` | panel (estándar propone, humano confirma) | B = próxima |
| Automático | (lo calcula V2 read-only) | programa oficial | V2 en construcción |

Los tres terminan en `ordenes_tablero` → `plan` del HxH. **Interruptor por tablero** para migrar
gradual; arrancar la sugerencia en los **≤3 tableros del cuello** (alineado con la reducción de
tableros a 25 ya hecha y el set-al-cuello de la sesión con Marco).

## 4. Plan incremental
| Paso | Entrega | Esfuerzo | Dep. |
|---|---|---|---|
| 1 | `set_meta` en panel (manual) + columnas `origen`/`set_by_panel` en `ordenes_tablero` | Bajo (hoy) | — |
| 2 | Reusar PIN admin para gatear la meta | Bajo | 1 |
| 3 | Sugerencia (linea_proceso × meta_sugerida × calendario_config, acotada por OT) | Bajo-medio | estándar (ya) |
| 4 | 5-porqués + banderas de inconsistencia | Medio | 3 |
| 5 | Migración tablero-por-tablero, medir llenado | continuo | 1–4 |

## 5. Decisiones que necesito de ti / Gaby (gates)
1. **Base del estándar 85% vs 100%:** ¿`Std_Actual` ya trae eficiencia o es teórico? Define si la
   sugerida es "ideal" o "realista". (Único pendiente de dato real.)
2. **Prorrateo:** ¿uso `calendario_config` (liberación + comida) como fuente del t_productivo, o
   un % plano (ej. 55 min/turno)? Recomiendo `calendario_config` (ya editable, una sola verdad).
3. **PIN de meta:** ¿meta la mueven Marco+Gaby y el estándar solo Gaby? (como dice la nota).
4. **Validar Wave Solder** (venía "pendiente validar" en el estándar).

## 6. Riesgo de sostenibilidad
- Estándar sin base definida → sugerencia mala → se pierde confianza. *Mitigar:* arrancar solo en
  cuello con estándar claro + marcar provisional vs validado (cuarentena VSM).
- Meta editable sin control → repite el "a ojo". *Mitigar:* PIN + 5-porqués + registro de quién mueve.
- **No hay doble build:** misma BD (`horacio.*`), mismo `ordenes_tablero`, mismo `calendario_config`,
  mismo `meta_sugerida` que V2. V1.5-B **es** la antesala de V2.
