// ============================================================
// Horacio — Bot (nodo Code único)  · Día Uno
// Workflow n8n: "Horacio - Webhook" · Webhook /horacio-hxh
// Flujos líder: alta · HxH · Paros · Faltantes · Calidad
// Funciones admin (llamadas por el Scheduler vía HTTP con secreto):
//   ping_all · reminder_all · resumen_lider · resumen_dir
// Reemplaza <BOT_TOKEN> y <SERVICE_ROLE_KEY> en n8n (nunca en el repo).
// Code node corre "Run Once for All Items": usar $input.first().json, NO $json.
// ============================================================
const TG = 'https://api.telegram.org/bot<BOT_TOKEN>';
const PG = 'https://supabase.nexiasoluciones.com.mx/pg/query';
const SK = '<SERVICE_ROLE_KEY>';
const ADMIN_SECRET = '<ADMIN_SECRET>';
const pgh = { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' };
const H = this.helpers;
const pg = async (q) => await H.httpRequest({ method: 'POST', url: PG, headers: pgh, body: { query: q }, json: true });
const tg = async (m, p) => await H.httpRequest({ method: 'POST', url: TG + '/' + m, body: p, json: true });
const esc = (s) => String(s == null ? '' : s).replace(/'/g, "''");
const rmKb = async (chat, mid) => { if (!mid) return; try { await tg('editMessageReplyMarkup', { chat_id: chat, message_id: mid, reply_markup: { inline_keyboard: [] } }); } catch (e) {} };
const nowMX = () => DateTime.now().setZone('America/Mexico_City');

const __i = $input.first().json;
const b = __i.body || __i;

// ===================== ADMIN (scheduler) =====================
if (b && b.admin) {
  if (b.secret !== ADMIN_SECRET) return [{ json: { ok: false, error: 'bad secret' } }];
  const now = nowMX();
  const fecha = now.toFormat('yyyy-LL-dd');
  const slot = now.minus({ hours: 1 }).toFormat('HH:00'); // hora que acaba de cerrar
  const leaders = await pg("SELECT l.id AS linea_id, l.nombre, l.estandar_status, p.chat_id, (SELECT e.piezas_hora FROM horacio.estandares e WHERE e.linea_id=l.id AND e.vigente=true ORDER BY e.created_at DESC LIMIT 1) AS plan FROM horacio.lineas l JOIN horacio.personas p ON p.id=l.lider_persona_id WHERE l.activa=true AND p.activa=true AND p.chat_id IS NOT NULL");

  if (b.admin === 'ping_all') {
    let metered = 0, unmetered = 0;
    for (const L of leaders) {
      const plan = (L.plan == null) ? null : Number(L.plan); // NUNCA inventar meta
      // cerrar hueco: sesión abierta de un slot anterior => sin_dato
      const s = await pg(`SELECT step, data FROM horacio.sesiones WHERE chat_id=${L.chat_id}`);
      if (s && s.length) {
        const d0 = (typeof s[0].data === 'string') ? JSON.parse(s[0].data) : s[0].data;
        const open = ['hxh_meta', 'hxh_piezas', 'hxh_causa', 'hxh_real'].includes(s[0].step);
        if (open && d0 && d0.slot && d0.slot !== slot) {
          await pg(`INSERT INTO horacio.hora_por_hora(linea_id,fecha,hora_slot,plan,sin_dato,reporto_chat_id) VALUES('${L.linea_id}','${d0.fecha || fecha}','${d0.slot}',${(d0.plan != null) ? d0.plan : 'NULL'},true,${L.chat_id})`);
        }
      }
      if (plan != null) {
        const d = { linea_id: L.linea_id, plan, fecha, slot, reminded: false };
        await pg(`INSERT INTO horacio.sesiones(chat_id,flujo,step,data,updated_at) VALUES(${L.chat_id},'hxh','hxh_meta','${esc(JSON.stringify(d))}'::jsonb,now()) ON CONFLICT(chat_id) DO UPDATE SET flujo='hxh', step='hxh_meta', data=EXCLUDED.data, updated_at=now()`);
        await tg('sendMessage', { chat_id: L.chat_id, text: `¿Cómo vamos? ${L.nombre}, ${slot}: ¿salió la meta (${plan})?`, reply_markup: { inline_keyboard: [[{ text: '✅ Sí', callback_data: 'hxh_si' }, { text: '❌ Faltó', callback_data: 'hxh_no' }]] } });
        metered++;
      } else {
        const d = { linea_id: L.linea_id, plan: null, fecha, slot, reminded: false };
        await pg(`INSERT INTO horacio.sesiones(chat_id,flujo,step,data,updated_at) VALUES(${L.chat_id},'hxh','hxh_real','${esc(JSON.stringify(d))}'::jsonb,now()) ON CONFLICT(chat_id) DO UPDATE SET flujo='hxh', step='hxh_real', data=EXCLUDED.data, updated_at=now()`);
        await tg('sendMessage', { chat_id: L.chat_id, text: `¿Cómo vamos? ${L.nombre}, ${slot}: ¿cuántas piezas salieron? Escríbeme el número.` });
        unmetered++;
      }
    }
    return [{ json: { admin: 'ping_all', metered, unmetered } }];
  }

  if (b.admin === 'reminder_all') {
    let rem = 0;
    for (const L of leaders) {
      const s = await pg(`SELECT step, data FROM horacio.sesiones WHERE chat_id=${L.chat_id}`);
      if (!s || !s.length) continue;
      const d = (typeof s[0].data === 'string') ? JSON.parse(s[0].data) : s[0].data;
      if (['hxh_meta', 'hxh_real'].includes(s[0].step) && d && d.slot === slot && !d.reminded) {
        d.reminded = true;
        await pg(`UPDATE horacio.sesiones SET data='${esc(JSON.stringify(d))}'::jsonb, updated_at=now() WHERE chat_id=${L.chat_id}`);
        if (s[0].step === 'hxh_meta') await tg('sendMessage', { chat_id: L.chat_id, text: `Cuando puedas, ${L.nombre} ${slot}: ¿salió la meta? Es rápido 🙏`, reply_markup: { inline_keyboard: [[{ text: '✅ Sí', callback_data: 'hxh_si' }, { text: '❌ Faltó', callback_data: 'hxh_no' }]] } });
        else await tg('sendMessage', { chat_id: L.chat_id, text: `Cuando puedas, ${L.nombre} ${slot}: ¿cuántas piezas salieron? Solo el número 🙏` });
        rem++;
      }
    }
    return [{ json: { admin: 'reminder_all', rem } }];
  }

  if (b.admin === 'resumen_lider') {
    let sent = 0;
    for (const L of leaders) {
      const hxh = await pg(`SELECT hora_slot, plan, real, sin_dato, causa_codigo FROM horacio.hora_por_hora WHERE linea_id='${L.linea_id}' AND fecha='${fecha}' ORDER BY hora_slot`);
      const paros = await pg(`SELECT COUNT(*)::int AS n, COALESCE(SUM(duracion_min),0)::int AS min FROM horacio.paros WHERE linea_id='${L.linea_id}' AND ts_inicio::date='${fecha}'`);
      const falt = await pg(`SELECT COUNT(*) FILTER (WHERE estado<>'cerrado')::int AS abiertos, COUNT(*) FILTER (WHERE estado='cerrado')::int AS cerrados FROM horacio.faltantes WHERE linea_id='${L.linea_id}' AND ts_reporte::date='${fecha}'`);
      let tp = 0, tr = 0, lines = [];
      for (const h of hxh) {
        const p = Number(h.plan || 0), r = h.sin_dato ? null : Number(h.real || 0);
        tp += p; if (r != null) tr += r;
        lines.push(`• ${h.hora_slot}: ${h.sin_dato ? 'sin dato' : (r + '/' + p)}${h.causa_codigo ? ' (' + h.causa_codigo + ')' : ''}`);
      }
      const pct = tp > 0 ? Math.round(tr / tp * 100) : null;
      const txt = `📋 Tu resumen de hoy — ${L.nombre}\n${lines.join('\n') || '(sin registros)'}\n\nTotal: ${tr}/${tp}${pct != null ? ' (' + pct + '%)' : ''}\nParos: ${paros[0].n} (${paros[0].min} min)\nFaltantes: ${falt[0].abiertos} abiertos, ${falt[0].cerrados} resueltos\n\nGracias por tu trabajo de hoy 🙌\n— Horacio`;
      await tg('sendMessage', { chat_id: L.chat_id, text: txt });
      sent++;
    }
    return [{ json: { admin: 'resumen_lider', sent } }];
  }

  if (b.admin === 'resumen_dir') {
    const dir = await pg("SELECT chat_id, nombre FROM horacio.personas WHERE rol='direccion' AND chat_id IS NOT NULL AND activa LIMIT 1");
    if (!dir || !dir.length) return [{ json: { admin: 'resumen_dir', skip: 'sin direccion' } }];
    const lineas = await pg("SELECT id, nombre FROM horacio.lineas WHERE activa=true ORDER BY codigo");
    let blocks = [];
    for (const L of lineas) {
      const agg = await pg(`SELECT COALESCE(SUM(plan),0)::int AS plan, COALESCE(SUM(real) FILTER (WHERE NOT sin_dato),0)::int AS real, COUNT(*) FILTER (WHERE sin_dato)::int AS sd FROM horacio.hora_por_hora WHERE linea_id='${L.id}' AND fecha='${fecha}'`);
      const paros = await pg(`SELECT COUNT(*)::int AS n, COALESCE(SUM(duracion_min),0)::int AS min FROM horacio.paros WHERE linea_id='${L.id}' AND ts_inicio::date='${fecha}'`);
      const falt = await pg(`SELECT COUNT(*) FILTER (WHERE estado<>'cerrado')::int AS ab FROM horacio.faltantes WHERE linea_id='${L.id}' AND ts_reporte::date='${fecha}'`);
      const P = agg[0].plan, R = agg[0].real;
      if (P === 0 && paros[0].n === 0 && falt[0].ab === 0) continue; // sin actividad hoy
      const pct = P > 0 ? Math.round(R / P * 100) : null;
      const sem = pct == null ? '⚪' : (pct >= 95 ? '🟢' : (pct >= 80 ? '🟡' : '🔴'));
      blocks.push(`${sem} ${L.nombre}: ${R}/${P}${pct != null ? ' (' + pct + '%)' : ''} · paros ${paros[0].n} (${paros[0].min}m) · faltantes ${falt[0].ab}${agg[0].sd ? ' · ' + agg[0].sd + ' sin dato' : ''}`);
    }
    const txt = `📊 Resumen del día — ${fecha}\n\n${blocks.join('\n') || '(sin actividad registrada)'}\n\n— Horacio`;
    await tg('sendMessage', { chat_id: dir[0].chat_id, text: txt });
    return [{ json: { admin: 'resumen_dir', lineas: blocks.length } }];
  }
  return [{ json: { ok: false, error: 'unknown admin' } }];
}

// ===================== MENSAJES DE USUARIO =====================
const msg = b.message || null;
const cbq = b.callback_query || null;
const fromU = (msg && msg.from) || (cbq && cbq.from) || {};
const tgname = [fromU.first_name, fromU.last_name].filter(Boolean).join(' ') || 'Líder';
const chat_id = (msg && msg.chat && msg.chat.id) || (cbq && cbq.message && cbq.message.chat && cbq.message.chat.id) || null;
const mid = (cbq && cbq.message && cbq.message.message_id) || null;
const text = (msg && msg.text) || '';
const photo = (msg && msg.photo && msg.photo.length) ? msg.photo[msg.photo.length - 1].file_id : null;
const data = (cbq && cbq.data) || '';
const cbid = (cbq && cbq.id) || '';
if (cbid) { try { await tg('answerCallbackQuery', { callback_query_id: cbid }); } catch (e) {} }

const readSess = async () => {
  const s = await pg(`SELECT step, flujo, data FROM horacio.sesiones WHERE chat_id=${chat_id}`);
  if (!s || !s.length) return null;
  const r = s[0];
  r.d = (typeof r.data === 'string') ? JSON.parse(r.data) : r.data;
  return r;
};
const setSess = async (flujo, step, d) => {
  await pg(`INSERT INTO horacio.sesiones(chat_id,flujo,step,data,updated_at) VALUES(${chat_id},'${flujo}','${step}','${esc(JSON.stringify(d))}'::jsonb,now()) ON CONFLICT(chat_id) DO UPDATE SET flujo='${flujo}', step='${step}', data=EXCLUDED.data, updated_at=now()`);
};
const myLine = async () => {
  const r = await pg(`SELECT l.id AS linea_id, l.codigo, l.nombre FROM horacio.lineas l JOIN horacio.personas p ON p.id=l.lider_persona_id WHERE p.chat_id=${chat_id} AND p.activa LIMIT 1`);
  return (r && r.length) ? r[0] : null;
};
const menu = async (txt) => {
  await tg('sendMessage', { chat_id, text: txt || '¿Qué necesitas?', reply_markup: { inline_keyboard: [[{ text: '🛑 Reportar paro', callback_data: 'paro_start' }], [{ text: '📦 Falta material', callback_data: 'falt_start' }], [{ text: '🔎 Reportar calidad', callback_data: 'cal_start' }]] } });
};
const askLine = async () => {
  const ls = await pg("SELECT codigo, nombre FROM horacio.lineas WHERE activa=true ORDER BY codigo");
  const rows = ls.map((l) => [{ text: l.nombre, callback_data: 'alta_' + l.codigo }]);
  await tg('sendMessage', { chat_id, text: `Va. ¿Qué línea llevas, ${esc(tgname)}?`, reply_markup: { inline_keyboard: rows } });
};
const askArea = async () => {
  const roles = [['paros', 'Paros (Daniel)'], ['faltantes', 'Materiales / Faltantes (Nayeli)'], ['calidad', 'Calidad (Marco)'], ['mantenimiento', 'Mantenimiento (JC)'], ['direccion', 'Dirección (Jorge)']];
  const rows = roles.map((r) => [{ text: r[1], callback_data: 'rol_' + r[0] }]);
  await tg('sendMessage', { chat_id, text: '¿Qué área cubres? (recibirás los avisos de esa área)', reply_markup: { inline_keyboard: rows } });
};

let action = 'ignore';
const cmd = text.trim().split(' ')[0];
if (cmd === '/start' || cmd === '/alta') action = 'start';
else if (cmd === '/menu') action = 'menu';
else if (cmd === '/dueno') action = 'dueno';
else if (cmd === '/ping') action = 'ping';
else if (data === 'hxh_si') action = 'si';
else if (data === 'hxh_no') action = 'no';
else if (data.startsWith('pz_')) action = 'pz';
else if (data.startsWith('c_')) action = 'causa';
else if (data === 'reg_linea') action = 'reg_linea';
else if (data === 'reg_area') action = 'reg_area';
else if (data.startsWith('alta_')) action = 'alta_pick';
else if (data.startsWith('rol_')) action = 'rol_pick';
else if (data === 'paro_start') action = 'paro_start';
else if (data.startsWith('pcausa_')) action = 'paro_causa';
else if (data.startsWith('ack_')) action = 'ack';
else if (data.startsWith('pclose_')) action = 'pclose';
else if (data === 'falt_start') action = 'falt_start';
else if (data.startsWith('fack_')) action = 'fack';
else if (data.startsWith('fdone_')) action = 'fdone';
else if (data === 'cal_start') action = 'cal_start';
else if (data.startsWith('cack_')) action = 'cack';

// ---- ALTA ----
if (action === 'start') {
  const reg = await pg(`SELECT 1 FROM horacio.personas WHERE chat_id=${chat_id} LIMIT 1`);
  if (reg && reg.length) { await menu(`¿Cómo vamos, ${esc(tgname)}? Aquí estoy.`); return [{ json: { action: 'start-known' } }]; }
  await tg('sendMessage', { chat_id, text: `Hola, soy Horacio 👋 Soy tu compañero del hora por hora. Para empezar, ${esc(tgname)}: ¿qué llevas a tu cargo?`, reply_markup: { inline_keyboard: [[{ text: '📋 Una línea de producción', callback_data: 'reg_linea' }], [{ text: '🔔 Un área de apoyo', callback_data: 'reg_area' }]] } });
  return [{ json: { action } }];
}
if (action === 'reg_linea') { await rmKb(chat_id, mid); await askLine(); return [{ json: { action } }]; }
if (action === 'reg_area') { await rmKb(chat_id, mid); await askArea(); return [{ json: { action } }]; }
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
  await menu(`Listo 🙌 Quedaste como líder de ${esc(line.nombre)}. Yo te aviso el hora por hora y tú me reportas paros, faltantes y calidad. Usa /menu cuando quieras.`);
  return [{ json: { action } }];
}
if (action === 'dueno') { await askArea(); return [{ json: { action } }]; }
if (action === 'rol_pick') {
  await rmKb(chat_id, mid);
  const rol = data.slice(4);
  const ex = await pg(`SELECT id FROM horacio.personas WHERE rol='${esc(rol)}' AND chat_id IS NULL ORDER BY created_at LIMIT 1`);
  if (ex && ex.length) await pg(`UPDATE horacio.personas SET chat_id=${chat_id}, consentimiento=true WHERE id='${ex[0].id}'`);
  else await pg(`INSERT INTO horacio.personas(nombre,rol,chat_id,consentimiento,activa) VALUES('${esc(tgname)}','${esc(rol)}',${chat_id},true,true)`);
  await tg('sendMessage', { chat_id, text: `Listo, ${esc(tgname)}. Te aviso lo de ${esc(rol)} en cuanto pase algo. Gracias 🙏` });
  return [{ json: { action } }];
}
if (action === 'menu') { await menu(); return [{ json: { action } }]; }

// ---- PAROS ----
if (action === 'paro_start') {
  await rmKb(chat_id, mid);
  const me = await myLine();
  if (!me) { await tg('sendMessage', { chat_id, text: 'Primero regístrate con /start.' }); return [{ json: { action: 'paro-noline' } }]; }
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
  const causaTxt = cinfo[0].boton_texto, escala = cinfo[0].escala_a;
  let owner = null;
  if (escala) { const o = await pg(`SELECT id, chat_id, nombre FROM horacio.personas WHERE rol='${esc(escala)}' AND chat_id IS NOT NULL AND activa LIMIT 1`); if (o && o.length) owner = o[0]; }
  const ins = await pg(`INSERT INTO horacio.paros(linea_id,causa_codigo,ts_inicio,reporto_chat_id,escalado_a,estado) VALUES('${me.linea_id}','${esc(codigo)}',now(),${chat_id},${owner ? `'${owner.id}'` : 'NULL'},'abierto') RETURNING id`);
  const paroid = ins[0].id;
  if (owner) await tg('sendMessage', { chat_id: owner.chat_id, text: `🛑 Paro en ${esc(me.nombre)}: ${causaTxt}. Acúsalo para que la líder sepa que vas.`, reply_markup: { inline_keyboard: [[{ text: 'Visto 👍', callback_data: 'ack_' + paroid }]] } });
  const aviso = owner ? `Ya le avisé a ${esc(owner.nombre)}.` : '(Aún no hay responsable de esa área dado de alta — queda registrado.)';
  await tg('sendMessage', { chat_id, text: `Anotado el paro en ${esc(me.nombre)} (${causaTxt}). ${aviso} Cuando se resuelva, toca aquí:`, reply_markup: { inline_keyboard: [[{ text: '✅ Ya quedó', callback_data: 'pclose_' + paroid }]] } });
  return [{ json: { action, paroid } }];
}
if (action === 'ack') {
  await rmKb(chat_id, mid);
  const paroid = data.slice(4);
  const up = await pg(`UPDATE horacio.paros SET acuse_ts=now() WHERE id='${esc(paroid)}' AND acuse_ts IS NULL RETURNING reporto_chat_id`);
  if (up && up.length) { const who = await pg(`SELECT nombre FROM horacio.personas WHERE chat_id=${chat_id} ORDER BY (rol<>'lider') DESC LIMIT 1`); const nombre = (who && who.length) ? who[0].nombre : 'El responsable'; await tg('sendMessage', { chat_id: up[0].reporto_chat_id, text: `${esc(nombre)} ya lo vio 👍 Va para allá.` }); }
  return [{ json: { action } }];
}
if (action === 'pclose') {
  await rmKb(chat_id, mid);
  const paroid = data.slice(7);
  const r = await pg(`UPDATE horacio.paros SET ts_fin=now(), estado='cerrado', duracion_min=ROUND(EXTRACT(EPOCH FROM (now()-ts_inicio))/60.0)::numeric WHERE id='${esc(paroid)}' AND estado='abierto' RETURNING duracion_min`);
  if (r && r.length) await tg('sendMessage', { chat_id, text: `Paro de ${r[0].duracion_min} min registrado. Gracias por avisar 🙏` });
  else await tg('sendMessage', { chat_id, text: 'Ese paro ya estaba cerrado.' });
  return [{ json: { action } }];
}

// ---- FALTANTES ----
if (action === 'falt_start') {
  await rmKb(chat_id, mid);
  const me = await myLine();
  if (!me) { await tg('sendMessage', { chat_id, text: 'Primero regístrate con /start.' }); return [{ json: { action: 'falt-noline' } }]; }
  await setSess('faltante', 'falt_parte', { linea_id: me.linea_id, lnombre: me.nombre });
  await tg('sendMessage', { chat_id, text: '📦 Va. ¿Qué número de parte falta? Escríbelo o mándame foto de la etiqueta.' });
  return [{ json: { action } }];
}
if (action === 'fack') {
  await rmKb(chat_id, mid);
  const id = data.slice(5);
  const up = await pg(`UPDATE horacio.faltantes SET acuse_ts=now() WHERE id='${esc(id)}' AND acuse_ts IS NULL RETURNING reporto_chat_id, numero_parte`);
  if (up && up.length) await tg('sendMessage', { chat_id: up[0].reporto_chat_id, text: `Tu faltante${up[0].numero_parte ? ' de ' + esc(up[0].numero_parte) : ''} ya se está surtiendo 👍` });
  return [{ json: { action } }];
}
if (action === 'fdone') {
  await rmKb(chat_id, mid);
  const id = data.slice(6);
  const up = await pg(`UPDATE horacio.faltantes SET estado='cerrado', ts_resuelto=now() WHERE id='${esc(id)}' AND estado<>'cerrado' RETURNING reporto_chat_id, numero_parte`);
  if (up && up.length) await tg('sendMessage', { chat_id: up[0].reporto_chat_id, text: `✅ Tu faltante${up[0].numero_parte ? ' de ' + esc(up[0].numero_parte) : ''} ya se surtió. ¡Gracias por tu paciencia!` });
  return [{ json: { action } }];
}

// ---- CALIDAD ----
if (action === 'cal_start') {
  await rmKb(chat_id, mid);
  const me = await myLine();
  if (!me) { await tg('sendMessage', { chat_id, text: 'Primero regístrate con /start.' }); return [{ json: { action: 'cal-noline' } }]; }
  await setSess('calidad', 'cal_descripcion', { linea_id: me.linea_id, lnombre: me.nombre });
  await tg('sendMessage', { chat_id, text: '🔎 Cuéntame qué pasó con la calidad (escríbelo en un mensaje).' });
  return [{ json: { action } }];
}
if (action === 'cack') {
  await rmKb(chat_id, mid);
  const id = data.slice(5);
  const up = await pg(`UPDATE horacio.calidad SET acuse_ts=now() WHERE id='${esc(id)}' AND acuse_ts IS NULL RETURNING reporto_chat_id`);
  if (up && up.length) await tg('sendMessage', { chat_id: up[0].reporto_chat_id, text: 'Marco ya lo tiene 👍' });
  return [{ json: { action } }];
}

// ---- HxH ----
if (action === 'ping') {
  const r = await pg("SELECT l.id AS linea_id, l.nombre, e.piezas_hora FROM horacio.lineas l LEFT JOIN horacio.estandares e ON e.linea_id=l.id AND e.vigente=true WHERE l.codigo='SMT' LIMIT 1");
  const linea_id = r[0].linea_id, plan = r[0].piezas_hora != null ? Number(r[0].piezas_hora) : null, lnombre = r[0].nombre;
  const now = nowMX(); const fecha = now.toFormat('yyyy-LL-dd'); const slot = now.toFormat('HH:00');
  if (plan != null) {
    await setSess('hxh', 'hxh_meta', { linea_id, plan, fecha, slot });
    await tg('sendMessage', { chat_id, text: `¿Cómo vamos? ${lnombre}, ${slot}: ¿salió la meta (${plan})?`, reply_markup: { inline_keyboard: [[{ text: '✅ Sí', callback_data: 'hxh_si' }, { text: '❌ Faltó', callback_data: 'hxh_no' }]] } });
  } else {
    await setSess('hxh', 'hxh_real', { linea_id, plan: null, fecha, slot });
    await tg('sendMessage', { chat_id, text: `¿Cómo vamos? ${lnombre}, ${slot}: ¿cuántas piezas salieron? Escríbeme el número.` });
  }
  return [{ json: { action } }];
}
if (action === 'si') {
  await rmKb(chat_id, mid);
  const s = await readSess();
  if (!s || s.step !== 'hxh_meta') { await tg('sendMessage', { chat_id, text: 'Espera el ping del hora por hora 🙏' }); return [{ json: { action: 'si-guard' } }]; }
  const d = s.d;
  await pg(`INSERT INTO horacio.hora_por_hora(linea_id,fecha,hora_slot,plan,real,t_productivo_min,reporto_chat_id) VALUES('${d.linea_id}','${d.fecha}','${d.slot}',${d.plan},${d.plan},60,${chat_id})`);
  await setSess('hxh', 'idle', d);
  await tg('sendMessage', { chat_id, text: `Va, anotado 👍 ${d.plan}/${d.plan} (${d.slot}). Gracias.` });
  return [{ json: { action } }];
}
if (action === 'no') {
  const s = await readSess();
  if (!s || s.step !== 'hxh_meta') { await tg('sendMessage', { chat_id, text: 'Espera el ping del hora por hora 🙏' }); return [{ json: { action: 'no-guard' } }]; }
  await rmKb(chat_id, mid);
  await setSess('hxh', 'hxh_piezas', s.d);
  await tg('sendMessage', { chat_id, text: '¿Cuántas piezas faltaron?', reply_markup: { inline_keyboard: [[{ text: '1–25', callback_data: 'pz_0_25' }, { text: '26–50', callback_data: 'pz_26_50' }], [{ text: '51–75', callback_data: 'pz_51_75' }, { text: '76+', callback_data: 'pz_76p' }]] } });
  return [{ json: { action } }];
}
if (action === 'pz') {
  const s = await readSess();
  if (!s || s.step !== 'hxh_piezas') return [{ json: { action: 'pz-guard' } }];
  await rmKb(chat_id, mid);
  const d = Object.assign({}, s.d, { faltaron: data.slice(3) });
  await setSess('hxh', 'hxh_causa', d);
  const cs = await pg("SELECT codigo, boton_texto FROM horacio.causas_paro WHERE activa=true ORDER BY orden");
  const rows = cs.map((c) => [{ text: c.boton_texto, callback_data: 'c_' + c.codigo }]);
  await tg('sendMessage', { chat_id, text: '¿Qué pasó? (elige una)', reply_markup: { inline_keyboard: rows } });
  return [{ json: { action } }];
}
if (action === 'causa') {
  const s = await readSess();
  if (!s || s.step !== 'hxh_causa') return [{ json: { action: 'causa-guard' } }];
  await rmKb(chat_id, mid);
  const d = s.d, codigo = data.slice(2);
  const mids = { '0_25': 13, '26_50': 38, '51_75': 63, '76p': 88 };
  const real = Math.max(d.plan - (mids[d.faltaron] != null ? mids[d.faltaron] : 0), 0);
  await pg(`INSERT INTO horacio.hora_por_hora(linea_id,fecha,hora_slot,plan,real,t_productivo_min,causa_codigo,reporto_chat_id) VALUES('${d.linea_id}','${d.fecha}','${d.slot}',${d.plan},${real},60,'${esc(codigo)}',${chat_id})`);
  await setSess('hxh', 'idle', d);
  const ct = await pg(`SELECT boton_texto FROM horacio.causas_paro WHERE codigo='${esc(codigo)}'`);
  await tg('sendMessage', { chat_id, text: `Gracias por avisar 🙏 Anotado (${d.slot}): ~${real}/${d.plan}, causa: ${ct[0].boton_texto}. Eso nos ayuda a arreglar la causa.` });
  return [{ json: { action } }];
}

// ---- ENTRADA LIBRE (texto/foto) según sesión activa ----
if (action === 'ignore' && msg && (text || photo)) {
  const s = await readSess();
  if (s && s.step === 'hxh_real') {
    const n = parseInt(String(text || '').replace(/[^0-9]/g, ''), 10);
    if (isNaN(n)) { await tg('sendMessage', { chat_id, text: 'Mándame solo el número de piezas que salieron 🙏' }); return [{ json: { action: 'hxh_real_bad' } }]; }
    await pg(`INSERT INTO horacio.hora_por_hora(linea_id,fecha,hora_slot,real,t_productivo_min,reporto_chat_id) VALUES('${s.d.linea_id}','${s.d.fecha}','${s.d.slot}',${n},60,${chat_id})`);
    await setSess('hxh', 'idle', s.d);
    await tg('sendMessage', { chat_id, text: `Va, anotado 👍 ${n} piezas (${s.d.slot}). Gracias.` });
    return [{ json: { action: 'hxh_real' } }];
  }
  if (s && s.step === 'falt_parte') {
    const np = text ? esc(text.trim()) : null;
    const fid = photo ? esc(photo) : null;
    const owner = await pg("SELECT id, chat_id, nombre FROM horacio.personas WHERE rol='faltantes' AND chat_id IS NOT NULL AND activa LIMIT 1");
    const o = (owner && owner.length) ? owner[0] : null;
    const ins = await pg(`INSERT INTO horacio.faltantes(linea_id,numero_parte,foto_url,estado,escalado_a,reporto_chat_id) VALUES('${s.d.linea_id}',${np ? `'${np}'` : 'NULL'},${fid ? `'${fid}'` : 'NULL'},'abierto',${o ? `'${o.id}'` : 'NULL'},${chat_id}) RETURNING id`);
    const id = ins[0].id;
    await setSess('faltante', 'idle', s.d);
    if (o) {
      const kb = { inline_keyboard: [[{ text: 'Visto 👍', callback_data: 'fack_' + id }, { text: '✅ Surtido', callback_data: 'fdone_' + id }]] };
      if (fid) await tg('sendPhoto', { chat_id: o.chat_id, photo: photo, caption: `📦 Faltante en ${esc(s.d.lnombre)}${np ? ': ' + np : ''}`, reply_markup: kb });
      else await tg('sendMessage', { chat_id: o.chat_id, text: `📦 Faltante en ${esc(s.d.lnombre)}: ${np || '(sin NP)'}`, reply_markup: kb });
    }
    await tg('sendMessage', { chat_id, text: `Anotado el faltante${np ? ' de ' + np : ''}. ${o ? 'Ya le avisé a ' + esc(o.nombre) + '.' : '(Almacén aún no está dado de alta — queda registrado.)'} Te aviso cuando se surta.` });
    return [{ json: { action: 'falt_input' } }];
  }
  if (s && s.step === 'cal_descripcion') {
    const desc = esc((text || '(sin texto)').trim());
    const owner = await pg("SELECT id, chat_id, nombre FROM horacio.personas WHERE rol='calidad' AND chat_id IS NOT NULL AND activa LIMIT 1");
    const o = (owner && owner.length) ? owner[0] : null;
    const ins = await pg(`INSERT INTO horacio.calidad(linea_id,descripcion,estado,escalado_a,reporto_chat_id) VALUES('${s.d.linea_id}','${desc}','abierto',${o ? `'${o.id}'` : 'NULL'},${chat_id}) RETURNING id`);
    const id = ins[0].id;
    await setSess('calidad', 'idle', s.d);
    if (o) await tg('sendMessage', { chat_id: o.chat_id, text: `🔎 Calidad en ${esc(s.d.lnombre)}: ${desc}`, reply_markup: { inline_keyboard: [[{ text: 'Visto 👍', callback_data: 'cack_' + id }]] } });
    await tg('sendMessage', { chat_id, text: `Anotado y escalado${o ? ' a ' + esc(o.nombre) : ''}. Gracias por reportar 🙏` });
    return [{ json: { action: 'cal_input' } }];
  }
}

return [{ json: { action: 'ignore', text, data } }];
