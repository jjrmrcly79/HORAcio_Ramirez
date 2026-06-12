// ============================================================
// Horacio — Bot (nodo Code único)  · Fase 2
// Workflow n8n: "Horacio - Webhook" · Webhook /horacio-hxh
// Flujos: alta auto-registro · HxH · Paros (escalamiento + acuse + cierre)
// Reemplaza <BOT_TOKEN> y <SERVICE_ROLE_KEY> en el nodo n8n (nunca en el repo).
// Code node corre "Run Once for All Items": usar $input.first().json, NO $json.
// ============================================================
const TG = 'https://api.telegram.org/bot<BOT_TOKEN>';
const PG = 'https://supabase.nexiasoluciones.com.mx/pg/query';
const SK = '<SERVICE_ROLE_KEY>';
const pgh = { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' };
const H = this.helpers;
const pg = async (q) => await H.httpRequest({ method: 'POST', url: PG, headers: pgh, body: { query: q }, json: true });
const tg = async (m, p) => await H.httpRequest({ method: 'POST', url: TG + '/' + m, body: p, json: true });
const esc = (s) => String(s == null ? '' : s).replace(/'/g, "''");
const rmKb = async (chat, mid) => { if (!mid) return; try { await tg('editMessageReplyMarkup', { chat_id: chat, message_id: mid, reply_markup: { inline_keyboard: [] } }); } catch (e) {} };

const __i = $input.first().json;
const b = __i.body || __i;
const msg = b.message || null;
const cbq = b.callback_query || null;
const fromU = (msg && msg.from) || (cbq && cbq.from) || {};
const tgname = [fromU.first_name, fromU.last_name].filter(Boolean).join(' ') || 'Líder';
const chat_id = (msg && msg.chat && msg.chat.id) || (cbq && cbq.message && cbq.message.chat && cbq.message.chat.id) || null;
const mid = (cbq && cbq.message && cbq.message.message_id) || null;
const text = (msg && msg.text) || '';
const data = (cbq && cbq.data) || '';
const cbid = (cbq && cbq.id) || '';
if (cbid) { try { await tg('answerCallbackQuery', { callback_query_id: cbid }); } catch (e) {} }

// ---- helpers de sesión y persona ----
const readSess = async () => {
  const s = await pg(`SELECT step, data FROM horacio.sesiones WHERE chat_id=${chat_id}`);
  if (!s || !s.length) return null;
  const r = s[0];
  r.d = (typeof r.data === 'string') ? JSON.parse(r.data) : r.data;
  return r;
};
const setSess = async (flujo, step, d) => {
  await pg(`INSERT INTO horacio.sesiones(chat_id,flujo,step,data,updated_at) VALUES(${chat_id},'${flujo}','${step}','${esc(JSON.stringify(d))}'::jsonb,now()) ON CONFLICT(chat_id) DO UPDATE SET flujo='${flujo}', step='${step}', data=EXCLUDED.data, updated_at=now()`);
};
// línea de la que esta persona es líder (si lo es)
const myLine = async () => {
  const r = await pg(`SELECT l.id AS linea_id, l.codigo, l.nombre FROM horacio.lineas l JOIN horacio.personas p ON p.id=l.lider_persona_id WHERE p.chat_id=${chat_id} AND p.activa LIMIT 1`);
  return (r && r.length) ? r[0] : null;
};
const menu = async (txt) => {
  await tg('sendMessage', { chat_id, text: txt || '¿Qué necesitas?', reply_markup: { inline_keyboard: [[{ text: '🛑 Reportar paro', callback_data: 'paro_start' }]] } });
};

// ---- routing ----
let action = 'ignore';
if (/^\/start\b/.test(text) || /^\/alta\b/.test(text)) action = 'start';
else if (/^\/menu\b/.test(text)) action = 'menu';
else if (/^\/dueno\b/.test(text)) action = 'dueno';
else if (/^\/ping\b/.test(text)) action = 'ping';
else if (data === 'hxh_si') action = 'si';
else if (data === 'hxh_no') action = 'no';
else if (data.startsWith('pz_')) action = 'pz';
else if (data.startsWith('c_')) action = 'causa';
else if (data.startsWith('alta_')) action = 'alta_pick';
else if (data.startsWith('rol_')) action = 'rol_pick';
else if (data === 'paro_start') action = 'paro_start';
else if (data.startsWith('pcausa_')) action = 'paro_causa';
else if (data.startsWith('ack_')) action = 'ack';
else if (data.startsWith('pclose_')) action = 'pclose';

// ===================== ALTA =====================
if (action === 'start') {
  const reg = await pg(`SELECT 1 FROM horacio.personas WHERE chat_id=${chat_id} LIMIT 1`);
  if (reg && reg.length) { await menu(`¿Cómo vamos, ${esc(tgname)}? Aquí estoy.`); return [{ json: { action: 'start-known' } }]; }
  const ls = await pg("SELECT codigo, nombre FROM horacio.lineas WHERE activa=true ORDER BY codigo");
  const rows = ls.map((l) => [{ text: l.nombre, callback_data: 'alta_' + l.codigo }]);
  await tg('sendMessage', { chat_id, text: `Hola, soy Horacio 👋 Soy tu compañero del hora por hora. ¿Qué línea llevas, ${esc(tgname)}?`, reply_markup: { inline_keyboard: rows } });
  return [{ json: { action } }];
}

if (action === 'alta_pick') {
  await rmKb(chat_id, mid);
  const codigo = data.slice(5);
  const lr = await pg(`SELECT id, lider_persona_id, nombre FROM horacio.lineas WHERE codigo='${esc(codigo)}'`);
  if (!lr || !lr.length) { await tg('sendMessage', { chat_id, text: 'Esa línea ya no está disponible.' }); return [{ json: { action: 'alta-noline' } }]; }
  const line = lr[0];
  if (line.lider_persona_id) {
    await pg(`UPDATE horacio.personas SET chat_id=${chat_id}, consentimiento=true, nombre=CASE WHEN nombre IS NULL OR nombre='' THEN '${esc(tgname)}' ELSE nombre END WHERE id='${line.lider_persona_id}'`);
  } else {
    const ins = await pg(`INSERT INTO horacio.personas(nombre,rol,chat_id,consentimiento,activa) VALUES('${esc(tgname)}','lider',${chat_id},true,true) RETURNING id`);
    await pg(`UPDATE horacio.lineas SET lider_persona_id='${ins[0].id}' WHERE id='${line.id}'`);
  }
  await menu(`Listo 🙌 Quedaste como líder de ${esc(line.nombre)}. Yo te aviso el hora por hora y tú me reportas paros. Usa /menu cuando quieras.`);
  return [{ json: { action } }];
}

if (action === 'dueno') {
  const roles = [['paros', 'Paros (Daniel)'], ['faltantes', 'Faltantes (almacén)'], ['calidad', 'Calidad (Marco)'], ['mantenimiento', 'Mantenimiento (JC)'], ['direccion', 'Dirección (Jorge)']];
  const rows = roles.map((r) => [{ text: r[1], callback_data: 'rol_' + r[0] }]);
  await tg('sendMessage', { chat_id, text: '¿Qué área cubres? (recibirás los avisos de esa área)', reply_markup: { inline_keyboard: rows } });
  return [{ json: { action } }];
}

if (action === 'rol_pick') {
  await rmKb(chat_id, mid);
  const rol = data.slice(4);
  const ex = await pg(`SELECT id FROM horacio.personas WHERE rol='${esc(rol)}' AND chat_id IS NULL ORDER BY created_at LIMIT 1`);
  if (ex && ex.length) {
    await pg(`UPDATE horacio.personas SET chat_id=${chat_id}, consentimiento=true WHERE id='${ex[0].id}'`);
  } else {
    await pg(`INSERT INTO horacio.personas(nombre,rol,chat_id,consentimiento,activa) VALUES('${esc(tgname)}','${esc(rol)}',${chat_id},true,true)`);
  }
  await tg('sendMessage', { chat_id, text: `Listo, ${esc(tgname)}. Te aviso lo de ${esc(rol)} en cuanto pase algo. Gracias 🙏` });
  return [{ json: { action } }];
}

if (action === 'menu') { await menu(); return [{ json: { action } }]; }

// ===================== PAROS =====================
if (action === 'paro_start') {
  await rmKb(chat_id, mid);
  const me = await myLine();
  if (!me) { await tg('sendMessage', { chat_id, text: 'Primero regístrate con /start para ligarte a tu línea.' }); return [{ json: { action: 'paro-noline' } }]; }
  const cs = await pg("SELECT codigo, boton_texto FROM horacio.causas_paro WHERE activa=true AND cuenta_como_paro=true ORDER BY orden");
  const rows = cs.map((c) => [{ text: c.boton_texto, callback_data: 'pcausa_' + c.codigo }]);
  await tg('sendMessage', { chat_id, text: `Va. ¿Qué causó el paro en ${esc(me.nombre)}?`, reply_markup: { inline_keyboard: rows } });
  return [{ json: { action } }];
}

if (action === 'paro_causa') {
  await rmKb(chat_id, mid);
  const codigo = data.slice(7);
  const me = await myLine();
  if (!me) { await tg('sendMessage', { chat_id, text: 'No encuentro tu línea. Haz /start.' }); return [{ json: { action: 'paro-noline' } }]; }
  const cinfo = await pg(`SELECT boton_texto, escala_a FROM horacio.causas_paro WHERE codigo='${esc(codigo)}'`);
  const causaTxt = cinfo[0].boton_texto;
  const escala = cinfo[0].escala_a;
  let owner = null;
  if (escala) {
    const o = await pg(`SELECT id, chat_id, nombre FROM horacio.personas WHERE rol='${esc(escala)}' AND chat_id IS NOT NULL AND activa LIMIT 1`);
    if (o && o.length) owner = o[0];
  }
  const ins = await pg(`INSERT INTO horacio.paros(linea_id,causa_codigo,ts_inicio,reporto_chat_id,escalado_a,estado) VALUES('${me.linea_id}','${esc(codigo)}',now(),${chat_id},${owner ? `'${owner.id}'` : 'NULL'},'abierto') RETURNING id`);
  const paroid = ins[0].id;
  if (owner) {
    await tg('sendMessage', { chat_id: owner.chat_id, text: `🛑 Paro en ${esc(me.nombre)}: ${causaTxt}. Acúsalo para que la líder sepa que vas.`, reply_markup: { inline_keyboard: [[{ text: 'Visto 👍', callback_data: 'ack_' + paroid }]] } });
  }
  const aviso = owner ? `Ya le avisé a ${esc(owner.nombre)}.` : '(Aún no hay responsable de esa área dado de alta — queda registrado.)';
  await tg('sendMessage', { chat_id, text: `Anotado el paro en ${esc(me.nombre)} (${causaTxt}). ${aviso} Cuando se resuelva, toca aquí:`, reply_markup: { inline_keyboard: [[{ text: '✅ Ya quedó', callback_data: 'pclose_' + paroid }]] } });
  return [{ json: { action, paroid } }];
}

if (action === 'ack') {
  await rmKb(chat_id, mid);
  const paroid = data.slice(4);
  const up = await pg(`UPDATE horacio.paros SET acuse_ts=now() WHERE id='${esc(paroid)}' AND acuse_ts IS NULL RETURNING reporto_chat_id`);
  if (up && up.length) {
    const who = await pg(`SELECT nombre FROM horacio.personas WHERE chat_id=${chat_id} ORDER BY (rol<>'lider') DESC LIMIT 1`);
    const nombre = (who && who.length) ? who[0].nombre : 'El responsable';
    await tg('sendMessage', { chat_id: up[0].reporto_chat_id, text: `${esc(nombre)} ya lo vio 👍 Va para allá.` });
  }
  return [{ json: { action } }];
}

if (action === 'pclose') {
  await rmKb(chat_id, mid);
  const paroid = data.slice(7);
  const r = await pg(`UPDATE horacio.paros SET ts_fin=now(), estado='cerrado', duracion_min=ROUND(EXTRACT(EPOCH FROM (now()-ts_inicio))/60.0)::numeric WHERE id='${esc(paroid)}' AND estado='abierto' RETURNING duracion_min`);
  if (r && r.length) {
    await tg('sendMessage', { chat_id, text: `Paro de ${r[0].duracion_min} min registrado. Gracias por avisar 🙏` });
  } else {
    await tg('sendMessage', { chat_id, text: 'Ese paro ya estaba cerrado.' });
  }
  return [{ json: { action } }];
}

// ===================== HxH =====================
if (action === 'ping') {
  const r = await pg("SELECT l.id AS linea_id, e.piezas_hora FROM horacio.lineas l JOIN horacio.estandares e ON e.linea_id=l.id WHERE l.codigo='SMT520' AND e.vigente=true LIMIT 1");
  const linea_id = r[0].linea_id;
  const plan = Number(r[0].piezas_hora);
  const now = DateTime.now().setZone('America/Mexico_City');
  const fecha = now.toFormat('yyyy-LL-dd');
  const slot = now.toFormat('HH:00');
  await setSess('hxh', 'hxh_meta', { linea_id, plan, fecha, slot });
  await tg('sendMessage', { chat_id, text: `¿Cómo vamos, Viri? SMT 520, ${slot}: ¿salió la meta (${plan})?`, reply_markup: { inline_keyboard: [[{ text: '✅ Sí', callback_data: 'hxh_si' }, { text: '❌ Faltó', callback_data: 'hxh_no' }]] } });
  return [{ json: { action } }];
}

if (action === 'si') {
  await rmKb(chat_id, mid);
  const s = await readSess();
  if (!s || s.step !== 'hxh_meta') { await tg('sendMessage', { chat_id, text: 'Manda /ping para empezar el hora por hora.' }); return [{ json: { action: 'si-guard' } }]; }
  const d = s.d;
  await pg(`INSERT INTO horacio.hora_por_hora(linea_id,fecha,hora_slot,plan,real,t_productivo_min,reporto_chat_id) VALUES('${d.linea_id}','${d.fecha}','${d.slot}',${d.plan},${d.plan},60,${chat_id})`);
  await setSess('hxh', 'idle', d);
  await tg('sendMessage', { chat_id, text: `Va, anotado 👍 ${d.plan}/${d.plan} en SMT 520 (${d.slot}). Gracias.` });
  return [{ json: { action } }];
}

if (action === 'no') {
  const s = await readSess();
  if (!s || s.step !== 'hxh_meta') { await tg('sendMessage', { chat_id, text: 'Manda /ping para empezar.' }); return [{ json: { action: 'no-guard' } }]; }
  await rmKb(chat_id, mid);
  await setSess('hxh', 'hxh_piezas', s.d);
  await tg('sendMessage', { chat_id, text: '¿Cuántas piezas faltaron?', reply_markup: { inline_keyboard: [[{ text: '1–25', callback_data: 'pz_0_25' }, { text: '26–50', callback_data: 'pz_26_50' }], [{ text: '51–75', callback_data: 'pz_51_75' }, { text: '76+', callback_data: 'pz_76p' }]] } });
  return [{ json: { action } }];
}

if (action === 'pz') {
  const s = await readSess();
  if (!s || s.step !== 'hxh_piezas') { return [{ json: { action: 'pz-guard' } }]; }
  await rmKb(chat_id, mid);
  const rango = data.slice(3);
  const d = Object.assign({}, s.d, { faltaron: rango });
  await setSess('hxh', 'hxh_causa', d);
  const cs = await pg("SELECT codigo, boton_texto FROM horacio.causas_paro WHERE activa=true ORDER BY orden");
  const rows = cs.map((c) => [{ text: c.boton_texto, callback_data: 'c_' + c.codigo }]);
  await tg('sendMessage', { chat_id, text: '¿Qué pasó? (elige una)', reply_markup: { inline_keyboard: rows } });
  return [{ json: { action } }];
}

if (action === 'causa') {
  const s = await readSess();
  if (!s || s.step !== 'hxh_causa') { return [{ json: { action: 'causa-guard' } }]; }
  await rmKb(chat_id, mid);
  const d = s.d;
  const codigo = data.slice(2);
  const mids = { '0_25': 13, '26_50': 38, '51_75': 63, '76p': 88 };
  const mid2 = mids[d.faltaron] != null ? mids[d.faltaron] : 0;
  const real = Math.max(d.plan - mid2, 0);
  await pg(`INSERT INTO horacio.hora_por_hora(linea_id,fecha,hora_slot,plan,real,t_productivo_min,causa_codigo,reporto_chat_id) VALUES('${d.linea_id}','${d.fecha}','${d.slot}',${d.plan},${real},60,'${esc(codigo)}',${chat_id})`);
  await setSess('hxh', 'idle', d);
  const ct = await pg(`SELECT boton_texto FROM horacio.causas_paro WHERE codigo='${esc(codigo)}'`);
  await tg('sendMessage', { chat_id, text: `Gracias por avisar 🙏 Anotado en SMT 520 (${d.slot}): ~${real}/${d.plan}, causa: ${ct[0].boton_texto}. Eso nos ayuda a arreglar la causa.` });
  return [{ json: { action } }];
}

return [{ json: { action: 'ignore', text, data } }];
