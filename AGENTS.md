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
PTH-Yadira, Conformal-Chío; combina paros formales + causas de merma del HxH ❌, 7d).
Fuente: `n8n/horacio-dash.code.js`. Para apagar el espejo de validación no afecta esto.
Refrescar: `python3 scripts/push_code.py n8n/horacio-dash.code.js ng4loQv932n2AIRC "Horacio Dash"`.

### 🔌 Encendido para el piloto (R2-07) — checklist
1. Cada **líder** hace `/start` → 📋 línea → elige su línea (auto-registro).
2. Cada **dueño** hace `/start` → 🔔 área → elige su área (o `/dueno` directo).
3. **Receptores de resumen** (Pamela/Ivonne/NexIA): `/start` → 🔔 → 📊 Solo resumen.
3. Confirmar **SLAs firmados** (Daniel Nava, Nayeli).
4. (Opcional) resetear altas de prueba: `UPDATE horacio.personas SET chat_id=NULL, consentimiento=false;`
5. **Activar** el workflow `Horacio - Scheduler` en la UI de n8n. ← esto enciende los pings.
   (Hoy hay 5 altas apuntando al chat de prueba 5367409334 para demo.)

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

### ⏳ Siguientes (post día-uno)
- [ ] Estándar oficial de PTH/ola (ciclo 294 s/pasada → pzs/hr) con Ingeniería
- [ ] Estándar oficial de Conformal (hoy "por validar")
- [ ] Estándar por modelo (SMT corre varios modelos; hoy solo TJ000360)
- [ ] Scheduler pings horarios (7:35–15:35) + recordatorio 15 min
- [ ] Resumen líder 15:40 + resumen Dirección 17:00 (LLM)
- [ ] Datos `#revisar`: líderes CIL3/Andromeda, 2 líneas con Pamela, estándar Andromeda
- [ ] **Gate de encendido (R2-07):** SLAs firmados por Daniel Nava + Nayeli antes
      del primer ping al piso real. Alta de chat_id con consentimiento vía RH.

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
- Workflow n8n: `VKb215KJk5TdEsEY` (Horacio - Webhook)
- Schema: `horacio` · app/canal piloto: Telegram, 5 líderes (por dar de alta)
