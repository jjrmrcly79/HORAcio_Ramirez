-- ============================================================
-- Horacio · 033 — Fase 3: Programa oficial (foto congelada del secuenciador)
-- Desde el tab "Programa" del panel V2, Dirección reordena las OT con el
-- mouse y al darle "Lanzar como programa oficial" congela ese orden + fechas
-- como referencia vigente. Cada lanzamiento reemplaza al anterior (vigente=
-- false) pero queda histórico. ES UNA FOTO: no se recalcula después.
--   NO toca ordenes_tablero ni el flujo en vivo de Daniel (V2 = read-only
--   sobre lo de Daniel). Escritura vía POST token-gated /horacio-v2.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROGRAMA_OFICIAL — maestro (1 fila por lanzamiento)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS horacio.programa_oficial (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creado_ts       timestamptz NOT NULL DEFAULT now(),
  creado_por      text,                                   -- libre (no hay auth en el panel)
  estrategia_base text,                                   -- 'vencidas'|'cumplibles'|'pendiente'|'manual'
  lineas_smt      int,
  lineas_pth      int,
  fecha_meta      date,                                   -- día en que se pone al corriente
  dias_habiles    int,
  nota            text,
  vigente         boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_prog_vigente ON horacio.programa_oficial(vigente) WHERE vigente;

-- ------------------------------------------------------------
-- 2. PROGRAMA_OFICIAL_OT — detalle congelado (orden + fechas calculadas)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS horacio.programa_oficial_ot (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programa_id    uuid NOT NULL REFERENCES horacio.programa_oficial(id) ON DELETE CASCADE,
  area           text NOT NULL CHECK (area IN ('SMT','PTH')),
  posicion       int  NOT NULL,                           -- orden manual dentro del área (1..n)
  orden_trabajo  text NOT NULL,
  numero_parte   text,
  descripcion    text,
  pendiente      numeric,
  proceso_cuello text,
  std_cuello     numeric,
  inicia         date,
  termina        date,
  tarde_dias     int,
  espera_smt     boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_prog_ot ON horacio.programa_oficial_ot(programa_id, area, posicion);

-- ------------------------------------------------------------
-- 3. RLS (service_role bypass; sin políticas anon/authenticated)
-- ------------------------------------------------------------
ALTER TABLE horacio.programa_oficial    ENABLE ROW LEVEL SECURITY;
ALTER TABLE horacio.programa_oficial_ot ENABLE ROW LEVEL SECURITY;
GRANT ALL ON horacio.programa_oficial, horacio.programa_oficial_ot TO service_role;

-- ------------------------------------------------------------
-- 4. VISTA — el programa oficial vigente (maestro + conteo)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW horacio.v_programa_vigente AS
SELECT p.*,
       (SELECT count(*) FROM horacio.programa_oficial_ot o WHERE o.programa_id = p.id) AS n_ot
FROM horacio.programa_oficial p
WHERE p.vigente;
GRANT SELECT ON horacio.v_programa_vigente TO service_role;
