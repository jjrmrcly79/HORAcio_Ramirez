-- ============================================================
-- Horacio · 027 — Fase 2 (V2): Plan del día / propuesta vs estándar
-- Cruza OT pendiente + fecha de entrega + estándar para proponer:
--   · estación cuello de botella (la más lenta de la ruta del área)
--   · capacidad/día a estándar · días necesarios · días a vencer
--   · ritmo/día requerido para cumplir a tiempo · ¿factible?
-- Separa por ÁREA: SMT (partidas -02/-03) vs PTH/final (-01).
-- SOLO LECTURA. 8 h productivas/día (turno 6:30-15:30, 1ª hora liberación).
-- ============================================================

CREATE OR REPLACE VIEW horacio.v_plan_dia AS
WITH base AS (
  SELECT v.orden_trabajo, v.orden_base, v.partida, v.es_smt,
         v.numero_parte, v.numero_parte_efectivo, v.descripcion, v.estado_nexia,
         v.cant_ordenada, v.cant_terminada,
         GREATEST(COALESCE(v.cant_ordenada,0) - COALESCE(v.cant_terminada,0), 0) AS pendiente,
         v.fecha_vence,
         CASE WHEN v.es_smt THEN 'SMT' ELSE 'PTH' END AS area
  FROM horacio.v_ot_parte v
  WHERE v.estado_nexia <> 'muerta'
),
rate AS (
  SELECT b.*,
    -- cuello = estación MÁS LENTA (menor std_hr) de la ruta del área
    (SELECT min(ep.std_hr)
       FROM horacio.partes p JOIN horacio.estandar_proceso ep ON ep.parte_id = p.id
      WHERE p.numero_parte = b.numero_parte_efectivo
        AND ( (b.area = 'SMT' AND ep.proceso IN ('PP_481','PP_520','PP_411_481','PP_421'))
           OR (b.area = 'PTH' AND ep.proceso NOT IN ('PP_481','PP_520','PP_411_481','PP_421')) )
    ) AS std_cuello,
    (SELECT ep.proceso
       FROM horacio.partes p JOIN horacio.estandar_proceso ep ON ep.parte_id = p.id
      WHERE p.numero_parte = b.numero_parte_efectivo
        AND ( (b.area = 'SMT' AND ep.proceso IN ('PP_481','PP_520','PP_411_481','PP_421'))
           OR (b.area = 'PTH' AND ep.proceso NOT IN ('PP_481','PP_520','PP_411_481','PP_421')) )
      ORDER BY ep.std_hr ASC LIMIT 1
    ) AS proceso_cuello
  FROM base b
)
SELECT
  r.orden_trabajo, r.orden_base, r.partida, r.area, r.es_smt,
  r.numero_parte, r.numero_parte_efectivo, r.descripcion, r.estado_nexia,
  r.cant_ordenada, r.cant_terminada, r.pendiente, r.fecha_vence,
  r.proceso_cuello,
  round(r.std_cuello, 0)                                       AS std_cuello_hr,
  (r.fecha_vence - CURRENT_DATE)                              AS dias_a_vencer,
  round(r.std_cuello * 8, 0)                                  AS capacidad_dia,        -- 8 h productivas
  CASE WHEN r.std_cuello > 0 THEN ceil(r.pendiente / (r.std_cuello * 8)) END AS dias_necesarios,
  CASE WHEN (r.fecha_vence - CURRENT_DATE) > 0
       THEN ceil(r.pendiente::numeric / (r.fecha_vence - CURRENT_DATE)) END AS plan_diario_cumplir,
  CASE WHEN r.std_cuello > 0 AND (r.fecha_vence - CURRENT_DATE) > 0
       THEN (ceil(r.pendiente / (r.std_cuello * 8)) <= (r.fecha_vence - CURRENT_DATE))
       WHEN r.std_cuello > 0 AND (r.fecha_vence - CURRENT_DATE) <= 0
       THEN false END                                          AS factible
FROM rate r
WHERE r.pendiente > 0;

GRANT SELECT ON horacio.v_plan_dia TO service_role;
