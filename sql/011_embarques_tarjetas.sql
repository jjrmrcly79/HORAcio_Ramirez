-- ============================================================
-- Horacio · 011 — Embarques captura por tarjeta (NP + cantidad)
-- Embarques (Brenda) pasa de "un número de cajas" a "varias tarjetas
-- por hora": por cada NP de tarjeta, cuántas. El `real` de la hora =
-- suma de cantidades. Catálogo CERRADO de tarjetas + detalle append-only.
--   Acceso solo vía /pg/query (service_role).
-- ============================================================

-- 1. Catálogo de tarjetas (cerrado; crece con [➕ Otra] desde el bot)
CREATE TABLE IF NOT EXISTS horacio.tarjetas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_parte  text UNIQUE NOT NULL,
  nombre        text,                  -- alias amigable opcional (p.ej. "Andromeda")
  activa        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE horacio.tarjetas ENABLE ROW LEVEL SECURITY;

-- 2. Detalle: varias tarjetas por fila de hora_por_hora (append-only)
CREATE TABLE IF NOT EXISTS horacio.hxh_tarjetas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hxh_id        uuid NOT NULL REFERENCES horacio.hora_por_hora(id),
  tarjeta_id    uuid REFERENCES horacio.tarjetas(id),
  numero_parte  text NOT NULL,         -- snapshot del NP (sobrevive cambios del catálogo)
  cantidad      numeric NOT NULL CHECK (cantidad > 0),
  ts            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hxhtj_hxh     ON horacio.hxh_tarjetas(hxh_id);
CREATE INDEX IF NOT EXISTS idx_hxhtj_tarjeta ON horacio.hxh_tarjetas(tarjeta_id);
ALTER TABLE horacio.hxh_tarjetas ENABLE ROW LEVEL SECURITY;

-- 3. Modo de captura por tablero: 'conteo' (default) | 'tarjetas'
ALTER TABLE horacio.lineas ADD COLUMN IF NOT EXISTS captura text NOT NULL DEFAULT 'conteo';
ALTER TABLE horacio.lineas DROP CONSTRAINT IF EXISTS lineas_captura_check;
ALTER TABLE horacio.lineas ADD CONSTRAINT lineas_captura_check
  CHECK (captura = ANY (ARRAY['conteo','tarjetas']));

-- Embarques: captura por tarjetas; unidad pasa de 'cajas' a 'tarjetas'
UPDATE horacio.lineas
   SET captura = 'tarjetas', unidad = 'tarjetas', nombre = 'Embarques (tarjetas retiradas)'
 WHERE codigo = 'EMBARQUES';

-- 4. Ampliar el CHECK de sesiones.step ANTES de usar los steps nuevos
--    (patrón cart_drafts: un step no declarado revienta con 23514 y aborta el nodo)
ALTER TABLE horacio.sesiones DROP CONSTRAINT sesiones_step_check;
ALTER TABLE horacio.sesiones ADD CONSTRAINT sesiones_step_check
  CHECK (step = ANY (ARRAY[
    'idle','hxh_menu','hxh_meta','hxh_piezas','hxh_causa','hxh_real',
    'hxh_tj_pick','hxh_tj_np','hxh_tj_cant',
    'paro_causa','paro_abierto','falt_linea','falt_parte','falt_abierto',
    'cal_descripcion','orden_menu','orden_ot','orden_meta'
  ]));

-- 5. GRANTS (nuevas tablas)
GRANT ALL ON horacio.tarjetas     TO service_role;
GRANT ALL ON horacio.hxh_tarjetas TO service_role;

-- 6. Seed del catálogo de tarjetas de Embarques (24 NP iniciales)
INSERT INTO horacio.tarjetas (numero_parte) VALUES
  ('295D2290G004'),('222D9519G025'),('TJ000360'),('295D2699G007'),
  ('222D5197G001'),('295D2311G023'),('259C1035G006'),('259C1035G005'),
  ('T0058770007'),('295D2311G025'),('295D2311G028'),('295D2311G027'),
  ('295D2311G026'),('WR01F03876-P'),('10501-00016'),('TJ000363'),
  ('10501-00017'),('TJ000361'),('TJ000222'),('05-1820 REV D5'),
  ('253C1142P001'),('T0058768075'),('259C1482G003'),('295D2699G006')
ON CONFLICT (numero_parte) DO NOTHING;
