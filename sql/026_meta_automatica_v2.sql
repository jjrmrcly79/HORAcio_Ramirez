-- ============================================================
-- Horacio · 026 — Fase 2 (V2): meta automática OT → estándar
-- Liga ordenes_trabajo/ordenes_tablero al estándar normalizado para
-- PROPONER la meta por hora sin que Daniel la teclee. SOLO LECTURA:
-- nada de esto escribe en ordenes_tablero (flujo de Daniel intacto).
-- Superficie de prueba para Juan (panel /horacio-v2).
-- Acceso vía /pg/query (service_role).
-- ============================================================

-- ------------------------------------------------------------
-- 1. LINEA_PROCESO — mapea cada tablero/línea HxH a su estación del estándar
--    (líneas sin estación en el estándar NO se listan → quedan sin auto-meta)
--    #revisar con Juan/Daniel: SMT_411481 y CONF_PRU son los menos seguros.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS horacio.linea_proceso (
  linea_codigo text PRIMARY KEY REFERENCES horacio.lineas(codigo) ON DELETE CASCADE,
  proceso      text NOT NULL,
  CONSTRAINT linea_proceso_proceso_chk CHECK (proceso = ANY (ARRAY[
    'PP_481','PP_520','PP_411_481','PP_421','ENSAMBLE_MANUAL','WAVE_SOLDER',
    'SOLDEO_MANUAL','ICT','GRB','CONFORMAL','LIMPIEZA','FCT','ENSAMBLES',
    'PRUEBA_FCT','EMPAQUE']))
);
ALTER TABLE horacio.linea_proceso ENABLE ROW LEVEL SECURITY;
GRANT ALL ON horacio.linea_proceso TO service_role;

INSERT INTO horacio.linea_proceso (linea_codigo, proceso) VALUES
  ('SMT_520','PP_520'), ('SMT_411481','PP_411_481'),
  ('PTH','ENSAMBLE_MANUAL'), ('PTH_LINEA_2','ENSAMBLE_MANUAL'), ('PTH_LINEA_3','ENSAMBLE_MANUAL'),
  ('OLA','WAVE_SOLDER'), ('OLA_3','WAVE_SOLDER'),
  ('SOLDEO','SOLDEO_MANUAL'), ('SOLDEO_MANUAL_2','SOLDEO_MANUAL'), ('SOLDEO_MANUAL_3','SOLDEO_MANUAL'),
  ('ICT','ICT'), ('ICT_1','ICT'), ('ICT_2','ICT'), ('ICT_3','ICT'),
  ('CONFORMAL_Y','CONFORMAL'), ('CONFORMAL_R','CONFORMAL'), ('CONFORMAL_R2','CONFORMAL'),
  ('CONF_GRAB','GRB'), ('GRABACI_N_2','GRB'), ('GRABACI_N_3','GRB'),
  ('CONF_LIMP','LIMPIEZA'),
  ('CONF_FCT','FCT'), ('CONF_PRU','FCT'), ('FCT_1','FCT'), ('FCT_2','FCT'), ('FCT_3','FCT'),
  ('FCT_4','FCT'), ('FCT_5','FCT'),
  ('PRUEBA_FUNCIONAL','PRUEBA_FCT'),
  ('CONF_ENS','ENSAMBLES'), ('ENSAMBLE_1','ENSAMBLES'), ('ENSAMBLE_2','ENSAMBLES'),
  ('CONF_EMP','EMPAQUE'), ('EMPAQUE_2','EMPAQUE'), ('EMPAQUE_3','EMPAQUE'),
  ('EMPAQUE_4','EMPAQUE'), ('EMPAQUE_5','EMPAQUE')
ON CONFLICT (linea_codigo) DO UPDATE SET proceso = EXCLUDED.proceso;

-- ------------------------------------------------------------
-- 2. meta_sugerida(numero_parte, proceso) → piezas/hr del estándar
--    (promedia variantes de ensamble; NULL si no hay estándar)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION horacio.meta_sugerida(p_numero_parte text, p_proceso text)
RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT round(avg(ep.std_hr), 1)
  FROM horacio.partes p
  JOIN horacio.estandar_proceso ep ON ep.parte_id = p.id
  WHERE p.numero_parte = upper(trim(p_numero_parte)) AND ep.proceso = p_proceso
$$;
GRANT EXECUTE ON FUNCTION horacio.meta_sugerida(text, text) TO service_role;

-- ------------------------------------------------------------
-- 3. v_ot_parte — resuelve la parte EFECTIVA para el estándar:
--    si la fila de la OT no tiene estándar propio (típico de las -02 SMT
--    con nombre tipo ANDROMEDA), usa el hermano -01 del mismo orden_base.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW horacio.v_ot_parte AS
SELECT o.*,
  CASE WHEN EXISTS (
         SELECT 1 FROM horacio.partes p JOIN horacio.estandar_proceso e ON e.parte_id = p.id
         WHERE p.numero_parte = o.numero_parte)
       THEN o.numero_parte
       ELSE sib.numero_parte END AS numero_parte_efectivo
FROM horacio.ordenes_trabajo o
LEFT JOIN horacio.ordenes_trabajo sib
  ON sib.orden_base = o.orden_base AND sib.partida = '01'
 AND sib.fecha_snapshot = o.fecha_snapshot AND o.es_smt;

-- ------------------------------------------------------------
-- 4. v_ot_meta — POR OT, la meta sugerida por estación (núcleo del panel V2)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW horacio.v_ot_meta AS
SELECT v.orden_trabajo, v.numero_parte, v.numero_parte_efectivo, v.descripcion,
       v.partida, v.es_smt, v.estado_nexia,
       v.cant_ordenada, v.cant_terminada,
       GREATEST(COALESCE(v.cant_ordenada,0) - COALESCE(v.cant_terminada,0), 0) AS pendiente,
       v.fecha_vence,
       ep.proceso,
       round(avg(ep.std_hr), 0) AS meta_hr_sugerida,
       count(DISTINCT p.id)     AS variantes,
       (SELECT string_agg(lp.linea_codigo, ', ' ORDER BY lp.linea_codigo)
          FROM horacio.linea_proceso lp WHERE lp.proceso = ep.proceso) AS tableros
FROM horacio.v_ot_parte v
JOIN horacio.partes p ON p.numero_parte = v.numero_parte_efectivo
JOIN horacio.estandar_proceso ep ON ep.parte_id = p.id
GROUP BY v.orden_trabajo, v.numero_parte, v.numero_parte_efectivo, v.descripcion,
         v.partida, v.es_smt, v.estado_nexia, v.cant_ordenada, v.cant_terminada,
         v.fecha_vence, ep.proceso;

-- ------------------------------------------------------------
-- 5. v_meta_validacion — lo que Daniel tecleó (ordenes_tablero vigente)
--    vs lo que el estándar sugiere. Puente: orden corto "0605" = right(orden_base,4).
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW horacio.v_meta_validacion AS
WITH base AS (
  SELECT ot.id, ot.fecha, l.codigo AS linea, l.nombre, ot.orden, ot.modelo,
         ot.meta_hr AS meta_daniel, lp.proceso
  FROM horacio.ordenes_tablero ot
  JOIN horacio.lineas l       ON l.id = ot.linea_id
  JOIN horacio.linea_proceso lp ON lp.linea_codigo = l.codigo
  WHERE ot.vigente
)
SELECT b.fecha, b.linea, b.nombre, b.orden, b.modelo, b.proceso,
       b.meta_daniel,
       o.orden_trabajo, o.numero_parte,
       horacio.meta_sugerida(o.numero_parte, b.proceso) AS meta_sugerida,
       CASE WHEN horacio.meta_sugerida(o.numero_parte, b.proceso) IS NULL THEN NULL
            ELSE round(b.meta_daniel - horacio.meta_sugerida(o.numero_parte, b.proceso), 1)
       END AS diferencia
FROM base b
LEFT JOIN horacio.ordenes_trabajo o
  ON o.partida = '01'
 AND (b.orden = o.orden_trabajo OR (length(b.orden) = 4 AND b.orden = right(o.orden_base, 4)));

GRANT SELECT ON horacio.v_ot_parte, horacio.v_ot_meta, horacio.v_meta_validacion TO service_role;
