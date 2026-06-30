// ============================================================
// Horacio V2 — Panel "Meta automática" (nodo Code único · SOLO LECTURA)
// Workflow n8n: "Horacio V2" · Webhook GET /horacio-v2?token=XYZ
//   Superficie de PRUEBA para Juan. NO escribe en ordenes_tablero:
//   el flujo en vivo de Daniel (bot/panel/dashboard) queda intacto.
// Lee del estándar normalizado (sql/025) + meta automática (sql/026).
// Reemplaza <SERVICE_ROLE_KEY> y <DASH_TOKEN> en n8n (push_code.py).
// Respond node: respondWith=text, body={{$json.body}}, header content-type={{$json.contentType}}.
// ============================================================
const PG = 'https://supabase.nexiasoluciones.com.mx/pg/query';
const SK = '<SERVICE_ROLE_KEY>';
const TOKEN = '<DASH_TOKEN>';
const pgh = { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' };
const H = this.helpers;
const pg = async (q) => await H.httpRequest({ method: 'POST', url: PG, headers: pgh, body: { query: q }, json: true });

const inp = $input.first().json || {};
const q = inp.query || {};
const body = inp.body || {};
const isPost = !!(body && body.action);
const token = (isPost ? body.token : q.token) || '';
const J = (o) => [{ json: { body: JSON.stringify(o), contentType: 'application/json; charset=utf-8' } }];
if (token !== TOKEN) return isPost ? J({ ok: false, error: 'no autorizado' }) : [{ json: { body: 'No autorizado', contentType: 'text/plain; charset=utf-8' } }];

// ---------- ESCRITURA (POST) ----------
if (isPost) {
  const sql = (s) => String(s).replace(/'/g, "''");
  if (body.action === 'set_motivo') {
    const MOT = ['falta_material', 'falta_personal', 'maquina', 'otros'];
    const orden = String(body.orden || '');
    const motivo = String(body.motivo || '');
    if (!orden) return J({ ok: false, error: 'falta orden' });
    if (motivo && MOT.indexOf(motivo) < 0) return J({ ok: false, error: 'motivo inválido' });
    await pg("UPDATE horacio.ordenes_trabajo SET motivo_no_corre=" + (motivo ? "'" + motivo + "'" : 'NULL') +
             ", motivo_ts=" + (motivo ? 'now()' : 'NULL') + " WHERE orden_trabajo='" + sql(orden) + "'");
    return J({ ok: true, motivo: motivo || null });
  }
  if (body.action === 'set_estandar') {
    const PROC = ['PP_481','PP_520','PP_411_481','PP_421','ENSAMBLE_MANUAL','WAVE_SOLDER','SOLDEO_MANUAL','ICT','GRB','CONFORMAL','LIMPIEZA','FCT','ENSAMBLES','PRUEBA_FCT','EMPAQUE'];
    const np = String(body.numero_parte || '').trim().toUpperCase();
    const proceso = String(body.proceso || '');
    const raw = body.std_hr;
    if (!np) return J({ ok: false, error: 'falta parte' });
    if (PROC.indexOf(proceso) < 0) return J({ ok: false, error: 'proceso inválido' });
    let res = await pg("SELECT id FROM horacio.partes WHERE numero_parte='" + sql(np) + "' ORDER BY no_parte_ensamble LIMIT 1");
    let pid = res && res[0] && res[0].id;
    if (!pid) {
      const desc = sql(String(body.descripcion || ''));
      res = await pg("INSERT INTO horacio.partes(numero_parte,no_parte_ensamble,descripcion) VALUES('" + sql(np) + "','N/A','" + desc + "') ON CONFLICT (numero_parte,no_parte_ensamble) DO UPDATE SET descripcion=EXCLUDED.descripcion RETURNING id");
      pid = res[0].id;
    }
    if (raw === '' || raw === null || raw === undefined) {
      await pg("DELETE FROM horacio.estandar_proceso WHERE parte_id='" + pid + "' AND proceso='" + proceso + "'");
      return J({ ok: true, cleared: true });
    }
    const v = Number(raw);
    if (!(v > 0)) return J({ ok: false, error: 'valor inválido' });
    await pg("INSERT INTO horacio.estandar_proceso(parte_id,proceso,std_hr) VALUES('" + pid + "','" + proceso + "'," + v + ") ON CONFLICT (parte_id,proceso) DO UPDATE SET std_hr=EXCLUDED.std_hr");
    return J({ ok: true, std: v });
  }
  if (body.action === 'lanzar_programa') {
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return J({ ok: false, error: 'programa vacío' });
    if (items.length > 500) return J({ ok: false, error: 'demasiadas órdenes' });
    const num = (x) => { const n = Number(x); return (x === '' || x === null || x === undefined || !isFinite(n)) ? 'NULL' : String(n); };
    const dat = (x) => (/^\d{4}-\d{2}-\d{2}$/.test(String(x || '')) ? "'" + x + "'" : 'NULL');
    const txt = (x) => (x === null || x === undefined || x === '' ? 'NULL' : "'" + sql(String(x)) + "'");
    for (const it of items) {
      if (['SMT', 'PTH'].indexOf(String(it.area)) < 0) return J({ ok: false, error: 'área inválida' });
      if (!String(it.orden_trabajo || '').trim()) return J({ ok: false, error: 'falta orden_trabajo' });
    }
    const est = ['vencidas', 'cumplibles', 'pendiente', 'manual'].indexOf(String(body.estrategia_base)) >= 0 ? String(body.estrategia_base) : 'manual';
    await pg("UPDATE horacio.programa_oficial SET vigente=false WHERE vigente");
    const ins = await pg(
      "INSERT INTO horacio.programa_oficial(estrategia_base,lineas_smt,lineas_pth,fecha_meta,dias_habiles,nota,vigente) VALUES(" +
      "'" + est + "'," + num(body.lineas_smt) + "," + num(body.lineas_pth) + "," + dat(body.fecha_meta) + "," +
      num(body.dias_habiles) + "," + txt(body.nota) + ",true) RETURNING id");
    const pid = ins[0].id;
    const vals = items.map((it, i) =>
      "('" + pid + "','" + it.area + "'," + (Number(it.posicion) || (i + 1)) + "," + txt(it.orden_trabajo) + "," +
      txt(it.numero_parte) + "," + txt(it.descripcion) + "," + num(it.pendiente) + "," + txt(it.proceso_cuello) + "," +
      num(it.std_cuello) + "," + dat(it.inicia) + "," + dat(it.termina) + "," + num(it.tarde_dias) + "," + (it.espera_smt ? 'true' : 'false') + ")"
    ).join(',');
    await pg("INSERT INTO horacio.programa_oficial_ot(programa_id,area,posicion,orden_trabajo,numero_parte,descripcion,pendiente,proceso_cuello,std_cuello,inicia,termina,tarde_dias,espera_smt) VALUES " + vals);
    return J({ ok: true, id: pid, n: items.length });
  }
  if (body.action === 'set_cal_config') {
    const t = (x) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(x || '')) ? String(x) : null);
    const ti = t(body.turno_inicio), ci = t(body.comida_inicio), tf = t(body.turno_fin);
    const lib = Number(body.liberacion_min), com = Number(body.comida_min);
    if (!ti || !ci || !tf) return J({ ok: false, error: 'hora inválida (usa HH:MM)' });
    if (!(lib >= 0 && lib <= 240) || !(com >= 0 && com <= 180)) return J({ ok: false, error: 'minutos fuera de rango' });
    if (tf <= ti) return J({ ok: false, error: 'el fin de turno debe ser después del inicio' });
    await pg("UPDATE horacio.calendario_config SET turno_inicio='" + ti + "',liberacion_min=" + Math.round(lib) +
             ",comida_inicio='" + ci + "',comida_min=" + Math.round(com) + ",turno_fin='" + tf + "',actualizado_ts=now() WHERE id=1");
    return J({ ok: true });
  }
  return J({ ok: false, error: 'acción desconocida' });
}

// ---------- datos ----------
const otmetaRows = await pg(
  "SELECT orden_trabajo,numero_parte,numero_parte_efectivo,descripcion,partida,es_smt,estado_nexia," +
  "cant_ordenada,cant_terminada,pendiente,fecha_vence,proceso,meta_hr_sugerida,variantes,tableros " +
  "FROM horacio.v_ot_meta ORDER BY orden_trabajo, meta_hr_sugerida DESC");
const valRows = await pg(
  "SELECT linea,nombre,modelo,orden,proceso,meta_daniel,meta_sugerida,diferencia,numero_parte " +
  "FROM horacio.v_meta_validacion WHERE meta_sugerida IS NOT NULL ORDER BY abs(COALESCE(diferencia,0)), linea");
const incRows = await pg(
  "SELECT orden_trabajo,numero_parte,descripcion,partida,es_smt,pendiente,fecha_orden,fecha_vence," +
  "estado_nexia,sin_estandar,fecha_invalida,vencida_incompleta " +
  "FROM horacio.v_ot_inconsistencias ORDER BY sin_estandar DESC, vencida_incompleta DESC, fecha_vence");
const planRows = await pg(
  "SELECT orden_trabajo,area,numero_parte,descripcion,pendiente,proceso_cuello,std_cuello_hr," +
  "capacidad_dia,dias_necesarios,dias_a_vencer,plan_diario_cumplir,factible,fecha_vence " +
  "FROM horacio.v_plan_dia ORDER BY area, factible NULLS LAST, dias_a_vencer");
const comRows = await pg(
  "SELECT orden_trabajo,comentario FROM horacio.ordenes_trabajo WHERE comentario IS NOT NULL");
const motRows = await pg(
  "SELECT orden_trabajo,motivo_no_corre FROM horacio.ordenes_trabajo WHERE motivo_no_corre IS NOT NULL");
const vibDiaRows = await pg(
  "SELECT grupo,fecha,pzs FROM horacio.v_vibora_dia ORDER BY fecha");
const vibOtRows = await pg(
  "SELECT orden_base,numero_parte,descripcion,smt_ord,smt_term,fin_ord,fin_term,wip,posicion,fecha_vence " +
  "FROM horacio.v_vibora_ot ORDER BY wip DESC, posicion");
const estPartRows = await pg(
  "SELECT p.numero_parte, count(e.id) AS nstd, " +
  "EXISTS(SELECT 1 FROM horacio.ordenes_trabajo o WHERE o.numero_parte=p.numero_parte AND o.estado_nexia<>'muerta') AS en_ot, " +
  "max(COALESCE(p.descripcion,(SELECT descripcion FROM horacio.ordenes_trabajo o WHERE o.numero_parte=p.numero_parte LIMIT 1))) AS descripcion " +
  "FROM horacio.partes p LEFT JOIN horacio.estandar_proceso e ON e.parte_id=p.id " +
  "GROUP BY p.numero_parte ORDER BY (count(e.id)=0) DESC, p.numero_parte");
const estValRows = await pg(
  "SELECT p.numero_parte, e.proceso, round(avg(e.std_hr),1) AS std " +
  "FROM horacio.partes p JOIN horacio.estandar_proceso e ON e.parte_id=p.id GROUP BY p.numero_parte, e.proceso");
const progRows = await pg(
  "SELECT id,creado_ts,estrategia_base,lineas_smt,lineas_pth,fecha_meta,dias_habiles,nota " +
  "FROM horacio.programa_oficial WHERE vigente ORDER BY creado_ts DESC LIMIT 1");
const progOtRows = (progRows && progRows.length) ? await pg(
  "SELECT area,posicion,orden_trabajo,numero_parte,descripcion,pendiente,proceso_cuello,std_cuello,inicia,termina,tarde_dias,espera_smt " +
  "FROM horacio.programa_oficial_ot WHERE programa_id='" + progRows[0].id + "' ORDER BY area,posicion") : [];
const calCfgRows = await pg(
  "SELECT to_char(turno_inicio,'HH24:MI') AS turno_inicio,liberacion_min," +
  "to_char(comida_inicio,'HH24:MI') AS comida_inicio,comida_min,to_char(turno_fin,'HH24:MI') AS turno_fin " +
  "FROM horacio.calendario_config WHERE id=1");

// agrupar v_ot_meta por OT
const otMap = {};
for (const r of otmetaRows) {
  const k = r.orden_trabajo;
  if (!otMap[k]) otMap[k] = {
    orden: k, np: r.numero_parte, npe: r.numero_parte_efectivo, desc: r.descripcion,
    partida: r.partida, es_smt: r.es_smt, estado: r.estado_nexia,
    ordenada: Number(r.cant_ordenada) || 0, terminada: Number(r.cant_terminada) || 0,
    pendiente: Number(r.pendiente) || 0, vence: r.fecha_vence, procesos: []
  };
  otMap[k].procesos.push({
    proceso: r.proceso, meta: r.meta_hr_sugerida == null ? null : Number(r.meta_hr_sugerida),
    variantes: Number(r.variantes) || 1,
    tableros: (r.tableros || '').split(', ').filter((t) => t && t !== 'None')
  });
}
const ots = Object.values(otMap);

const val = valRows.map((r) => ({
  linea: r.linea, nombre: r.nombre, modelo: r.modelo, orden: r.orden, proceso: r.proceso,
  daniel: r.meta_daniel == null ? null : Number(r.meta_daniel),
  std: r.meta_sugerida == null ? null : Number(r.meta_sugerida),
  dif: r.diferencia == null ? null : Number(r.diferencia), np: r.numero_parte
}));

const inc = incRows.map((r) => ({
  orden: r.orden_trabajo, np: r.numero_parte, desc: r.descripcion, pendiente: Number(r.pendiente) || 0,
  vence: r.fecha_vence, estado: r.estado_nexia,
  sinEst: !!r.sin_estandar, fechaInv: !!r.fecha_invalida, vencida: !!r.vencida_incompleta
}));

const plan = planRows.map((r) => ({
  orden: r.orden_trabajo, area: r.area, np: r.numero_parte, desc: r.descripcion,
  pendiente: Number(r.pendiente) || 0, cuello: r.proceso_cuello,
  stdCuello: r.std_cuello_hr == null ? null : Number(r.std_cuello_hr),
  capDia: r.capacidad_dia == null ? null : Number(r.capacidad_dia),
  diasNec: r.dias_necesarios == null ? null : Number(r.dias_necesarios),
  diasVence: r.dias_a_vencer == null ? null : Number(r.dias_a_vencer),
  planDia: r.plan_diario_cumplir == null ? null : Number(r.plan_diario_cumplir),
  factible: r.factible, vence: r.fecha_vence
}));

const comentarios = {};
for (const c of comRows) comentarios[c.orden_trabajo] = c.comentario;
const motivos = {};
for (const m of motRows) motivos[m.orden_trabajo] = m.motivo_no_corre;

const N = (x) => (x == null ? null : Number(x));
const vibDia = vibDiaRows.map((r) => ({ grupo: r.grupo, fecha: r.fecha, pzs: N(r.pzs) || 0 }));
const vibOt = vibOtRows.map((r) => ({
  orden: r.orden_base, np: r.numero_parte, desc: r.descripcion,
  smtOrd: N(r.smt_ord), smtTerm: N(r.smt_term), finOrd: N(r.fin_ord), finTerm: N(r.fin_term),
  wip: N(r.wip) || 0, pos: r.posicion, vence: r.fecha_vence
}));

const estParts = estPartRows.map((r) => ({
  np: r.numero_parte, desc: r.descripcion, nstd: N(r.nstd) || 0, enOt: !!r.en_ot
}));
const progOficial = (progRows && progRows.length) ? {
  id: progRows[0].id,
  creado: String(progRows[0].creado_ts || '').slice(0, 16).replace('T', ' '),
  estrategia: progRows[0].estrategia_base, nota: progRows[0].nota,
  lineasSmt: N(progRows[0].lineas_smt), lineasPth: N(progRows[0].lineas_pth),
  fechaMeta: progRows[0].fecha_meta, dias: N(progRows[0].dias_habiles),
  ots: progOtRows.map((r) => ({
    area: r.area, pos: N(r.posicion), orden: r.orden_trabajo, np: r.numero_parte, desc: r.descripcion,
    pendiente: N(r.pendiente) || 0, cuello: r.proceso_cuello, stdCuello: N(r.std_cuello),
    inicia: r.inicia, termina: r.termina, tarde: N(r.tarde_dias), espera: !!r.espera_smt
  }))
} : null;
const estMap = {};
for (const r of estValRows) {
  (estMap[r.numero_parte] = estMap[r.numero_parte] || {})[r.proceso] = N(r.std);
}
const calCfg = (calCfgRows && calCfgRows[0]) ? {
  turno_inicio: calCfgRows[0].turno_inicio, liberacion_min: N(calCfgRows[0].liberacion_min) || 0,
  comida_inicio: calCfgRows[0].comida_inicio, comida_min: N(calCfgRows[0].comida_min) || 0,
  turno_fin: calCfgRows[0].turno_fin
} : { turno_inicio: '06:30', liberacion_min: 60, comida_inicio: '12:00', comida_min: 30, turno_fin: '15:30' };

const DATA = {
  generado: new Date().toISOString().slice(0, 16).replace('T', ' '),
  hoy: new Date().toISOString().slice(0, 10),
  ots, val, inc, plan, comentarios, motivos, vibDia, vibOt, estParts, estMap, progOficial, calCfg,
  resumen: {
    otTotal: inc.length, otConMeta: ots.length,
    sinEst: inc.filter((x) => x.sinEst).length,
    vencidas: inc.filter((x) => x.vencida).length,
    fechaInv: inc.filter((x) => x.fechaInv).length,
    match: val.filter((x) => x.dif != null && Math.abs(x.dif) < 2).length,
    valTotal: val.length,
    factibles: plan.filter((x) => x.factible === true).length,
    planeables: plan.filter((x) => x.factible !== null && x.factible !== undefined).length
  }
};

const PAGE = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0f172a">
<title>Horacio V2 · Meta automática</title><style>
:root{--bg:#f6f6f8;--card:#fff;--bd:#ececf0;--tx:#18181b;--mut:#71717a;--accent:#7c3aed;--ok:#16a34a;--warn:#d97706;--bad:#dc2626;--sh:0 1px 2px rgba(24,24,27,.04),0 4px 16px rgba(24,24,27,.05)}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
header{position:sticky;top:0;z-index:5;background:rgba(246,246,248,.82);backdrop-filter:saturate(180%) blur(10px);-webkit-backdrop-filter:saturate(180%) blur(10px);border-bottom:1px solid var(--bd);padding:13px 20px;display:flex;align-items:center;gap:10px}
header h1{font-size:17px;margin:0;font-weight:650;letter-spacing:-.01em}header .dot{color:var(--mut);font-weight:400}header .sub{color:var(--mut);font-size:12.5px;margin-left:auto;font-variant-numeric:tabular-nums}
.wrap{padding:18px 16px 40px;max-width:1180px;margin:0 auto}
.banner{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;border-radius:12px;padding:11px 14px;font-size:12.5px;line-height:1.5;margin-bottom:16px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:12px;margin-bottom:18px}
.kpi{background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:14px 16px;box-shadow:var(--sh)}
.kpi .v{font-size:26px;font-weight:680;letter-spacing:-.02em;font-variant-numeric:tabular-nums}.kpi .l{color:var(--mut);font-size:12px;margin-top:3px}
.tabs{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap}
.tabs button{border:1px solid var(--bd);background:var(--card);color:var(--tx);border-radius:99px;padding:7px 15px;font-size:13px;font-weight:600;cursor:pointer}
.tabs button.on{background:var(--accent);color:#fff;border-color:var(--accent)}
.card{background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:16px;margin-bottom:14px;box-shadow:var(--sh)}
.card h2{font-size:12px;margin:0 0 6px;color:var(--mut);text-transform:uppercase;letter-spacing:.06em;font-weight:600}
table{width:100%;border-collapse:collapse;font-size:13px}td,th{text-align:left;padding:7px 8px;border-bottom:1px solid var(--bd)}
th{color:var(--mut);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.04em}tr:last-child td{border-bottom:0}
.num{font-variant-numeric:tabular-nums;font-weight:600;text-align:right}
.pill{padding:2px 9px;border-radius:99px;font-size:11px;font-weight:700;color:#fff;white-space:nowrap}
.p-ok{background:var(--ok)}.p-warn{background:var(--warn)}.p-bad{background:var(--bad)}.p-mut{background:#a1a1aa}
.chip{display:inline-block;background:#f1f1f4;border-radius:6px;padding:1px 7px;font-size:11px;color:#52525b;margin:1px 2px 1px 0}
.ot{border:1px solid var(--bd);border-radius:14px;margin-bottom:9px;overflow:hidden}
.ot summary{list-style:none;cursor:pointer;padding:12px 14px;display:flex;align-items:center;gap:10px}
.ot summary::-webkit-details-marker{display:none}
.ot .otn{font-weight:680;font-size:14px}.ot .otd{color:var(--mut);font-size:12px}
.ot .meta{margin-left:auto;text-align:right;font-size:12px;color:var(--mut)}
.ot .body{padding:0 14px 12px}
.muted{color:var(--mut);font-size:12.5px}.empty{color:var(--mut);font-size:13px;padding:10px 0}
.hide{display:none}
.warn{border-radius:10px;padding:9px 11px;font-size:12.5px;line-height:1.5;margin:8px 0;border:1px solid}
.warn.bad{background:#fef2f2;border-color:#fecaca;color:#991b1b}
.warn.warn2{background:#fffbeb;border-color:#fde68a;color:#92400e}
.warn.ok2{background:#ecfdf5;border-color:#a7f3d0;color:#065f46}
.warn b{font-weight:700}
.coment{background:#f4f4f5;border:1px solid var(--bd);border-left:3px solid var(--accent);border-radius:8px;padding:8px 11px;font-size:12.5px;margin:8px 0;color:#3f3f46}
.coment .cl{font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);font-weight:700;margin-bottom:2px}
.wbadge{display:inline-block;font-size:10px;font-weight:700;padding:1px 6px;border-radius:5px;margin-left:6px;vertical-align:middle}
.wbadge.bad{background:#fecaca;color:#991b1b}.wbadge.warn2{background:#fde68a;color:#92400e}.wbadge.ok2{background:#a7f3d0;color:#065f46}
tr.clk{cursor:pointer}tr.clk:hover td{background:#fafafa}
tr.det td{background:#fafafa;padding:4px 14px 12px}
.motbox{margin:8px 0;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.motbox .cl{font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);font-weight:700}
.motbox select{border:1px solid var(--bd);border-radius:8px;padding:5px 9px;font-size:12.5px;background:#fff;color:var(--tx);font-weight:600}
.motclear{border:1px solid #fca5a5;background:#fff;color:#b91c1c;border-radius:8px;padding:5px 9px;font-size:11.5px;font-weight:700;cursor:pointer}
.motclear:hover{background:#fef2f2}
.savemsg{font-size:11.5px}
.snake{display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--bd)}
.snake:last-child{border:0}
.snhead{flex:0 0 200px;font-size:12.5px}.snhead b{font-weight:680}.snhead .sd{color:var(--mut);font-size:11px}
.stg{flex:1 1 120px;min-width:90px}
.stg .sl{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--mut);font-weight:700;margin-bottom:3px;display:flex;justify-content:space-between}
.pbar{height:16px;background:#ececed;border-radius:6px;overflow:hidden;position:relative}
.pbar>i{display:block;height:100%;background:var(--ok);border-radius:6px}
.pbar.na{background:repeating-linear-gradient(45deg,#f1f1f4,#f1f1f4 5px,#e8e8eb 5px,#e8e8eb 10px)}
.wiparrow{flex:0 0 auto;text-align:center;font-size:11px;color:var(--mut);min-width:54px}
.wiparrow .w{display:block;font-weight:800;color:var(--warn);font-size:13px}
.pospill{flex:0 0 auto;font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:99px}
.pospill.clk{cursor:pointer;border:1px solid transparent}
.pospill.clk:hover{filter:brightness(.95)}
.pospill.selon{outline:2px solid #111;outline-offset:1px}
.snake.fhide{display:none}
.pos-en_smt{background:#dbeafe;color:#1e40af}.pos-esperando_pth{background:#fde68a;color:#92400e}
.pos-en_final{background:#e9d5ff;color:#6b21a8}.pos-terminada{background:#a7f3d0;color:#065f46}.pos-sin_avance{background:#f1f1f4;color:#71717a}
.pulso td.hot{background:#fef2f2;color:#991b1b;font-weight:700}
.estpick{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:14px}
.estpick select{border:1px solid var(--bd);border-radius:9px;padding:7px 10px;font-size:13px;background:#fff;min-width:280px;font-weight:600}
.estgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}
.estcell{border:1px solid var(--bd);border-radius:10px;padding:9px 11px;background:#fff}
.estcell.empty{background:#fffbeb;border-color:#fde68a}
.estcell .el{font-size:11px;color:var(--mut);font-weight:700;text-transform:uppercase;letter-spacing:.03em;display:flex;justify-content:space-between;align-items:center}
.estcell input{width:100%;border:1px solid var(--bd);border-radius:7px;padding:6px 8px;font-size:14px;margin-top:5px;font-variant-numeric:tabular-nums;font-weight:600}
.estcell input:focus{outline:none;border-color:var(--accent)}
.estcell .es{font-size:10.5px;margin-top:3px;min-height:13px}
.pgctrl{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
.pgctrl button{border:1px solid var(--bd);background:#fff;border-radius:99px;padding:6px 13px;font-size:12.5px;font-weight:600;cursor:pointer}
.pgctrl button.on{background:var(--accent);color:#fff;border-color:var(--accent)}
.pgcap{margin-left:auto;display:flex;gap:6px;align-items:center;font-size:12px;color:var(--mut)}
.pgcap input{width:46px;border:1px solid var(--bd);border-radius:7px;padding:4px 6px;font-weight:700;text-align:center;font-size:13px}
.pghead{background:#faf5ff;border:1px solid #e9d5ff;border-radius:12px;padding:13px 15px;margin-bottom:14px}
.pghead .big{font-size:19px;font-weight:720;color:#6b21a8;letter-spacing:-.01em}
.pghead .l{color:var(--mut);font-size:12.5px;margin-top:3px}
tr.late td{background:#fef2f2}
.subhd{font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;margin:14px 0 6px}
tr.prow td.drag{cursor:grab;color:#a1a1aa;font-size:14px;width:24px;text-align:center;user-select:none;letter-spacing:-2px}
tr.prow td.drag:active{cursor:grabbing}
tr.prow.dragging{opacity:.4}
tr.prow.drop-into td{border-top:2px solid var(--accent)}
button.lanzar{border:1px solid var(--ok);background:var(--ok);color:#fff;border-radius:99px;padding:9px 18px;font-size:13.5px;font-weight:700;cursor:pointer}
button.lanzar:hover{filter:brightness(.96)}
.calnav{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.calnav button{border:1px solid var(--bd);background:#fff;border-radius:99px;width:34px;height:34px;font-size:16px;font-weight:700;cursor:pointer;line-height:1}
.calnav button:disabled{opacity:.35;cursor:default}
.calnav .cd{font-size:16px;font-weight:700;letter-spacing:-.01em}.calnav .cc{color:var(--mut);font-size:12px}
.gantt{margin:10px 0}
.glane{display:flex;align-items:stretch;gap:10px;margin-bottom:10px}
.glane .ghd{flex:0 0 92px;font-size:12.5px;font-weight:700;display:flex;flex-direction:column;justify-content:center}
.glane .ghd .gs{font-weight:500;color:var(--mut);font-size:11px}
.gtrack{position:relative;flex:1 1 auto;height:46px;background:#f4f4f5;border:1px solid var(--bd);border-radius:9px;overflow:hidden}
.gblk{position:absolute;top:3px;bottom:3px;background:var(--accent);color:#fff;border-radius:7px;padding:3px 7px;font-size:11px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.12);border:1px solid rgba(0,0,0,.05)}
.gblk.late{background:var(--bad)}.gblk .b1{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gblk .b2{opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gblk.cont{border-top-right-radius:0;border-bottom-right-radius:0}
.gnp{position:absolute;top:0;bottom:0;background:repeating-linear-gradient(45deg,#e4e4e7,#e4e4e7 5px,#d4d4d8 5px,#d4d4d8 10px);opacity:.7}
.gnp .gnl{position:absolute;top:2px;left:3px;font-size:9px;color:#52525b;font-weight:700;text-transform:uppercase;letter-spacing:.03em}
.gaxis{position:relative;height:16px;margin:2px 0 0 102px;font-size:10px;color:var(--mut)}
.gaxis span{position:absolute;transform:translateX(-50%);font-variant-numeric:tabular-nums}
.agenda{margin-top:6px}
.agenda .ah{font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;margin:12px 0 4px}
.agrow{display:flex;align-items:baseline;gap:10px;padding:6px 0;border-bottom:1px solid var(--bd);font-size:13px}
.agrow:last-child{border:0}
.agrow .at{flex:0 0 118px;font-weight:700;font-variant-numeric:tabular-nums}
.agrow .ao{flex:1 1 auto}.agrow .ao b{font-weight:680}.agrow .aq{flex:0 0 auto;color:var(--mut);font-size:12px;font-variant-numeric:tabular-nums}
.cfgform{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end}
.cfgform label{display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.03em}
.cfgform input{border:1px solid var(--bd);border-radius:8px;padding:6px 9px;font-size:14px;font-weight:600;width:104px;font-variant-numeric:tabular-nums}
.cfgform input:focus{outline:none;border-color:var(--accent)}
.cfgform button{border:1px solid var(--accent);background:var(--accent);color:#fff;border-radius:99px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer}
</style></head><body>
<header><h1>Horacio <span class="dot">V2</span> · Meta automática</h1><span class="sub" id="sub"></span></header>
<div class="wrap">
<div class="banner"><b>Versión NexIA.</b> Calcula la meta desde el Estándar x Hora y deja <b>capturar/editar</b> el estándar y el motivo. <b>No toca</b> lo que Daniel usa en vivo (su bot, panel y dashboard siguen igual). Escribe solo en las tablas nuevas.</div>
<div class="kpis" id="kpis"></div>
<div class="tabs">
<button data-t="plan" class="on">Plan del día</button>
<button data-t="prog">Programa</button>
<button data-t="cal">Calendario</button>
<button data-t="vib">Flujo víbora</button>
<button data-t="est">Estándar (capturar)</button>
<button data-t="meta">Meta automática por OT</button>
<button data-t="val">Validación vs Daniel</button>
<button data-t="inc">Inconsistencias</button>
</div>
<div id="plan"></div><div id="prog" class="hide"></div><div id="cal" class="hide"></div><div id="vib" class="hide"></div><div id="est" class="hide"></div><div id="meta" class="hide"></div><div id="val" class="hide"></div><div id="inc" class="hide"></div>
</div>
<script>var DATA=${JSON.stringify(DATA)};</script>
<script>
(function(){
var d=DATA, $=function(id){return document.getElementById(id);};
$('sub').textContent='Generado '+d.generado+'  ·  '+d.ots.length+' OT con meta';
var R=d.resumen;
$('kpis').innerHTML=[
 ['v',R.factibles+'/'+R.planeables,'Factibles a tiempo'],
 ['v',R.otConMeta+'/'+R.otTotal,'OT con meta auto'],
 ['v',R.match+'/'+R.valTotal,'Coinciden con Daniel'],
 ['v',R.sinEst,'OT sin estándar'],
 ['v',R.vencidas,'Vencidas']
].map(function(k){return '<div class="kpi"><div class="v">'+k[1]+'</div><div class="l">'+k[2]+'</div></div>';}).join('');

function esc(s){return (s==null?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function estPill(e){var c=e==='muerta'?'p-bad':e==='aprobada'?'p-ok':e==='cerrada'?'p-mut':'p-warn';return '<span class="pill '+c+'">'+esc(e)+'</span>';}

// mapas por OT + generador de alertas (warning dentro de la orden)
var incBy={}, planBy={};
d.inc.forEach(function(x){incBy[x.orden]=x;});
d.plan.forEach(function(x){planBy[x.orden]=x;});
function alertasDe(orden){
 var a=[], ic=incBy[orden], pl=planBy[orden];
 if(ic){
  if(ic.sinEst) a.push(['bad','Sin estándar','No tengo el estándar de esta parte: no puedo proponer meta ni plan. Hay que capturarlo en el catálogo.']);
  if(ic.fechaInv) a.push(['bad','Fecha imposible','La fecha de entrega es anterior a la fecha de orden — revisar la captura en el sistema.']);
  if(ic.vencida) a.push(['warn2','Vencida','La fecha de entrega ya pasó. Hay que renegociar la fecha o cerrar la orden.']);
  if(ic.pendiente===0) a.push(['ok2','Completa','Ya está completa (terminada = ordenada); solo falta cerrarla en el sistema.']);
 }
 if(pl && pl.factible===false && !(ic&&ic.vencida)) a.push(['warn2','No alcanza a tiempo','A estándar necesita '+pl.diasNec+' día(s) y faltan '+pl.diasVence+' para vencer. Necesita turno extra o adelantar.']);
 return a;
}
function warnHtml(orden){
 return alertasDe(orden).map(function(w){
  return '<div class="warn '+(w[0]==='bad'?'bad':w[0]==='warn2'?'warn2':'ok2')+'"><b>⚠ '+esc(w[1])+'.</b> '+esc(w[2])+'</div>';
 }).join('');
}
function wbadges(orden){
 return alertasDe(orden).map(function(w){return '<span class="wbadge '+w[0]+'">'+esc(w[1])+'</span>';}).join('');
}
function comentHtml(orden){
 var c=d.comentarios[orden];
 if(!c) return '';
 return '<div class="coment"><div class="cl">Comentario de manufactura</div>'+esc(c)+'</div>';
}
// --- captura de motivo (escritura POST) ---
var TK=new URLSearchParams(location.search).get('token')||'';
function api(p){p.token=TK;return fetch(location.pathname,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(p)}).then(function(r){return r.json();});}
var MOTLBL={falta_material:'Falta de material',falta_personal:'Falta de personal',maquina:'Máquina',otros:'Otros'};
function motBadge(orden){var m=d.motivos[orden];return m?'<span class="wbadge bad">no corre: '+esc(MOTLBL[m]||m)+'</span>':'';}
function motivoBox(orden){
 var cur=d.motivos[orden]||'';
 var opts=[['','— ¿por qué no corre? —'],['falta_material','Falta de material'],['falta_personal','Falta de personal'],['maquina','Máquina'],['otros','Otros']]
  .map(function(o){return '<option value="'+o[0]+'"'+(o[0]===cur?' selected':'')+'>'+esc(o[1])+'</option>';}).join('');
 return '<div class="motbox"><span class="cl">Motivo por el que no puede correr</span>'+
   '<select class="mot" data-orden="'+esc(orden)+'">'+opts+'</select> '+
   '<button type="button" class="motclear" data-orden="'+esc(orden)+'"'+(cur?'':' style="display:none"')+'>✕ quitar</button>'+
   ' <span class="savemsg muted"></span></div>';
}
function wireMotivos(scope){
 Array.prototype.forEach.call(document.querySelectorAll(scope+' select.mot'),function(sel){
  sel.onchange=function(){
   var box=sel.parentNode; var msg=box.querySelector('.savemsg'); var btn=box.querySelector('.motclear');
   if(msg){msg.textContent='guardando…';}
   api({action:'set_motivo',orden:sel.getAttribute('data-orden'),motivo:sel.value}).then(function(r){
    if(r&&r.ok){if(msg)msg.textContent=sel.value?'guardado ✓':'quitado ✓'; d.motivos[sel.getAttribute('data-orden')]=sel.value||undefined; if(btn)btn.style.display=sel.value?'':'none';}
    else{if(msg)msg.textContent=(r&&r.error)||'error';}
   }).catch(function(){if(msg)msg.textContent='error de red';});
  };
 });
 Array.prototype.forEach.call(document.querySelectorAll(scope+' button.motclear'),function(btn){
  btn.onclick=function(){
   var box=btn.parentNode; var sel=box.querySelector('select.mot'); var msg=box.querySelector('.savemsg');
   if(msg){msg.textContent='quitando…';}
   api({action:'set_motivo',orden:btn.getAttribute('data-orden'),motivo:''}).then(function(r){
    if(r&&r.ok){if(sel)sel.value=''; d.motivos[btn.getAttribute('data-orden')]=undefined; btn.style.display='none'; if(msg)msg.textContent='quitado ✓';}
    else{if(msg)msg.textContent=(r&&r.error)||'error';}
   }).catch(function(){if(msg)msg.textContent='error de red';});
  };
 });
}

// --- PLAN DEL DÍA (SMT / PTH) ---
function planTabla(area){
 var rows=d.plan.filter(function(p){return p.area===area;}).map(function(p){
   var fact=p.factible===true?'<span class="pill p-ok">sí alcanza</span>':p.factible===false?'<span class="pill p-bad">no alcanza</span>':'<span class="pill p-mut">sin estándar</span>';
   var venc=p.diasVence==null?'—':(p.diasVence<0?'<span style="color:var(--bad)">'+p.diasVence+'d (vencida)</span>':p.diasVence+'d');
   var cuello=p.cuello?esc(p.cuello)+' <span class="muted">@'+(p.stdCuello||'-')+'/hr</span>':'<span class="muted">—</span>';
   var wh=warnHtml(p.orden), ch=comentHtml(p.orden);
   var det='<tr class="det hide"><td colspan="9">'+(wh||'')+(ch||'')+motivoBox(p.orden)+'</td></tr>';
   return '<tr class="clk"><td>'+esc(p.orden)+wbadges(p.orden)+motBadge(p.orden)+'</td><td>'+esc(p.np)+'</td><td class="num">'+p.pendiente+'</td><td>'+cuello+
     '</td><td class="num">'+(p.capDia==null?'—':p.capDia)+'</td><td class="num">'+(p.diasNec==null?'—':p.diasNec)+
     '</td><td class="num">'+venc+'</td><td class="num">'+(p.planDia==null?'—':p.planDia)+'</td><td>'+fact+'</td></tr>'+det;
 }).join('');
 return '<div class="card"><h2>'+area+' — propuesta del día vs estándar</h2>'+
   '<table><thead><tr><th>OT</th><th>Parte</th><th class="num">Pend.</th><th>Cuello (estación)</th>'+
   '<th class="num">Cap/día</th><th class="num">Días nec.</th><th class="num">A vencer</th><th class="num">Plan/día p/cumplir</th><th>¿A tiempo?</th></tr></thead><tbody>'+
   (rows||'<tr><td colspan=9 class="empty">Sin órdenes.</td></tr>')+'</tbody></table></div>';
}
$('plan').innerHTML='<div class="muted" style="margin:-4px 0 12px">Cap/día = estándar del cuello × 8 h productivas. Plan/día = piezas/día para terminar lo pendiente antes de la fecha de entrega. Toca una orden para ver alertas y comentario.</div>'+planTabla('SMT')+planTabla('PTH');
Array.prototype.forEach.call(document.querySelectorAll('#plan tr.clk'),function(r){r.onclick=function(e){if(e.target&&(e.target.tagName==='SELECT'||e.target.tagName==='OPTION'))return;var x=r.nextElementSibling;if(x)x.classList.toggle('hide');};});
wireMotivos('#plan');

// --- META por OT (SMT / PTH) ---
function otCard(o){
 var proc=o.procesos.filter(function(p){return p.meta!=null;}).sort(function(a,b){return b.meta-a.meta;});
 var rows=proc.map(function(p){
   var tb=p.tableros.length?p.tableros.map(function(t){return '<span class="chip">'+esc(t)+'</span>';}).join(''):'<span class="muted">sin tablero asignado</span>';
   var vw=p.variantes>1?' <span class="muted">('+p.variantes+' var.)</span>':'';
   return '<tr><td>'+esc(p.proceso)+'</td><td class="num">'+p.meta+'/hr'+vw+'</td><td>'+tb+'</td></tr>';
 }).join('');
 var fall=(o.npe&&o.npe!==o.np)?' <span class="muted">(estd. vía '+esc(o.npe)+')</span>':'';
 return '<details class="ot"><summary><span><span class="otn">'+esc(o.orden)+'</span> '+estPill(o.estado)+wbadges(o.orden)+motBadge(o.orden)+
   '<div class="otd">'+esc(o.np)+fall+' · '+esc(o.desc||'')+'</div></span>'+
   '<span class="meta">pend. <b>'+o.pendiente+'</b><br>vence '+esc(o.vence)+'</span></summary>'+
   '<div class="body">'+warnHtml(o.orden)+comentHtml(o.orden)+motivoBox(o.orden)+
   '<table><thead><tr><th>Estación</th><th class="num">Meta sugerida</th><th>Tableros HxH</th></tr></thead><tbody>'+
   (rows||'<tr><td colspan=3 class="empty">Sin estación con estándar.</td></tr>')+'</tbody></table></div></details>';
}
function metaSec(smt,titulo){
 var h=d.ots.filter(function(o){return !!o.es_smt===smt;}).map(otCard).join('');
 return '<div class="card"><h2>'+titulo+'</h2>'+(h||'<div class="empty">Sin OT.</div>')+'</div>';
}
$('meta').innerHTML=metaSec(true,'SMT — subensamble')+metaSec(false,'PTH / Producto final');
wireMotivos('#meta');

// --- FLUJO VÍBORA ---
(function(){
 // pulso diario
 var ETAPAS=['SMT','PTH','EMPAQUE','EMBARQUES'];
 var byDia={};
 d.vibDia.forEach(function(x){(byDia[x.fecha]=byDia[x.fecha]||{})[x.grupo]=x.pzs;});
 var fechas=Object.keys(byDia).sort();
 var anomalia=false;
 var pulso=fechas.map(function(f){
  var row=byDia[f];
  var emp=row.EMPAQUE||0, emb=row.EMBARQUES||0, hot=(emb>emp&&emb>0);
  if(hot)anomalia=true;
  return '<tr><td>'+esc(f)+'</td>'+ETAPAS.map(function(g){
    var v=row[g]||0; var cls=(g==='EMPAQUE'&&hot)?' class="num hot"':' class="num"';
    return '<td'+cls+'>'+(v||'·')+'</td>';
  }).join('')+'</tr>';
 }).join('');
 var pulsoCard='<div class="card"><h2>Pulso diario — actividad por etapa</h2>'+
   '<table class="pulso"><thead><tr><th>Fecha</th><th class="num">SMT</th><th class="num">PTH</th><th class="num">Empaque</th><th class="num">Embarques</th></tr></thead><tbody>'+
   (pulso||'<tr><td colspan=5 class="empty">Sin datos.</td></tr>')+'</tbody></table>'+
   (anomalia?'<div class="warn bad" style="margin-top:10px"><b>⚠ Posible captura errónea.</b> Hay días donde Embarques sacó más de lo que Empaque registró — empaque está sub-capturando, o se embarcó de inventario previo. Revisar con piso.</div>':'')+
   '<div class="muted" style="margin-top:6px">Actividad por etapa (PTH/Empaque son varias estaciones; no es conservación estricta). El WIP exacto va abajo, por OT.</div></div>';

 // WIP por OT (serpiente exacta)
 var POSL={en_smt:'en SMT',esperando_pth:'esperando PTH',en_final:'en final',terminada:'terminada',sin_avance:'sin avance'};
 function stage(lbl,term,ord){
  if(ord==null) return '<div class="stg"><div class="sl"><span>'+lbl+'</span><span>n/a</span></div><div class="pbar na"></div></div>';
  var pct=ord>0?Math.min(100,Math.round(term/ord*100)):0;
  return '<div class="stg"><div class="sl"><span>'+lbl+'</span><span>'+(term||0)+'/'+ord+'</span></div><div class="pbar"><i style="width:'+pct+'%"></i></div></div>';
 }
 var rows=d.vibOt.map(function(o){
  return '<div class="snake" data-pos="'+esc(o.pos)+'"><div class="snhead"><b>'+esc(o.orden)+'</b> <span class="pospill pos-'+o.pos+'">'+esc(POSL[o.pos]||o.pos)+'</span>'+
    '<div class="sd">'+esc(o.np||'—')+'</div></div>'+
    stage('SMT',o.smtTerm,o.smtOrd)+
    '<div class="wiparrow">→'+(o.wip>0?'<span class="w">⏳'+o.wip+'</span>':'')+'</div>'+
    stage('Final (PTH→Empaque)',o.finTerm,o.finOrd)+'</div>';
 }).join('');
 var cont={};d.vibOt.forEach(function(o){cont[o.pos]=(cont[o.pos]||0)+1;});
 var wipTot=d.vibOt.reduce(function(a,o){return a+o.wip;},0);
 var chips='<span class="pospill clk vibflt" data-pos="" style="margin-right:6px;background:#e5e7eb;color:#374151">todas: '+d.vibOt.length+'</span>'+
   Object.keys(POSL).filter(function(k){return cont[k];}).map(function(k){
   return '<span class="pospill clk vibflt pos-'+k+'" data-pos="'+k+'" style="margin-right:6px">'+POSL[k]+': '+cont[k]+'</span>';}).join('');
 var wipCard='<div class="card"><h2>WIP por OT — dónde está cada orden en el flujo</h2>'+
   '<div class="muted" style="margin:-4px 0 8px;font-size:11.5px">Toca una etapa para filtrar las órdenes (ej. <b>en SMT</b>). Toca de nuevo o <b>todas</b> para quitar el filtro.</div>'+
   '<div style="margin-bottom:10px">'+chips+'<span class="chip" style="font-weight:700">WIP total entre SMT y final: '+wipTot+' pzs</span></div>'+
   '<div id="vibrows">'+(rows||'<div class="empty">Sin órdenes.</div>')+'</div></div>';
 $('vib').innerHTML=pulsoCard+wipCard;
 // filtro por etapa (clic en chip)
 var fActive='';
 function applyVibFilter(){
  Array.prototype.forEach.call(document.querySelectorAll('#vibrows .snake'),function(el){
   if(!fActive||el.getAttribute('data-pos')===fActive)el.classList.remove('fhide');else el.classList.add('fhide');
  });
  Array.prototype.forEach.call(document.querySelectorAll('#vib .pospill.vibflt'),function(c){
   if(fActive&&c.getAttribute('data-pos')===fActive)c.classList.add('selon');else c.classList.remove('selon');
  });
 }
 Array.prototype.forEach.call(document.querySelectorAll('#vib .pospill.vibflt'),function(c){
  c.onclick=function(){var p=c.getAttribute('data-pos')||'';fActive=(fActive===p)?'':p;applyVibFilter();};
 });
})();

// --- EDITOR DE ESTÁNDAR (capturar/editar) ---
(function(){
 var PROC=[['PP_481','P&P 481'],['PP_520','P&P 520'],['PP_411_481','P&P 411-481'],['PP_421','P&P 421'],
   ['ENSAMBLE_MANUAL','Ensamble Manual'],['WAVE_SOLDER','Wave/Ola'],['SOLDEO_MANUAL','Soldeo Manual'],
   ['ICT','ICT'],['GRB','Grabación'],['CONFORMAL','Conformal'],['LIMPIEZA','Limpieza'],['FCT','FCT'],
   ['ENSAMBLES','Ensambles'],['PRUEBA_FCT','Prueba FCT'],['EMPAQUE','Empaque']];
 var prio=d.estParts.filter(function(p){return p.nstd===0&&p.enOt;});
 var sin=d.estParts.filter(function(p){return p.nstd===0&&!p.enOt;});
 var con=d.estParts.filter(function(p){return p.nstd>0;});
 function opts(list){return list.map(function(p){return '<option value="'+esc(p.np)+'">'+esc(p.np)+(p.desc?' · '+esc(String(p.desc).slice(0,40)):'')+'</option>';}).join('');}
 var sel='<select id="estpick"><option value="">— elige una parte —</option>'+
   (prio.length?'<optgroup label="⚠ Sin estándar · de OT en proceso ('+prio.length+')">'+opts(prio)+'</optgroup>':'')+
   (sin.length?'<optgroup label="Sin estándar ('+sin.length+')">'+opts(sin)+'</optgroup>':'')+
   (con.length?'<optgroup label="Con estándar — editar ('+con.length+')">'+opts(con)+'</optgroup>':'')+'</select>';
 $('est').innerHTML='<div class="card"><h2>Capturar / editar estándar por hora</h2>'+
   '<div class="muted" style="margin-bottom:10px">Llena el Std/Hr de cada estación. Se guarda al salir del campo. Vacío = borra ese estándar. Las partes <b>⚠ de OT en proceso</b> son prioridad: al llenarlas, su meta y plan salen solos.</div>'+
   '<div class="estpick">'+sel+'<span id="estinfo" class="muted"></span></div>'+
   '<div id="estgrid"></div></div>';

 function renderGrid(np){
  var info=$('estinfo');
  if(!np){$('estgrid').innerHTML='';if(info)info.textContent='';return;}
  var cur=d.estMap[np]||{};
  var pp=d.estParts.filter(function(x){return x.np===np;})[0]||{};
  if(info)info.innerHTML=pp.enOt?'<span class="wbadge bad">en OT en proceso</span>':'';
  $('estgrid').innerHTML='<div class="estgrid">'+PROC.map(function(pc){
   var v=cur[pc[0]];var has=v!=null;
   return '<div class="estcell'+(has?'':' empty')+'" data-proc="'+pc[0]+'"><div class="el"><span>'+esc(pc[1])+'</span><span>'+(has?'':'vacío')+'</span></div>'+
     '<input type="number" min="0" step="0.1" value="'+(has?v:'')+'" data-np="'+esc(np)+'" data-proc="'+pc[0]+'" placeholder="—"><div class="es muted"></div></div>';
  }).join('')+'</div>';
  Array.prototype.forEach.call($('estgrid').querySelectorAll('input'),function(inp){
   inp.onchange=function(){
    var es=inp.parentNode.querySelector('.es');es.textContent='guardando…';es.className='es muted';
    api({action:'set_estandar',numero_parte:inp.getAttribute('data-np'),proceso:inp.getAttribute('data-proc'),std_hr:inp.value,descripcion:pp.desc||''}).then(function(r){
     if(r&&r.ok){
      es.textContent=r.cleared?'borrado':'guardado ✓';es.className='es';es.style.color='var(--ok)';
      d.estMap[np]=d.estMap[np]||{};
      if(r.cleared){delete d.estMap[np][inp.getAttribute('data-proc')];inp.parentNode.classList.add('empty');}
      else{d.estMap[np][inp.getAttribute('data-proc')]=r.std;inp.parentNode.classList.remove('empty');}
     } else {es.textContent=(r&&r.error)||'error';es.style.color='var(--bad)';}
    }).catch(function(){es.textContent='error de red';es.style.color='var(--bad)';});
   };
  });
 }
 var pick=$('estpick');
 pick.onchange=function(){renderGrid(pick.value);};
 if(prio.length){pick.value=prio[0].np;renderGrid(prio[0].np);}  // arranca en la 1ª prioridad
})();

// --- PROGRAMA (secuenciador hacia adelante, multi-estrategia, precedencia SMT→final) ---
(function(){
 var MES=['','ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
 function addDays(iso,n){var dt=new Date(iso+'T00:00:00');dt.setDate(dt.getDate()+n);return dt.toISOString().slice(0,10);}
 function fmt(iso){var p=iso.split('-');return p[2]+'-'+MES[parseInt(p[1],10)];}
 function diff(a,b){return Math.round((new Date(a+'T00:00:00')-new Date(b+'T00:00:00'))/86400000);}
 function base(orden){return String(orden).replace(/-\d+$/,'');}
 var HOY=d.hoy;
 var items=d.plan.filter(function(p){return p.pendiente>0 && p.stdCuello;});
 var noProg=d.plan.filter(function(p){return p.pendiente>0 && !p.stdCuello;});
 function cmpV(a,b){return (a.vence||'9999')<(b.vence||'9999')?-1:(a.vence||'9999')>(b.vence||'9999')?1:0;}
 var MODES={
  vencidas:function(a,b){return cmpV(a,b);},
  cumplibles:function(a,b){var fa=a.factible===true?0:1,fb=b.factible===true?0:1;if(fa!==fb)return fa-fb;return fa===0?cmpV(a,b):-cmpV(a,b);},
  pendiente:function(a,b){return b.pendiente-a.pendiente;}
 };
 var MODEL={vencidas:'Vencidas primero',cumplibles:'Las que aún se pueden cumplir',pendiente:'Mayor pendiente primero'};
 var state={mode:'vencidas',smt:2,pth:3,order:{SMT:null,PTH:null}};

 // orden efectivo de un área: manual (drag) si existe, si no la estrategia
 function ordered(area){
  var arr=items.filter(function(p){return p.area===area;});
  var ord=state.order[area];
  if(ord){
   var idx={};ord.forEach(function(o,i){idx[o]=i;});
   arr.sort(function(a,b){
    var ia=idx[a.orden],ib=idx[b.orden];
    if(ia==null&&ib==null)return MODES[state.mode](a,b);
    if(ia==null)return 1; if(ib==null)return -1; return ia-ib;
   });
  } else { arr.sort(MODES[state.mode]); }
  return arr;
 }

 // precedencia: 1º programa SMT; el FINAL de una OT no arranca hasta que su SMT termina
 function schedule(){
  var capS=8*Math.max(1,state.smt), capP=8*Math.max(1,state.pth);
  var smt=ordered('SMT');
  var pth=ordered('PTH');
  var smtFin={}, cumS=0;
  var outS=smt.map(function(p){
   var hrs=p.pendiente/p.stdCuello, startOff=Math.floor(cumS/capS); cumS+=hrs;
   var finOff=Math.ceil(cumS/capS); smtFin[base(p.orden)]=finOff;
   return {p:p,inicia:addDays(HOY,startOff),termina:addDays(HOY,finOff),finOff:finOff,tarde:p.vence?diff(addDays(HOY,finOff),p.vence):null,espera:false};
  });
  var cumP=0;
  var outP=pth.map(function(p){
   var hrs=p.pendiente/p.stdCuello, minHrs=(smtFin[base(p.orden)]||0)*capP, espera=cumP<minHrs;
   if(espera)cumP=minHrs;                               // espera a que SMT cierre (precedencia)
   var startOff=Math.floor(cumP/capP); cumP+=hrs;
   var finOff=Math.ceil(cumP/capP);
   return {p:p,inicia:addDays(HOY,startOff),termina:addDays(HOY,finOff),finOff:finOff,tarde:p.vence?diff(addDays(HOY,finOff),p.vence):null,espera:espera};
  });
  var maxOff=0;outS.concat(outP).forEach(function(x){if(x.finOff>maxOff)maxOff=x.finOff;});
  return {smt:outS,pth:outP,fin:addDays(HOY,maxOff),dias:maxOff,capS:capS/8,capP:capP/8};
 }

 // sugerencia HxH mínimo: con 3 líderes, trackear solo el CUELLO de cada área
 function liderDe(proc){
  if(['PP_481','PP_520','PP_411_481','PP_421'].indexOf(proc)>=0)return 'SMT';
  if(['ENSAMBLE_MANUAL','WAVE_SOLDER','SOLDEO_MANUAL','ICT'].indexOf(proc)>=0)return 'PTH';
  return 'ACAB';
 }
 var LIDER={SMT:'SMT — Viridiana',PTH:'PTH — Yadira',ACAB:'Conformal/Empaque'};
 var PLBL={PP_481:'P&P 481',PP_520:'P&P 520',PP_411_481:'P&P 411-481',PP_421:'P&P 421',ENSAMBLE_MANUAL:'Ensamble Manual',WAVE_SOLDER:'Wave/Ola',SOLDEO_MANUAL:'Soldeo Manual',ICT:'ICT',GRB:'Grabación',CONFORMAL:'Conformal',LIMPIEZA:'Limpieza',FCT:'FCT',ENSAMBLES:'Ensambles',PRUEBA_FCT:'Prueba FCT',EMPAQUE:'Empaque'};
 function recoHxH(){
  var rec={SMT:{},PTH:{},ACAB:{}};
  items.forEach(function(p){if(!p.cuello)return;var L=liderDe(p.cuello);rec[L][p.cuello]=(rec[L][p.cuello]||0)+1;});
  return ['SMT','PTH','ACAB'].map(function(L){
   var cu=Object.keys(rec[L]).sort(function(a,b){return rec[L][b]-rec[L][a];});
   var chips=cu.slice(0,2).map(function(c){return '<span class="chip" style="font-weight:700">'+esc(PLBL[c]||c)+'</span> <span class="muted">cuello en '+rec[L][c]+' OT</span>';}).join(' · ');
   return '<tr><td><b>'+esc(LIDER[L])+'</b></td><td>'+(chips||'<span class="muted">sin órdenes hoy</span>')+'</td></tr>';
  }).join('');
 }

 function modeLbl(m){return MODEL[m]||(m==='manual'?'Orden manual':m);}

 // --- card del programa oficial vigente (foto congelada en BD) ---
 function vigenteCard(){
  var pf=d.progOficial;
  if(!pf) return '<div class="card"><h2>Programa oficial</h2><div class="empty">Aún no hay programa oficial. Acomoda el orden abajo (arrastra ≡) y dale <b>Lanzar</b>.</div></div>';
  var byA={SMT:[],PTH:[]};pf.ots.forEach(function(o){if(byA[o.area])byA[o.area].push(o);});
  function sec(t,arr){
   if(!arr.length)return '';
   return '<div class="subhd">'+t+'</div><table><thead><tr><th>#</th><th>OT</th><th>Parte</th><th class="num">Pend.</th><th>Cuello</th><th>Inicia → Termina</th><th>Entrega</th></tr></thead><tbody>'+
    arr.map(function(o){
     var vs=o.tarde==null?'<span class="muted">—</span>':(o.tarde<=0?'<span class="pill p-ok">a tiempo</span>':'<span class="pill p-bad">+'+o.tarde+'d</span>');
     return '<tr'+(o.tarde>0?' class="late"':'')+'><td>'+o.pos+'</td><td>'+esc(o.orden)+'</td><td>'+esc(o.np||'—')+'</td><td class="num">'+o.pendiente+'</td><td>'+esc(PLBL[o.cuello]||o.cuello||'')+'</td><td>'+(o.inicia?fmt(o.inicia):'—')+' → <b>'+(o.termina?fmt(o.termina):'—')+'</b></td><td>'+vs+'</td></tr>';
    }).join('')+'</tbody></table>';
  }
  return '<div class="card" style="border-color:#a7f3d0;background:#f0fdf4">'+
    '<h2 style="color:#065f46">✓ Programa oficial vigente</h2>'+
    '<div class="pghead" style="background:#fff;border-color:#a7f3d0;margin-bottom:12px"><div class="big" style="color:#065f46">Meta de entrega: '+(pf.fechaMeta?fmt(pf.fechaMeta):'—')+(pf.dias!=null?' <span class="l" style="font-weight:500">(~'+pf.dias+' días hábiles)</span>':'')+'</div>'+
    '<div class="l">Estrategia base: <b>'+esc(modeLbl(pf.estrategia))+'</b> · SMT '+(pf.lineasSmt||'-')+' / PTH '+(pf.lineasPth||'-')+' líneas · lanzado '+esc(pf.creado)+'</div></div>'+
    sec('SMT — subensamble',byA.SMT)+sec('Final (PTH → Empaque)',byA.PTH)+'</div>';
 }

 function rowToItem(x,area,pos){
  var p=x.p;
  return {area:area,posicion:pos,orden_trabajo:p.orden,numero_parte:p.np,descripcion:p.desc,
    pendiente:p.pendiente,proceso_cuello:p.cuello,std_cuello:p.stdCuello,
    inicia:x.inicia,termina:x.termina,tarde_dias:x.tarde,espera_smt:!!x.espera};
 }
 function esManual(){return !!(state.order.SMT||state.order.PTH);}

 function lanzar(){
  var s=schedule(), msg=$('pglmsg');
  if(msg){msg.textContent='lanzando…';msg.style.color='';}
  var its=[];
  s.smt.forEach(function(x,i){its.push(rowToItem(x,'SMT',i+1));});
  s.pth.forEach(function(x,i){its.push(rowToItem(x,'PTH',i+1));});
  api({action:'lanzar_programa',estrategia_base:esManual()?'manual':state.mode,
    lineas_smt:state.smt,lineas_pth:state.pth,fecha_meta:s.fin,dias_habiles:s.dias,items:its})
  .then(function(r){
   if(r&&r.ok){
    if(msg){msg.textContent='✓ programa oficial lanzado ('+r.n+' OT)';msg.style.color='var(--ok)';}
    d.progOficial={id:r.id,creado:d.generado,estrategia:esManual()?'manual':state.mode,
      lineasSmt:state.smt,lineasPth:state.pth,fechaMeta:s.fin,dias:s.dias,
      ots:its.map(function(it){return {area:it.area,pos:it.posicion,orden:it.orden_trabajo,np:it.numero_parte,desc:it.descripcion,pendiente:it.pendiente,cuello:it.proceso_cuello,stdCuello:it.std_cuello,inicia:it.inicia,termina:it.termina,tarde:it.tarde_dias,espera:it.espera_smt};})};
    render();
   } else { if(msg){msg.textContent=(r&&r.error)||'error';msg.style.color='var(--bad)';} }
  }).catch(function(){if(msg){msg.textContent='error de red';msg.style.color='var(--bad)';}});
 }

 // reordenar un área: mueve "from" justo ANTES de "to"
 function reorder(area,from,to){
  var arr=ordered(area).map(function(p){return p.orden;});
  var fi=arr.indexOf(from); if(fi<0)return;
  arr.splice(fi,1);
  var ti=arr.indexOf(to); if(ti<0)ti=arr.length;
  arr.splice(ti,0,from);
  state.order[area]=arr;
  render();
 }
 function wireDrag(){
  var dragEl=null;
  Array.prototype.forEach.call($('prog').querySelectorAll('tr.prow'),function(tr){
   tr.ondragstart=function(e){dragEl=tr;tr.classList.add('dragging');if(e.dataTransfer){e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',tr.getAttribute('data-orden'));}catch(_){}}};
   tr.ondragend=function(){tr.classList.remove('dragging');Array.prototype.forEach.call($('prog').querySelectorAll('tr.prow'),function(r){r.classList.remove('drop-into');});dragEl=null;};
   tr.ondragover=function(e){
    if(!dragEl||dragEl===tr)return;
    if(dragEl.getAttribute('data-area')!==tr.getAttribute('data-area'))return;
    e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='move';tr.classList.add('drop-into');
   };
   tr.ondragleave=function(){tr.classList.remove('drop-into');};
   tr.ondrop=function(e){
    if(!dragEl||dragEl===tr)return;
    var area=dragEl.getAttribute('data-area');
    if(area!==tr.getAttribute('data-area'))return;
    e.preventDefault();
    reorder(area,dragEl.getAttribute('data-orden'),tr.getAttribute('data-orden'));
   };
  });
 }

 function render(){
  var s=schedule();
  var all=s.smt.concat(s.pth);
  var aTiempo=all.filter(function(x){return x.tarde!=null&&x.tarde<=0;}).length;
  var tarde=all.filter(function(x){return x.tarde!=null&&x.tarde>0;}).length;
  var ctrl='<div class="pgctrl">'+Object.keys(MODEL).map(function(k){
    return '<button data-m="'+k+'"'+(state.mode===k&&!esManual()?' class="on"':'')+'>'+MODEL[k]+'</button>';}).join('')+
    (esManual()?'<button data-m="reset" class="on" style="background:var(--warn);border-color:var(--warn)">Orden manual ✎ (reiniciar)</button>':'')+
    '<span class="pgcap">Líneas: SMT <input id="pgsmt" type="number" min="1" value="'+state.smt+'"> PTH <input id="pgpth" type="number" min="1" value="'+state.pth+'"></span></div>';
  var head='<div class="pghead"><div class="big">Te pones al corriente: '+fmt(s.fin)+' <span class="l" style="font-weight:500">(~'+s.dias+' días hábiles)</span></div>'+
    '<div class="l">Estrategia: <b>'+(esManual()?'Orden manual':MODEL[state.mode])+'</b> · SMT '+s.capS+' / PTH '+s.capP+' líneas · precedencia SMT→final activa · '+
    '<span style="color:var(--ok)">'+aTiempo+' a tiempo</span> · <span style="color:var(--bad)">'+tarde+' tarde</span></div></div>';
  var launch='<div class="card" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">'+
    '<button id="pglanzar" class="lanzar">🚀 Lanzar como programa oficial</button>'+
    '<span id="pglmsg" class="muted"></span>'+
    '<span class="muted" style="margin-left:auto;font-size:12px;max-width:340px">Congela este orden y fechas como referencia oficial. No toca el flujo de Daniel (bot/dashboard).</span></div>';
  function fila(x,i){
   var p=x.p;
   var vs=x.tarde==null?'<span class="muted">sin fecha</span>':(x.tarde<=0?'<span class="pill p-ok">a tiempo</span>':'<span class="pill p-bad">+'+x.tarde+'d tarde</span>');
   return '<tr class="prow'+(x.tarde>0?' late':'')+'" draggable="true" data-orden="'+esc(p.orden)+'" data-area="'+esc(p.area)+'">'+
     '<td class="drag" title="Arrastra para reordenar">⠿</td><td class="tdimm">'+(i+1)+'</td><td>'+esc(p.orden)+'</td><td>'+esc(p.np||'—')+
     '</td><td class="num">'+p.pendiente+'</td><td>'+esc(PLBL[p.cuello]||p.cuello||'')+' <span class="muted">@'+(p.stdCuello||'-')+'</span>'+
     '</td><td>'+fmt(x.inicia)+' → <b>'+fmt(x.termina)+'</b>'+(x.espera?' <span class="muted">(espera SMT)</span>':'')+'</td><td>'+vs+'</td></tr>';
  }
  function seccion(titulo,arr,area){
   return '<div class="subhd">'+titulo+'</div><table><thead><tr><th></th><th>#</th><th>OT</th><th>Parte</th><th class="num">Pend.</th><th>Cuello</th><th>Inicia → Termina</th><th>Entrega</th></tr></thead><tbody data-area="'+area+'">'+
     (arr.map(fila).join('')||'<tr><td colspan=8 class="empty">—</td></tr>')+'</tbody></table>';
  }
  var tabla='<div class="card"><div class="muted" style="margin-bottom:8px">Arrastra <b>⠿</b> para subir/bajar prioridad dentro de cada sección. Las fechas se recalculan al soltar.</div>'+
    seccion('1) SMT — subensamble',s.smt,'SMT')+seccion('2) Final (PTH → Empaque) — arranca al cerrar su SMT',s.pth,'PTH')+
    (noProg.length?'<div class="warn warn2" style="margin-top:10px"><b>⚠ '+noProg.length+' OT no se pueden programar</b> (sin estándar): '+noProg.map(function(p){return esc(p.orden);}).join(', ')+'. Captúralas en el tab Estándar.</div>':'')+'</div>';
  var reco='<div class="card"><h2>Control con 3 líderes — HxH mínimo sugerido</h2>'+
    '<div class="muted" style="margin-bottom:8px">En vez de 15 tableros, cada líder trackea el <b>cuello de su área</b> (la estación que marca el ritmo). Lo demás se deduce.</div>'+
    '<table><thead><tr><th>Líder / área</th><th>Tablero(s) clave a capturar</th></tr></thead><tbody>'+recoHxH()+'</tbody></table></div>';
  $('prog').innerHTML=vigenteCard()+'<div class="muted" style="margin-bottom:10px">Elige una estrategia como punto de partida, arrastra para afinar, y cuando quede dale <b>Lanzar como programa oficial</b>. El final de una OT arranca al cerrar su SMT.</div>'+ctrl+head+launch+tabla+reco;
  Array.prototype.forEach.call($('prog').querySelectorAll('.pgctrl button'),function(b){b.onclick=function(){
   var m=b.getAttribute('data-m');
   if(m==='reset'){state.order={SMT:null,PTH:null};}
   else{state.mode=m;state.order={SMT:null,PTH:null};}
   render();
  };});
  var si=$('pgsmt'),pi=$('pgpth');
  if(si)si.onchange=function(){state.smt=parseInt(si.value,10)||1;render();};
  if(pi)pi.onchange=function(){state.pth=parseInt(pi.value,10)||1;render();};
  var lb=$('pglanzar'); if(lb)lb.onclick=lanzar;
  wireDrag();
 }
 render();
})();

// --- CALENDARIO detallado por hora (Fase A · por área) ---
(function(){
 var MES=['','ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
 var DIA=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
 function hm2min(s){var p=String(s||'0:0').split(':');return (parseInt(p[0],10)||0)*60+(parseInt(p[1],10)||0);}
 function min2hm(m){m=Math.round(m);var h=Math.floor(m/60),mm=m%60;return (h<10?'0':'')+h+':'+(mm<10?'0':'')+mm;}
 function iso(dt){return dt.toISOString().slice(0,10);}
 function fmtLong(s){var dt=new Date(s+'T00:00:00');return DIA[dt.getDay()]+' '+parseInt(s.split('-')[2],10)+'-'+MES[parseInt(s.split('-')[1],10)];}
 function isWeekend(dt){var g=dt.getDay();return g===0||g===6;}

 // vence / factible por OT (del plan del día) para marcar atrasos
 var vBy={},fBy={};
 d.plan.forEach(function(p){vBy[p.orden]=p.vence;fBy[p.orden]=p.factible;});

 var cfg={turno_inicio:d.calCfg.turno_inicio,liberacion_min:d.calCfg.liberacion_min,comida_inicio:d.calCfg.comida_inicio,comida_min:d.calCfg.comida_min,turno_fin:d.calCfg.turno_fin};

 // ventanas productivas del día (resta liberación al inicio y comida en medio)
 function windows(){
  var ti=hm2min(cfg.turno_inicio),tf=hm2min(cfg.turno_fin);
  var libEnd=ti+(cfg.liberacion_min||0);
  var cs=hm2min(cfg.comida_inicio),ce=cs+(cfg.comida_min||0);
  if(libEnd>=tf)return [];
  var wins=[];
  if((cfg.comida_min||0)>0 && cs>libEnd && cs<tf){
   wins.push([libEnd,Math.min(cs,tf)]);
   if(ce<tf)wins.push([Math.max(ce,libEnd),tf]);
  } else { wins.push([libEnd,tf]); }
  return wins.filter(function(w){return w[1]>w[0];});
 }
 function prodMinDay(){return windows().reduce(function(a,w){return a+(w[1]-w[0]);},0);}

 var state={start:d.hoy,dayIdx:0};

 function isLate(b){
  var v=vBy[b.o.orden];
  if(v&&v<b.date)return true;            // la franja cae después de la fecha de entrega
  if(fBy[b.o.orden]===false)return true; // el plan del día ya marcó que no alcanza
  return false;
 }

 // expande el programa vigente a bloques absolutos (fecha + min del día)
 function expand(){
  var prog=d.progOficial;
  if(!prog)return {blocks:[],days:[],noStd:[]};
  var wins=windows();
  if(!wins.length)return {blocks:[],days:[],noStd:[]};
  var ti=hm2min(cfg.turno_inicio),tf=hm2min(cfg.turno_fin);
  var blocks=[],noStd=[];
  ['SMT','PTH'].forEach(function(area){
   var lines=Math.max(1,(area==='SMT'?prog.lineasSmt:prog.lineasPth)||1);
   var arr=prog.ots.filter(function(o){return o.area===area;}).slice().sort(function(a,b){return (a.pos||0)-(b.pos||0);});
   var cur=new Date(state.start+'T00:00:00');
   while(isWeekend(cur))cur.setDate(cur.getDate()+1);
   var wi=0,ptr=wins[0][0],guard=0;
   arr.forEach(function(o){
    var rate=(o.stdCuello||0)*lines;           // pzs/hr efectivas del área
    if(!(rate>0)){noStd.push(o);return;}
    var remain=(o.pendiente||0)/rate*60;        // minutos productivos necesarios
    if(remain<=0)return;
    while(remain>0.5 && guard<5000){
     guard++;
     var avail=wins[wi][1]-ptr;
     if(avail<=0.5){                            // saltar a la siguiente ventana / día
      wi++;
      if(wi>=wins.length){wi=0;do{cur.setDate(cur.getDate()+1);}while(isWeekend(cur));}
      ptr=wins[wi][0];
      continue;
     }
     var use=Math.min(avail,remain);
     blocks.push({area:area,o:o,date:iso(cur),s:ptr,e:ptr+use,pzs:use/60*rate,full:(use>=remain-0.5)});
     ptr+=use; remain-=use;
    }
   });
  });
  var dset={};blocks.forEach(function(b){dset[b.date]=1;});
  return {blocks:blocks,days:Object.keys(dset).sort(),noStd:noStd,ti:ti,tf:tf,wins:wins};
 }

 function wireCfg(){
  var sv=$('cf_save');if(!sv)return;
  sv.onclick=function(){
   var msg=$('cf_msg');if(msg){msg.textContent='guardando…';msg.style.color='';}
   var p={action:'set_cal_config',turno_inicio:$('cf_ti').value,liberacion_min:$('cf_lib').value,comida_inicio:$('cf_ci').value,comida_min:$('cf_com').value,turno_fin:$('cf_tf').value};
   api(p).then(function(r){
    if(r&&r.ok){
     cfg.turno_inicio=p.turno_inicio;cfg.liberacion_min=parseInt(p.liberacion_min,10)||0;cfg.comida_inicio=p.comida_inicio;cfg.comida_min=parseInt(p.comida_min,10)||0;cfg.turno_fin=p.turno_fin;
     d.calCfg=cfg;render();
     var m2=$('cf_msg');if(m2){m2.textContent='guardado ✓';m2.style.color='var(--ok)';}
    } else { if(msg){msg.textContent=(r&&r.error)||'error';msg.style.color='var(--bad)';} }
   }).catch(function(){var m2=$('cf_msg');if(m2){m2.textContent='error de red';m2.style.color='var(--bad)';}});
  };
 }

 function render(){
  var prog=d.progOficial;
  var cform='<div class="card"><h2>Modelo de horario del turno</h2>'+
    '<div class="muted" style="margin-bottom:10px">Horas productivas = (fin − inicio) − liberación − comida. Cambia y dale guardar; el calendario se recalcula.</div>'+
    '<div class="cfgform">'+
    '<label>Inicio turno<input id="cf_ti" type="time" value="'+esc(cfg.turno_inicio)+'"></label>'+
    '<label>Liberación (min)<input id="cf_lib" type="number" min="0" max="240" value="'+cfg.liberacion_min+'"></label>'+
    '<label>Comida inicia<input id="cf_ci" type="time" value="'+esc(cfg.comida_inicio)+'"></label>'+
    '<label>Comida (min)<input id="cf_com" type="number" min="0" max="180" value="'+cfg.comida_min+'"></label>'+
    '<label>Fin turno<input id="cf_tf" type="time" value="'+esc(cfg.turno_fin)+'"></label>'+
    '<button id="cf_save">Guardar horario</button><span id="cf_msg" class="muted"></span>'+
    '</div><div class="muted" style="margin-top:8px">Hoy: <b>'+(prodMinDay()/60).toFixed(1)+' h productivas/día</b> ('+windows().map(function(w){return min2hm(w[0])+'–'+min2hm(w[1]);}).join(' + ')+').</div></div>';

  if(!prog){
   $('cal').innerHTML=cform+'<div class="card"><div class="empty">Aún no hay <b>programa oficial vigente</b>. Ve al tab <b>Programa</b>, acomoda el orden y dale <b>Lanzar como programa oficial</b>. El calendario se arma sobre ese programa.</div></div>';
   wireCfg();return;
  }
  var ex=expand();
  if(!ex.days.length){
   $('cal').innerHTML=cform+'<div class="card"><div class="empty">No hay OT programables con estándar en el programa vigente'+(ex.noStd&&ex.noStd.length?' ('+ex.noStd.length+' sin estándar)':'')+'.</div></div>';
   wireCfg();return;
  }
  if(state.dayIdx>=ex.days.length)state.dayIdx=ex.days.length-1;
  if(state.dayIdx<0)state.dayIdx=0;
  var day=ex.days[state.dayIdx];
  var span=ex.tf-ex.ti;
  function pc(min){return (min-ex.ti)/span*100;}

  var nav='<div class="calnav">'+
    '<button id="cal_prev"'+(state.dayIdx<=0?' disabled':'')+'>‹</button>'+
    '<div><div class="cd">'+esc(fmtLong(day))+'</div><div class="cc">día '+(state.dayIdx+1)+' de '+ex.days.length+' · arranque del plan: '+esc(fmtLong(state.start))+'</div></div>'+
    '<button id="cal_next"'+(state.dayIdx>=ex.days.length-1?' disabled':'')+'>›</button>'+
    '<span class="cc" style="margin-left:auto">Arranque <input id="cal_start" type="date" value="'+esc(state.start)+'" style="border:1px solid var(--bd);border-radius:8px;padding:5px 8px;font-size:13px"></span></div>';

  function lane(area,label,sub){
   var bs=ex.blocks.filter(function(b){return b.area===area&&b.date===day;});
   var np='';
   var libEnd=ex.ti+(cfg.liberacion_min||0);
   if(libEnd>ex.ti)np+='<div class="gnp" style="left:0;width:'+pc(libEnd)+'%"><span class="gnl">liberación</span></div>';
   if((cfg.comida_min||0)>0){var cs=hm2min(cfg.comida_inicio),ce=cs+cfg.comida_min;if(cs<ex.tf&&ce>ex.ti)np+='<div class="gnp" style="left:'+pc(Math.max(cs,ex.ti))+'%;width:'+(pc(Math.min(ce,ex.tf))-pc(Math.max(cs,ex.ti)))+'%"><span class="gnl">comida</span></div>';}
   var blk=bs.map(function(b){
    var late=isLate(b),w=pc(b.e)-pc(b.s);
    return '<div class="gblk'+(b.full?'':' cont')+(late?' late':'')+'" style="left:'+pc(b.s)+'%;width:'+w+'%" title="'+esc(b.o.orden)+' '+min2hm(b.s)+'–'+min2hm(b.e)+'">'+
      '<div class="b1">'+esc(b.o.orden)+(late?' ⚠':'')+'</div><div class="b2">'+esc(b.o.np||'')+' · '+Math.round(b.pzs)+' pz</div></div>';
   }).join('');
   return '<div class="glane"><div class="ghd">'+label+'<span class="gs">'+sub+'</span></div><div class="gtrack">'+np+blk+'</div></div>';
  }
  var axis='';
  for(var h=Math.ceil(ex.ti/60);h*60<=ex.tf;h++){axis+='<span style="left:'+pc(h*60)+'%">'+min2hm(h*60)+'</span>';}
  var gantt='<div class="card"><h2>Qué corre a cada hora — '+esc(fmtLong(day))+'</h2>'+
    '<div class="gantt">'+lane('SMT','SMT','SMT '+Math.max(1,prog.lineasSmt||1)+' lín.')+lane('PTH','Final','PTH '+Math.max(1,prog.lineasPth||1)+' lín.')+'</div>'+
    '<div class="gaxis">'+axis+'</div>'+
    '<div class="muted" style="margin-top:10px;font-size:11.5px">Cada carril corre su cola del programa oficial desde el arranque, a ritmo del cuello × nº de líneas. Las franjas rayadas son liberación y comida (no producen). ⚠ = la OT cae tras su fecha de entrega o no alcanza.</div></div>';

  function agenda(area,label){
   var bs=ex.blocks.filter(function(b){return b.area===area&&b.date===day;});
   if(!bs.length)return '<div class="ah">'+label+'</div><div class="muted" style="padding:4px 0">— sin trabajo este día —</div>';
   return '<div class="ah">'+label+'</div>'+bs.map(function(b){
    var late=isLate(b);
    var mark=late?' <span class="wbadge bad">'+(vBy[b.o.orden]&&vBy[b.o.orden]<b.date?'vence antes':'no alcanza')+'</span>':'';
    var cont=b.full?'':' <span class="muted">(continúa)</span>';
    return '<div class="agrow"><span class="at">'+min2hm(b.s)+'–'+min2hm(b.e)+'</span>'+
      '<span class="ao"><b>'+esc(b.o.orden)+'</b> '+esc(b.o.np||'')+' <span class="muted">'+esc(b.o.desc||'')+'</span>'+mark+cont+'</span>'+
      '<span class="aq">'+Math.round(b.pzs)+' pz</span></div>';
   }).join('');
  }
  var ag='<div class="card"><h2>Agenda del día (para imprimir / mandar)</h2><div class="agenda">'+agenda('SMT','SMT — subensamble')+agenda('PTH','Final (PTH → Empaque)')+'</div></div>';
  var noStdMsg=(ex.noStd&&ex.noStd.length)?'<div class="warn warn2"><b>⚠ '+ex.noStd.length+' OT sin estándar</b> no se pueden ubicar en el calendario: '+ex.noStd.map(function(o){return esc(o.orden);}).join(', ')+'. Captúralas en el tab Estándar.</div>':'';

  $('cal').innerHTML=cform+nav+gantt+ag+noStdMsg;
  wireCfg();
  var pv=$('cal_prev'),nx=$('cal_next'),st=$('cal_start');
  if(pv)pv.onclick=function(){state.dayIdx--;render();};
  if(nx)nx.onclick=function(){state.dayIdx++;render();};
  if(st)st.onchange=function(){if(/^\d{4}-\d{2}-\d{2}$/.test(st.value)){state.start=st.value;state.dayIdx=0;render();}};
 }
 render();
})();

// --- VALIDACION ---
var vr=d.val.map(function(v){
 var cls=v.dif==null?'p-mut':Math.abs(v.dif)<2?'p-ok':Math.abs(v.dif)<15?'p-warn':'p-bad';
 var lab=v.dif==null?'—':(Math.abs(v.dif)<2?'coincide':(v.dif>0?'+'+v.dif:''+v.dif));
 return '<tr><td>'+esc(v.linea)+'</td><td>'+esc(v.modelo||v.np)+'</td><td>'+esc(v.proceso)+'</td>'+
   '<td class="num">'+(v.daniel==null?'—':v.daniel)+'</td><td class="num">'+(v.std==null?'—':v.std)+'</td>'+
   '<td><span class="pill '+cls+'">'+lab+'</span></td></tr>';
}).join('');
$('val').innerHTML='<div class="card"><h2>Lo que Daniel teclea hoy vs lo que dice el estándar</h2>'+
 '<table><thead><tr><th>Tablero</th><th>Modelo/Parte</th><th>Estación</th><th class="num">Daniel</th><th class="num">Estándar</th><th>Dif</th></tr></thead><tbody>'+
 (vr||'<tr><td colspan=6 class="empty">Sin tableros vigentes ligables.</td></tr>')+'</tbody></table>'+
 '<div class="muted" style="margin-top:8px">“coincide” = Daniel ya tecleó el estándar real. Diferencias grandes suelen ser metas puestas a ojo (p.ej. 100 placeholder).</div></div>';

// --- INCONSISTENCIAS ---
var ir=d.inc.map(function(x){
 var fl=[];if(x.sinEst)fl.push('<span class="pill p-bad">sin estándar</span>');if(x.fechaInv)fl.push('<span class="pill p-bad">fecha imposible</span>');if(x.vencida)fl.push('<span class="pill p-warn">vencida</span>');
 return '<tr><td>'+esc(x.orden)+'</td><td>'+esc(x.np)+'</td><td class="num">'+x.pendiente+'</td><td>'+esc(x.vence)+'</td><td>'+(fl.join(' ')||'<span class="muted">ok</span>')+'</td></tr>';
}).join('');
$('inc').innerHTML='<div class="card"><h2>Inconsistencias a revisar con Daniel</h2>'+
 '<table><thead><tr><th>OT</th><th>Parte</th><th class="num">Pendiente</th><th>Vence</th><th>Flags</th></tr></thead><tbody>'+
 (ir||'<tr><td colspan=5 class="empty">Sin inconsistencias.</td></tr>')+'</tbody></table></div>';

// tabs
var btns=document.querySelectorAll('.tabs button');
btns.forEach(function(b){b.onclick=function(){
 btns.forEach(function(x){x.classList.remove('on');});b.classList.add('on');
 ['plan','prog','cal','vib','est','meta','val','inc'].forEach(function(t){$(t).classList.toggle('hide',t!==b.dataset.t);});
};});
})();
</script></body></html>`;

return [{ json: { body: PAGE, contentType: 'text/html; charset=utf-8' } }];
