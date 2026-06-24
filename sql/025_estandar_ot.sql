-- ============================================================
-- Horacio · 025 — Estándar x Hora + Órdenes de Trabajo
-- Migra el Excel "Estandar x Hora" (matriz ancha) a modelo normalizado
-- y carga las OT en proceso como propuesta que Dirección puede matar.
--   · partes            → catálogo (N.Parte normalizado + ensamble)
--   · estandar_proceso  → 1 fila por (parte × estación), std_hr / pzs_turno
--   · ordenes_trabajo   → snapshot diario de OT en proceso (estado_nexia)
-- Acceso solo vía /pg/query (service_role). Loader: scripts/import_estandar_ot.py
-- ============================================================

-- ------------------------------------------------------------
-- 1. PARTES — catálogo de tarjetas (clave = N.Parte + N.Parte Ensamble)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS horacio.partes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_parte       text NOT NULL,                       -- normalizado: UPPER, sin sufijo _SMT
  no_parte_ensamble  text NOT NULL DEFAULT 'N/A',
  numero_parte_raw   text,
  site               text,
  cliente            text,
  familia_modelo     text,
  descripcion        text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (numero_parte, no_parte_ensamble)
);
CREATE INDEX IF NOT EXISTS idx_partes_np ON horacio.partes(numero_parte);

-- ------------------------------------------------------------
-- 2. ESTANDAR_PROCESO — estándar por hora normalizado (1 fila por parte×estación)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS horacio.estandar_proceso (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parte_id   uuid NOT NULL REFERENCES horacio.partes(id) ON DELETE CASCADE,
  proceso    text NOT NULL,
  std_hr     numeric NOT NULL,
  pzs_turno  numeric,
  atributos  jsonb NOT NULL DEFAULT '{}'::jsonb,          -- MOD, #Comp, Panel/Individual, Tipo, etc.
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parte_id, proceso),
  CONSTRAINT estandar_proceso_proceso_chk CHECK (proceso = ANY (ARRAY[
    'PP_481','PP_520','PP_411_481','PP_421','ENSAMBLE_MANUAL','WAVE_SOLDER',
    'SOLDEO_MANUAL','ICT','GRB','CONFORMAL','LIMPIEZA','FCT','ENSAMBLES',
    'PRUEBA_FCT','EMPAQUE']))
);
CREATE INDEX IF NOT EXISTS idx_estandar_parte ON horacio.estandar_proceso(parte_id);

-- ------------------------------------------------------------
-- 3. ORDENES_TRABAJO — snapshot de OT en proceso; Dirección aprueba/mata
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS horacio.ordenes_trabajo (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_trabajo    text NOT NULL,                          -- '260600501-02'
  orden_base       text NOT NULL,                          -- '260600501'
  partida          text,                                   -- '01' producto final · '02'/'03' SMT
  es_smt           boolean NOT NULL DEFAULT false,
  numero_parte     text NOT NULL,                          -- normalizado (liga a partes)
  numero_parte_raw text,
  descripcion      text,
  tipo_ot          text,
  proceso_codigo   text,
  cant_ordenada    numeric,
  cant_terminada   numeric,
  fecha_orden      date,
  fecha_vence      date,
  ventas           text,
  status_origen    text,
  estado_nexia     text NOT NULL DEFAULT 'propuesta'
                     CHECK (estado_nexia IN ('propuesta','aprobada','muerta','cerrada')),
  motivo_muerte    text,                                   -- p.ej. 'falta de material'
  fecha_snapshot   date NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (orden_trabajo, fecha_snapshot)
);
CREATE INDEX IF NOT EXISTS idx_ot_estado ON horacio.ordenes_trabajo(estado_nexia);
CREATE INDEX IF NOT EXISTS idx_ot_parte  ON horacio.ordenes_trabajo(numero_parte);

-- ------------------------------------------------------------
-- 4. RLS (service_role bypass; sin políticas anon/authenticated)
-- ------------------------------------------------------------
ALTER TABLE horacio.partes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE horacio.estandar_proceso  ENABLE ROW LEVEL SECURITY;
ALTER TABLE horacio.ordenes_trabajo   ENABLE ROW LEVEL SECURITY;

GRANT ALL ON horacio.partes, horacio.estandar_proceso, horacio.ordenes_trabajo TO service_role;

-- ------------------------------------------------------------
-- 5. VISTA DE INCONSISTENCIAS — OT sin estándar / fechas inválidas / vencidas
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW horacio.v_ot_inconsistencias AS
SELECT o.orden_trabajo, o.numero_parte, o.descripcion, o.partida, o.es_smt,
       o.cant_ordenada, o.cant_terminada,
       GREATEST(COALESCE(o.cant_ordenada,0) - COALESCE(o.cant_terminada,0), 0) AS pendiente,
       o.fecha_orden, o.fecha_vence, o.estado_nexia,
       NOT EXISTS (
         SELECT 1 FROM horacio.partes p
         JOIN horacio.estandar_proceso ep ON ep.parte_id = p.id
         WHERE p.numero_parte = o.numero_parte
       ) AS sin_estandar,
       (o.fecha_vence < o.fecha_orden)                                          AS fecha_invalida,
       (o.fecha_vence < CURRENT_DATE
         AND COALESCE(o.cant_terminada,0) < COALESCE(o.cant_ordenada,0))         AS vencida_incompleta
FROM horacio.ordenes_trabajo o
WHERE o.estado_nexia <> 'muerta';

GRANT SELECT ON horacio.v_ot_inconsistencias TO service_role;
