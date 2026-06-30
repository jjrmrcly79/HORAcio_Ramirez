-- ============================================================
-- Horacio · 036 — V1.5: captura de meta en el panel + sugerencia desde estándar
-- A) El panel V1 ahora puede FIJAR la meta (misma tabla que /orden: ordenes_tablero).
-- B) Sugerencia de meta = estándar (TEÓRICO) prorrateado por tiempo productivo
--    (calendario_config: turno − liberación − comida), acotado por lo que falta de la OT.
-- Gobierno: meta la fijan Marco/Gaby/Jessica (puede_meta); estándar solo Gaby (puede_estandar).
-- Motor de sugerencia REUTILIZA lo de V2: linea_proceso (sql/026) + meta_sugerida() + v_ot_parte.
--   NO crea camino paralelo: escribe el mismo ordenes_tablero que el bot.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Trazabilidad de la meta capturada por panel (auditoría + 5-porqués)
-- ------------------------------------------------------------
ALTER TABLE horacio.ordenes_tablero
  ADD COLUMN IF NOT EXISTS origen        text,      -- 'telegram' | 'panel' (NULL = histórico /orden)
  ADD COLUMN IF NOT EXISTS set_by_panel  text,      -- nombre de la sesión que la fijó por panel
  ADD COLUMN IF NOT EXISTS meta_sugerida numeric,   -- lo que sugirió el estándar (para validar la captura)
  ADD COLUMN IF NOT EXISTS meta_motivo   text;      -- 5-porqués cuando se ajusta vs la sugerida

-- ------------------------------------------------------------
-- 2. Gobierno: quién fija meta / edita estándar
-- ------------------------------------------------------------
ALTER TABLE horacio.personas
  ADD COLUMN IF NOT EXISTS puede_meta     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS puede_estandar boolean DEFAULT false;

-- Marco + Jessica + Gaby pueden fijar meta; el estándar solo Gaby (cuando tenga alta+PIN).
UPDATE horacio.personas SET puede_meta=true
  WHERE activa AND (nombre ILIKE '%marco%' OR nombre ILIKE '%jesica%' OR nombre ILIKE '%jessica%'
                    OR nombre ILIKE '%gabriela%' OR nombre ILIKE '%gaby%');
UPDATE horacio.personas SET puede_estandar=true
  WHERE activa AND (nombre ILIKE '%gabriela%' OR nombre ILIKE '%gaby%');

-- ------------------------------------------------------------
-- 3. Sugerencia de meta por tablero+OT (estándar teórico × prorrateo, acotada por pendiente)
--    p_linea_id va como text (lo manda el panel) y se castea a uuid adentro.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION horacio.meta_sugerida_tablero(p_linea_id text, p_orden text)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_cod text; v_proc text; v_parte text; v_pend numeric; v_std numeric;
  v_span numeric; v_prod numeric; v_factor numeric; v_sug numeric; v_cfg record;
BEGIN
  SELECT codigo INTO v_cod FROM horacio.lineas WHERE id = p_linea_id::uuid;
  IF v_cod IS NULL THEN RETURN jsonb_build_object('ok',false,'motivo','tablero no existe'); END IF;

  SELECT proceso INTO v_proc FROM horacio.linea_proceso WHERE linea_codigo = v_cod;
  IF v_proc IS NULL THEN RETURN jsonb_build_object('ok',false,'motivo','tablero sin proceso mapeado'); END IF;

  -- parte efectiva + pendiente desde la OT (último snapshot del export)
  SELECT numero_parte_efectivo,
         GREATEST(COALESCE(cant_ordenada,0)-COALESCE(cant_terminada,0),0)
    INTO v_parte, v_pend
  FROM horacio.v_ot_parte
  WHERE orden_trabajo = p_orden
  ORDER BY fecha_snapshot DESC NULLS LAST LIMIT 1;
  IF v_parte IS NULL THEN
    RETURN jsonb_build_object('ok',false,'motivo','OT no está en el export del sistema','proceso',v_proc);
  END IF;

  v_std := horacio.meta_sugerida(v_parte, v_proc);   -- pz/hr teóricas del estándar
  IF v_std IS NULL THEN
    RETURN jsonb_build_object('ok',false,'motivo','sin estándar para esta parte/estación',
      'proceso',v_proc,'numero_parte',v_parte);
  END IF;

  -- prorrateo: fracción productiva del turno (calendario_config)
  SELECT * INTO v_cfg FROM horacio.calendario_config WHERE id=1;
  v_span := EXTRACT(EPOCH FROM (v_cfg.turno_fin - v_cfg.turno_inicio))/60.0;
  v_prod := v_span - COALESCE(v_cfg.liberacion_min,0) - COALESCE(v_cfg.comida_min,0);
  v_factor := CASE WHEN v_span > 0 THEN GREATEST(v_prod,0)/v_span ELSE 1 END;

  v_sug := round(v_std * v_factor);
  IF v_pend IS NOT NULL AND v_pend > 0 AND v_pend < v_sug THEN v_sug := v_pend; END IF;  -- no pedir más de lo que falta

  RETURN jsonb_build_object('ok',true,'proceso',v_proc,'numero_parte',v_parte,
    'std_hr',round(v_std,1),'factor',round(v_factor,3),'sugerida',v_sug,'pendiente',v_pend);
END $$;
GRANT EXECUTE ON FUNCTION horacio.meta_sugerida_tablero(text,text) TO service_role;
