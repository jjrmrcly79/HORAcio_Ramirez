-- ============================================================
-- Horacio · 032 — Fix: "sin_estandar" usa la parte EFECTIVA (no la cruda)
-- Bug: una OT -02 SMT con nombre (ANDROMEDA) marcaba "Sin estándar" aunque
-- su meta SÍ se resuelve vía el hermano -01 (225D7291G008). El warning
-- contradecía a la meta mostrada. Ahora sin_estandar = la OT NO aparece en
-- v_ot_meta (es decir, ni su parte ni el hermano tienen estándar usable).
-- ============================================================
CREATE OR REPLACE VIEW horacio.v_ot_inconsistencias AS
SELECT o.orden_trabajo, o.numero_parte, o.descripcion, o.partida, o.es_smt,
       o.cant_ordenada, o.cant_terminada,
       GREATEST(COALESCE(o.cant_ordenada,0) - COALESCE(o.cant_terminada,0), 0) AS pendiente,
       o.fecha_orden, o.fecha_vence, o.estado_nexia,
       NOT EXISTS (
         SELECT 1 FROM horacio.v_ot_meta m WHERE m.orden_trabajo = o.orden_trabajo
       ) AS sin_estandar,
       (o.fecha_vence < o.fecha_orden) AS fecha_invalida,
       (o.fecha_vence < CURRENT_DATE
         AND COALESCE(o.cant_terminada,0) < COALESCE(o.cant_ordenada,0)) AS vencida_incompleta
FROM horacio.ordenes_trabajo o
WHERE o.estado_nexia <> 'muerta';

GRANT SELECT ON horacio.v_ot_inconsistencias TO service_role;
