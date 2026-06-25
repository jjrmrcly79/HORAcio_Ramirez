# Horacio V2 — De dónde sale cada dato y cómo se lee

> Guía de presentación · esquema BD `horacio` (Supabase self-hosted)
> Versión: 2026-06-24 · Cubre migraciones 025–032 (Fase 2 y Fase 3 V2)

Este documento explica, tabla por tabla, **de dónde viene la información**,
**qué guarda** y **cómo se interpreta**. Está pensado para presentar Horacio V2
a Dirección: primero las 4 fuentes de verdad, luego las tablas, y al final las
vistas que convierten todo eso en las pantallas del panel V2.

---

## 1. Las 4 fuentes de verdad (de dónde nace TODO)

Horacio V2 no inventa datos: cruza cuatro orígenes que ya existen en la planta.

| # | Fuente | Quién la genera | Cómo entra a la BD | Tabla destino |
|---|--------|-----------------|--------------------|---------------|
| 1 | **Estándar x Hora** (Excel matriz ancha) | Ingeniería Mapartel | Carga única normalizada (`import_estandar_ot.py`) | `partes` + `estandar_proceso` |
| 2 | **OT en proceso** (órdenes de trabajo) | Sistema ERP / Producción | Snapshot diario (`fecha_snapshot`) | `ordenes_trabajo` |
| 3 | **Hora x Hora real** | Las líderes, por Telegram (el bot Horacio) | Bot n8n → append-only | `hora_por_hora` |
| 4 | **Meta del día por tablero** | Daniel / supervisión, comando `/orden` | Bot n8n | `ordenes_tablero` |

**Idea central de V2:** antes, la meta por hora la **tecleaba Daniel** (fuente 4).
V2 propone esa meta **automáticamente** cruzando el estándar (fuente 1) con la OT
que corre (fuente 2). Daniel deja de adivinar; el sistema sugiere y él valida.

> ⚠️ Todo V2 es **SOLO LECTURA** sobre el flujo de Daniel. Las vistas nuevas
> NO escriben en `ordenes_tablero` ni cambian lo que el bot ya hace. La única
> escritura nueva (Fase 3) es el motivo por el que una OT no corre, y va a una
> columna aparte en `ordenes_trabajo`.

---

## 2. Tablas fuente

### 2.1 `partes` — catálogo de tarjetas
**De dónde sale:** del Excel "Estándar x Hora", columna de N.Parte.
Es el catálogo maestro de qué tableros/tarjetas se fabrican.

| Columna | Qué es |
|---------|--------|
| `numero_parte` | Clave normalizada: MAYÚSCULAS, sin el sufijo `_SMT` |
| `no_parte_ensamble` | Variante de ensamble (`N/A` si no aplica) |
| `numero_parte_raw` | El texto original tal cual venía en el Excel |
| `cliente`, `familia_modelo`, `descripcion` | Datos descriptivos de la tarjeta |

**Cómo se lee:** una fila = una parte única. La clave real es la pareja
`(numero_parte, no_parte_ensamble)`. Es el "diccionario" contra el que se cruzan
las OT y los estándares.

---

### 2.2 `estandar_proceso` — el estándar por hora normalizado
**De dónde sale:** del mismo Excel, pero **desdoblado**. El Excel traía 68
columnas en una sola fila (una matriz); aquí se convierte en **1 fila por
(parte × estación)**.

| Columna | Qué es |
|---------|--------|
| `parte_id` | A qué parte pertenece (FK a `partes`) |
| `proceso` | La estación: `PP_520`, `WAVE_SOLDER`, `ICT`, `CONFORMAL`, `EMPAQUE`… (lista cerrada de 15) |
| `std_hr` | **Piezas por hora** que debe producir esa estación para esa parte |
| `pzs_turno` | Piezas por turno (referencia) |
| `atributos` | JSON con el resto del bloque del Excel (MOD, #Componentes, Panel/Individual, etc.) |

**Cómo se lee:** "para la parte X, en la estación ICT, el estándar es 120 pzs/hr".
Es la fuente de la **meta automática**. Una parte tiene varias filas (una por
cada estación de su ruta).

> Dato clave para la presentación: este es el corazón de V2. Aquí vive el
> conocimiento de ingeniería que antes solo estaba en un Excel que nadie cruzaba
> con la producción real.

---

### 2.3 `ordenes_trabajo` — las OT en proceso (snapshot diario)
**De dónde sale:** del listado de órdenes de trabajo en proceso. Se carga como
**foto del día** (`fecha_snapshot`), no se sobreescribe: cada día es una foto nueva.

| Columna | Qué es |
|---------|--------|
| `orden_trabajo` | La OT completa, ej. `260600501-02` |
| `orden_base` | El número sin partida: `260600501` |
| `partida` | `01` = producto final · `02`/`03` = subensamble SMT |
| `es_smt` | `true` si es la parte SMT |
| `numero_parte` | Parte normalizada (liga a `partes`) |
| `cant_ordenada` / `cant_terminada` | Cuánto se pidió / cuánto se lleva |
| `fecha_orden` / `fecha_vence` | Cuándo entró / cuándo vence (entrega) |
| `estado_nexia` | **Decisión de Dirección:** `propuesta` → `aprobada` / `muerta` / `cerrada` |
| `motivo_muerte` | Por qué se mató (ej. "falta de material") |
| `comentario` | Nota libre dentro de la orden (warning de Fase 3) |
| `motivo_no_corre` | Captura Fase 3: `falta_material` / `falta_personal` / `maquina` / `otros` |

**Cómo se lee:** cada OT entra como `propuesta`. **Dirección decide**: la aprueba,
la mata (con motivo) o la cierra. El `pendiente` real = `cant_ordenada − cant_terminada`.

**Relación partida -01 / -02:** una misma orden se fabrica en dos pasos:
- `-02` / `-03` = el subensamble **SMT** (a veces viene con nombre, ej. "ANDROMEDA")
- `-01` = el **producto final** (PTH + ensamble + empaque)

Ambas comparten `orden_base`. Esto es lo que permite la "víbora" (sección 4).

---

### 2.4 `hora_por_hora` — la producción real (append-only)
**De dónde sale:** de las **líderes**, capturando por Telegram con el bot Horacio,
hora por hora. Es el dato "puro" del piso.

| Columna | Qué es |
|---------|--------|
| `linea_id` | Qué tablero (FK a `lineas`) |
| `fecha`, `hora_slot` | El día y la franja, ej. `06:30-07:30` |
| `plan` | La meta prorrateada de esa hora |
| `real` | Piezas reales producidas (`null` si `sin_dato`) |
| `causa_codigo` | Si hubo paro, por qué |
| `origen` | `telegram_lider` (líder) · `panel_manual` (supervisión) · `sistema` (hueco auto) |
| `corrige_id` | Si esta fila corrige a otra, apunta a la original |

**Cómo se lee — dos reglas importantes:**
1. **Append-only:** nunca se borra ni edita el histórico. Una corrección es una
   **fila nueva** que apunta a la vieja (`corrige_id`). Así queda auditoría
   anti-falseo (se ve el valor viejo, quién y cuándo).
2. Por eso los reportes **no leen `hora_por_hora` directo**, leen la vista
   **`hxh_vigente`** = solo las filas que nadie ha corregido.

---

### 2.5 `lineas` — los tableros HxH (y su macro-etapa)
**De dónde sale:** configuración de planta. Ojo: aquí "línea" significa
**tablero HxH**, no una línea física. Una líder llena varios tableros.

| Columna | Qué es |
|---------|--------|
| `codigo` | Clave del tablero, ej. `SMT_520`, `OLA`, `ICT`, `CONF_EMP` |
| `nombre` | Nombre legible |
| `grupo` | **Macro-etapa de la víbora:** `SMT` · `PTH` · `EMPAQUE` · `EMBARQUES` |
| `orden` | Posición en la ruta |
| `lider_persona_id` | Qué líder lo reporta |

**Cómo se lee:** el `grupo` es lo que agrupa los muchos tableros en las 4 grandes
etapas del flujo. Es la columna que hace posible la vista "víbora".

---

### 2.6 `ordenes_tablero` — la meta que captura Daniel (`/orden`)
**De dónde sale:** Daniel/supervisión, con el comando `/orden` del bot. Por cada
tablero captura la OT que corre + el modelo + la meta/hr.

| Columna | Qué es |
|---------|--------|
| `linea_id` | El tablero |
| `fecha` | El día |
| `orden` | La OT que corre en ese tablero (a veces corta, ej. `0605`) |
| `modelo` | El modelo/tarjeta |
| `meta_hr` | **La meta por hora que Daniel teclea** |
| `vigente` | Solo una vigente por tablero/día |

**Cómo se lee:** esta es **la meta manual actual** (el flujo viejo). V2 la respeta
intacta y la usa para **comparar** su meta automática contra la de Daniel
(vista `v_meta_validacion`). Es la "prueba de fuego": ¿el estándar coincide con
lo que Daniel venía poniendo a mano?

---

### 2.7 `linea_proceso` — el puente tablero ↔ estación
**De dónde sale:** mapeo definido en V2 (migración 026). Conecta cada tablero HxH
(`lineas.codigo`) con su estación del estándar (`estandar_proceso.proceso`).

| Columna | Qué es |
|---------|--------|
| `linea_codigo` | El tablero, ej. `OLA` |
| `proceso` | Su estación en el estándar, ej. `WAVE_SOLDER` |

**Cómo se lee:** sin este puente, el HxH (que habla de "tableros") no podría
encontrar su estándar (que habla de "estaciones"). Ej.: `OLA → WAVE_SOLDER`,
`CONF_EMP → EMPAQUE`. Los tableros sin estación en el estándar simplemente no
reciben meta automática.

---

## 3. Las vistas V2 (cómo se convierte en pantallas)

Las vistas no guardan datos: calculan en vivo cruzando las tablas de arriba.
Son lo que el panel V2 muestra.

### 3.1 `meta_sugerida(parte, proceso)` — función núcleo
Dada una parte y una estación, devuelve las **piezas/hr del estándar**
(promedia las variantes de ensamble; `NULL` si no hay estándar).
Es el ladrillo con el que se arma la meta automática.

### 3.2 `v_ot_parte` — resuelve la parte efectiva
**Problema que resuelve:** las OT `-02` SMT a veces traen un nombre (ej. ANDROMEDA)
que no tiene estándar propio. Esta vista usa el **hermano `-01`** del mismo
`orden_base` para encontrar el estándar. Resultado: `numero_parte_efectivo`.

### 3.3 `v_ot_meta` — la meta sugerida POR OT (corazón del panel)
**Qué muestra:** por cada OT y cada estación de su ruta:
- `meta_hr_sugerida` → piezas/hr que propone el estándar
- `pendiente` → cuánto falta (`ordenada − terminada`)
- `tableros` → en qué tableros HxH se captura esa estación

**Cómo se lee:** "La OT 260600501, en empaque, debería ir a 90 pzs/hr; le faltan
1,200 piezas; se reporta en el tablero CONF_EMP." Esto es lo que antes Daniel
tenía que deducir a mano.

### 3.4 `v_meta_validacion` — estándar vs. lo que Daniel teclea
**Qué muestra:** lado a lado, `meta_daniel` (de `ordenes_tablero`) contra
`meta_sugerida` (del estándar), con la `diferencia`.

**Cómo se lee:** es el argumento de venta de V2. Si la diferencia es chica, el
estándar valida a Daniel y se puede automatizar. Si es grande, hay un dato que
revisar (estándar viejo o captura distinta). Sirve para **generar confianza**
antes de soltar la meta automática.

### 3.5 `v_plan_dia` — ¿se cumple la entrega? (plan del día)
**Qué muestra:** por OT pendiente, cruzando estándar + fecha de entrega:

| Columna | Qué responde |
|---------|--------------|
| `proceso_cuello` / `std_cuello_hr` | La estación **más lenta** de la ruta (el cuello de botella) |
| `capacidad_dia` | Cuánto se puede hacer al día a estándar (cuello × 8 h) |
| `dias_necesarios` | Cuántos días se necesitan para el pendiente |
| `dias_a_vencer` | Cuántos días faltan para la entrega |
| `plan_diario_cumplir` | Ritmo/día requerido para llegar a tiempo |
| `factible` | `true`/`false`: ¿alcanza el tiempo? |

**Cómo se lee:** "Esta OT necesita 5 días y solo quedan 3 → **NO factible**, hay
que priorizar o avisar al cliente." Convierte el estándar en una **alerta de
entrega** accionable. (Asume 8 h productivas: turno 6:30–15:30, 1ª hora de
liberación.)

### 3.6 `v_ot_inconsistencias` — los warnings dentro de cada OT
**Qué muestra:** banderas por OT:
- `sin_estandar` → la OT (ni su hermano -01) tiene estándar usable
- `fecha_invalida` → vence antes de empezar
- `vencida_incompleta` → ya venció y no se terminó

**Cómo se lee:** son los focos rojos que el panel pinta dentro de cada orden.
Datos sucios o atrasos que requieren decisión.

---

## 4. El flujo "víbora" (Fase 3) — sincronizar el piso

> La planta corre como una víbora: **SMT → PTH → EMPAQUE → EMBARQUES**.
> Lo que una etapa cierra un día es el material (WIP) que alimenta a la siguiente.

### 4.1 `v_vibora_dia` / `v_vibora_acum` — el pulso por etapa
**De dónde sale:** suma el `real` del HxH (`hora_por_hora`) agrupado por
`lineas.grupo` y día.

**Cómo se lee:** cuántas piezas pasó cada macro-etapa cada día. `v_vibora_acum`
lo acumula con un orden de etapa (1=SMT … 4=EMBARQUES).

> ⚠️ **Cuidado de modelado (clave para la presentación):** este pulso es solo
> "actividad", NO conservación de piezas. Sumar tableros en serie dentro de una
> etapa **infla por doble conteo** (una misma pieza pasa por PTH→Ola→Soldeo→ICT
> y cada tablero la cuenta). Por eso el WIP real **no** se mide así, sino por OT
> (siguiente vista).

### 4.2 `v_vibora_ot` — el WIP exacto, por OT (sin doble conteo)
**De dónde sale:** cruza, dentro de cada `orden_base`, lo que terminó el SMT
(`-02/-03`) contra lo que terminó el final (`-01`). Como son 1:1, el conteo es exacto.

| Columna | Qué es |
|---------|--------|
| `smt_term` / `fin_term` | Terminado en SMT / en producto final |
| `wip` | Piezas atoradas entre SMT y final = `smt_term − fin_term` |
| `posicion` | `en_smt` · `esperando_pth` · `en_final` · `terminada` |

**Cómo se lee:** "Esta orden ya tiene 500 piezas de SMT terminadas pero el final
no las ha consumido → 500 en WIP, posición `esperando_pth`." Esto muestra **dónde
se atora el material** sin inflar números.

---

## 5. Mapa de relaciones (resumen visual)

```
  Excel Estándar x Hora
        │  (carga única, normaliza matriz → filas)
        ▼
   ┌─────────┐      ┌──────────────────┐
   │ partes  │◄─────│ estandar_proceso │  (std_hr por parte × estación)
   └────┬────┘      └────────┬─────────┘
        │ numero_parte        │ proceso
        │                     │
        ▼                     ▼
   ┌──────────────┐     ┌───────────────┐
   │ordenes_trabajo│    │ linea_proceso │ (tablero ↔ estación)
   │  (snapshot OT)│    └──────┬────────┘
   └──────┬────────┘           │ linea_codigo
          │ orden_base         ▼
          │              ┌──────────┐      ┌──────────────────┐
          │              │  lineas  │◄─────│  hora_por_hora    │ (real, líderes)
          │              │ (grupo)  │      │  → hxh_vigente    │
          │              └────┬─────┘      └──────────────────┘
          │                   │ linea_id
          │              ┌──────────────────┐
          │              │ ordenes_tablero  │ (meta_hr de Daniel, /orden)
          │              └──────────────────┘
          │
          ▼  Vistas V2 (solo lectura):
   v_ot_meta · v_meta_validacion · v_plan_dia · v_ot_inconsistencias
   v_vibora_dia · v_vibora_acum · v_vibora_ot
```

---

## 6. Mensajes para la presentación (las 3 ideas)

1. **No inventamos datos.** Cruzamos lo que la planta ya genera: el estándar de
   ingeniería + las OT en proceso + lo que las líderes capturan + la meta de Daniel.

2. **La meta deja de teclearse a mano.** El estándar propone la meta por hora
   automáticamente (`v_ot_meta`), y la validamos contra lo que Daniel venía
   poniendo (`v_meta_validacion`). Empezamos en modo solo-lectura: confianza primero.

3. **Vemos el flujo, no solo las piezas.** `v_plan_dia` dice si una entrega es
   factible, y la "víbora" (`v_vibora_ot`) muestra exactamente dónde se atora el
   material entre SMT y el producto final — sin el doble conteo que engaña.
