-- ============================================================
-- Horacio — Re-seed líneas + organigrama real (12-jun)
-- Fuente: Horacio - Organigrama General.md + Catalogo Lineas (v0.2)
-- Líneas reales del proceso: SMT · PTH · Conformal · Otros
-- "Andromeda" es una TARJETA (NP 22SD72916-06), no una línea.
-- ============================================================

-- ---- PERSONAS: nombres completos + reset de altas de prueba ----
UPDATE horacio.personas SET nombre='Juan Carlos Martínez' WHERE nombre='JC';
UPDATE horacio.personas SET nombre='Nayeli Hernández'      WHERE nombre='Nayeli';
UPDATE horacio.personas SET nombre='Jorge Ramírez'         WHERE nombre='Jorge';
UPDATE horacio.personas SET chat_id=NULL, consentimiento=false;  -- onboarding real vía /start
INSERT INTO horacio.personas(nombre, rol)
  SELECT 'Yadira Magdariaga','lider'
  WHERE NOT EXISTS (SELECT 1 FROM horacio.personas WHERE nombre='Yadira Magdariaga');

-- ---- LÍNEAS: reemplazar el set anterior por el proceso real ----
DELETE FROM horacio.estandares;
DELETE FROM horacio.lineas;

INSERT INTO horacio.lineas(codigo, nombre, lider_persona_id, estandar_status)
  SELECT 'SMT', 'SMT', (SELECT id FROM horacio.personas WHERE nombre='Viridiana Escalona'), 'oficial';
INSERT INTO horacio.lineas(codigo, nombre, lider_persona_id, estandar_status)
  SELECT 'PTH', 'PTH (inserción manual + ola)', (SELECT id FROM horacio.personas WHERE nombre='Yadira Magdariaga'), 'por_validar';
INSERT INTO horacio.lineas(codigo, nombre, estandar_status) VALUES
  ('CONFORMAL', 'Conformal',                'por_validar'),   -- líder por identificar #revisar
  ('OTROS',     'Otros (empaque y arneses)', 'por_validar');  -- líder por identificar #revisar

-- ---- ESTÁNDAR oficial conocido: SMT / TJ000360 = 102/hr ----
INSERT INTO horacio.estandares(linea_id, modelo, piezas_hora, fuente)
  SELECT id, 'TJ000360', 102, 'FPR01.F (pizarrón SMT 520)'
  FROM horacio.lineas WHERE codigo='SMT';

-- ---- Step nuevo 'hxh_real' (líneas sin estándar: capturar número real) ----
ALTER TABLE horacio.sesiones DROP CONSTRAINT IF EXISTS sesiones_step_check;
ALTER TABLE horacio.sesiones ADD CONSTRAINT sesiones_step_check CHECK (step IN
  ('idle','hxh_meta','hxh_piezas','hxh_causa','hxh_real',
   'paro_causa','paro_abierto','falt_linea','falt_parte','falt_abierto','cal_descripcion'));
