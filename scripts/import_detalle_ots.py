#!/usr/bin/env python3
# Carga el "Reporte detalle OTS" del ERP a horacio.ordenes_trabajo (snapshot diario).
# Fuente ÚNICA: trae el universo completo de OT (447) CON avance:
#   col "Tiempo Estimado" (nombre engañoso del ERP) = cantidad TERMINADA · "% Avance" = pct.
# Mapea Status del ERP a estado_nexia: Cance→muerta · Cerra→cerrada · resto→propuesta.
# Idempotente (UPSERT por orden_trabajo+snapshot). Aplica primero sql/034_detalle_ots.sql.
#
# Uso:
#   python3 scripts/import_detalle_ots.py "<detalle.xlsx>" <YYYY-MM-DD snapshot> [--single] [--dry]
#     --single : tras cargar, migra comentario/motivo de snapshots viejos al nuevo y los borra
#                (deja UNA sola foto en la tabla — las vistas no filtran por snapshot)
#     --dry    : no escribe; solo reporta conteos
import os, sys, json, ssl, re, urllib.request, datetime
import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
SK = ''
for ln in open(os.path.join(HERE, 'secrets.env')):
    if ln.startswith('SERVICE_ROLE_KEY='):
        SK = ln.split('=', 1)[1].strip()
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
DRY = '--dry' in sys.argv
SINGLE = '--single' in sys.argv

def pg(q):
    req = urllib.request.Request("https://supabase.nexiasoluciones.com.mx/pg/query",
        data=json.dumps({"query": q}).encode(),
        headers={"apikey": SK, "Authorization": "Bearer " + SK, "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, context=ctx))

def esc(v):
    if v is None: return 'NULL'
    return "'" + str(v).replace("'", "''") + "'"

def num(v):
    if v is None or isinstance(v, str): return 'NULL'
    try: return repr(float(v))
    except (TypeError, ValueError): return 'NULL'

def parse_date(v):
    """ERP mezcla celdas con formato fecha (datetime) y texto 'DD/MM/YY'."""
    if isinstance(v, (datetime.datetime, datetime.date)):
        return "'" + v.strftime('%Y-%m-%d') + "'"
    if isinstance(v, str):
        m = re.match(r'(\d{1,2})/(\d{1,2})/(\d{2,4})', v.strip())
        if m:
            d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
            if y < 100: y += 2000
            try:
                return "'" + datetime.date(y, mo, d).strftime('%Y-%m-%d') + "'"
            except ValueError:
                return 'NULL'
    return 'NULL'

def norm_np(raw):
    if raw is None: return None
    s = str(raw).strip().upper()
    s = re.sub(r'_SMT$', '', s)
    return s.strip()

# Status del ERP → estado_nexia (workflow Nexia)
def estado_nexia(status):
    s = (status or '').strip().lower()
    if s.startswith('cance'): return 'muerta'
    if s.startswith('cerra'): return 'cerrada'
    return 'propuesta'

# Índices de columna en el "Reporte detalle OTS"
C_OT, C_NP, C_DESC, C_PROC, C_TIPO, C_STATUS = 0, 1, 2, 3, 4, 5
C_FORDEN, C_FVENCE, C_LOTE, C_UM, C_ORD, C_TERM, C_PCT = 6, 7, 8, 9, 10, 11, 12

def main():
    det_file, snap = sys.argv[1], sys.argv[2]

    ddl = open(os.path.join(HERE, '..', 'sql', '034_detalle_ots.sql'), encoding='utf-8').read()
    if not DRY:
        pg(ddl); print("DDL 034 aplicado.")

    wb = openpyxl.load_workbook(det_file, data_only=True)
    ws = wb.worksheets[0]
    rows = [r for r in list(ws.iter_rows(values_only=True))[1:]
            if r[C_OT] is not None and r[C_NP] is not None]

    n = 0
    by_estado = {}
    for r in rows:
        ot = str(r[C_OT]).strip()
        base, _, part = ot.rpartition('-')
        if not base: base, part = ot, None
        raw_np = r[C_NP]
        es_smt = '_SMT' in str(raw_np).upper() or (part in ('02', '03'))
        npn = norm_np(raw_np)
        en = estado_nexia(r[C_STATUS])
        by_estado[en] = by_estado.get(en, 0) + 1
        if not DRY:
            pg(f"""INSERT INTO horacio.ordenes_trabajo
                (orden_trabajo,orden_base,partida,es_smt,numero_parte,numero_parte_raw,descripcion,
                 tipo_ot,proceso_codigo,cant_ordenada,cant_terminada,pct_avance,
                 fecha_orden,fecha_vence,status_origen,estado_nexia,fecha_snapshot)
                VALUES({esc(ot)},{esc(base)},{esc(part)},{str(es_smt).upper()},{esc(npn)},{esc(raw_np)},
                  {esc(r[C_DESC])},{esc(r[C_TIPO])},{esc(r[C_PROC])},
                  {num(r[C_ORD])},{num(r[C_TERM])},{num(r[C_PCT])},
                  {parse_date(r[C_FORDEN])},{parse_date(r[C_FVENCE])},
                  {esc(r[C_STATUS])},{esc(en)},{esc(snap)})
                ON CONFLICT (orden_trabajo,fecha_snapshot) DO UPDATE SET
                  numero_parte=EXCLUDED.numero_parte, numero_parte_raw=EXCLUDED.numero_parte_raw,
                  descripcion=EXCLUDED.descripcion, cant_ordenada=EXCLUDED.cant_ordenada,
                  cant_terminada=EXCLUDED.cant_terminada, pct_avance=EXCLUDED.pct_avance,
                  fecha_orden=EXCLUDED.fecha_orden, fecha_vence=EXCLUDED.fecha_vence,
                  status_origen=EXCLUDED.status_origen, estado_nexia=EXCLUDED.estado_nexia""")
        n += 1
    print(f"OT cargadas: {n} (snapshot {snap}) · estado_nexia: {by_estado}")

    if SINGLE and not DRY:
        # migra notas humanas de snapshots viejos al nuevo, luego borra los viejos
        pg(f"""UPDATE horacio.ordenes_trabajo nw SET
                  comentario      = COALESCE(nw.comentario, old.comentario),
                  motivo_no_corre = COALESCE(nw.motivo_no_corre, old.motivo_no_corre)
                FROM horacio.ordenes_trabajo old
                WHERE nw.fecha_snapshot = {esc(snap)}
                  AND old.fecha_snapshot <> {esc(snap)}
                  AND old.orden_trabajo = nw.orden_trabajo
                  AND (old.comentario IS NOT NULL OR old.motivo_no_corre IS NOT NULL)""")
        res = pg(f"DELETE FROM horacio.ordenes_trabajo WHERE fecha_snapshot <> {esc(snap)}")
        print(f"Snapshots viejos borrados (notas migradas al {snap}).")

if __name__ == '__main__':
    main()
