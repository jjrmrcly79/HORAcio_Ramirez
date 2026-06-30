-- 039_empaque_grupo_tarjetas.sql
-- Contexto: al reducir los tableros, las líneas de Empaque que antes se capturaban
-- por CONTEO (Conformal, FCT, Empaque 1-5, Ensambles…) quedaron inactivas. Las
-- únicas de Empaque activas hoy capturan por TARJETAS (igual que Embarques):
--   EMPAQUEANDR (grupo EMPAQUE) y EMPAQUE_1S (estaba en grupo OTROS).
-- Síntoma: la etapa "Empaque" del flujo del dashboard salía vacía ("no marca nada")
-- porque se arma solo con tableros captura<>'tarjetas', y de paso esas piezas se
-- sumaban a Embarques (que tomaba TODAS las líneas tarjetas activas).
--
-- Fix de datos: "Empaque 1s" es Empaque (confirmado por Juan) → reclasificar a EMPAQUE.
-- El fix de presentación va en n8n/horacio-dash.code.js:
--   · Empaque = volumen por tarjetas del grupo EMPAQUE (sin meta).
--   · Embarques = solo grupo EMBARQUES (quita la doble cuenta).

UPDATE horacio.lineas SET grupo = 'EMPAQUE' WHERE codigo = 'EMPAQUE_1S';
