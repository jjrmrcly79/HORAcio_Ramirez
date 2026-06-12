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

### 🔌 Encendido para el piloto (R2-07) — checklist
1. Cada **líder** hace `/start` al bot y elige su línea (auto-registro).
2. Cada **dueño** (paros/faltantes/calidad/mantenimiento/dirección) hace `/dueno`.
3. Confirmar **SLAs firmados** (Daniel Nava, Nayeli).
4. (Opcional) resetear altas de prueba: `UPDATE horacio.personas SET chat_id=NULL, consentimiento=false;`
5. **Activar** el workflow `Horacio - Scheduler` en la UI de n8n. ← esto enciende los pings.
   (Hoy hay 5 altas apuntando al chat de prueba 5367409334 para demo.)

### ⏳ Siguientes (post día-uno)
- [ ] Estándares reales de CIL3 / Andromeda + líderes (datos #revisar)
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
