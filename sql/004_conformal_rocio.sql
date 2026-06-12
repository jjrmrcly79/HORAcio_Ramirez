-- ============================================================
-- Horacio — Ajuste líneas (12-jun): quitar "Otros", Conformal con líder Rocío
-- ============================================================

-- Líder de Conformal y Producto Terminado: Rocío ("Chío")
INSERT INTO horacio.personas(nombre, rol)
  SELECT 'Rocío (Chío)', 'lider'
  WHERE NOT EXISTS (SELECT 1 FROM horacio.personas WHERE nombre='Rocío (Chío)');

UPDATE horacio.lineas
  SET lider_persona_id = (SELECT id FROM horacio.personas WHERE nombre='Rocío (Chío)' LIMIT 1)
  WHERE codigo='CONFORMAL';

-- "Otros" se absorbe en Conformal/PT — eliminar la línea
DELETE FROM horacio.lineas WHERE codigo='OTROS';
