#!/usr/bin/env python3
# Importa las fichas de Organigrama/02_Contactos/*.md a horacio.perfiles.seed
# para las personas que ya existen en horacio.personas (match por nombre normalizado).
# La ficha completa queda en seed (sensible=true, RH-only). NO toca `aprendido`
# (eso lo cura RH) → nada sensible viaja al prompt del bot.
#   Uso:  python3 scripts/import_perfiles.py [--dry]
import os, glob, json, ssl, urllib.request, unicodedata, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SK = ''
for ln in open(os.path.join(HERE, 'secrets.env')):
    if ln.startswith('SERVICE_ROLE_KEY='):
        SK = ln.split('=', 1)[1].strip()
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
DRY = '--dry' in sys.argv

def pg(q):
    req = urllib.request.Request("https://supabase.nexiasoluciones.com.mx/pg/query",
        data=json.dumps({"query": q}).encode(),
        headers={"apikey": SK, "Authorization": "Bearer " + SK, "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, context=ctx))

def norm(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    s = re.sub(r'\([^)]*\)', '', s)
    return re.sub(r'\s+', ' ', s).strip()

def esc(s):
    return str(s).replace("'", "''")

def parse_md(text):
    tags = []
    m = re.search(r'^(#[\w\-áéíóúñ ]+)+$', text, re.M)
    mt = re.search(r'\n(#[^\n]+)\n', text)
    if mt:
        tags = re.findall(r'#([\w\-]+)', mt.group(1))
    campos = {}
    for k, v in re.findall(r'^\|\s*\*{0,2}([^|*]+?)\*{0,2}\s*\|\s*(.+?)\s*\|\s*$', text, re.M):
        k = k.strip()
        v = re.sub(r'\[\[[^\]|]*\|?([^\]]*)\]\]', r'\1', v).strip()  # [[a|b]] -> b
        if k.lower() not in ('campo', 'detalle', 'dimensión', 'nivel', 'evidencia') and v and v != '---':
            campos[k] = v
    return {'tags': tags, 'campos': campos}

# personas
personas = pg("SELECT id, nombre, rol FROM horacio.personas WHERE activa")
pmap = {}
for p in personas:
    pmap.setdefault(norm(p['nombre']), []).append(p)

imported = 0
for f in sorted(glob.glob(os.path.join(HERE, '..', 'Organigrama', '02_Contactos', '*.md'))):
    nombre_md = os.path.basename(f)[:-3]
    n = norm(nombre_md)
    if n not in pmap:
        continue
    # persona principal: evitar alias "(resumen)"
    targets = [p for p in pmap[n] if '(resumen)' not in p['nombre']] or pmap[n]
    p = targets[0]
    text = open(f, encoding='utf-8').read()
    parsed = parse_md(text)
    seed = {'archivo': nombre_md, 'tags': parsed['tags'], 'campos': parsed['campos'], 'texto': text[:12000]}
    seed_json = esc(json.dumps(seed, ensure_ascii=False))
    print(f"  {'(dry) ' if DRY else ''}→ {p['nombre']:24s} ← {nombre_md}.md  ({len(parsed['campos'])} campos)")
    if not DRY:
        pg(f"INSERT INTO horacio.perfiles(persona_id,seed,sensible) VALUES('{p['id']}','{seed_json}'::jsonb,true) "
           f"ON CONFLICT(persona_id) DO UPDATE SET seed=EXCLUDED.seed, sensible=true, actualizado_ts=now()")
        imported += 1
# Overrides explícitos confirmados por el Director: persona ← MD (puede estar en 08_Operadores)
OVERRIDES = {'Rocío (Chío)': 'Rocío Mera Cerón', 'Diana Pavón': 'Diana Yasmín Pavón Flores', 'Charly': 'Juan Carlos Martínez'}
for pnombre, mdname in OVERRIDES.items():
    key = norm(pnombre)
    if key not in pmap:
        continue
    p = [x for x in pmap[key] if '(resumen)' not in x['nombre']][0]
    cand = glob.glob(os.path.join(HERE, '..', 'Organigrama', '*', mdname + '.md'))
    if not cand:
        print(f"  ⚠️ override sin archivo: {mdname}.md"); continue
    text = open(cand[0], encoding='utf-8').read()
    parsed = parse_md(text)
    seed = {'archivo': mdname, 'tags': parsed['tags'], 'campos': parsed['campos'], 'texto': text[:12000]}
    print(f"  {'(dry) ' if DRY else ''}→ {p['nombre']:24s} ← {mdname}.md  (override)")
    if not DRY:
        pg(f"INSERT INTO horacio.perfiles(persona_id,seed,sensible) VALUES('{p['id']}','{esc(json.dumps(seed, ensure_ascii=False))}'::jsonb,true) "
           f"ON CONFLICT(persona_id) DO UPDATE SET seed=EXCLUDED.seed, sensible=true, actualizado_ts=now()")
        imported += 1

print(f"\n{'DRY-RUN (nada escrito)' if DRY else 'Importados'}: {imported}")
