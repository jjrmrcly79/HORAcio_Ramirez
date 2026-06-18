-- ============================================================
-- Horacio · 015 — PIN por usuario + sesiones del Panel de captura
-- El panel ahora exige login (nombre + PIN) para ver y escribir.
--   personas.pin_hash  → PIN hasheado con bcrypt (pgcrypto crypt/gen_salt('bf'))
--   personas.es_admin  → puede asignar/resetear PIN de otros (admins: paros, direccion)
--   personas.pin_intentos / pin_bloqueo_ts → anti fuerza bruta (5 fallos → 15 min)
--   panel_sesiones → token de sesión opaco (gen_random_bytes), expira 12 h
-- Bootstrap: el 1er admin SIN pin crea el suyo; luego los admins asignan a todos.
--   Acceso solo vía /pg/query (service_role).
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE horacio.personas
  ADD COLUMN IF NOT EXISTS pin_hash       text,
  ADD COLUMN IF NOT EXISTS es_admin       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pin_intentos   int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_bloqueo_ts timestamptz;

-- Admins iniciales del panel (pueden asignar PIN a los demás)
UPDATE horacio.personas SET es_admin = true WHERE rol IN ('paros', 'direccion');

CREATE TABLE IF NOT EXISTS horacio.panel_sesiones (
  token       text PRIMARY KEY,
  persona_id  uuid NOT NULL REFERENCES horacio.personas(id),
  nombre      text,
  es_admin    boolean NOT NULL DEFAULT false,
  creado      timestamptz NOT NULL DEFAULT now(),
  expira      timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_panel_ses_exp ON horacio.panel_sesiones(expira);
ALTER TABLE horacio.panel_sesiones ENABLE ROW LEVEL SECURITY;
GRANT ALL ON horacio.panel_sesiones TO service_role;
