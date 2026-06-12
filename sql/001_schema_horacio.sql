-- ============================================================
-- Horacio — Schema base (HxH, paros, faltantes, calidad)
-- Proyecto: Horacio (bot Telegram Mapartel · SN-04 v2)
-- Supabase self-hosted · ejecutar via /pg/query (service_role)
-- Migración 001 · 2026-06-11
-- ============================================================

CREATE SCHEMA IF NOT EXISTS horacio;

-- ------------------------------------------------------------
-- 1. PERSONAS — líderes + dueños de escalamiento
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS horacio.personas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          text NOT NULL,
  rol             text NOT NULL CHECK (rol IN
                    ('lider','paros','faltantes','calidad','mantenimiento','direccion','rh')),
  chat_id         bigint,            -- Telegram chat id (null hasta dar de alta con consentimiento)
  telefono        text,
  consentimiento  boolean NOT NULL DEFAULT false,
  activa          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 2. LINEAS — líneas del piloto
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS horacio.lineas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo           text UNIQUE NOT NULL,
  nombre           text NOT NULL,
  lider_persona_id uuid REFERENCES horacio.personas(id),
  estandar_status  text NOT NULL DEFAULT 'por_validar'
                     CHECK (estandar_status IN ('oficial','por_validar','no_estandar')),
  activa           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 3. ESTANDARES — estándar por modelo (piezas/hr)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS horacio.estandares (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linea_id     uuid NOT NULL REFERENCES horacio.lineas(id),
  modelo       text,
  piezas_hora  numeric NOT NULL,
  vigente      boolean NOT NULL DEFAULT true,
  fuente       text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 4. CAUSAS_PARO — taxonomía CERRADA (botones que ve la líder)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS horacio.causas_paro (
  codigo            text PRIMARY KEY,
  boton_texto       text NOT NULL,
  cuenta_como_paro  boolean NOT NULL,
  escala_a          text,              -- rol/área responsable de reacción
  orden             int NOT NULL DEFAULT 0,
  activa            boolean NOT NULL DEFAULT true
);

-- ------------------------------------------------------------
-- 5. HORA_POR_HORA — registro append-only (nunca se edita histórico)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS horacio.hora_por_hora (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linea_id         uuid NOT NULL REFERENCES horacio.lineas(id),
  fecha            date NOT NULL,
  hora_slot        text NOT NULL,         -- ej. '06:30-07:30'
  plan             numeric,               -- estándar prorrateado
  real             numeric,               -- piezas reales (null si sin_dato)
  t_productivo_min int NOT NULL DEFAULT 60,
  causa_codigo     text REFERENCES horacio.causas_paro(codigo),
  sin_dato         boolean NOT NULL DEFAULT false,
  corrige_id       uuid REFERENCES horacio.hora_por_hora(id),  -- corrección = evento nuevo
  reporto_chat_id  bigint,
  ts               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hxh_linea_fecha ON horacio.hora_por_hora(linea_id, fecha);

-- ------------------------------------------------------------
-- 6. PAROS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS horacio.paros (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linea_id         uuid NOT NULL REFERENCES horacio.lineas(id),
  causa_codigo     text REFERENCES horacio.causas_paro(codigo),
  ts_inicio        timestamptz NOT NULL DEFAULT now(),
  ts_fin           timestamptz,
  duracion_min     numeric,
  reporto_chat_id  bigint,
  escalado_a       uuid REFERENCES horacio.personas(id),
  acuse_ts         timestamptz,
  estado           text NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto','cerrado')),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_paros_estado ON horacio.paros(estado);

-- ------------------------------------------------------------
-- 7. FALTANTES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS horacio.faltantes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linea_id         uuid NOT NULL REFERENCES horacio.lineas(id),
  numero_parte     text,
  foto_url         text,
  ts_reporte       timestamptz NOT NULL DEFAULT now(),
  ts_resuelto      timestamptz,
  estado           text NOT NULL DEFAULT 'abierto'
                     CHECK (estado IN ('abierto','surtiendo','cerrado')),
  escalado_a       uuid REFERENCES horacio.personas(id),
  acuse_ts         timestamptz,
  reporto_chat_id  bigint
);
CREATE INDEX IF NOT EXISTS idx_faltantes_estado ON horacio.faltantes(estado);

-- ------------------------------------------------------------
-- 8. CALIDAD
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS horacio.calidad (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linea_id         uuid NOT NULL REFERENCES horacio.lineas(id),
  descripcion      text,
  ts               timestamptz NOT NULL DEFAULT now(),
  escalado_a       uuid REFERENCES horacio.personas(id),
  acuse_ts         timestamptz,
  reporto_chat_id  bigint,
  estado           text NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto','cerrado'))
);

-- ------------------------------------------------------------
-- 9. SESIONES — estado conversacional del bot (1 activa por chat)
--    patrón cart_drafts: step con CHECK cerrado
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS horacio.sesiones (
  chat_id     bigint PRIMARY KEY,
  linea_id    uuid REFERENCES horacio.lineas(id),
  flujo       text CHECK (flujo IN ('hxh','paro','faltante','calidad')),
  step        text CHECK (step IN
                ('idle','hxh_meta','hxh_piezas','hxh_causa',
                 'paro_causa','paro_abierto',
                 'falt_linea','falt_parte','falt_abierto',
                 'cal_descripcion')),
  data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 10. CONFIG — system prompt + parámetros versionados
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS horacio.config (
  key         text PRIMARY KEY,
  value       text,
  version     text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- RLS: activo en todas (n8n usa service_role → bypass).
-- Sin políticas permisivas: ningún cliente anon/authenticated lee.
-- ------------------------------------------------------------
ALTER TABLE horacio.personas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE horacio.lineas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE horacio.estandares     ENABLE ROW LEVEL SECURITY;
ALTER TABLE horacio.causas_paro    ENABLE ROW LEVEL SECURITY;
ALTER TABLE horacio.hora_por_hora  ENABLE ROW LEVEL SECURITY;
ALTER TABLE horacio.paros          ENABLE ROW LEVEL SECURITY;
ALTER TABLE horacio.faltantes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE horacio.calidad        ENABLE ROW LEVEL SECURITY;
ALTER TABLE horacio.sesiones       ENABLE ROW LEVEL SECURITY;
ALTER TABLE horacio.config         ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- GRANTS
-- ------------------------------------------------------------
GRANT USAGE ON SCHEMA horacio TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA horacio TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA horacio TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA horacio GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA horacio GRANT ALL ON SEQUENCES TO service_role;
