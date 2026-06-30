# Horacio — Propuesta: escalamiento robusto (cerrar el lazo)
> 2026-06-29 · Detona: Juan — "el esquema de quién tiene abierto en Telegram es muy endeble".
> Toca bot (`VKb215KJk5TdEsEY`) + scheduler (`ilJpIucqEBpKnFgT`) — requiere Vibe Check antes de construir.

## 1. Por qué el esquema actual es endeble
Hoy, cuando un tablero no se captura o se reporta un paro, Horacio manda **un solo mensaje**
de Telegram al dueño del rol (`ownerOf('paros')` = primer activo con ese rol). De ahí en
adelante **el sistema no sabe nada**: depende de que esa persona **tenga Telegram abierto**, lo
vea y actúe. Sin acuse, sin reintento, sin reasignación, sin visibilidad. Si el dueño está
ocupado/ausente, el paro queda **invisible y sin atender** — y nadie se entera.

## 2. Principio del rediseño: lazo cerrado + dos canales
1. **Acuse explícito (closed-loop):** el notificado debe tocar **✅ Voy / Atiendo**. Hasta que
   no acuse, el paro está **"sin atender"** — el sistema lo sabe.
2. **Recordatorio persistente (nag):** mientras esté abierto y sin acuse, Horacio **re-notifica**
   cada T1 min (no una sola vez).
3. **Escalera de escalamiento:** sin acuse en T2 min → sube al **siguiente nivel** (jefe / Marco /
   Dirección). Configurable por rol.
4. **El tablero vivo como segundo canal (ya desplegado, B):** el panel muestra TODO paro abierto
   con cronómetro + a quién se escaló + estado de acuse. **No depende de Telegram**: cualquiera
   que mire el tablero puede actuar. Push (Telegram) + pull (tablero) = resiliencia.

## 3. Estados del paro (máquina de estados)
```
abierto → notificado → acusado(atendiendo por X) → resuelto
                 │              │
            (nag cada T1)  (si tarda, recordatorio de cierre)
                 │
            (T2 sin acuse → escalado nivel+1 → notifica al backup)
```

## 4. Modelo de datos (extender `horacio.paros`)
```sql
ALTER TABLE horacio.paros
  ADD COLUMN notificado_ts        timestamptz,   -- 1ra notificación enviada
  ADD COLUMN acuse_ts             timestamptz,   -- cuándo alguien dijo "voy"
  ADD COLUMN acuse_por            text,          -- quién acusó
  ADD COLUMN ultimo_recordatorio  timestamptz,   -- último nag
  ADD COLUMN escalado_nivel       int DEFAULT 0, -- 0=dueño, 1=backup, 2=dirección
  ADD COLUMN escalado_ts          timestamptz;
-- (alternativa: tabla paro_eventos append-only para auditoría completa)
```
Escalera por rol en config (tabla `escalamiento_ladder` o columna en `personas`/`config`):
`paros → (nivel0) dueño paros · (nivel1) jefe producción · (nivel2) dirección`.

## 5. Mecánica (bot + scheduler) — patrón ya probado en Nexia
- **Al abrir paro:** notificar al dueño con botones inline **[✅ Atiendo] [✅ Resuelto]**; set
  `notificado_ts`. (Hoy ya se notifica; solo se agregan botones + sello.)
- **Cron nuevo (cada ~5 min, `scheduleTrigger` → RPC token-gated, anon key — patrón del MEMORY):**
  para cada paro `abierto`:
  - sin acuse y `now-notificado > T1` → re-notifica (nag) + `ultimo_recordatorio`.
  - sin acuse y `now-notificado > T2` → `escalado_nivel++`, notifica al backup, `escalado_ts`.
  - con acuse y `now-acuse > T3` sin resolver → recordatorio suave de cierre.
- **Callbacks del bot:** `paro_acuse` → set `acuse_ts/por`, "Gracias, en camino", **corta el nag**;
  `paro_resuelto` → cierra (reusa el cierre actual).
- **Panel (B, ya vivo):** agregar a la tarjeta el **estado de acuse** (sin atender / atendiendo
  por X desde hh:mm), botón **"recordar ahora"** y **"reasignar"**. Cierra el lazo sin Telegram.

## 6. SLA / métrica (lo que vuelve esto medible)
- **Tiempo a acuse** (notificado→acuse) y **tiempo a resolución** (abierto→resuelto).
- Breach de T2 = escalamiento automático (no manual).
- Dashboard Dirección: # paros sin atender, tiempo promedio a acuse, % escalados.

## 7. Decisiones para el Vibe Check
1. **Tiempos:** T1 (re-notificar) y T2 (escalar). *Propuesta:* nag cada **10 min**, escalar a los
   **30 min** sin acuse.
2. **Escalera por rol:** ¿quién es el backup? *Propuesta:* paros → dueño → **Marco (producción)** →
   **Jorge (dirección)**. Faltantes → Nayeli → Marco. Calidad → calidad → Marco.
3. **¿El líder que reportó ve el estado** (acusado/en camino) para no quedar "a ciegas"?
4. **Alcance inicial:** arrancar solo con **paros** (lo doloroso); HxH-no-capturado después.

## 8. Por qué NO se construye aún
Cambia el comportamiento del **bot en vivo** y agrega un **cron nuevo** (Daniel/tú activan
manualmente en n8n). Es un cambio de mecánica en producción → requiere tu aprobación de tiempos
y escalera antes de tocar. El **tablero vivo (B) ya quedó** como el primer paso (canal pull).
