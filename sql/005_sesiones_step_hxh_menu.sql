-- ============================================================
-- Horacio · 005 — Permitir step 'hxh_menu' en sesiones
-- El ping multi-tablero usa un step nuevo 'hxh_menu' (menú de
-- tableros pendientes). El CHECK original no lo incluía → /pg/query
-- devolvía 23514 (HTTP 400) y el ping abortaba sin guardar sesión.
-- ============================================================
ALTER TABLE horacio.sesiones DROP CONSTRAINT sesiones_step_check;
ALTER TABLE horacio.sesiones ADD CONSTRAINT sesiones_step_check
  CHECK (step = ANY (ARRAY[
    'idle','hxh_menu','hxh_meta','hxh_piezas','hxh_causa','hxh_real',
    'paro_causa','paro_abierto','falt_linea','falt_parte','falt_abierto',
    'cal_descripcion'
  ]));
