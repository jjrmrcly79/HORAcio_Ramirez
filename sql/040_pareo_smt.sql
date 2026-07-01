-- ============================================================
-- Horacio · 040 — V2: Pareo SMT↔final (1:N) como INFORMACIÓN OFICIAL
-- Igual que el Estándar x Hora (sql/025): el Excel de planeación es solo la
-- SEMILLA de carga; una vez en `horacio.pareo_smt`, la fuente de verdad es
-- Supabase y lo mantiene planeación (Nayeli) desde el panel (`puede_pareo`).
--
-- Resuelve el bloqueo de la reunión 26-jun + sesión Nayeli 29-jun:
--  · el pareo NO es 1:1 ni derivable de `orden_base`/partida (`-01/-02`).
--  · el export de OTs NO trae el sufijo `_SMT` → se liga por CATÁLOGO explícito.
--  · un mismo subensamble SMT alimenta MUCHOS finales (1:N / pool).
--
-- Fase 1 (este archivo): tabla + normalización + cola de pendientes + panel.
-- Fase 2 (después): reescribir v_ot_parte / v_wip_smt para CONSUMIR el pareo.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Gate de permiso (ya agregado en el alta de Nayeli; idempotente)
-- ------------------------------------------------------------
ALTER TABLE horacio.personas ADD COLUMN IF NOT EXISTS puede_pareo boolean DEFAULT false;

-- ------------------------------------------------------------
-- 1. Normalización canónica de número de parte (loader ↔ panel ↔ vistas
--    usan EXACTAMENTE esta regla). Idempotente: norm(norm(x)) = norm(x).
--    Ej: 'Focaris_Ctrl_ (F)_SMT' → 'FOCARIS_CTRL_[F]' = OT 'FOCARIS_CTRL_[F]'
--        'ANDROMEDA_SMT' → 'ANDROMEDA' ; 'Sensor Velocidad_SMT' → 'SENSORVELOCIDAD'
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION horacio.norm_np(p text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT rtrim(
    regexp_replace(                                   -- quita TODOS los espacios
      regexp_replace(                                 -- quita sufijo _SMT / SMT final
        replace(replace(upper(trim(coalesce(p,''))),'(','['),')',']'),
      '_?SMT$',''),
    '\s+','','g'),
  '_')
$$;

-- ------------------------------------------------------------
-- 2. Tabla maestra de pareo (1:N nace natural: un parte_smt en muchas filas)
--    parte_smt / parte_final se guardan YA NORMALIZADOS (empatan con el export).
--    nivel: 'pt' (ENSAMBLES.xlsx) | 'pth' | 'final' (Tabla de ensambles 3 niveles)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS horacio.pareo_smt (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parte_smt    text NOT NULL,
  parte_final  text NOT NULL,
  nivel        text,
  descripcion  text,
  fuente       text NOT NULL DEFAULT 'panel',
  vigente      boolean NOT NULL DEFAULT true,
  set_by_panel text,
  ts           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parte_smt, parte_final)
);
CREATE INDEX IF NOT EXISTS pareo_smt_final ON horacio.pareo_smt (parte_final) WHERE vigente;
CREATE INDEX IF NOT EXISTS pareo_smt_smt   ON horacio.pareo_smt (parte_smt)  WHERE vigente;

-- ------------------------------------------------------------
-- 3. Marcas de "esta parte NO lleva subensamble SMT" (1:1 / parte simple)
--    → sale de la cola de pendientes. Keyed por nkey normalizado (cubre NPs
--    que no existen en `partes`, como la serie TJ).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS horacio.pareo_excluidos (
  nkey         text PRIMARY KEY,           -- horacio.norm_np(numero_parte)
  numero_parte text,                       -- forma original (para mostrar)
  motivo       text,
  set_by_panel text,
  ts           timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 4. Cola de PENDIENTES: NPs de OTs en proceso que NO están pareadas
--    (ni como SMT ni como final) ni marcadas sin-subensamble, por volumen.
--    Es lo que Nayeli ve en rojo en el tab Pareo.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW horacio.v_pareo_pendientes AS
WITH ot AS (
  SELECT numero_parte,
         horacio.norm_np(numero_parte) AS nkey,
         SUM(COALESCE(cant_ordenada,0))::bigint  AS ord,
         SUM(COALESCE(cant_terminada,0))::bigint AS term
  FROM horacio.ordenes_trabajo
  WHERE estado_nexia NOT IN ('muerta','cerrada')
    AND numero_parte IS NOT NULL AND numero_parte <> ''
  GROUP BY numero_parte
),
known AS (
  SELECT horacio.norm_np(parte_smt)   AS k FROM horacio.pareo_smt WHERE vigente
  UNION
  SELECT horacio.norm_np(parte_final) AS k FROM horacio.pareo_smt WHERE vigente
)
SELECT ot.numero_parte, ot.nkey, ot.ord, ot.term
FROM ot
WHERE ot.nkey NOT IN (SELECT k FROM known)
  AND ot.nkey NOT IN (SELECT nkey FROM horacio.pareo_excluidos)
ORDER BY ot.ord DESC;

-- ------------------------------------------------------------
-- 5. Grants (convención horacio: sin RLS en tablas internas; service_role escribe)
-- ------------------------------------------------------------
GRANT ALL ON horacio.pareo_smt       TO anon, authenticated, service_role;
GRANT ALL ON horacio.pareo_excluidos TO anon, authenticated, service_role;
