-- ============================================================
-- Horacio · 019 — Corrección de horas con auditoría (append-only)
-- (R3-HDB-15) El admin puede CORREGIR una hora ya capturada SIN borrar:
--   una corrección es un EVENTO NUEVO con corrige_id → apunta a la fila que
--   sustituye. La fila original se conserva (auditoría anti-falseo: queda el
--   valor viejo, quién y cuándo). Los agregados cuentan solo la fila VIGENTE.
-- Vista hxh_vigente = filas NO sustituidas (nadie las corrige). Las queries de
-- agregación leen de esta vista en vez de hora_por_hora.
--   Acceso solo vía /pg/query (service_role).
-- ============================================================
CREATE OR REPLACE VIEW horacio.hxh_vigente AS
SELECT h.*
FROM horacio.hora_por_hora h
WHERE NOT EXISTS (
  SELECT 1 FROM horacio.hora_por_hora c WHERE c.corrige_id = h.id
);
GRANT SELECT ON horacio.hxh_vigente TO service_role, anon, authenticated;
