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
const GRUPOS = ['SMT', 'PTH', 'EMPAQUE', 'EMBARQUES'];   // categorías válidas del flujo (dropdown) — evita 'OTROS' fuera del dashboard
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
  const r = await pg(`SELECT s.persona_id, s.es_admin, s.nombre, p.rol, COALESCE(p.puede_meta,false) AS puede_meta, COALESCE(p.puede_estandar,false) AS puede_estandar FROM horacio.panel_sesiones s JOIN horacio.personas p ON p.id=s.persona_id WHERE s.token='${esc(t)}' AND s.expira>now() LIMIT 1`);
  return r.length ? r[0] : null;
};
// quién puede ver/curar perfiles: SOLO RH (datos sensibles — decisión del Director)
const puedePerfiles = (S) => !!(S && S.rol === 'rh');
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
    if (act === 'perfil_estado') { // aceptar / descartar un aprendizaje sugerido
      if (!puedePerfiles(S)) return J({ ok: false, error: 'Solo Recursos Humanos.' });
      const eid = String(body.ev_id || ''), estado = (body.estado === 'aceptado') ? 'aceptado' : (body.estado === 'descartado') ? 'descartado' : (body.estado === 'sugerido' ? 'sugerido' : null);
      if (!eid || !estado) return J({ ok: false, error: 'Datos inválidos.' });
      await pg(`UPDATE horacio.perfil_eventos SET estado='${estado}' WHERE id='${esc(eid)}'`);
      return J({ ok: true });
    }
    if (act === 'perfil_aprendido') { // curar el resumen que Horacio usa
      if (!puedePerfiles(S)) return J({ ok: false, error: 'Solo Recursos Humanos.' });
      const pid = String(body.persona_id || ''), txt = String(body.aprendido == null ? '' : body.aprendido).slice(0, 800);
      const pr = await pg(`SELECT 1 FROM horacio.personas WHERE id='${esc(pid)}'`);
      if (!pr.length) return J({ ok: false, error: 'Persona no existe.' });
      await pg(`INSERT INTO horacio.perfiles(persona_id,aprendido) VALUES('${esc(pid)}',${txt ? `'${esc(txt)}'` : 'NULL'}) ON CONFLICT(persona_id) DO UPDATE SET aprendido=EXCLUDED.aprendido, actualizado_ts=now()`);
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
      const ya = await pg(`SELECT 1 FROM horacio.hxh_vigente WHERE linea_id='${esc(lid)}' AND fecha='${fecha}' AND hora_slot='${esc(slot)}' AND NOT sin_dato LIMIT 1`);
      if (ya.length) return J({ ok: false, error: 'Esa hora ya está capturada.' });
      const causa = body.causa ? `'${esc(String(body.causa))}'` : 'NULL';
      const meta = await pg(`SELECT meta_hr FROM horacio.ordenes_tablero WHERE linea_id='${esc(lid)}' AND fecha='${fecha}' AND vigente ORDER BY ts DESC LIMIT 1`);
      const plan = (meta.length && meta[0].meta_hr != null) ? Number(meta[0].meta_hr) : null;
      const nota = body.nota ? `'${esc(String(body.nota).slice(0, 300))}'` : 'NULL';
      await pg(`INSERT INTO horacio.hora_por_hora(linea_id,fecha,hora_slot,plan,real,t_productivo_min,causa_codigo,origen,capturado_por,nota) VALUES('${esc(lid)}','${fecha}','${esc(slot)}',${plan == null ? 'NULL' : plan},${real},60,${causa},'panel_manual','${esc(by)}',${nota})`);
      return J({ ok: true });
    }
    if (act === 'correct') {
      if (!S.es_admin) return J({ ok: false, error: 'Solo un admin puede corregir una hora.' });
      const lid = String(body.linea_id || ''), slot = String(body.slot || '');
      const real = parseInt(String(body.real == null ? '' : body.real).replace(/[^0-9]/g, ''), 10);
      if (!lid || SLOTS.indexOf(slot) < 0) return J({ ok: false, error: 'Tablero u hora inválidos.' });
      if (isNaN(real) || real < 0 || real > 100000) return J({ ok: false, error: 'Piezas inválidas (0–100000).' });
      const cur = await pg(`SELECT id, plan FROM horacio.hxh_vigente WHERE linea_id='${esc(lid)}' AND fecha='${fecha}' AND hora_slot='${esc(slot)}' AND NOT sin_dato ORDER BY ts DESC LIMIT 1`);
      if (!cur.length) return J({ ok: false, error: 'No hay captura en esa hora para corregir (usa Registrar).' });
      const plan = (cur[0].plan != null) ? Number(cur[0].plan) : null;
      const nota = body.nota ? `'${esc(String(body.nota).slice(0, 300))}'` : 'NULL';
      await pg(`INSERT INTO horacio.hora_por_hora(linea_id,fecha,hora_slot,plan,real,t_productivo_min,origen,capturado_por,nota,corrige_id) VALUES('${esc(lid)}','${fecha}','${esc(slot)}',${plan == null ? 'NULL' : plan},${real},60,'panel_manual','${esc(by)}',${nota},'${cur[0].id}')`);
      return J({ ok: true });
    }
    if (act === 'create_board') {
      const nombre = String(body.nombre || '').trim().slice(0, 80);
      if (!nombre) return J({ ok: false, error: 'Falta el nombre del tablero.' });
      const grupo = String(body.grupo || '').trim().toUpperCase();
      if (GRUPOS.indexOf(grupo) < 0) return J({ ok: false, error: 'Categoría inválida. Elige: ' + GRUPOS.join(', ') });
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
      if (body.grupo != null) { const v = String(body.grupo).trim().toUpperCase(); if (!v || GRUPOS.indexOf(v) < 0) return J({ ok: false, error: 'Categoría inválida. Elige: ' + GRUPOS.join(', ') }); sets.push(`grupo='${esc(v)}'`); }
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
    if (act === 'paro_estado') { // R3-HDB2-06: admin abre/cierra status de paros (incl. retroactivos)
      if (!S.es_admin) return J({ ok: false, error: 'Solo un admin puede abrir/cerrar paros.' });
      const pid = String(body.paro_id || '');
      const nuevo = body.estado === 'cerrado' ? 'cerrado' : (body.estado === 'abierto' ? 'abierto' : null);
      if (!pid || !nuevo) return J({ ok: false, error: 'Datos inválidos.' });
      const pr = await pg(`SELECT id FROM horacio.paros WHERE id='${esc(pid)}'`);
      if (!pr.length) return J({ ok: false, error: 'Paro no encontrado.' });
      if (nuevo === 'cerrado') {
        // duracion solo si el paro es de HOY (cierre real); si es de un día previo (olvidado), NULL → no infla métricas
        await pg(`UPDATE horacio.paros SET estado='cerrado', ts_fin=now(), duracion_min=CASE WHEN (ts_inicio AT TIME ZONE 'America/Mexico_City')::date=(now() AT TIME ZONE 'America/Mexico_City')::date THEN ROUND(EXTRACT(EPOCH FROM (now()-ts_inicio))/60)::int ELSE NULL END WHERE id='${esc(pid)}'`);
      } else {
        await pg(`UPDATE horacio.paros SET estado='abierto', ts_fin=NULL, duracion_min=NULL WHERE id='${esc(pid)}'`);
      }
      return J({ ok: true });
    }
    if (act === 'meta_suggest') { // V1.5-B: sugerir meta desde estándar (teórico × prorrateo)
      if (!(S.es_admin || S.puede_meta)) return J({ ok: false, error: 'No tienes permiso para fijar metas.' });
      const lid = String(body.linea_id || ''), orden = String(body.orden || '').trim();
      if (!lid || !orden) return J({ ok: false, error: 'Elige tablero y escribe la OT.' });
      const r = await pg(`SELECT horacio.meta_sugerida_tablero('${esc(lid)}','${esc(orden)}') AS s`);
      return J({ ok: true, sug: (r.length ? r[0].s : null) });
    }
    if (act === 'set_meta') { // V1.5-A: fijar meta del día (misma tabla que /orden)
      if (!(S.es_admin || S.puede_meta)) return J({ ok: false, error: 'No tienes permiso para fijar metas.' });
      const lid = String(body.linea_id || '');
      const orden = String(body.orden || '').trim().slice(0, 60);
      const meta = parseInt(String(body.meta == null ? '' : body.meta).replace(/[^0-9]/g, ''), 10);
      if (!lid) return J({ ok: false, error: 'Falta el tablero.' });
      const ln = await pg(`SELECT id FROM horacio.lineas WHERE id='${esc(lid)}' AND activa`);
      if (!ln.length) return J({ ok: false, error: 'Tablero no existe.' });
      if (isNaN(meta) || meta < 1 || meta > 100000) return J({ ok: false, error: 'Meta inválida (1–100000).' });
      const sug = (body.meta_sugerida == null || body.meta_sugerida === '') ? null : Number(body.meta_sugerida);
      const difiere = (sug != null && isFinite(sug) && Math.abs(sug - meta) >= 1);
      const motivo = String(body.motivo || '').trim().slice(0, 300);
      if (difiere && !motivo) return J({ ok: false, error: 'Ajustar la meta sugerida pide un motivo (5-porqués).' });
      await pg(`UPDATE horacio.ordenes_tablero SET vigente=false WHERE linea_id='${esc(lid)}' AND fecha='${fecha}' AND vigente`);
      await pg(`INSERT INTO horacio.ordenes_tablero(linea_id,fecha,orden,meta_hr,vigente,origen,set_by_panel,meta_sugerida,meta_motivo) VALUES('${esc(lid)}','${fecha}',${orden ? `'${esc(orden)}'` : 'NULL'},${meta},true,'panel','${esc(by)}',${sug == null || !isFinite(sug) ? 'NULL' : sug},${motivo ? `'${esc(motivo)}'` : 'NULL'})`);
      return J({ ok: true });
    }
    if (act === 'set_estandar') { // V1.5: capturar/editar estándar por hora (gobierno: Gaby)
      if (!(S.es_admin || S.puede_estandar)) return J({ ok: false, error: 'Solo quien edita estándar (Gaby).' });
      const PROC = ['PP_481','PP_520','PP_411_481','PP_421','ENSAMBLE_MANUAL','WAVE_SOLDER','SOLDEO_MANUAL','ICT','GRB','CONFORMAL','LIMPIEZA','FCT','ENSAMBLES','PRUEBA_FCT','EMPAQUE'];
      const np = String(body.numero_parte || '').trim().toUpperCase();
      const proceso = String(body.proceso || '');
      const raw = body.std_hr;
      if (!np) return J({ ok: false, error: 'falta parte' });
      if (PROC.indexOf(proceso) < 0) return J({ ok: false, error: 'proceso inválido' });
      let res = await pg(`SELECT id FROM horacio.partes WHERE numero_parte='${esc(np)}' ORDER BY no_parte_ensamble LIMIT 1`);
      let pid = res && res[0] && res[0].id;
      if (!pid) {
        const desc = esc(String(body.descripcion || ''));
        res = await pg(`INSERT INTO horacio.partes(numero_parte,no_parte_ensamble,descripcion) VALUES('${esc(np)}','N/A','${desc}') ON CONFLICT (numero_parte,no_parte_ensamble) DO UPDATE SET descripcion=EXCLUDED.descripcion RETURNING id`);
        pid = res[0].id;
      }
      if (raw === '' || raw === null || raw === undefined) {
        await pg(`DELETE FROM horacio.estandar_proceso WHERE parte_id='${pid}' AND proceso='${proceso}'`);
        return J({ ok: true, cleared: true });
      }
      const v = Number(raw);
      if (!(v > 0)) return J({ ok: false, error: 'valor inválido' });
      await pg(`INSERT INTO horacio.estandar_proceso(parte_id,proceso,std_hr) VALUES('${pid}','${proceso}',${v}) ON CONFLICT (parte_id,proceso) DO UPDATE SET std_hr=EXCLUDED.std_hr`);
      return J({ ok: true, std: v });
    }
    return J({ ok: false, error: 'acción desconocida' });
  } catch (e) { return J({ ok: false, error: 'error: ' + (e.message || e) }); }
}

// ===================== LECTURAS (GET) =====================
if (q.data === 'who') {
  const personas = await pg("SELECT id, nombre, rol, es_admin, (pin_hash IS NOT NULL) AS has_pin FROM horacio.personas WHERE activa ORDER BY (rol='lider') DESC, rol, nombre");
  return J({ personas });
}
if (q.data === 'perfiles') {
  const S = await getSession(q.s);
  if (!S) return J({ ok: false, code: 'auth' });
  if (!puedePerfiles(S)) return J({ ok: false, error: 'Solo Recursos Humanos puede ver perfiles.' });
  const ps = await pg("SELECT p.id, p.nombre, p.rol, pf.aprendido, (pf.seed->>'texto') AS ficha FROM horacio.personas p LEFT JOIN horacio.perfiles pf ON pf.persona_id=p.id WHERE p.activa AND p.chat_id IS NOT NULL ORDER BY (p.rol='lider') DESC, p.nombre");
  const ev = await pg("SELECT id, persona_id, insight, mood, estado, fecha::text AS fecha FROM horacio.perfil_eventos WHERE estado IN ('sugerido','aceptado') ORDER BY ts DESC");
  const byP = {};
  ev.forEach((e) => { (byP[e.persona_id] = byP[e.persona_id] || []).push(e); });
  return J({ me: { nombre: S.nombre, es_admin: S.es_admin, rol: S.rol }, perfiles: ps.map((p) => ({
    id: p.id, nombre: p.nombre, rol: p.rol, aprendido: p.aprendido || '', ficha: p.ficha ? String(p.ficha).slice(0, 6000) : '',
    sugeridos: (byP[p.id] || []).filter((e) => e.estado === 'sugerido'),
    aceptados: (byP[p.id] || []).filter((e) => e.estado === 'aceptado'),
  })) });
}
if (q.data === '1') {
  const S = await getSession(q.s);
  if (!S) return J({ ok: false, code: 'auth' });
  const personas = await pg("SELECT id, nombre, rol, es_admin, (pin_hash IS NOT NULL) AS has_pin FROM horacio.personas WHERE activa ORDER BY (rol='lider') DESC, rol, nombre");
  const tableros = await pg(`SELECT l.id, l.codigo, l.nombre, l.grupo, l.orden, l.unidad, l.captura, l.supervisor_rol, l.lider_persona_id, p.nombre AS lider, (SELECT o.orden FROM horacio.ordenes_tablero o WHERE o.linea_id=l.id AND o.fecha='${fecha}' AND o.vigente ORDER BY o.ts DESC LIMIT 1) AS ot_hoy, (SELECT o.meta_hr FROM horacio.ordenes_tablero o WHERE o.linea_id=l.id AND o.fecha='${fecha}' AND o.vigente ORDER BY o.ts DESC LIMIT 1) AS meta_hoy, (EXISTS(SELECT 1 FROM horacio.linea_proceso lp WHERE lp.linea_codigo=l.codigo)) AS mapeada FROM horacio.lineas l LEFT JOIN horacio.personas p ON p.id=l.lider_persona_id WHERE l.activa ORDER BY l.grupo, l.orden`);
  const causas = await pg("SELECT codigo, boton_texto FROM horacio.causas_paro WHERE activa ORDER BY orden");
  // OT vigentes del sistema (export "en proceso") para el selector de meta — no captura manual
  const ots = await pg("SELECT orden_trabajo, numero_parte, descripcion, es_smt, GREATEST(COALESCE(cant_ordenada,0)-COALESCE(cant_terminada,0),0) AS pend FROM horacio.ordenes_trabajo WHERE estado_nexia NOT IN ('muerta','cerrada') ORDER BY es_smt DESC, orden_trabajo");
  // R3-HDB2-06: paros abiertos (cualquier fecha) + cerrados recientes, para que el admin abra/cierre status
  const paros = S.es_admin ? await pg(`SELECT p.id, l.nombre AS tablero, l.grupo, COALESCE(cp.boton_texto,'—') AS causa, p.estado, to_char(p.ts_inicio AT TIME ZONE 'America/Mexico_City','YYYY-MM-DD HH24:MI') AS inicio, to_char(p.ts_fin AT TIME ZONE 'America/Mexico_City','YYYY-MM-DD HH24:MI') AS fin, p.duracion_min::int AS dur, (CURRENT_DATE-(p.ts_inicio AT TIME ZONE 'America/Mexico_City')::date)::int AS dias, (extract(epoch from p.ts_inicio)*1000)::bigint AS inicio_ms, COALESCE(l.supervisor_rol,'paros') AS rol_owner, (SELECT pe.nombre FROM horacio.personas pe WHERE pe.rol=COALESCE(l.supervisor_rol,'paros') AND pe.activa AND pe.chat_id IS NOT NULL ORDER BY pe.created_at LIMIT 1) AS owner, (SELECT nombre FROM horacio.personas WHERE chat_id=p.reporto_chat_id LIMIT 1) AS reporto FROM horacio.paros p JOIN horacio.lineas l ON l.id=p.linea_id LEFT JOIN horacio.causas_paro cp ON cp.codigo=p.causa_codigo WHERE p.estado='abierto' OR p.ts_inicio >= CURRENT_DATE-2 ORDER BY (p.estado='abierto') DESC, p.ts_inicio DESC LIMIT 60`) : [];
  const hxh = await pg(`SELECT h.linea_id, h.hora_slot, h.real, h.plan, h.sin_dato, h.origen, h.capturado_por, pr.nombre AS reporto FROM horacio.hxh_vigente h LEFT JOIN horacio.personas pr ON pr.chat_id=h.reporto_chat_id WHERE h.fecha='${fecha}' ORDER BY h.ts`);
  let puras = 0, manual = 0, sind = 0;
  hxh.forEach((r) => { if (r.sin_dato) sind++; else if (r.origen === 'panel_manual') manual++; else puras++; });
  // estándar (solo para quien lo edita: Gaby / admin) — partes y sus std por estación
  let estParts = [], estMap = {};
  if (S.es_admin || S.puede_estandar) {
    const ep = await pg("SELECT p.numero_parte, count(e.id) AS nstd, EXISTS(SELECT 1 FROM horacio.ordenes_trabajo o WHERE o.numero_parte=p.numero_parte AND o.estado_nexia<>'muerta') AS en_ot, max(COALESCE(p.descripcion,(SELECT descripcion FROM horacio.ordenes_trabajo o WHERE o.numero_parte=p.numero_parte LIMIT 1))) AS descripcion FROM horacio.partes p LEFT JOIN horacio.estandar_proceso e ON e.parte_id=p.id GROUP BY p.numero_parte ORDER BY (count(e.id)=0) DESC, p.numero_parte");
    const ev = await pg("SELECT p.numero_parte, e.proceso, round(avg(e.std_hr),1) AS std FROM horacio.partes p JOIN horacio.estandar_proceso e ON e.parte_id=p.id GROUP BY p.numero_parte, e.proceso");
    estParts = ep.map((r) => ({ np: r.numero_parte, desc: r.descripcion, nstd: Number(r.nstd) || 0, enOt: !!r.en_ot }));
    ev.forEach((r) => { (estMap[r.numero_parte] = estMap[r.numero_parte] || {})[r.proceso] = Number(r.std); });
  }
  return J({
    fecha, hora: now.toFormat('HH:mm'), slots: SLOTS, personas, tableros, causas, paros,
    ots: ots.map((o) => ({ ot: o.orden_trabajo, np: o.numero_parte, desc: o.descripcion, smt: !!o.es_smt, pend: o.pend == null ? null : Number(o.pend) })),
    estParts, estMap,
    hxh: hxh.map((r) => ({ linea_id: r.linea_id, slot: r.hora_slot, real: r.real == null ? null : Number(r.real), plan: r.plan == null ? null : Number(r.plan), sin_dato: r.sin_dato, origen: r.origen, por: r.capturado_por || r.reporto || null })),
    resumen: { puras, manual, sind }, me: { nombre: S.nombre, es_admin: S.es_admin, rol: S.rol, perfiles: puedePerfiles(S), puede_meta: !!S.puede_meta, puede_estandar: !!S.puede_estandar },
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
'var S=ssGet("panel_s"), ME=null, ST=null, TAB="captura", PRE=null, PREC=null, WHO=null, GP=null, SUG={};',
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
'function tabs(){var ts=[["captura","Captura en vivo"],["registrar","Registrar hora"]];if(ME&&(ME.es_admin||ME.puede_meta))ts.push(["metas","Metas del día"]);if(ME&&(ME.es_admin||ME.puede_estandar))ts.push(["estandar","Estándar"]);ts.push(["tableros","Tableros"]);ts.push(["asignar","Asignar líder"]);if(ME&&ME.es_admin)ts.push(["paros","Paros"]);if(ME&&ME.es_admin)ts.push(["personas","Personas / PIN"]);if(ME&&ME.perfiles)ts.push(["perfiles","Perfiles"]);',
'  document.getElementById("tabs").innerHTML=ts.map(function(t){return "<div class=\\"tab"+(TAB==t[0]?" on":"")+"\\" onclick=\\"go(\\x27"+t[0]+"\\x27)\\">"+t[1]+"</div>";}).join("");}',
'function go(t){TAB=t;render();}',
'function ck(l,s){return l+"|"+s;}function buildMap(){var m={};ST.hxh.forEach(function(r){var k=ck(r.linea_id,r.slot);var p=m[k];if(!p||(p.sin_dato&&!r.sin_dato))m[k]=r;});return m;}',
'function render(){tabs();var v=document.getElementById("view");if(!ST){v.innerHTML="";return;}',
'  if(TAB=="captura")return renderMatriz(v);if(TAB=="registrar")return renderReg(v);if(TAB=="metas")return renderMetas(v);if(TAB=="estandar")return renderEstandar(v);if(TAB=="tableros")return renderTableros(v);if(TAB=="asignar")return renderAsignar(v);if(TAB=="paros")return renderParos(v);if(TAB=="personas")return renderPersonas(v);if(TAB=="perfiles")return renderPerfiles(v);}',
'function renderMatriz(v){var m=buildMap();var grp=null,rows="";',
'  ST.tableros.forEach(function(t){if(t.grupo!=grp){grp=t.grupo;rows+="<tr><td class=\\"lh grp\\" colspan=\\""+(ST.slots.length+1)+"\\">"+h(grp)+"</td></tr>";}var tds="";',
'   ST.slots.forEach(function(s){var c=m[ck(t.id,s)];var cls="c-falta",txt="+",ti="registrar";if(c){if(c.sin_dato){cls="c-sd";txt="⛔";ti="sin dato";}else if(c.origen=="panel_manual"){cls="c-manual";txt=(c.real==null?"✓":c.real);ti="manual · "+(c.por||"?");}else{cls="c-lider";txt=(c.real==null?"✓":c.real);ti="líder · "+(c.por||"?");}}var clk=(!c||c.sin_dato);var captured=(c&&!c.sin_dato);var oc="";if(clk){oc=" onclick=\\"preReg(\\x27"+t.id+"\\x27,\\x27"+s+"\\x27)\\"";}else if(captured&&ME&&ME.es_admin){oc=" onclick=\\"preCorrect(\\x27"+t.id+"\\x27,\\x27"+s+"\\x27,"+(c.real==null?0:c.real)+")\\" style=\\"cursor:pointer\\"";ti="✏️ corregir · "+ti;}tds+="<td><span class=\\"cell "+cls+"\\" title=\\""+ti+"\\""+oc+">"+txt+"</span></td>";});',
'   rows+="<tr><td class=\\"lh\\" title=\\""+h(t.nombre)+"\\">"+h(t.nombre)+"<div class=\\"muted\\">"+h(t.lider||"sin líder")+"</div></td>"+tds+"</tr>";});',
'  var head="<tr><th class=\\"lh\\">Tablero</th>"+ST.slots.map(function(s){return "<th title=\\""+s+"\\">"+s.slice(0,5)+"<br><span style=\\"color:#a1a1aa;font-weight:400\\">"+s.slice(6)+"</span></th>";}).join("")+"</tr>";',
'  v.innerHTML="<div class=\\"card\\"><h2>Captura del día — "+h(ST.fecha)+"</h2><div class=\\"matwrap\\"><table class=\\"mat\\"><thead>"+head+"</thead><tbody>"+rows+"</tbody></table></div><div class=\\"legend\\"><span><i class=\\"dotc\\" style=\\"background:#e9f7ef\\"></i>de líder</span><span><i class=\\"dotc\\" style=\\"background:#e8effc\\"></i>manual</span><span><i class=\\"dotc\\" style=\\"background:#f1f1f3\\"></i>sin dato</span><span><i class=\\"dotc\\" style=\\"border:1px dashed #dcdce0\\"></i>falta — toca para registrar</span></div></div>";}',
'function preReg(lid,slot){PRE={linea_id:lid,slot:slot};go("registrar");}',
'function preCorrect(lid,slot,actual){PREC={linea_id:lid,slot:slot,actual:actual};go("registrar");}',
'function renderCorrect(v){var pc=PREC;PREC=null;var tn=(ST.tableros.filter(function(x){return x.id==pc.linea_id;})[0]||{}).nombre||"";',
'  v.innerHTML="<div class=\\"card\\"><h2>Corregir hora capturada</h2><div class=\\"muted\\" style=\\"margin-bottom:10px\\">"+h(tn)+" · "+pc.slot+" · valor actual: <b>"+pc.actual+"</b>. Queda como evento nuevo (no borra el original; se conserva para auditoría) firmado por <b>"+h(ME?ME.nombre:"")+"</b>.</div><div class=\\"row\\"><div class=\\"field\\"><label>Nuevo valor</label><input id=\\"co_p\\" inputmode=\\"numeric\\" value=\\""+pc.actual+"\\" style=\\"width:100px\\"></div><div class=\\"field\\" style=\\"flex:1;min-width:160px\\"><label>Motivo de la corrección</label><input id=\\"co_n\\" placeholder=\\"p.ej. dato mal capturado\\"></div><button class=\\"btn primary\\" onclick=\\"doCorrect(\\x27"+pc.linea_id+"\\x27,\\x27"+pc.slot+"\\x27)\\">Guardar corrección</button> <button class=\\"btn\\" onclick=\\"go(\\x27captura\\x27)\\">cancelar</button></div></div>";}',
'async function doCorrect(lid,slot){var p=document.getElementById("co_p").value,n=document.getElementById("co_n").value;var d=await post({action:"correct",linea_id:lid,slot:slot,real:p,nota:n});if(d.ok){tj("Corregido ✓");await load();go("captura");}else if(d.code=="auth"){logout();}else tj(d.error||"no se pudo");}',
'function bOpts(sel){return ST.tableros.map(function(t){return "<option value=\\""+t.id+"\\""+(sel==t.id?" selected":"")+">"+h(t.nombre)+"</option>";}).join("");}',
'function sOpts(sel){return ST.slots.map(function(s){return "<option"+(sel==s?" selected":"")+">"+s+"</option>";}).join("");}',
'function renderReg(v){if(PREC){return renderCorrect(v);}var pl=PRE||{};var causas="<option value=\\"\\">— sin causa —</option>"+ST.causas.map(function(c){return "<option value=\\""+c.codigo+"\\">"+h(c.boton_texto)+"</option>";}).join("");',
'  v.innerHTML="<div class=\\"card\\"><h2>Registrar una hora no capturada</h2><div class=\\"row\\"><div class=\\"field\\"><label>Tablero</label><select id=\\"r_b\\">"+bOpts(pl.linea_id)+"</select></div><div class=\\"field\\"><label>Hora</label><select id=\\"r_s\\">"+sOpts(pl.slot)+"</select></div><div class=\\"field\\"><label>Piezas</label><input id=\\"r_p\\" inputmode=\\"numeric\\" placeholder=\\"0\\" style=\\"width:90px\\"></div><div class=\\"field\\"><label>Causa (opcional)</label><select id=\\"r_c\\">"+causas+"</select></div><div class=\\"field\\" style=\\"flex:1;min-width:160px\\"><label>Nota (opcional)</label><input id=\\"r_n\\" placeholder=\\"motivo\\"></div><button class=\\"btn primary\\" onclick=\\"doReg()\\">Registrar</button></div><div class=\\"muted\\" style=\\"margin-top:10px\\">Quedará firmado: origen <b>manual</b> · por <b>"+h(ME?ME.nombre:"")+"</b>.</div></div>";PRE=null;}',
'async function doReg(){var p=document.getElementById("r_p").value;if(!p&&p!=="0"){tj("Escribe las piezas");return;}var d=await post({action:"backfill",linea_id:document.getElementById("r_b").value,slot:document.getElementById("r_s").value,real:p,causa:document.getElementById("r_c").value,nota:document.getElementById("r_n").value});if(d.ok){tj("Registrado ✓");await load();go("captura");}else if(d.code=="auth"){logout();}else tj(d.error||"no se pudo");}',
// ----- V1.5: metas del día (captura + sugerencia desde estándar) -----
'function otOpts(t){var cur=t.ot_hoy||"";var smt=(t.grupo=="SMT");var list=(ST.ots||[]).filter(function(o){return smt?o.smt:!o.smt;});if(!list.length)list=(ST.ots||[]);var seen=false;var o="<option value=\\"\\">— elige OT del sistema —</option>"+list.map(function(o){if(o.ot==cur)seen=true;return "<option value=\\""+h(o.ot)+"\\""+(o.ot==cur?" selected":"")+">"+h(o.ot)+" \\u00b7 "+h(o.np)+(o.pend!=null?" ("+o.pend+" pend)":"")+"</option>";}).join("");if(cur&&!seen)o+="<option value=\\""+h(cur)+"\\" selected>"+h(cur)+" (actual)</option>";return o;}',
'function renderMetas(v){if(!(ME&&(ME.es_admin||ME.puede_meta))){v.innerHTML="<div class=\\"card\\"><div class=\\"muted\\">No tienes permiso para fijar metas.</div></div>";return;}',
'  var grp=null,rows="";ST.tableros.forEach(function(t){if(t.grupo!=grp){grp=t.grupo;rows+="<div class=\\"grp\\">"+h(grp)+"</div>";}',
'   var ot=t.ot_hoy||"";var mt=(t.meta_hoy==null?"":Math.round(Number(t.meta_hoy)));var map=t.mapeada?"":" <span class=\\"pill no\\">sin estándar mapeado</span>";',
'   rows+="<div class=\\"tline\\" style=\\"display:block\\"><div class=\\"row\\" style=\\"align-items:flex-end\\"><div class=\\"field\\" style=\\"flex:1;min-width:150px\\"><label>"+h(t.nombre)+map+"</label><select id=\\"mo_"+t.id+"\\">"+otOpts(t)+"</select></div><div class=\\"field\\"><label>Meta/hr</label><input id=\\"mm_"+t.id+"\\" inputmode=\\"numeric\\" style=\\"width:90px\\" value=\\""+mt+"\\"></div><button class=\\"btn sm\\" onclick=\\"metaSug(\\x27"+t.id+"\\x27)\\">💡 sugerir</button><button class=\\"btn primary sm\\" onclick=\\"doMeta(\\x27"+t.id+"\\x27)\\">guardar</button> <span class=\\"muted\\" id=\\"ms_"+t.id+"\\"></span></div></div>";});',
'  v.innerHTML="<div class=\\"card\\"><h2>Metas del día — "+h(ST.fecha)+"</h2><div class=\\"muted\\" style=\\"margin-bottom:10px\\">Elige la <b>OT del sistema</b> (export en proceso) y toca <b>💡 sugerir</b>: el estándar (teórico, prorrateado por tiempo productivo) propone la meta/hr; acéptala o ajústala. Ajustar pide motivo. Es la <b>misma meta</b> que usa el bot (no hay dos caminos).</div>"+rows+"</div>";}',
'async function metaSug(id){var ot=(document.getElementById("mo_"+id).value||"").trim();var ms=document.getElementById("ms_"+id);if(!ot){ms.textContent="elige la OT";return;}ms.textContent="…";var d=await post({action:"meta_suggest",linea_id:id,orden:ot});if(d&&d.ok&&d.sug){var s=d.sug;if(s.ok){SUG[id]=s.sugerida;document.getElementById("mm_"+id).value=s.sugerida;ms.innerHTML="sugerida <b>"+s.sugerida+"</b>/hr <span style=\\"color:#a1a1aa\\">("+h(s.proceso)+" @"+s.std_hr+" \\u00d7"+s.factor+")</span>";}else{SUG[id]=null;ms.textContent=s.motivo||"sin sugerencia";}}else if(d&&d.code=="auth"){logout();}else{ms.textContent=(d&&d.error)||"error";}}',
'async function doMeta(id){var ot=(document.getElementById("mo_"+id).value||"").trim();var m=document.getElementById("mm_"+id).value;if(!m){tj("Escribe la meta");return;}var sug=SUG[id];var motivo="";if(sug!=null&&Math.abs(Number(sug)-Number(m))>=1){motivo=prompt("Ajustaste la meta sugerida ("+sug+"/hr). \\u00bfPor qu\\u00e9? Queda registrado.");if(motivo==null||!motivo.trim()){tj("Ajustar la sugerida pide motivo");return;}}var d=await post({action:"set_meta",linea_id:id,orden:ot,meta:m,meta_sugerida:(sug==null?"":sug),motivo:motivo});if(d.ok){tj("Meta guardada \\u2713");await load();go("metas");}else if(d.code=="auth"){logout();}else tj(d.error||"no se pudo");}',
// ----- V1.5: capturar/editar estándar (gobierno: Gaby) -----
'var ESTPROC=[["PP_481","P&P 481"],["PP_520","P&P 520"],["PP_411_481","P&P 411-481"],["PP_421","P&P 421"],["ENSAMBLE_MANUAL","Ensamble Manual"],["WAVE_SOLDER","Wave/Ola"],["SOLDEO_MANUAL","Soldeo Manual"],["ICT","ICT"],["GRB","Grabación"],["CONFORMAL","Conformal"],["LIMPIEZA","Limpieza"],["FCT","FCT"],["ENSAMBLES","Ensambles"],["PRUEBA_FCT","Prueba FCT"],["EMPAQUE","Empaque"]];',
'function estOpts(list){return list.map(function(p){return "<option value=\\""+h(p.np)+"\\">"+h(p.np)+(p.desc?" \\u00b7 "+h(String(p.desc).slice(0,40)):"")+"</option>";}).join("");}',
'function renderEstandar(v){if(!(ME&&(ME.es_admin||ME.puede_estandar))){v.innerHTML="<div class=\\"card\\"><div class=\\"muted\\">Solo Gaby edita el est\\u00e1ndar.</div></div>";return;}',
'  var EP=ST.estParts||[];var prio=EP.filter(function(p){return p.nstd===0&&p.enOt;});var sin=EP.filter(function(p){return p.nstd===0&&!p.enOt;});var con=EP.filter(function(p){return p.nstd>0;});',
'  var sel="<select id=\\"estpick\\" style=\\"min-width:260px\\"><option value=\\"\\">\\u2014 elige una parte \\u2014</option>"+(prio.length?"<optgroup label=\\"\\u26a0 Sin est\\u00e1ndar \\u00b7 de OT en proceso ("+prio.length+")\\">"+estOpts(prio)+"</optgroup>":"")+(sin.length?"<optgroup label=\\"Sin est\\u00e1ndar ("+sin.length+")\\">"+estOpts(sin)+"</optgroup>":"")+(con.length?"<optgroup label=\\"Con est\\u00e1ndar \\u2014 editar ("+con.length+")\\">"+estOpts(con)+"</optgroup>":"")+"</select>";',
'  v.innerHTML="<div class=\\"card\\"><h2>Capturar / editar est\\u00e1ndar por hora</h2><div class=\\"muted\\" style=\\"margin-bottom:10px\\">Llena el Std/Hr (pz/hr te\\u00f3ricas) de cada estaci\\u00f3n. Se guarda al salir del campo. Vac\\u00edo = borra. Las partes \\u26a0 <b>de OT en proceso</b> son prioridad: al llenarlas, su meta sale sola.</div><div class=\\"row\\">"+sel+" <span id=\\"estinfo\\" class=\\"muted\\"></span></div><div id=\\"estgrid\\" style=\\"margin-top:12px\\"></div></div>";',
'  var pick=document.getElementById("estpick");pick.onchange=function(){estGrid(pick.value);};if(prio.length){pick.value=prio[0].np;estGrid(prio[0].np);}}',
'function estGrid(np){var info=document.getElementById("estinfo");var g=document.getElementById("estgrid");if(!np){g.innerHTML="";if(info)info.textContent="";return;}var cur=(ST.estMap||{})[np]||{};var pp=(ST.estParts||[]).filter(function(x){return x.np===np;})[0]||{};if(info)info.innerHTML=pp.enOt?"<span class=\\"pill no\\">en OT en proceso</span>":"";',
'  g.innerHTML="<div style=\\"display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px\\">"+ESTPROC.map(function(pc){var val=cur[pc[0]];var has=val!=null;return "<div style=\\"border:1px solid var(--bd);border-radius:10px;padding:9px 11px\\"><div class=\\"muted\\" style=\\"font-weight:700\\">"+h(pc[1])+(has?"":" \\u00b7 vac\\u00edo")+"</div><input type=\\"number\\" min=\\"0\\" step=\\"0.1\\" value=\\""+(has?val:"")+"\\" id=\\"es_"+pc[0]+"\\" style=\\"width:100%;margin-top:5px\\"><div class=\\"muted\\" id=\\"esm_"+pc[0]+"\\" style=\\"min-height:13px;font-size:11px\\"></div></div>";}).join("")+"</div>";',
'  ESTPROC.forEach(function(pc){var inp=document.getElementById("es_"+pc[0]);if(!inp)return;inp.onchange=function(){doEstandar(np,pc[0],inp.value,pp.desc||"");};});}',
'async function doEstandar(np,proc,val,desc){var msg=document.getElementById("esm_"+proc);if(msg)msg.textContent="guardando\\u2026";var d=await post({action:"set_estandar",numero_parte:np,proceso:proc,std_hr:val,descripcion:desc});if(d&&d.ok){if(msg)msg.textContent=d.cleared?"borrado":"guardado \\u2713";ST.estMap=ST.estMap||{};ST.estMap[np]=ST.estMap[np]||{};if(d.cleared){delete ST.estMap[np][proc];}else{ST.estMap[np][proc]=d.std;}}else if(d&&d.code=="auth"){logout();}else{if(msg)msg.textContent=(d&&d.error)||"error";}}',
'function rolSel(id,sel){var R=["paros","faltantes","calidad","mantenimiento","direccion"];return "<select id=\\""+id+"\\">"+R.map(function(r){return "<option"+(sel==r?" selected":"")+">"+r+"</option>";}).join("")+"</select>";}',
'function grpSel(id,sel){var G=["SMT","PTH","EMPAQUE","EMBARQUES"];if(sel&&G.indexOf(sel)<0)G=G.concat([sel]);var ph=sel?"":"<option value=\\"\\">— elige categoría —</option>";return "<select id=\\""+id+"\\">"+ph+G.map(function(g){return "<option"+(sel==g?" selected":"")+">"+g+"</option>";}).join("")+"</select>";}',
'function pSel(id,sel){return "<select id=\\""+id+"\\"><option value=\\"\\">— sin líder —</option>"+ST.personas.map(function(p){return "<option value=\\""+p.id+"\\""+(sel==p.id?" selected":"")+">"+h(p.nombre)+"</option>";}).join("")+"</select>";}',
'function renderTableros(v){var rows=ST.tableros.map(function(t){return "<div class=\\"tline\\"><div><b>"+h(t.nombre)+"</b> <span class=\\"muted\\">"+h(t.grupo)+" · "+h(t.unidad)+" · "+h(t.captura)+"</span></div><button class=\\"btn sm\\" onclick=\\"editBoard(\\x27"+t.id+"\\x27)\\">editar</button></div>";}).join("");',
'  v.innerHTML="<div class=\\"card\\"><h2>Tableros activos</h2>"+rows+"</div><div class=\\"card\\"><h2>Nuevo tablero</h2><div class=\\"row\\"><div class=\\"field\\"><label>Nombre</label><input id=\\"n_nom\\"></div><div class=\\"field\\"><label>Grupo</label>"+grpSel("n_grp","")+"</div><div class=\\"field\\"><label>Unidad</label><input id=\\"n_uni\\" value=\\"piezas\\" style=\\"width:100px\\"></div><div class=\\"field\\"><label>Captura</label><select id=\\"n_cap\\"><option value=\\"conteo\\">conteo</option><option value=\\"tarjetas\\">tarjetas</option></select></div><div class=\\"field\\"><label>Supervisor</label>"+rolSel("n_sup","paros")+"</div><div class=\\"field\\"><label>Líder</label>"+pSel("n_lid","")+"</div><button class=\\"btn primary\\" onclick=\\"doCreate()\\">Crear</button></div></div>";}',
'function editBoard(id){var t=ST.tableros.filter(function(x){return x.id==id;})[0];if(!t)return;event.target.parentNode.outerHTML="<div class=\\"tline\\" style=\\"display:block\\"><div class=\\"row\\"><div class=\\"field\\"><label>Nombre</label><input id=\\"e_nom\\" value=\\""+h(t.nombre)+"\\"></div><div class=\\"field\\"><label>Grupo</label>"+grpSel("e_grp",t.grupo)+"</div><div class=\\"field\\"><label>Unidad</label><input id=\\"e_uni\\" value=\\""+h(t.unidad)+"\\" style=\\"width:100px\\"></div><div class=\\"field\\"><label>Captura</label><select id=\\"e_cap\\"><option value=\\"conteo\\""+(t.captura!="tarjetas"?" selected":"")+">conteo</option><option value=\\"tarjetas\\""+(t.captura=="tarjetas"?" selected":"")+">tarjetas</option></select></div><div class=\\"field\\"><label>Supervisor</label>"+rolSel("e_sup",t.supervisor_rol)+"</div><button class=\\"btn primary sm\\" onclick=\\"doUpdate(\\x27"+id+"\\x27)\\">Guardar</button> <button class=\\"btn sm\\" onclick=\\"doDeact(\\x27"+id+"\\x27)\\">desactivar</button></div></div>";}',
'async function doCreate(){var nom=document.getElementById("n_nom").value;if(!nom){tj("Falta el nombre");return;}var grp=document.getElementById("n_grp").value;if(!grp){tj("Elige una categoría");return;}var d=await post({action:"create_board",nombre:nom,grupo:grp,unidad:document.getElementById("n_uni").value,captura:document.getElementById("n_cap").value,supervisor_rol:document.getElementById("n_sup").value,lider_persona_id:document.getElementById("n_lid").value});if(d.ok){tj("Tablero creado ✓");await load();}else if(d.code=="auth"){logout();}else tj(d.error||"no se pudo");}',
'async function doUpdate(id){var d=await post({action:"update_board",linea_id:id,nombre:document.getElementById("e_nom").value,grupo:document.getElementById("e_grp").value,unidad:document.getElementById("e_uni").value,captura:document.getElementById("e_cap").value,supervisor_rol:document.getElementById("e_sup").value});if(d.ok){tj("Guardado ✓");await load();}else tj(d.error||"no se pudo");}',
'async function doDeact(id){if(!confirm("¿Desactivar este tablero? (el historial se conserva)"))return;var d=await post({action:"update_board",linea_id:id,activa:false});if(d.ok){tj("Desactivado ✓");await load();}else tj(d.error||"no se pudo");}',
'function renderAsignar(v){var rows=ST.tableros.map(function(t){return "<div class=\\"tline\\"><div><b>"+h(t.nombre)+"</b> <span class=\\"muted\\">"+h(t.grupo)+"</span></div><div>"+pSel("a_"+t.id,t.lider_persona_id||"")+" <button class=\\"btn sm\\" onclick=\\"doAssign(\\x27"+t.id+"\\x27)\\">asignar</button></div></div>";}).join("");v.innerHTML="<div class=\\"card\\"><h2>Asignar / reasignar líder</h2>"+rows+"</div>";}',
'function fmtDur(ms){if(ms==null||!isFinite(ms))return "—";var s=Math.max(0,Math.floor((Date.now()-ms)/1000));var hh=Math.floor(s/3600),mm=Math.floor((s%3600)/60),ss=s%60;return (hh>0?hh+"h ":"")+(mm<10&&hh>0?"0":"")+mm+"m "+(ss<10?"0":"")+ss+"s";}',
'function tickParos(){var els=document.querySelectorAll(".ptimer");for(var i=0;i<els.length;i++){els[i].textContent=fmtDur(Number(els[i].getAttribute("data-since")));}}',
'function renderParos(v){var P=(ST.paros||[]);var abiertos=P.filter(function(p){return p.estado=="abierto";});var cerr=P.filter(function(p){return p.estado!="abierto";});',
'  function tile(p){var ms=p.inicio_ms?Number(p.inicio_ms):null;var viejo=p.dias>0;var col=viejo?"#b91c1c":"#d97706";',
'   var who=p.owner?("escalado a <b>"+h(p.owner)+"</b>"):("<b style=\\x27color:#b91c1c\\x27>sin responsable activo ("+h(p.rol_owner||"paros")+")</b>");var rep=p.reporto?h(p.reporto):"\\u2014";',
'   return "<div style=\\"border:1px solid var(--bd);border-left:4px solid "+col+";border-radius:12px;padding:12px 14px;margin-bottom:10px;background:#fff\\"><div style=\\"display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap\\"><div><div style=\\"font-weight:700;font-size:15px\\">\\ud83d\\udccd "+h(p.tablero)+" <span class=\\"muted\\" style=\\"font-weight:400\\">\\u00b7 "+h(p.grupo)+"</span></div><div class=\\"muted\\" style=\\"margin-top:2px\\">"+h(p.causa)+" \\u00b7 report\\u00f3 <b>"+rep+"</b> \\u00b7 "+who+(viejo?" \\u00b7 <b style=\\x27color:#b91c1c\\x27>hace "+p.dias+" d\\u00eda(s)</b>":"")+"</div></div><div style=\\"text-align:right\\"><div class=\\"ptimer\\" data-since=\\""+(ms||"")+"\\" style=\\"font-variant-numeric:tabular-nums;font-weight:800;font-size:20px;color:"+col+"\\">"+fmtDur(ms)+"</div><div class=\\"muted\\" style=\\"font-size:11px\\">abierto \\u00b7 inici\\u00f3 "+h(p.inicio)+"</div></div></div><div style=\\"margin-top:10px\\"><button class=\\"btn primary sm\\" onclick=\\"doParo(\\x27"+p.id+"\\x27,\\x27cerrado\\x27)\\">Cerrar</button></div></div>";}',
'  var ab=abiertos.length?abiertos.map(tile).join(""):"<div class=\\"muted\\">No hay paros abiertos. \\ud83c\\udf89</div>";',
'  var cr=cerr.map(function(p){return "<div class=\\"tline\\"><div><b>"+h(p.tablero)+"</b> <span class=\\"muted\\">"+h(p.grupo)+" \\u00b7 "+h(p.causa)+" \\u00b7 cerr\\u00f3 "+h(p.fin||"")+(p.dur!=null?" ("+p.dur+" min)":"")+"</span></div><button class=\\"btn sm\\" onclick=\\"doParo(\\x27"+p.id+"\\x27,\\x27abierto\\x27)\\">Reabrir</button></div>";}).join("");',
'  v.innerHTML="<div class=\\"card\\"><h2>Paros vivos \\u2014 "+abiertos.length+" abierto(s)</h2><div class=\\"muted\\" style=\\"margin-bottom:10px\\">Tablero vivo: el cron\\u00f3metro corre solo. Rojo = de d\\u00eda(s) anteriores sin cerrar. \\u201cEscalado a\\u201d = a qui\\u00e9n se le notific\\u00f3 (due\\u00f1o por rol del tablero).</div>"+ab+"</div>"+(cr?"<div class=\\"card\\"><h2>Cerrados recientes</h2>"+cr+"</div>":"");tickParos();}',
'async function doParo(id,estado){if(!confirm(estado=="cerrado"?"¿Cerrar este paro?":"¿Reabrir este paro?"))return;var d=await post({action:"paro_estado",paro_id:id,estado:estado});if(d.ok){tj(estado=="cerrado"?"Paro cerrado ✓":"Paro reabierto ✓");await load();}else if(d.code=="auth"){logout();}else tj(d.error||"no se pudo");}',
'async function doAssign(id){var d=await post({action:"assign_board",linea_id:id,lider_persona_id:document.getElementById("a_"+id).value});if(d.ok){tj("Líder asignado ✓");await load();}else tj(d.error||"no se pudo");}',
'function renderPersonas(v){var rows=ST.personas.map(function(p){return "<div class=\\"tline\\"><div><b>"+h(p.nombre)+"</b> <span class=\\"muted\\">"+h(p.rol)+"</span> "+(p.es_admin?"<span class=\\x27pill\\x27>admin</span>":"")+" "+(p.has_pin?"<span class=\\x27pill\\x27>con PIN</span>":"<span class=\\x27pill no\\x27>sin PIN</span>")+"</div><div class=\\"row\\"><input id=\\"pin_"+p.id+"\\" inputmode=\\"numeric\\" maxlength=\\"8\\" placeholder=\\"PIN\\" style=\\"width:90px\\"><button class=\\"btn sm\\" onclick=\\"doSetPin(\\x27"+p.id+"\\x27)\\">"+(p.has_pin?"resetear":"asignar")+"</button><button class=\\"btn sm\\" onclick=\\"doAdmin(\\x27"+p.id+"\\x27,"+(p.es_admin?"false":"true")+")\\">"+(p.es_admin?"quitar admin":"hacer admin")+"</button></div></div>";}).join("");',
'  v.innerHTML="<div class=\\"card\\"><h2>Personas — PIN y admin</h2><div class=\\"muted\\" style=\\"margin-bottom:8px\\">Asigna un PIN (4–8 dígitos) y repártelo a cada quien. \\x27Resetear\\x27 cambia uno olvidado.</div>"+rows+"</div>";}',
'async function doSetPin(pid){var pin=document.getElementById("pin_"+pid).value;var d=await post({action:"set_pin",persona_id:pid,pin:pin});if(d.ok){tj("PIN asignado ✓");await load();}else if(d.code=="auth"){logout();}else tj(d.error||"no se pudo");}',
'async function doAdmin(pid,val){var d=await post({action:"toggle_admin",persona_id:pid,es_admin:val});if(d.ok){tj("Listo ✓");await load();}else tj(d.error||"no se pudo");}',
'async function renderPerfiles(v){v.innerHTML="<div class=\\"card\\"><div class=\\"muted\\">cargando perfiles…</div></div>";',
'  try{var r=await fetch(location.pathname+"?token="+encodeURIComponent(TK)+"&data=perfiles&s="+encodeURIComponent(S),{cache:"no-store"});var d=await r.json();}catch(e){v.innerHTML="<div class=\\"card\\"><div class=\\"empty\\">error</div></div>";return;}',
'  if(d.code=="auth"){logout();return;}if(!d.perfiles){v.innerHTML="<div class=\\"card\\"><div class=\\"empty\\">"+h(d.error||"sin acceso")+"</div></div>";return;}',
'  v.innerHTML="<div class=\\"muted\\" style=\\"margin-bottom:10px\\">Lo que aceptes/escribas aquí es lo ÚNICO que Horacio usa para personalizar (con tacto, nunca citado literal). Privado de RH.</div>"+d.perfiles.map(perfilCard).join("");}',
'function perfilCard(p){',
'  var sug=(p.sugeridos||[]).map(function(e){return "<div class=\\"tline\\"><div style=\\"flex:1\\">💡 "+h(e.insight)+" <span class=\\"muted\\">"+h(e.fecha)+(e.mood?" · "+h(e.mood):"")+"</span></div><div><button class=\\"btn sm primary\\" onclick=\\"doPE(\\x27"+e.id+"\\x27,\\x27aceptado\\x27)\\">aceptar</button> <button class=\\"btn sm\\" onclick=\\"doPE(\\x27"+e.id+"\\x27,\\x27descartado\\x27)\\">descartar</button></div></div>";}).join("");',
'  var acc=(p.aceptados||[]).map(function(e){return "<div class=\\"tline\\"><div style=\\"flex:1\\">✅ <span class=\\"muted\\">"+h(e.insight)+"</span></div><button class=\\"btn sm\\" onclick=\\"doPE(\\x27"+e.id+"\\x27,\\x27descartado\\x27)\\">quitar</button></div>";}).join("");',
'  var ficha=p.ficha?("<details style=\\"margin-top:8px\\"><summary class=\\"muted\\" style=\\"cursor:pointer\\">ver ficha (RH)</summary><pre style=\\"white-space:pre-wrap;font-size:11px;color:#52525b;max-height:220px;overflow:auto;border:1px solid var(--bd);border-radius:8px;padding:8px;margin-top:6px\\">"+h(p.ficha)+"</pre></details>"):"";',
'  return "<div class=\\"card\\"><h2 style=\\"text-transform:none;letter-spacing:0;font-size:14px;color:var(--tx)\\">"+h(p.nombre)+" <span class=\\"muted\\">· "+h(p.rol)+"</span></h2>"+',
'   "<label>Lo que Horacio recuerda de ella (curado)</label><textarea id=\\"apr_"+p.id+"\\" placeholder=\\"escribe aquí el resumen que Horacio usará…\\" style=\\"width:100%;min-height:54px;font:inherit;font-size:13px;padding:8px;border:1px solid var(--bd);border-radius:9px\\">"+h(p.aprendido||"")+"</textarea><div style=\\"margin:8px 0\\"><button class=\\"btn sm primary\\" onclick=\\"doApr(\\x27"+p.id+"\\x27)\\">Guardar</button></div>"+',
'   (sug?("<div class=\\"muted\\" style=\\"margin-top:6px\\">Sugeridos por revisar</div>"+sug):"")+(acc?("<div class=\\"muted\\" style=\\"margin-top:10px\\">Aceptados (Horacio los usa)</div>"+acc):"")+ficha+"</div>";}',
'async function doPE(id,estado){var d=await post({action:"perfil_estado",ev_id:id,estado:estado});if(d.ok){tj(estado=="aceptado"?"Aceptado ✓":"Hecho ✓");renderPerfiles(document.getElementById("view"));}else if(d.code=="auth"){logout();}else tj(d.error||"no se pudo");}',
'async function doApr(pid){var t=document.getElementById("apr_"+pid).value;var d=await post({action:"perfil_aprendido",persona_id:pid,aprendido:t});if(d.ok){tj("Guardado ✓");}else if(d.code=="auth"){logout();}else tj(d.error||"no se pudo");}',
'try{setWho();if(S){load();}else{showLogin();}setInterval(function(){if(S)load();},30000);setInterval(function(){if(TAB=="paros")tickParos();},1000);}catch(e){document.getElementById("sub").textContent="error al iniciar: "+e.message;}',
'</script></body></html>'
].join('');
return [{ json: { body: PAGE, contentType: 'text/html; charset=utf-8' } }];
