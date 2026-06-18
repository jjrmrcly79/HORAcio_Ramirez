-- ============================================================
-- Horacio · 017 — Motivación por hitos (Horacio "da antes de pedir")
-- Con el avance del día (capturas / (nº tableros × 9)) Horacio manda un
-- mensaje cálido al cruzar un hito: inicio, mitad (50%), completo (100%).
-- Esta tabla evita repetir el mismo hito el mismo día por líder.
--   Acceso solo vía /pg/query (service_role).
-- ============================================================
CREATE TABLE IF NOT EXISTS horacio.motivacion (
  chat_id  bigint NOT NULL,
  fecha    date   NOT NULL,
  hito     text   NOT NULL,   -- 'inicio' | 'mitad' | 'completo'
  ts       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, fecha, hito)
);
ALTER TABLE horacio.motivacion ENABLE ROW LEVEL SECURITY;
GRANT ALL ON horacio.motivacion TO service_role;
