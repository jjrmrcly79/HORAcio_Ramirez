-- ============================================================
-- Horacio · 016 — Paros: acción del dueño + duración confirmada
-- (R3-HDB-02) Al acusar un paro, el dueño escribe la ACCIÓN tomada
--   (inmediata + correctiva/preventiva) → se guarda en paros.accion y
--   se avisa a la líder.
-- (R3-HDB-04) Al cerrar ("ya quedó") se PREGUNTA la duración real (botones
--   de minutos / "otro") para no inflar duracion_min por cierre tardío.
-- Steps nuevos de sesión: paro_dur (capturar minutos), paro_accion (texto).
--   Acceso solo vía /pg/query (service_role).
-- ============================================================
ALTER TABLE horacio.paros ADD COLUMN IF NOT EXISTS accion text;

-- Ampliar el CHECK de sesiones.step ANTES de usar los steps nuevos
ALTER TABLE horacio.sesiones DROP CONSTRAINT sesiones_step_check;
ALTER TABLE horacio.sesiones ADD CONSTRAINT sesiones_step_check
  CHECK (step = ANY (ARRAY[
    'idle','hxh_menu','hxh_meta','hxh_piezas','hxh_causa','hxh_real',
    'hxh_tj_pick','hxh_tj_np','hxh_tj_cant',
    'paro_causa','paro_abierto','paro_dur','paro_accion',
    'falt_linea','falt_parte','falt_abierto','cal_descripcion',
    'orden_menu','orden_ot','orden_meta'
  ]));
