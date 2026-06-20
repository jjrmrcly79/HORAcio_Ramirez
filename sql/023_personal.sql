-- ============================================================
-- Horacio · 023 — Padrón de personal (RH) — operadoras de piso
-- Las operadoras NO usan el bot (capturan las líderes), así que su ficha no
-- alimenta a Horacio: es una base de RH. Tabla aparte de `personas`/`perfiles`.
--   seed = ficha del MD (frontmatter demográfico + tabla). sensible=true (RH-only).
--   persona_id (nullable) solo si alguna llega a ser usuaria del bot.
-- Privacidad: RH/NexIA únicamente; nunca en el dashboard ni en prompts del bot.
--   Acceso solo vía /pg/query (service_role).
-- ============================================================
CREATE TABLE IF NOT EXISTS horacio.personal (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  archivo        text UNIQUE NOT NULL,       -- MD de origen (idempotencia)
  nombre         text NOT NULL,
  categoria      text NOT NULL DEFAULT 'operador',   -- operador | contacto
  area           text,
  seed           jsonb NOT NULL DEFAULT '{}'::jsonb,
  persona_id     uuid REFERENCES horacio.personas(id),
  sensible       boolean NOT NULL DEFAULT true,
  actualizado_ts timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE horacio.personal ENABLE ROW LEVEL SECURITY;
GRANT ALL ON horacio.personal TO service_role;
