-- ============================================================
-- Horacio · 024 — Juan Carlos Martínez también recibe el resumen de Dirección
-- "Charly" (Juan Carlos Martínez) es rol='mantenimiento', pero como brazo
-- derecho del ingeniero debe recibir también el resumen ejecutivo de las 17:00.
-- Mismo patrón que Daniel Nava (021): bandera independiente `recibe_resumen`,
-- sin cambiar su rol operativo. El bot manda resumen_dir a quien tenga
-- rol IN ('direccion','resumen') OR recibe_resumen (y activa, chat_id != null).
--   Se filtra por id para NO tocar el duplicado inactivo.
--   Acceso solo vía /pg/query (service_role).
-- ============================================================
UPDATE horacio.personas
   SET recibe_resumen = true
 WHERE id = 'c63dc05e-1804-4926-8445-841042ec7660';  -- Juan Carlos Martínez (activo)
