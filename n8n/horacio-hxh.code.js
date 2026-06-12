// ============================================================
// Horacio — Webhook HxH (nodo Code único, Fase 1)
// Workflow n8n: "Horacio - Webhook"  · trigger: Webhook /horacio-hxh
// Parser de callbacks estructurados (botones) + escritura en horacio.*
// El LLM NO participa en este flujo (todo por botones).
// ============================================================
const TG = 'https://api.telegram.org/bot<BOT_TOKEN>';
const PG = 'https://supabase.nexiasoluciones.com.mx/pg/query';
const SK = '<SERVICE_ROLE_KEY>';
const pgh = { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' };
const H = this.helpers;
const pg = async (q) => await H.httpRequest({ method: 'POST', url: PG, headers: pgh, body: { query: q }, json: true });
const tg = async (m, p) => await H.httpRequest({ method: 'POST', url: TG + '/' + m, body: p, json: true });

const b = $json.body || $json;
const msg = b.message || null;
const cbq = b.callback_query || null;
const chat_id = (msg && msg.chat && msg.chat.id) || (cbq && cbq.message && cbq.message.chat && cbq.message.chat.id) || null;
const text = (msg && msg.text) || '';
const data = (cbq && cbq.data) || '';
const cbid = (cbq && cbq.id) || '';

if (cbid) { try { await tg('answerCallbackQuery', { callback_query_id: cbid }); } catch (e) {} }

const readSess = async () => {
  const s = await pg(`SELECT linea_id, step, data FROM horacio.sesiones WHERE chat_id=${chat_id}`);
  if (!s || !s.length) return null;
  const r = s[0];
  r.d = (typeof r.data === 'string') ? JSON.parse(r.data) : r.data;
  return r;
};
const setStep = async (step, d) => {
  await pg(`UPDATE horacio.sesiones SET step='${step}', data='${JSON.stringify(d)}'::jsonb, updated_at=now() WHERE chat_id=${chat_id}`);
};

let action = 'ignore';
if (text.startsWith('/ping')) action = 'ping';
else if (data === 'hxh_si') action = 'si';
else if (data === 'hxh_no') action = 'no';
else if (data.startsWith('pz_')) action = 'pz';
else if (data.startsWith('c_')) action = 'causa';

if (action === 'ping') {
  const r = await pg("SELECT l.id AS linea_id, e.piezas_hora FROM horacio.lineas l JOIN horacio.estandares e ON e.linea_id=l.id WHERE l.codigo='SMT520' AND e.vigente=true LIMIT 1");
  const linea_id = r[0].linea_id;
  const plan = Number(r[0].piezas_hora);
  const now = DateTime.now().setZone('America/Mexico_City');
  const fecha = now.toFormat('yyyy-LL-dd');
  const slot = now.toFormat('HH:00');
  const d = { linea_id, plan, fecha, slot };
  await pg(`INSERT INTO horacio.sesiones(chat_id,linea_id,flujo,step,data,updated_at) VALUES(${chat_id},'${linea_id}','hxh','hxh_meta','${JSON.stringify(d)}'::jsonb,now()) ON CONFLICT(chat_id) DO UPDATE SET linea_id=EXCLUDED.linea_id, flujo='hxh', step='hxh_meta', data=EXCLUDED.data, updated_at=now()`);
  await tg('sendMessage', { chat_id, text: `¿Cómo vamos, Viri? SMT 520, ${slot}: ¿salió la meta (${plan})?`, reply_markup: { inline_keyboard: [[{ text: '✅ Sí', callback_data: 'hxh_si' }, { text: '❌ Faltó', callback_data: 'hxh_no' }]] } });
  return [{ json: { action, chat_id } }];
}

if (action === 'si') {
  const s = await readSess();
  if (!s) { await tg('sendMessage', { chat_id, text: 'Primero manda /ping para empezar.' }); return [{ json: { action: 'no-sess' } }]; }
  const d = s.d;
  await pg(`INSERT INTO horacio.hora_por_hora(linea_id,fecha,hora_slot,plan,real,t_productivo_min,reporto_chat_id) VALUES('${d.linea_id}','${d.fecha}','${d.slot}',${d.plan},${d.plan},60,${chat_id})`);
  await setStep('idle', d);
  await tg('sendMessage', { chat_id, text: `Va, anotado 👍 ${d.plan}/${d.plan} en SMT 520 (${d.slot}). Gracias.` });
  return [{ json: { action } }];
}

if (action === 'no') {
  const s = await readSess();
  if (!s) { await tg('sendMessage', { chat_id, text: 'Primero manda /ping.' }); return [{ json: { action: 'no-sess' } }]; }
  await setStep('hxh_piezas', s.d);
  await tg('sendMessage', { chat_id, text: '¿Cuántas piezas faltaron?', reply_markup: { inline_keyboard: [[{ text: '1–25', callback_data: 'pz_0_25' }, { text: '26–50', callback_data: 'pz_26_50' }], [{ text: '51–75', callback_data: 'pz_51_75' }, { text: '76+', callback_data: 'pz_76p' }]] } });
  return [{ json: { action } }];
}

if (action === 'pz') {
  const s = await readSess();
  if (!s) { return [{ json: { action: 'no-sess' } }]; }
  const rango = data.slice(3);
  const d = Object.assign({}, s.d, { faltaron: rango });
  await setStep('hxh_causa', d);
  const cs = await pg("SELECT codigo, boton_texto FROM horacio.causas_paro WHERE activa=true ORDER BY orden");
  const rows = cs.map((c) => [{ text: c.boton_texto, callback_data: 'c_' + c.codigo }]);
  await tg('sendMessage', { chat_id, text: '¿Qué pasó? (elige una)', reply_markup: { inline_keyboard: rows } });
  return [{ json: { action } }];
}

if (action === 'causa') {
  const s = await readSess();
  if (!s) { return [{ json: { action: 'no-sess' } }]; }
  const d = s.d;
  const codigo = data.slice(2);
  const mids = { '0_25': 13, '26_50': 38, '51_75': 63, '76p': 88 };
  const mid = mids[d.faltaron] != null ? mids[d.faltaron] : 0;
  const real = Math.max(d.plan - mid, 0);
  await pg(`INSERT INTO horacio.hora_por_hora(linea_id,fecha,hora_slot,plan,real,t_productivo_min,causa_codigo,reporto_chat_id) VALUES('${d.linea_id}','${d.fecha}','${d.slot}',${d.plan},${real},60,'${codigo}',${chat_id})`);
  await setStep('idle', d);
  const ct = await pg(`SELECT boton_texto FROM horacio.causas_paro WHERE codigo='${codigo}'`);
  const causaTxt = ct[0].boton_texto;
  await tg('sendMessage', { chat_id, text: `Gracias por avisar 🙏 Anotado en SMT 520 (${d.slot}): ~${real}/${d.plan}, causa: ${causaTxt}. Eso nos ayuda a arreglar la causa.` });
  return [{ json: { action } }];
}

return [{ json: { action: 'ignore', text, data } }];
