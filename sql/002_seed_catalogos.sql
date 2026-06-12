-- ============================================================
-- Horacio — Seed de catálogos (desde las 4 notas spec)
-- Migración 002 · 2026-06-11
-- Fuente de verdad: tablas horacio.* (n8n las lee, no las notas)
-- ============================================================

-- ---- CAUSAS DE PARO (taxonomía CERRADA, 8 botones) ----------
INSERT INTO horacio.causas_paro (codigo, boton_texto, cuenta_como_paro, escala_a, orden) VALUES
  ('LIB',   '🔓 Liberación / arranque',          true,  'calidad',       1),
  ('MAT-F', '📦 Falta material',                  true,  'faltantes',     2),
  ('MAT-I', '🔄 Material invertido / equivocado', true,  'faltantes',     3),
  ('RTB',   '🔧 Retrabajo de tarjetas',           true,  'calidad',       4),
  ('CMB',   '⚙️ Cambio de modelo',                true,  'paros',         5),
  ('MAQ',   '🛠️ Falla de máquina',                true,  'mantenimiento', 6),
  ('COM',   '🍽️ Comida / pausa programada',       false, NULL,            7),
  ('OTRO',  '❓ Otra cosa (escribe qué)',          true,  'paros',         8)
ON CONFLICT (codigo) DO UPDATE
  SET boton_texto = EXCLUDED.boton_texto,
      cuenta_como_paro = EXCLUDED.cuenta_como_paro,
      escala_a = EXCLUDED.escala_a,
      orden = EXCLUDED.orden;

-- ---- PERSONAS (líderes + dueños de escalamiento) ------------
-- chat_id NULL hasta alta con consentimiento (Ivonne/RH).
INSERT INTO horacio.personas (nombre, rol) VALUES
  ('Daniel Nava',        'paros'),
  ('Nayeli',             'faltantes'),
  ('Marco Sotelo',       'calidad'),
  ('JC',                 'mantenimiento'),
  ('Jorge',              'direccion'),
  ('Viridiana Escalona', 'lider'),
  ('Yadira',             'lider')
ON CONFLICT DO NOTHING;

-- ---- LINEAS del piloto --------------------------------------
INSERT INTO horacio.lineas (codigo, nombre, lider_persona_id, estandar_status)
SELECT 'SMT520', 'SMT 520', p.id, 'oficial'
FROM horacio.personas p WHERE p.nombre = 'Viridiana Escalona'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO horacio.lineas (codigo, nombre, estandar_status) VALUES
  ('CIL3',      'CIL3 1V4',  'por_validar'),   -- líder #revisar
  ('ANDROMEDA', 'Andromeda', 'no_estandar')    -- SIN estándar oficial #dato-faltante
ON CONFLICT (codigo) DO NOTHING;

-- ---- ESTANDARES ---------------------------------------------
-- SMT 520 modelo TJ000360 = 102 tarjetas/hr (formato FPR01.F)
INSERT INTO horacio.estandares (linea_id, modelo, piezas_hora, fuente)
SELECT l.id, 'TJ000360', 102, 'FPR01.F (oficial)'
FROM horacio.lineas l WHERE l.codigo = 'SMT520'
ON CONFLICT DO NOTHING;

-- ---- CONFIG (system prompt versionado) ----------------------
-- value lo cargamos en paso aparte para evitar escapes; aquí registramos parámetros.
INSERT INTO horacio.config (key, value, version) VALUES
  ('turno_inicio',      '06:30',        '0.1'),
  ('turno_fin',         '15:30',        '0.1'),
  ('ping_offset_min',   '5',            '0.1'),
  ('resumen_lider',     '15:40',        '0.1'),
  ('resumen_direccion', '17:00',        '0.1'),
  ('recordatorio_min',  '15',           '0.1'),
  ('sla_paro_min',      '15',           '0.1'),
  ('sla_faltante_min',  '15',           '0.1'),
  ('sla_calidad_min',   '30',           '0.1')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, version = EXCLUDED.version, updated_at = now();
