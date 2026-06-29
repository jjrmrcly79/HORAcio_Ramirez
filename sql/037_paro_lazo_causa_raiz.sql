-- ============================================================
-- Horacio · 037 — Lazo cerrado de paros + captura de causa raíz + pantalla
-- ------------------------------------------------------------
-- Fase 1 de "escalamiento robusto + pantalla ambiente":
--   (A) columnas para el lazo cerrado (nag + escalera) sobre horacio.paros
--       (acuse_ts y escalado_a ya existían en 001).
--   (B) columnas de análisis de causa raíz (5 porqués LLM) en el cierre.
--   (C) vista v_paros_pantalla → la TV de oficina/piso (sin nombres de operadora).
--   (D) vista v_paros_recurrentes → Fase 2: detectar paros repetitivos.
-- Todo ADITIVO / IF NOT EXISTS — no destructivo, no toca datos existentes.
-- Decisiones (Vibe Check 2026-06-29): gracia 10 / escalar 30 · Marco→Jorge ·
--   pantalla sin nombre de quien reportó · captura raíz LLM-guiada (5 porqués).
-- ============================================================

-- (A) Lazo cerrado ------------------------------------------------------------
ALTER TABLE horacio.paros ADD COLUMN IF NOT EXISTS notificado_ts       timestamptz; -- 1ra notificación al dueño
ALTER TABLE horacio.paros ADD COLUMN IF NOT EXISTS ultimo_recordatorio timestamptz; -- último nag enviado
ALTER TABLE horacio.paros ADD COLUMN IF NOT EXISTS escalado_nivel      int DEFAULT 0; -- 0=dueño(Marco) · 1=dirección(Jorge)
ALTER TABLE horacio.paros ADD COLUMN IF NOT EXISTS escalado_ts         timestamptz; -- cuándo subió de nivel

-- Backfill: los paros ya existentes se consideran ya notificados al crearse,
-- para que el barrido (cron) no los trate como "recién" ni los re-notifique en masa.
UPDATE horacio.paros SET notificado_ts = ts_inicio WHERE notificado_ts IS NULL;

-- (B) Análisis de causa raíz (se llena al CERRAR el paro) ----------------------
-- contención inmediata = paros.accion (ya existe, se captura en el acuse).
ALTER TABLE horacio.paros ADD COLUMN IF NOT EXISTS causa_raiz        text;  -- 1 frase (resumen LLM de los 5 porqués)
ALTER TABLE horacio.paros ADD COLUMN IF NOT EXISTS correctiva        text;  -- acción correctiva/preventiva sugerida/acordada
ALTER TABLE horacio.paros ADD COLUMN IF NOT EXISTS analisis_porques  jsonb; -- cadena [{p:"pregunta",r:"respuesta"}] del 5-porqués
ALTER TABLE horacio.paros ADD COLUMN IF NOT EXISTS analisis_metodo   text DEFAULT '5porques';
ALTER TABLE horacio.paros ADD COLUMN IF NOT EXISTS analisis_por      bigint; -- chat_id de quien hizo el análisis al cerrar

-- (C) Pantalla ambiente (kiosko) — solo paros ABIERTOS, sin nombres de operadora
DROP VIEW IF EXISTS horacio.v_paros_pantalla;
CREATE VIEW horacio.v_paros_pantalla AS
SELECT
  p.id,
  l.nombre                                            AS linea,
  l.grupo,
  COALESCE(cp.boton_texto, '—')                       AS causa,
  p.estado,
  p.ts_inicio,
  (extract(epoch FROM p.ts_inicio) * 1000)::bigint    AS inicio_ms,
  (p.acuse_ts IS NOT NULL)                            AS acusado,
  CASE WHEN p.acuse_ts IS NOT NULL
       THEN (extract(epoch FROM p.acuse_ts) * 1000)::bigint END AS acuse_ms,
  COALESCE(p.escalado_nivel, 0)                       AS escalado_nivel,
  -- "atiende": el supervisor por rol (Marco/Jorge) — NUNCA la operadora que reportó.
  COALESCE(
    pe.nombre,
    (SELECT x.nombre FROM horacio.personas x
       WHERE x.rol = COALESCE(l.supervisor_rol, 'paros') AND x.activa AND x.chat_id IS NOT NULL
       ORDER BY x.created_at LIMIT 1)
  )                                                    AS atiende,
  ((now() AT TIME ZONE 'America/Mexico_City')::date
   - (p.ts_inicio AT TIME ZONE 'America/Mexico_City')::date)::int AS dias
FROM horacio.paros p
JOIN horacio.lineas l       ON l.id = p.linea_id
LEFT JOIN horacio.causas_paro cp ON cp.codigo = p.causa_codigo
LEFT JOIN horacio.personas pe    ON pe.id = p.escalado_a
WHERE p.estado = 'abierto'
ORDER BY p.ts_inicio;

-- (D) Recurrencia — Fase 2: misma línea + misma causa ≥3 veces en 7 días
DROP VIEW IF EXISTS horacio.v_paros_recurrentes;
CREATE VIEW horacio.v_paros_recurrentes AS
SELECT
  l.nombre                                  AS linea,
  l.grupo,
  COALESCE(cp.boton_texto, '—')             AS causa,
  p.linea_id,
  p.causa_codigo,
  COUNT(*)::int                             AS veces_7d,
  COALESCE(SUM(p.duracion_min), 0)::int     AS min_7d,
  MAX(p.ts_inicio)                          AS ultimo
FROM horacio.paros p
JOIN horacio.lineas l            ON l.id = p.linea_id
LEFT JOIN horacio.causas_paro cp ON cp.codigo = p.causa_codigo
WHERE p.ts_inicio >= now() - interval '7 days'
  AND p.causa_codigo IS NOT NULL
GROUP BY l.nombre, l.grupo, cp.boton_texto, p.linea_id, p.causa_codigo
HAVING COUNT(*) >= 3
ORDER BY veces_7d DESC, min_7d DESC;

GRANT SELECT ON horacio.v_paros_pantalla, horacio.v_paros_recurrentes
  TO anon, authenticated, service_role;
