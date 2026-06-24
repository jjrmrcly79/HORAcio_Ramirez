-- ============================================================
-- Horacio · 031 — Fase 3: Víbora POR OT (WIP exacto, sin doble conteo)
-- Cada OT fluye: subensamble SMT (partida -02/-03) → producto final
-- (partida -01 = PTH + ensamble + empaque). El WIP de la víbora =
-- lo que SMT ya terminó pero el final aún no consume.
--   posicion: en_smt | esperando_pth | en_final | terminada
-- Conteo exacto (SMT y final son 1:1 por orden_base). SOLO LECTURA.
-- ============================================================
CREATE OR REPLACE VIEW horacio.v_vibora_ot AS
WITH smt AS (
  SELECT orden_base, fecha_snapshot,
         sum(cant_ordenada)  AS ord,
         sum(cant_terminada) AS term
  FROM horacio.ordenes_trabajo
  WHERE es_smt AND estado_nexia <> 'muerta'
  GROUP BY orden_base, fecha_snapshot
),
fin AS (
  SELECT orden_base, fecha_snapshot,
         max(numero_parte)  AS numero_parte,
         max(descripcion)   AS descripcion,
         max(fecha_vence)   AS fecha_vence,
         max(estado_nexia)  AS estado_nexia,
         sum(cant_ordenada) AS ord,
         sum(cant_terminada) AS term
  FROM horacio.ordenes_trabajo
  WHERE partida = '01' AND estado_nexia <> 'muerta'
  GROUP BY orden_base, fecha_snapshot
)
SELECT
  COALESCE(f.orden_base, s.orden_base)         AS orden_base,
  COALESCE(f.fecha_snapshot, s.fecha_snapshot) AS fecha_snapshot,
  f.numero_parte, f.descripcion, f.fecha_vence, f.estado_nexia,
  s.ord  AS smt_ord,  s.term  AS smt_term,
  f.ord  AS fin_ord,  f.term  AS fin_term,
  GREATEST(COALESCE(s.term,0) - COALESCE(f.term,0), 0) AS wip,         -- pzs entre SMT y final
  CASE
    WHEN s.ord IS NOT NULL AND COALESCE(s.term,0) < s.ord            THEN 'en_smt'
    WHEN s.ord IS NOT NULL AND COALESCE(f.term,0) = 0                THEN 'esperando_pth'
    WHEN COALESCE(f.term,0) >= COALESCE(f.ord,0) AND f.ord IS NOT NULL THEN 'terminada'
    WHEN COALESCE(f.term,0) > 0                                      THEN 'en_final'
    ELSE 'sin_avance'
  END AS posicion
FROM fin f
FULL OUTER JOIN smt s
  ON s.orden_base = f.orden_base AND s.fecha_snapshot = f.fecha_snapshot;

GRANT SELECT ON horacio.v_vibora_ot TO service_role;
