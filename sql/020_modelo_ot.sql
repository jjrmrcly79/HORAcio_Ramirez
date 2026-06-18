-- ============================================================
-- Horacio · 020 — OT + modelo por tablero; Conformal con 2 modelos
-- (R3-HDB-07) Conformal de Rocío corre 2 tarjetas/modelos a la vez →
--   se llevan como 2 tableros ("Conformal 1" y "Conformal 2"), y al fijar la
--   orden (/orden) Daniel captura OT + MODELO + meta por cada uno.
-- Se agrega `ordenes_tablero.modelo` y el step de sesión `orden_modelo`.
--   Acceso solo vía /pg/query (service_role).
-- ============================================================
ALTER TABLE horacio.ordenes_tablero ADD COLUMN IF NOT EXISTS modelo text;

-- Conformal (Rocío) → "Conformal 1 (Rocío)" + nuevo "Conformal 2 (Rocío)"
UPDATE horacio.lineas SET nombre = 'Conformal 1 (Rocío)' WHERE codigo = 'CONFORMAL_R';
INSERT INTO horacio.lineas
  (codigo, nombre, grupo, orden, estandar_status, unidad, captura, supervisor_rol, lider_persona_id, activa)
SELECT 'CONFORMAL_R2', 'Conformal 2 (Rocío)', 'CONFORMAL', 9, 'no_estandar', 'piezas', 'conteo', 'paros',
       (SELECT id FROM horacio.personas WHERE nombre = 'Rocío (Chío)' LIMIT 1), true
WHERE NOT EXISTS (SELECT 1 FROM horacio.lineas WHERE codigo = 'CONFORMAL_R2');

-- step nuevo para capturar el modelo en /orden
ALTER TABLE horacio.sesiones DROP CONSTRAINT sesiones_step_check;
ALTER TABLE horacio.sesiones ADD CONSTRAINT sesiones_step_check
  CHECK (step = ANY (ARRAY[
    'idle','hxh_menu','hxh_meta','hxh_piezas','hxh_causa','hxh_real',
    'hxh_tj_pick','hxh_tj_np','hxh_tj_cant',
    'paro_causa','paro_abierto','paro_dur','paro_accion',
    'falt_linea','falt_parte','falt_abierto','cal_descripcion',
    'orden_menu','orden_ot','orden_modelo','orden_meta',
    'fb_texto','fb_chat'
  ]));
