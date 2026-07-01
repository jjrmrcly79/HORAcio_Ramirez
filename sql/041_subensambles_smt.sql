-- ============================================================
-- Horacio · 041 — Registro de subensambles SMT "sueltos"
-- Algunas partes en proceso (ej. TJ000360) SON el subensamble SMT, no un
-- final que necesite subensamble. Nayeli las declara con "es subensamble":
-- salen de pendientes y quedan disponibles en el dropdown para parearles
-- sus finales. Complementa pareo_smt (parejas) y pareo_excluidos (1:1 / sin sub).
-- ============================================================

CREATE TABLE IF NOT EXISTS horacio.subensambles_smt (
  parte_smt    text PRIMARY KEY,          -- horacio.norm_np(numero_parte)
  descripcion  text,
  set_by_panel text,
  ts           timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON horacio.subensambles_smt TO anon, authenticated, service_role;

-- Pendientes = OTs en proceso sin pareo, ni marcadas sin-sub, NI declaradas subensamble.
CREATE OR REPLACE VIEW horacio.v_pareo_pendientes AS
WITH ot AS (
  SELECT numero_parte,
         horacio.norm_np(numero_parte) AS nkey,
         SUM(COALESCE(cant_ordenada,0))::bigint  AS ord,
         SUM(COALESCE(cant_terminada,0))::bigint AS term
  FROM horacio.ordenes_trabajo
  WHERE estado_nexia NOT IN ('muerta','cerrada')
    AND numero_parte IS NOT NULL AND numero_parte <> ''
  GROUP BY numero_parte
),
known AS (
  SELECT horacio.norm_np(parte_smt)   AS k FROM horacio.pareo_smt WHERE vigente
  UNION
  SELECT horacio.norm_np(parte_final) AS k FROM horacio.pareo_smt WHERE vigente
  UNION
  SELECT horacio.norm_np(parte_smt)   AS k FROM horacio.subensambles_smt
)
SELECT ot.numero_parte, ot.nkey, ot.ord, ot.term
FROM ot
WHERE ot.nkey NOT IN (SELECT k FROM known)
  AND ot.nkey NOT IN (SELECT nkey FROM horacio.pareo_excluidos)
ORDER BY ot.ord DESC;
