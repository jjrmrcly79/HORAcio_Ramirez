// ============================================================
// Horacio — Panel de captura (nodo Code único) · con LOGIN por PIN
// Workflow n8n: "Horacio - Panel" · Webhook GET+POST /horacio-panel
//   GET  ?token=URL                 -> HTML (SPA, Powered by NexIA)
//   GET  ?token=URL&data=who        -> lista de personas (para el login)
//   GET  ?token=URL&data=1&s=SESION -> estado del día (requiere sesión)
//   POST {token,action,...}         -> login / set_own_pin / set_pin / escrituras
// Auth: login (nombre+PIN) -> token de sesión opaco (panel_sesiones, 12 h).
//   PIN bcrypt (pgcrypto). Admin asigna/resetea PIN. 1er admin sin PIN lo crea.
//   Toda escritura firma capturado_por = nombre de la SESIÓN (verificado).
// Reemplaza <SERVICE_ROLE_KEY> y <PANEL_TOKEN> en n8n (nunca en el repo).
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
const SLOTS = []; for (let h = 7; h <= 15; h++) SLOTS.push(winClose(h));
const ROLES = ['paros', 'faltantes', 'calidad', 'mantenimiento', 'direccion'];
const isPin = (s) => /^[0-9]{4,8}$/.test(String(s || ''));

const inp = $input.first().json;
const q = inp.query || {};
const body = inp.body || {};
const isPost = !!(body && body.action);
const token = (isPost ? body.token : q.token) || '';
const J = (o) => [{ json: { body: JSON.stringify(o), contentType: 'application/json; charset=utf-8' } }];

if (token !== TOKEN) {
  if (isPost || q.data) return J({ ok: false, error: 'no autorizado' });
  return [{ json: { body: 'No autorizado', contentType: 'text/plain; charset=utf-8' } }];
}

const now = nowMX();
const fecha = now.toFormat('yyyy-LL-dd');
const getSession = async (t) => {
  if (!t) return null;
  const r = await pg(`SELECT s.persona_id, s.es_admin, s.nombre FROM horacio.panel_sesiones s WHERE s.token='${esc(t)}' AND s.expira>now() LIMIT 1`);
  return r.length ? r[0] : null;
};
const newSession = async (pid, nombre, esAdmin) => {
  const tk = (await pg(`SELECT encode(gen_random_bytes(24),'hex') AS t`))[0].t;
  await pg(`INSERT INTO horacio.panel_sesiones(token,persona_id,nombre,es_admin,expira) VALUES('${tk}','${esc(pid)}','${esc(nombre)}',${esAdmin ? 'true' : 'false'},now()+interval '12 hours')`);
  return tk;
};

// ===================== ESCRITURAS / AUTH (POST) =====================
if (isPost) {
  const act = body.action;
  try {
    if (act === 'login') {
      const pid = String(body.persona_id || ''), pin = String(body.pin || '');
      const pr = await pg(`SELECT id, nombre, es_admin, (pin_hash IS NOT NULL) AS has_pin, (pin_bloqueo_ts IS NOT NULL AND pin_bloqueo_ts>now()) AS bloq FROM horacio.personas WHERE id='${esc(pid)}' AND activa`);
      if (!pr.length) return J({ ok: false, error: 'Persona no encontrada.' });
      const P = pr[0];
      if (!P.has_pin) return J({ ok: false, code: 'no_pin', es_admin: P.es_admin });
      if (P.bloq) return J({ ok: false, error: 'Demasiados intentos. Espera unos minutos.' });
      if (!isPin(pin)) return J({ ok: false, error: 'PIN inválido.' });
      const okr = await pg(`SELECT (pin_hash=crypt('${esc(pin)}',pin_hash)) AS ok FROM horacio.personas WHERE id='${esc(pid)}'`);
      if (!okr.length || !okr[0].ok) {
        await pg(`UPDATE horacio.personas SET pin_intentos=pin_intentos+1, pin_bloqueo_ts=CASE WHEN pin_intentos+1>=5 THEN now()+interval '15 min' ELSE pin_bloqueo_ts END WHERE id='${esc(pid)}'`);
        return J({ ok: false, error: 'PIN incorrecto.' });
      }
      await pg(`DELETE FROM horacio.panel_sesiones WHERE expira<now()`);
      await pg(`UPDATE horacio.personas SET pin_intentos=0, pin_bloqueo_ts=NULL WHERE id='${esc(pid)}'`);
      const tk = await newSession(pid, P.nombre, P.es_admin);
      return J({ ok: true, session: tk, nombre: P.nombre, es_admin: P.es_admin });
    }
    if (act === 'set_own_pin') { // bootstrap: solo un admin SIN pin
      const pid = String(body.persona_id || ''), pin = String(body.pin || '');
      if (!isPin(pin)) return J({ ok: false, error: 'El PIN debe ser de 4 a 8 dígitos.' });
      const pr = await pg(`SELECT nombre, es_admin, (pin_hash IS NOT NULL) AS has_pin FROM horacio.personas WHERE id='${esc(pid)}' AND activa`);
      if (!pr.length) return J({ ok: false, error: 'Persona no encontrada.' });
      if (!pr[0].es_admin || pr[0].has_pin) return J({ ok: false, error: 'No puedes crear este PIN. Pídeselo a un admin.' });
      await pg(`UPDATE horacio.personas SET pin_hash=crypt('${esc(pin)}',gen_salt('bf')), pin_intentos=0, pin_bloqueo_ts=NULL WHERE id='${esc(pid)}'`);
      const tk = await newSession(pid, pr[0].nombre, true);
      return J({ ok: true, session: tk, nombre: pr[0].nombre, es_admin: true });
    }
    // ---- de aquí en adelante: requiere sesión válida ----
    const S = await getSession(body.session);
    if (!S) return J({ ok: false, code: 'auth', error: 'Inicia sesión.' });
    if (act === 'logout') { await pg(`DELETE FROM horacio.panel_sesiones WHERE token='${esc(body.session)}'`); return J({ ok: true }); }
    if (act === 'set_pin') { // admin asigna/resetea PIN a alguien
      if (!S.es_admin) return J({ ok: false, error: 'Solo un admin puede asignar PIN.' });
      const pid = String(body.persona_id || ''), pin = String(body.pin || '');
      if (!isPin(pin)) return J({ ok: false, error: 'El PIN debe ser de 4 a 8 dígitos.' });
      const pr = await pg(`SELECT id FROM horacio.personas WHERE id='${esc(pid)}' AND activa`);
      if (!pr.length) return J({ ok: false, error: 'Persona no encontrada.' });
      await pg(`UPDATE horacio.personas SET pin_hash=crypt('${esc(pin)}',gen_salt('bf')), pin_intentos=0, pin_bloqueo_ts=NULL WHERE id='${esc(pid)}'`);
      return J({ ok: true });
    }
    if (act === 'toggle_admin') {
      if (!S.es_admin) return J({ ok: false, error: 'Solo un admin.' });
      const pid = String(body.persona_id || '');
      if (pid === String(S.persona_id) && !body.es_admin) return J({ ok: false, error: 'No te quites a ti mismo el admin.' });
      await pg(`UPDATE horacio.personas SET es_admin=${body.es_admin ? 'true' : 'false'} WHERE id='${esc(pid)}'`);
      return J({ ok: true });
    }
    const by = S.nombre; // firma verificada por la sesión
    if (act === 'backfill') {
      const lid = String(body.linea_id || ''), slot = String(body.slot || '');
      const real = parseInt(String(body.real == null ? '' : body.real).replace(/[^0-9]/g, ''), 10);
      if (!lid || SLOTS.indexOf(slot) < 0) return J({ ok: false, error: 'Tablero u hora inválidos.' });
      if (isNaN(real) || real < 0 || real > 100000) return J({ ok: false, error: 'Piezas inválidas (0–100000).' });
      const ln = await pg(`SELECT id FROM horacio.lineas WHERE id='${esc(lid)}' AND activa`);
      if (!ln.length) return J({ ok: false, error: 'Tablero no existe.' });
      const ya = await pg(`SELECT 1 FROM horacio.hora_por_hora WHERE linea_id='${esc(lid)}' AND fecha='${fecha}' AND hora_slot='${esc(slot)}' AND NOT sin_dato LIMIT 1`);
      if (ya.length) return J({ ok: false, error: 'Esa hora ya está capturada.' });
      const causa = body.causa ? `'${esc(String(body.causa))}'` : 'NULL';
      const meta = await pg(`SELECT meta_hr FROM horacio.ordenes_tablero WHERE linea_id='${esc(lid)}' AND fecha='${fecha}' AND vigente ORDER BY ts DESC LIMIT 1`);
      const plan = (meta.length && meta[0].meta_hr != null) ? Number(meta[0].meta_hr) : null;
      const nota = body.nota ? `'${esc(String(body.nota).slice(0, 300))}'` : 'NULL';
      await pg(`INSERT INTO horacio.hora_por_hora(linea_id,fecha,hora_slot,plan,real,t_productivo_min,causa_codigo,origen,capturado_por,nota) VALUES('${esc(lid)}','${fecha}','${esc(slot)}',${plan == null ? 'NULL' : plan},${real},60,${causa},'panel_manual','${esc(by)}',${nota})`);
      return J({ ok: true });
    }
    if (act === 'create_board') {
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

// ===================== LECTURAS (GET) =====================
if (q.data === 'who') {
  const personas = await pg("SELECT id, nombre, rol, es_admin, (pin_hash IS NOT NULL) AS has_pin FROM horacio.personas WHERE activa ORDER BY (rol='lider') DESC, rol, nombre");
  return J({ personas });
}
if (q.data === '1') {
  const S = await getSession(q.s);
  if (!S) return J({ ok: false, code: 'auth' });
  const personas = await pg("SELECT id, nombre, rol, es_admin, (pin_hash IS NOT NULL) AS has_pin FROM horacio.personas WHERE activa ORDER BY (rol='lider') DESC, rol, nombre");
  const tableros = await pg("SELECT l.id, l.codigo, l.nombre, l.grupo, l.orden, l.unidad, l.captura, l.supervisor_rol, l.lider_persona_id, p.nombre AS lider FROM horacio.lineas l LEFT JOIN horacio.personas p ON p.id=l.lider_persona_id WHERE l.activa ORDER BY l.grupo, l.orden");
  const causas = await pg("SELECT codigo, boton_texto FROM horacio.causas_paro WHERE activa ORDER BY orden");
  const hxh = await pg(`SELECT h.linea_id, h.hora_slot, h.real, h.plan, h.sin_dato, h.origen, h.capturado_por, pr.nombre AS reporto FROM horacio.hora_por_hora h LEFT JOIN horacio.personas pr ON pr.chat_id=h.reporto_chat_id WHERE h.fecha='${fecha}' ORDER BY h.ts`);
  let puras = 0, manual = 0, sind = 0;
  hxh.forEach((r) => { if (r.sin_dato) sind++; else if (r.origen === 'panel_manual') manual++; else puras++; });
  return J({
    fecha, hora: now.toFormat('HH:mm'), slots: SLOTS, personas, tableros, causas,
    hxh: hxh.map((r) => ({ linea_id: r.linea_id, slot: r.hora_slot, real: r.real == null ? null : Number(r.real), plan: r.plan == null ? null : Number(r.plan), sin_dato: r.sin_dato, origen: r.origen, por: r.capturado_por || r.reporto || null })),
    resumen: { puras, manual, sind }, me: { nombre: S.nombre, es_admin: S.es_admin },
  });
}

// ===================== PÁGINA (SPA) =====================
const PAGE = [
'<!doctype html><html lang="es"><head><meta charset="utf-8">',
'<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f6f6f8">',
'<title>Horacio · Panel</title>',
'<style>',
':root{--bg:#f6f6f8;--card:#fff;--bd:#ececf0;--tx:#18181b;--mut:#71717a;--accent:#7c3aed;--ok:#16a34a;--okbg:#e9f7ef;--bluebg:#e8effc;--bad:#dc2626;--shadow:0 1px 2px rgba(24,24,27,.04),0 4px 16px rgba(24,24,27,.05)}',
'*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}',
'header{position:sticky;top:0;z-index:5;background:rgba(246,246,248,.85);backdrop-filter:saturate(180%) blur(10px);-webkit-backdrop-filter:saturate(180%) blur(10px);border-bottom:1px solid var(--bd);padding:12px 18px;display:flex;align-items:center;gap:10px}',
'header .brand{display:flex;align-items:center;gap:9px}header h1{font-size:16px;margin:0;font-weight:650;letter-spacing:-.01em}header .dot{color:var(--mut);font-weight:400}',
'header .who{margin-left:auto;font-size:13px;color:var(--mut);display:flex;align-items:center;gap:8px}header .who b{color:var(--accent)}',
'.btn{border:1px solid var(--bd);background:#fff;color:var(--tx);border-radius:9px;padding:7px 12px;font-size:13px;font-weight:600;cursor:pointer}.btn:hover{border-color:#d4d4d8}.btn.primary{background:var(--accent);color:#fff;border-color:var(--accent)}.btn.sm{padding:4px 9px;font-size:12px}',
'.wrap{padding:16px;max-width:1200px;margin:0 auto}',
'.tabs{display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap}.tab{border:1px solid var(--bd);background:#fff;border-radius:99px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer;color:var(--mut)}.tab.on{background:var(--accent);color:#fff;border-color:var(--accent)}',
'.card{background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:16px;margin-bottom:16px;box-shadow:var(--shadow)}.card h2{font-size:12px;margin:0 0 12px;color:var(--mut);text-transform:uppercase;letter-spacing:.06em;font-weight:600}',
'.muted{color:var(--mut);font-size:12px}.row{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}label{display:block;font-size:12px;color:var(--mut);margin-bottom:4px}',
'select,input{font:inherit;font-size:14px;padding:8px 10px;border:1px solid var(--bd);border-radius:9px;background:#fff;color:var(--tx);max-width:100%}.field{display:flex;flex-direction:column;min-width:120px}',
'.matwrap{overflow-x:auto}table.mat{border-collapse:separate;border-spacing:0;font-size:12px;min-width:560px}table.mat th,table.mat td{padding:6px;border-bottom:1px solid var(--bd);text-align:center;white-space:nowrap}table.mat th.lh,table.mat td.lh{text-align:left;position:sticky;left:0;background:#fff;font-weight:600;max-width:190px;overflow:hidden;text-overflow:ellipsis}table.mat thead th{color:var(--mut);font-weight:600;font-size:11px}',
'.cell{display:inline-block;min-width:46px;padding:5px 4px;border-radius:7px;font-variant-numeric:tabular-nums}.c-lider{background:var(--okbg);color:#0f7a37}.c-manual{background:var(--bluebg);color:#1e40af}.c-sd{background:#f1f1f3;color:#9ca3af}.c-falta{background:#fff;color:#c4c4c8;border:1px dashed #dcdce0;cursor:pointer}.c-falta:hover{border-color:var(--accent);color:var(--accent)}',
'.grp{font-size:11px;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;padding:10px 6px 4px;text-align:left;font-weight:700}',
'.legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;font-size:12px;color:var(--mut)}.legend span{display:inline-flex;align-items:center;gap:5px}.dotc{width:11px;height:11px;border-radius:3px;display:inline-block}',
'.tline{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--bd);font-size:14px}.tline:last-child{border:0}',
'.pill{font-size:11px;font-weight:700;color:#7c3aed;background:#f3eefc;border-radius:99px;padding:2px 8px}.pill.no{color:#b45309;background:#fef3c7}',
'.foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:8px;color:var(--mut);font-size:12px;flex-wrap:wrap}.foot .pw{display:flex;align-items:center;gap:6px;color:#52525b}.foot .pw b{color:var(--accent);font-weight:700}',
'#toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);background:#18181b;color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;opacity:0;pointer-events:none;transition:opacity .2s;z-index:60;max-width:90%}#toast.show{opacity:1}',
'#gate{position:fixed;inset:0;background:rgba(246,246,248,.97);z-index:40;display:flex;align-items:center;justify-content:center;padding:20px}#gate .box{background:#fff;border:1px solid var(--bd);border-radius:18px;box-shadow:var(--shadow);padding:22px;max-width:420px;width:100%}',
'#gate h3{margin:0 0 4px;font-size:18px}#gate .glist{display:flex;flex-direction:column;gap:8px;margin-top:14px;max-height:50vh;overflow:auto}#gate .gitem{display:flex;justify-content:space-between;align-items:center;border:1px solid var(--bd);border-radius:10px;padding:10px 12px;cursor:pointer;font-size:14px}#gate .gitem:hover{border-color:var(--accent);background:#faf7ff}#gate .gitem span{color:var(--mut);font-size:12px}',
'#gate input.pin{width:100%;text-align:center;letter-spacing:6px;font-size:20px;margin-top:12px}',
'</style></head><body>',
'<header><span class="brand"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="5.5" width="13" height="13" rx="3" transform="rotate(45 12 12)" fill="#7c3aed"/></svg><h1>Horacio <span class="dot">· Panel de captura</span></h1></span>',
'<span class="who" id="who"></span></header>',
'<div class="wrap"><div class="muted" id="sub" style="margin-bottom:10px">cargando…</div>',
'<div class="tabs" id="tabs"></div><div id="view"></div>',
'<div class="foot"><span>Panel operativo · escrituras firmadas con tu sesión</span><span class="pw">powered by <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="5.5" width="13" height="13" rx="3" transform="rotate(45 12 12)" fill="#7c3aed"/></svg><b>NexIA</b></span></div></div>',
'<div id="toast"></div><div id="gate"></div>',
'<script>',
'var TK=new URLSearchParams(location.search).get("token")||"";',
'var MEM={};function ssGet(k){try{return sessionStorage.getItem(k)||MEM[k]||"";}catch(e){return MEM[k]||"";}}function ssSet(k,v){MEM[k]=v;try{sessionStorage.setItem(k,v);}catch(e){}}function ssDel(k){MEM[k]="";try{sessionStorage.removeItem(k);}catch(e){}}',
'var S=ssGet("panel_s"), ME=null, ST=null, TAB="captura", PRE=null, WHO=null, GP=null;',
'function tj(s){var t=document.getElementById("toast");t.textContent=s;t.className="show";setTimeout(function(){t.className="";},2800);}',
'function h(s){return String(s==null?"":s).replace(/[&<>\\"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c];});}',
'function api(payload){payload.token=TK;return fetch(location.pathname,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)}).then(function(r){return r.json();});}',
'function post(payload){payload.session=S;return api(payload);}',
// ----- login gate -----
'async function showLogin(){var g=document.getElementById("gate");g.style.display="flex";',
'  if(!WHO){try{var r=await fetch(location.pathname+"?token="+encodeURIComponent(TK)+"&data=who",{cache:"no-store"});WHO=(await r.json()).personas||[];}catch(e){WHO=[];}}',
'  g.innerHTML="<div class=\\"box\\"><h3>Inicia sesión</h3><div class=\\"muted\\">Elige tu nombre y escribe tu PIN.</div><div class=\\"glist\\" id=\\"glist\\"></div></div>";',
'  document.getElementById("glist").innerHTML=WHO.map(function(p){return "<div class=\\"gitem\\" onclick=\\"pickP(\\x27"+p.id+"\\x27)\\"><span style=\\"color:var(--tx)\\">"+h(p.nombre)+(p.es_admin?" <span class=\\x27pill\\x27>admin</span>":"")+"</span><span>"+h(p.rol)+(p.has_pin?"":" · sin PIN")+"</span></div>";}).join("");}',
'function pickP(pid){GP=WHO.filter(function(x){return x.id==pid;})[0];if(!GP)return;var g=document.getElementById("gate");',
'  if(!GP.has_pin&&GP.es_admin){',
'    g.innerHTML="<div class=\\"box\\"><h3>Crea tu PIN</h3><div class=\\"muted\\">"+h(GP.nombre)+" · eres admin y aún no tienes PIN. Créalo (4 a 8 dígitos).</div><input class=\\"pin\\" id=\\"p1\\" inputmode=\\"numeric\\" maxlength=\\"8\\" placeholder=\\"PIN\\"><input class=\\"pin\\" id=\\"p2\\" inputmode=\\"numeric\\" maxlength=\\"8\\" placeholder=\\"repite PIN\\"><div style=\\"margin-top:14px;display:flex;gap:8px\\"><button class=\\"btn\\" onclick=\\"showLogin()\\">← volver</button><button class=\\"btn primary\\" onclick=\\"doSetOwn()\\">Crear y entrar</button></div></div>";document.getElementById("p1").focus();',
'  }else if(!GP.has_pin){',
'    g.innerHTML="<div class=\\"box\\"><h3>Sin PIN</h3><div class=\\"muted\\">"+h(GP.nombre)+", aún no tienes PIN. Pídele a un admin (Daniel o Jorge) que te lo asigne.</div><div style=\\"margin-top:14px\\"><button class=\\"btn\\" onclick=\\"showLogin()\\">← volver</button></div></div>";',
'  }else{',
'    g.innerHTML="<div class=\\"box\\"><h3>"+h(GP.nombre)+"</h3><div class=\\"muted\\">Escribe tu PIN.</div><input class=\\"pin\\" id=\\"p1\\" inputmode=\\"numeric\\" maxlength=\\"8\\" placeholder=\\"PIN\\"><div style=\\"margin-top:14px;display:flex;gap:8px\\"><button class=\\"btn\\" onclick=\\"showLogin()\\">← volver</button><button class=\\"btn primary\\" onclick=\\"doLogin()\\">Entrar</button></div></div>";',
'    var i=document.getElementById("p1");i.focus();i.onkeydown=function(e){if(e.key==="Enter")doLogin();};',
'  }}',
'async function doLogin(){var pin=document.getElementById("p1").value;var d=await api({action:"login",persona_id:GP.id,pin:pin});if(d.ok){afterLogin(d);}else tj(d.error||"no se pudo");}',
'async function doSetOwn(){var a=document.getElementById("p1").value,b=document.getElementById("p2").value;if(a!==b){tj("Los PIN no coinciden");return;}var d=await api({action:"set_own_pin",persona_id:GP.id,pin:a});if(d.ok){afterLogin(d);}else tj(d.error||"no se pudo");}',
'function afterLogin(d){S=d.session;ssSet("panel_s",S);ME={nombre:d.nombre,es_admin:d.es_admin};document.getElementById("gate").style.display="none";load();}',
'async function logout(){try{await post({action:"logout"});}catch(e){}S="";ssDel("panel_s");ME=null;ST=null;setWho();showLogin();}',
'function setWho(){document.getElementById("who").innerHTML = ME ? ("Eres: <b>"+h(ME.nombre)+"</b>"+(ME.es_admin?" <span class=\\"pill\\">admin</span>":"")+" <button class=\\"btn sm\\" onclick=\\"logout()\\">salir</button>") : "";}',
// ----- carga -----
'async function load(){if(!S){showLogin();return;}',
'  try{var r=await fetch(location.pathname+"?token="+encodeURIComponent(TK)+"&data=1&s="+encodeURIComponent(S),{cache:"no-store"});var txt=await r.text();',
'   var d;try{d=JSON.parse(txt);}catch(e){document.getElementById("sub").textContent="respuesta no válida";return;}',
'   if(d.code==="auth"){S="";ssDel("panel_s");showLogin();return;}',
'   ST=d;ME=d.me;setWho();',
'   document.getElementById("sub").textContent=d.fecha+" · "+d.hora+" (MX) · "+d.resumen.puras+" de líder · "+d.resumen.manual+" manual · "+d.resumen.sind+" sin dato";',
'   render();',
'  }catch(e){document.getElementById("sub").textContent="error: "+e.message;}}',
'function tabs(){var ts=[["captura","Captura en vivo"],["registrar","Registrar hora"],["tableros","Tableros"],["asignar","Asignar líder"]];if(ME&&ME.es_admin)ts.push(["personas","Personas / PIN"]);',
'  document.getElementById("tabs").innerHTML=ts.map(function(t){return "<div class=\\"tab"+(TAB==t[0]?" on":"")+"\\" onclick=\\"go(\\x27"+t[0]+"\\x27)\\">"+t[1]+"</div>";}).join("");}',
'function go(t){TAB=t;render();}',
'function ck(l,s){return l+"|"+s;}function buildMap(){var m={};ST.hxh.forEach(function(r){var k=ck(r.linea_id,r.slot);var p=m[k];if(!p||(p.sin_dato&&!r.sin_dato))m[k]=r;});return m;}',
'function render(){tabs();var v=document.getElementById("view");if(!ST){v.innerHTML="";return;}',
'  if(TAB=="captura")return renderMatriz(v);if(TAB=="registrar")return renderReg(v);if(TAB=="tableros")return renderTableros(v);if(TAB=="asignar")return renderAsignar(v);if(TAB=="personas")return renderPersonas(v);}',
'function renderMatriz(v){var m=buildMap();var grp=null,rows="";',
'  ST.tableros.forEach(function(t){if(t.grupo!=grp){grp=t.grupo;rows+="<tr><td class=\\"lh grp\\" colspan=\\""+(ST.slots.length+1)+"\\">"+h(grp)+"</td></tr>";}var tds="";',
'   ST.slots.forEach(function(s){var c=m[ck(t.id,s)];var cls="c-falta",txt="+",ti="registrar";if(c){if(c.sin_dato){cls="c-sd";txt="⛔";ti="sin dato";}else if(c.origen=="panel_manual"){cls="c-manual";txt=(c.real==null?"✓":c.real);ti="manual · "+(c.por||"?");}else{cls="c-lider";txt=(c.real==null?"✓":c.real);ti="líder · "+(c.por||"?");}}var clk=(!c||c.sin_dato);var oc=clk?(" onclick=\\"preReg(\\x27"+t.id+"\\x27,\\x27"+s+"\\x27)\\""):"";tds+="<td><span class=\\"cell "+cls+"\\" title=\\""+ti+"\\""+oc+">"+txt+"</span></td>";});',
'   rows+="<tr><td class=\\"lh\\" title=\\""+h(t.nombre)+"\\">"+h(t.nombre)+"<div class=\\"muted\\">"+h(t.lider||"sin líder")+"</div></td>"+tds+"</tr>";});',
'  var head="<tr><th class=\\"lh\\">Tablero</th>"+ST.slots.map(function(s){return "<th>"+s.slice(0,5)+"</th>";}).join("")+"</tr>";',
'  v.innerHTML="<div class=\\"card\\"><h2>Captura del día — "+h(ST.fecha)+"</h2><div class=\\"matwrap\\"><table class=\\"mat\\"><thead>"+head+"</thead><tbody>"+rows+"</tbody></table></div><div class=\\"legend\\"><span><i class=\\"dotc\\" style=\\"background:#e9f7ef\\"></i>de líder</span><span><i class=\\"dotc\\" style=\\"background:#e8effc\\"></i>manual</span><span><i class=\\"dotc\\" style=\\"background:#f1f1f3\\"></i>sin dato</span><span><i class=\\"dotc\\" style=\\"border:1px dashed #dcdce0\\"></i>falta — toca para registrar</span></div></div>";}',
'function preReg(lid,slot){PRE={linea_id:lid,slot:slot};go("registrar");}',
'function bOpts(sel){return ST.tableros.map(function(t){return "<option value=\\""+t.id+"\\""+(sel==t.id?" selected":"")+">"+h(t.nombre)+"</option>";}).join("");}',
'function sOpts(sel){return ST.slots.map(function(s){return "<option"+(sel==s?" selected":"")+">"+s+"</option>";}).join("");}',
'function renderReg(v){var pl=PRE||{};var causas="<option value=\\"\\">— sin causa —</option>"+ST.causas.map(function(c){return "<option value=\\""+c.codigo+"\\">"+h(c.boton_texto)+"</option>";}).join("");',
'  v.innerHTML="<div class=\\"card\\"><h2>Registrar una hora no capturada</h2><div class=\\"row\\"><div class=\\"field\\"><label>Tablero</label><select id=\\"r_b\\">"+bOpts(pl.linea_id)+"</select></div><div class=\\"field\\"><label>Hora</label><select id=\\"r_s\\">"+sOpts(pl.slot)+"</select></div><div class=\\"field\\"><label>Piezas</label><input id=\\"r_p\\" inputmode=\\"numeric\\" placeholder=\\"0\\" style=\\"width:90px\\"></div><div class=\\"field\\"><label>Causa (opcional)</label><select id=\\"r_c\\">"+causas+"</select></div><div class=\\"field\\" style=\\"flex:1;min-width:160px\\"><label>Nota (opcional)</label><input id=\\"r_n\\" placeholder=\\"motivo\\"></div><button class=\\"btn primary\\" onclick=\\"doReg()\\">Registrar</button></div><div class=\\"muted\\" style=\\"margin-top:10px\\">Quedará firmado: origen <b>manual</b> · por <b>"+h(ME?ME.nombre:"")+"</b>.</div></div>";PRE=null;}',
'async function doReg(){var p=document.getElementById("r_p").value;if(!p&&p!=="0"){tj("Escribe las piezas");return;}var d=await post({action:"backfill",linea_id:document.getElementById("r_b").value,slot:document.getElementById("r_s").value,real:p,causa:document.getElementById("r_c").value,nota:document.getElementById("r_n").value});if(d.ok){tj("Registrado ✓");await load();go("captura");}else if(d.code=="auth"){logout();}else tj(d.error||"no se pudo");}',
'function rolSel(id,sel){var R=["paros","faltantes","calidad","mantenimiento","direccion"];return "<select id=\\""+id+"\\">"+R.map(function(r){return "<option"+(sel==r?" selected":"")+">"+r+"</option>";}).join("")+"</select>";}',
'function pSel(id,sel){return "<select id=\\""+id+"\\"><option value=\\"\\">— sin líder —</option>"+ST.personas.map(function(p){return "<option value=\\""+p.id+"\\""+(sel==p.id?" selected":"")+">"+h(p.nombre)+"</option>";}).join("")+"</select>";}',
'function renderTableros(v){var rows=ST.tableros.map(function(t){return "<div class=\\"tline\\"><div><b>"+h(t.nombre)+"</b> <span class=\\"muted\\">"+h(t.grupo)+" · "+h(t.unidad)+" · "+h(t.captura)+"</span></div><button class=\\"btn sm\\" onclick=\\"editBoard(\\x27"+t.id+"\\x27)\\">editar</button></div>";}).join("");',
'  v.innerHTML="<div class=\\"card\\"><h2>Tableros activos</h2>"+rows+"</div><div class=\\"card\\"><h2>Nuevo tablero</h2><div class=\\"row\\"><div class=\\"field\\"><label>Nombre</label><input id=\\"n_nom\\"></div><div class=\\"field\\"><label>Grupo</label><input id=\\"n_grp\\" placeholder=\\"CONFORMAL\\"></div><div class=\\"field\\"><label>Unidad</label><input id=\\"n_uni\\" value=\\"piezas\\" style=\\"width:100px\\"></div><div class=\\"field\\"><label>Captura</label><select id=\\"n_cap\\"><option value=\\"conteo\\">conteo</option><option value=\\"tarjetas\\">tarjetas</option></select></div><div class=\\"field\\"><label>Supervisor</label>"+rolSel("n_sup","paros")+"</div><div class=\\"field\\"><label>Líder</label>"+pSel("n_lid","")+"</div><button class=\\"btn primary\\" onclick=\\"doCreate()\\">Crear</button></div></div>";}',
'function editBoard(id){var t=ST.tableros.filter(function(x){return x.id==id;})[0];if(!t)return;event.target.parentNode.outerHTML="<div class=\\"tline\\" style=\\"display:block\\"><div class=\\"row\\"><div class=\\"field\\"><label>Nombre</label><input id=\\"e_nom\\" value=\\""+h(t.nombre)+"\\"></div><div class=\\"field\\"><label>Grupo</label><input id=\\"e_grp\\" value=\\""+h(t.grupo)+"\\"></div><div class=\\"field\\"><label>Unidad</label><input id=\\"e_uni\\" value=\\""+h(t.unidad)+"\\" style=\\"width:100px\\"></div><div class=\\"field\\"><label>Captura</label><select id=\\"e_cap\\"><option value=\\"conteo\\""+(t.captura!="tarjetas"?" selected":"")+">conteo</option><option value=\\"tarjetas\\""+(t.captura=="tarjetas"?" selected":"")+">tarjetas</option></select></div><div class=\\"field\\"><label>Supervisor</label>"+rolSel("e_sup",t.supervisor_rol)+"</div><button class=\\"btn primary sm\\" onclick=\\"doUpdate(\\x27"+id+"\\x27)\\">Guardar</button> <button class=\\"btn sm\\" onclick=\\"doDeact(\\x27"+id+"\\x27)\\">desactivar</button></div></div>";}',
'async function doCreate(){var nom=document.getElementById("n_nom").value;if(!nom){tj("Falta el nombre");return;}var d=await post({action:"create_board",nombre:nom,grupo:document.getElementById("n_grp").value,unidad:document.getElementById("n_uni").value,captura:document.getElementById("n_cap").value,supervisor_rol:document.getElementById("n_sup").value,lider_persona_id:document.getElementById("n_lid").value});if(d.ok){tj("Tablero creado ✓");await load();}else if(d.code=="auth"){logout();}else tj(d.error||"no se pudo");}',
'async function doUpdate(id){var d=await post({action:"update_board",linea_id:id,nombre:document.getElementById("e_nom").value,grupo:document.getElementById("e_grp").value,unidad:document.getElementById("e_uni").value,captura:document.getElementById("e_cap").value,supervisor_rol:document.getElementById("e_sup").value});if(d.ok){tj("Guardado ✓");await load();}else tj(d.error||"no se pudo");}',
'async function doDeact(id){if(!confirm("¿Desactivar este tablero? (el historial se conserva)"))return;var d=await post({action:"update_board",linea_id:id,activa:false});if(d.ok){tj("Desactivado ✓");await load();}else tj(d.error||"no se pudo");}',
'function renderAsignar(v){var rows=ST.tableros.map(function(t){return "<div class=\\"tline\\"><div><b>"+h(t.nombre)+"</b> <span class=\\"muted\\">"+h(t.grupo)+"</span></div><div>"+pSel("a_"+t.id,t.lider_persona_id||"")+" <button class=\\"btn sm\\" onclick=\\"doAssign(\\x27"+t.id+"\\x27)\\">asignar</button></div></div>";}).join("");v.innerHTML="<div class=\\"card\\"><h2>Asignar / reasignar líder</h2>"+rows+"</div>";}',
'async function doAssign(id){var d=await post({action:"assign_board",linea_id:id,lider_persona_id:document.getElementById("a_"+id).value});if(d.ok){tj("Líder asignado ✓");await load();}else tj(d.error||"no se pudo");}',
'function renderPersonas(v){var rows=ST.personas.map(function(p){return "<div class=\\"tline\\"><div><b>"+h(p.nombre)+"</b> <span class=\\"muted\\">"+h(p.rol)+"</span> "+(p.es_admin?"<span class=\\x27pill\\x27>admin</span>":"")+" "+(p.has_pin?"<span class=\\x27pill\\x27>con PIN</span>":"<span class=\\x27pill no\\x27>sin PIN</span>")+"</div><div class=\\"row\\"><input id=\\"pin_"+p.id+"\\" inputmode=\\"numeric\\" maxlength=\\"8\\" placeholder=\\"PIN\\" style=\\"width:90px\\"><button class=\\"btn sm\\" onclick=\\"doSetPin(\\x27"+p.id+"\\x27)\\">"+(p.has_pin?"resetear":"asignar")+"</button><button class=\\"btn sm\\" onclick=\\"doAdmin(\\x27"+p.id+"\\x27,"+(p.es_admin?"false":"true")+")\\">"+(p.es_admin?"quitar admin":"hacer admin")+"</button></div></div>";}).join("");',
'  v.innerHTML="<div class=\\"card\\"><h2>Personas — PIN y admin</h2><div class=\\"muted\\" style=\\"margin-bottom:8px\\">Asigna un PIN (4–8 dígitos) y repártelo a cada quien. \\x27Resetear\\x27 cambia uno olvidado.</div>"+rows+"</div>";}',
'async function doSetPin(pid){var pin=document.getElementById("pin_"+pid).value;var d=await post({action:"set_pin",persona_id:pid,pin:pin});if(d.ok){tj("PIN asignado ✓");await load();}else if(d.code=="auth"){logout();}else tj(d.error||"no se pudo");}',
'async function doAdmin(pid,val){var d=await post({action:"toggle_admin",persona_id:pid,es_admin:val});if(d.ok){tj("Listo ✓");await load();}else tj(d.error||"no se pudo");}',
'try{setWho();if(S){load();}else{showLogin();}setInterval(function(){if(S)load();},30000);}catch(e){document.getElementById("sub").textContent="error al iniciar: "+e.message;}',
'</script></body></html>'
].join('');
return [{ json: { body: PAGE, contentType: 'text/html; charset=utf-8' } }];
