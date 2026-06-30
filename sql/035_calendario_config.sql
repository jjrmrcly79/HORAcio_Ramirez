-- ============================================================
-- Horacio · 035 — Calendario detallado por hora (Fase A · por área)
-- El tab "Calendario" del panel V2 expande el PROGRAMA OFICIAL vigente
-- (033) a bloques por hora: "de tal a tal hora corre esta OT". Es un
-- render sobre la foto congelada — NO escribe horarios, solo lee el orden
-- + pendiente + std_cuello que ya guarda programa_oficial_ot.
--
-- Lo ÚNICO que persiste aquí es el MODELO DE HORARIO (parametrizable):
-- inicio de turno, 1ª hora de liberación (no produce), media hora de comida
-- y fin de turno. Editable desde el panel (POST token-gated set_cal_config).
-- Las horas productivas = (fin-inicio) - liberación - comida.
--   NO toca ordenes_tablero ni el flujo en vivo de Daniel.
-- ============================================================

-- ------------------------------------------------------------
-- CALENDARIO_CONFIG — singleton (id=1). Modelo de horario del turno.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS horacio.calendario_config (
  id              int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  turno_inicio    time NOT NULL DEFAULT '06:30',   -- arranque del turno
  liberacion_min  int  NOT NULL DEFAULT 60   CHECK (liberacion_min >= 0 AND liberacion_min <= 240),
  comida_inicio   time NOT NULL DEFAULT '12:00',   -- inicio del bloque de comida
  comida_min      int  NOT NULL DEFAULT 30   CHECK (comida_min >= 0 AND comida_min <= 180),
  turno_fin       time NOT NULL DEFAULT '15:30',   -- fin del turno
  actualizado_ts  timestamptz NOT NULL DEFAULT now()
);

-- seed del singleton con los defaults de Mapartel (turno 6:30–15:30,
-- 1ª hora liberación, comida 12:00–12:30 → 7.5 h productivas)
INSERT INTO horacio.calendario_config (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- service_role bypass (el panel usa service key, sin auth de usuario)
ALTER TABLE horacio.calendario_config ENABLE ROW LEVEL SECURITY;
GRANT ALL ON horacio.calendario_config TO service_role;
