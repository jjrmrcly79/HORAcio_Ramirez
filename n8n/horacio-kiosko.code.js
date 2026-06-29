// ============================================================
// Horacio — Kiosko de Paros (nodo Code único)
// Workflow n8n: "Horacio - Kiosko" · Webhook GET /horacio-kiosko
//   /webhook/horacio-kiosko?token=XYZ        -> página HTML (TV oficina/piso)
//   /webhook/horacio-kiosko?token=XYZ&data=1 -> JSON de paros vivos
// Pantalla AMBIENTE (pull): muestra paros, NO marca a nadie. Se CALMA con el acuse.
// Privacidad SN-04: línea + causa + quién atiende (supervisor). NUNCA la operadora.
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

// ---------------- DATOS (JSON) ----------------
if (q.data === '1') {
  const paros = await pg('SELECT id, linea, grupo, causa, inicio_ms, acusado, escalado_nivel, atiende, dias FROM horacio.v_paros_pantalla');
  const res = await pg("SELECT COUNT(*)::int AS n, COALESCE(SUM(duracion_min),0)::int AS min FROM horacio.paros WHERE estado='cerrado' AND (ts_fin AT TIME ZONE 'America/Mexico_City')::date = (now() AT TIME ZONE 'America/Mexico_City')::date");
  const rec = await pg('SELECT linea, causa, veces_7d FROM horacio.v_paros_recurrentes LIMIT 6');
  const payload = {
    hora: nowMX().toFormat('HH:mm'),
    paros: (paros || []).map((p) => ({ linea: p.linea, grupo: p.grupo, causa: p.causa, inicio_ms: Number(p.inicio_ms), acusado: !!p.acusado, escalado_nivel: Number(p.escalado_nivel) || 0, atiende: p.atiende || null, dias: Number(p.dias) || 0 })),
    resueltos: { n: Number((res[0] || {}).n) || 0, min: Number((res[0] || {}).min) || 0 },
    recurrentes: (rec || []).map((r) => ({ linea: r.linea, causa: r.causa, veces: Number(r.veces_7d) || 0 })),
  };
  return [{ json: { body: JSON.stringify(payload), contentType: 'application/json; charset=utf-8' } }];
}

// ---------------- PÁGINA HTML ----------------
const PAGE = [
'<!doctype html><html lang="es"><head><meta charset="utf-8">',
'<meta name="viewport" content="width=device-width,initial-scale=1">',
'<title>Horacio - Paros en vivo</title>',
'<style>',
'*{box-sizing:border-box;margin:0;padding:0}',
'body{background:#0b0b0f;color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;height:100vh;overflow:hidden;display:flex;flex-direction:column}',
'header{display:flex;align-items:center;gap:14px;padding:18px 28px;border-bottom:1px solid #1f1f27}',
'header h1{font-size:26px;font-weight:700;letter-spacing:-.01em}',
'header .dot{width:13px;height:13px;border-radius:50%;background:#22c55e;box-shadow:0 0 12px #22c55e}',
'header .clock{margin-left:auto;font-size:22px;color:#a1a1aa;font-variant-numeric:tabular-nums}',
'header .upd{font-size:13px;color:#52525b;margin-left:14px}',
'main{flex:1;overflow:auto;padding:22px 28px}',
'.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:18px}',
'.tile{border-radius:18px;padding:20px 22px;border:2px solid #27272a;background:#15151b;position:relative;overflow:hidden}',
'.tile .ln{font-size:30px;font-weight:750;letter-spacing:-.02em;line-height:1.1}',
'.tile .grp{font-size:14px;color:#a1a1aa;margin-top:2px;text-transform:uppercase;letter-spacing:.04em}',
'.tile .cz{font-size:20px;margin-top:12px;font-weight:600}',
'.tile .foot{display:flex;align-items:flex-end;justify-content:space-between;margin-top:16px;gap:12px}',
'.tile .stt{font-size:15px;font-weight:600;line-height:1.3}',
'.tile .tmr{font-size:40px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1}',
'.tile.soft{border-color:#3f3f46}.tile.soft .stt{color:#d4d4d8}.tile.soft .tmr{color:#e4e4e7}',
'.tile.calm{border-color:#2563eb;background:#101725}.tile.calm .stt{color:#93c5fd}.tile.calm .tmr{color:#bfdbfe}',
'.tile.warn{border-color:#d97706;background:#1c1408}.tile.warn .stt{color:#fbbf24}.tile.warn .tmr{color:#fcd34d}',
'.tile.bad{border-color:#dc2626;background:#1f0d0d}.tile.bad .stt{color:#fca5a5}.tile.bad .tmr{color:#fecaca}',
'.tile.bad{animation:pulse 1.6s ease-in-out infinite}',
'@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,0)}50%{box-shadow:0 0 0 4px rgba(220,38,38,.25)}}',
'.empty{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#34d399}',
'.empty .big{font-size:64px;font-weight:800}.empty .sm{font-size:20px;color:#71717a}',
'footer{border-top:1px solid #1f1f27;padding:14px 28px;display:flex;align-items:center;gap:18px;flex-wrap:wrap;font-size:16px;color:#a1a1aa}',
'footer b{color:#e4e4e7}',
'.rec{display:inline-flex;align-items:center;gap:7px;background:#1c1408;border:1px solid #d97706;color:#fbbf24;border-radius:999px;padding:5px 12px;font-size:14px}',
'</style></head><body>',
'<header><span class="dot"></span><h1>Horacio - Paros en vivo</h1><span class="clock" id="clock">--:--</span><span class="upd" id="upd"></span></header>',
'<main id="main"><div class="empty"><div class="sm">Cargando...</div></div></main>',
'<footer id="foot"></footer>',
'<script>',
'var P=location.pathname;var TKN=(location.search.match(/token=([^&]+)/)||[])[1]||"";',
'var DATA=null;',
'function h(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c];});}',
'function fmt(ms){var s=Math.floor((Date.now()-ms)/1000);if(s<0)s=0;var hh=Math.floor(s/3600),mm=Math.floor((s%3600)/60),ss=s%60;return hh>0?(hh+"h "+mm+"m"):(mm+":"+(ss<10?"0":"")+ss);}',
'function st(p){if(p.dias>0)return{c:"bad",t:"Sin cerrar de dia(s) anteriores"};if(p.acusado)return{c:"calm",t:"Atendiendo: "+h(p.atiende||"-")};var min=(Date.now()-p.inicio_ms)/60000;if(min>=30||p.escalado_nivel>0)return{c:"bad",t:"SIN ATENDER - escalado"};if(min>=10)return{c:"warn",t:"Sin acuse aun"};return{c:"soft",t:"Recien reportado"};}',
'function render(){if(!DATA)return;var m=document.getElementById("main");var ps=DATA.paros||[];',
'  if(!ps.length){m.innerHTML="<div class=\\"empty\\"><div class=\\"big\\">Sin paros abiertos</div><div class=\\"sm\\">Todo corriendo</div></div>";}',
'  else{var html="<div class=\\"grid\\">";for(var i=0;i<ps.length;i++){var p=ps[i];var s=st(p);html+="<div class=\\"tile "+s.c+"\\"><div class=\\"ln\\">"+h(p.linea)+"</div><div class=\\"grp\\">"+h(p.grupo||"")+"</div><div class=\\"cz\\">"+h(p.causa)+"</div><div class=\\"foot\\"><div class=\\"stt\\">"+s.t+"</div><div class=\\"tmr\\" data-ms=\\""+p.inicio_ms+"\\">"+fmt(p.inicio_ms)+"</div></div></div>";}html+="</div>";m.innerHTML=html;}',
'  var f=document.getElementById("foot");var r=DATA.resueltos||{n:0,min:0};var fh="<span>Resueltos hoy: <b>"+r.n+"</b> ("+r.min+" min)</span>";var rec=DATA.recurrentes||[];for(var j=0;j<rec.length;j++){fh+="<span class=\\"rec\\">"+h(rec[j].linea)+" - "+h(rec[j].causa)+" "+rec[j].veces+"x (7d)</span>";}f.innerHTML=fh;',
'  document.getElementById("upd").textContent="actualizado "+(DATA.hora||"");}',
'function tick(){var t=document.querySelectorAll(".tmr");for(var i=0;i<t.length;i++){t[i].textContent=fmt(Number(t[i].getAttribute("data-ms")));}var c=document.getElementById("clock");var d=new Date();c.textContent=(d.getHours()<10?"0":"")+d.getHours()+":"+(d.getMinutes()<10?"0":"")+d.getMinutes();}',
'function load(){fetch(P+"?token="+TKN+"&data=1").then(function(r){return r.json();}).then(function(j){DATA=j;render();}).catch(function(){});}',
'load();setInterval(load,20000);setInterval(tick,1000);tick();',
'</script></body></html>',
];
return [{ json: { body: PAGE.join(''), contentType: 'text/html; charset=utf-8' } }];
