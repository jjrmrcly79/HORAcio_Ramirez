-- ============================================================
-- Horacio · 004 — Tableros HxH por líder (no "1 línea = 1 líder")
-- Realidad de piso: una líder llena VARIOS tableros HxH.
--   Viridiana (SMT):  SMT 411&481 · SMT 520
--   Yadira (PTH):     PTH · Ola · Soldeo manual · ICT/FCT · Conformal
-- `lineas` pasa a significar "tablero HxH" (FKs intactas: linea_id).
-- Reúsa las 3 filas actuales (preserva el estándar 102/hr colgado de SMT).
-- Conformal se reasigna a Yadira; la persona Rocío queda sin tablero.
-- Limpia datos de PRUEBA (no hay datos productivos: gate R2-07).
-- Aplicar vía /pg/query con SERVICE_ROLE.
-- ============================================================

-- 1) Nuevas columnas de agrupación/orden
ALTER TABLE horacio.lineas ADD COLUMN IF NOT EXISTS grupo text;
ALTER TABLE horacio.lineas ADD COLUMN IF NOT EXISTS orden int;

-- 2) Reúso de filas existentes (mantiene ids → no rompe estándar ni FKs)
UPDATE horacio.lineas
   SET codigo='SMT_520', nombre='SMT 520', grupo='SMT', orden=2, estandar_status='oficial'
 WHERE codigo='SMT';

UPDATE horacio.lineas
   SET nombre='PTH (inserción manual)', grupo='PTH', orden=3, estandar_status='por_validar'
 WHERE codigo='PTH';

UPDATE horacio.lineas
   SET nombre='Conformal', grupo='PTH', orden=7, estandar_status='por_validar',
       lider_persona_id=(SELECT lider_persona_id FROM horacio.lineas WHERE codigo='PTH')
 WHERE codigo='CONFORMAL';

-- 3) Tableros nuevos
INSERT INTO horacio.lineas (codigo,nombre,grupo,orden,estandar_status,lider_persona_id,activa)
SELECT 'SMT_411481','SMT 411&481','SMT',1,'por_validar',
       (SELECT lider_persona_id FROM horacio.lineas WHERE codigo='SMT_520'),true
 WHERE NOT EXISTS (SELECT 1 FROM horacio.lineas WHERE codigo='SMT_411481');

INSERT INTO horacio.lineas (codigo,nombre,grupo,orden,estandar_status,lider_persona_id,activa)
SELECT 'OLA','Máquina de ola','PTH',4,'por_validar',
       (SELECT lider_persona_id FROM horacio.lineas WHERE codigo='PTH'),true
 WHERE NOT EXISTS (SELECT 1 FROM horacio.lineas WHERE codigo='OLA');

INSERT INTO horacio.lineas (codigo,nombre,grupo,orden,estandar_status,lider_persona_id,activa)
SELECT 'SOLDEO','Soldeo manual','PTH',5,'por_validar',
       (SELECT lider_persona_id FROM horacio.lineas WHERE codigo='PTH'),true
 WHERE NOT EXISTS (SELECT 1 FROM horacio.lineas WHERE codigo='SOLDEO');

INSERT INTO horacio.lineas (codigo,nombre,grupo,orden,estandar_status,lider_persona_id,activa)
SELECT 'ICT','ICT / FCT','PTH',6,'por_validar',
       (SELECT lider_persona_id FROM horacio.lineas WHERE codigo='PTH'),true
 WHERE NOT EXISTS (SELECT 1 FROM horacio.lineas WHERE codigo='ICT');

-- 4) Limpieza de datos de PRUEBA (no productivos)
DELETE FROM horacio.hora_por_hora;
DELETE FROM horacio.paros;
DELETE FROM horacio.sesiones;
