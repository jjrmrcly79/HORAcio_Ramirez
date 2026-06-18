-- ============================================================
-- Horacio · 014 — Reintegrar Conformal (Rocío) con su histórico
-- En sql/012 se DESACTIVÓ 'Conformal (Rocío)' (CONFORMAL_R) al pasar Rocío
-- a sus 7 sub-procesos. Ahora se reintegra el tablero TAL CUAL (misma fila /
-- mismo linea_id) → conserva TODO su historial: 37 filas HxH (1182 pzs,
-- 12–18 jun). Sigue siendo de Rocío (Chío), grupo CONFORMAL, orden 8
-- (queda antes de los 7 sub-procesos, orden 10–16).
--   Acceso solo vía /pg/query (service_role).
-- ============================================================
UPDATE horacio.lineas SET activa = true WHERE codigo = 'CONFORMAL_R';
