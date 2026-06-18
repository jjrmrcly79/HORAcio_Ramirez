#!/usr/bin/env python3
# Sube el jsCode de un archivo al nodo Code de un workflow n8n via API REST.
# Uso: python3 scripts/push_code.py <code_file> <workflow_id> <node_name>
import json, os, sys, urllib.request, ssl

ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
HERE = os.path.dirname(os.path.abspath(__file__))

def load_secrets():
    d = {}
    for ln in open(os.path.join(HERE, 'secrets.env')):
        ln = ln.strip()
        if ln and '=' in ln and not ln.startswith('#'):
            k, v = ln.split('=', 1); d[k] = v
    return d

def find_n8n():
    cfg = json.load(open(os.path.expanduser('~/.claude.json')))
    def walk(o):
        if isinstance(o, dict):
            if o.get('env', {}).get('N8N_API_KEY'):
                e = o['env']; return e['N8N_API_KEY'], e.get('N8N_API_URL', 'https://n8n.nexiasoluciones.com.mx')
            for v in o.values():
                r = walk(v)
                if r: return r
        elif isinstance(o, list):
            for v in o:
                r = walk(v)
                if r: return r
    return walk(cfg)

def main():
    code_file, wid, node = sys.argv[1], sys.argv[2], sys.argv[3]
    s = load_secrets()
    APIKEY, BASE = find_n8n()
    code = open(code_file, encoding='utf-8').read()
    code = code.replace('<BOT_TOKEN>', s['BOT_TOKEN']).replace('<SERVICE_ROLE_KEY>', s['SERVICE_ROLE_KEY']).replace('<ADMIN_SECRET>', s.get('ADMIN_SECRET', '')).replace('<DASH_TOKEN>', s.get('DASH_TOKEN', '')).replace('<PANEL_TOKEN>', s.get('PANEL_TOKEN', ''))

    def req(method, path, data=None):
        body = json.dumps(data).encode() if data is not None else None
        r = urllib.request.Request(BASE + '/api/v1' + path, data=body, method=method,
                                   headers={'X-N8N-API-KEY': APIKEY, 'Content-Type': 'application/json', 'accept': 'application/json'})
        return json.load(urllib.request.urlopen(r, context=ctx))

    wf = req('GET', '/workflows/' + wid)
    found = False
    for n in wf['nodes']:
        if n['name'] == node:
            n['parameters']['jsCode'] = code; found = True
    if not found:
        print('NODE NOT FOUND:', node); sys.exit(1)
    payload = {'name': wf['name'], 'nodes': wf['nodes'], 'connections': wf['connections'], 'settings': wf.get('settings', {})}
    res = req('PUT', '/workflows/' + wid, payload)
    print('PUT ok ·', node, '· nodos:', len(res['nodes']), '· activo:', res.get('active'), '· chars:', len(code))

if __name__ == '__main__':
    main()
