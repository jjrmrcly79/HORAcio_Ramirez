-- ============================================================
-- Horacio · 006 — Dos Conformal distintos
-- Realidad de piso: hay DOS líneas de conformal, una la controla
-- Yadira (parte de su flujo PTH) y otra Rocío (Chío), líder aparte.
--   · Yadira: CONFORMAL → renombrado a CONFORMAL_Y "Conformal (Yadira)"
--   · Rocío:  nuevo tablero CONFORMAL_R "Conformal (Rocío)"
-- ============================================================

-- 1) Distinguir el conformal de Yadira (conserva id/FKs)
UPDATE horacio.lineas
   SET codigo='CONFORMAL_Y', nombre='Conformal (Yadira)'
 WHERE codigo='CONFORMAL';

-- 2) Conformal de Rocío (líder = persona sembrada de Rocío, ya con chat_id)
INSERT INTO horacio.lineas (codigo,nombre,grupo,orden,estandar_status,lider_persona_id,activa)
SELECT 'CONFORMAL_R','Conformal (Rocío)','CONFORMAL',8,'por_validar',
       (SELECT id FROM horacio.personas WHERE nombre='Rocío (Chío)' AND rol='lider' LIMIT 1),true
 WHERE NOT EXISTS (SELECT 1 FROM horacio.lineas WHERE codigo='CONFORMAL_R');
