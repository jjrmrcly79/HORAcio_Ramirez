-- ============================================================
-- Horacio · 007 — Permitir rol 'resumen' en personas
-- El rol 'resumen' (receptores de solo-resumen: Pamela, Ivonne, NexIA,
-- validador de prueba) no estaba en personas_rol_check → cualquier alta
-- como 'resumen' fallaba con 23514. Se agrega al CHECK.
-- ============================================================
ALTER TABLE horacio.personas DROP CONSTRAINT personas_rol_check;
ALTER TABLE horacio.personas ADD CONSTRAINT personas_rol_check
  CHECK (rol = ANY (ARRAY[
    'lider','paros','faltantes','calidad','mantenimiento','direccion','rh','resumen'
  ]));
