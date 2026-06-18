-- ============================================================
-- Horacio · 013 — Trazabilidad del HxH (de quién viene el dato)
-- Para el Panel de captura: distinguir dato "puro" (lo subió la líder por
-- Telegram) de lo registrado a mano por supervisión, y firmar quién lo metió.
--   origen: 'telegram_lider' (default) | 'panel_manual' | 'sistema'
--   capturado_por: nombre de quien registró a mano (panel)
--   nota: motivo/observación de la captura manual
-- "Dato puro" = origen='telegram_lider' AND NOT sin_dato.
-- El bot NO cambia: sus capturas reales cuentan como 'telegram_lider' por default.
--   Acceso solo vía /pg/query (service_role).
-- ============================================================
ALTER TABLE horacio.hora_por_hora
  ADD COLUMN IF NOT EXISTS origen        text NOT NULL DEFAULT 'telegram_lider',
  ADD COLUMN IF NOT EXISTS capturado_por text,
  ADD COLUMN IF NOT EXISTS nota          text;

ALTER TABLE horacio.hora_por_hora DROP CONSTRAINT IF EXISTS hph_origen_check;
ALTER TABLE horacio.hora_por_hora ADD CONSTRAINT hph_origen_check
  CHECK (origen = ANY (ARRAY['telegram_lider','panel_manual','sistema']));

-- Las filas auto-cerradas como hueco (sin_dato) son del sistema, no de la líder
UPDATE horacio.hora_por_hora SET origen='sistema'
 WHERE sin_dato = true AND origen = 'telegram_lider';
