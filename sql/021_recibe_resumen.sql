-- ============================================================
-- Horacio · 021 — Recibir el resumen de Dirección sin cambiar de rol
-- Daniel Nava es rol='paros' (lo necesita para las escalaciones), pero además
-- debe recibir el resumen ejecutivo de las 17:00. Una persona tiene UN rol, así
-- que se agrega una bandera independiente `recibe_resumen`: el resumen_dir va a
-- quien tenga rol direccion/resumen O `recibe_resumen=true`.
--   Acceso solo vía /pg/query (service_role).
-- ============================================================
ALTER TABLE horacio.personas ADD COLUMN IF NOT EXISTS recibe_resumen boolean NOT NULL DEFAULT false;

UPDATE horacio.personas SET recibe_resumen = true WHERE nombre = 'Daniel Nava';
