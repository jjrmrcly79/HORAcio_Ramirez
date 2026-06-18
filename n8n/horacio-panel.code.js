// ============================================================
// Horacio — Panel de captura (nodo Code único)
// Workflow n8n: "Horacio - Panel" · Webhook GET+POST /horacio-panel
//   GET  /webhook/horacio-panel?token=XYZ        -> HTML (SPA, Powered by NexIA)
//   GET  /webhook/horacio-panel?token=XYZ&data=1 -> JSON estado del día
//   POST /webhook/horacio-panel {token,action,by,...} -> escrituras firmadas
// Trazabilidad: toda escritura manual guarda origen='panel_manual' +
//   capturado_por (quién, elegido al entrar) + nota. Dato "puro" = telegram_lider.
// Panel OPERATIVO (sí ve nombres de líderes); el dashboard de Dirección no.
// Reemplaza <SERVICE_ROLE_KEY> y <PANEL_TOKEN> en n8n (nunca en el repo).
// Code corre "Run Once for All Items": usar $input.first().json, NO $json.
// Respond node: respondWith=text, body={{$json.body}}, header content-type={{$json.contentType}}.
// ============================================================
const PG = 'https://supabase.nexiasoluciones.com.mx/pg/query';
const SK = '<SERVICE_ROLE_KEY>';
const TOKEN = '<PANEL_TOKEN>';
const pgh = { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' };
const H = this.helpers;
const pg = async (qy) => await H.httpRequest({ method: 'POST', url: PG, headers: pgh, body: { query: qy }, json: true });
const nowMX = () => DateTime.now().setZone('America/Mexico_City');
const esc = (s) => String(s == null ? '' : s).replace(/'/g, "''");
const pad2 = (n) => String(n).padStart(2, '0');
const winClose = (h) => pad2(h - 1) + ':30-' + pad2(h) + ':30';
const SLOTS = []; for (let h = 7; h <= 15; h++) SLOTS.push(winClose(h)); // 06:30-07:30 … 14:30-15:30
const ROLES = ['paros', 'faltantes', 'calidad', 'mantenimiento', 'direccion'];

const inp = $input.first().json;
const q = inp.query || {};
const body = inp.body || {};
const isPost = !!(body && body.action);
const token = (isPost ? body.token : q.token) || '';
const J = (o) => [{ json: { body: JSON.stringify(o), contentType: 'application/json; charset=utf-8' } }];

if (token !== TOKEN) {
  if (isPost || q.data === '1') return J({ ok: false, error: 'no autorizado' });
  return [{ json: { body: 'No autorizado', contentType: 'text/plain; charset=utf-8' } }];
}

const now = nowMX();
const fecha = now.toFormat('yyyy-LL-dd');

// ===================== ESCRITURAS (POST) =====================
if (isPost) {
  const by = (body.by || '').toString().trim().slice(0, 80);
  const act = body.action;
  try {
    if (act === 'backfill') {
      if (!by) return J({ ok: false, error: 'Identifícate primero (elige tu nombre).' });
      const lid = String(body.linea_id || '');
      const slot = String(body.slot || '');
      const real = parseInt(String(body.real == null ? '' : body.real).replace(/[^0-9]/g, ''), 10);
      if (!lid || SLOTS.indexOf(slot) < 0) return J({ ok: false, error: 'Tablero u hora inválidos.' });
      if (isNaN(real) || real < 0 || real > 100000) return J({ ok: false, error: 'Piezas inválidas (0–100000).' });
      const ln = await pg(`SELECT id FROM horacio.lineas WHERE id='${esc(lid)}' AND activa`);
      if (!ln.length) return J({ ok: false, error: 'Tablero no existe.' });
      const ya = await pg(`SELECT 1 FROM horacio.hora_por_hora WHERE linea_id='${esc(lid)}' AND fecha='${fecha}' AND hora_slot='${esc(slot)}' AND NOT sin_dato LIMIT 1`);
      if (ya.length) return J({ ok: false, error: 'Esa hora ya está capturada. (Para corregir, se registra como evento nuevo desde Telegram.)' });
      const causa = body.causa ? `'${esc(String(body.causa))}'` : 'NULL';
      const meta = await pg(`SELECT meta_hr FROM horacio.ordenes_tablero WHERE linea_id='${esc(lid)}' AND fecha='${fecha}' AND vigente ORDER BY ts DESC LIMIT 1`);
      const plan = (meta.length && meta[0].meta_hr != null) ? Number(meta[0].meta_hr) : null;
      const nota = body.nota ? `'${esc(String(body.nota).slice(0, 300))}'` : 'NULL';
      await pg(`INSERT INTO horacio.hora_por_hora(linea_id,fecha,hora_slot,plan,real,t_productivo_min,causa_codigo,origen,capturado_por,nota) VALUES('${esc(lid)}','${fecha}','${esc(slot)}',${plan == null ? 'NULL' : plan},${real},60,${causa},'panel_manual','${esc(by)}',${nota})`);
      return J({ ok: true });
    }
    if (act === 'create_board') {
      if (!by) return J({ ok: false, error: 'Identifícate primero.' });
      const nombre = String(body.nombre || '').trim().slice(0, 80);
      if (!nombre) return J({ ok: false, error: 'Falta el nombre del tablero.' });
      const grupo = (String(body.grupo || 'OTROS').trim().slice(0, 40).toUpperCase()) || 'OTROS';
      const unidad = (String(body.unidad || 'piezas').trim().slice(0, 20)) || 'piezas';
      const captura = (body.captura === 'tarjetas') ? 'tarjetas' : 'conteo';
      const sup = ROLES.indexOf(String(body.supervisor_rol)) >= 0 ? String(body.supervisor_rol) : 'paros';
      let codigo = String(body.codigo || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 30);
      if (!codigo) { codigo = (nombre.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24)) || 'TAB'; }
      const exq = await pg(`SELECT 1 FROM horacio.lineas WHERE codigo='${esc(codigo)}' LIMIT 1`);
      if (exq.length) codigo = codigo.slice(0, 24) + '_' + now.toFormat('HHmmss');
      const lpid = body.lider_persona_id ? `'${esc(String(body.lider_persona_id))}'` : 'NULL';
      const orden = await pg(`SELECT COALESCE(MAX(orden),0)+1 AS o FROM horacio.lineas`);
      await pg(`INSERT INTO horacio.lineas(codigo,nombre,grupo,orden,estandar_status,unidad,captura,supervisor_rol,lider_persona_id,activa) VALUES('${esc(codigo)}','${esc(nombre)}','${esc(grupo)}',${Number(orden[0].o) || 1},'no_estandar','${esc(unidad)}','${captura}','${sup}',${lpid},true)`);
      return J({ ok: true, codigo });
    }
    if (act === 'update_board') {
      if (!by) return J({ ok: false, error: 'Identifícate primero.' });
      const lid = String(body.linea_id || '');
      const ln = await pg(`SELECT id FROM horacio.lineas WHERE id='${esc(lid)}'`);
      if (!ln.length) return J({ ok: false, error: 'Tablero no existe.' });
      const sets = [];
      if (body.nombre != null) { const v = String(body.nombre).trim().slice(0, 80); if (v) sets.push(`nombre='${esc(v)}'`); }
      if (body.grupo != null) { const v = String(body.grupo).trim().slice(0, 40).toUpperCase(); if (v) sets.push(`grupo='${esc(v)}'`); }
      if (body.unidad != null) { const v = String(body.unidad).trim().slice(0, 20); if (v) sets.push(`unidad='${esc(v)}'`); }
      if (body.captura != null) { sets.push(`captura='${body.captura === 'tarjetas' ? 'tarjetas' : 'conteo'}'`); }
      if (body.supervisor_rol != null && ROLES.indexOf(String(body.supervisor_rol)) >= 0) { sets.push(`supervisor_rol='${String(body.supervisor_rol)}'`); }
      if (body.activa != null) { sets.push(`activa=${body.activa ? 'true' : 'false'}`); }
      if (!sets.length) return J({ ok: false, error: 'Nada que actualizar.' });
      await pg(`UPDATE horacio.lineas SET ${sets.join(', ')} WHERE id='${esc(lid)}'`);
      return J({ ok: true });
    }
    if (act === 'assign_board') {
      if (!by) return J({ ok: false, error: 'Identifícate primero.' });
      const lid = String(body.linea_id || '');
      const pid = body.lider_persona_id ? String(body.lider_persona_id) : null;
      const ln = await pg(`SELECT id FROM horacio.lineas WHERE id='${esc(lid)}'`);
      if (!ln.length) return J({ ok: false, error: 'Tablero no existe.' });
      if (pid) { const p = await pg(`SELECT id FROM horacio.personas WHERE id='${esc(pid)}'`); if (!p.length) return J({ ok: false, error: 'Persona no existe.' }); }
      await pg(`UPDATE horacio.lineas SET lider_persona_id=${pid ? `'${esc(pid)}'` : 'NULL'} WHERE id='${esc(lid)}'`);
      return J({ ok: true });
    }
    return J({ ok: false, error: 'acción desconocida' });
  } catch (e) { return J({ ok: false, error: 'error: ' + (e.message || e) }); }
}

// ===================== LECTURAS (GET ?data=1) =====================
if (q.data === '1') {
  const personas = await pg("SELECT id, nombre, rol FROM horacio.personas WHERE activa ORDER BY (rol='lider') DESC, rol, nombre");
  const tableros = await pg("SELECT l.id, l.codigo, l.nombre, l.grupo, l.orden, l.unidad, l.captura, l.supervisor_rol, l.lider_persona_id, p.nombre AS lider FROM horacio.lineas l LEFT JOIN horacio.personas p ON p.id=l.lider_persona_id WHERE l.activa ORDER BY l.grupo, l.orden");
  const causas = await pg("SELECT codigo, boton_texto FROM horacio.causas_paro WHERE activa ORDER BY orden");
  const hxh = await pg(`SELECT h.linea_id, h.hora_slot, h.real, h.plan, h.sin_dato, h.origen, h.capturado_por, pr.nombre AS reporto FROM horacio.hora_por_hora h LEFT JOIN horacio.personas pr ON pr.chat_id=h.reporto_chat_id WHERE h.fecha='${fecha}' ORDER BY h.ts`);
  let puras = 0, manual = 0, sind = 0;
  hxh.forEach((r) => { if (r.sin_dato) sind++; else if (r.origen === 'panel_manual') manual++; else puras++; });
  return J({
    fecha, hora: now.toFormat('HH:mm'), slots: SLOTS, personas, tableros, causas,
    hxh: hxh.map((r) => ({ linea_id: r.linea_id, slot: r.hora_slot, real: r.real == null ? null : Number(r.real), plan: r.plan == null ? null : Number(r.plan), sin_dato: r.sin_dato, origen: r.origen, por: r.capturado_por || r.reporto || null })),
    resumen: { puras, manual, sind },
  });
}

// ===================== PÁGINA (SPA) =====================
const PAGE = [
'<!doctype html><html lang="es"><head><meta charset="utf-8">',
'<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f6f6f8">',
'<title>Horacio · Panel</title>',
'<style>',
':root{--bg:#f6f6f8;--card:#fff;--bd:#ececf0;--tx:#18181b;--mut:#71717a;--accent:#7c3aed;--accent2:#a78bfa;--ok:#16a34a;--okbg:#e9f7ef;--blue:#2563eb;--bluebg:#e8effc;--bad:#dc2626;--grayc:#9ca3af;--shadow:0 1px 2px rgba(24,24,27,.04),0 4px 16px rgba(24,24,27,.05)}',
'*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}',
'header{position:sticky;top:0;z-index:5;background:rgba(246,246,248,.85);backdrop-filter:saturate(180%) blur(10px);-webkit-backdrop-filter:saturate(180%) blur(10px);border-bottom:1px solid var(--bd);padding:12px 18px;display:flex;align-items:center;gap:10px}',
'header .brand{display:flex;align-items:center;gap:9px}header h1{font-size:16px;margin:0;font-weight:650;letter-spacing:-.01em}header .dot{color:var(--mut);font-weight:400}',
'header .who{margin-left:auto;font-size:13px;color:var(--mut);display:flex;align-items:center;gap:8px}',
'header .who b{color:var(--accent)}',
'.btn{border:1px solid var(--bd);background:#fff;color:var(--tx);border-radius:9px;padding:7px 12px;font-size:13px;font-weight:600;cursor:pointer}',
'.btn:hover{border-color:#d4d4d8}.btn.primary{background:var(--accent);color:#fff;border-color:var(--accent)}.btn.sm{padding:4px 9px;font-size:12px}',
'.wrap{padding:16px;max-width:1200px;margin:0 auto}',
'.tabs{display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap}',
'.tab{border:1px solid var(--bd);background:#fff;border-radius:99px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer;color:var(--mut)}',
'.tab.on{background:var(--accent);color:#fff;border-color:var(--accent)}',
'.card{background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:16px;margin-bottom:16px;box-shadow:var(--shadow)}',
'.card h2{font-size:12px;margin:0 0 12px;color:var(--mut);text-transform:uppercase;letter-spacing:.06em;font-weight:600}',
'.muted{color:var(--mut);font-size:12px}.row{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}',
'label{display:block;font-size:12px;color:var(--mut);margin-bottom:4px}',
'select,input{font:inherit;font-size:14px;padding:8px 10px;border:1px solid var(--bd);border-radius:9px;background:#fff;color:var(--tx);max-width:100%}',
'.field{display:flex;flex-direction:column;min-width:120px}',
'.matwrap{overflow-x:auto}table.mat{border-collapse:separate;border-spacing:0;font-size:12px;min-width:560px}',
'table.mat th,table.mat td{padding:6px;border-bottom:1px solid var(--bd);text-align:center;white-space:nowrap}',
'table.mat th.lh,table.mat td.lh{text-align:left;position:sticky;left:0;background:#fff;font-weight:600;max-width:190px;overflow:hidden;text-overflow:ellipsis}',
'table.mat thead th{color:var(--mut);font-weight:600;font-size:11px}',
'.cell{display:inline-block;min-width:46px;padding:5px 4px;border-radius:7px;cursor:default;font-variant-numeric:tabular-nums}',
'.c-lider{background:var(--okbg);color:#0f7a37}.c-manual{background:var(--bluebg);color:#1e40af}.c-sd{background:#f1f1f3;color:#9ca3af}.c-falta{background:#fff;color:#c4c4c8;border:1px dashed #dcdce0;cursor:pointer}.c-falta:hover{border-color:var(--accent);color:var(--accent)}',
'.grp{font-size:11px;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;padding:10px 6px 4px;text-align:left;font-weight:700}',
'.legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;font-size:12px;color:var(--mut)}.legend span{display:inline-flex;align-items:center;gap:5px}.dotc{width:11px;height:11px;border-radius:3px;display:inline-block}',
'.kpis{display:flex;gap:18px;flex-wrap:wrap;margin-bottom:6px}.kpis .v{font-size:22px;font-weight:680;font-variant-numeric:tabular-nums}.kpis .l{color:var(--mut);font-size:12px}',
'.tline{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--bd);font-size:14px}.tline:last-child{border:0}',
'.foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:8px;color:var(--mut);font-size:12px;flex-wrap:wrap}.foot .pw{display:flex;align-items:center;gap:6px;color:#52525b}.foot .pw b{color:var(--accent);font-weight:700}',
'#toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);background:#18181b;color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;opacity:0;pointer-events:none;transition:opacity .2s;z-index:30;max-width:90%}#toast.show{opacity:1}',
'#gate{position:fixed;inset:0;background:rgba(246,246,248,.96);z-index:40;display:none;align-items:center;justify-content:center;padding:20px}#gate .box{background:#fff;border:1px solid var(--bd);border-radius:18px;box-shadow:var(--shadow);padding:22px;max-width:420px;width:100%}',
'#gate h3{margin:0 0 4px;font-size:18px}#gate .glist{display:flex;flex-direction:column;gap:8px;margin-top:14px;max-height:50vh;overflow:auto}',
'#gate .gitem{display:flex;justify-content:space-between;border:1px solid var(--bd);border-radius:10px;padding:10px 12px;cursor:pointer;font-size:14px}#gate .gitem:hover{border-color:var(--accent);background:#faf7ff}#gate .gitem span{color:var(--mut);font-size:12px}',
'</style></head><body>',
'<header><span class="brand"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="5.5" width="13" height="13" rx="3" transform="rotate(45 12 12)" fill="#7c3aed"/></svg><h1>Horacio <span class="dot">· Panel de captura</span></h1></span>',
'<span class="who" id="who"></span></header>',
'<div class="wrap">',
'<div class="muted" id="sub" style="margin-bottom:10px">cargando…</div>',
'<div class="tabs" id="tabs"></div>',
'<div id="view"></div>',
'<div class="foot"><span>Panel operativo · escrituras firmadas con tu nombre</span><span class="pw">powered by <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="5.5" width="13" height="13" rx="3" transform="rotate(45 12 12)" fill="#7c3aed"/></svg><b>NexIA</b></span></div>',
'</div>',
'<div id="toast"></div>',
'<div id="gate"><div class="box"><h3>¿Quién eres?</h3><div class="muted">Tus registros manuales quedarán firmados con tu nombre.</div><div class="glist" id="glist"></div></div></div>',
'<script>',
'var TK=new URLSearchParams(location.search).get("token")||"";',
'var BY=localStorage.getItem("panel_by")||"";',
'var ST=null, TAB="captura", PRE=null;',
'function tj(s){var t=document.getElementById("toast");t.textContent=s;t.className="show";setTimeout(function(){t.className="";},2600);}',
'function h(s){return String(s==null?"":s).replace(/[&<>\\"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c];});}',
'function setWho(){document.getElementById("who").innerHTML = BY ? ("Eres: <b>"+h(BY)+"</b> <button class=\\"btn sm\\" onclick=\\"openGate()\\">cambiar</button>") : "<button class=\\"btn sm\\" onclick=\\"openGate()\\">identifícate</button>";}',
'function openGate(){var g=document.getElementById("gate");var L=document.getElementById("glist");if(!ST){g.style.display="flex";L.innerHTML="<div class=\\"muted\\">cargando…</div>";return;}',
'  L.innerHTML=ST.personas.map(function(p){return "<div class=\\"gitem\\" onclick=\\"pickBy(\\x27"+h(p.nombre).replace(/\\x27/g,"")+"\\x27)\\">"+h(p.nombre)+"<span>"+h(p.rol)+"</span></div>";}).join("");',
'  g.style.display="flex";}',
'function pickBy(n){BY=n;localStorage.setItem("panel_by",n);document.getElementById("gate").style.display="none";setWho();}',
'async function load(){',
'  try{var r=await fetch(location.pathname+"?token="+encodeURIComponent(TK)+"&data=1",{cache:"no-store"});var txt=await r.text();',
'   if(!r.ok){document.getElementById("sub").textContent="error HTTP "+r.status;return;}',
'   try{ST=JSON.parse(txt);}catch(e){document.getElementById("sub").textContent="respuesta no válida (¿token?)";return;}',
'   document.getElementById("sub").textContent=ST.fecha+" · "+ST.hora+" (MX) · "+ST.resumen.puras+" de líder · "+ST.resumen.manual+" manual · "+ST.resumen.sind+" sin dato";',
'   setWho();render();',
'  }catch(e){document.getElementById("sub").textContent="error: "+e.message;}',
'}',
'async function post(payload){payload.token=TK;payload.by=BY;var r=await fetch(location.pathname,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});var d=await r.json();return d;}',
'function tabs(){var ts=[["captura","Captura en vivo"],["registrar","Registrar hora"],["tableros","Tableros"],["asignar","Asignar líder"]];',
'  document.getElementById("tabs").innerHTML=ts.map(function(t){return "<div class=\\"tab"+(TAB==t[0]?" on":"")+"\\" onclick=\\"go(\\x27"+t[0]+"\\x27)\\">"+t[1]+"</div>";}).join("");}',
'function go(t){TAB=t;tabs();render();}',
'function cellKey(l,s){return l+"|"+s;}',
'function buildMap(){var m={};ST.hxh.forEach(function(r){var k=cellKey(r.linea_id,r.slot);var prev=m[k];if(!prev||(prev.sin_dato&&!r.sin_dato))m[k]=r;});return m;}',
'function render(){tabs();var v=document.getElementById("view");',
'  if(TAB=="captura")return renderMatriz(v);',
'  if(TAB=="registrar")return renderReg(v);',
'  if(TAB=="tableros")return renderTableros(v);',
'  if(TAB=="asignar")return renderAsignar(v);}',
'function renderMatriz(v){var m=buildMap();var grp=null;var rows="";',
'  ST.tableros.forEach(function(t){if(t.grupo!=grp){grp=t.grupo;rows+="<tr><td class=\\"lh grp\\" colspan=\\""+(ST.slots.length+1)+"\\">"+h(grp)+"</td></tr>";}',
'   var tds="";ST.slots.forEach(function(s){var c=m[cellKey(t.id,s)];var cls="c-falta",txt="+",ti="registrar";',
'     if(c){if(c.sin_dato){cls="c-sd";txt="⛔";ti="sin dato";}else if(c.origen=="panel_manual"){cls="c-manual";txt=(c.real==null?"✓":c.real);ti="manual · "+(c.por||"?");}else{cls="c-lider";txt=(c.real==null?"✓":c.real);ti="líder · "+(c.por||"?");}}',
'     var clickable=(!c||c.sin_dato);var oc=clickable?(" onclick=\\"preReg(\\x27"+t.id+"\\x27,\\x27"+s+"\\x27)\\""):"";',
'     tds+="<td><span class=\\"cell "+cls+"\\" title=\\""+ti+"\\""+oc+">"+txt+"</span></td>";});',
'   rows+="<tr><td class=\\"lh\\" title=\\""+h(t.nombre)+"\\">"+h(t.nombre)+"<div class=\\"muted\\">"+h(t.lider||"sin líder")+"</div></td>"+tds+"</tr>";});',
'  var head="<tr><th class=\\"lh\\">Tablero</th>"+ST.slots.map(function(s){return "<th>"+s.slice(0,5)+"</th>";}).join("")+"</tr>";',
'  v.innerHTML="<div class=\\"card\\"><h2>Captura del día — "+h(ST.fecha)+"</h2><div class=\\"matwrap\\"><table class=\\"mat\\"><thead>"+head+"</thead><tbody>"+rows+"</tbody></table></div>"+',
'   "<div class=\\"legend\\"><span><i class=\\"dotc\\" style=\\"background:#e9f7ef\\"></i>de líder (Telegram)</span><span><i class=\\"dotc\\" style=\\"background:#e8effc\\"></i>manual (panel)</span><span><i class=\\"dotc\\" style=\\"background:#f1f1f3\\"></i>sin dato</span><span><i class=\\"dotc\\" style=\\"border:1px dashed #dcdce0\\"></i>falta — toca para registrar</span></div></div>";}',
'function preReg(lid,slot){PRE={linea_id:lid,slot:slot};go("registrar");}',
'function boardOpts(sel){return ST.tableros.map(function(t){return "<option value=\\""+t.id+"\\""+(sel==t.id?" selected":"")+">"+h(t.nombre)+"</option>";}).join("");}',
'function slotOpts(sel){return ST.slots.map(function(s){return "<option"+(sel==s?" selected":"")+">"+s+"</option>";}).join("");}',
'function renderReg(v){if(!BY){v.innerHTML="<div class=\\"card\\"><div class=\\"muted\\">Primero identifícate (botón arriba a la derecha).</div></div>";return;}',
'  var pl=PRE||{};var causas="<option value=\\"\\">— sin causa —</option>"+ST.causas.map(function(c){return "<option value=\\""+c.codigo+"\\">"+h(c.boton_texto)+"</option>";}).join("");',
'  v.innerHTML="<div class=\\"card\\"><h2>Registrar una hora no capturada</h2>"+',
'   "<div class=\\"row\\"><div class=\\"field\\"><label>Tablero</label><select id=\\"r_b\\">"+boardOpts(pl.linea_id)+"</select></div>"+',
'   "<div class=\\"field\\"><label>Hora (ventana)</label><select id=\\"r_s\\">"+slotOpts(pl.slot)+"</select></div>"+',
'   "<div class=\\"field\\"><label>Piezas</label><input id=\\"r_p\\" inputmode=\\"numeric\\" placeholder=\\"0\\" style=\\"width:90px\\"></div>"+',
'   "<div class=\\"field\\"><label>Causa (opcional)</label><select id=\\"r_c\\">"+causas+"</select></div>"+',
'   "<div class=\\"field\\" style=\\"flex:1;min-width:160px\\"><label>Nota / motivo (opcional)</label><input id=\\"r_n\\" placeholder=\\"p.ej. la líder no tuvo señal\\"></div>"+',
'   "<button class=\\"btn primary\\" onclick=\\"doReg()\\">Registrar</button></div>"+',
'   "<div class=\\"muted\\" style=\\"margin-top:10px\\">Quedará firmado: origen <b>manual</b> · por <b>"+h(BY)+"</b>. No se manda nada por Telegram.</div></div>";PRE=null;}',
'async function doReg(){var b=document.getElementById("r_b").value,s=document.getElementById("r_s").value,p=document.getElementById("r_p").value,c=document.getElementById("r_c").value,n=document.getElementById("r_n").value;',
'  if(!p&&p!=="0"){tj("Escribe las piezas");return;}var d=await post({action:"backfill",linea_id:b,slot:s,real:p,causa:c,nota:n});if(d.ok){tj("Registrado ✓");await load();go("captura");}else tj(d.error||"no se pudo");}',
'function renderTableros(v){var rows=ST.tableros.map(function(t){return tboardRow(t);}).join("");',
'  v.innerHTML="<div class=\\"card\\"><h2>Tableros activos</h2><div id=\\"tlist\\">"+rows+"</div></div>"+',
'   "<div class=\\"card\\"><h2>Nuevo tablero</h2><div class=\\"row\\">"+',
'   "<div class=\\"field\\"><label>Nombre</label><input id=\\"n_nom\\" placeholder=\\"p.ej. Empaque\\"></div>"+',
'   "<div class=\\"field\\"><label>Grupo</label><input id=\\"n_grp\\" placeholder=\\"CONFORMAL\\"></div>"+',
'   "<div class=\\"field\\"><label>Unidad</label><input id=\\"n_uni\\" value=\\"piezas\\" style=\\"width:100px\\"></div>"+',
'   "<div class=\\"field\\"><label>Captura</label><select id=\\"n_cap\\"><option value=\\"conteo\\">conteo</option><option value=\\"tarjetas\\">tarjetas</option></select></div>"+',
'   "<div class=\\"field\\"><label>Supervisor</label>"+rolSel("n_sup","paros")+"</div>"+',
'   "<div class=\\"field\\"><label>Líder</label>"+personaSel("n_lid","")+"</div>"+',
'   "<button class=\\"btn primary\\" onclick=\\"doCreate()\\">Crear</button></div></div>";}',
'function tboardRow(t){return "<div class=\\"tline\\"><div><b>"+h(t.nombre)+"</b> <span class=\\"muted\\">"+h(t.grupo)+" · "+h(t.unidad)+" · "+h(t.captura)+" · sup "+h(t.supervisor_rol)+"</span></div>"+',
'  "<button class=\\"btn sm\\" onclick=\\"editBoard(\\x27"+t.id+"\\x27)\\">editar</button></div>";}',
'function editBoard(id){var t=ST.tableros.filter(function(x){return x.id==id;})[0];if(!t)return;',
'  var html="<div class=\\"row\\"><div class=\\"field\\"><label>Nombre</label><input id=\\"e_nom\\" value=\\""+h(t.nombre)+"\\"></div>"+',
'   "<div class=\\"field\\"><label>Grupo</label><input id=\\"e_grp\\" value=\\""+h(t.grupo)+"\\"></div>"+',
'   "<div class=\\"field\\"><label>Unidad</label><input id=\\"e_uni\\" value=\\""+h(t.unidad)+"\\" style=\\"width:100px\\"></div>"+',
'   "<div class=\\"field\\"><label>Captura</label><select id=\\"e_cap\\"><option value=\\"conteo\\""+(t.captura!="tarjetas"?" selected":"")+">conteo</option><option value=\\"tarjetas\\""+(t.captura=="tarjetas"?" selected":"")+">tarjetas</option></select></div>"+',
'   "<div class=\\"field\\"><label>Supervisor</label>"+rolSel("e_sup",t.supervisor_rol)+"</div>"+',
'   "<button class=\\"btn primary sm\\" onclick=\\"doUpdate(\\x27"+id+"\\x27)\\">Guardar</button> <button class=\\"btn sm\\" onclick=\\"doDeactivate(\\x27"+id+"\\x27)\\">desactivar</button></div>";',
'  event.target.parentNode.outerHTML="<div class=\\"tline\\" style=\\"display:block\\">"+html+"</div>";}',
'function rolSel(id,sel){var R=["paros","faltantes","calidad","mantenimiento","direccion"];return "<select id=\\""+id+"\\">"+R.map(function(r){return "<option"+(sel==r?" selected":"")+">"+r+"</option>";}).join("")+"</select>";}',
'function personaSel(id,sel){return "<select id=\\""+id+"\\"><option value=\\"\\">— sin líder —</option>"+ST.personas.map(function(p){return "<option value=\\""+p.id+"\\""+(sel==p.id?" selected":"")+">"+h(p.nombre)+"</option>";}).join("")+"</select>";}',
'async function doCreate(){var nom=document.getElementById("n_nom").value;if(!nom){tj("Falta el nombre");return;}',
'  var d=await post({action:"create_board",nombre:nom,grupo:document.getElementById("n_grp").value,unidad:document.getElementById("n_uni").value,captura:document.getElementById("n_cap").value,supervisor_rol:document.getElementById("n_sup").value,lider_persona_id:document.getElementById("n_lid").value});',
'  if(d.ok){tj("Tablero creado ✓");await load();render();}else tj(d.error||"no se pudo");}',
'async function doUpdate(id){var d=await post({action:"update_board",linea_id:id,nombre:document.getElementById("e_nom").value,grupo:document.getElementById("e_grp").value,unidad:document.getElementById("e_uni").value,captura:document.getElementById("e_cap").value,supervisor_rol:document.getElementById("e_sup").value});',
'  if(d.ok){tj("Guardado ✓");await load();render();}else tj(d.error||"no se pudo");}',
'async function doDeactivate(id){if(!confirm("¿Desactivar este tablero? Deja de pinguearse (el historial se conserva)."))return;var d=await post({action:"update_board",linea_id:id,activa:false});if(d.ok){tj("Desactivado ✓");await load();render();}else tj(d.error||"no se pudo");}',
'function renderAsignar(v){var rows=ST.tableros.map(function(t){return "<div class=\\"tline\\"><div><b>"+h(t.nombre)+"</b> <span class=\\"muted\\">"+h(t.grupo)+"</span></div><div>"+personaSel("a_"+t.id,t.lider_persona_id||"")+" <button class=\\"btn sm\\" onclick=\\"doAssign(\\x27"+t.id+"\\x27)\\">asignar</button></div></div>";}).join("");',
'  v.innerHTML="<div class=\\"card\\"><h2>Asignar / reasignar líder por tablero</h2>"+rows+"</div>";}',
'async function doAssign(id){var pid=document.getElementById("a_"+id).value;var d=await post({action:"assign_board",linea_id:id,lider_persona_id:pid});if(d.ok){tj("Líder asignado ✓");await load();render();}else tj(d.error||"no se pudo");}',
'setWho();load();setInterval(load,30000);',
'if(!BY)setTimeout(openGate,400);',
'</script></body></html>'
].join('');
return [{ json: { body: PAGE, contentType: 'text/html; charset=utf-8' } }];
