# AGENTS.md — Horacio (bot HxH Mapartel · SN-04 v2)

## Bitácora 2026-07-01 (cierre) — Fase 2: WIP por subensamble sobre el pareo

Nayeli **cerró el pareo al 100%** del volumen en proceso (117 parejas, 25 subensambles con finales,
13 declarados "es sub", 1 sin-sub, 0 pendientes). Eso desbloqueó Fase 2.

- **`sql/043` `v_wip_smt`:** WIP agrupado por **subensamble** (pareo 1:N) en vez de 1:1 por `orden_base`
  → **adiós falsos atorones**. `wip_mas_buffer = SMT_term − Σ finales_term`. Validado: ANDROMEDA (el caso
  estrella de la reunión) pasó de "500 atoradas" falsas a **0** pooled. ⚠️ v1 directional: aún mezcla
  buffer + falta factor de cantidad (2:1) y stock de seguridad (Brenda).
- **Dashboard (Fase 2b):** sección **"Material entre SMT y final (WIP por subensamble)"** en `horacio-dash`
  (`ng4loQv932n2AIRC`, nodo "Horacio Dash", deploy hot). Separa **con finales activos** (WIP real) de
  **sin finales en proceso** (TJ000360… — NO atoron). Valida con `scratchpad/check_dash.mjs`
  (gotcha: extraer el `<script>` inline con `indexOf('</script>', scriptStart)` porque el `<script src>`
  de Chart.js trae un `</script>` antes).
- **Docs para el cliente:** `docs/Horacio-Pareo-Revision-Nayeli-2026-07-01.md` (doble-check del pareo) y
  `docs/Horacio-Insumos-WIP-Nayeli-Brenda-2026-07-01.md` (pide a Nayeli los finales de los declarados +
  a Brenda el factor de cantidad y el stock de seguridad → lo único que falta para WIP exacto).
- **Pendiente:** consolidación Fase A (A2 OT estado/`set_motivo`, A3 Programa) y Fase 2 exacta cuando
  llegue el dato de Brenda/Gabriela.

## Bitácora 2026-07-01 (tarde) — Consolidación Fase A, fixes de pareo, y multi-orden Embarques

Sesión de iteración sobre el panel V1 (todo en `n8n/horacio-panel.code.js`, deploy hot).

- **Alta Nayeli (planeación):** `puede_pareo`+`puede_meta`=true, PIN temporal, **rol `faltantes` intacto**
  (es dueña del escalamiento de faltantes; el tab se gatea por flag, no por rol).
- **Fix pareo (colisión + silencioso):** `norm_np` quita `_SMT`, así "TJ000360_SMT" colapsaba a "TJ000360"
  (=el final) → `set_pareo` **decía ✓ sin guardar**. Ahora da **error claro**. Nuevo botón **"es sub"**
  (`sql/041` + `subensambles_smt`): declara una parte como subensamble SMT (sale de pendientes, queda en
  el dropdown). **Regla:** el export ya marca el SMT (`es_smt`/partida 02/"SMT" en descripción) → esos van
  con "es sub"; partida 01 = final → "parear"; parte simple → "sin sub".
- **Consolidación Fase A (migrar captura de `horacio-v2` → panel V1):** A1 = tab **Calendario** (horario del
  turno, `set_cal_config`) migrado. Pendientes A2 (OT estado/`set_motivo`) y A3 (Programa — motor+drag&drop).
  Plan: V1 = única captura, Dashboard = única lectura, retirar `horacio-v2`.
- **Buscador en Estándar:** el `<select>` gigante → **input con datalist** (busca por número de parte O
  descripción) + chips de prioridad.
- **Fix auto-refresco:** el `setInterval(load,30000)` recargaba cualquier tab y **borraba lo que escribías**
  en captura → ahora solo refresca en **captura en vivo y paros**.
- **Mapeo a EMPAQUE:** Empaque 1s/Andr + **Embarques** → proceso `EMPAQUE` en `linea_proceso` (el estándar
  del FINAL; Empaque y Embarques trabajan el producto terminado). Con eso ya sugieren meta.
- **Multi-orden Embarques (`sql/042`):** `lineas.multi_orden` (solo Embarques ON). El tab Metas para ese
  tablero permite **varias órdenes (chips) con UNA meta**; se guarda **una fila vigente** con `orden`=lista
  por comas → **bot/dashboard no cambian** (solo muestran `orden`, sin JOIN, LIMIT 1). Demás tableros igual.
- **Datos aplicados en prod (no en git):** grants de Nayeli, mapeos `linea_proceso`, flag `multi_orden`.
- Validación: `scratchpad/check_panel.mjs` (doble `node --check` + mock-DOM de todos los render nuevos).

## Bitácora 2026-07-01 — V2 arranque: Pareo SMT↔final como información oficial (tab autoservicio)

**Objetivo:** desbloquear el pareo SMT↔PTH de la reunión 26-jun + sesión Nayeli 29-jun. El pareo
es **1:N** (un subensamble alimenta muchos finales), **no derivable** de `orden_base`/partida, y el
export de OTs **no trae el sufijo `_SMT`**. Solución = catálogo explícito, sembrado desde los dos
Excel de planeación (ENSAMBLES.xlsx + Tabla de ensambles.xlsx), mantenido **en el sistema** (patrón
Estándar x Hora: el Excel es solo semilla; la fuente de verdad pasa a Supabase).

- **`sql/040_pareo_smt.sql`**: tabla `horacio.pareo_smt(parte_smt, parte_final, nivel, fuente, vigente…)`
  (1:N, UNIQUE(smt,final)) + `pareo_excluidos` (marcar "sin subensamble" 1:1) + función
  **`horacio.norm_np()`** (upper · `()→[]` · quita `_SMT` · quita espacios — `Focaris_Ctrl_ (F)_SMT`
  → `FOCARIS_CTRL_[F]` = como sale en el export) + vista **`v_pareo_pendientes`** (OTs en proceso sin
  pareo, por volumen).
- **`scripts/import_pareo_smt.py`** (Excel en `data/pareo/`): sembró **115 parejas / 24 subensambles**,
  `fuente='excel_planeacion_2024-10'`. Cobertura: pendientes **31→16** (los 16 = serie TJ, T005…, KT,
  BLE, 05-…; **TJ000360** = 17,764 ord es el mayor gap → preguntar a Nayeli si es familia nueva o alias).
- **Tab "Pareo SMT"** en el panel (gate `personas.puede_pareo`): ① **pendientes** (punteado, por volumen)
  → dropdown de subensamble conocido / nuevo → **parear** o **sin sub**; ② **cargados** (verde, 1:N por
  subensamble, × para quitar). Handlers `set_pareo`/`mark_sin_sub`/`del_pareo` (normalizan con `norm_np`,
  gateados server-side). Deploy hot al panel `4sJAO9urzrgQowJB`. Verificado e2e con sesión real de Nayeli
  (mark→16→15→revert→16). **Alta de Nayeli**: ya existía (rol `faltantes`, dueña del escalamiento de
  faltantes → NO se tocó el rol); se le dio `puede_pareo=true` + PIN temporal.
- **Fase 2 (pendiente):** reescribir `v_ot_parte`/`v_wip_smt` para **consumir** el pareo y corregir el WIP
  de la víbora (adiós falsos atorones), con indicador de cobertura; cuando la cobertura suba con la carga
  de Nayeli. Falta aún: factor de cantidad (2:1) y stock de seguridad (Excel Brenda) para separar buffer de atoro.
- **Validación:** `scratchpad/check_panel.mjs` (doble `node --check` + mock-DOM renderMetas/estGrid/renderPareo).

## Bitácora 2026-07-01 — V1.5: metas del día siguiente + colores en tab Estándar

**Objetivo:** capturar hoy las metas de **mañana** (programación anticipada → ver cómo
programan la planta) + ayuda visual en el tab Estándar (cajas con/sin dato).

- **Metas de mañana (sin cambio de schema):** `horacio.ordenes_tablero` ya tiene `fecha`;
  el tab "Metas del día" gana un toggle **Hoy / Mañana**. El bot NO cambia — sigue leyendo
  `ordenes_tablero WHERE fecha=hoy`, así que la meta de mañana queda inerte y entra sola al
  cambiar el día. Backend: `set_meta` acepta `body.fecha` **validado server-side ∈ {hoy, mañana}**
  (no cualquier fecha); el payload trae `ot_man`/`meta_man` por tablero + `fecha_manana`.
  Cero camino paralelo — misma tabla que `/orden`.
- **Colores en Estándar:** cada caja de estación se pinta **verde** (`#e9f7ef`/`#b7e4c7` + ✅)
  si tiene Std/Hr, **punteada gris** si está vacía; se recolorea al guardar/borrar (helper
  `estCol(has)`, id `esbox_<proc>`). Réplica del código de color de la matriz de captura.
- **Archivos:** `n8n/horacio-panel.code.js` (nodo Code `Horacio Panel`, wf `4sJAO9urzrgQowJB`).
  Deploy hot con `push_code.py`. Validado: doble `node --check` + mock-DOM (renderMetas Hoy/Mañana,
  estGrid colores) en `scratchpad/check_panel.mjs`. Página en vivo verificada (GET 200).

## Bitácora 2026-06-30 — Incidente de red + endurecimiento del bot (resiliencia HTTP)

**Reporte:** "los bots de Mapartel fallan, las líderes no pueden subir datos".
**Diagnóstico (n8n):** 5 ejecuciones en `error` del bot `Horacio - Webhook` en ventana
~12:42–13:35 MX, todas `socket hang up` / `read ECONNRESET` en el nodo "Horacio Bot"
(una colgada 72s). Causa raíz: las llamadas HTTP salientes (`pg()`/`tgRaw()`, y 4 a
`api.anthropic.com`) NO tenían `timeout` ni reintento → un blip de red saliente del VPS
abortaba TODA la captura → la líder se quedaba sin confirmación = "no puedo subir datos".
Confirmado contra BD: slot 11:30-12:30 quedó corto (8 vs ~11) y 12:30-13:30 en 0 al momento.
Servicios sanos al revisar (Telegram/Supabase/n8n/Anthropic responden); el blip ya había pasado.

**Fix desplegado (hot, nodo Code, sin re-registrar webhook):**
- `httpReq()` central: `timeout: 15s` (mata el cuelgue de 72s) + reintento de errores
  TRANSITORIOS (`ECONNRESET|socket hang up|ETIMEDOUT|...`) con backoff.
- **Lecturas (SELECT/WITH-solo-lectura): reintento ×2** (idempotente).
- **Escrituras (INSERT/UPDATE): 1 intento, SIN reintento** → HxH es append-only, un reintento
  duplicaría fila. Si la escritura falla por red, avisa a la líder ("⚠️ se cayó la red,
  vuelve a tocar el botón 🙏") vía `_activeChat`, en vez de silencio.
- Telegram: reintento ×2 (mensaje duplicado es inocuo).
- 4 llamadas Anthropic: `timeout: 20s` (ya tenían try/catch, ahora no cuelgan).
- QA: `node --check` OK + 16 asserts unitarios (clasificación lectura/escritura, retry
  solo transitorio, escritura sin reintento). Deploy `push_code.py` → PUT ok.

**Pendiente menor:** un blip que pegue justo en el INSERT padre+detalle del HxH (línea ~790)
puede dejar fila huérfana sin detalle; aceptable (la líder re-toca). Si reincide mucho,
evaluar dedupe/idempotencia en `hora_por_hora`.


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

## Estado actual (snapshot · 2026-06-18)
**Piloto EN VIVO** — `Horacio - Scheduler` ACTIVO, produciendo datos reales.

**Tableros y líderes (17 tableros activos, modelo "1 líder = varios tableros"):**
| Grupo | Tableros | Líder | Alta |
|---|---|---|---|
| SMT | SMT 411&481 · SMT 520 (102/hr ofic.) | Viridiana Escalona | ✅ |
| PTH | PTH · Ola · Soldeo · ICT/FCT · Conformal (Yadira) | Yadira Magdariaga | ✅ ⚠️ *de vacaciones; la cubre Gabriela (ver Relevos)* |
| CONFORMAL | Conformal 1 · Conformal 2 · Grabación · Limpieza · FCT · Pasta/Silicon/Resina · Ensambles · Prueba (FCT) · Empaque | Rocío (Chío) | ✅ |
| EMBARQUES | Embarques (tarjetas retiradas) | Brenda Medina | ✅ |

> *Conformal (Rocío)*: se reintegró con su histórico (sql/014) y se **dividió en 2 tableros**
> (Conformal 1 y 2, sql/020) porque corre 2 modelos a la vez → Rocío lleva **9 tableros**.

**Dueños de escalamiento:** Daniel Nava (paros/Producción; **+ recibe resumen Dirección 17:00**
vía `recibe_resumen`, sql/021) · Nayeli Hernández
(faltantes; **jefa de Embarques**) · Marco Sotelo (calidad; **+ recibe resumen**) ·
Juan Carlos Martínez "JC" (mantenimiento) · Jorge Ramírez (dirección/resumen) ·
**Ivonne (RH)** ⏳ *falta `/start → 🤝 RH` para recibir el feedback de la encuesta*.

**Crons activos (`Horacio - Scheduler` `ilJpIucqEBpKnFgT`, TZ MX, L–V) — 8:** órdenes
`45 6` → ping `35 7-15` → recordatorio `50 7-15` → escala no-captura `58 7-15` →
resumen líder `40 15` → resumen Dirección `0 17` → **encuesta de salida `0 18`** →
**barrido de paros `*/5 6-16`** (lazo cerrado: nag 10 min / escalar 30 min → `admin:paro_sweep`).

**Apps web:** **Dashboard** (Dirección, solo lectura, sin nombres) `…/horacio-dash?token=<DASH_TOKEN>`
(`ng4loQv932n2AIRC`) · **Panel de captura** (supervisión, con escritura, **login por PIN**)
`…/horacio-panel?token=<PANEL_TOKEN>` (`4sJAO9urzrgQowJB`) · **Kiosko de paros** (TV ambiente
oficina/piso, solo lectura, sin nombres de operadora, auto-refresh + cronómetro)
`…/horacio-kiosko?token=<DASH_TOKEN>` (`YjZexqin2re2GLwo`, fuente `n8n/horacio-kiosko.code.js`).
**IA:** plática de la encuesta de salida usa **Claude Haiku** (`ANTHROPIC_API_KEY` en secrets).
**Guía de uso / instructivo:** ver `Horacio - Guia de Uso e Instructivo.md`.

**[2026-06-29] Lazo cerrado de paros + Kiosko + Causa raíz (Fase 1).** Vibe Check:
gracia 10 / escalar 30 · Marco→Jorge · pantalla sin nombre de operadora · captura raíz LLM.
- **BD** `sql/037`: en `horacio.paros` → `notificado_ts·ultimo_recordatorio·escalado_nivel·escalado_ts`
  (lazo) + `causa_raiz·correctiva·analisis_porques(jsonb)·analisis_metodo·analisis_por` (5 porqués).
  Vistas `v_paros_pantalla` (kiosko, sin operadora) y `v_paros_recurrentes` (≥3× en 7d, Fase 2).
- **Bot** (`horacio-bot.code.js`): al abrir paro sella `notificado_ts`; admin `paro_sweep` (nag/escalera);
  al CERRAR lanza **entrevista 5 porqués con Claude Haiku** (`askRoot`/`resumirRoot`, step `paro_root`,
  botón `proot_skip`) → guarda causa raíz + correctiva + cadena. El **acuse corta el nag** (calma todo).
- **Scheduler**: nodo `Cron Paro Sweep` (`*/5 6-16 * * 1-5`) → `POST paro_sweep`. Reactivado.
- **Kiosko** workflow `Horacio - Kiosko` (`YjZexqin2re2GLwo`): TV oscura, tiles por estado
  (soft recién / calm acusado / warn / bad escalado), cronómetro client-side, auto-poll 20s.
  **El acuse calma la pantalla** (azul "Atendiendo: Marco") → cumple "no marcar si ya lo atienden".
- **Bugfix (`sql/038`, verificado E2E):** faltaba `paro_root` en `sesiones_step_check` → 23514/400
  abortaba la entrevista tras cerrar el paro (síntoma: "Ese paro ya estaba cerrado"). Arreglado +
  1ª pregunta fija + prompt 5-porqués reforzado (cierra con `LISTO`, máx 2 preguntas) + closeParo en
  try/catch + doble-tap ya no borra la entrevista + limpia markdown. Probado: causa raíz + cadena se
  guardan, sesión→idle. Commits `5f110c9`+`aaeecb5` pusheados a `chore/graphify-graph`.
- **SIGUIENTES PASOS:**
  1. **Fase 2 — recurrencia ACTIVA:** hoy `v_paros_recurrentes` solo se muestra (badge kiosko). Falta
     que el sistema **avise/dispare metodología de causa raíz formal** cuando un patrón se repite (≥3×/7d)
     y lo sume al resumen a Dirección.
  2. **Poblar `correctiva` más seguido** (hoy `resumirRoot` solo regresa causa; el path `LISTO` sí trae correctiva).
  3. **Dejar la URL del kiosko** (`…/horacio-kiosko?token=<DASH_TOKEN>`) en una TV de oficina y otra de piso.
  4. **Re-prueba de Juan** del flujo del paro en Telegram → ajustar tono de las preguntas si hace falta.
  5. **Merge `chore/graphify-graph`→`main`** (main quedó atrás; PR de limpieza cuando Juan diga).

**Ventanas HxH:** turno 6:30–15:30 → 9 ventanas de :30 (06:30-07:30 … 14:30-15:30).
**Meta/cumplimiento:** Daniel fija OT+meta por tablero con `/orden`; si no hay, usa
estándar oficial; si no, captura conteo (piezas/cajas según `lineas.unidad`).

**Espejo de validación** ON → copia todo `sendMessage` al chat de prueba `5367409334`
(apagar con `VALIDATOR=null` en el bot).

**Pendientes OPERATIVOS (alta de gente, no código):** (1) **Ivonne (RH)** → `/start → 🤝 RH`
para recibir el feedback de la encuesta. (2) **Daniel/Jorge** → abrir el panel y **crear su
PIN**, luego asignar PINs al resto en "Personas / PIN". (3) **Daniel** → `/orden` con
**OT+modelo+meta** de Conformal 1 y 2 (y revisar PTH, que venía reportando >115%).

**Decisiones abiertas:** (1) **Relevo Yadira→Gabriela** (vacaciones): reasignar sus 5
tableros a una persona "Gabriela" nueva. (2) Estándares oficiales de PTH/ola y Conformal
con Ingeniería.

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
**Fix (2026-06-17):** a Brenda no le salía la lista — su sesión venía de un ping
**anterior al deploy** y el snapshot del tablero aún no traía `captura`, así que el
tap caía a la ruta numérica (`action=hxh_board`, no `hxh_board_tj`). Ahora `hxh_board`
**re-consulta `lineas.captura` desde BD** si falta en el snapshot → robusto ante
sesiones abiertas durante un deploy. Probado con sesión "vieja" simulada → abre la lista.
Pendiente UX: Brenda intentó teclear toda la lista en un mensaje ("NP cantidad" ×4);
valorar parseo de texto libre además de los botones. **Decisión:** queda **solo botones**.

### ✅ Tableros de Rocío (Chío): sus 7 sub-procesos (2026-06-18, sql/012)
Rocío pasó de 1 tablero ('Conformal (Rocío)') a **7 pizarrones HxH** propios:
**Grabación · Limpieza · FCT · Pasta/Silicon/Resina · Ensambles · Prueba (FCT) ·
Empaque** (grupo `CONFORMAL`, `no_estandar`, unidad piezas, captura conteo,
supervisor `paros`→Daniel). 'Conformal (Rocío)' (`CONFORMAL_R`) se **desactivó**
(`activa=false`) conservando su historial. Sin cambio de bot (los tableros se leen
en runtime); se limpió la sesión de Rocío para no dejar referencia al tablero viejo.
El ping multi-tablero le llega con los 7 (un botón por sub-proceso). Daniel les fija
meta con `/orden` cuando quiera que entren al % de cumplimiento.

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
**Cumplimiento sin contaminar + bandera de revisar (2026-06-18):** un proceso no puede
superar el 100%. (1) **% por tablero topado a 100** (`pct=min(pctRaw,100)`; se guarda
`pctRaw` real). (2) **Número final capado:** el agregado usa `Σ min(real, meta) / Σ meta`
(cada tablero aporta máx. su meta) → imposible pasar de 100%, un tablero disparado ya no
infla el total. (3) **Bandera `over`** (real > meta×1.05 → >105%): los tableros sobre su
meta se marcan con ⚠️ y se listan en un **aviso ámbar** (`#revisar`/`.revbox`) con su %
real, para revisar si la meta está mal o la captura inflada. Detectó casos reales (PTH 238%,
Conformal-Yadira 126%). El número del KPI sigue siendo `sumReal/sumPlan` pero `sumReal` ya
viene capado. Fuente: `horacio-dash.code.js` (tableros map: pctRaw/pct/over · payload.revisar).

**Backlog R3-HDB dashboard (2026-06-18):** (11) **Bug denominador heartbeat:** `COUNT(l.id)`
se inflaba por el JOIN con hora_por_hora → `COUNT(DISTINCT l.id)`. Esperadas = nº tableros ×
ventanas cerradas (Rocío 8×7=56). (10) KPI **"Acuse prom." → "Tiempo de reacción (7d)"**:
ahora promedio de `duracion_min` de paros **cerrados** (de marcar a cerrar el andón), color por
meta 10–15 min. (12) **Dato sospechoso** sube de >105% a **>115%** (estándar 85% → rango
esperado 85–115%); wording "dato sospechoso". (13) **Gráfica "Cumplimiento por día (7d)"**
(`cSemana`/`semana`): barras por día con cumplimiento capado por proceso (`LEAST(real,meta)`
por línea-día) + promedio de la semana — para la junta. Fuente: `horacio-dash.code.js`.

**Flujo de proceso · cuello · vertientes PTH (2026-06-23):** se reemplazó la lista plana
"Cumplimiento por tablero" por una vista de **flujo storyteller** que responde "¿dónde se
atora?". Capas en `horacio-dash.code.js`:
- **Flujo macro** SMT → PTH → Empaque → Embarques (chips con flecha). **Cuello = etapa con
  más piezas perdidas** (`Σ max(0,plan−real)`) y `pct<90`; se marca en rojo "▲ CUELLO" con
  drill-down de los 3 tableros que más arrastran (causa + "desde HH:MM" = `MIN(hora_slot)`
  con `real<plan*0.8`). Backend: `flujo`, `cuelloDetalle` en el payload; query `tab` ahora
  trae `primer_bajo`; cada tablero lleva `perdidas`.
- Etapas **sin OT/estándar** muestran **producción total + "sin meta hoy"** (no "—"). Ojo:
  `realTotal` suma TODOS los tableros de la etapa (no solo `plan>0`), si no PTH/Empaque salían
  en 0. PTH/Empaque hoy sin estándar → no se mide cumplimiento (pendiente con Daniel).
- Etapas **expandibles** (`▾ estaciones`, `toggleStage`); deep-link **`?open=PTH`** abre una
  etapa al cargar (`openApplied`).
- **PTH abierto = value stream**: 3 vertientes (líneas) en cajas (`renderRama`), marca
  **`↓ baja`** (estación <70% de su anterior) y **`⏸ detenida/sin captura`** (real=0). Las 3
  líneas **convergen** (corchete + "▶ CONVERGE") en el **Acabado común** FCT → Conformal PTH
  (`convergencia:true`). Ruteo en const **`ROUTING`** (config de piso) — promover a tabla
  `horacio.flujo_rutas` si crece. Corrección de piso (Juan): **Ola 2** no existe como estación
  (placeholder, máquina descompuesta); **OLA_3 = "Ola 3"** real de Línea 3. `LABEL_OVERRIDE`.
- Validación antes de deploy: envolver el archivo en `async function(){...}` para `node --check`
  (tiene top-level await/return), y extraer el `<script>` del navegador para `node --check` aparte
  (detecta comillas desbalanceadas dentro de las cadenas). Screenshot: Chrome headless + `?open=`.

**Notas explicativas en los KPIs (2026-06-18):** cada casilla KPI es **tocable** (ícono
ⓘ); al tocarla despliega qué mide (y `title` para hover en escritorio). Textos por KPI en
`kpi(v,l,c,info)` → cumplimiento, tableros reportando, paros abiertos, paro acumulado,
faltantes, calidad, y **acuse prom.** (= minutos de reacción a un paro hasta el "Visto 👍",
7d; mide reacción, no resolución). Sin comillas ASCII en los textos (rompen el string).

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

**Embarques con sección propia + fuera de cumplimiento (2026-06-17):** Embarques
(`captura='tarjetas'`, unidad tarjetas) ya **no** se mezcla con producción: se sacó
de la lista *Cumplimiento por tablero*, del KPI "tableros reportando" y de la gráfica
*Real vs Plan por hora* (filtro `l.captura<>'tarjetas'` — antes sumaba tarjetas con
piezas). Nueva tarjeta **"📦 Embarques — tarjetas retiradas (hoy)"** con mini-stats
(total tarjetas, NP distintos, última hora, última captura MX) + **dos gráficas**
desde `hxh_tarjetas`: **por número de parte** (barras horiz. violeta, top 12) y
**por hora** (barras por ventana HxH). Vacío elegante si no hay tarjetas hoy; la
tarjeta se oculta si no existe ningún tablero `captura='tarjetas'`. `ultimaCap` vía
`to_char(MAX(ts) AT TIME ZONE 'America/Mexico_City')`. Probado e2e con datos temporales
(total/NP/por-hora correctos) y limpiado. Fuente: `n8n/horacio-dash.code.js`.

### ✅ Panel de captura (web, con escritura + trazabilidad) (2026-06-18)
App web **aparte del dashboard** (que es de Dirección, solo lectura, sin nombres):
panel **operativo** para líder de área/supervisión. Workflow **`Horacio - Panel`**
(`4sJAO9urzrgQowJB`, ACTIVO) · Webhook **GET+POST** `/webhook/horacio-panel`
(2 nodos webhook mismo path, distinto método → 1 Code → Respond). Token en URL
(`PANEL_TOKEN` en `scripts/secrets.env`). Mismo estilo claro Powered by NexIA.
- **Trazabilidad (sql/013):** `hora_por_hora` += `origen` (`telegram_lider`|`panel_manual`
  |`sistema`, default telegram) · `capturado_por` · `nota`. Dato **puro** =
  `telegram_lider AND NOT sin_dato`. Los huecos `sin_dato` se re-etiquetaron a `sistema`.
  El bot NO cambió (sus capturas reales cuentan como líder por default).
- **Identidad:** al entrar eliges tu nombre (personas registradas, en localStorage);
  toda escritura manual queda firmada `origen='panel_manual' · capturado_por=<tú>`.
- **4 secciones:** (1) **matriz tablero × ventana HxH** del día con color (verde=líder,
  azul=manual, gris=sin dato, punteado=falta → toca para registrar) y de quién vino;
  (2) **registrar hora faltante** (tablero+ventana+piezas+causa/nota; append-only, rechaza
  si ya hay captura no-sin_dato esa hora); (3) **tableros** (alta/edición: nombre, grupo,
  unidad, captura, supervisor, desactivar); (4) **asignar líder** por tablero.
- Escrituras solo POST, token-checked, validadas (piezas 0–100000), todo `/pg/query`.
  El panel **no manda nada por Telegram**.
- Probado e2e: lecturas (15 tableros, 9 ventanas), backfill firmado, rechazo de duplicado,
  crear/editar/asignar, token malo rechazado, JS del navegador `node --check` OK; datos
  de prueba limpiados. Fuente: `n8n/horacio-panel.code.js` · `sql/013_trazabilidad.sql`.
- **Fix (2026-06-18) "se queda cargando":** el panel usa `localStorage` (identidad) al
  inicio; en navegadores restringidos (**webview interno de Telegram**, modo privado) eso
  **lanza excepción y mataba todo el script** → la página quedaba en "cargando…". El
  dashboard no usa localStorage, por eso ese sí carga. Fix: `lsGet/lsSet` con try/catch +
  arranque envuelto en try (errores ahora visibles en `#sub`). Recomendado abrir el panel
  en navegador real (Chrome/Safari), no en el navegador interno de Telegram.
- **URL:** `https://n8n.nexiasoluciones.com.mx/webhook/horacio-panel?token=<PANEL_TOKEN>`
  (compartir SOLO con supervisión — tiene escritura). Refrescar code:
  `python3 scripts/push_code.py n8n/horacio-panel.code.js 4sJAO9urzrgQowJB "Horacio Panel"`.

### ✅ Panel: login por PIN (cada usuario) (2026-06-18, sql/015)
El panel ahora **exige login (nombre + PIN) para ver Y escribir** (el token de la URL
es el primer candado; el PIN, el segundo). Decisión: **admin asigna los PIN**, login
gatea todo.
- **Modelo (sql/015):** `personas` += `pin_hash` (bcrypt vía `pgcrypto crypt/gen_salt('bf')`)
  · `es_admin` (admins iniciales: **Daniel Nava** y **Jorge Ramírez**, rol paros/direccion)
  · `pin_intentos`/`pin_bloqueo_ts` (5 fallos → bloqueo 15 min). Tabla **`panel_sesiones`**
  (token opaco `gen_random_bytes`, expira 12 h). Todo el cripto se hace en la BD (el Code
  node no necesita librerías).
- **Login:** `data=who` (solo token URL) lista personas para el picker → POST `login`
  {persona_id,pin} → verifica bcrypt en SQL → crea sesión → devuelve token de sesión (el
  cliente lo guarda en sessionStorage, con fallback en memoria si está bloqueado). `data=1`
  exige `&s=<sesión>`; sin sesión → `{code:'auth'}` → el cliente muestra el login.
- **Bootstrap:** el 1er admin SIN PIN lo **crea** (`set_own_pin`, solo admin sin pin) y entra;
  de ahí asigna los demás. Sección **"Personas / PIN"** (solo admin): asignar/resetear PIN
  (`set_pin`) y hacer/quitar admin (`toggle_admin`).
- **Escrituras firmadas por la SESIÓN:** `capturado_por` = nombre verificado de la sesión
  (ya no se confía en un `by` del cliente). Acciones admin (`set_pin`/`toggle_admin`) exigen
  `es_admin`.
- Probado e2e (personas temporales, sin tocar PIN reales): gate sin sesión, bootstrap,
  asignar PIN, login, rechazo de no-admin, backfill firmado, sesión inválida, bloqueo por
  5 intentos; JS navegador OK; limpiado. Fuente: `horacio-panel.code.js` · `sql/015_panel_pin.sql`.
- **Arranque real:** Daniel o Jorge abre el panel → elige su nombre → **crea su PIN** →
  pestaña "Personas / PIN" → asigna PIN a cada quien y lo reparte. Los demás entran con
  nombre + su PIN.

### ✅ Resumen de Dirección — nivel ejecutivo (2026-06-18)
`resumen_dir` (17:00) dejó de ser solo lista por tablero. Ahora abre con un **encabezado
ejecutivo** y aplica el **mismo tope 100%** que el dashboard (`Σ min(real,meta)/Σ meta`,
nada se infla):
- 🏭 **Cumplimiento global** (capado) · 🗒️ **Captura**: tableros que reportaron / total +
  **dato puro vs manual** (de líder / panel / sin dato, vía `origen`) · 🛑 **Paros** (n + min
  + abiertos) · 📦 Faltantes · 🔎 Calidad · ⏱️ **Reacción a paros** (acuse prom 7d) ·
  📦 **Embarques** (tarjetas + NP del día).
- ⚠️ **Revisar meta/captura:** lista los tableros >105% con su % real.
- Detalle **por área con semáforo** (🟢/🟡/🔴 del % capado del grupo); los tableros
  pingueados sin captura se **agrupan** ("· N sin captura") en vez de una línea vacía
  cada uno; las incidencias (paros/faltantes) solo aparecen si las hubo.
- 🔎 **Causa #1 del día** = la causa real más frecuente (**excluye** pausas programadas
  `cuenta_como_paro=false`) — accionable.
- **`preview_chat`** en el admin: `{admin:'resumen_dir',secret,preview_chat:<id>}` manda
  el resumen solo a ese chat y **devuelve el texto** en la respuesta (probar sin avisar a
  Dirección). Fuente: `n8n/horacio-bot.code.js` (admin `resumen_dir`).

### ✅ Paros: acción del dueño + duración confirmada (2026-06-18, sql/016)
Backlog R3-HDB. (4 · R3-HDB-02) Al tocar **"Visto 👍"**, el dueño ahora recibe
*"¿Qué acción vas a tomar?"* → escribe la **acción (inmediata + correctiva/preventiva)**
→ se guarda en `paros.accion` y se le **avisa a la líder** la acción. (6 · R3-HDB-04) Al
tocar **"✅ Ya quedó"** ya no se auto-calcula `now()-ts_inicio` (inflaba: caso SMT 113 min
por cierre tardío); ahora **pregunta la duración real** con botones (15/30/45/60/90/120 +
"Otro…") y guarda ese valor. Steps nuevos `paro_accion`/`paro_dur` (CHECK ampliado, sql/016);
callbacks `pdur_<id>_<min>`/`pdurx_<id>`; helper `closeParo`. Probado e2e (paro de 113 min →
acción guardada + cerrado con 30 min confirmados). Fuente: `n8n/horacio-bot.code.js`.

### ✅ Motivación por hitos del día (2026-06-18, sql/017)
Horacio "da antes de pedir": con el avance del día (capturas / (nº tableros × 9))
manda un mensaje cálido al cruzar **inicio** (1ª captura), **mitad** (≥50%) y
**completo** (100%) — 1 vez/día por líder (tabla `horacio.motivacion`, PK chat+fecha+hito,
`ON CONFLICT DO NOTHING`). Helper `motivar(chat_id)` llamado al inicio de `hxhBoardMenu`
(idempotente). Probado e2e (inicio→mitad→completo). Relacionado: dashboard heartbeat ahora
con denominador fijo del día (nº tableros × 9). Fuente: `n8n/horacio-bot.code.js`.

### ✅ Encuesta de salida + plática con IA (Claude Haiku) (2026-06-18, sql/018)
**Primer uso de LLM en el bot.** Cron **`Cron Encuesta 18:00`** (`0 18 * * 1-5`, en el
Scheduler) → admin **`encuesta_salida`** → a cada líder activa: *"¿cómo estuvo tu día?"*
botones 😀 bien / 😐 normal / 😟 pesado.
- Tap mood (`fbm_<mood>`) → crea fila `horacio.feedback` (mood) → pide texto libre (step
  `fb_texto`). Si responde "no/nada/gracias" → cierra. Si escribe algo → arranca **plática**.
- **Plática IA** (step `fb_chat`): `askHoracio(msgs)` llama a **Claude Haiku**
  (`claude-haiku-4-5-20251001`, `api.anthropic.com/v1/messages` vía `this.helpers.httpRequest`)
  con `FB_SYS` (personalidad de Horacio: cálido, breve, contiene, no diagnostica; si algo
  serio → avisa que lo pasa a RH). Máx **6 turnos**, botón **"✅ Cerrar la plática"** (`fb_cerrar`).
- **Escalación a RH:** si mood = `pesado`, al cerrar marca `feedback.escalado` y avisa a
  `rol='rh'` (Ivonne) **sin compartir el contenido** (solo "tuvo un día pesado, dale
  seguimiento"). Privacidad: feedback NO va al dashboard de Dirección.
- `askArea`/`/start` ahora tiene opción **🤝 Recursos Humanos (Ivonne)** (rol `rh`) para
  que RH se registre y reciba las escalaciones.
- **Secreto:** `ANTHROPIC_API_KEY` en `scripts/secrets.env` (reusada del bot de la tienda;
  sustituida por `push_code.py`, placeholder `<ANTHROPIC_API_KEY>`).
- `preview_chat` en `encuesta_salida` para probar sin avisar al piso. Probado e2e
  (mood pesado → IA conversó → cerró → escalado + feedback guardado). Steps `fb_texto`/`fb_chat`
  y flujo `feedback` (CHECK ampliado, sql/018). Fuente: `n8n/horacio-bot.code.js`.
> ⚠️ Pendiente operativo: registrar a **Ivonne (RH)** con `/start → 🤝 RH` para que las
> escalaciones de feedback lleguen (hoy aún nadie con rol `rh` + chat).
> Workflow scheduler ahora con **7 crons** (se sumó Cron Encuesta 18:00).

### ✅ Corrección de horas con auditoría (2026-06-18, sql/019)
(R3-HDB-15) El **admin** puede corregir una hora ya capturada **sin borrar** (anti-falseo):
una corrección es un **evento nuevo con `corrige_id`** que apunta a la fila sustituida; la
original se **conserva** (valor viejo, quién, cuándo). Los agregados leen de la **vista
`horacio.hxh_vigente`** (= filas no sustituidas), así cuentan solo la corregida.
- **Vista (sql/019):** `hxh_vigente` = `hora_por_hora` sin las filas que tienen un
  `corrige_id` apuntándolas. Se cambió `hora_por_hora`→`hxh_vigente` en **todas las queries
  de agregación**: dashboard (tab, hb, porHora, semana, pareto), panel (matriz + chequeo de
  duplicado), bot (resumen_dir, resumen_lider, motivar). Las de INSERT/tarjetas quedan en la tabla real.
- **Panel:** un admin toca una celda **ya capturada** → "✏️ Corregir" (muestra valor actual)
  → nuevo valor + motivo → `action=correct` (solo `es_admin`): inserta corrección con
  `corrige_id`=fila vigente, `origen='panel_manual'`, `capturado_por`=sesión. No-admin: bloqueado.
- Probado e2e: 50 (líder) → 80 (corrección); original conservado y marcado sustituido;
  vigente=80; no-admin rechazado. Fuente: `sql/019` · dash/panel/bot.

### ✅ OT + modelo por tablero; Conformal en 2 modelos (2026-06-18, sql/020)
(R3-HDB-07) Conformal de Rocío corre **2 modelos a la vez** → se llevan como **2 tableros**:
`CONFORMAL_R` = "Conformal 1 (Rocío)" y nuevo `CONFORMAL_R2` = "Conformal 2 (Rocío)".
Daniel les fija OT + **modelo** + meta por separado con `/orden`.
- **`ordenes_tablero.modelo`** (sql/020). `/orden` ahora pregunta **OT → modelo → meta**
  (step nuevo `orden_modelo`; "-" si no aplica). El modelo se muestra en el **ping**
  ("PTH · OT 4521 · Andromeda, …") y en la **línea del tablero del dashboard**.
- `MODELO_SQL` en `boardsByPid`/`myBoards` (board.modelo); `tab` del dashboard trae modelo.
- Probado e2e: `/orden` → OT-9000 → Andromeda → 120 guardado con modelo. Fuente:
  `sql/020` · `n8n/horacio-bot.code.js` · `horacio-dash.code.js`.
> Con esto queda **cerrado el backlog R3-HDB** (items 4,5,6,8,10,11,12,13) + heartbeat /45,
> motivación por hitos, y encuesta de salida con plática IA.

### ✅ Perfiles + memoria de Horacio (motor) (2026-06-19, sql/022)
Horacio empieza a **personalizar**: aprende de cada plática de salida para acompañar
mejor. Decisión: la IA **sugiere**, **RH valida** (red de seguridad).
- **Modelo (sql/022):** `horacio.perfiles` (persona_id PK · `seed` jsonb de los MD ·
  `aprendido` text CURADO · `sensible` bool, RH-only por defecto) + `perfil_eventos`
  (append-only · `insight` · `mood` · `estado` sugerido|aceptado|descartado).
- **Captura:** al cerrar la plática (`fb_cerrar`/6 turnos), `resumirInsight()` (Claude
  Haiku) saca UNA frase de apoyo (qué la motiva / cómo hablarle, sin diagnóstico) →
  `perfil_eventos` como **`sugerido`**. `guardarInsight()` también hace upsert del perfil.
- **Memoria:** `perfilCtx(pid)` arma el contexto SOLO con lo **curado** (`aprendido` +
  insights `aceptado`) y se inyecta en `askHoracio(msgs, ctx)` (con tacto, nunca citado
  literal). Los `sugerido` NO se reusan hasta que RH los acepte → no compone inferencias sin revisar.
- **Privacidad:** perfiles SOLO para RH/NexIA, nunca en el dashboard; objetivo apoyo, no vigilancia.
- Probado e2e: plática → insight `sugerido` correcto + perfil creado.
- **Import de MD (2026-06-19):** `scripts/import_perfiles.py` parsea
  `Organigrama/02_Contactos/*.md` y carga la ficha a `perfiles.seed` (jsonb, `sensible=true`)
  para las personas que **ya existen** en `personas`. **13 perfiles del bot** = 10 contactos
  + overrides (Rocío (Chío) ← *Rocío Mera Cerón*; Diana Pavón ← *Diana Yasmín Pavón Flores*).
  `aprendido` **vacío** → la ficha (ADKAR/hallazgos) **NO viaja al prompt**; RH la cura.
  **Charly = Juan Carlos Martínez** (mismo señor): se **consolidaron** las 2 personas de
  mantenimiento → quedó **una activa** "Juan Carlos Martínez" (chat …1048, con perfil); la
  otra (chat …2963, 0 escalaciones) quedó **inactiva** ("… (dup inactivo)"). Así la escalación
  de mantenimiento es **única** (antes `LIMIT 1` sin orden podía caer en el chat equivocado).
- **Padrón de RH (sql/023):** `horacio.personal` (tabla aparte, NO liga al bot) con las
  **72 operadoras** de `08_Operadores/` (`scripts/import_padron.py`, idempotente por archivo,
  `sensible=true`). No alimenta a Horacio (las operadoras no usan el bot); es base de RH.
  ⚠️ **`Organigrama/` en `.gitignore`** (ADKAR + demografía) — NUNCA al repo público; los
  datos viven en disco (import) y en Supabase self-hosted (RLS, service_role).
- **✅ Pantalla de revisión RH (2026-06-19):** pestaña **"Perfiles"** en el Panel, visible
  **SOLO a `rol='rh'`** (`puedePerfiles(S)= S.rol==='rh'`; `getSession` trae `rol`). Decisión
  del Director: ni los admins del panel (Daniel/Jorge) la ven — es exclusiva de RH.
  Lee `data=perfiles` (por persona: `aprendido` editable, `sugeridos` con **aceptar/descartar**,
  `aceptados`, y la **ficha** del seed colapsable). Acciones gated: `perfil_estado`
  (sugerido→aceptado/descartado) · `perfil_aprendido` (cura el texto). **Cierra el círculo:**
  plática→`sugerido`→RH acepta/cura→`perfilCtx` (aprendido + aceptados) personaliza la próxima
  plática. Probado e2e (leer/aceptar/curar/gating). Fuente: `n8n/horacio-panel.code.js`.
  > Para que **Ivonne (RH)** use la pestaña: registrarla (`/start → 🤝 RH`) y darle **PIN**
  > (un admin en "Personas / PIN"). Como es RH-only, **nadie** ve Perfiles hasta que Ivonne (u
  > otra persona `rol='rh'`) esté registrada con PIN.

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

### ✅ R3-HDB2 — tanda de mejoras 23-jun (sesión Daniel · "que el bot empuje el número")
> Origen: nota Obsidian *Horacio - Propuesta Mejoras (OTs del sistema, Causas, Capacitación) 2026-06-23*
> + minuta *2026-06-23 - Sesión Mejoras Horacio (Daniel)*. Esta tanda = los 5 quick-wins
> de la sección "Ahora / entrega rápida". El track grande (meta desde OTs, app Plan de
> Producción, capacitación simulada) queda para su propio plan.

- **(R3-HDB2-01) Cumplimiento "fantasma" SMT=306 — diagnosticado + etiquetado.**
  Causa raíz confirmada: el bot calcula `plan` con `COALESCE(meta_hr de /orden, estándar oficial)`
  (`horacio-bot.code.js` línea 48). SMT_520 tiene **estándar oficial TJ000360=102/hr** sembrado,
  así que en un día SIN `/orden` el bot pone `plan=102/h` igual → 3 h × 102 = **306**. No es
  fantasma: es el estándar actuando como meta implícita. Los demás tableros no tienen estándar
  (`plan=null`) → por eso solo SMT mostraba cumplimiento. **Decisión (Juan): NO suprimir** (el
  estándar es la dirección estratégica de "meta objetiva", §1 de la propuesta), sino **etiquetar
  la fuente** en el dashboard: cada tablero ahora dice `OT 0804 · meta 100/h` vs
  `estándar oficial 102/h · sin OT hoy` vs `⚪ sin meta`. Fuente: `horacio-dash.code.js` (campos
  `metaSrc`/`metaLbl`, subquery `est_oficial`).
- **(R3-HDB2-02) Empaque de Chío — ya estaba inactivo.** Verificado: `Empaque 1–5` + `Pasta/Silicon/Resina`
  (`activa=false`). Embarques de **Brenda** (`captura='tarjetas'`) intacto. Sin cambios necesarios.
  → **Hallazgo gordo (R3-HDB2-09):** el abrumamiento real de Chío son **18 tableros ACTIVOS** con
  duplicados del re-import del 19-jun: **6× FCT** (`CONF_FCT` + `FCT_1..5`), `CONF_ENS`+`Ensamble 1/2`,
  `CONF_GRAB`+`Grabación 2/3`, `CONF_PRU`+`Prueba Funcional`. Dos generaciones de nombres mezcladas.
  **Diferido** (no se tocó a ciegas): requiere que Daniel diga cuál set es el bueno (el Excel dice
  FCT=1 máquina, Conformal=5 → `FCT 1–5` puede ser error de import). Ver "Siguientes".
- **(R3-HDB2-03) Iconito de alerta de incumplimiento en el HxH.** En el dashboard, cuando un tablero
  cae **≤70%** y tiene causa capturada, se muestra `🔻 <causa>` en rojo junto a la línea (análogo al
  `⚠️` de sobreproducción). Reusa el `boton_texto` de `causas_paro` (ya trae el iconito ⚙️🛠️📦🔓).
  Fuente: `horacio-dash.code.js` (subquery `causas_hoy` + campos `low`/`causasHoy`).
- **(R3-HDB2-04) Pareto diario además del semanal.** La tarjeta del pareto ahora tiene toggle
  **Hoy / 7 días** (default Hoy). Builder `buildPareto(desdeSql)` reutilizable; payload con
  `paretoDia`/`topAreaDia`. Fuente: `horacio-dash.code.js` (`parMode`, `renderPareto`, `parBtn`).
- **(R3-HDB2-06) Botón admin abrir/cerrar paros (incl. retroactivos).** Nuevo tab **"Paros"** en el
  Panel (solo admin con PIN): lista los paros **abiertos** (cualquier fecha) marcando "hace N día(s)"
  en rojo + cerrados recientes, con botón **Cerrar/Reabrir**. Acción POST `paro_estado` (gated
  `S.es_admin`). **Anti-inflado:** cerrar un paro de día previo deja `duracion_min=NULL` (no
  contamina reacción/paro-acumulado); solo los de HOY calculan duración real. Caso real resuelto:
  2 paros abiertos desde el 19-jun (Ola 3, Soldeo Manual 3). Fuente: `horacio-panel.code.js`
  (acción `paro_estado`, query `paros` en `data=1`, `renderParos`/`doParo`).

> **Validación:** ambas capas de `horacio-dash.code.js` y `horacio-panel.code.js` pasan `node --check`
> (Layer-1 Node + Layer-2 script del navegador reconstruido). Todas las queries nuevas probadas
> contra la BD real vía `/pg/query`. **Deploy pendiente** (Daniel/Director): `dash` `ng4loQv932n2AIRC`
> y `panel` `4sJAO9urzrgQowJB`. El bot NO se tocó.

### ✅ Estándar x Hora + OT en proceso → BD normalizada (2026-06-23, sql/025)
Origen: sesión Juan↔Nayeli (Almacén Mapartel). Se migraron 2 Excel a `horacio.*`:
- **`partes`** (164) — catálogo de tarjetas; clave `(numero_parte, no_parte_ensamble)`,
  `numero_parte` normalizado (UPPER, sin sufijo `_SMT`) para cruzar contra OT.
- **`estandar_proceso`** (1072) — estándar por hora NORMALIZADO: 1 fila por parte×estación,
  `std_hr` + `pzs_turno` + `atributos` jsonb. 15 estaciones: PP_481/520/411_481/421,
  ENSAMBLE_MANUAL, WAVE_SOLDER, SOLDEO_MANUAL, ICT, GRB, CONFORMAL, LIMPIEZA, FCT,
  ENSAMBLES, PRUEBA_FCT, EMPAQUE. (El Excel original tiene 68 col / 3 filas de header.)
- **`ordenes_trabajo`** (39, snapshot `2026-06-23`) — OT en proceso. Cada OT entra como
  `estado_nexia='propuesta'`; Dirección la pasa a `aprobada`/`muerta` (+`motivo_muerte`,
  p.ej. "falta de material") o `cerrada`. Partida `-01`=producto final, `-02`/`-03`=SMT
  (subensamble); `es_smt` derivado. UNIQUE `(orden_trabajo, fecha_snapshot)` → re-cargas UPSERT
  sin pisar el `estado_nexia` que fijó Dirección.
- **Vista `v_ot_inconsistencias`** — flags por OT: `sin_estandar`, `fecha_invalida`
  (vence<orden), `vencida_incompleta`, `pendiente`.

Inconsistencias del 1er snapshot: **15 OT sin estándar usable · 2 fecha imposible · 23 vencidas**.
Matiz: varias "sin estándar" SÍ están en el catálogo pero con la fila vacía (de las ~39
"PENDIENTE VALIDAR ESTÁNDAR" del Excel) — distinto de las que ni existen.
Loader idempotente: `scripts/import_estandar_ot.py "<estandar.xlsx>" "<ot.xlsx>" <YYYY-MM-DD>`.

**Pendiente (Track R3-HDB2-07 — meta automática):** ligar OT→estándar para que la meta por
hora salga sola del número de parte (hoy Daniel la teclea en `/orden`). Para las partidas SMT
cuyo `numero_parte` es un nombre (ANDROMEDA, BLE COMM 2, SENSOR VELOCIDAD, FOCARIS), derivar
el estándar vía el hermano `-01` del mismo `orden_base` (que sí trae PN real en catálogo).

### ✅ Fase 2 V2 — Meta automática OT→estándar (panel de prueba) (2026-06-23, sql/026)
"Que la meta salga sola". **Aislado de Daniel**: SOLO LECTURA, no escribe en `ordenes_tablero`.
- **`linea_proceso`** — mapea cada tablero HxH a su estación del estándar (SMT_520→PP_520,
  PTH→ENSAMBLE_MANUAL, OLA→WAVE_SOLDER, SOLDEO→SOLDEO_MANUAL, ICT→ICT, CONFORMAL_*→CONFORMAL,
  CONF_GRAB→GRB, CONF_EMP→EMPAQUE, CONF_PRU/FCT_*→FCT…). Líneas sin estación (grabación SMT,
  arnés, pasta, embarques) NO se mapean → sin auto-meta (honesto). #revisar: `SMT_411481→PP_411_481`
  y `CONF_PRU→FCT` son los menos seguros.
- **`meta_sugerida(np, proceso)`** — piezas/hr del estándar (promedia variantes de ensamble).
- **`v_ot_parte`** — resuelve parte EFECTIVA: si la fila `-02` SMT tiene nombre (ANDROMEDA…)
  sin estándar propio, usa el hermano `-01` del mismo `orden_base`.
- **`v_ot_meta`** — por OT, meta sugerida por estación + tableros HxH asociados.
- **`v_meta_validacion`** — lo que Daniel teclea (ordenes_tablero vigente) vs estándar.
  Puente del `orden` corto: `'0605' = right(orden_base,4)`.

**Prueba contundente:** en Andromeda G8, **8 metas que Daniel tecleó a mano = el estándar exacto**
(PTH 265, OLA 256, ICT 312, Soldeo 170, Conformal 142, Grabación 260, Empaque 320). En TJ360
tecleó placeholders "100" donde el estándar real es 167/120/107 → el panel lo expone.

**Panel:** workflow n8n **`Horacio V2`** (`jVWVm7tDoxsO1kbw`), Webhook GET `/horacio-v2`,
fuente `n8n/horacio-v2.code.js`. Token = `DASH_TOKEN` (reusado). 3 pestañas: Meta automática
por OT · Validación vs Daniel · Inconsistencias. **Inactivo** → Daniel/Juan lo activa en la UI.
URL: `https://n8n.nexiasoluciones.com.mx/webhook/horacio-v2?token=<DASH_TOKEN>`.
Verificado local (render + screenshot headless) antes de activar.
**Pendiente para cablear a producción:** validar mapeo `linea_proceso` con Juan, luego auto-sugerir
la meta en `/orden` del bot (hoy Daniel teclea; V2 confirma que el número correcto está en BD).

#### + Plan del día / propuesta vs estándar (2026-06-23, sql/027)
Vista **`v_plan_dia`**: por OT (separada **SMT** -02/-03 vs **PTH/final** -01) calcula la
**estación cuello de botella** (menor std_hr de la ruta del área), `capacidad_dia = std_cuello×8h`,
`dias_necesarios = ceil(pend/cap_dia)`, `dias_a_vencer`, `plan_diario_cumplir = ceil(pend/dias_a_vencer)`
y **`factible`** (¿alcanza antes de vencer?). Responde "¿por qué tardas en cerrar una orden?".
Panel V2: pestaña **"Plan del día"** (default), tablas SMT/PTH + KPI "factibles a tiempo".
Hallazgo de datos: muchas OT ya vencidas (días negativos → no factible); algunos cuellos con std
muy bajo (p.ej. FCT TJ000255 @28/hr) podrían ser estándar dudoso del Excel #revisar.

#### + Warning + comentario dentro de la orden (2026-06-23, sql/028)
Columna `ordenes_trabajo.comentario` (libre; en Fase 3 lo captura manufactura). El panel muestra
las inconsistencias COMO warning dentro de cada orden: badges inline (Sin estándar / Fecha imposible
/ Vencida / No alcanza / Completa) + al expandir, el mensaje explicativo en voz de Horacio + el
comentario. Gotcha resuelto: `onclick` inline con `\'` se colapsa dentro del template literal y rompe
el JS del navegador → usar handler delegado (`querySelectorAll(...).onclick`). El doble `node --check`
NO lo cazó (revisa el código pre-evaluación); validar con **mock-DOM sobre el HTML ya servido**.

### ✅ Fase 3 — Flujo "víbora" + captura errónea por estación (2026-06-24, sql/030-031)
"La planta corre como víbora": SMT → PTH → Empaque → Embarques; lo que cierra un día alimenta
al siguiente. Se **sincronizó el HxH que ya capturan las líderes** con el flujo, sin captura nueva.
- **`v_vibora_dia`** (sql/030) — pzs por macro-etapa (`lineas.grupo`) y día = el pulso.
  Hallazgo de modelado (decisión con Juan): sumar todos los tableros de PTH/Empaque **infla por
  doble conteo** (una pieza pasa por varias estaciones en serie). El pulso se muestra como
  "actividad por etapa" (no conservación estricta); el WIP exacto va **por OT**.
- **`v_vibora_ot`** (sql/031) — WIP EXACTO por orden: `smt_term − fin_term` (SMT y final son 1:1
  por `orden_base`). `posicion`: en_smt / esperando_pth / en_final / terminada / sin_avance.
  Ej real: 260300801 (TJ360) WIP 1563; 260600501 (05-1829-B1) SMT 50/50 pero final 0/50 = 50 esperando PTH.
- **Warning captura errónea:** el pulso marca en rojo los días donde Embarques > Empaque
  (empaque sub-captura, o se embarcó de inventario previo) — el caso 495 vs 2066 que vio Juan.
- Panel V2: tab **"Flujo víbora"** (pulso diario + serpientes por OT con barras SMT→Final y WIP).

### ✅ Editor de estándar en el panel — cierra el problema original (2026-06-24)
El motivo de migrar el Excel a BD era poder **ajustar lo faltante** (39 filas vacías, 34 partes sin
estándar, 14 de OT en proceso). Faltaba la captura/edición → agregado al panel V2:
- POST `set_estandar` (token-gated): upsert `estandar_proceso` por `(numero_parte, proceso)`; crea la
  parte si no existe (ON CONFLICT); std vacío = borra; valida proceso ∈ 15 + valor>0. service_role.
- Tab **"Estándar (capturar)"**: selector de parte (agrupado: ⚠ sin estándar de OT en proceso →
  prioridad, sin estándar, con estándar para editar) + grid de las 15 estaciones con inputs (amarillo
  = vacío), guarda al salir del campo. Al llenar una parte, su meta y plan salen solos al recargar.
- El panel V2 ya **escribe** (motivo + estándar) en tablas nuevas; "solo lectura" actualizado en banner.

### ✅ Programa / secuenciador hacia adelante (2026-06-24)
Tab **"Programa"** en el panel V2 — para que Daniel/equipo **jueguen** con la secuencia y vean
"a qué día nos ponemos al corriente". 100% cálculo en el navegador (usa `v_plan_dia`, sin SQL nuevo):
- **Botones de estrategia** (reordena + recalcula al instante): `Vencidas primero` (EDD),
  `Las que aún se pueden cumplir` (factibles primero por vence asc, las irrecuperables al final),
  `Mayor pendiente primero`.
- **Capacidad ajustable**: inputs líneas SMT / PTH (default 2 / 3) → colas paralelas por área.
- Proyección: por OT `horas = pendiente/std_cuello`; día hábil = 8 h × líneas; acumula por área →
  `inicia → termina` por orden + badge a tiempo/tarde + titular "te pones al corriente: <fecha>".
- OT sin estándar salen listadas como **no programables** (capturar en tab Estándar).
- **Precedencia SMT→final** (2026-06-24): se programa SMT primero (guarda finOff por `orden_base`);
  el FINAL no arranca antes de que cierre su SMT (inserta espera; marca "(espera SMT)"). Dos
  secciones en la tabla. Día hábil sin saltar domingos (afinable).
- **Control con 3 líderes — HxH mínimo sugerido** (2026-06-24): con 1 líder por área (SMT–Viridiana,
  PTH–Yadira, Conformal/Empaque), recomienda capturar solo el **cuello de cada área** (estación que
  marca el ritmo, por frecuencia en las OT) → 1–2 tableros por líder en vez de 15. `liderDe(proceso)`
  mapea estación→área. Calculado de `v_plan_dia`.

### ✅ Programa oficial — drag & drop + lanzar como oficial (2026-06-24, sql/033)
Sobre el tab "Programa": Dirección **reordena las OT arrastrándolas con el mouse** (override de la
estrategia) y con un botón **"Lanzar como programa oficial"** congela ese orden + fechas como
referencia vigente. Decisión: **referencia congelada** (no toca `ordenes_tablero` ni el flujo de
Daniel) + **drag dentro de cada sección** (SMT / Final por separado, respeta precedencia SMT→final).
- **BD (sql/033):** `programa_oficial` (maestro: estrategia_base, lineas_smt/pth, fecha_meta,
  dias_habiles, nota, **vigente**) + `programa_oficial_ot` (detalle congelado: area CHECK(SMT|PTH),
  posicion, orden_trabajo, parte, pendiente, cuello, std, inicia, termina, tarde_dias, espera_smt).
  Vista `v_programa_vigente`. RLS service_role. Cada lanzamiento marca `vigente=false` el anterior
  (versionado, queda histórico) — verificado: 2 lanzamientos → 1 vigente.
- **POST `lanzar_programa`** (token-gated): valida items no vacío (≤500), area ∈ (SMT,PTH),
  orden_trabajo no vacío; UPDATE vigente=false + INSERT maestro RETURNING id + INSERT N detalle.
  Sanitiza num/date/text. Rechaza área inválida sin escribir (probado en vivo).
- **Cliente:** `state.order{SMT,PTH}` = orden manual (null = estrategia). `ordered(area)` aplica el
  orden manual o la estrategia. Drag HTML5 nativo (handle ⠿, `draggable` por fila), `reorder()`
  mueve "from" antes de "to" → `render()` recalcula fechas con el mismo scheduler. Botón estrategia
  resetea a auto; badge "Orden manual ✎ (reiniciar)" cuando hay override. Card **"Programa oficial
  vigente"** (lee `progOficial` del GET) arriba del tab. "Lanzar" arma el payload del `schedule()`
  actual y POSTea; estrategia_base='manual' si hubo drag.
- **Validación (regla MEMORY):** doble `node --check` (archivo envuelto + script navegador extraído)
  + **mock-DOM** sobre el HTML servido (15 asserts: render arrastrable, drag→reorder→recalcula,
  lanzar→payload+card vigente). Gotcha cazado por el check del archivo: **un backtick en un comentario
  rompe el template literal `PAGE`** (cierra el `` ` ``) — usar comillas, nunca backticks dentro de PAGE.

### ✅ Refresco de OT desde "Reporte detalle OTS" del ERP (2026-06-26, sql/034)
Mapartel compartió **dos** exports del ERP: *Reporte general OTS* y *Reporte detalle OTS* (447 OT
c/u). El **detalle es superset del general** → fuente ÚNICA (el general se descartó). Reemplaza la
carga curada anterior (39 OT `Proce` snapshot 2026-06-23) por el **universo completo al 2026-06-26**.
- **Gotcha del ERP:** la columna rotulada **"Tiempo Estimado" = cantidad TERMINADA/producida** (no
  tiempo); columna **"% Avance" = terminada/ordenada**. Verificado: `terminada ≤ ordenada` en las 447,
  `%avance` cuadra en 428/447 (resto = lotes 0/0). Resuelve la falta de avance del general.
- **Fechas mixtas:** el ERP mezcla celdas con formato fecha (openpyxl → `datetime`) y texto `DD/MM/YY`
  → parser de dos casos (0 nulas en las 447).
- **Status ERP → estado_nexia:** Cance→`muerta` (2) · Cerra→`cerrada` (344) · resto→`propuesta` (101
  = Liber 41 + Proce 39 + Regis 20 + Progr 1).
- **BD (sql/034):** `+pct_avance numeric`. **Las vistas con `SELECT o.*` (v_ot_parte) congelan su lista
  de columnas al crearse** → DROP+recreate en orden de dependencia para que tomen la columna nueva
  (no basta CREATE OR REPLACE: reordena columnas → error). `v_ot_meta`/`v_plan_dia`/`v_ot_inconsistencias`
  ahora **excluyen `cerrada`** (si no, 344 cerradas inundan el panel); `v_vibora_ot` se mantiene
  (cerrada = WIP 0 = flujo completado). Las vistas **no filtran por snapshot** → el loader deja **una
  sola foto** (migra comentario/motivo del snapshot viejo y borra los demás).
- **Loader:** `scripts/import_detalle_ots.py "<detalle.xlsx>" <YYYY-MM-DD> --single [--dry]` (idempotente,
  UPSERT orden_trabajo+snapshot). Corrido en vivo: 447 OT, 1 snapshot, comentario migrado.
- **Panel sin deploy:** el Code node V2 lee las vistas en `/pg/query` en cada request → info ya viva.
- **Diagnósticos destapados (del ERP, no de la carga):** 42 OT activas sin estándar · 40 con
  `fecha_vence < fecha_orden` → las marca `v_ot_inconsistencias` para que Dirección revise.
- **Pendiente opcional:** mostrar `pct_avance` en las cards del panel (hoy se expone en las vistas
  pero el front aún no lo pinta).

### ✅ Análisis subensamble-compartido + 2 mejoras de UI panel V2 (2026-06-26)
A raíz de la duda "SMT hizo 2000 pero PTH 1500 en la OT 251200814" (parte 225D7291G006 / ANDROMEDA):
- **Causa raíz:** el subensamble SMT es **común a varias tarjetas finales** (ANDROMEDA→6 variantes). SMT no
  corre 1:1 por orden; el sobrante de una orden alimenta a otra. **57.5% del volumen terminado** (118,749/
  206,499 pzs) rompe el supuesto 1:1 de `v_vibora_ot`. **14 subensambles afectados**, en 2 modos: (A) ratio
  **2:1 constante** (panel/UoM: FOCARIS_CTRL_[H], 222D8835G004…) y (B) **pool compartido** multi-variante.
  Hallazgo clave: el ratio **depende de la tarjeta final, no del subensamble** (FOCARIS_CTRL_[F]: 1:1 para
  222D9519G025, 2:1 para los 295D2311). → la regla correcta es por **(subensamble × modelo)**.
- **Doc para reunión con el cliente:** `docs/REUNION_subensambles_vibora_2026-06-26.md` (4 patrones con OTs
  reales, checklist de salida: BOM subens/tarjeta + manejo de inventario de subensamble, anexo de los 14).
  Pendiente: con esos datos, cambiar la víbora a `SMT_term vs final_term × factor` + pool por subensamble.
- **UI panel V2 (`horacio-v2.code.js`):** (1) **Meta automática** — botón **"✕ quitar"** junto al selector de
  motivo (`motclear`), deshace el `motivo_no_corre` (el backend `set_motivo` ya aceptaba motivo vacío→NULL;
  faltaba el control). Sale oculto si la OT no tiene motivo. (2) **Flujo víbora** — chips de etapa ahora
  **clicables para filtrar** las OT (en SMT / esperando PTH / en final / terminada + "todas"); cada fila lleva
  `data-pos`, filtro por `classList fhide`. Validado: doble `node --check` (el #1 NO ve el browser script
  porque vive en el template `PAGE` → extraer incluyendo el `(function(){` de apertura) + mock-DOM + dump
  headless del DOM real. Desplegado en caliente (push_code.py → workflow `jVWVm7tDoxsO1kbw`).

### ⏳ Siguientes (al 2026-06-23)
- [x] **Escritura V2 (selector de motivo) operativa** ✅ — POST `/horacio-v2` con catálogo cerrado
  (falta_material/personal/maquina/otros). Causa raíz del 404: el nodo webhook POST agregado por
  API quedó **sin `webhookId`** → n8n no registra el método; se le puso uno y se reactivó.
- [x] **(Fase 3) Calendario detallado por hora** ✅ — tab **Calendario** en panel V2: expande el
  programa oficial vigente a **bloques por hora** ("de tal a tal hora corre esta OT"), por área
  (SMT/PTH), con Gantt + agenda imprimible + navegador de día. Modelo de horario **parametrizable**
  (`horacio.calendario_config`, sql/035): inicio/fin de turno, liberación (1ª hora) y media hora de
  comida → recalcula horas productivas. Es un RENDER (no escribe horarios). Duración = pendiente ÷
  (std_cuello × nº líneas). Marca ⚠ vence/no alcanza. Para verlo con datos: lanzar un programa en el
  tab Programa. **Fase B pendiente: carriles por línea física** (hoy 1 carril por área).
- [x] **V1.5 — Captura de meta in-app + sugerencia desde estándar** ✅ — tab **Metas del día** en el
  panel V1 (`horacio-panel`). Fija la meta desde el panel (misma `ordenes_tablero` que `/orden`,
  `origen='panel'`) y **sugiere** meta = estándar teórico × prorrateo (`calendario_config`) acotado
  por pendiente; ajustar pide motivo (5-porqués). Motor `meta_sugerida_tablero()` (sql/036) reusa el
  de V2. Gobierno: `personas.puede_meta` (Marco+Jesica) / `puede_estandar` (Gaby). **Pendiente: alta
  de Gaby en personas + PIN** para que pueda fijar meta/validar estándar.
- [x] **OT desde el sistema (no captura manual)** ✅ — el selector de OT del tab Metas se llena de
  `ordenes_trabajo` (export "en proceso"), filtrado por área del tablero (SMT→OT SMT, resto→final).
  Loader nuevo `scripts/import_ot_proceso.py` para el formato limpio "OT PROCESO" (NP directo, cant
  reales, ESTATUS='Proce', trae sufijo `_SMT`). Cargadas **48 OT vigentes** (foto única 2026-06-29,
  reemplazó las 447 del 06-26, comentarios migrados). ⚠ Fechas del ERP sucias (vence<inicio en varias).
- [x] **Estándar capturable en V1** ✅ — tab **Estándar** en el panel (mismo motor `set_estandar` que
  V2: editor por parte × 15 estaciones, prioriza partes de OT en proceso sin estándar). Gateado a
  `puede_estandar`/admin. Gaby actualiza lo que falta **sin ver V2**. (Pendiente: alta de Gaby + PIN.)
- [x] **Paros = tablero vivo** ✅ — tab **Paros vivos**: tarjetas con **cronómetro que corre solo**
  (1s, desde `ts_inicio`), color por antigüedad, y **a quién se escaló** (dueño por rol del tablero).
- [ ] **(C) Escalamiento robusto** — PROPUESTA (Vibe Check pendiente): lazo cerrado con **acuse**
  (✅ Atiendo), **nag** persistente y **escalera** de escalamiento; el tablero vivo es el canal pull.
  Cambia bot+scheduler. Doc: `docs/Horacio-Propuesta-Escalamiento-Robusto.md`.
- [ ] **(Fase 3) Captura directa por manufactura:** extender la escritura V2 a **avance/cantidad
  terminada** por OT (cierra el loop, sin importar Excel) + quién/cuándo (trazabilidad).
- [x] **(Fase 3) Warning de captura errónea por estación** ✅ — en tab Flujo víbora: pulso diario
  marca en rojo donde Embarques > Empaque (sub-captura o WIP previo). Ver sql/030.
- [x] **(Fase 3) Flujo "víbora" gráfico** ✅ — tab Flujo víbora: pulso diario por etapa + WIP exacto
  POR OT (serpiente SMT→Final con WIP entre etapas). Ver sql/030-031.
- [ ] **(R3-HDB2-09) Dedupe tableros de Chío:** 18 activos con duplicados (FCT/Ensamble/Grabación)
  del re-import 19-jun. Definir con Daniel cuál set conservar + fijar tope por líder (~4–6).
- [ ] **(R3-HDB2-05) Refinar causas:** agregar "liberación de máquina" (Calidad), englobar, acotar
  "Otra cosa" a lo extraordinario. Confirmar con líderes (Yadira SMT tiene causas distintas).
- [ ] **Track grande (proyecto aparte):** R3-HDB2-07 meta desde OTs del sistema · R3-HDB2-11 app
  Plan de Producción (avance % por OT) · R3-HDB2-13 estándar oficial en `horacio.estandares`
  (Std_Actual.xlsx: 1,083 estándares) + planificador con escenarios · R3-HDB2-08 capacitación
  simulada · R3-HDB2-12 puente tarjeta↔OT. Ya hay datos: Excel de Daniel + export `090626 OT PROCESO.txt`.
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
- Workflow panel: `4sJAO9urzrgQowJB` (Horacio - Panel, GET+POST `/horacio-panel`) · fuente `n8n/horacio-panel.code.js`
- Schema: `horacio` · migraciones en `sql/001`…`sql/015`
- Secreto extra: `PANEL_TOKEN` en `scripts/secrets.env` (token del panel de captura)
- Secretos (no en git): `scripts/secrets.env` → BOT_TOKEN, SERVICE_ROLE_KEY, ADMIN_SECRET, DASH_TOKEN
- Deploy de un Code node: `python3 scripts/push_code.py <archivo> <workflow_id> "<node>"`
- Chat de prueba / espejo de validación: `5367409334`
