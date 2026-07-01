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
'.kpi{position:relative;background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:15px 16px;box-shadow:var(--shadow);cursor:pointer;transition:border-color .15s}',
'.kpi:hover{border-color:#d8d2ea}.kpi .q{position:absolute;top:10px;right:12px;width:16px;height:16px;border-radius:50%;border:1px solid var(--bd);color:var(--mut);font-size:11px;line-height:14px;text-align:center;font-weight:700}',
'.kpi .v{font-size:27px;font-weight:680;letter-spacing:-.02em;font-variant-numeric:tabular-nums}.kpi .l{color:var(--mut);font-size:12px;margin-top:3px}',
'.kpi .ki{display:none;margin-top:9px;padding-top:9px;border-top:1px solid var(--bd);color:var(--mut);font-size:11.5px;line-height:1.45}.kpi.open .ki{display:block}.kpi.open .q{background:var(--accent);color:#fff;border-color:var(--accent)}',
'.revbox{background:#fef3c7;border:1px solid #fde68a;color:#92400e;border-radius:12px;padding:11px 14px;font-size:12.5px;line-height:1.5;margin-bottom:16px}.revbox b{font-weight:700}',
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
'.flow{display:flex;align-items:stretch;gap:8px;flex-wrap:wrap;margin-bottom:6px}',
'.stage{flex:1 1 130px;min-width:128px;background:#fafafa;border:1px solid var(--bd);border-radius:14px;padding:12px 14px}',
'.stage.cuello{border-color:var(--bad);background:#fef2f2;box-shadow:0 0 0 1px var(--bad) inset}',
'.stage .sname{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--mut);font-weight:600}',
'.stage .spct{font-size:25px;font-weight:680;letter-spacing:-.02em;font-variant-numeric:tabular-nums;margin-top:2px}.stage .spct small{font-size:13px;font-weight:500;color:var(--mut)}',
'.stage .smeta{font-size:11.5px;color:var(--mut);margin-top:3px}',
'.stage .slost{font-size:12.5px;font-weight:600;margin-top:5px}',
'.stage .flag{display:inline-block;margin-top:7px;font-size:11px;font-weight:700;color:var(--bad)}',
'.stage.clk{cursor:pointer;transition:border-color .15s}.stage.clk:hover{border-color:#d8d2ea}',
'.stage .exp{margin-top:8px;font-size:10.5px;color:var(--accent);font-weight:600}',
'.arrow{display:flex;align-items:center;color:#c4c4c8;font-size:18px;flex:0 0 auto}',
'@media(max-width:680px){.arrow{display:none}.stage{flex:1 1 44%}}',
'.cuellobox{margin-top:12px;padding-top:12px;border-top:1px solid var(--bd)}',
'.rama{margin-top:12px}.rama .rn{font-size:11px;font-weight:600;color:var(--tx);margin-bottom:6px}',
'.subflow{display:flex;align-items:stretch;gap:6px;flex-wrap:wrap}',
'.sub{min-width:94px;background:#fafafa;border:1px solid var(--bd);border-radius:11px;padding:8px 11px}',
'.sub.stop{border-color:var(--bad);background:#fef2f2}.sub.drop{border-color:var(--warn);background:#fffbeb}',
'.sub .sl{font-size:10.5px;color:var(--mut);font-weight:600}',
'.sub .sv{font-size:18px;font-weight:680;font-variant-numeric:tabular-nums;letter-spacing:-.01em}',
'.sub .sx{font-size:10px;color:var(--mut);margin-top:1px}.sub.stop .sx{color:var(--bad);font-weight:600}.sub.drop .sx{color:var(--warn);font-weight:600}',
'.suba{display:flex;align-items:center;color:#c4c4c8;font-size:14px}',
'.ramasconv{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px}',
'.ramasleft{flex:1 1 480px;min-width:260px;display:flex;flex-direction:column;gap:10px}',
'.ramasleft .rama{margin-top:0}',
'.brace{align-self:stretch;width:12px;border:2px solid #e0ddec;border-left:0;border-radius:0 12px 12px 0;margin:6px 0}',
'.ramasmerge{display:flex;flex-direction:column;align-items:center;color:var(--mut);font-size:9.5px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}.ramasmerge .mk{font-size:22px;color:#bcb4d8;line-height:1;margin-bottom:2px}',
'.ramasright{flex:0 1 auto}.ramasright .rama{margin-top:0}',
'@media(max-width:680px){.brace{display:none}.ramasmerge{flex-direction:row;gap:5px}.ramasleft{flex:1 1 100%}.ramasright{flex:1 1 100%}}',
'.embk{display:flex;gap:22px;flex-wrap:wrap;margin-bottom:14px}.embk .v{font-size:23px;font-weight:680;letter-spacing:-.02em;font-variant-numeric:tabular-nums}.embk .v small{font-size:13px;color:var(--mut);font-weight:500;margin-left:3px}.embk .l{color:var(--mut);font-size:12px;margin-top:2px}',
'.foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:8px;color:var(--mut);font-size:12px;flex-wrap:wrap}',
'.foot .pw{display:flex;align-items:center;gap:6px;color:#52525b}.foot .pw b{color:var(--accent);font-weight:700}',
'.paro{border:1px solid var(--bd);border-radius:12px;padding:11px 13px;margin-bottom:9px;background:#fafafa}',
'.paro .phead{font-size:14px}.paro .muted{font-weight:400}',
'.praiz{margin-top:6px;font-size:13px;background:#f3effa;border-left:3px solid var(--accent);padding:7px 10px;border-radius:8px;line-height:1.45}',
'.ppend{margin-top:6px;font-size:12.5px;color:var(--warn);font-weight:600}',
'.pcorr{margin-top:5px;font-size:12.5px;color:var(--mut)}',
'.pqtog{margin-top:7px;font-size:12px;color:var(--accent);font-weight:600;cursor:pointer;user-select:none}',
'.pqbox{margin-top:6px;padding-left:4px;border-left:2px solid var(--bd)}',
'.pqi{font-size:12.5px;margin:4px 0 6px 8px;line-height:1.4}.pqr{color:var(--mut)}',
'.recttl{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--mut);font-weight:700;margin:14px 0 6px}',
'.recrow{display:flex;justify-content:space-between;gap:8px;font-size:13px;padding:6px 0;border-top:1px solid var(--bd)}',
'.recrow .recn{color:var(--bad);font-weight:600;white-space:nowrap;font-variant-numeric:tabular-nums}',
'</style></head><body>',
'<header><span class="brand"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="5.5" width="13" height="13" rx="3" transform="rotate(45 12 12)" fill="#7c3aed"/></svg><h1>Horacio <span class="dot">· Mapartel</span></h1></span><span class="sub" id="sub">cargando…</span></header>',
'<div class="wrap">',
'<div class="kpis" id="kpis"></div>',
'<div id="revisar"></div>',
'<div class="card"><h2>Flujo de hoy — ¿dónde se atora?</h2><div id="flujo"><div class="empty">cargando…</div></div><div id="cuello"></div><div id="stageDetail"></div></div>',
'<div class="card" id="wipCard"><h2>Material entre SMT y final (WIP por subensamble)</h2><div id="wip"><div class="empty">cargando…</div></div></div>',
'<div class="card" id="parosCard" style="display:none"><h2>🛑 Paros de hoy · causa raíz</h2><div id="parosHoy"></div><div id="parosRec"></div></div>',
'<div class="grid2"><div class="card"><h2 style="display:flex;justify-content:space-between;align-items:center;gap:8px">Cumplimiento por tablero (hoy) <span id="tabTog" style="font-size:12px;font-weight:400;color:var(--accent);cursor:pointer;white-space:nowrap">ver todos ▾</span></h2><div id="tableros" style="display:none"></div></div>',
'<div class="card"><h2>¿Quién está subiendo su info? (hoy)</h2><div id="hb"></div></div></div>',
'<div class="card" id="embCard" style="display:none"><h2>📦 Embarques — tarjetas retiradas (hoy)</h2>',
'<div class="embk" id="embKpis"></div>',
'<div class="grid2"><div><div class="muted" style="margin-bottom:6px">Por número de parte</div><canvas id="cEmbNP" height="180"></canvas></div>',
'<div><div class="muted" style="margin-bottom:6px">Por hora</div><canvas id="cEmbHora" height="180"></canvas></div></div>',
'<div id="embEmpty"></div></div>',
'<div class="card"><h2>Escalamientos abiertos ahora</h2><div id="esc"></div></div>',
'<div class="grid2"><div class="card"><h2>Real vs Plan por hora (hoy)</h2><canvas id="cHora" height="160"></canvas></div>',
'<div class="card"><h2 style="display:flex;justify-content:space-between;align-items:center;gap:8px">Pareto de causas por área <span id="parTog" style="font-size:12px;font-weight:400;white-space:nowrap"></span></h2><canvas id="cPar" height="160"></canvas><div id="topArea" style="margin-top:10px"></div></div></div>',
'<div class="card"><h2>Cumplimiento por día (7 días) — tendencia para la junta</h2><canvas id="cSemana" height="120"></canvas><div class="muted" id="semProm" style="margin-top:8px"></div></div>',
'<div class="foot"><span>Actualiza cada 30s · sin nombres de operadoras</span><span class="pw">powered by <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="5.5" width="13" height="13" rx="3" transform="rotate(45 12 12)" fill="#7c3aed"/></svg><b>NexIA</b></span></div>',
'</div>',
'<script>',
'var TK=new URLSearchParams(location.search).get("token");',
'var chHora=null,chPar=null,chENP=null,chEH=null,chSem=null;',
'var flujoData=[],openStage=-1,openApplied=false;',
'var parMode="dia",parData=null;',
'function semColor(s){return s=="\\uD83D\\uDFE2"?"var(--ok)":s=="\\uD83D\\uDFE1"?"var(--warn)":s=="\\uD83D\\uDD34"?"var(--bad)":"#64748b"}',
'function hhmm(t){if(!t)return"—";var d=new Date(t);if(isNaN(d))return"—";return ("0"+d.getHours()).slice(-2)+":"+("0"+d.getMinutes()).slice(-2)}',
'function el(h){var d=document.createElement("div");d.innerHTML=h;return d.firstChild}',
'function fmt(n){n=Number(n)||0;return n.toLocaleString("es-MX")}',
'function h(s){return String(s==null?"":s).replace(/[&<>\\"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c];});}',
'function renderFlujo(d){var f=d.flujo||[];flujoData=f;var html="";',
'  if(!openApplied){openApplied=true;var wo=new URLSearchParams(location.search).get("open");if(wo){for(var j=0;j<f.length;j++){if((f[j].grupo||"").toLowerCase()===wo.toLowerCase()||(f[j].etapa||"").toLowerCase()===wo.toLowerCase()){openStage=j;break;}}}}',
'  f.forEach(function(s,i){if(i>0)html+="<span class=\\"arrow\\">\\u25B6</span>";',
'    var clk=!!(s.estaciones&&s.estaciones.length);var cls="stage"+(s.cuello?" cuello":"")+(clk?" clk":"");',
'    var col=s.pct==null?"":(s.pct>=95?"var(--ok)":s.pct>=80?"var(--warn)":"var(--bad)");',
'    var val=s.pct!=null?(s.pct+"%"):(s.tarjetas!=null?fmt(s.tarjetas)+" <small>tarj</small>":(s.realTotal>0?fmt(s.realTotal)+" <small>pz</small>":"\\u2014"));',
'    var sinMeta=s.pct==null&&s.tarjetas==null&&s.realTotal>0;',
'    var meta=s.pct!=null?(fmt(s.real)+"/"+fmt(s.plan)+" \\u00B7 "+s.lider):((sinMeta?"sin meta hoy \\u00B7 ":"")+(s.lider||"&nbsp;"));',
'    var lost=s.perdidas>0?"<div class=\\"slost\\" style=\\"color:var(--bad)\\">\\u2212"+fmt(s.perdidas)+" pz</div>":(s.pct!=null?"<div class=\\"slost\\" style=\\"color:var(--ok)\\">al plan \\u2713</div>":"");',
'    html+="<div class=\\""+cls+"\\""+(clk?" onclick=\\"toggleStage("+i+")\\"":"")+"><div class=\\"sname\\">"+s.etapa+"</div><div class=\\"spct\\""+(col?" style=\\"color:"+col+"\\"":"")+">"+val+"</div><div class=\\"smeta\\">"+meta+"</div>"+lost+(s.cuello?"<div class=\\"flag\\">\\u25B2 CUELLO</div>":"")+(clk?"<div class=\\"exp\\">\\u25BE estaciones</div>":"")+"</div>";',
'  });',
'  document.getElementById("flujo").innerHTML="<div class=\\"flow\\">"+html+"</div>";',
'  renderStageDetail();',
'  var c=d.cuelloDetalle;var box=document.getElementById("cuello");',
'  if(!c||!c.boards||!c.boards.length){box.innerHTML="<div class=\\"cuellobox\\"><div class=\\"muted\\">El flujo va al plan hoy \\u2014 sin cuello marcado \\uD83C\\uDF89</div></div>";return;}',
'  var rows=c.boards.map(function(b){return "<div class=\\"tab\\"><div>"+b.sem+" <b>"+b.nombre+"</b><div class=\\"muted\\">"+(b.causa||"\\u2014 sin causa reportada")+(b.desde?" \\u00B7 desde "+b.desde:"")+"</div></div><div class=\\"num\\" style=\\"text-align:right\\">"+(b.pct==null?"\\u2014":b.pct+"%")+"<div class=\\"muted\\" style=\\"font-weight:400;color:var(--bad)\\">\\u2212"+fmt(b.perdidas)+" pz</div></div></div>";}).join("");',
'  box.innerHTML="<div class=\\"cuellobox\\"><div class=\\"muted\\" style=\\"margin-bottom:6px\\"><b style=\\"color:var(--bad)\\">"+c.etapa+"</b> es el cuello hoy ("+fmt(c.perdidas)+" pz perdidas) \\u2014 los que m\\u00E1s arrastran:</div>"+rows+"</div>";',
'}',
'function renderEstaciones(s){if(!s.estaciones||!s.estaciones.length)return "<div class=\\"muted\\">Sin estaciones</div>";',
'  return s.estaciones.map(function(e){',
'    var u=e.unidad==="tarjetas"?"tarj":"pz";',
'    var right=e.pct!=null?(e.pct+"% \\u00B7 "+fmt(e.real)+"/"+fmt(e.plan)):(fmt(e.real)+" "+u);',
'    var lost=e.perdidas>0?"<div class=\\"muted\\" style=\\"font-weight:400;color:var(--bad)\\">\\u2212"+fmt(e.perdidas)+" pz</div>":"";',
'    var sub=(e.pct==null?"sin meta \\u00B7 ":"")+"hora "+(e.ultima||"\\u2014")+(e.sd?" \\u00B7 "+e.sd+" sin dato":"")+(e.causa?" \\u00B7 "+e.causa:"");',
'    return "<div class=\\"tab\\"><div>"+e.sem+" <b>"+e.nombre+"</b><div class=\\"muted\\">"+sub+"</div></div><div class=\\"num\\" style=\\"text-align:right\\">"+right+lost+"</div></div>";',
'  }).join("");}',
'function renderRama(b){var chips="";',
'  b.estaciones.forEach(function(e,i){if(i>0)chips+="<span class=\\"suba\\">\\u25B6</span>";',
'    var prev=i>0?b.estaciones[i-1]:null;var stop=(e.real===0);',
'    var drop=(!stop&&prev&&prev.real>0&&e.real>0&&e.real<prev.real*0.7);',
'    var cls="sub"+(stop?" stop":(drop?" drop":""));',
'    var x=stop?(e.sd?"\\u23F8 sin captura":"\\u23F8 detenida"):(drop?"\\u2193 baja vs anterior":(e.causa?e.causa:(e.ultima?("hora "+e.ultima):"\\u2014")));',
'    chips+="<div class=\\""+cls+"\\"><div class=\\"sl\\">"+e.nombre+"</div><div class=\\"sv\\">"+fmt(e.real)+"</div><div class=\\"sx\\">"+x+"</div></div>";',
'  });',
'  return "<div class=\\"rama\\"><div class=\\"rn\\">"+b.nombre+"</div><div class=\\"subflow\\">"+chips+"</div></div>";}',
'function renderRamas(s){if(!s.ramas||!s.ramas.length)return renderEstaciones(s);',
'  var ac=null,lineas=[];s.ramas.forEach(function(b){if(b.convergencia)ac=b;else lineas.push(b);});',
'  var left=lineas.map(renderRama).join("");',
'  if(!ac)return left;',
'  return "<div class=\\"ramasconv\\"><div class=\\"ramasleft\\">"+left+"</div><div class=\\"brace\\"></div><div class=\\"ramasmerge\\"><div class=\\"mk\\">\\u25B6</div><div>converge</div></div><div class=\\"ramasright\\">"+renderRama(ac)+"</div></div>";}',
'function renderStageDetail(){var box=document.getElementById("stageDetail");if(!box)return;',
'  if(openStage<0||!flujoData[openStage]){box.innerHTML="";return;}',
'  var s=flujoData[openStage];var note=(s.pct==null&&s.realTotal>0)?" (sin meta hoy \\u2014 volumen)":"";',
'  var lbl=(s.ramas&&s.ramas.length)?"vertientes (l\\u00EDneas paralelas) \\u2014 piezas por estaci\\u00F3n":"estaciones en orden de proceso";',
'  box.innerHTML="<div class=\\"cuellobox\\"><div class=\\"muted\\" style=\\"margin-bottom:6px\\"><b>"+s.etapa+"</b> \\u2014 "+lbl+note+":</div>"+renderRamas(s)+"</div>";}',
'function toggleStage(i){openStage=(openStage===i?-1:i);renderStageDetail();}',
'function pqToggle(i){var e=document.getElementById("pq_"+i);if(e)e.style.display=(e.style.display==="none"?"block":"none");}',
'function renderWip(d){var W=d.wip||[];var box=document.getElementById("wip");if(!box)return;',
'  var conF=W.filter(function(x){return x.act>0;});var sinF=W.filter(function(x){return x.act===0&&x.smt>0;});',
'  var t1=conF.length?("<table><tr><th>Subensamble</th><th class=\\"num\\">SMT hecho</th><th class=\\"num\\">Finales</th><th class=\\"num\\">WIP+buffer</th></tr>"+conF.map(function(x){var c=x.wip>0?"var(--warn)":"var(--ok)";return "<tr><td>"+h(x.sub)+" <span class=\\"muted\\">("+x.act+" final"+(x.act>1?"es":"")+")</span></td><td class=\\"num\\">"+x.smt+"</td><td class=\\"num\\">"+x.fin+"</td><td class=\\"num\\" style=\\"color:"+c+"\\">"+x.wip+"</td></tr>";}).join("")+"</table>"):"<div class=\\"empty\\">Sin subensambles con finales activos hoy.</div>";',
'  var t2=sinF.length?("<div class=\\"muted\\" style=\\"margin-top:12px\\">SMT hecho <b>sin finales en proceso</b> (no es atoron — sus finales aún no corren o falta parearlos):</div><table>"+sinF.map(function(x){return "<tr><td>"+h(x.sub)+"</td><td class=\\"num\\">"+x.smt+" pz SMT</td></tr>";}).join("")+"</table>"):"";',
'  box.innerHTML="<div class=\\"muted\\" style=\\"margin-bottom:8px\\">Agrupado por subensamble (pareo 1:N). <b>WIP+buffer</b> = SMT hecho \\u2212 finales hechos; incluye stock de seguridad y falta el factor de cantidad \\u2014 directional, sin el falso atoron por orden.</div>"+t1+t2;}',
'function renderParos(d){var P=d.parosHoy||[],R=d.parosRecurrentes||[];var card=document.getElementById("parosCard");if(!card)return;',
'  if(!P.length&&!R.length){card.style.display="none";return;}card.style.display="";',
'  var h1=P.length?"":"<div class=\\"empty\\">Sin paros hoy 🎉</div>";',
'  P.forEach(function(p,i){',
'    var ic=p.estado==="abierto"?"🔴":"✅";var dur=p.dur!=null?(p.dur+" min"):"—";',
'    var raiz=p.causaRaiz?("<div class=\\"praiz\\">🎯 <b>Causa raíz:</b> "+h(p.causaRaiz)+"</div>"):(p.estado!=="abierto"?"<div class=\\"ppend\\">⚠ pendiente de causa raíz</div>":"");',
'    var corr=p.correctiva?("<div class=\\"pcorr\\">🛠 Acción: "+h(p.correctiva)+"</div>"):"";',
'    var pq="";if(p.porques&&p.porques.length){var qa=p.porques.map(function(x,j){return "<div class=\\"pqi\\"><b>"+(j+1)+".</b> "+h(x.p)+"<br><span class=\\"pqr\\">→ "+h(x.r)+"</span></div>";}).join("");pq="<div class=\\"pqtog\\" onclick=\\"pqToggle("+i+")\\">▾ ver "+p.porques.length+" por qués</div><div class=\\"pqbox\\" id=\\"pq_"+i+"\\" style=\\"display:none\\">"+qa+"</div>";}',
'    h1+="<div class=\\"paro\\"><div class=\\"phead\\">"+ic+" <b>"+h(p.tablero)+"</b> <span class=\\"muted\\">· "+h(p.hora)+" · "+dur+" · "+h(p.causa)+"</span></div>"+raiz+corr+pq+"</div>";',
'  });',
'  document.getElementById("parosHoy").innerHTML=h1;',
'  var rh="";if(R.length){rh="<div class=\\"recttl\\">Causas raíz recurrentes (7 días)</div>";R.forEach(function(r){rh+="<div class=\\"recrow\\"><span>"+h(r.causa)+" <span class=\\"muted\\">· "+h(r.linea)+"</span></span><span class=\\"recn\\">"+r.veces+"× · "+r.min+" min</span></div>";});}',
'  document.getElementById("parosRec").innerHTML=rh;',
'}',
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
'      kpi((k.cumplimiento==null?"—":k.cumplimiento+"%"),"Cumplimiento hoy",cumC,"% de piezas reales vs meta, contando solo los tableros que hoy tienen meta (la OT que fija Daniel). 100% = se cumplió el plan. Cada proceso cuenta como MÁXIMO 100% (no puede superar su meta), así un tablero disparado no contamina el total; los que reportan por encima se marcan abajo para revisar. Los tableros sin meta (⚪) no entran aquí.")+',
'      kpi(k.reportando+"/"+k.tableros,"Tableros reportando","","Cuántos tableros ya subieron al menos una hora con dato hoy, del total de tableros activos.")+',
'      kpi(k.parosAbiertos,"Paros abiertos",k.parosAbiertos>0?"var(--bad)":"","Paros reportados que siguen SIN cerrarse (nadie ha tocado ‘✅ Ya quedó’) en este momento.")+',
'      kpi(k.minParo+" min","Paro acumulado hoy","","Suma de minutos detenidos hoy, de los paros ya cerrados — el tiempo total que estuvo parado.")+',
'      kpi(k.faltAbiertos,"Faltantes abiertos",k.faltAbiertos>0?"var(--bad)":"","Faltantes de material reportados que aún no se marcan como surtidos.")+',
'      kpi(k.calAbiertos,"Calidad abierta",k.calAbiertos>0?"var(--bad)":"","Reportes de calidad que siguen sin cerrarse.")+',
'      kpi((k.reaccionMin==null?"—":k.reaccionMin+" min"),"Tiempo de reacción (7d)",(k.reaccionMin==null?"":(k.reaccionMin<=15?"var(--ok)":k.reaccionMin<=30?"var(--warn)":"var(--bad)")),"Minutos promedio que tarda un paro desde que se marca hasta que se cierra (‘✅ Ya quedó’), en los últimos 7 días. Es el tiempo de reacción del andón. Meta: 10–15 min. Solo cuenta paros ya cerrados.");',
'    var ht="";d.tableros.forEach(function(t){var p=t.pct==null?(t.real+" "+(t.unidad||"pzs")):(t.real+"/"+t.plan+" "+t.pct+"%"+(t.over?" ⚠️":""));',
'      ht+="<div class=\\"tab\\"><div>"+t.sem+" <b>"+t.nombre+"</b><div class=\\"muted\\">"+(t.metaLbl||"")+" · "+t.grupo+" · hora reportada "+(t.ultima||"—")+(t.sd?" · "+t.sd+" sin dato":"")+(t.over?" · ⚠️ reportó "+t.pctRaw+"% — revisar meta/captura":"")+(t.low&&t.causasHoy&&t.causasHoy.length?(" · <span style=\\"color:var(--bad)\\">🔻 "+t.causasHoy.join(" · ")+"</span>"):"")+"</div></div><div class=\\"num\\" style=\\"text-align:right\\">"+p+"</div></div>"});',
'    document.getElementById("tableros").innerHTML=ht||"<div class=\\"empty\\">Sin datos hoy</div>";',
'    try{renderFlujo(d)}catch(fe){document.getElementById("flujo").innerHTML="<div class=\\"empty\\">flujo no cargó</div>"}',
'    try{renderParos(d)}catch(pe){}',
'    try{renderWip(d)}catch(we){document.getElementById("wip").innerHTML="<div class=\\"empty\\">WIP no cargó</div>"}',
'    var rev=d.revisar||[];document.getElementById("revisar").innerHTML=rev.length?("<div class=\\"revbox\\"><b>⚠️ "+rev.length+" tablero(s) con dato sospechoso</b> (&gt;115%, fuera del rango esperado 85–115%) — revisar meta o captura: "+rev.map(function(x){return x.nombre+" ("+x.pctRaw+"%)";}).join(" · ")+". El número final ya cuenta cada proceso máx. 100%.</div>"):"";',
'    var hh="";d.lideres.forEach(function(l){var pc=l.pct==null?0:l.pct;var c=pc>=80?"var(--ok)":pc>=50?"var(--warn)":"var(--bad)";',
'      hh+="<div class=\\"tab\\"><div><b>"+l.nombre+"</b><div class=\\"bar\\"><i style=\\"width:"+Math.min(pc,100)+"%;background:"+c+"\\"></i></div></div><div class=\\"num\\" style=\\"text-align:right\\">"+l.reportados+"/"+l.esperados+"<div class=\\"muted\\" style=\\"font-weight:400\\">captura "+(l.ultima||"—")+"</div></div></div>"});',
'    document.getElementById("hb").innerHTML=hh||"<div class=\\"empty\\">Sin líderes</div>";',
'    if(d.escalamientos.length){var et="<table><tr><th>Tipo</th><th>Tablero</th><th>Detalle</th><th>A</th><th>Hace</th><th>Aviso</th></tr>";',
'      d.escalamientos.forEach(function(e){et+="<tr><td><span class=\\"pill t-"+e.tipo+"\\">"+e.tipo+"</span></td><td>"+e.tablero+"</td><td>"+(e.detalle||"")+"</td><td>"+(e.quien||"—")+"</td><td>"+e.haceMin+" min</td><td>"+(e.acuse?"✅":"⏳")+"</td></tr>"});',
'      et+="</table>";document.getElementById("esc").innerHTML=et;}else{document.getElementById("esc").innerHTML="<div class=\\"empty\\">Nada escalado abierto 🎉</div>"}',
'    try{drawHora(d.porHora);parData=d;renderPareto();drawSemana(d.semana||[]);}catch(ce){document.getElementById("sub").textContent+=" · (graficas no cargaron)"}',
'    renderEmb(d.embarques);',
'  }catch(e){document.getElementById("sub").textContent="error: "+e.message}',
'}',
'function kpi(v,l,c,info){return "<div class=\\"kpi\\" onclick=\\"this.classList.toggle(\\x27open\\x27)\\" title=\\""+(info||"").replace(/\\"/g,"&quot;")+"\\"><span class=\\"q\\">i</span><div class=\\"v\\""+(c?" style=\\"color:"+c+"\\"":"")+">"+v+"</div><div class=\\"l\\">"+l+"</div>"+(info?"<div class=\\"ki\\">"+info+"</div>":"")+"</div>"}',
'function drawHora(rows){var lb=rows.map(function(r){return r.slot});var pl=rows.map(function(r){return r.plan});var re=rows.map(function(r){return r.real});',
'  if(chHora)chHora.destroy();chHora=new Chart(document.getElementById("cHora"),{type:"bar",data:{labels:lb,datasets:[{label:"Plan",data:pl,backgroundColor:"#d4d4d8",borderRadius:4},{label:"Real",data:re,backgroundColor:"#7c3aed",borderRadius:4}]},options:{plugins:{legend:{labels:{color:"#52525b",boxWidth:10,boxHeight:10,usePointStyle:true,pointStyle:"circle"}}},scales:{x:{grid:{display:false},border:{display:false},ticks:{color:"#71717a"}},y:{grid:{color:"#f0f0f2"},border:{display:false},ticks:{color:"#71717a"}}}}})}',
'function setParMode(m){parMode=m;renderPareto();}',
'function parBtn(m,l){var on=parMode===m;return "<button onclick=\\"setParMode(\x27"+m+"\x27)\\" style=\\"border:1px solid "+(on?"#7c3aed":"#d4d4d8")+";background:"+(on?"#7c3aed":"#fff")+";color:"+(on?"#fff":"#52525b")+";border-radius:6px;padding:2px 10px;margin-left:4px;cursor:pointer;font-size:12px\\">"+l+"</button>"}',
'function renderPareto(){if(!parData)return;var P=parMode==="dia"?parData.paretoDia:parData.pareto;var TA=parMode==="dia"?parData.topAreaDia:parData.topArea;',
'  var tg=document.getElementById("parTog");if(tg)tg.innerHTML=parBtn("dia","Hoy")+parBtn("sem","7 días");',
'  try{drawPar(P)}catch(e){}',
'  var ta="<table><tr><th>Área</th><th>Causa #1</th><th>Veces</th></tr>";(TA||[]).forEach(function(t){ta+="<tr><td><b>"+t.area+"</b> <span class=\\"muted\\">"+t.lider+"</span></td><td>"+(t.causa||"— sin causas —")+"</td><td>"+(t.n||0)+"</td></tr>"});ta+="</table>";document.getElementById("topArea").innerHTML=ta;}',
'function drawPar(p){var col={SMT:"#7c3aed",PTH:"#f59e0b",CONFORMAL:"#16a34a"};',
'  var lb=p.causas.map(function(c){return c.replace(/^[\\s\\W]+/,"")});',
'  var ds=p.areas.map(function(a){return {label:a.label,data:p.data[a.key],backgroundColor:col[a.key]||"#9ca3af",borderRadius:3}});',
'  if(chPar)chPar.destroy();chPar=new Chart(document.getElementById("cPar"),{type:"bar",data:{labels:lb,datasets:ds},options:{indexAxis:"y",plugins:{legend:{labels:{color:"#52525b",boxWidth:10,boxHeight:10,usePointStyle:true,pointStyle:"circle"}}},scales:{x:{stacked:true,beginAtZero:true,grid:{color:"#f0f0f2"},border:{display:false},ticks:{color:"#71717a",precision:0}},y:{stacked:true,grid:{display:false},border:{display:false},ticks:{color:"#3f3f46",autoSkip:false}}}}})}',
'function stat(v,l){return "<div><div class=\\"v\\">"+v+"</div><div class=\\"l\\">"+l+"</div></div>"}',
'function renderEmb(e){var card=document.getElementById("embCard");if(!card)return;',
'  if(!e||!e.activo){card.style.display="none";return}card.style.display="";',
'  var hasData=(e.porNP&&e.porNP.length)||(e.porHora&&e.porHora.length);',
'  document.getElementById("embKpis").innerHTML=stat(e.total+" <small>tarjetas</small>","hoy")+stat(e.nps,"NP distintos")+stat(e.ultima||"—","última hora")+stat(e.ultimaCap||"—","última captura");',
'  document.getElementById("embEmpty").innerHTML=hasData?"":"<div class=\\"empty\\">Aún no hay tarjetas registradas hoy.</div>";',
'  try{drawEmbNP(e.porNP||[]);drawEmbHora(e.porHora||[]);}catch(ce){}}',
'function drawEmbNP(rows){var lb=rows.map(function(r){return r.np});var dt=rows.map(function(r){return r.cant});',
'  if(chENP)chENP.destroy();chENP=new Chart(document.getElementById("cEmbNP"),{type:"bar",data:{labels:lb,datasets:[{label:"Tarjetas",data:dt,backgroundColor:"#7c3aed",borderRadius:3}]},options:{indexAxis:"y",plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,grid:{color:"#f0f0f2"},border:{display:false},ticks:{color:"#71717a",precision:0}},y:{grid:{display:false},border:{display:false},ticks:{color:"#3f3f46",autoSkip:false}}}}})}',
'function drawEmbHora(rows){var lb=rows.map(function(r){return r.slot});var dt=rows.map(function(r){return r.cant});',
'  if(chEH)chEH.destroy();chEH=new Chart(document.getElementById("cEmbHora"),{type:"bar",data:{labels:lb,datasets:[{label:"Tarjetas",data:dt,backgroundColor:"#a78bfa",borderRadius:4}]},options:{plugins:{legend:{display:false}},scales:{x:{grid:{display:false},border:{display:false},ticks:{color:"#71717a"}},y:{beginAtZero:true,grid:{color:"#f0f0f2"},border:{display:false},ticks:{color:"#71717a",precision:0}}}}})}',
'function drawSemana(rows){var DN=["dom","lun","mar","mié","jue","vie","sáb"];var lb=rows.map(function(r){var d=new Date(r.fecha+"T12:00:00");return DN[d.getDay()]+" "+d.getDate();});',
'  var dt=rows.map(function(r){return r.pct;});var cols=rows.map(function(r){return r.pct==null?"#d4d4d8":(r.pct>=95?"#16a34a":r.pct>=80?"#f59e0b":"#dc2626");});',
'  var vals=rows.filter(function(r){return r.pct!=null;}).map(function(r){return r.pct;});var prom=vals.length?Math.round(vals.reduce(function(a,b){return a+b;},0)/vals.length):null;',
'  document.getElementById("semProm").innerHTML=prom==null?"":("Promedio de la semana: <b style=\\"color:#18181b\\">"+prom+"%</b> (cada día topado a 100% por proceso)");',
'  if(chSem)chSem.destroy();chSem=new Chart(document.getElementById("cSemana"),{type:"bar",data:{labels:lb,datasets:[{label:"Cumplimiento",data:dt,backgroundColor:cols,borderRadius:5}]},options:{plugins:{legend:{display:false}},scales:{x:{grid:{display:false},border:{display:false},ticks:{color:"#71717a"}},y:{beginAtZero:true,suggestedMax:100,grid:{color:"#f0f0f2"},border:{display:false},ticks:{color:"#71717a",callback:function(v){return v+"%";}}}}}})}',
'(function(){var tg=document.getElementById("tabTog");if(tg)tg.onclick=function(){var t=document.getElementById("tableros");var sh=t.style.display==="none";t.style.display=sh?"":"none";tg.textContent=sh?"ocultar \\u25B4":"ver todos \\u25BE";};})();',
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

const tab = await pg(`SELECT l.codigo, l.nombre, l.grupo, l.orden, l.unidad, COALESCE(SUM(h.plan) FILTER (WHERE NOT h.sin_dato),0)::bigint AS plan, COALESCE(SUM(h.real) FILTER (WHERE NOT h.sin_dato),0)::bigint AS real, COUNT(h.*) FILTER (WHERE h.sin_dato)::int AS sd, MAX(h.hora_slot) FILTER (WHERE NOT h.sin_dato) AS ultima, MIN(h.hora_slot) FILTER (WHERE NOT h.sin_dato AND h.plan>0 AND h.real < h.plan*0.8) AS primer_bajo, (SELECT o.orden FROM horacio.ordenes_tablero o WHERE o.linea_id=l.id AND o.fecha='${fecha}' AND o.vigente ORDER BY o.ts DESC LIMIT 1) AS ot, (SELECT o.meta_hr FROM horacio.ordenes_tablero o WHERE o.linea_id=l.id AND o.fecha='${fecha}' AND o.vigente ORDER BY o.ts DESC LIMIT 1) AS meta, (SELECT o.modelo FROM horacio.ordenes_tablero o WHERE o.linea_id=l.id AND o.fecha='${fecha}' AND o.vigente ORDER BY o.ts DESC LIMIT 1) AS modelo, (SELECT e.piezas_hora FROM horacio.estandares e WHERE e.linea_id=l.id AND e.vigente=true ORDER BY e.created_at DESC LIMIT 1) AS est_oficial, (SELECT array_agg(DISTINCT cp2.boton_texto) FROM horacio.hxh_vigente h2 JOIN horacio.causas_paro cp2 ON cp2.codigo=h2.causa_codigo WHERE h2.linea_id=l.id AND h2.fecha='${fecha}' AND h2.causa_codigo IS NOT NULL) AS causas_hoy FROM horacio.lineas l LEFT JOIN horacio.hxh_vigente h ON h.linea_id=l.id AND h.fecha='${fecha}' WHERE l.activa AND l.captura<>'tarjetas' GROUP BY l.id, l.codigo, l.nombre, l.grupo, l.orden ORDER BY l.grupo, l.orden`);
const tableros = tab.map((t) => {
  const plan = Number(t.plan) || 0, real = Number(t.real) || 0;
  const pctRaw = plan > 0 ? Math.round(real / plan * 100) : null;     // % real sin topar (puede pasar de 100)
  const pct = pctRaw == null ? null : Math.min(pctRaw, 100);           // % mostrado: topado a 100
  const over = plan > 0 && real > plan * 1.15;                         // >115% (rango esperado 85–115%) → dato sospechoso
  const sem = pct == null ? '⚪' : (pct >= 95 ? '🟢' : (pct >= 80 ? '🟡' : '🔴'));
  const meta = t.meta != null ? Number(t.meta) : null;
  const estOf = t.est_oficial != null ? Number(t.est_oficial) : null;
  // fuente de la meta: OT que cargó Daniel > estándar oficial (fallback) > sin meta
  const metaSrc = meta != null ? 'ot' : (plan > 0 && estOf != null ? 'estandar' : 'none');
  const metaLbl = metaSrc === 'ot'
    ? ('OT ' + (t.ot || '?') + (t.modelo ? ' · ' + t.modelo : '') + ' · meta ' + meta + '/h')
    : (metaSrc === 'estandar' ? ('estándar oficial ' + estOf + '/h · sin OT hoy') : '⚪ sin meta');
  const causasHoy = Array.isArray(t.causas_hoy) ? t.causas_hoy : [];   // boton_texto ya trae el iconito (⚙️🛠️📦…)
  const low = pct != null && pct <= 70;                                 // incumplimiento (≤70%) → mostrar causa
  const perdidas = Math.max(0, plan - real);                            // piezas dejadas de producir vs meta (impacto real)
  return { codigo: t.codigo, nombre: t.nombre, grupo: t.grupo, unidad: t.unidad || 'pzs', plan, real, pct, pctRaw, over, sem, ultima: t.ultima || null, primerBajo: t.primer_bajo || null, sd: Number(t.sd) || 0, ot: t.ot || null, meta: meta, modelo: t.modelo || null, estOf: estOf, metaSrc: metaSrc, metaLbl: metaLbl, low: low, perdidas: perdidas, causasHoy: causasHoy };
});
const conMeta = tableros.filter((t) => t.plan > 0);
// agregado SIN contaminar: cada tablero aporta como máximo su meta → min(real, plan)
const sumPlan = conMeta.reduce((a, t) => a + t.plan, 0), sumReal = conMeta.reduce((a, t) => a + Math.min(t.real, t.plan), 0);

const kp = await pg(`SELECT (SELECT COUNT(*) FROM horacio.paros WHERE estado='abierto')::int AS paros_ab, (SELECT COALESCE(SUM(duracion_min),0) FROM horacio.paros WHERE ts_inicio::date='${fecha}')::int AS min_paro, (SELECT COUNT(*) FROM horacio.faltantes WHERE estado<>'cerrado')::int AS falt_ab, (SELECT COUNT(*) FROM horacio.calidad WHERE estado<>'cerrado')::int AS cal_ab, (SELECT ROUND(AVG(duracion_min))::int FROM horacio.paros WHERE estado='cerrado' AND duracion_min IS NOT NULL AND ts_inicio::date >= '${fecha}'::date-6) AS reaccion_min`);
const K = kp[0] || {};

const hb = await pg(`SELECT p.nombre, COUNT(DISTINCT l.id)::int AS nboards, COUNT(h.*) FILTER (WHERE NOT h.sin_dato)::int AS reportes, MAX(h.ts) FILTER (WHERE NOT h.sin_dato) AS ultima FROM horacio.personas p JOIN horacio.lineas l ON l.lider_persona_id=p.id AND l.activa LEFT JOIN horacio.hxh_vigente h ON h.linea_id=l.id AND h.fecha='${fecha}' WHERE p.chat_id IS NOT NULL GROUP BY p.id, p.nombre ORDER BY p.nombre`);
const DIA_VENTANAS = 9; // turno 6:30→15:30 = 9 ventanas HxH
const lideres = hb.map((r) => {
  const esp = (Number(r.nboards) || 0) * DIA_VENTANAS, rep = Number(r.reportes) || 0; // denominador FIJO del día (nº tableros × 9)
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

const ph = await pg(`SELECT hora_slot, COALESCE(SUM(plan) FILTER (WHERE NOT sin_dato),0)::bigint AS plan, COALESCE(SUM(real) FILTER (WHERE NOT sin_dato),0)::bigint AS real FROM horacio.hxh_vigente WHERE fecha='${fecha}' AND linea_id IN (SELECT id FROM horacio.lineas WHERE captura<>'tarjetas') GROUP BY hora_slot ORDER BY hora_slot`);
const porHora = ph.map((r) => ({ slot: r.hora_slot, plan: Number(r.plan) || 0, real: Number(r.real) || 0 }));

// semanal: cumplimiento por día (7d), capado por proceso (LEAST(real,meta) por línea-día)
const sm = await pg(`WITH t AS (SELECT fecha, linea_id, SUM(plan) FILTER (WHERE NOT sin_dato) AS p, SUM(real) FILTER (WHERE NOT sin_dato) AS r FROM horacio.hxh_vigente WHERE fecha >= '${fecha}'::date-6 GROUP BY fecha, linea_id) SELECT fecha::text AS fecha, COALESCE(SUM(LEAST(r,p)),0)::bigint AS capreal, COALESCE(SUM(p),0)::bigint AS plan FROM t WHERE p>0 GROUP BY fecha ORDER BY fecha`);
const semana = sm.map((r) => ({ fecha: r.fecha, pct: Number(r.plan) > 0 ? Math.min(100, Math.round(Number(r.capreal) / Number(r.plan) * 100)) : null }));

// líder por área (grupo) para la leyenda
const lead = await pg("SELECT DISTINCT ON (l.grupo) l.grupo, p.nombre FROM horacio.lineas l JOIN horacio.personas p ON p.id=l.lider_persona_id WHERE l.activa ORDER BY l.grupo, l.orden");
const areaLeader = {}; lead.forEach((r) => { areaLeader[r.grupo] = r.nombre; });
const friendly = (n) => { const m = n && n.match(/\(([^)]+)\)/); return m ? m[1] : (n ? n.split(' ')[0] : '?'); };
const grpName = (g) => (g === 'CONFORMAL' ? 'Conformal' : g);
// causas (paros + merma HxH) desglosadas por área — builder reutilizable (7 días y diario)
const AREAS = ['SMT', 'PTH', 'CONFORMAL'];
async function buildPareto(desdeSql) {
  const rows = await pg(`SELECT cp.boton_texto AS causa, l.grupo AS grupo, COUNT(*)::int AS n FROM (SELECT causa_codigo, linea_id FROM horacio.paros WHERE ts_inicio::date >= ${desdeSql} AND causa_codigo IS NOT NULL UNION ALL SELECT causa_codigo, linea_id FROM horacio.hxh_vigente WHERE fecha >= ${desdeSql} AND causa_codigo IS NOT NULL) x JOIN horacio.causas_paro cp ON cp.codigo=x.causa_codigo JOIN horacio.lineas l ON l.id=x.linea_id GROUP BY cp.boton_texto, l.grupo`);
  const totals = {}, byCA = {};
  rows.forEach((r) => { const n = Number(r.n) || 0; totals[r.causa] = (totals[r.causa] || 0) + n; (byCA[r.causa] = byCA[r.causa] || {})[r.grupo] = n; });
  const causas = Object.keys(totals).sort((a, b) => totals[b] - totals[a]).slice(0, 8);
  const pareto = {
    causas,
    areas: AREAS.map((k) => ({ key: k, label: grpName(k) + ' - ' + friendly(areaLeader[k]) })),
    data: AREAS.reduce((o, k) => { o[k] = causas.map((c) => (byCA[c] && byCA[c][k]) || 0); return o; }, {}),
  };
  const topArea = AREAS.map((k) => {
    let causa = null, n = 0;
    Object.keys(byCA).forEach((c) => { const v = byCA[c][k] || 0; if (v > n) { n = v; causa = c; } });
    return { area: grpName(k), lider: friendly(areaLeader[k]), causa, n };
  });
  return { pareto, topArea };
}
const par7 = await buildPareto(`'${fecha}'::date-6`);   // 7 días
const parDia = await buildPareto(`'${fecha}'::date`);    // solo hoy (R3-HDB2-04)
const pareto = par7.pareto, topArea = par7.topArea;
const paretoDia = parDia.pareto, topAreaDia = parDia.topArea;

// ===== Embarques (captura='tarjetas', grupo EMBARQUES) — detalle aparte, fuera de cumplimiento =====
const embLines = await pg("SELECT id FROM horacio.lineas WHERE captura='tarjetas' AND activa AND grupo='EMBARQUES'");
let embarques = { activo: false };
if (embLines.length) {
  const ids = embLines.map((r) => `'${r.id}'`).join(',');
  const tot = await pg(`SELECT COALESCE(SUM(d.cantidad),0)::bigint AS total, COUNT(DISTINCT d.numero_parte)::int AS nps, MAX(h.hora_slot) AS ultima, to_char(MAX(h.ts) AT TIME ZONE 'America/Mexico_City','HH24:MI') AS ultcap FROM horacio.hxh_tarjetas d JOIN horacio.hora_por_hora h ON h.id=d.hxh_id WHERE h.linea_id IN (${ids}) AND h.fecha='${fecha}'`);
  const byNP = await pg(`SELECT d.numero_parte AS np, SUM(d.cantidad)::bigint AS cant FROM horacio.hxh_tarjetas d JOIN horacio.hora_por_hora h ON h.id=d.hxh_id WHERE h.linea_id IN (${ids}) AND h.fecha='${fecha}' GROUP BY d.numero_parte ORDER BY cant DESC, d.numero_parte LIMIT 12`);
  const byHora = await pg(`SELECT h.hora_slot AS slot, SUM(d.cantidad)::bigint AS cant FROM horacio.hxh_tarjetas d JOIN horacio.hora_por_hora h ON h.id=d.hxh_id WHERE h.linea_id IN (${ids}) AND h.fecha='${fecha}' GROUP BY h.hora_slot ORDER BY h.hora_slot`);
  const T = tot[0] || {};
  embarques = {
    activo: true,
    total: Number(T.total) || 0,
    nps: Number(T.nps) || 0,
    ultima: T.ultima || null,
    ultimaCap: T.ultcap || null,
    porNP: byNP.map((r) => ({ np: r.np, cant: Number(r.cant) || 0 })),
    porHora: byHora.map((r) => ({ slot: r.slot, cant: Number(r.cant) || 0 })),
  };
}

// ===== Empaque por tarjetas (etapa del flujo) — tras reducir tableros, Empaque captura por tarjetas (volumen, sin meta) =====
const empLines = await pg("SELECT id FROM horacio.lineas WHERE captura='tarjetas' AND activa AND grupo='EMPAQUE'");
let empaqueTarj = 0;
if (empLines.length) {
  const ids = empLines.map((r) => `'${r.id}'`).join(',');
  const tt = await pg(`SELECT COALESCE(SUM(d.cantidad),0)::bigint AS total FROM horacio.hxh_tarjetas d JOIN horacio.hora_por_hora h ON h.id=d.hxh_id WHERE h.linea_id IN (${ids}) AND h.fecha='${fecha}'`);
  empaqueTarj = Number(tt[0] && tt[0].total) || 0;
}

// ===== Flujo por etapa (value stream) + cuello de botella por piezas perdidas =====
const STAGE_ORDER = ['SMT', 'PTH', 'EMPAQUE'];                 // orden físico del proceso
const STAGE_LABEL = { SMT: 'SMT', PTH: 'PTH', EMPAQUE: 'Empaque' };
// Ruteo de vertientes (config de piso — Juan 2026-06-23). Promover a tabla horacio.flujo_rutas si crece.
const ROUTING = {
  PTH: [
    { nombre: 'Línea 1', codigos: ['PTH', 'OLA', 'SOLDEO', 'ICT_1'] },
    { nombre: 'Línea 2', codigos: ['PTH_LINEA_2', 'OLA_2', 'SOLDEO_MANUAL_2', 'ICT_2'] },
    { nombre: 'Línea 3', codigos: ['PTH_LINEA_3', 'OLA_3', 'SOLDEO_MANUAL_3', 'ICT_3'] },
    { nombre: 'Acabado común', codigos: ['ICT', 'CONFORMAL_Y'], convergencia: true },
  ],
};
// Ola 2 (línea 2) no existe como estación en el sistema → caja placeholder en 0 (es la máquina descompuesta).
// OLA_3 = "Ola 3" real de la línea 3 (mantiene su nombre nativo).
const LABEL_OVERRIDE = { OLA_2: 'Ola 2' };
const byCodigo = {}; tableros.forEach((t) => { byCodigo[t.codigo] = t; });
function buildRamas(grupo) {
  const route = ROUTING[grupo];
  if (!route) return null;
  return route.map((br) => ({
    nombre: br.nombre,
    convergencia: !!br.convergencia,
    estaciones: br.codigos.map((cod) => {
      const t = byCodigo[cod];
      const label = LABEL_OVERRIDE[cod] || (t ? t.nombre : cod);
      if (!t) return { nombre: label, real: 0, pct: null, sem: '⚪', ultima: null, sd: 0, perdidas: 0, causa: null };
      return { nombre: label, real: t.real, plan: t.plan, pct: t.pct, sem: t.sem, ultima: t.ultima, sd: t.sd, perdidas: t.perdidas, causa: (t.causasHoy && t.causasHoy.length ? t.causasHoy.join(' · ') : null), unidad: t.unidad };
    }),
  }));
}
const flujo = STAGE_ORDER.map((g) => {
  const bs = tableros.filter((t) => t.grupo === g);
  const cm = bs.filter((t) => t.plan > 0);                    // solo tableros con meta hoy
  const sp = cm.reduce((a, t) => a + t.plan, 0);
  const srRaw = cm.reduce((a, t) => a + t.real, 0);          // real de tableros con meta (para % y real/plan)
  const srCap = cm.reduce((a, t) => a + Math.min(t.real, t.plan), 0);   // topado por proceso (honesto)
  const perd = cm.reduce((a, t) => a + t.perdidas, 0);        // piezas perdidas de la etapa
  let realTotal = bs.reduce((a, t) => a + t.real, 0);        // producción TOTAL (con o sin meta) — para mostrar etapas sin OT
  if (g === 'EMPAQUE' && empaqueTarj > 0) realTotal += empaqueTarj;   // Empaque captura por tarjetas (volumen del día)
  const pct = sp > 0 ? Math.min(100, Math.round(srCap / sp * 100)) : null;
  // estaciones de la etapa, en orden de proceso (tableros ya viene ORDER BY grupo, orden)
  const estaciones = bs.map((t) => ({ nombre: t.nombre, real: t.real, plan: t.plan, pct: t.pct, sem: t.sem, ultima: t.ultima, sd: t.sd, perdidas: t.perdidas, causa: (t.causasHoy && t.causasHoy.length ? t.causasHoy.join(' · ') : null), unidad: t.unidad }));
  return { etapa: STAGE_LABEL[g] || g, grupo: g, lider: friendly(areaLeader[g] || ''), pct, real: srRaw, realTotal: realTotal, plan: sp, perdidas: perd, conMeta: cm.length, cuello: false, estaciones: estaciones, ramas: buildRamas(g) };
});
if (embarques.activo) flujo.push({ etapa: 'Embarques', grupo: 'EMBARQUES', lider: friendly(areaLeader['EMBARQUES'] || ''), pct: null, tarjetas: embarques.total, perdidas: 0, cuello: false });
// cuello = etapa con MÁS piezas perdidas y desempeño bajo (<90%); si todas van bien → sin cuello
let cuelloIdx = -1, maxPerd = 0;
flujo.forEach((s, i) => { if (s.pct != null && s.pct < 90 && s.perdidas > maxPerd) { maxPerd = s.perdidas; cuelloIdx = i; } });
let cuelloDetalle = null;
if (cuelloIdx >= 0) {
  flujo[cuelloIdx].cuello = true;
  const g = flujo[cuelloIdx].grupo;
  const boards = tableros.filter((t) => t.grupo === g && t.perdidas > 0)
    .sort((a, b) => b.perdidas - a.perdidas).slice(0, 3)
    .map((t) => ({ nombre: t.nombre, sem: t.sem, pct: t.pct, perdidas: t.perdidas, causa: (t.causasHoy && t.causasHoy.length ? t.causasHoy.join(' · ') : null), desde: t.primerBajo }));
  cuelloDetalle = { etapa: flujo[cuelloIdx].etapa, lider: flujo[cuelloIdx].lider, perdidas: flujo[cuelloIdx].perdidas, boards };
}

// ===== Paros de hoy con causa raíz (5 por qués) + causas raíz recurrentes (7 d) =====
let parosHoy = [];
try {
  parosHoy = (await pg(`SELECT l.nombre AS tablero, l.grupo, p.estado, to_char(p.ts_inicio AT TIME ZONE 'America/Mexico_City','HH24:MI') AS hora, p.duracion_min AS dur, COALESCE(cp.boton_texto,'—') AS causa, p.causa_raiz, p.correctiva, p.analisis_porques FROM horacio.paros p JOIN horacio.lineas l ON l.id=p.linea_id LEFT JOIN horacio.causas_paro cp ON cp.codigo=p.causa_codigo WHERE p.ts_inicio::date='${fecha}' ORDER BY p.ts_inicio DESC`))
    .map((r) => ({ tablero: r.tablero, grupo: r.grupo, estado: r.estado, hora: r.hora, dur: r.dur == null ? null : Number(r.dur), causa: r.causa, causaRaiz: r.causa_raiz || null, correctiva: r.correctiva || null, porques: Array.isArray(r.analisis_porques) ? r.analisis_porques.map((x) => ({ p: x.p, r: x.r })) : [] }));
} catch (e) { parosHoy = []; }
let parosRecurrentes = [];
try {
  parosRecurrentes = (await pg("SELECT causa, linea, grupo, veces_7d, min_7d FROM horacio.v_paros_recurrentes ORDER BY veces_7d DESC, min_7d DESC LIMIT 6"))
    .map((r) => ({ causa: r.causa, linea: r.linea, grupo: r.grupo, veces: Number(r.veces_7d) || 0, min: Number(r.min_7d) || 0 }));
} catch (e) { parosRecurrentes = []; }

let wip = [];
try {
  wip = (await pg("SELECT subensamble, smt_term, fin_term, finales_activos, wip_mas_buffer FROM horacio.v_wip_smt WHERE smt_term>0 OR fin_term>0 ORDER BY (finales_activos>0) DESC, wip_mas_buffer DESC"))
    .map((r) => ({ sub: r.subensamble, smt: Number(r.smt_term) || 0, fin: Number(r.fin_term) || 0, act: Number(r.finales_activos) || 0, wip: Number(r.wip_mas_buffer) || 0 }));
} catch (e) { wip = []; }

const payload = {
  fecha, hora: now.toFormat('HH:mm'),
  kpis: {
    cumplimiento: sumPlan > 0 ? Math.min(100, Math.round(sumReal / sumPlan * 100)) : null,
    reportando: tableros.filter((t) => t.ultima).length, tableros: tableros.length,
    parosAbiertos: Number(K.paros_ab) || 0, minParo: Number(K.min_paro) || 0,
    faltAbiertos: Number(K.falt_ab) || 0, calAbiertos: Number(K.cal_ab) || 0,
    reaccionMin: (K.reaccion_min == null ? null : Number(K.reaccion_min)),
  },
  tableros, lideres, escalamientos: escal, porHora, pareto, topArea, paretoDia, topAreaDia, embarques, flujo, cuelloDetalle, parosHoy, parosRecurrentes, wip,
  revisar: tableros.filter((t) => t.over).map((t) => ({ nombre: t.nombre, pctRaw: t.pctRaw, real: t.real, plan: t.plan, unidad: t.unidad })),
  semana,
};
return [{ json: { body: JSON.stringify(payload), contentType: 'application/json; charset=utf-8' } }];
