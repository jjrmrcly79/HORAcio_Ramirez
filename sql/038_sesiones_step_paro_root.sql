-- ============================================================
-- Horacio · 038 — Agregar step 'paro_root' al CHECK de horacio.sesiones
-- ------------------------------------------------------------
-- BUG (2026-06-29): la entrevista de causa raíz hace setSess('paro','paro_root',...)
-- pero 'paro_root' NO estaba en el CHECK de la columna step → 23514 (HTTP 400) →
-- el nodo Code abortaba tras cerrar el paro y la entrevista nunca arrancaba.
-- Gotcha Nexia conocido: ampliar SIEMPRE el CHECK ANTES de usar un step/rol nuevo.
-- ============================================================
ALTER TABLE horacio.sesiones DROP CONSTRAINT IF EXISTS sesiones_step_check;
ALTER TABLE horacio.sesiones ADD CONSTRAINT sesiones_step_check CHECK (step = ANY (ARRAY[
  'idle',
  'hxh_menu','hxh_meta','hxh_piezas','hxh_causa','hxh_real','hxh_tj_pick','hxh_tj_np','hxh_tj_cant',
  'paro_causa','paro_abierto','paro_dur','paro_accion','paro_root',
  'falt_linea','falt_parte','falt_abierto',
  'cal_descripcion',
  'orden_menu','orden_ot','orden_modelo','orden_meta',
  'fb_texto','fb_chat'
]));
