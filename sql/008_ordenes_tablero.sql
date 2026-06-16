-- ============================================================
-- Horacio · 008 — Órdenes y meta por tablero (las fija Producción/Daniel)
-- Daniel hace /orden y captura, por subproceso (tablero), la OT que corre
-- y la meta/hr. Esa meta se vuelve el `plan` del HxH de ese tablero hoy
-- → cada subproceso obtiene cumplimiento (% real vs meta). Separación
-- Andon: el supervisor pone el plan, la líder reporta lo real.
-- Acceso solo vía /pg/query (service_role); sin RLS (tabla interna).
-- ============================================================
CREATE TABLE IF NOT EXISTS horacio.ordenes_tablero (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linea_id uuid NOT NULL REFERENCES horacio.lineas(id),
  fecha date NOT NULL,
  orden text,
  meta_hr numeric,
  vigente boolean NOT NULL DEFAULT true,
  set_by_chat bigint,
  ts timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ordenes_tablero_lookup ON horacio.ordenes_tablero (linea_id, fecha, vigente);
GRANT ALL ON horacio.ordenes_tablero TO anon, authenticated, service_role;

-- Flujo y steps nuevos para el comando /orden
ALTER TABLE horacio.sesiones DROP CONSTRAINT sesiones_flujo_check;
ALTER TABLE horacio.sesiones ADD CONSTRAINT sesiones_flujo_check
  CHECK (flujo = ANY (ARRAY['hxh','paro','faltante','calidad','orden']));
ALTER TABLE horacio.sesiones DROP CONSTRAINT sesiones_step_check;
ALTER TABLE horacio.sesiones ADD CONSTRAINT sesiones_step_check
  CHECK (step = ANY (ARRAY[
    'idle','hxh_menu','hxh_meta','hxh_piezas','hxh_causa','hxh_real',
    'paro_causa','paro_abierto','falt_linea','falt_parte','falt_abierto',
    'cal_descripcion','orden_menu','orden_ot','orden_meta'
  ]));
