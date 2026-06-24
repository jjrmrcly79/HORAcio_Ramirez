-- ============================================================
-- Horacio · 028 — Comentario por OT (warning + nota dentro de la orden)
-- El panel V2 muestra las inconsistencias COMO warning dentro de cada
-- orden, más un campo `comentario` libre. En Fase 3 ese comentario lo
-- captura el equipo de manufactura (motivo de paro/faltante/decisión).
-- ============================================================
ALTER TABLE horacio.ordenes_trabajo ADD COLUMN IF NOT EXISTS comentario text;

-- Ejemplo sembrado para ver el campo en el panel (se borra/edita en Fase 3)
UPDATE horacio.ordenes_trabajo
   SET comentario = 'Falta material — pendiente confirmar con almacén (ejemplo Fase 3).'
 WHERE orden_trabajo = '260400901-01' AND fecha_snapshot = '2026-06-23';
