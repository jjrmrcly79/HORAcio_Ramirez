// ============================================================
// Horacio — Bot (nodo Code único)
// Workflow n8n: "Horacio - Webhook" · Webhook /horacio-hxh
// Flujos líder: alta · HxH multi-tablero · Paros · Faltantes · Calidad
// Funciones admin (Scheduler, vía HTTP con secreto):
//   ping_all · reminder_all · resumen_lider · resumen_dir
// Modelo: una LÍDER lleva VARIOS tableros HxH (lineas.lider_persona_id).
//   Ping = un mensaje con un botón por tablero; marca los ya hechos.
// Reemplaza <BOT_TOKEN> y <SERVICE_ROLE_KEY> en n8n (nunca en el repo).
// Code node corre "Run Once for All Items": usar $input.first().json, NO $json.
// ============================================================
const TG = 'https://api.telegram.org/bot<BOT_TOKEN>';
const PG = 'https://supabase.nexiasoluciones.com.mx/pg/query';
const SK = '<SERVICE_ROLE_KEY>';
const ADMIN_SECRET = '<ADMIN_SECRET>';
const AI = '<ANTHROPIC_API_KEY>'; // Claude Haiku para la plática de la encuesta de salida
const VALIDATOR = 5367409334; // chat ESPEJO: recibe copia de TODO para validar el piloto (poner null para apagar)
const pgh = { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' };
const H = this.helpers;
const pg = async (q) => await H.httpRequest({ method: 'POST', url: PG, headers: pgh, body: { query: q }, json: true });
const tgRaw = async (m, p) => await H.httpRequest({ method: 'POST', url: TG + '/' + m, body: p, json: true });
let _names = null;
const whoIs = async (cid) => {
  if (!_names) { _names = {}; try { const r = await pg("SELECT chat_id, nombre, rol FROM horacio.personas WHERE chat_id IS NOT NULL"); for (const p of r) _names[p.chat_id] = p.nombre + ' (' + p.rol + ')'; } catch (e) {} }
  return _names[cid] || ('chat ' + cid);
};
// tg con espejo: todo sendMessage/sendPhoto se copia al VALIDATOR (texto), salvo lo que ya va a él
const tg = async (m, p) => {
  const res = await tgRaw(m, p);
  if (VALIDATOR && p && p.chat_id && p.chat_id !== VALIDATOR && (m === 'sendMessage' || m === 'sendPhoto')) {
    try {
      const who = await whoIs(p.chat_id);
      const cuerpo = (m === 'sendPhoto') ? ('📷 ' + (p.caption || '')) : (p.text || '');
      await tgRaw('sendMessage', { chat_id: VALIDATOR, text: '👁️ [→ ' + who + ']\n' + cuerpo });
    } catch (e) {}
  }
  return res;
};
const esc = (s) => String(s == null ? '' : s).replace(/'/g, "''");
const rmKb = async (chat, mid) => { if (!mid) return; try { await tg('editMessageReplyMarkup', { chat_id: chat, message_id: mid, reply_markup: { inline_keyboard: [] } }); } catch (e) {} };
const nowMX = () => DateTime.now().setZone('America/Mexico_City');
const OPEN = ['hxh_menu', 'hxh_meta', 'hxh_piezas', 'hxh_causa', 'hxh_real', 'hxh_tj_pick', 'hxh_tj_np', 'hxh_tj_cant'];
// Ventanas HxH de 6:30→7:30 (turno arranca 6:30). winClose(h)=ventana cerrada en h:30.
const pad2 = (n) => String(n).padStart(2, '0');
const winClose = (h) => pad2(h - 1) + ':30-' + pad2(h) + ':30';
// tableros de una líder por su persona_id (con plan vigente si lo tiene)
// plan = meta de la OT de hoy (la fija Daniel) → si no, estándar oficial → si no, null (solo piezas)
const PLAN_SQL = "COALESCE((SELECT o.meta_hr FROM horacio.ordenes_tablero o WHERE o.linea_id=l.id AND o.fecha=(now() AT TIME ZONE 'America/Mexico_City')::date AND o.vigente ORDER BY o.ts DESC LIMIT 1),(SELECT e.piezas_hora FROM horacio.estandares e WHERE e.linea_id=l.id AND e.vigente=true ORDER BY e.created_at DESC LIMIT 1))";
const ORDEN_SQL = "(SELECT o.orden FROM horacio.ordenes_tablero o WHERE o.linea_id=l.id AND o.fecha=(now() AT TIME ZONE 'America/Mexico_City')::date AND o.vigente ORDER BY o.ts DESC LIMIT 1)";
const boardsByPid = async (pid) => {
  const r = await pg(`SELECT l.id AS linea_id, l.codigo, l.nombre, l.unidad, l.captura, ${PLAN_SQL} AS plan, ${ORDEN_SQL} AS orden FROM horacio.lineas l WHERE l.lider_persona_id='${pid}' AND l.activa ORDER BY l.orden, l.codigo`);
  return r.map((x) => ({ linea_id: x.linea_id, codigo: x.codigo, nombre: x.nombre, unidad: x.unidad || 'piezas', captura: x.captura || 'conteo', plan: x.plan == null ? null : Number(x.plan), orden: x.orden || null }));
};

const __i = $input.first().json;
const b = __i.body || __i;

// ===================== ADMIN (scheduler) =====================
if (b && b.admin) {
  if (b.secret !== ADMIN_SECRET) return [{ json: { ok: false, error: 'bad secret' } }];
  const now = nowMX();
  const fecha = now.toFormat('yyyy-LL-dd');
  const slot = winClose(Number(now.toFormat('HH'))); // ventana recién cerrada (6:30→7:30 etc.)
  const leadersP = await pg("SELECT DISTINCT p.id AS pid, p.chat_id, p.nombre FROM horacio.lineas l JOIN horacio.personas p ON p.id=l.lider_persona_id WHERE l.activa AND p.activa AND p.chat_id IS NOT NULL");

  if (b.admin === 'ping_all') {
    let pinged = 0;
    for (const P of leadersP) {
      const B = await boardsByPid(P.pid);
      if (!B.length) continue;
      // cerrar huecos: tableros no reportados de un slot anterior => sin_dato
      const s = await pg(`SELECT step, data FROM horacio.sesiones WHERE chat_id=${P.chat_id}`);
      if (s && s.length) {
        const d0 = (typeof s[0].data === 'string') ? JSON.parse(s[0].data) : s[0].data;
        if (OPEN.includes(s[0].step) && d0 && d0.slot && d0.slot !== slot && Array.isArray(d0.boards)) {
          const done0 = d0.done || [];
          for (const bd of d0.boards) {
            if (!done0.includes(bd.linea_id)) {
              await pg(`INSERT INTO horacio.hora_por_hora(linea_id,fecha,hora_slot,plan,sin_dato,reporto_chat_id) VALUES('${bd.linea_id}','${d0.fecha || fecha}','${d0.slot}',${bd.plan != null ? bd.plan : 'NULL'},true,${P.chat_id})`);
            }
          }
        }
      }
      const d = { fecha, slot, boards: B, done: [], cur: null, reminded: false };
      await pg(`INSERT INTO horacio.sesiones(chat_id,flujo,step,data,updated_at) VALUES(${P.chat_id},'hxh','hxh_menu','${esc(JSON.stringify(d))}'::jsonb,now()) ON CONFLICT(chat_id) DO UPDATE SET flujo='hxh', step='hxh_menu', data=EXCLUDED.data, updated_at=now()`);
      const rows = B.map((x) => [{ text: x.nombre, callback_data: 'hxhb_' + x.linea_id }]);
      const head = B.length > 1
        ? `¿Cómo vamos, ${P.nombre}? Reporta tu hora por hora de ${slot} — toca cada tablero:`
        : `¿Cómo vamos, ${P.nombre}? Hora por hora de ${slot}:`;
      await tg('sendMessage', { chat_id: P.chat_id, text: head, reply_markup: { inline_keyboard: rows } });
      pinged++;
    }
    return [{ json: { admin: 'ping_all', pinged } }];
  }

  if (b.admin === 'catchup') {
    // Recuperar las primeras horas: una botonera por hora, en fila (auto-avanza).
    // body: { slots:["07:00",...] }  o  { from:7 } (default 7 → hasta el slot recién cerrado)
    //       opcional: { only_chat:<id> } para una sola líder · { intro:"..." }
    let slots = Array.isArray(b.slots) && b.slots.length ? b.slots : null;
    if (!slots) {
      const fromH = Number.isFinite(b.from) ? b.from : 7; // hora de cierre de la 1a ventana (7 = 6:30→7:30)
      const lastClose = (Number(now.toFormat('mm')) >= 30) ? Number(now.toFormat('HH')) : Number(now.toFormat('HH')) - 1;
      slots = [];
      for (let h = fromH; h <= lastClose; h++) slots.push(winClose(h));
    }
    if (!slots.length) return [{ json: { admin: 'catchup', skip: 'sin slots' } }];
    const intro = b.intro || 'Perdón la demora 🙏 Apenas quedó listo Horacio. Vamos a recuperar el hora por hora de la mañana — te paso hora por hora, va rapidito.';
    let started = 0;
    for (const P of leadersP) {
      if (b.only_chat && String(P.chat_id) !== String(b.only_chat)) continue;
      const B = await boardsByPid(P.pid);
      if (!B.length) continue;
      const d = { fecha, slot: slots[0], queue: slots.slice(1), boards: B, done: [], cur: null, reminded: false, catchup: true };
      await pg(`INSERT INTO horacio.sesiones(chat_id,flujo,step,data,updated_at) VALUES(${P.chat_id},'hxh','hxh_menu','${esc(JSON.stringify(d))}'::jsonb,now()) ON CONFLICT(chat_id) DO UPDATE SET flujo='hxh', step='hxh_menu', data=EXCLUDED.data, updated_at=now()`);
      await tg('sendMessage', { chat_id: P.chat_id, text: `${P.nombre}, ${intro}` });
      const rows = B.map((x) => [{ text: x.nombre, callback_data: 'hxhb_' + x.linea_id }]);
      await tg('sendMessage', { chat_id: P.chat_id, text: `Hora por hora de ${d.slot}${slots.length > 1 ? ` (1 de ${slots.length})` : ''} — toca cada tablero:`, reply_markup: { inline_keyboard: rows } });
      started++;
    }
    return [{ json: { admin: 'catchup', started, slots } }];
  }

  if (b.admin === 'reminder_all') {
    let rem = 0;
    for (const P of leadersP) {
      const s = await pg(`SELECT step, data FROM horacio.sesiones WHERE chat_id=${P.chat_id}`);
      if (!s || !s.length) continue;
      const d = (typeof s[0].data === 'string') ? JSON.parse(s[0].data) : s[0].data;
      if (!OPEN.includes(s[0].step) || !d || d.slot !== slot || d.reminded || !Array.isArray(d.boards)) continue;
      const pend = d.boards.filter((x) => !(d.done || []).includes(x.linea_id));
      if (!pend.length) continue;
      d.reminded = true;
      await pg(`UPDATE horacio.sesiones SET data='${esc(JSON.stringify(d))}'::jsonb, updated_at=now() WHERE chat_id=${P.chat_id}`);
      const rows = pend.map((x) => [{ text: x.nombre, callback_data: 'hxhb_' + x.linea_id }]);
      await tg('sendMessage', { chat_id: P.chat_id, text: `Cuando puedas, ${P.nombre} ${slot}: aún falta tu hora por hora 🙏`, reply_markup: { inline_keyboard: rows } });
      rem++;
    }
    return [{ json: { admin: 'reminder_all', rem } }];
  }

  if (b.admin === 'escalate_nocapture') {
    // Si tras el recordatorio la líder sigue sin subir → avisar a SU jefe (supervisor_rol del tablero)
    const byRol = {}; // supervisor_rol -> ['• Líder: Tablero', ...]
    const ownerCache = {};
    const ownerOf = async (rol) => {
      if (ownerCache[rol] !== undefined) return ownerCache[rol];
      const o = await pg(`SELECT chat_id, nombre FROM horacio.personas WHERE rol='${esc(rol)}' AND chat_id IS NOT NULL AND activa LIMIT 1`);
      ownerCache[rol] = (o && o.length) ? o[0] : null; return ownerCache[rol];
    };
    let escalated = 0;
    for (const P of leadersP) {
      const s = await pg(`SELECT step, data FROM horacio.sesiones WHERE chat_id=${P.chat_id}`);
      if (!s || !s.length) continue;
      const d = (typeof s[0].data === 'string') ? JSON.parse(s[0].data) : s[0].data;
      if (!OPEN.includes(s[0].step) || !d || d.slot !== slot || d.escalado || !Array.isArray(d.boards)) continue;
      const pend = d.boards.filter((x) => !(d.done || []).includes(x.linea_id));
      if (!pend.length) continue;
      const ids = pend.map((x) => `'${x.linea_id}'`).join(',');
      const sup = await pg(`SELECT id, supervisor_rol FROM horacio.lineas WHERE id IN (${ids})`);
      const supMap = {}; sup.forEach((r) => { supMap[r.id] = r.supervisor_rol || 'paros'; });
      let jefeNombre = 'tu jefe';
      for (const x of pend) {
        const rol = supMap[x.linea_id] || 'paros';
        (byRol[rol] = byRol[rol] || []).push(`• ${P.nombre}: ${x.nombre}`);
        const ow = await ownerOf(rol);
        if (ow && jefeNombre === 'tu jefe') jefeNombre = ow.nombre;
      }
      d.escalado = true;
      await pg(`UPDATE horacio.sesiones SET data='${esc(JSON.stringify(d))}'::jsonb, updated_at=now() WHERE chat_id=${P.chat_id}`);
      await tg('sendMessage', { chat_id: P.chat_id, text: `${P.nombre}, aún no tengo tu hora por hora de ${slot}. Ya le avisé a ${esc(jefeNombre)} por si necesitas apoyo 🙏`, reply_markup: { inline_keyboard: pend.map((x) => [{ text: x.nombre, callback_data: 'hxhb_' + x.linea_id }]) } });
      escalated++;
    }
    const notified = [];
    for (const rol of Object.keys(byRol)) {
      const ow = await ownerOf(rol);
      if (ow) { await tg('sendMessage', { chat_id: ow.chat_id, text: `⚠️ HxH de ${slot} sin reportar (ya les recordé):\n${byRol[rol].join('\n')}\n\n¿Puedes apoyar para que suban su hora por hora? — Horacio` }); notified.push(ow.nombre); }
    }
    return [{ json: { admin: 'escalate_nocapture', escalated, notified } }];
  }

  if (b.admin === 'orden_reminder') {
    // recordatorio matutino a Producción (Daniel) para definir las órdenes del día
    const own = await pg("SELECT chat_id, nombre FROM horacio.personas WHERE rol='paros' AND chat_id IS NOT NULL AND activa LIMIT 1");
    const O = (own && own.length) ? own[0] : null;
    if (!O) return [{ json: { admin: 'orden_reminder', skip: 'sin produccion' } }];
    await tg('sendMessage', { chat_id: O.chat_id, text: `Buenos días, ${O.nombre} 🌅\nAntes de arrancar el turno, define las órdenes del día con /orden: la OT que corre y la meta por hora en cada tablero. Así cada proceso lleva su cumplimiento.\n\nSi una orden cambia durante el día, vuelve a tocar /orden y la actualizas 🙌` });
    return [{ json: { admin: 'orden_reminder', sent: 1 } }];
  }

  if (b.admin === 'resumen_lider') {
    let sent = 0;
    for (const P of leadersP) {
      const boards = await pg(`SELECT id, nombre, unidad FROM horacio.lineas WHERE lider_persona_id='${P.pid}' AND activa ORDER BY orden, codigo`);
      let lines = [], gtp = 0, gtr = 0;
      for (const bd of boards) {
        const hxh = await pg(`SELECT plan, real, sin_dato FROM horacio.hxh_vigente WHERE linea_id='${bd.id}' AND fecha='${fecha}'`);
        let tp = 0, tr = 0, has = false, sd = 0;
        for (const h of hxh) { has = true; if (h.sin_dato) { sd++; continue; } tp += Number(h.plan || 0); tr += Number(h.real || 0); }
        const paros = await pg(`SELECT COUNT(*)::int AS n, COALESCE(SUM(duracion_min),0)::int AS min FROM horacio.paros WHERE linea_id='${bd.id}' AND ts_inicio::date='${fecha}'`);
        const falt = await pg(`SELECT COUNT(*) FILTER (WHERE estado<>'cerrado')::int AS ab FROM horacio.faltantes WHERE linea_id='${bd.id}' AND ts_reporte::date='${fecha}'`);
        if (!has && paros[0].n === 0 && falt[0].ab === 0) continue;
        gtp += tp; gtr += tr;
        const prod = tp > 0 ? `${tr}/${tp} (${Math.round(tr / tp * 100)}%)` : `${tr} ${bd.unidad || 'pzs'}`;
        lines.push(`• ${bd.nombre}: ${prod}${sd ? ` · ${sd} sin dato` : ''}${paros[0].n ? ` · paros ${paros[0].n} (${paros[0].min}m)` : ''}${falt[0].ab ? ` · faltantes ${falt[0].ab}` : ''}`);
      }
      const tot = gtp > 0 ? `\n\nTotal con meta: ${gtr}/${gtp} (${Math.round(gtr / gtp * 100)}%)` : '';
      const txt = `📋 Tu resumen de hoy — ${P.nombre}\n${lines.join('\n') || '(sin registros)'}${tot}\n\nGracias por tu trabajo de hoy 🙌\n— Horacio`;
      await tg('sendMessage', { chat_id: P.chat_id, text: txt });
      sent++;
    }
    return [{ json: { admin: 'resumen_lider', sent } }];
  }

  if (b.admin === 'resumen_dir') {
    // preview_chat: manda solo a ese chat (para revisar sin avisar a Dirección)
    const recips = b.preview_chat
      ? [{ chat_id: b.preview_chat, nombre: 'preview' }]
      : await pg("SELECT chat_id, nombre FROM horacio.personas WHERE rol IN ('direccion','resumen') AND chat_id IS NOT NULL AND activa");
    if (!recips || !recips.length) return [{ json: { admin: 'resumen_dir', skip: 'sin destinatarios' } }];
    const sem3 = (pct) => pct >= 95 ? '🟢' : (pct >= 80 ? '🟡' : '🔴');
    const tableros = await pg("SELECT id, nombre, grupo, unidad FROM horacio.lineas WHERE activa=true ORDER BY grupo, orden, codigo");
    let shown = 0, reportando = 0, gSumP = 0, gSumCap = 0, revisar = [];
    const groups = []; let cur = null;
    for (const L of tableros) {
      if (!cur || cur.grupo !== L.grupo) { cur = { grupo: L.grupo, lines: [], P: 0, cap: 0, sinCap: 0 }; groups.push(cur); }
      const agg = await pg(`SELECT COALESCE(SUM(plan) FILTER (WHERE NOT sin_dato),0)::bigint AS plan, COALESCE(SUM(real) FILTER (WHERE NOT sin_dato),0)::bigint AS real, COUNT(*) FILTER (WHERE NOT sin_dato)::int AS condato, COUNT(*) FILTER (WHERE sin_dato)::int AS sd FROM horacio.hxh_vigente WHERE linea_id='${L.id}' AND fecha='${fecha}'`);
      const paros = await pg(`SELECT COUNT(*)::int AS n, COALESCE(SUM(duracion_min),0)::int AS min FROM horacio.paros WHERE linea_id='${L.id}' AND ts_inicio::date='${fecha}'`);
      const falt = await pg(`SELECT COUNT(*) FILTER (WHERE estado<>'cerrado')::int AS ab FROM horacio.faltantes WHERE linea_id='${L.id}' AND ts_reporte::date='${fecha}'`);
      const P = Number(agg[0].plan), R = Number(agg[0].real), conDato = agg[0].condato, sd = agg[0].sd;
      const hadProd = conDato > 0 || R > 0, hasInc = paros[0].n > 0 || falt[0].ab > 0;
      if (hadProd) reportando++;
      if (!hadProd && !hasInc) { if (sd > 0) cur.sinCap++; continue; } // pingueado sin captura → roll-up
      let prod, sem;
      if (P > 0) {
        const pctRaw = Math.round(R / P * 100), pct = Math.min(pctRaw, 100), capR = Math.min(R, P), over = R > P * 1.05;
        sem = sem3(pct); prod = `${R}/${P} (${pct}%${over ? ' ⚠️' : ''})`;
        gSumP += P; gSumCap += capR; cur.P += P; cur.cap += capR;
        if (over) revisar.push(`${L.nombre} ${pctRaw}%`);
      } else { sem = '⚪'; prod = `${R} ${L.unidad || 'pzs'}`; }
      cur.lines.push(`${sem} ${L.nombre}: ${prod}${paros[0].n ? ` · paros ${paros[0].n} (${paros[0].min}m)` : ''}${falt[0].ab ? ` · faltantes ${falt[0].ab}` : ''}${sd ? ` · ${sd} sin dato` : ''}`);
      shown++;
    }
    let blocks = [];
    for (const g of groups) {
      if (!g.lines.length && !g.sinCap) continue;
      const gpct = g.P > 0 ? Math.min(100, Math.round(g.cap / g.P * 100)) : null;
      blocks.push(`\n— ${g.grupo}${gpct == null ? '' : ' ' + sem3(gpct) + ' ' + gpct + '%'}${g.sinCap ? ` · ${g.sinCap} sin captura` : ''} —`);
      g.lines.forEach((l) => blocks.push(l));
    }
    // ---- agregados ejecutivos del día ----
    const cumpl = gSumP > 0 ? Math.min(100, Math.round(gSumCap / gSumP * 100)) : null;
    const pd = (await pg(`SELECT COUNT(*)::int AS n, COALESCE(SUM(duracion_min),0)::bigint AS min, COUNT(*) FILTER (WHERE estado='abierto')::int AS ab FROM horacio.paros WHERE ts_inicio::date='${fecha}'`))[0];
    const ab = (await pg(`SELECT (SELECT COUNT(*) FROM horacio.faltantes WHERE estado<>'cerrado')::int AS falt, (SELECT COUNT(*) FROM horacio.calidad WHERE estado<>'cerrado')::int AS cal`))[0];
    const ac = (await pg(`SELECT ROUND(AVG(EXTRACT(EPOCH FROM (acuse_ts-ts_inicio))/60.0))::int AS m FROM horacio.paros WHERE acuse_ts IS NOT NULL AND ts_inicio::date >= '${fecha}'::date-6`))[0];
    const og = (await pg(`SELECT COUNT(*) FILTER (WHERE NOT sin_dato AND origen='telegram_lider')::int AS puras, COUNT(*) FILTER (WHERE origen='panel_manual')::int AS manual, COUNT(*) FILTER (WHERE sin_dato)::int AS sind FROM horacio.hxh_vigente WHERE fecha='${fecha}'`))[0];
    const em = (await pg(`SELECT COALESCE(SUM(d.cantidad),0)::bigint AS tot, COUNT(DISTINCT d.numero_parte)::int AS nps FROM horacio.hxh_tarjetas d JOIN horacio.hora_por_hora h ON h.id=d.hxh_id JOIN horacio.lineas l ON l.id=h.linea_id WHERE l.captura='tarjetas' AND h.fecha='${fecha}'`))[0];
    const tc = await pg(`SELECT cp.boton_texto AS causa, COUNT(*)::int AS n FROM (SELECT causa_codigo FROM horacio.paros WHERE ts_inicio::date='${fecha}' AND causa_codigo IS NOT NULL UNION ALL SELECT causa_codigo FROM horacio.hxh_vigente WHERE fecha='${fecha}' AND causa_codigo IS NOT NULL) x JOIN horacio.causas_paro cp ON cp.codigo=x.causa_codigo WHERE cp.cuenta_como_paro GROUP BY cp.boton_texto ORDER BY n DESC LIMIT 1`);
    let head = `📊 Resumen del día — ${fecha}`;
    head += `\n\n🏭 Cumplimiento global: ${cumpl == null ? '—' : sem3(cumpl) + ' ' + cumpl + '%'}  (tableros con meta)`;
    head += `\n🗒️ Captura: ${reportando}/${tableros.length} tableros · ${og.puras} de líder · ${og.manual} manual${og.sind ? ` · ${og.sind} sin dato` : ''}`;
    head += `\n🛑 Paros: ${pd.n} (${pd.min} min)${pd.ab ? ` · ${pd.ab} abiertos` : ''} · 📦 Faltantes: ${ab.falt} · 🔎 Calidad: ${ab.cal}`;
    if (ac.m != null) head += `\n⏱️ Reacción a paros: ${ac.m} min prom (7d)`;
    if (Number(em.tot) > 0) head += `\n📦 Embarques: ${em.tot} tarjetas (${em.nps} NP)`;
    if (revisar.length) head += `\n\n⚠️ Revisar meta/captura: ${revisar.join(' · ')}`;
    let foot = tc.length ? `\n\n🔎 Causa #1 hoy: ${tc[0].causa} (${tc[0].n})` : '';
    const txt = `${head}\n${blocks.join('\n') || '\n(sin actividad registrada)'}${foot}\n\n— Horacio`;
    for (const r of recips) { try { await tg('sendMessage', { chat_id: r.chat_id, text: txt }); } catch (e) {} }
    return [{ json: { admin: 'resumen_dir', tableros: shown, recips: recips.length, preview: !!b.preview_chat, text: b.preview_chat ? txt : undefined } }];
  }
  if (b.admin === 'encuesta_salida') {
    const recips = b.preview_chat
      ? [{ chat_id: b.preview_chat }]
      : await pg("SELECT DISTINCT p.chat_id FROM horacio.lineas l JOIN horacio.personas p ON p.id=l.lider_persona_id WHERE l.activa AND p.activa AND p.chat_id IS NOT NULL");
    let sent = 0;
    for (const r of recips) {
      try {
        await tg('sendMessage', { chat_id: r.chat_id, text: 'Terminó el turno 🙏 Antes de irte: ¿cómo estuvo tu día?', reply_markup: { inline_keyboard: [[{ text: '😀 Bien', callback_data: 'fbm_bien' }, { text: '😐 Normal', callback_data: 'fbm_normal' }, { text: '😟 Pesado', callback_data: 'fbm_pesado' }]] } });
        sent++;
      } catch (e) {}
    }
    return [{ json: { admin: 'encuesta_salida', sent } }];
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
// tableros de la líder que escribe (por su chat_id)
const myBoards = async () => {
  const r = await pg(`SELECT l.id AS linea_id, l.codigo, l.nombre, l.unidad, l.captura, ${PLAN_SQL} AS plan, ${ORDEN_SQL} AS orden FROM horacio.lineas l JOIN horacio.personas p ON p.id=l.lider_persona_id WHERE p.chat_id=${chat_id} AND p.activa AND l.activa ORDER BY l.orden, l.codigo`);
  return r.map((x) => ({ linea_id: x.linea_id, codigo: x.codigo, nombre: x.nombre, unidad: x.unidad || 'piezas', captura: x.captura || 'conteo', plan: x.plan == null ? null : Number(x.plan), orden: x.orden || null }));
};
const menu = async (txt) => {
  await tg('sendMessage', { chat_id, text: txt || '¿Qué necesitas?', reply_markup: { inline_keyboard: [[{ text: '🛑 Reportar paro', callback_data: 'paro_start' }], [{ text: '📦 Falta material', callback_data: 'falt_start' }], [{ text: '🔎 Reportar calidad', callback_data: 'cal_start' }]] } });
};
const askLine = async () => {
  const ls = await pg("SELECT codigo, nombre FROM horacio.lineas WHERE activa=true ORDER BY grupo, orden, codigo");
  const rows = ls.map((l) => [{ text: l.nombre, callback_data: 'alta_' + l.codigo }]);
  await tg('sendMessage', { chat_id, text: `Va. ¿Qué tablero(s) llevas, ${esc(tgname)}? (elige el principal; luego te pingueo todos los tuyos)`, reply_markup: { inline_keyboard: rows } });
};
const askArea = async () => {
  const roles = [['paros', 'Paros (Daniel)'], ['faltantes', 'Materiales / Faltantes (Nayeli)'], ['calidad', 'Calidad (Marco)'], ['mantenimiento', 'Mantenimiento (JC)'], ['direccion', 'Dirección (Jorge)'], ['rh', '🤝 Recursos Humanos (Ivonne)'], ['resumen', '📊 Solo recibir resumen del día']];
  const rows = roles.map((r) => [{ text: r[1], callback_data: 'rol_' + r[0] }]);
  await tg('sendMessage', { chat_id, text: '¿Qué área cubres? (recibirás los avisos de esa área)', reply_markup: { inline_keyboard: rows } });
};
// menú HxH: un botón por tablero pendiente; cierra cuando completa todos
// Plática de la encuesta de salida con Claude Haiku (personalidad de Horacio, contención breve)
const FB_SYS = 'Eres Horacio Ramírez, el compañero del hora por hora de la planta Mapartel. Aquí NO hablas de producción: estás escuchando a una líder al terminar su turno. Eres cálido, breve y mexicano; validas lo que siente, no regañas, no comparas líneas, no diagnosticas ni das indicaciones médicas o de Recursos Humanos. Responde SIEMPRE en 1 o 2 frases, con empatía real y a veces una pregunta suave. Si te cuenta algo serio (acoso, riesgo, salud, un conflicto fuerte), con calma dile que lo vas a pasar a Recursos Humanos para que la apoyen. Cierra dejando la puerta abierta.';
const askHoracio = async (msgs) => {
  try {
    const r = await H.httpRequest({ method: 'POST', url: 'https://api.anthropic.com/v1/messages', headers: { 'x-api-key': AI, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: { model: 'claude-haiku-4-5-20251001', max_tokens: 220, system: FB_SYS, messages: msgs }, json: true });
    const t = r && r.content && r.content[0] && r.content[0].text;
    return t || 'Aquí te leo 🙏';
  } catch (e) { return 'Gracias por contarme 🙏 (no pude responder bien ahorita, pero quedó guardado).'; }
};
// avisa a RH (sin compartir el contenido — solo que dé seguimiento) y marca el feedback
const escalarRH = async (fid, cid) => {
  try {
    await pg(`UPDATE horacio.feedback SET escalado=true WHERE id='${esc(fid)}'`);
    const rh = await pg("SELECT chat_id FROM horacio.personas WHERE rol='rh' AND chat_id IS NOT NULL AND activa LIMIT 1");
    const who = await pg(`SELECT nombre FROM horacio.personas WHERE chat_id=${cid} LIMIT 1`);
    const nombre = who.length ? who[0].nombre : 'una líder';
    if (rh.length) await tg('sendMessage', { chat_id: rh[0].chat_id, text: `💬 ${esc(nombre)} terminó su día sintiéndose pesada y platicó con Horacio. ¿Puedes darle seguimiento? (queda registrado)` });
  } catch (e) {}
};
// Motivación por hitos del día: inicio / mitad (50%) / completo (100%). 1 vez/día por líder.
const motivar = async (cid) => {
  try {
    const p = await pg(`SELECT id, nombre FROM horacio.personas WHERE chat_id=${cid} AND activa LIMIT 1`);
    if (!p.length) return;
    const pid = p[0].id, nombre = p[0].nombre;
    const r = await pg(`SELECT (SELECT COUNT(DISTINCT l.id) FROM horacio.lineas l WHERE l.lider_persona_id='${pid}' AND l.activa)::int AS nb, (SELECT COUNT(*) FROM horacio.hxh_vigente h JOIN horacio.lineas l ON l.id=h.linea_id WHERE l.lider_persona_id='${pid}' AND h.fecha=(now() AT TIME ZONE 'America/Mexico_City')::date AND NOT h.sin_dato)::int AS rep`);
    const nb = Number(r[0].nb) || 0, rep = Number(r[0].rep) || 0;
    if (!nb) return;
    const pct = Math.round(rep / (nb * 9) * 100);
    let hito = null, msg = null;
    if (pct >= 100) { hito = 'completo'; msg = `¡Completaste tu hora por hora del día, ${esc(nombre)}! 🎉 Gracias por tu constancia 🙌`; }
    else if (pct >= 50) { hito = 'mitad'; msg = `¡Vas a la mitad, ${esc(nombre)}! 🙌 Buen ritmo, sigue así 💪`; }
    else if (rep === 1) { hito = 'inicio'; msg = `¡Arrancaste, ${esc(nombre)}! 💪 Vamos hora por hora, aquí te acompaño.`; }
    if (!hito) return;
    const ins = await pg(`INSERT INTO horacio.motivacion(chat_id,fecha,hito) VALUES(${cid},(now() AT TIME ZONE 'America/Mexico_City')::date,'${hito}') ON CONFLICT DO NOTHING RETURNING hito`);
    if (ins && ins.length) await tg('sendMessage', { chat_id: cid, text: msg });
  } catch (e) {}
};
const hxhBoardMenu = async (d) => {
  await motivar(chat_id);
  const pend = d.boards.filter((x) => !d.done.includes(x.linea_id));
  if (!pend.length) {
    if (Array.isArray(d.queue) && d.queue.length) { // catch-up: pasa a la siguiente hora
      d.slot = d.queue.shift(); d.done = []; d.cur = null;
      await setSess('hxh', 'hxh_menu', d);
      const rows2 = d.boards.map((x) => [{ text: x.nombre, callback_data: 'hxhb_' + x.linea_id }]);
      await tg('sendMessage', { chat_id, text: `Ahora la hora ${d.slot}${d.queue.length ? ` (faltan ${d.queue.length})` : ''}:`, reply_markup: { inline_keyboard: rows2 } });
      return;
    }
    await setSess('hxh', 'idle', d);
    await tg('sendMessage', { chat_id, text: d.catchup ? `¡Listo! Ya quedó la mañana completa 🙌 Gracias por la paciencia.` : `¡Listo! Quedó tu hora por hora de ${d.slot} 🙌 Gracias.` });
    return;
  }
  await setSess('hxh', 'hxh_menu', d);
  const rows = pend.map((x) => [{ text: x.nombre, callback_data: 'hxhb_' + x.linea_id }]);
  const prog = d.boards.length > 1 ? `\n(${d.done.length}/${d.boards.length} listos)` : '';
  await tg('sendMessage', { chat_id, text: `Hora por hora de ${d.slot} — ¿qué tablero reportas?${prog}`, reply_markup: { inline_keyboard: rows } });
};
// menú de captura por tarjetas (Embarques): catálogo cerrado + ➕ Otra + ✔️ Cerrar
const tjPickMenu = async (d) => {
  const cat = await pg("SELECT id, numero_parte, nombre FROM horacio.tarjetas WHERE activa=true ORDER BY nombre NULLS LAST, numero_parte");
  const btns = cat.map((t) => ({ text: (t.nombre ? t.nombre + ' · ' : '') + t.numero_parte, callback_data: 'tj_' + t.id }));
  const rows = [];
  for (let i = 0; i < btns.length; i += 2) rows.push(btns.slice(i, i + 2));
  rows.push([{ text: '➕ Otra tarjeta', callback_data: 'tjotra' }]);
  const reng = d.reng || [];
  const total = reng.reduce((a, r) => a + Number(r.cant), 0);
  if (reng.length) rows.push([{ text: `✔️ Cerrar la hora (${total} tarjetas)`, callback_data: 'tjdone' }]);
  const lista = reng.length ? '\n\nLlevas:\n' + reng.map((r) => `• ${r.np} ×${r.cant}`).join('\n') : '';
  await setSess('hxh', 'hxh_tj_pick', d);
  await tg('sendMessage', { chat_id, text: `📦 Embarques · ${d.slot}: ¿qué tarjeta retiraste? Elige una por una.${lista}`, reply_markup: { inline_keyboard: rows } });
};
// cierra un paro con la duración (en min) que confirmó la líder (no inflada por cierre tardío)
const closeParo = async (paroid, min) => {
  const m = Number(min);
  const r = await pg(`UPDATE horacio.paros SET ts_fin=now(), estado='cerrado', duracion_min=${m} WHERE id='${esc(paroid)}' AND estado='abierto' RETURNING duracion_min`);
  await setSess('paro', 'idle', {});
  if (r && r.length) await tg('sendMessage', { chat_id, text: `Paro de ${m} min registrado. Gracias por avisar 🙏` });
  else await tg('sendMessage', { chat_id, text: 'Ese paro ya estaba cerrado.' });
};
// arranca paro/falt/cal sobre un tablero ya elegido
const startFlowWithBoard = async (flujo, linea_id, lnombre) => {
  if (flujo === 'paro') {
    await setSess('paro', 'paro_causa', { linea_id, lnombre });
    const cs = await pg("SELECT codigo, boton_texto FROM horacio.causas_paro WHERE activa=true AND cuenta_como_paro=true ORDER BY orden");
    const rows = cs.map((c) => [{ text: c.boton_texto, callback_data: 'pcausa_' + c.codigo }]);
    await tg('sendMessage', { chat_id, text: `Va. ¿Qué causó el paro en ${esc(lnombre)}?`, reply_markup: { inline_keyboard: rows } });
  } else if (flujo === 'falt') {
    await setSess('faltante', 'falt_parte', { linea_id, lnombre });
    await tg('sendMessage', { chat_id, text: `📦 Va (${esc(lnombre)}). ¿Qué número de parte falta? Escríbelo o mándame foto de la etiqueta.` });
  } else if (flujo === 'cal') {
    await setSess('calidad', 'cal_descripcion', { linea_id, lnombre });
    await tg('sendMessage', { chat_id, text: `🔎 (${esc(lnombre)}) Cuéntame qué pasó con la calidad (escríbelo en un mensaje).` });
  }
};
// si la líder tiene 1 tablero arranca directo; si tiene varios, pregunta cuál
const ensureBoardThen = async (flujo, label) => {
  const boards = await myBoards();
  if (!boards.length) { await tg('sendMessage', { chat_id, text: 'Primero regístrate con /start.' }); return; }
  if (boards.length === 1) { await startFlowWithBoard(flujo, boards[0].linea_id, boards[0].nombre); return; }
  const rows = boards.map((x) => [{ text: x.nombre, callback_data: `brd_${flujo}_${x.linea_id}` }]);
  await tg('sendMessage', { chat_id, text: `¿En qué tablero ${label}?`, reply_markup: { inline_keyboard: rows } });
};
// menú de órdenes (solo Daniel): un tablero por botón, marca los que ya tienen OT hoy
const ordenMenu = async () => {
  const ls = await pg(`SELECT l.id, l.nombre, ${ORDEN_SQL} AS orden, (SELECT o.meta_hr FROM horacio.ordenes_tablero o WHERE o.linea_id=l.id AND o.fecha=(now() AT TIME ZONE 'America/Mexico_City')::date AND o.vigente ORDER BY o.ts DESC LIMIT 1) AS meta FROM horacio.lineas l WHERE l.activa ORDER BY l.grupo, l.orden`);
  const rows = ls.map((l) => [{ text: (l.orden ? '✅ ' : '') + l.nombre + (l.orden ? ' (OT ' + l.orden + ', ' + (l.meta != null ? l.meta : '?') + '/h)' : ''), callback_data: 'obrd_' + l.id }]);
  rows.push([{ text: '✔️ Terminar', callback_data: 'orden_done' }]);
  await tg('sendMessage', { chat_id, text: 'Órdenes del día — toca un tablero para fijar OT y meta/hr:', reply_markup: { inline_keyboard: rows } });
};

let action = 'ignore';
const cmd = text.trim().split(' ')[0];
if (cmd === '/start' || cmd === '/alta') action = 'start';
else if (cmd === '/menu') action = 'menu';
else if (cmd === '/dueno') action = 'dueno';
else if (cmd === '/orden') action = 'orden';
else if (cmd === '/ping') action = 'ping';
else if (data.startsWith('obrd_')) action = 'orden_board';
else if (data === 'orden_done') action = 'orden_done';
else if (data === 'hxh_si') action = 'si';
else if (data === 'hxh_no') action = 'no';
else if (data.startsWith('hxhb_')) action = 'hxh_board';
else if (data === 'tjotra') action = 'tj_otra';
else if (data === 'tjdone') action = 'tj_done';
else if (data.startsWith('tj_')) action = 'tj_pick';
else if (data.startsWith('pz_')) action = 'pz';
else if (data.startsWith('c_')) action = 'causa';
else if (data === 'reg_linea') action = 'reg_linea';
else if (data === 'reg_area') action = 'reg_area';
else if (data.startsWith('alta_')) action = 'alta_pick';
else if (data.startsWith('rol_')) action = 'rol_pick';
else if (data.startsWith('brd_')) action = 'pick_board';
else if (data === 'paro_start') action = 'paro_start';
else if (data.startsWith('pcausa_')) action = 'paro_causa';
else if (data.startsWith('ack_')) action = 'ack';
else if (data.startsWith('pclose_')) action = 'pclose';
else if (data.startsWith('pdurx_')) action = 'pdurx';
else if (data.startsWith('pdur_')) action = 'pdur';
else if (data.startsWith('fbm_')) action = 'fb_mood';
else if (data === 'fb_cerrar') action = 'fb_cerrar';
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
  if (!lr || !lr.length) { await tg('sendMessage', { chat_id, text: 'Ese tablero ya no está disponible.' }); return [{ json: { action: 'alta-noline' } }]; }
  const line = lr[0];
  if (line.lider_persona_id) {
    await pg(`UPDATE horacio.personas SET chat_id=${chat_id}, consentimiento=true, nombre=CASE WHEN nombre IS NULL OR nombre='' THEN '${esc(tgname)}' ELSE nombre END WHERE id='${line.lider_persona_id}'`);
  } else {
    const ins = await pg(`INSERT INTO horacio.personas(nombre,rol,chat_id,consentimiento,activa) VALUES('${esc(tgname)}','lider',${chat_id},true,true) RETURNING id`);
    await pg(`UPDATE horacio.lineas SET lider_persona_id='${ins[0].id}' WHERE id='${line.id}'`);
  }
  const mine = await myBoards();
  const lista = mine.length > 1 ? ` Llevas ${mine.length} tableros: ${mine.map((x) => x.nombre).join(', ')}.` : '';
  await menu(`Listo 🙌 Quedaste como líder.${lista} Yo te aviso el hora por hora y tú me reportas paros, faltantes y calidad. Usa /menu cuando quieras.`);
  return [{ json: { action } }];
}
if (action === 'dueno') { await askArea(); return [{ json: { action } }]; }
if (action === 'rol_pick') {
  await rmKb(chat_id, mid);
  const rol = data.slice(4);
  const ex = await pg(`SELECT id FROM horacio.personas WHERE rol='${esc(rol)}' AND chat_id IS NULL ORDER BY created_at LIMIT 1`);
  if (ex && ex.length) await pg(`UPDATE horacio.personas SET chat_id=${chat_id}, consentimiento=true WHERE id='${ex[0].id}'`);
  else await pg(`INSERT INTO horacio.personas(nombre,rol,chat_id,consentimiento,activa) VALUES('${esc(tgname)}','${esc(rol)}',${chat_id},true,true)`);
  const okTxt = (rol === 'resumen')
    ? `Listo, ${esc(tgname)}. Cada día a las 17:00 te mando el resumen del día (por tablero, sin nombres). Gracias 🙏`
    : `Listo, ${esc(tgname)}. Te aviso lo de ${esc(rol)} en cuanto pase algo. Gracias 🙏`;
  await tg('sendMessage', { chat_id, text: okTxt });
  return [{ json: { action } }];
}
if (action === 'menu') { await menu(); return [{ json: { action } }]; }

// ---- ÓRDENES (solo Daniel / Producción) ----
if (action === 'orden') {
  const ok = await pg(`SELECT 1 FROM horacio.personas WHERE chat_id=${chat_id} AND rol='paros' AND activa LIMIT 1`);
  if (!ok || !ok.length) { await tg('sendMessage', { chat_id, text: 'Esta opción es solo para Producción (Daniel).' }); return [{ json: { action: 'orden-denied' } }]; }
  await setSess('orden', 'orden_menu', {});
  await ordenMenu();
  return [{ json: { action } }];
}
if (action === 'orden_board') {
  await rmKb(chat_id, mid);
  const id = data.slice(5);
  const lr = await pg(`SELECT nombre FROM horacio.lineas WHERE id='${esc(id)}'`);
  if (!lr || !lr.length) { await tg('sendMessage', { chat_id, text: 'Ese tablero ya no está.' }); return [{ json: { action: 'orden-noboard' } }]; }
  await setSess('orden', 'orden_ot', { cur: id, lnombre: lr[0].nombre });
  await tg('sendMessage', { chat_id, text: `¿Qué orden (OT) corre en ${esc(lr[0].nombre)}? Escríbela.` });
  return [{ json: { action } }];
}
if (action === 'orden_done') {
  await rmKb(chat_id, mid);
  await setSess('orden', 'idle', {});
  await tg('sendMessage', { chat_id, text: 'Listo, quedaron registradas las órdenes 🙌 Cada tablero con meta ya entra al cumplimiento.' });
  return [{ json: { action } }];
}
if (action === 'pick_board') {
  await rmKb(chat_id, mid);
  const rest = data.slice(4);
  const us = rest.indexOf('_');
  const fl = rest.slice(0, us), id = rest.slice(us + 1);
  const boards = await myBoards();
  const bd = boards.find((x) => x.linea_id === id);
  if (!bd) { await tg('sendMessage', { chat_id, text: 'Ese tablero ya no está. Vuelve a /menu.' }); return [{ json: { action: 'pick-noboard' } }]; }
  await startFlowWithBoard(fl, bd.linea_id, bd.nombre);
  return [{ json: { action } }];
}

// ---- PAROS ----
if (action === 'paro_start') { await rmKb(chat_id, mid); await ensureBoardThen('paro', 'fue el paro'); return [{ json: { action } }]; }
if (action === 'paro_causa') {
  await rmKb(chat_id, mid);
  const codigo = data.slice(7);
  const s = await readSess();
  if (!s || s.flujo !== 'paro' || !s.d || !s.d.linea_id) { await tg('sendMessage', { chat_id, text: 'Empecemos de nuevo: toca 🛑 en /menu.' }); return [{ json: { action: 'paro-nosess' } }]; }
  const linea_id = s.d.linea_id, lnombre = s.d.lnombre;
  const cinfo = await pg(`SELECT boton_texto, escala_a FROM horacio.causas_paro WHERE codigo='${esc(codigo)}'`);
  const causaTxt = cinfo[0].boton_texto, escala = cinfo[0].escala_a;
  let owner = null;
  if (escala) { const o = await pg(`SELECT id, chat_id, nombre FROM horacio.personas WHERE rol='${esc(escala)}' AND chat_id IS NOT NULL AND activa LIMIT 1`); if (o && o.length) owner = o[0]; }
  const ins = await pg(`INSERT INTO horacio.paros(linea_id,causa_codigo,ts_inicio,reporto_chat_id,escalado_a,estado) VALUES('${linea_id}','${esc(codigo)}',now(),${chat_id},${owner ? `'${owner.id}'` : 'NULL'},'abierto') RETURNING id`);
  const paroid = ins[0].id;
  await setSess('paro', 'idle', s.d);
  if (owner) await tg('sendMessage', { chat_id: owner.chat_id, text: `🛑 Paro en ${esc(lnombre)}: ${causaTxt}. Acúsalo para que la líder sepa que vas.`, reply_markup: { inline_keyboard: [[{ text: 'Visto 👍', callback_data: 'ack_' + paroid }]] } });
  const aviso = owner ? `Ya le avisé a ${esc(owner.nombre)}.` : '(Aún no hay responsable de esa área dado de alta — queda registrado.)';
  await tg('sendMessage', { chat_id, text: `Anotado el paro en ${esc(lnombre)} (${causaTxt}). ${aviso} Cuando se resuelva, toca aquí:`, reply_markup: { inline_keyboard: [[{ text: '✅ Ya quedó', callback_data: 'pclose_' + paroid }]] } });
  return [{ json: { action, paroid } }];
}
if (action === 'ack') {
  await rmKb(chat_id, mid);
  const paroid = data.slice(4);
  const up = await pg(`UPDATE horacio.paros SET acuse_ts=now() WHERE id='${esc(paroid)}' AND acuse_ts IS NULL RETURNING reporto_chat_id`);
  if (up && up.length) {
    const who = await pg(`SELECT nombre FROM horacio.personas WHERE chat_id=${chat_id} ORDER BY (rol<>'lider') DESC LIMIT 1`); const nombre = (who && who.length) ? who[0].nombre : 'El responsable';
    await tg('sendMessage', { chat_id: up[0].reporto_chat_id, text: `${esc(nombre)} ya lo vio 👍 Va para allá.` });
    // pedir la acción al dueño (queda en paros.accion y se avisa a la líder)
    await setSess('paro', 'paro_accion', { paroid });
    await tg('sendMessage', { chat_id, text: '¿Qué acción vas a tomar? Escríbela 🙏 — la inmediata y la correctiva/preventiva. (Queda registrada en el paro.)' });
  }
  return [{ json: { action } }];
}
if (action === 'pclose') {
  await rmKb(chat_id, mid);
  const paroid = data.slice(7);
  const chk = await pg(`SELECT estado, ROUND(EXTRACT(EPOCH FROM (now()-ts_inicio))/60.0)::int AS est FROM horacio.paros WHERE id='${esc(paroid)}'`);
  if (!chk.length || chk[0].estado !== 'abierto') { await tg('sendMessage', { chat_id, text: 'Ese paro ya estaba cerrado.' }); return [{ json: { action: 'pclose-cerrado' } }]; }
  await setSess('paro', 'paro_dur', { paroid });
  const ms = [15, 30, 45, 60, 90, 120];
  const rows = [ms.slice(0, 3).map((m) => ({ text: m + ' min', callback_data: `pdur_${paroid}_${m}` })), ms.slice(3).map((m) => ({ text: m + ' min', callback_data: `pdur_${paroid}_${m}` })), [{ text: 'Otro…', callback_data: `pdurx_${paroid}` }]];
  await tg('sendMessage', { chat_id, text: `¿Cuántos minutos duró el paro realmente? (así no se infla el dato)`, reply_markup: { inline_keyboard: rows } });
  return [{ json: { action } }];
}
if (action === 'pdur' || action === 'pdurx') {
  await rmKb(chat_id, mid);
  if (action === 'pdurx') {
    const paroid = data.slice(6);
    await setSess('paro', 'paro_dur', { paroid, otro: true });
    await tg('sendMessage', { chat_id, text: 'Escríbeme cuántos minutos duró (solo el número).' });
    return [{ json: { action } }];
  }
  const rest = data.slice(5), us = rest.lastIndexOf('_');
  const paroid = rest.slice(0, us), min = parseInt(rest.slice(us + 1), 10);
  await closeParo(paroid, min);
  return [{ json: { action } }];
}

// ---- FALTANTES ----
if (action === 'falt_start') { await rmKb(chat_id, mid); await ensureBoardThen('falt', 'falta material'); return [{ json: { action } }]; }
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
if (action === 'cal_start') { await rmKb(chat_id, mid); await ensureBoardThen('cal', 'es la calidad'); return [{ json: { action } }]; }
if (action === 'cack') {
  await rmKb(chat_id, mid);
  const id = data.slice(5);
  const up = await pg(`UPDATE horacio.calidad SET acuse_ts=now() WHERE id='${esc(id)}' AND acuse_ts IS NULL RETURNING reporto_chat_id`);
  if (up && up.length) await tg('sendMessage', { chat_id: up[0].reporto_chat_id, text: 'Marco ya lo tiene 👍' });
  return [{ json: { action } }];
}

// ---- ENCUESTA DE SALIDA (feedback) ----
if (action === 'fb_mood') {
  await rmKb(chat_id, mid);
  const mood = data.slice(4);
  if (['bien', 'normal', 'pesado'].indexOf(mood) < 0) return [{ json: { action: 'fb-badmood' } }];
  const p = await pg(`SELECT id FROM horacio.personas WHERE chat_id=${chat_id} LIMIT 1`);
  const pid = p.length ? `'${p[0].id}'` : 'NULL';
  const ins = await pg(`INSERT INTO horacio.feedback(persona_id,chat_id,fecha,mood) VALUES(${pid},${chat_id},(now() AT TIME ZONE 'America/Mexico_City')::date,'${mood}') RETURNING id`);
  await setSess('feedback', 'fb_texto', { fid: ins[0].id, mood, msgs: [] });
  const ack = mood === 'bien' ? '¡Me alegra! 🙌' : (mood === 'normal' ? 'Va, gracias por decirme 🙏' : 'Lamento que estuviera pesado 🙏');
  await tg('sendMessage', { chat_id, text: `${ack} ¿Algo que quieras contarme? Lo que salió bien, lo que te estorbó, o si traes una duda — aquí te leo. (o escribe “no” si prefieres dejarlo así)` });
  return [{ json: { action: 'fb_mood', mood } }];
}
if (action === 'fb_cerrar') {
  await rmKb(chat_id, mid);
  const s = await readSess();
  await setSess('feedback', 'idle', {});
  await tg('sendMessage', { chat_id, text: 'Gracias por contarme 🙏 Descansa, mañana seguimos.' });
  if (s && s.d && s.d.mood === 'pesado' && s.d.fid) await escalarRH(s.d.fid, chat_id);
  return [{ json: { action: 'fb_cerrar' } }];
}

// ---- HxH captura por tarjetas (Embarques) ----
if (action === 'tj_pick') {
  await rmKb(chat_id, mid);
  const s = await readSess();
  if (!s || s.step !== 'hxh_tj_pick' || !s.d.cur) { await tg('sendMessage', { chat_id, text: 'Espera el ping del hora por hora 🙏' }); return [{ json: { action: 'tj-guard' } }]; }
  const tid = data.slice(3);
  const tr = await pg(`SELECT id, numero_parte FROM horacio.tarjetas WHERE id='${esc(tid)}' AND activa`);
  if (!tr || !tr.length) { await tg('sendMessage', { chat_id, text: 'Esa tarjeta ya no está. Elige otra.' }); await tjPickMenu(s.d); return [{ json: { action: 'tj-notfound' } }]; }
  const d = Object.assign({}, s.d, { tj: { id: tr[0].id, np: tr[0].numero_parte } });
  await setSess('hxh', 'hxh_tj_cant', d);
  await tg('sendMessage', { chat_id, text: `¿Cuántas ${esc(tr[0].numero_parte)}? Escríbeme el número.` });
  return [{ json: { action: 'tj_pick' } }];
}
if (action === 'tj_otra') {
  await rmKb(chat_id, mid);
  const s = await readSess();
  if (!s || s.step !== 'hxh_tj_pick' || !s.d.cur) { await tg('sendMessage', { chat_id, text: 'Espera el ping del hora por hora 🙏' }); return [{ json: { action: 'tjotra-guard' } }]; }
  await setSess('hxh', 'hxh_tj_np', s.d);
  await tg('sendMessage', { chat_id, text: 'Escríbeme el número de parte de la tarjeta (tal cual viene en la etiqueta).' });
  return [{ json: { action: 'tj_otra' } }];
}
if (action === 'tj_done') {
  await rmKb(chat_id, mid);
  const s = await readSess();
  if (!s || s.step !== 'hxh_tj_pick' || !s.d.cur) { await tg('sendMessage', { chat_id, text: 'Espera el ping del hora por hora 🙏' }); return [{ json: { action: 'tjdone-guard' } }]; }
  const d = s.d; const reng = d.reng || [];
  if (!reng.length) { await tg('sendMessage', { chat_id, text: 'Aún no anotas ninguna tarjeta. Toca una del catálogo o ➕ Otra 🙏' }); await tjPickMenu(d); return [{ json: { action: 'tj-empty' } }]; }
  const board = d.boards.find((x) => x.linea_id === d.cur);
  const total = reng.reduce((a, r) => a + Number(r.cant), 0);
  const ins = await pg(`INSERT INTO horacio.hora_por_hora(linea_id,fecha,hora_slot,real,t_productivo_min,reporto_chat_id) VALUES('${d.cur}','${d.fecha}','${d.slot}',${total},60,${chat_id}) RETURNING id`);
  const hxhId = ins[0].id;
  for (const r of reng) {
    await pg(`INSERT INTO horacio.hxh_tarjetas(hxh_id,tarjeta_id,numero_parte,cantidad) VALUES('${hxhId}',${r.tarjeta_id ? `'${esc(r.tarjeta_id)}'` : 'NULL'},'${esc(r.np)}',${Number(r.cant)})`);
  }
  const detalle = reng.map((r) => `${r.np} ×${r.cant}`).join(', ');
  await tg('sendMessage', { chat_id, text: `Va, anotado 👍 ${board.nombre}: ${total} ${board.unidad || 'tarjetas'} (${detalle}).` });
  d.done.push(d.cur); d.cur = null; d.reng = []; d.tj = null;
  await hxhBoardMenu(d);
  return [{ json: { action: 'tj_done', hxhId } }];
}

// ---- HxH ----
if (action === 'ping') {
  const B = await myBoards();
  if (!B.length) { await tg('sendMessage', { chat_id, text: 'No tienes tableros asignados. Haz /start.' }); return [{ json: { action: 'ping-noboard' } }]; }
  const now = nowMX(); const fecha = now.toFormat('yyyy-LL-dd');
  const ch = (Number(now.toFormat('mm')) >= 30) ? Number(now.toFormat('HH')) + 1 : Number(now.toFormat('HH'));
  const slot = winClose(ch); // ventana abierta actual
  const d = { fecha, slot, boards: B, done: [], cur: null, reminded: false };
  await hxhBoardMenu(d);
  return [{ json: { action } }];
}
if (action === 'hxh_board') {
  await rmKb(chat_id, mid);
  const s = await readSess();
  if (!s || s.flujo !== 'hxh' || !s.d || !Array.isArray(s.d.boards)) { await tg('sendMessage', { chat_id, text: 'Espera el ping del hora por hora 🙏' }); return [{ json: { action: 'board-nosess' } }]; }
  const id = data.slice(5);
  const board = s.d.boards.find((x) => x.linea_id === id);
  if (!board) { await tg('sendMessage', { chat_id, text: 'Ese tablero ya no está en este ping.' }); return [{ json: { action: 'board-missing' } }]; }
  if (s.d.done.includes(id)) { await hxhBoardMenu(s.d); return [{ json: { action: 'board-already' } }]; }
  // robustez: confirmar el modo de captura desde BD (sesiones creadas por un
  // ping anterior a un deploy no traen 'captura' en el snapshot → caerían a la ruta numérica)
  let captura = board.captura;
  if (!captura) { const cr = await pg(`SELECT captura FROM horacio.lineas WHERE id='${esc(id)}'`); captura = (cr && cr.length && cr[0].captura) ? cr[0].captura : 'conteo'; }
  if (captura === 'tarjetas') {
    const d = Object.assign({}, s.d, { cur: id, reng: [], tj: null });
    await tjPickMenu(d);
    return [{ json: { action: 'hxh_board_tj' } }];
  }
  const d = Object.assign({}, s.d, { cur: id });
  const ot = board.orden ? (' · OT ' + board.orden) : '';
  if (board.plan != null) {
    await setSess('hxh', 'hxh_meta', d);
    await tg('sendMessage', { chat_id, text: `${board.nombre}${ot}, ${d.slot}: ¿salió la meta (${board.plan})?`, reply_markup: { inline_keyboard: [[{ text: '✅ Sí', callback_data: 'hxh_si' }, { text: '❌ Faltó', callback_data: 'hxh_no' }]] } });
  } else {
    await setSess('hxh', 'hxh_real', d);
    await tg('sendMessage', { chat_id, text: `${board.nombre}${ot}, ${d.slot}: ¿cuántas ${board.unidad || 'piezas'}? Escríbeme el número.` });
  }
  return [{ json: { action } }];
}
if (action === 'si') {
  await rmKb(chat_id, mid);
  const s = await readSess();
  if (!s || s.step !== 'hxh_meta' || !s.d.cur) { await tg('sendMessage', { chat_id, text: 'Espera el ping del hora por hora 🙏' }); return [{ json: { action: 'si-guard' } }]; }
  const d = s.d; const board = d.boards.find((x) => x.linea_id === d.cur); const plan = board.plan;
  await pg(`INSERT INTO horacio.hora_por_hora(linea_id,fecha,hora_slot,plan,real,t_productivo_min,reporto_chat_id) VALUES('${d.cur}','${d.fecha}','${d.slot}',${plan},${plan},60,${chat_id})`);
  await tg('sendMessage', { chat_id, text: `Va, anotado 👍 ${board.nombre}: ${plan}/${plan}.` });
  d.done.push(d.cur); d.cur = null;
  await hxhBoardMenu(d);
  return [{ json: { action } }];
}
if (action === 'no') {
  const s = await readSess();
  if (!s || s.step !== 'hxh_meta' || !s.d.cur) { await tg('sendMessage', { chat_id, text: 'Espera el ping del hora por hora 🙏' }); return [{ json: { action: 'no-guard' } }]; }
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
  if (!s || s.step !== 'hxh_causa' || !s.d.cur) return [{ json: { action: 'causa-guard' } }];
  await rmKb(chat_id, mid);
  const d = s.d, codigo = data.slice(2);
  const board = d.boards.find((x) => x.linea_id === d.cur); const plan = board.plan;
  const mids = { '0_25': 13, '26_50': 38, '51_75': 63, '76p': 88 };
  const real = Math.max(plan - (mids[d.faltaron] != null ? mids[d.faltaron] : 0), 0);
  await pg(`INSERT INTO horacio.hora_por_hora(linea_id,fecha,hora_slot,plan,real,t_productivo_min,causa_codigo,reporto_chat_id) VALUES('${d.cur}','${d.fecha}','${d.slot}',${plan},${real},60,'${esc(codigo)}',${chat_id})`);
  const ct = await pg(`SELECT boton_texto FROM horacio.causas_paro WHERE codigo='${esc(codigo)}'`);
  await tg('sendMessage', { chat_id, text: `Gracias por avisar 🙏 ${board.nombre} (${d.slot}): ~${real}/${plan}, causa: ${ct[0].boton_texto}.` });
  d.done.push(d.cur); d.cur = null;
  await hxhBoardMenu(d);
  return [{ json: { action } }];
}

// ---- ENTRADA LIBRE (texto/foto) según sesión activa ----
if (action === 'ignore' && msg && (text || photo)) {
  const s = await readSess();
  if (s && s.flujo === 'feedback' && s.step === 'fb_texto' && s.d.fid) {
    const t = (text || '').trim();
    await pg(`UPDATE horacio.feedback SET texto='${esc(t.slice(0, 1000))}' WHERE id='${esc(s.d.fid)}'`);
    if (/^(no|nada|na|todo bien|asi esta bien|así está bien|estoy bien|gracias|ninguna)\.?$/i.test(t)) {
      await setSess('feedback', 'idle', {});
      await tg('sendMessage', { chat_id, text: 'Va, gracias por tu día 🙏 Descansa, aquí estoy mañana.' });
      if (s.d.mood === 'pesado') await escalarRH(s.d.fid, chat_id);
      return [{ json: { action: 'fb_texto_no' } }];
    }
    const msgs = [{ role: 'user', content: t }];
    const reply = await askHoracio(msgs);
    msgs.push({ role: 'assistant', content: reply });
    await setSess('feedback', 'fb_chat', { fid: s.d.fid, mood: s.d.mood, msgs, turns: 1 });
    await tg('sendMessage', { chat_id, text: reply, reply_markup: { inline_keyboard: [[{ text: '✅ Cerrar la plática', callback_data: 'fb_cerrar' }]] } });
    return [{ json: { action: 'fb_texto' } }];
  }
  if (s && s.flujo === 'feedback' && s.step === 'fb_chat' && s.d.fid) {
    const t = (text || '').trim();
    const msgs = (s.d.msgs || []).slice(-10);
    msgs.push({ role: 'user', content: t });
    const reply = await askHoracio(msgs);
    msgs.push({ role: 'assistant', content: reply });
    const turns = (s.d.turns || 1) + 1;
    await pg(`UPDATE horacio.feedback SET texto=COALESCE(texto,'')||E'\\n— '||'${esc(t.slice(0, 500))}' WHERE id='${esc(s.d.fid)}'`);
    if (turns >= 6) {
      await setSess('feedback', 'idle', {});
      await tg('sendMessage', { chat_id, text: reply + '\n\nGracias por platicar conmigo 🙏 Descansa. Si quieres, seguimos mañana.' });
      if (s.d.mood === 'pesado') await escalarRH(s.d.fid, chat_id);
      return [{ json: { action: 'fb_chat_end' } }];
    }
    await setSess('feedback', 'fb_chat', { fid: s.d.fid, mood: s.d.mood, msgs: msgs.slice(-10), turns });
    await tg('sendMessage', { chat_id, text: reply, reply_markup: { inline_keyboard: [[{ text: '✅ Cerrar la plática', callback_data: 'fb_cerrar' }]] } });
    return [{ json: { action: 'fb_chat' } }];
  }
  if (s && s.step === 'paro_accion' && s.d.paroid) {
    const acc = (text || '').trim();
    if (!acc) { await tg('sendMessage', { chat_id, text: 'Escríbeme la acción que tomarás 🙏' }); return [{ json: { action: 'paro_accion_bad' } }]; }
    const up = await pg(`UPDATE horacio.paros SET accion='${esc(acc.slice(0, 500))}' WHERE id='${esc(s.d.paroid)}' RETURNING reporto_chat_id`);
    await setSess('paro', 'idle', {});
    await tg('sendMessage', { chat_id, text: 'Anotada la acción 🙏 Gracias.' });
    if (up && up.length && up[0].reporto_chat_id) await tg('sendMessage', { chat_id: up[0].reporto_chat_id, text: `Acción sobre el paro: ${acc.slice(0, 500)}` });
    return [{ json: { action: 'paro_accion' } }];
  }
  if (s && s.step === 'paro_dur' && s.d.paroid) {
    const n = parseInt(String(text || '').replace(/[^0-9]/g, ''), 10);
    if (isNaN(n) || n < 1 || n > 1440) { await tg('sendMessage', { chat_id, text: 'Mándame cuántos minutos duró (solo el número, 1 a 1440) 🙏' }); return [{ json: { action: 'paro_dur_bad' } }]; }
    await closeParo(s.d.paroid, n);
    return [{ json: { action: 'paro_dur' } }];
  }
  if (s && s.step === 'orden_ot') {
    const ot = (text || '').trim();
    if (!ot) { await tg('sendMessage', { chat_id, text: 'Escríbeme la OT (texto).' }); return [{ json: { action: 'orden_ot_bad' } }]; }
    await setSess('orden', 'orden_meta', Object.assign({}, s.d, { orden: ot }));
    await tg('sendMessage', { chat_id, text: `¿Meta por hora de ${esc(s.d.lnombre)}? (solo el número)` });
    return [{ json: { action: 'orden_ot' } }];
  }
  if (s && s.step === 'orden_meta') {
    const m = parseInt(String(text || '').replace(/[^0-9]/g, ''), 10);
    if (isNaN(m) || m < 1 || m > 100000) { await tg('sendMessage', { chat_id, text: 'Mándame la meta por hora como número (1 a 100000) 🙏' }); return [{ json: { action: 'orden_meta_bad' } }]; }
    const cur = s.d.cur;
    await pg(`UPDATE horacio.ordenes_tablero SET vigente=false WHERE linea_id='${esc(cur)}' AND fecha=(now() AT TIME ZONE 'America/Mexico_City')::date AND vigente`);
    await pg(`INSERT INTO horacio.ordenes_tablero(linea_id,fecha,orden,meta_hr,vigente,set_by_chat) VALUES('${esc(cur)}',(now() AT TIME ZONE 'America/Mexico_City')::date,'${esc(s.d.orden)}',${m},true,${chat_id})`);
    await setSess('orden', 'orden_menu', {});
    await tg('sendMessage', { chat_id, text: `Anotado: ${esc(s.d.lnombre)} → OT ${esc(s.d.orden)}, meta ${m}/h.` });
    await ordenMenu();
    return [{ json: { action: 'orden_meta' } }];
  }
  if (s && s.step === 'hxh_tj_np' && s.d.cur) {
    const np = (text || '').trim();
    if (!np) { await tg('sendMessage', { chat_id, text: 'Escríbeme el número de parte de la tarjeta 🙏' }); return [{ json: { action: 'tj_np_bad' } }]; }
    if (np.length > 60) { await tg('sendMessage', { chat_id, text: 'Ese número de parte es muy largo 🤔 mándame solo el NP de la etiqueta.' }); return [{ json: { action: 'tj_np_long' } }]; }
    const up = await pg(`INSERT INTO horacio.tarjetas(numero_parte) VALUES('${esc(np)}') ON CONFLICT (numero_parte) DO UPDATE SET activa=true RETURNING id, numero_parte`);
    const d = Object.assign({}, s.d, { tj: { id: up[0].id, np: up[0].numero_parte } });
    await setSess('hxh', 'hxh_tj_cant', d);
    await tg('sendMessage', { chat_id, text: `¿Cuántas ${esc(up[0].numero_parte)}? Escríbeme el número.` });
    return [{ json: { action: 'tj_np' } }];
  }
  if (s && s.step === 'hxh_tj_cant' && s.d.cur && s.d.tj) {
    const n = parseInt(String(text || '').replace(/[^0-9]/g, ''), 10);
    if (isNaN(n) || n < 1) { await tg('sendMessage', { chat_id, text: 'Mándame cuántas tarjetas, solo el número 🙏' }); return [{ json: { action: 'tj_cant_bad' } }]; }
    if (n > 100000) { await tg('sendMessage', { chat_id, text: 'Ese número parece muy grande 🤔 mándame solo el conteo de esa tarjeta.' }); return [{ json: { action: 'tj_cant_big' } }]; }
    const d = s.d; d.reng = d.reng || [];
    d.reng.push({ tarjeta_id: d.tj.id, np: d.tj.np, cant: n });
    d.tj = null;
    await tjPickMenu(d);
    return [{ json: { action: 'tj_cant' } }];
  }
  if (s && s.step === 'hxh_real' && s.d.cur) {
    const n = parseInt(String(text || '').replace(/[^0-9]/g, ''), 10);
    if (isNaN(n)) { await tg('sendMessage', { chat_id, text: 'Mándame solo el número que salió 🙏' }); return [{ json: { action: 'hxh_real_bad' } }]; }
    if (n > 100000) { await tg('sendMessage', { chat_id, text: 'Ese número parece muy grande 🤔 mándame solo el conteo de esta hora.' }); return [{ json: { action: 'hxh_real_big' } }]; }
    const d = s.d; const board = d.boards.find((x) => x.linea_id === d.cur);
    await pg(`INSERT INTO horacio.hora_por_hora(linea_id,fecha,hora_slot,real,t_productivo_min,reporto_chat_id) VALUES('${d.cur}','${d.fecha}','${d.slot}',${n},60,${chat_id})`);
    await tg('sendMessage', { chat_id, text: `Va, anotado 👍 ${board.nombre}: ${n} ${board.unidad || 'piezas'}.` });
    d.done.push(d.cur); d.cur = null;
    await hxhBoardMenu(d);
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
