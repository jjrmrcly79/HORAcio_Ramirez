-- ============================================================
-- Horacio · 012 — Tableros de Rocío (Chío): sus 7 sub-procesos
-- Rocío pasa de 1 tablero ('Conformal (Rocío)') a 7 pizarrones HxH:
--   Grabación · Limpieza · FCT · Pasta/Silicon/Resina · Ensambles ·
--   Prueba (FCT) · Empaque
-- 'Conformal (Rocío)' (CONFORMAL_R) se DESACTIVA (deja de pinguearse)
-- pero su historial queda intacto. Todos grupo CONFORMAL, sin estándar
-- (Daniel les pone meta con /orden), unidad piezas, captura por conteo.
--   Acceso solo vía /pg/query (service_role).
-- ============================================================

-- 1. Desactivar el tablero actual (conserva historial / FKs)
UPDATE horacio.lineas SET activa = false WHERE codigo = 'CONFORMAL_R';

-- 2. Alta de los 7 sub-procesos de Rocío (idempotente por codigo)
INSERT INTO horacio.lineas
  (codigo, nombre, grupo, orden, estandar_status, unidad, captura, supervisor_rol, lider_persona_id, activa)
SELECT v.codigo, v.nombre, 'CONFORMAL', v.orden, 'no_estandar', 'piezas', 'conteo', 'paros',
       (SELECT id FROM horacio.personas WHERE nombre = 'Rocío (Chío)' LIMIT 1), true
FROM (VALUES
  ('CONF_GRAB', 'Grabación',             10),
  ('CONF_LIMP', 'Limpieza',              11),
  ('CONF_FCT',  'FCT',                    12),
  ('CONF_PSR',  'Pasta/Silicon/Resina',  13),
  ('CONF_ENS',  'Ensambles',             14),
  ('CONF_PRU',  'Prueba (FCT)',          15),
  ('CONF_EMP',  'Empaque',               16)
) AS v(codigo, nombre, orden)
WHERE NOT EXISTS (SELECT 1 FROM horacio.lineas l WHERE l.codigo = v.codigo);
