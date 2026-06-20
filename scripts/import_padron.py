#!/usr/bin/env python3
# Carga Organigrama/08_Operadores/*.md al padrón de RH horacio.personal
# (sensible=true, RH-only; NO liga al bot). Idempotente por archivo.
#   Uso:  python3 scripts/import_padron.py [--dry]
import os, glob, json, ssl, urllib.request, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SK = ''
for ln in open(os.path.join(HERE, 'secrets.env')):
    if ln.startswith('SERVICE_ROLE_KEY='):
        SK = ln.split('=', 1)[1].strip()
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
DRY = '--dry' in sys.argv
SKIP = {'MOC - Operadores', 'Dnm', 'Dhnm'}  # índices/placeholders, no son personas

def pg(q):
    req = urllib.request.Request("https://supabase.nexiasoluciones.com.mx/pg/query",
        data=json.dumps({"query": q}).encode(),
        headers={"apikey": SK, "Authorization": "Bearer " + SK, "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, context=ctx))

def esc(s):
    return str(s).replace("'", "''")

def parse(text):
    fm = {}
    m = re.match(r'^---\n(.*?)\n---\n', text, re.S)
    if m:
        for line in m.group(1).split('\n'):
            if ':' in line:
                k, v = line.split(':', 1); fm[k.strip()] = v.strip()
    campos = {}
    for k, v in re.findall(r'^\|\s*([^|]+?)\s*\|\s*(.+?)\s*\|\s*$', text, re.M):
        k = k.strip()
        if k.lower() not in ('campo', 'respuesta', 'detalle') and v.strip() not in ('---', ''):
            campos[k] = v.strip()
    return fm, campos

n = 0
for f in sorted(glob.glob(os.path.join(HERE, '..', 'Organigrama', '08_Operadores', '*.md'))):
    nombre = os.path.basename(f)[:-3]
    if nombre in SKIP:
        continue
    text = open(f, encoding='utf-8').read()
    fm, campos = parse(text)
    if 'tipo' not in fm and not campos:   # sin estructura → no es ficha de persona
        continue
    seed = {'archivo': nombre, 'frontmatter': fm, 'campos': campos, 'texto': text[:12000]}
    area = fm.get('area', '')
    print(f"  {'(dry) ' if DRY else ''}→ {nombre[:40]:40s} area={area}")
    if not DRY:
        pg(f"INSERT INTO horacio.personal(archivo,nombre,categoria,area,seed,sensible) "
           f"VALUES('{esc(nombre)}','{esc(nombre)}','operador','{esc(area)}','{esc(json.dumps(seed, ensure_ascii=False))}'::jsonb,true) "
           f"ON CONFLICT(archivo) DO UPDATE SET seed=EXCLUDED.seed, area=EXCLUDED.area, actualizado_ts=now()")
        n += 1
print(f"\n{'DRY-RUN (nada escrito)' if DRY else 'Cargados al padrón'}: {n}")
