# AGENTS.md — Horacio (bot HxH Mapartel · SN-04 v2)

## Qué es
Bot de **Telegram** (`@HoracioRamirez_bot`) que lleva el **Hora por Hora** del piso
de producción de Mapartel: registra HxH, paros, faltantes y calidad; escala a los
dueños de reacción; y manda resúmenes. Implementación de la solución madre
**SN-04 Andon Light**. Cliente de consultoría NexIA (no app SaaS interna).

Spec de diseño (fuente humana): las 4 notas `Horacio - *.md` en la raíz.
Fuente de verdad operativa (lo que n8n lee): tablas `horacio.*` en Supabase.

## Stack
- **n8n** (https://n8n.nexiasoluciones.com.mx) + **Supabase self-hosted** · sin frontend
- Schema BD: `horacio` · LLM (futuro): Claude Haiku (solo texto libre/resúmenes)
- Patrón bot: Webhook + nodo **Code** que hace `httpRequest` a `/pg/query` y a la API de Telegram
  (verificado: el Code node usa `this.helpers.httpRequest` en esta instancia)

## Estado actual (snapshot · 2026-06-16)
**Piloto EN VIVO** — `Horacio - Scheduler` ACTIVO, produciendo datos reales.

**Tableros y líderes (9 tableros, modelo "1 líder = varios tableros"):**
| Grupo | Tableros | Líder | Alta |
|---|---|---|---|
| SMT | SMT 411&481 · SMT 520 (102/hr ofic.) | Viridiana Escalona | ✅ |
| PTH | PTH · Ola · Soldeo · ICT/FCT · Conformal (Yadira) | Yadira Magdariaga | ✅ ⚠️ *de vacaciones; la cubre Gabriela (ver Relevos)* |
| CONFORMAL | Conformal (Rocío) | Rocío (Chío) | ✅ |
| EMBARQUES | Embarques (tarjetas retiradas) | Brenda Medina | ✅ |

**Dueños de escalamiento:** Daniel Nava (paros/Producción) · Nayeli Hernández
(faltantes; **jefa de Embarques**) · Marco Sotelo (calidad; **+ recibe resumen**) ·
Juan Carlos Martínez "JC" (mantenimiento) · Jorge Ramírez (dirección/resumen).

**Crons activos (`Horacio - Scheduler` `ilJpIucqEBpKnFgT`, TZ MX, L–V):** órdenes
`45 6` → ping `35 7-15` → recordatorio `50 7-15` → escala no-captura `58 7-15` →
resumen líder `40 15` → resumen Dirección `0 17`.

**Ventanas HxH:** turno 6:30–15:30 → 9 ventanas de :30 (06:30-07:30 … 14:30-15:30).
**Meta/cumplimiento:** Daniel fija OT+meta por tablero con `/orden`; si no hay, usa
estándar oficial; si no, captura conteo (piezas/cajas según `lineas.unidad`).

**Dashboard:** `https://n8n.nexiasoluciones.com.mx/webhook/horacio-dash?token=<DASH_TOKEN>`
(workflow `ng4loQv932n2AIRC`). **Espejo de validación** ON → copia todo al chat de
prueba `5367409334` (apagar con `VALIDATOR=null`).

**Decisiones abiertas:** (1) **Relevo Yadira→Gabriela** (vacaciones): pendiente —
recomendado reasignar los 5 tableros a una persona "Gabriela" nueva (preserva a Yadira);
hoy un `/start` de Gabriela heredaría los tableros pero dejaría el nombre "Yadira".
(2) Estándares oficiales PTH/ola y Conformal. (3) Alta de Pamela/Ivonne/NexIA como
receptores de resumen. (4) Embarques captura **por tarjeta (NP + cantidad)**, varias
por hora; queda de conteo (sin meta) salvo que Daniel le ponga meta con `/orden`.

---

## Estado del proyecto

### ✅ Fase 1 — Cimientos + HxH 1 línea (2026-06-11)
- Schema `horacio` + 10 tablas + RLS + grants (`sql/001_schema_horacio.sql`)
- Seed catálogos: 8 causas, 7 personas, 3 líneas, estándar SMT520 TJ000360=102/hr,
  9 parámetros config (`sql/002_seed_catalogos.sql`)
- System prompt v0.1 cargado en `horacio.config` (key `system_prompt`)
- `horacio` registrado en PostgREST
- Workflow n8n **`Horacio - Webhook`** (id `VKb215KJk5TdEsEY`, ACTIVO)
  - Flujo HxH 3 taps: ping → ✅/❌ → rangos piezas → causa → INSERT `hora_por_hora`
  - Código fuente versionado: `n8n/horacio-hxh.code.js` (con placeholders de secretos)
- Webhook Telegram → `https://n8n.nexiasoluciones.com.mx/webhook/horacio-hxh`
- **Probado end-to-end** (simulado + taps reales): plan/real/causa/timestamp correctos
- Chat de prueba: `5367409334` (Juan). Líderes reales NO dados de alta (gate R2-07).

### ✅ Fase 2 — Alta auto-registro + Paros (2026-06-11)
- Nodo Code renombrado a **`Horacio Bot`**; fuente: `n8n/horacio-bot.code.js`
  (se sube por API REST con `scripts`/Python sustituyendo secretos)
- **Alta auto-registro:** `/start` → botones de línea → liga `chat_id` a la línea
  (actualiza la persona sembrada, p.ej. Viri en SMT520). `/dueno` → botones de rol →
  liga `chat_id` al dueño de escalamiento. `consentimiento=true`.
- **Paros:** `/menu` → 🛑 Reportar paro → causa → INSERT `paros` → escala al dueño
  por `causa.escala_a` (rol→persona con chat_id) con botón "Visto 👍" → confirma a líder
  con botón "✅ Ya quedó". Acuse → avisa a líder. Cierre → `duracion_min`.
- **Fix Fase 1:** guards por `step` + `editMessageReplyMarkup` para quitar botones
  tras responder (evita filas duplicadas por doble-tap).
- Probado end-to-end: alta líder+dueño, paro MAQ→JC, acuse, cierre (duración OK).

### ✅ Día Uno — Faltantes + Calidad + Scheduler + Resúmenes (2026-06-12)
- **Faltantes:** /menu → 📦 → NP por texto o **foto** (file_id) → escala a `faltantes`
  con botones [Visto 👍][✅ Surtido] → cierra loop a la líder ("ya se surtió").
- **Calidad:** /menu → 🔎 → descripción texto → escala a `calidad` [Visto].
- **Funciones admin** (en el mismo nodo Code, gated por `ADMIN_SECRET` en el body):
  `ping_all` (cierra huecos como sin_dato + pinguea líneas con estándar), `reminder_all`
  (1 recordatorio a no-respondidos del slot), `resumen_lider`, `resumen_dir` (semáforo
  🟢≥95% 🟡≥80% 🔴<80%, sin nombres de operadoras). Resúmenes por **plantilla** (sin LLM).
- **Workflow `Horacio - Scheduler`** (id `ilJpIucqEBpKnFgT`, **INACTIVO**) — 4 cron L–V
  (TZ MX) → HTTP al webhook del bot:
  - Ping `35 7-15 * * 1-5` · Recordatorio `50 7-15 * * 1-5`
  - Resumen líder `40 15 * * 1-5` · Resumen Dirección `0 17 * * 1-5`
- Probado end-to-end (faltante, calidad, ping_all, resumen_lider, resumen_dir).

### ✅ Alta a prueba de tontos en `/start` (2026-06-12)
`/start` ya no asume "eres líder de línea". Primero pregunta **"¿qué llevas a tu
cargo?"** → 📋 Una línea de producción (botones SMT/PTH/Conformal) · 🔔 Un área de
apoyo (Paros/Daniel · Materiales-Faltantes/Nayeli · Calidad/Marco · Mantto/JC ·
Dirección/Jorge). Así cualquier dueño que teclee `/start` (lo natural) se registra
bien sin toparse con la selección de líneas. `/dueno` queda como atajo y reusa el
mismo `askArea()`. Causa raíz del bug: Nayeli (materiales) hizo `/start` y le pidió
"SMT o PTH" — no completó, BD quedó limpia (nada que corregir manual).
Ref: `n8n/horacio-bot.code.js` (acciones `start`/`reg_linea`/`reg_area`/`dueno` + helpers `askLine`/`askArea`).

### ✅ Receptores de "solo resumen del día" (2026-06-12)
Nueva área en `/start → 🔔` y `/dueno`: **"📊 Solo recibir resumen del día"** (rol
`resumen`). Para gente que no reporta nada y solo lee el consolidado: Pamela, Ivonne,
NexIA. Cada quien se registra con su nombre de Telegram (no se pre-siembran). El
`resumen_dir` (17:00) dejó de mandar a uno solo: ahora envía a **todos** los
`rol IN ('direccion','resumen')` con chat_id (semáforo por línea, sin nombres de
operadoras). Jorge (direccion) lo sigue recibiendo. Envío con try/catch por
destinatario (un fallo no frena a los demás).
Ref: `n8n/horacio-bot.code.js` (`askArea` opción resumen · `rol_pick` msg a medida · admin `resumen_dir` loop).

### ✅ Ventanas HxH de 6:30→7:30 (rango), no "hora en punto" (2026-06-15)
El turno arranca **6:30**, así que las ventanas cierran a los **:30** (6:30-7:30,
7:30-8:30, … 14:30-15:30 = 9 ventanas). El cron `:35` ya caía 5 min después del cierre
:30 (timing correcto); lo que estaba mal era la **etiqueta** del slot (`06:00`, `07:00`
…). Ahora el slot es el **rango real** `HH:30-HH:30` (con cero a la izq → ordena bien),
vía helper `winClose(h)` en el bot. Se arrastra a recordatorio, escalación, catch-up,
resúmenes y dashboard (mensajes ahora dicen "06:30-07:30: ¿salió la meta?"). El cron
**no cambió**. Datos de **hoy** re-etiquetados (`HH:00`→`HH:30-(HH+1):30`) + slot de las
sesiones en vuelo. Dashboard: `expectedSlots` = ventanas de :30 ya cerradas.
Fuente: `n8n/horacio-bot.code.js` (winClose, admin slot, catchup, /ping) · `horacio-dash.code.js`.

### ✅ Escalamiento por no-captura → Producción (2026-06-15)
Andon completo del HxH: si una líder no sube su hora por hora, ping `:35` →
**recordatorio `:50`** (`reminder_all`, re-manda la botonera) → si **sigue sin subir**,
**escalamiento `:58`** (`escalate_nocapture`) avisa a **Daniel Nava** (rol `paros`,
Producción) con la lista consolidada de quién/qué tablero falta, + un último empujón a
la líder ("ya le avisé a Daniel por si necesitas apoyo"). Marca `d.escalado` para
escalar una sola vez por slot. Todo dentro de la misma hora para que el `slot` calce.
Nodo nuevo en `Horacio - Scheduler`: `Cron Escala :58 → POST escalate_nocapture`.
Fuente: `n8n/horacio-bot.code.js` (admin `escalate_nocapture`).
> Afinable: si se quiere exactamente +10/+20, mover recordatorio a `:45` y escala a `:55`
> (el diff por índice de array no lo permite; requiere update full del Scheduler).

### ✅ Tablero Embarques (Brenda Medina) + unidad por tablero (2026-06-16)
Nuevo proceso de cierre del flujo: **Brenda Medina** (Líder de Embarque, reporta a
Nayeli) captura cuántas **cajas** retira del piso = realidad de lo embarcable.
- Tablero `EMBARQUES` (grupo propio, `no_estandar`), líder Brenda; se registra con
  `/start → 📋 línea → Embarques`. `sql/009`.
- Columna **`lineas.unidad`** (default `piezas`; Embarques=`cajas`): el HxH pregunta
  "¿cuántas cajas?" y confirma/resume en esa unidad; el dashboard muestra "12 cajas".
- Es unmetered por defecto (captura conteo); si Daniel le pone meta vía `/orden`, entra al %.
- **Escalamiento por jefe (sql/010):** columna `lineas.supervisor_rol` (default `paros`→
  Daniel; `EMBARQUES`→`faltantes`→**Nayeli**, jefa de embarques). `escalate_nocapture`
  ya no manda todo a Daniel: agrupa los pendientes por `supervisor_rol` y avisa a cada
  jefe (prod→Daniel, embarques→Nayeli); el empujón a la líder nombra a su jefe correcto.

### ✅ Órdenes y meta por tablero — `/orden` (solo Daniel) (2026-06-16)
Daniel (Producción) fija por subproceso la **OT** y la **meta/hr**; esa meta se vuelve
el `plan` del HxH de ese tablero hoy → cada subproceso obtiene **cumplimiento**.
Separación Andon: supervisor pone el plan, líder reporta lo real.
- Tabla `horacio.ordenes_tablero` (linea_id, fecha, orden, meta_hr, vigente, set_by_chat, ts) — `sql/008`.
- Comando **`/orden`** gated a `rol='paros'` (Daniel): menú de tableros (✅ los que ya
  tienen OT) → toca uno → escribe OT → escribe meta/hr → guarda (marca prev `vigente=false`)
  → vuelve al menú → "✔️ Terminar". Flujo `orden` / steps `orden_menu|orden_ot|orden_meta`
  (ampliados en `sesiones_*_check`, sql/008).
- `plan` ahora = **COALESCE(meta OT de hoy, estándar oficial, null)** en `boardsByPid`/
  `myBoards` (consts `PLAN_SQL`/`ORDEN_SQL`). El ping muestra la OT: "PTH · OT 4521, …:
  ¿salió la meta (80)?". En cuanto Daniel fija meta, ese tablero pasa de "¿cuántas piezas?"
  a ✅/❌ y entra al %.
- Dashboard: cada tablero muestra "OT … · meta …/h"; el cumplimiento ya aplica a los que tengan meta.
- **Recordatorio matutino** (admin `orden_reminder`): cron **`Cron Ordenes 6:45`** (L–V,
  TZ MX) en `Horacio - Scheduler` → mensaje a Daniel para definir las órdenes del día
  con /orden (antes del 1er ping 7:35), con el tip de volver a /orden si una OT cambia.
- Probado e2e (Daniel→chat prueba: /orden PTH OT-4521 meta 80 → plan=80 → limpiado; orden_reminder sent:1).
Fuente: `n8n/horacio-bot.code.js` (acción `orden`/`orden_board`/`orden_done` + `ordenMenu` + captura OT/meta + admin `orden_reminder`) · `horacio-dash.code.js`.

### ✅ Embarques: captura por tarjeta (NP + cantidad), varias por hora (2026-06-17)
Brenda dejó de capturar "un número de cajas": ahora registra, por hora, **qué
tarjeta (NP) retiró y cuántas**, varias por hora. El `real` de la hora = **suma**
de cantidades (unidad `tarjetas`).
- **Catálogo CERRADO** `horacio.tarjetas` (NP UNIQUE + alias opcional). Sembradas 24
  NP de Mapartel. El HxH de Embarques muestra el catálogo en **botones** (2 por fila).
- **Detalle append-only** `horacio.hxh_tarjetas` (hxh_id→hora_por_hora · tarjeta_id ·
  numero_parte *snapshot* · cantidad>0). 1 fila HxH + N renglones por hora.
- **Modo de captura por tablero** `lineas.captura` (`conteo` default | `tarjetas`).
  Embarques=`tarjetas`; el resto de tableros NO cambia (siguen con su número).
- **Flujo bot** (solo `captura='tarjetas'`): tocar el tablero → "¿qué tarjeta?"
  (botones + **➕ Otra** + **✔️ Cerrar la hora (N tarjetas)**) → toca tarjeta →
  "¿cuántas?" → número → vuelve al menú con lo acumulado → Cerrar → INSERT HxH(real=suma)
  + N renglones. **➕ Otra** = NP a mano (texto libre) → upsert al catálogo (`ON CONFLICT`)
  → cantidad. Steps nuevos `hxh_tj_pick|hxh_tj_np|hxh_tj_cant` (ampliado el CHECK,
  sql/011) y añadidos a `OPEN` (la escalación de no-captura a Nayeli sigue operando).
- Resumen líder/Dirección ya muestran "47 tarjetas" (usan `lineas.unidad`). El dashboard
  hereda la unidad correcta; (pendiente opcional) desglose "por NP" en el tablero.
- **Probado e2e** vía webhook en tablero temporal aislado (3 renglones: catálogo ×2 +
  ➕ Otra): 1 fila HxH `real=47` + 3 detalle correctos; catálogo creció con la "otra";
  todo el dato de prueba **limpiado** (catálogo de vuelta en 24). Sin tocar a Brenda viva.
Fuente: `sql/011_embarques_tarjetas.sql` · `n8n/horacio-bot.code.js`
(helper `tjPickMenu` + acciones `tj_pick`/`tj_otra`/`tj_done` + steps de texto `hxh_tj_np`/`hxh_tj_cant`).

### ✅ Dashboard Mapartel — Horacio (2026-06-15)
Workflow **`Horacio - Dashboard`** (`ng4loQv932n2AIRC`, ACTIVO). Webhook GET
`/webhook/horacio-dash?token=<DASH_TOKEN>` sirve la **página HTML** (Chart.js, auto-
refresh 30s); con `&data=1` devuelve **JSON** de agregados. Un solo nodo Code
(`Horacio Dash`) hace todo vía `/pg/query`; nodo `Respond` con `content-type` dinámico.
Token nuevo `DASH_TOKEN` en `scripts/secrets.env` (sustituido por `push_code.py`).
Solo lectura, **sin nombres de operadoras** (líneas/líderes). Muestra: KPIs del día
(cumplimiento, tableros reportando, paros/faltantes/calidad abiertos, acuse prom.),
semáforo por tablero, **heartbeat de captura por líder** (quién sube info), tabla de
**escalamientos abiertos**, barras real vs plan por hora, y **Pareto de causas apilado por área/líder** (SMT-Viridiana,
PTH-Yadira, Conformal-Chío; combina paros formales + causas de merma del HxH ❌, 7d). Debajo, mini-tabla "Causa #1 por área".
Cada tablero muestra además **OT · meta/h** (de `/orden`) y la unidad correcta (cajas/piezas).
**Página endurecida (2026-06-16):** `fetch` con `cache:"no-store"`; lee texto y hace
`JSON.parse` con mensaje claro si no es JSON (p.ej. token malo → "respuesta no válida");
muestra `error HTTP <status>`; las gráficas van en try aparte (si Chart.js no carga, el
resto del tablero igual se ve). Diagnóstico previo: el render es correcto en Node con el
JSON real; un "no carga" suele ser navegador interno de Telegram / caché / token.
Fuente: `n8n/horacio-dash.code.js`. Para apagar el espejo de validación no afecta esto.
Refrescar: `python3 scripts/push_code.py n8n/horacio-dash.code.js ng4loQv932n2AIRC "Horacio Dash"`.

**Rediseño visual minimalista · Powered by NexIA (2026-06-17):** misma capa de
datos (queries intactas), solo se reescribió la página. Tema **claro minimalista**
(fondo `#f6f6f8`, tarjetas blancas con borde sutil + sombra suave, radios 16px),
acento **violeta NexIA `#7c3aed`**, tipografía del sistema con números tabulares.
Header sticky con marca (rombo NexIA SVG) + footer **"powered by ◆ NexIA"**. KPIs
con color de estado (cumplimiento semáforo; paros/faltantes/calidad en rojo si >0).
Gráficas en tema claro (Plan gris/Real violeta; Pareto SMT violeta·PTH ámbar·
Conformal verde). Se conservó el blindaje de carga (fetch `no-store`, `JSON.parse`
con fallback). Validado en vivo: página 200, JSON 200, JS del navegador `node --check` OK.

### 🔌 Encendido — ✅ YA ENCENDIDO (piloto en vivo)
Scheduler ACTIVO y equipo dado de alta (ver snapshot arriba). Lo que queda como
auto-servicio: **Brenda** hace `/start → 📋 línea → Embarques`; **Pamela/Ivonne/NexIA**
`/start → 🔔 → 📊 Solo resumen`. Para alta manual de cualquiera, ver patrón en las
secciones de abajo (o `getChat` para verificar identidad del chat tras el alta).

### ✅ Modelo real de líneas + organigrama (2026-06-12, `sql/003`)
Corrección: los pizarrones HxH son **procesos**, no áreas; "Andromeda" es una
**tarjeta** (NP 22SD72916-06), no una línea. Líneas del piloto:
| Código | Línea | Líder | Estándar |
|---|---|---|---|
| SMT | SMT | Viridiana Escalona | TJ000360 = 102/hr (oficial) |
| PTH | PTH (inserción manual + ola, **cuello**) | Yadira Magdariaga | por validar |
| CONFORMAL | Conformal | Rocío (Chío) | por validar |

Dueños de escalamiento (nombres completos): Daniel Nava (paros), **Nayeli Hernández**
(faltantes), Marco Sotelo (calidad), **Juan Carlos Martínez "JC"** (mantenimiento),
**Jorge Ramírez** (dirección). Fuente: `Horacio - Organigrama General.md`.

**HxH sin estándar (PTH/Conformal/Otros):** el ping pregunta "¿cuántas piezas
salieron?" (step `hxh_real`) y la líder escribe el número → se guarda `real` con
`plan=null`. Horacio NUNCA inventa meta. SMT (con estándar) usa ✅/❌ contra los 102.

### ✅ Tableros HxH por líder + ping multi-tablero (2026-06-12, sql/004+005)
Corrección de modelo: **una líder lleva VARIOS tableros HxH**, no "1 línea = 1 líder".
`horacio.lineas` ahora significa "tablero HxH" (+ columnas `grupo`, `orden`). 7 tableros:
| grupo | tablero | líder | estándar |
|---|---|---|---|
| SMT | SMT 411&481 · **SMT 520** | Viridiana | 520 = 102/hr oficial; 411&481 piezas |
| PTH | PTH · Ola · Soldeo · ICT/FCT · **Conformal (Yadira)** | Yadira | piezas (por validar) |
| CONFORMAL | **Conformal (Rocío)** | Rocío (Chío) | piezas (por validar) |

> Hay **dos** líneas de Conformal (sql/006): una de Yadira (parte de su flujo PTH) y
> otra de Rocío (Chío), líder aparte. Son tableros distintos, cada uno con su líder.

- **Ping multi-tablero:** `ping_all` manda **un solo mensaje por líder** con un botón
  por tablero (`hxhb_<linea_id>`); al tocar reporta (✅/❌ si hay estándar, o número si
  no) y vuelve al menú marcando progreso; cierra al completar todos. Step nuevo
  `hxh_menu` (requirió ampliar `sesiones_step_check`, sql/005). Sesión guarda
  `{fecha,slot,boards[],done[],cur}`. Huecos del slot anterior → `sin_dato` por tablero.
- **Paros/faltantes/calidad:** si la líder tiene >1 tablero, primero pregunta
  **"¿en qué tablero?"** (`brd_<flujo>_<id>`); con 1 tablero arranca directo.
- **Resumen líder:** una línea por tablero (suyo); con estándar `R/P (%)`, sin estándar
  `N pzs`. **Resumen Dirección:** agrupado por SMT/PTH, semáforo solo si hay meta
  (⚪ + piezas si no), y **nunca omite un tablero que produjo** (fix del `/0`).
- Reúso de filas existentes en la migración (preserva el estándar y FKs); Conformal
  reasignado a Yadira. Probado end-to-end vía webhook (Viri ✅/❌/sin-estándar, Yadira
  5 tableros, selector de paro, resumen_dir) repuntando al chat de prueba y restaurando.

**Altas reales — equipo COMPLETO (al 15-jun, en vivo con el `/start` nuevo):**
Viridiana (SMT, chat propio 8992283238), Yadira (PTH ×5), Rocío (Conformal propio),
Nayeli (faltantes), Marco (calidad), JC Martínez (mantenimiento), Daniel Nava (paros),
Jorge Ramírez (dirección) — todos con `consentimiento=true`. **Scheduler ACTIVO**
(pinguea a los :35); el piloto está EN VIVO produciendo datos.

> ⚠️ Bug encontrado y corregido (12-jun): **Nayeli se había registrado como líder SMT**
> (eligió línea en vez de área), ocupando el lugar de Viri → a Viri no le llegaba nada.
> Detectado con `getChat` de Telegram (el chat "Viri" tenía nombre NAYELI). Se liberó
> el lugar de Viri y se pasó a Nayeli a `faltantes`. Lección: tras un alta, verificar
> identidad real del chat con `getChat`, no confiar en el nombre sembrado.

### ✅ Catch-up de la mañana + espejo de validación (2026-06-15)
- **Catch-up** (admin `catchup`): recupera las primeras horas perdidas. Manda 1 mensaje
  + la botonera hora por hora **en fila** (auto-avanza al terminar cada hora hasta cerrar
  la mañana). Body: `{slots:[...]}` o `{from:7}`; opcional `{only_chat:<id>}`,`{intro}`.
  El avance vive en `hxhBoardMenu` (cola `d.queue`; flag `d.catchup`).
  ⚠️ No incluir el slot que el próximo ping `:35` del Scheduler ya cubre (evita doble).
- **Espejo de validación** (`VALIDATOR` const en el bot = chat de prueba 5367409334):
  `tg()` copia **todo** `sendMessage`/`sendPhoto` al validador con prefijo `👁️ [→ quién]`
  (texto; sin botones, para no disparar callbacks). Así un solo chat valida en vivo lo
  que reciben líderes, dueños y Dirección. Poner `VALIDATOR=null` para apagar en prod.
- **Fix:** `personas_rol_check` no permitía rol `'resumen'` (sql/007) → las altas de
  receptores de resumen (Pamela/Ivonne/NexIA) fallaban con 23514. Corregido.

### ⏳ Siguientes (al 2026-06-16)
- [ ] **Relevo Yadira→Gabriela** (vacaciones): reasignar sus 5 tableros a "Gabriela".
- [x] Alta de **Brenda** (Embarques) ✅ — falta **Pamela/Ivonne/NexIA** (resumen).
- [ ] (Opcional) Dashboard: desglose de Embarques **por tarjeta/NP** del día.
- [ ] Estándar oficial de **PTH/ola** (ciclo 294 s → pzs/hr) y **Conformal** con Ingeniería.
- [ ] Estándar por modelo (SMT corre varios; hoy solo TJ000360) — o vía `/orden` diario.
- [ ] (Opcional) Resúmenes con LLM (hoy por plantilla, sin LLM).
- [ ] (Opcional) Flujo de "relevo" auto-servicio en el bot (reemplazar líder ocupado).
- [ ] (Opcional) Separar Pareto: paros formales vs merma HxH.

> ✅ Hecho desde el día uno: Scheduler activo (6 crons), equipo dado de alta, modelo de
> tableros por líder, ventanas :30, escalación por jefe, `/orden`+meta, dashboard, espejo.

## Comandos rápidos
```bash
# Aplicar SQL (DDL/seed) — fuente de verdad en sql/
SK="<SERVICE_ROLE_KEY>"
jq -Rs '{query: .}' sql/00X.sql | curl -s -X POST \
  https://supabase.nexiasoluciones.com.mx/pg/query \
  -H "apikey: $SK" -H "Authorization: Bearer $SK" \
  -H "Content-Type: application/json" --data @-

# Ver HxH de hoy
# SELECT ... FROM horacio.hora_por_hora ...  (via /pg/query)

# Webhook Telegram
curl -s ".../bot<TOKEN>/getWebhookInfo"
```

## IDs clave
- Bot: `@HoracioRamirez_bot` (id 8889801914)
- Workflow bot: `VKb215KJk5TdEsEY` (Horacio - Webhook) · fuente `n8n/horacio-bot.code.js`
- Workflow scheduler: `ilJpIucqEBpKnFgT` (Horacio - Scheduler) · 6 crons (ver snapshot)
- Workflow dashboard: `ng4loQv932n2AIRC` (Horacio - Dashboard) · fuente `n8n/horacio-dash.code.js`
- Schema: `horacio` · migraciones en `sql/001`…`sql/011`
- Secretos (no en git): `scripts/secrets.env` → BOT_TOKEN, SERVICE_ROLE_KEY, ADMIN_SECRET, DASH_TOKEN
- Deploy de un Code node: `python3 scripts/push_code.py <archivo> <workflow_id> "<node>"`
- Chat de prueba / espejo de validación: `5367409334`
