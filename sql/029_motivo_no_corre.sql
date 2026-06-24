-- ============================================================
-- Horacio · 029 — Motivo por el que la OT no puede correr (captura V2)
-- Catálogo CERRADO: falta_material | falta_personal | maquina | otros.
-- Primer paso de ESCRITURA de Fase 3: el equipo lo selecciona en el panel
-- V2 (POST token-gated). Escribe solo en ordenes_trabajo (Daniel intacto).
-- ============================================================
ALTER TABLE horacio.ordenes_trabajo
  ADD COLUMN IF NOT EXISTS motivo_no_corre text,
  ADD COLUMN IF NOT EXISTS motivo_ts       timestamptz;

ALTER TABLE horacio.ordenes_trabajo DROP CONSTRAINT IF EXISTS ot_motivo_no_corre_chk;
ALTER TABLE horacio.ordenes_trabajo ADD CONSTRAINT ot_motivo_no_corre_chk
  CHECK (motivo_no_corre IS NULL OR motivo_no_corre = ANY (ARRAY[
    'falta_material','falta_personal','maquina','otros']));
