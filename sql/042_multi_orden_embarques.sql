-- ============================================================
-- Horacio · 042 — Múltiples órdenes por tablero (scoped por flag)
-- Embarques (y cualquier tablero que se prenda) maneja VARIAS órdenes con
-- UNA sola meta (el ritmo del tablero). Se guarda UNA fila vigente en
-- ordenes_tablero con `orden` = lista separada por comas → bot y dashboard
-- (que solo MUESTRAN `orden`, sin JOIN, LIMIT 1) no cambian.
-- Los demás tableros (multi_orden=false) siguen igual: una OT.
-- ============================================================

ALTER TABLE horacio.lineas ADD COLUMN IF NOT EXISTS multi_orden boolean DEFAULT false;

-- Prender SOLO en Embarques por ahora.
UPDATE horacio.lineas SET multi_orden=true WHERE codigo='EMBARQUES';
