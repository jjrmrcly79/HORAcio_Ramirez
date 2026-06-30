-- ============================================================
-- Horacio · 034 — Reporte DETALLE OTS como fuente única de OT + avance
-- El "Reporte detalle OTS" del ERP trae el universo completo (447 OT) CON avance:
--   · col "Tiempo Estimado" (nombre engañoso del ERP) = cantidad TERMINADA/producida
--   · col "% Avance"        = terminada / ordenada  → se guarda en pct_avance
--   · Status                = Cerra/Liber/Proce/Regis/Cance/Progr → status_origen
-- Mapeo de status del ERP a estado_nexia (workflow Nexia):
--   Cance → 'muerta'  ·  Cerra → 'cerrada'  ·  resto → 'propuesta'
-- Las vistas de TRABAJO ACTIVO excluyen además 'cerrada' para no inundar el panel
-- con 344 OT terminadas (la víbora SÍ las conserva: WIP 0 = flujo completado).
-- Loader: scripts/import_detalle_ots.py
-- ============================================================

-- ------------------------------------------------------------
-- 1. pct_avance — % de avance oficial del ERP (faithful a la fuente)
--    Se recrean las vistas dependientes: v_ot_parte usa SELECT o.* (congela
--    su lista de columnas al crearse), así que hay que dropearla y recrearla
--    para que tome la columna nueva. DROP en orden inverso de dependencia.
-- ------------------------------------------------------------
ALTER TABLE horacio.ordenes_trabajo
  ADD COLUMN IF NOT EXISTS pct_avance numeric;

DROP VIEW IF EXISTS horacio.v_ot_inconsistencias;
DROP VIEW IF EXISTS horacio.v_ot_meta;
DROP VIEW IF EXISTS horacio.v_plan_dia;
DROP VIEW IF EXISTS horacio.v_ot_parte;

-- v_ot_parte — resuelve la parte EFECTIVA (hereda el o.* ya con pct_avance)
CREATE VIEW horacio.v_ot_parte AS
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
-- 2. v_ot_meta — excluye 'muerta' y 'cerrada'; expone pct_avance
-- ------------------------------------------------------------
CREATE VIEW horacio.v_ot_meta AS
SELECT v.orden_trabajo, v.numero_parte, v.numero_parte_efectivo, v.descripcion,
       v.partida, v.es_smt, v.estado_nexia,
       v.cant_ordenada, v.cant_terminada, v.pct_avance,
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
WHERE v.estado_nexia NOT IN ('muerta','cerrada')
GROUP BY v.orden_trabajo, v.numero_parte, v.numero_parte_efectivo, v.descripcion,
         v.partida, v.es_smt, v.estado_nexia, v.cant_ordenada, v.cant_terminada,
         v.pct_avance, v.fecha_vence, ep.proceso;

-- ------------------------------------------------------------
-- 3. v_plan_dia — excluye 'cerrada' en la base; expone pct_avance
-- ------------------------------------------------------------
CREATE VIEW horacio.v_plan_dia AS
WITH base AS (
  SELECT v.orden_trabajo, v.orden_base, v.partida, v.es_smt,
         v.numero_parte, v.numero_parte_efectivo, v.descripcion, v.estado_nexia,
         v.cant_ordenada, v.cant_terminada, v.pct_avance,
         GREATEST(COALESCE(v.cant_ordenada,0) - COALESCE(v.cant_terminada,0), 0) AS pendiente,
         v.fecha_vence,
         CASE WHEN v.es_smt THEN 'SMT' ELSE 'PTH' END AS area
  FROM horacio.v_ot_parte v
  WHERE v.estado_nexia NOT IN ('muerta','cerrada')
),
rate AS (
  SELECT b.*,
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
  r.cant_ordenada, r.cant_terminada, r.pct_avance, r.pendiente, r.fecha_vence,
  r.proceso_cuello,
  round(r.std_cuello, 0)                                       AS std_cuello_hr,
  (r.fecha_vence - CURRENT_DATE)                              AS dias_a_vencer,
  round(r.std_cuello * 8, 0)                                  AS capacidad_dia,
  CASE WHEN r.std_cuello > 0 THEN ceil(r.pendiente / (r.std_cuello * 8)) END AS dias_necesarios,
  CASE WHEN (r.fecha_vence - CURRENT_DATE) > 0
       THEN ceil(r.pendiente::numeric / (r.fecha_vence - CURRENT_DATE)) END AS plan_diario_cumplir,
  CASE WHEN r.std_cuello > 0 AND (r.fecha_vence - CURRENT_DATE) > 0
       THEN (ceil(r.pendiente / (r.std_cuello * 8)) <= (r.fecha_vence - CURRENT_DATE))
       WHEN r.std_cuello > 0 AND (r.fecha_vence - CURRENT_DATE) <= 0
       THEN false END                                          AS factible
FROM rate r
WHERE r.pendiente > 0;

-- ------------------------------------------------------------
-- 4. v_ot_inconsistencias — excluye 'muerta' y 'cerrada'; expone pct_avance
-- ------------------------------------------------------------
CREATE VIEW horacio.v_ot_inconsistencias AS
SELECT o.orden_trabajo, o.numero_parte, o.descripcion, o.partida, o.es_smt,
       o.cant_ordenada, o.cant_terminada, o.pct_avance,
       GREATEST(COALESCE(o.cant_ordenada,0) - COALESCE(o.cant_terminada,0), 0) AS pendiente,
       o.fecha_orden, o.fecha_vence, o.estado_nexia,
       NOT EXISTS (
         SELECT 1 FROM horacio.v_ot_meta m WHERE m.orden_trabajo = o.orden_trabajo
       ) AS sin_estandar,
       (o.fecha_vence < o.fecha_orden) AS fecha_invalida,
       (o.fecha_vence < CURRENT_DATE
         AND COALESCE(o.cant_terminada,0) < COALESCE(o.cant_ordenada,0)) AS vencida_incompleta
FROM horacio.ordenes_trabajo o
WHERE o.estado_nexia NOT IN ('muerta','cerrada');

GRANT SELECT ON horacio.v_ot_meta, horacio.v_plan_dia, horacio.v_ot_inconsistencias TO service_role;
