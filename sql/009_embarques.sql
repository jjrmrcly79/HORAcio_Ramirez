-- ============================================================
-- Horacio · 009 — Tablero Embarques (Brenda Medina)
-- Brenda Medina (Líder de Embarque, reporta a Nayeli) captura cuántas
-- CAJAS retira del piso → realidad de lo que está listo para embarcar.
-- Se agrega columna `unidad` a lineas para que el HxH pregunte en la
-- unidad correcta (cajas/piezas) por tablero.
-- ============================================================
ALTER TABLE horacio.lineas ADD COLUMN IF NOT EXISTS unidad text NOT NULL DEFAULT 'piezas';

-- Persona (se liga su chat con /start → línea → Embarques)
INSERT INTO horacio.personas (nombre, rol, chat_id, consentimiento, activa)
SELECT 'Brenda Medina', 'lider', NULL, false, true
WHERE NOT EXISTS (SELECT 1 FROM horacio.personas WHERE nombre = 'Brenda Medina');

-- Tablero Embarques (sin estándar; unidad = cajas)
INSERT INTO horacio.lineas (codigo, nombre, grupo, orden, estandar_status, unidad, lider_persona_id, activa)
SELECT 'EMBARQUES', 'Embarques (cajas retiradas)', 'EMBARQUES', 9, 'no_estandar', 'cajas',
       (SELECT id FROM horacio.personas WHERE nombre = 'Brenda Medina' LIMIT 1), true
WHERE NOT EXISTS (SELECT 1 FROM horacio.lineas WHERE codigo = 'EMBARQUES');
