-- ============================================================
-- Horacio · 010 — Supervisor por tablero (escalamiento de no-captura)
-- El aviso de "no subió su HxH" (:58) debe ir al jefe de ESA líder, no
-- siempre a Daniel. Producción → Daniel (rol paros); Embarques → Nayeli
-- (rol faltantes, jefa de embarques). Se agrega `supervisor_rol` a lineas.
-- ============================================================
ALTER TABLE horacio.lineas ADD COLUMN IF NOT EXISTS supervisor_rol text NOT NULL DEFAULT 'paros';
UPDATE horacio.lineas SET supervisor_rol = 'faltantes' WHERE codigo = 'EMBARQUES';
