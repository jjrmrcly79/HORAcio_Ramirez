-- ============================================================
-- Horacio · 043 — Fase 2: WIP por SUBENSAMBLE sobre el pareo (reemplaza el 1:1 por orden_base)
-- La víbora vieja (v_vibora_ot) unía SMT↔final por orden_base asumiendo 1:1 → falsos
-- atorones. Aquí el WIP se agrupa a nivel SUBENSAMBLE usando pareo_smt (1:N).
--   wip_mas_buffer = SMT terminado − Σ finales terminados (pooled).
-- ⚠️ v1: mezcla buffer intencional (stock seguridad) + posible sobreconteo por niveles
--    PTH+PT — falta el factor de cantidad (2:1, Brenda/Gabriela). Directional, sin el
--    falso atoron por-orden. SOLO LECTURA.
-- ============================================================
CREATE OR REPLACE VIEW horacio.v_wip_smt AS
WITH subs AS (
  SELECT parte_smt FROM horacio.pareo_smt WHERE vigente
  UNION SELECT parte_smt FROM horacio.subensambles_smt
),
smt AS (
  SELECT horacio.norm_np(numero_parte) AS parte_smt,
         SUM(COALESCE(cant_terminada,0))::bigint AS smt_term,
         SUM(COALESCE(cant_ordenada,0))::bigint  AS smt_ord
  FROM horacio.ordenes_trabajo
  WHERE estado_nexia NOT IN ('muerta','cerrada')
    AND horacio.norm_np(numero_parte) IN (SELECT parte_smt FROM subs)
  GROUP BY horacio.norm_np(numero_parte)
),
fin AS (
  SELECT ps.parte_smt,
         SUM(COALESCE(ot.cant_terminada,0))::bigint AS fin_term,
         count(DISTINCT ot.numero_parte)            AS finales_activos
  FROM horacio.pareo_smt ps
  JOIN horacio.ordenes_trabajo ot
    ON horacio.norm_np(ot.numero_parte)=ps.parte_final
   AND ot.estado_nexia NOT IN ('muerta','cerrada')
  WHERE ps.vigente
  GROUP BY ps.parte_smt
)
SELECT s.parte_smt AS subensamble,
       COALESCE(sm.smt_ord,0)  AS smt_ord,
       COALESCE(sm.smt_term,0) AS smt_term,
       COALESCE(f.fin_term,0)  AS fin_term,
       COALESCE(f.finales_activos,0) AS finales_activos,
       GREATEST(COALESCE(sm.smt_term,0)-COALESCE(f.fin_term,0),0) AS wip_mas_buffer
FROM subs s
LEFT JOIN smt sm ON sm.parte_smt=s.parte_smt
LEFT JOIN fin f  ON f.parte_smt =s.parte_smt
ORDER BY wip_mas_buffer DESC;

GRANT SELECT ON horacio.v_wip_smt TO anon, authenticated, service_role;
