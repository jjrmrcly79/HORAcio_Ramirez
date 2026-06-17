// ============================================================
// Horacio — Dashboard (nodo Code único)
// Workflow n8n: "Horacio - Dashboard" · Webhook GET /horacio-dash
//   /webhook/horacio-dash?token=XYZ        -> página HTML (Chart.js)
//   /webhook/horacio-dash?token=XYZ&data=1 -> JSON de agregados
// Solo lectura. Sin nombres de operadoras (privacidad SN-04): líneas/líderes.
// Reemplaza <SERVICE_ROLE_KEY> y <DASH_TOKEN> en n8n (nunca en el repo).
// Respond node: respondWith=text, body={{$json.body}}, header content-type={{$json.contentType}}.
// ============================================================
const PG = 'https://supabase.nexiasoluciones.com.mx/pg/query';
const SK = '<SERVICE_ROLE_KEY>';
const TOKEN = '<DASH_TOKEN>';
const pgh = { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' };
const H = this.helpers;
const pg = async (q) => await H.httpRequest({ method: 'POST', url: PG, headers: pgh, body: { query: q }, json: true });
const nowMX = () => DateTime.now().setZone('America/Mexico_City');

const q = ($input.first().json && $input.first().json.query) || {};
if (q.token !== TOKEN) return [{ json: { body: 'No autorizado', contentType: 'text/plain; charset=utf-8' } }];

// ===================== PÁGINA HTML =====================
if (q.data !== '1') {
  const PAGE = [
'<!doctype html><html lang="es"><head><meta charset="utf-8">',
'<meta name="viewport" content="width=device-width,initial-scale=1">',
'<meta name="theme-color" content="#f6f6f8">',
'<title>Horacio — Mapartel</title>',
'<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>',
'<style>',
':root{--bg:#f6f6f8;--card:#fff;--bd:#ececf0;--tx:#18181b;--mut:#71717a;--accent:#7c3aed;--ok:#16a34a;--warn:#d97706;--bad:#dc2626;--shadow:0 1px 2px rgba(24,24,27,.04),0 4px 16px rgba(24,24,27,.05)}',
'*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}',
'header{position:sticky;top:0;z-index:5;background:rgba(246,246,248,.82);backdrop-filter:saturate(180%) blur(10px);-webkit-backdrop-filter:saturate(180%) blur(10px);border-bottom:1px solid var(--bd);padding:13px 20px;display:flex;align-items:center;gap:10px}',
'header .brand{display:flex;align-items:center;gap:9px}header h1{font-size:17px;margin:0;font-weight:650;letter-spacing:-.01em}header .dot{color:var(--mut);font-weight:400}',
'header .sub{color:var(--mut);font-size:13px;margin-left:auto;font-variant-numeric:tabular-nums}',
'.wrap{padding:18px 16px 36px;max-width:1180px;margin:0 auto}',
'.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:12px;margin-bottom:18px}',
'.kpi{background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:15px 16px;box-shadow:var(--shadow)}',
'.kpi .v{font-size:27px;font-weight:680;letter-spacing:-.02em;font-variant-numeric:tabular-nums}.kpi .l{color:var(--mut);font-size:12px;margin-top:3px}',
'.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:820px){.grid2{grid-template-columns:1fr}}',
'.card{background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:16px;margin-bottom:16px;box-shadow:var(--shadow)}',
'.card h2{font-size:12px;margin:0 0 12px;color:var(--mut);text-transform:uppercase;letter-spacing:.06em;font-weight:600}',
'.tab{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--bd);font-size:14px}',
'.tab:first-child{padding-top:2px}.tab:last-child{border:0;padding-bottom:2px}.muted{color:var(--mut);font-size:12px}.num{font-variant-numeric:tabular-nums;font-weight:600}',
'.bar{height:6px;background:#ececed;border-radius:99px;overflow:hidden;margin-top:6px}.bar>i{display:block;height:100%;border-radius:99px}',
'table{width:100%;border-collapse:collapse;font-size:13px}td,th{text-align:left;padding:8px;border-bottom:1px solid var(--bd)}th{color:var(--mut);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.04em}tr:last-child td{border-bottom:0}',
'.pill{padding:2px 9px;border-radius:99px;font-size:11px;font-weight:600;color:#fff}',
'.t-Paro{background:#dc2626}.t-Faltante{background:#d97706}.t-Calidad{background:#7c3aed}',
'.empty{color:var(--mut);font-size:13px;padding:10px 0}',
'.foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:8px;color:var(--mut);font-size:12px;flex-wrap:wrap}',
'.foot .pw{display:flex;align-items:center;gap:6px;color:#52525b}.foot .pw b{color:var(--accent);font-weight:700}',
'</style></head><body>',
'<header><span class="brand"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="5.5" width="13" height="13" rx="3" transform="rotate(45 12 12)" fill="#7c3aed"/></svg><h1>Horacio <span class="dot">· Mapartel</span></h1></span><span class="sub" id="sub">cargando…</span></header>',
'<div class="wrap">',
'<div class="kpis" id="kpis"></div>',
'<div class="grid2"><div class="card"><h2>Cumplimiento por tablero (hoy)</h2><div id="tableros"></div></div>',
'<div class="card"><h2>¿Quién está subiendo su info? (hoy)</h2><div id="hb"></div></div></div>',
'<div class="card"><h2>Escalamientos abiertos ahora</h2><div id="esc"></div></div>',
'<div class="grid2"><div class="card"><h2>Real vs Plan por hora (hoy)</h2><canvas id="cHora" height="160"></canvas></div>',
'<div class="card"><h2>Pareto de causas por área (7 días)</h2><canvas id="cPar" height="160"></canvas><div id="topArea" style="margin-top:10px"></div></div></div>',
'<div class="foot"><span>Actualiza cada 30s · sin nombres de operadoras</span><span class="pw">powered by <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="5.5" width="13" height="13" rx="3" transform="rotate(45 12 12)" fill="#7c3aed"/></svg><b>NexIA</b></span></div>',
'</div>',
'<script>',
'var TK=new URLSearchParams(location.search).get("token");',
'var chHora=null,chPar=null;',
'function semColor(s){return s=="\\uD83D\\uDFE2"?"var(--ok)":s=="\\uD83D\\uDFE1"?"var(--warn)":s=="\\uD83D\\uDD34"?"var(--bad)":"#64748b"}',
'function hhmm(t){if(!t)return"—";var d=new Date(t);if(isNaN(d))return"—";return ("0"+d.getHours()).slice(-2)+":"+("0"+d.getMinutes()).slice(-2)}',
'function el(h){var d=document.createElement("div");d.innerHTML=h;return d.firstChild}',
'async function load(){',
'  try{',
'    var r=await fetch(location.pathname+"?token="+encodeURIComponent(TK||"")+"&data=1",{cache:"no-store"});',
'    var txt=await r.text();',
'    if(!r.ok){document.getElementById("sub").textContent="error HTTP "+r.status;return}',
'    var d;try{d=JSON.parse(txt)}catch(pe){document.getElementById("sub").textContent="respuesta no válida (¿token?): "+String(txt).slice(0,60);return}',
'    document.getElementById("sub").textContent=d.fecha+" · "+d.hora+" (MX)";',
'    var k=d.kpis;',
'    var cumC=k.cumplimiento==null?"":(k.cumplimiento>=95?"var(--ok)":k.cumplimiento>=80?"var(--warn)":"var(--bad)");',
'    document.getElementById("kpis").innerHTML=',
'      kpi((k.cumplimiento==null?"—":k.cumplimiento+"%"),"Cumplimiento hoy",cumC)+',
'      kpi(k.reportando+"/"+k.tableros,"Tableros reportando","")+',
'      kpi(k.parosAbiertos,"Paros abiertos",k.parosAbiertos>0?"var(--bad)":"")+',
'      kpi(k.minParo+" min","Paro acumulado hoy","")+',
'      kpi(k.faltAbiertos,"Faltantes abiertos",k.faltAbiertos>0?"var(--bad)":"")+',
'      kpi(k.calAbiertos,"Calidad abierta",k.calAbiertos>0?"var(--bad)":"")+',
'      kpi((k.acuseMin==null?"—":k.acuseMin+" min"),"Acuse prom. (7d)","");',
'    var ht="";d.tableros.forEach(function(t){var p=t.pct==null?(t.real+" "+(t.unidad||"pzs")):(t.real+"/"+t.plan+" "+t.pct+"%");',
'      ht+="<div class=\\"tab\\"><div>"+t.sem+" <b>"+t.nombre+"</b><div class=\\"muted\\">"+(t.ot?("OT "+t.ot+(t.meta!=null?" · meta "+t.meta+"/h":"")+" · "):"")+t.grupo+" · hora reportada "+(t.ultima||"—")+(t.sd?" · "+t.sd+" sin dato":"")+"</div></div><div class=\\"num\\" style=\\"text-align:right\\">"+p+"</div></div>"});',
'    document.getElementById("tableros").innerHTML=ht||"<div class=\\"empty\\">Sin datos hoy</div>";',
'    var hh="";d.lideres.forEach(function(l){var pc=l.pct==null?0:l.pct;var c=pc>=80?"var(--ok)":pc>=50?"var(--warn)":"var(--bad)";',
'      hh+="<div class=\\"tab\\"><div><b>"+l.nombre+"</b><div class=\\"bar\\"><i style=\\"width:"+Math.min(pc,100)+"%;background:"+c+"\\"></i></div></div><div class=\\"num\\" style=\\"text-align:right\\">"+l.reportados+"/"+l.esperados+"<div class=\\"muted\\" style=\\"font-weight:400\\">captura "+(l.ultima||"—")+"</div></div></div>"});',
'    document.getElementById("hb").innerHTML=hh||"<div class=\\"empty\\">Sin líderes</div>";',
'    if(d.escalamientos.length){var et="<table><tr><th>Tipo</th><th>Tablero</th><th>Detalle</th><th>A</th><th>Hace</th><th>Acuse</th></tr>";',
'      d.escalamientos.forEach(function(e){et+="<tr><td><span class=\\"pill t-"+e.tipo+"\\">"+e.tipo+"</span></td><td>"+e.tablero+"</td><td>"+(e.detalle||"")+"</td><td>"+(e.quien||"—")+"</td><td>"+e.haceMin+" min</td><td>"+(e.acuse?"✅":"⏳")+"</td></tr>"});',
'      et+="</table>";document.getElementById("esc").innerHTML=et;}else{document.getElementById("esc").innerHTML="<div class=\\"empty\\">Nada escalado abierto 🎉</div>"}',
'    try{drawHora(d.porHora);drawPar(d.pareto);}catch(ce){document.getElementById("sub").textContent+=" · (graficas no cargaron)"}',
'    var ta="<table><tr><th>Área</th><th>Causa #1</th><th>Veces</th></tr>";d.topArea.forEach(function(t){ta+="<tr><td><b>"+t.area+"</b> <span class=\\"muted\\">"+t.lider+"</span></td><td>"+(t.causa||"— sin causas —")+"</td><td>"+(t.n||0)+"</td></tr>"});ta+="</table>";document.getElementById("topArea").innerHTML=ta;',
'  }catch(e){document.getElementById("sub").textContent="error: "+e.message}',
'}',
'function kpi(v,l,c){return "<div class=\\"kpi\\"><div class=\\"v\\""+(c?" style=\\"color:"+c+"\\"":"")+">"+v+"</div><div class=\\"l\\">"+l+"</div></div>"}',
'function drawHora(rows){var lb=rows.map(function(r){return r.slot});var pl=rows.map(function(r){return r.plan});var re=rows.map(function(r){return r.real});',
'  if(chHora)chHora.destroy();chHora=new Chart(document.getElementById("cHora"),{type:"bar",data:{labels:lb,datasets:[{label:"Plan",data:pl,backgroundColor:"#d4d4d8",borderRadius:4},{label:"Real",data:re,backgroundColor:"#7c3aed",borderRadius:4}]},options:{plugins:{legend:{labels:{color:"#52525b",boxWidth:10,boxHeight:10,usePointStyle:true,pointStyle:"circle"}}},scales:{x:{grid:{display:false},border:{display:false},ticks:{color:"#71717a"}},y:{grid:{color:"#f0f0f2"},border:{display:false},ticks:{color:"#71717a"}}}}})}',
'function drawPar(p){var col={SMT:"#7c3aed",PTH:"#f59e0b",CONFORMAL:"#16a34a"};',
'  var lb=p.causas.map(function(c){return c.replace(/^[\\s\\W]+/,"")});',
'  var ds=p.areas.map(function(a){return {label:a.label,data:p.data[a.key],backgroundColor:col[a.key]||"#9ca3af",borderRadius:3}});',
'  if(chPar)chPar.destroy();chPar=new Chart(document.getElementById("cPar"),{type:"bar",data:{labels:lb,datasets:ds},options:{indexAxis:"y",plugins:{legend:{labels:{color:"#52525b",boxWidth:10,boxHeight:10,usePointStyle:true,pointStyle:"circle"}}},scales:{x:{stacked:true,beginAtZero:true,grid:{color:"#f0f0f2"},border:{display:false},ticks:{color:"#71717a",precision:0}},y:{stacked:true,grid:{display:false},border:{display:false},ticks:{color:"#3f3f46",autoSkip:false}}}}})}',
'load();setInterval(load,30000);',
'</script></body></html>'
  ].join('');
  return [{ json: { body: PAGE, contentType: 'text/html; charset=utf-8' } }];
}

// ===================== DATOS (JSON) =====================
const now = nowMX();
const fecha = now.toFormat('yyyy-LL-dd');
const horaNum = Number(now.toFormat('HH'));
const minNum = Number(now.toFormat('mm'));
const expectedSlots = Math.max(0, Math.min(9, (horaNum - 7) + (minNum >= 30 ? 1 : 0))); // ventanas de :30 ya cerradas (6:30→7:30 …)

const tab = await pg(`SELECT l.codigo, l.nombre, l.grupo, l.orden, l.unidad, COALESCE(SUM(h.plan) FILTER (WHERE NOT h.sin_dato),0)::bigint AS plan, COALESCE(SUM(h.real) FILTER (WHERE NOT h.sin_dato),0)::bigint AS real, COUNT(h.*) FILTER (WHERE h.sin_dato)::int AS sd, MAX(h.hora_slot) FILTER (WHERE NOT h.sin_dato) AS ultima, (SELECT o.orden FROM horacio.ordenes_tablero o WHERE o.linea_id=l.id AND o.fecha='${fecha}' AND o.vigente ORDER BY o.ts DESC LIMIT 1) AS ot, (SELECT o.meta_hr FROM horacio.ordenes_tablero o WHERE o.linea_id=l.id AND o.fecha='${fecha}' AND o.vigente ORDER BY o.ts DESC LIMIT 1) AS meta FROM horacio.lineas l LEFT JOIN horacio.hora_por_hora h ON h.linea_id=l.id AND h.fecha='${fecha}' WHERE l.activa GROUP BY l.id, l.codigo, l.nombre, l.grupo, l.orden ORDER BY l.grupo, l.orden`);
const tableros = tab.map((t) => {
  const plan = Number(t.plan) || 0, real = Number(t.real) || 0;
  const pct = plan > 0 ? Math.round(real / plan * 100) : null;
  const sem = pct == null ? '⚪' : (pct >= 95 ? '🟢' : (pct >= 80 ? '🟡' : '🔴'));
  return { codigo: t.codigo, nombre: t.nombre, grupo: t.grupo, unidad: t.unidad || 'pzs', plan, real, pct, sem, ultima: t.ultima || null, sd: Number(t.sd) || 0, ot: t.ot || null, meta: t.meta != null ? Number(t.meta) : null };
});
const conMeta = tableros.filter((t) => t.plan > 0);
const sumPlan = conMeta.reduce((a, t) => a + t.plan, 0), sumReal = conMeta.reduce((a, t) => a + t.real, 0);

const kp = await pg(`SELECT (SELECT COUNT(*) FROM horacio.paros WHERE estado='abierto')::int AS paros_ab, (SELECT COALESCE(SUM(duracion_min),0) FROM horacio.paros WHERE ts_inicio::date='${fecha}')::int AS min_paro, (SELECT COUNT(*) FROM horacio.faltantes WHERE estado<>'cerrado')::int AS falt_ab, (SELECT COUNT(*) FROM horacio.calidad WHERE estado<>'cerrado')::int AS cal_ab, (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (acuse_ts-ts_inicio))/60.0))::int FROM horacio.paros WHERE acuse_ts IS NOT NULL AND ts_inicio::date >= '${fecha}'::date-6) AS acuse_min`);
const K = kp[0] || {};

const hb = await pg(`SELECT p.nombre, COUNT(l.id)::int AS nboards, COUNT(h.*) FILTER (WHERE NOT h.sin_dato)::int AS reportes, MAX(h.ts) FILTER (WHERE NOT h.sin_dato) AS ultima FROM horacio.personas p JOIN horacio.lineas l ON l.lider_persona_id=p.id AND l.activa LEFT JOIN horacio.hora_por_hora h ON h.linea_id=l.id AND h.fecha='${fecha}' WHERE p.chat_id IS NOT NULL GROUP BY p.id, p.nombre ORDER BY p.nombre`);
const lideres = hb.map((r) => {
  const esp = (Number(r.nboards) || 0) * expectedSlots, rep = Number(r.reportes) || 0;
  const ult = r.ultima ? DateTime.fromSQL(r.ultima).setZone('America/Mexico_City').toFormat('HH:mm') : null; // hora MX de captura
  return { nombre: r.nombre, reportados: rep, esperados: esp, pct: esp > 0 ? Math.round(rep / esp * 100) : null, ultima: ult };
});

const esc = await pg(`SELECT tipo, tablero, detalle, quien, ts, acuse_ts FROM (
  SELECT 'Paro' tipo, l.nombre tablero, cp.boton_texto detalle, pe.nombre quien, p.ts_inicio ts, p.acuse_ts FROM horacio.paros p JOIN horacio.lineas l ON l.id=p.linea_id LEFT JOIN horacio.causas_paro cp ON cp.codigo=p.causa_codigo LEFT JOIN horacio.personas pe ON pe.id=p.escalado_a WHERE p.estado='abierto'
  UNION ALL
  SELECT 'Faltante', l.nombre, COALESCE(f.numero_parte,'(sin NP)'), pe.nombre, f.ts_reporte, f.acuse_ts FROM horacio.faltantes f JOIN horacio.lineas l ON l.id=f.linea_id LEFT JOIN horacio.personas pe ON pe.id=f.escalado_a WHERE f.estado<>'cerrado'
  UNION ALL
  SELECT 'Calidad', l.nombre, LEFT(c.descripcion,40), pe.nombre, c.ts, c.acuse_ts FROM horacio.calidad c JOIN horacio.lineas l ON l.id=c.linea_id LEFT JOIN horacio.personas pe ON pe.id=c.escalado_a WHERE c.estado<>'cerrado'
) x ORDER BY ts`);
const nowMs = now.toMillis();
const escal = esc.map((e) => ({ tipo: e.tipo, tablero: e.tablero, detalle: e.detalle, quien: e.quien, haceMin: Math.max(0, Math.round((nowMs - DateTime.fromISO(e.ts).toMillis()) / 60000)), acuse: !!e.acuse_ts }));

const ph = await pg(`SELECT hora_slot, COALESCE(SUM(plan) FILTER (WHERE NOT sin_dato),0)::bigint AS plan, COALESCE(SUM(real) FILTER (WHERE NOT sin_dato),0)::bigint AS real FROM horacio.hora_por_hora WHERE fecha='${fecha}' GROUP BY hora_slot ORDER BY hora_slot`);
const porHora = ph.map((r) => ({ slot: r.hora_slot, plan: Number(r.plan) || 0, real: Number(r.real) || 0 }));

// líder por área (grupo) para la leyenda
const lead = await pg("SELECT DISTINCT ON (l.grupo) l.grupo, p.nombre FROM horacio.lineas l JOIN horacio.personas p ON p.id=l.lider_persona_id WHERE l.activa ORDER BY l.grupo, l.orden");
const areaLeader = {}; lead.forEach((r) => { areaLeader[r.grupo] = r.nombre; });
const friendly = (n) => { const m = n && n.match(/\(([^)]+)\)/); return m ? m[1] : (n ? n.split(' ')[0] : '?'); };
const grpName = (g) => (g === 'CONFORMAL' ? 'Conformal' : g);
// causas (paros + merma HxH) desglosadas por área
const par = await pg(`SELECT cp.boton_texto AS causa, l.grupo AS grupo, COUNT(*)::int AS n FROM (SELECT causa_codigo, linea_id FROM horacio.paros WHERE ts_inicio::date >= '${fecha}'::date-6 AND causa_codigo IS NOT NULL UNION ALL SELECT causa_codigo, linea_id FROM horacio.hora_por_hora WHERE fecha >= '${fecha}'::date-6 AND causa_codigo IS NOT NULL) x JOIN horacio.causas_paro cp ON cp.codigo=x.causa_codigo JOIN horacio.lineas l ON l.id=x.linea_id GROUP BY cp.boton_texto, l.grupo`);
const totals = {}, byCA = {};
par.forEach((r) => { const n = Number(r.n) || 0; totals[r.causa] = (totals[r.causa] || 0) + n; (byCA[r.causa] = byCA[r.causa] || {})[r.grupo] = n; });
const AREAS = ['SMT', 'PTH', 'CONFORMAL'];
const causas = Object.keys(totals).sort((a, b) => totals[b] - totals[a]).slice(0, 8);
const pareto = {
  causas,
  areas: AREAS.map((k) => ({ key: k, label: grpName(k) + ' - ' + friendly(areaLeader[k]) })),
  data: AREAS.reduce((o, k) => { o[k] = causas.map((c) => (byCA[c] && byCA[c][k]) || 0); return o; }, {}),
};
// causa #1 por área (para la mini-tabla)
const topArea = AREAS.map((k) => {
  let causa = null, n = 0;
  Object.keys(byCA).forEach((c) => { const v = byCA[c][k] || 0; if (v > n) { n = v; causa = c; } });
  return { area: grpName(k), lider: friendly(areaLeader[k]), causa, n };
});

const payload = {
  fecha, hora: now.toFormat('HH:mm'),
  kpis: {
    cumplimiento: sumPlan > 0 ? Math.round(sumReal / sumPlan * 100) : null,
    reportando: tableros.filter((t) => t.ultima).length, tableros: tableros.length,
    parosAbiertos: Number(K.paros_ab) || 0, minParo: Number(K.min_paro) || 0,
    faltAbiertos: Number(K.falt_ab) || 0, calAbiertos: Number(K.cal_ab) || 0,
    acuseMin: (K.acuse_min == null ? null : Number(K.acuse_min)),
  },
  tableros, lideres, escalamientos: escal, porHora, pareto, topArea,
};
return [{ json: { body: JSON.stringify(payload), contentType: 'application/json; charset=utf-8' } }];
