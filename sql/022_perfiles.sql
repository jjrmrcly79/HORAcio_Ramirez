-- ============================================================
-- Horacio · 022 — Perfiles del personal (memoria para personalizar)
-- Cada persona tiene un perfil que Horacio usa para acompañarla mejor.
--   perfiles.seed      = lo que viene de los MD de RH (estático)
--   perfiles.aprendido = resumen CURADO (lo único que Horacio usa en la plática)
--   perfil_eventos     = aprendizajes (append-only). La plática deja 'sugerido';
--                        RH lo pasa a 'aceptado' (entonces sí alimenta a Horacio).
-- Privacidad: perfiles son SOLO para RH/NexIA (sensible=true por defecto), nunca
--   en el dashboard de Dirección. Objetivo: apoyo y reconocimiento, no vigilancia.
--   Acceso solo vía /pg/query (service_role).
-- ============================================================
CREATE TABLE IF NOT EXISTS horacio.perfiles (
  persona_id     uuid PRIMARY KEY REFERENCES horacio.personas(id),
  seed           jsonb NOT NULL DEFAULT '{}'::jsonb,   -- de los MD (puesto, área, fortalezas…)
  aprendido      text,                                  -- resumen curado/validado que Horacio usa
  sensible       boolean NOT NULL DEFAULT true,         -- RH-only por defecto
  actualizado_ts timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS horacio.perfil_eventos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id  uuid REFERENCES horacio.personas(id),
  fecha       date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Mexico_City')::date,
  fuente      text NOT NULL DEFAULT 'platica',          -- platica | rh | seed
  mood        text,                                      -- bien|normal|pesado (si viene de plática)
  insight     text NOT NULL,                             -- el aprendizaje
  estado      text NOT NULL DEFAULT 'sugerido' CHECK (estado IN ('sugerido','aceptado','descartado')),
  ts          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_perfil_ev_persona ON horacio.perfil_eventos(persona_id, estado);

ALTER TABLE horacio.perfiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE horacio.perfil_eventos ENABLE ROW LEVEL SECURITY;
GRANT ALL ON horacio.perfiles       TO service_role;
GRANT ALL ON horacio.perfil_eventos TO service_role;
