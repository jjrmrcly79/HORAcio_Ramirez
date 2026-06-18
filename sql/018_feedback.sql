-- ============================================================
-- Horacio · 018 — Encuesta de salida + plática (feedback de líderes)
-- ~18:00 Horacio pregunta cómo estuvo el día (mood) + texto libre, y si la
-- líder quiere, conversa (Claude Haiku). Si algo serio → se escala a RH.
-- Privacidad: feedback solo para RH/NexIA, fuera del dashboard de Dirección.
--   Acceso solo vía /pg/query (service_role).
-- ============================================================
CREATE TABLE IF NOT EXISTS horacio.feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id  uuid REFERENCES horacio.personas(id),
  chat_id     bigint,
  fecha       date NOT NULL,
  mood        text CHECK (mood IN ('bien','normal','pesado')),
  texto       text,
  escalado    boolean NOT NULL DEFAULT false,
  ts          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_feedback_fecha ON horacio.feedback(fecha);
ALTER TABLE horacio.feedback ENABLE ROW LEVEL SECURITY;
GRANT ALL ON horacio.feedback TO service_role;

-- Flujo y steps nuevos para la encuesta/plática
ALTER TABLE horacio.sesiones DROP CONSTRAINT sesiones_flujo_check;
ALTER TABLE horacio.sesiones ADD CONSTRAINT sesiones_flujo_check
  CHECK (flujo = ANY (ARRAY['hxh','paro','faltante','calidad','orden','feedback']));
ALTER TABLE horacio.sesiones DROP CONSTRAINT sesiones_step_check;
ALTER TABLE horacio.sesiones ADD CONSTRAINT sesiones_step_check
  CHECK (step = ANY (ARRAY[
    'idle','hxh_menu','hxh_meta','hxh_piezas','hxh_causa','hxh_real',
    'hxh_tj_pick','hxh_tj_np','hxh_tj_cant',
    'paro_causa','paro_abierto','paro_dur','paro_accion',
    'falt_linea','falt_parte','falt_abierto','cal_descripcion',
    'orden_menu','orden_ot','orden_meta',
    'fb_texto','fb_chat'
  ]));
