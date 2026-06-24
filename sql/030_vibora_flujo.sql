-- ============================================================
-- Horacio · 030 — Fase 3: Flujo "víbora" (sincronización del piso)
-- La planta corre como víbora: SMT → PTH → EMPAQUE → EMBARQUES.
-- Lo que una etapa cierra un día es el WIP que alimenta a la siguiente.
-- Sincroniza el HxH que YA capturan las líderes (hora_por_hora) por
-- macro-etapa (lineas.grupo) → permite ver el WIP entre etapas y
-- detectar "captura errónea" (flujo imposible: aguas abajo > aguas arriba).
-- SOLO LECTURA.
-- ============================================================

-- piezas por macro-etapa y día (el pulso de la víbora)
CREATE OR REPLACE VIEW horacio.v_vibora_dia AS
SELECT l.grupo,
       h.fecha,
       sum(h.real)               AS pzs,
       count(DISTINCT h.linea_id) AS tableros
FROM horacio.hora_por_hora h
JOIN horacio.lineas l ON l.id = h.linea_id
WHERE h.real IS NOT NULL
  AND l.grupo IN ('SMT','PTH','EMPAQUE','EMBARQUES')
GROUP BY l.grupo, h.fecha;

GRANT SELECT ON horacio.v_vibora_dia TO service_role;

-- acumulado por etapa hasta cada día + orden de etapa (para WIP entre etapas)
CREATE OR REPLACE VIEW horacio.v_vibora_acum AS
SELECT grupo,
       CASE grupo WHEN 'SMT' THEN 1 WHEN 'PTH' THEN 2 WHEN 'EMPAQUE' THEN 3 WHEN 'EMBARQUES' THEN 4 END AS etapa_orden,
       fecha,
       pzs,
       sum(pzs) OVER (PARTITION BY grupo ORDER BY fecha)  AS pzs_acum
FROM horacio.v_vibora_dia;

GRANT SELECT ON horacio.v_vibora_acum TO service_role;
