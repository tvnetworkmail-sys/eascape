"""Shared readers for the Void importers: Void's npcs (clones resolved), drop tables, combat
definitions and animations, and our own npc configs and packs."""
import os, re, glob, collections

HERE = os.path.dirname(os.path.abspath(__file__))
CONTENT = os.path.normpath(os.path.join(HERE, '..', '..', 'content'))

def toml_sections(path):
    """[name] -> {key: raw value} for Void's simple toml files (one level, inline tables kept raw).
    Repeated section names are kept as separate entries (Void repeats some)."""
    out = []
    cur = None
    buf = None
    for line in open(path, encoding='utf-8'):
        s = line.split('#', 1)[0].rstrip() if '"' not in line.split('#', 1)[0] or line.count('"') % 2 == 0 else line.rstrip()
        if buf is not None:
            buf[1] += '\n' + s
            if buf[1].count('[') <= buf[1].count(']') and buf[1].count('{') <= buf[1].count('}'):
                cur[1][buf[0]] = buf[1]
                buf = None
            continue
        m = re.match(r'^\[("?)([^"\]]+)\1\]\s*$', s.strip())
        if m:
            cur = [m.group(2), {}]
            out.append(cur)
            continue
        m = re.match(r'^\s*("?)([\w+.]+)\1\s*=\s*(.*)$', s)
        if m and cur is not None:
            k, v = m.group(2), m.group(3).strip()
            if v.count('[') > v.count(']') or v.count('{') > v.count('}'):
                buf = [k, v]
            else:
                cur[1][k] = v
    return out

def unq(v):
    v = v.strip()
    return v[1:-1] if v.startswith('"') and v.endswith('"') else v

def void_files(void, pattern):
    return glob.glob(os.path.join(void, 'data', '**', pattern), recursive=True)

def void_npcs(void):
    raw = {}
    for f in void_files(void, '*.npcs.toml'):
        for name, d in toml_sections(f):
            raw.setdefault(name, {}).update(d)
    def resolve(name, depth=0):
        d = dict(raw.get(name, {}))
        if 'clone' in d and depth < 6:
            base = resolve(unq(d['clone']), depth + 1)
            for k, v in base.items():
                if k not in ('id',):
                    d.setdefault(k, v)
        return d
    out = {}
    for name in raw:
        d = resolve(name)
        if 'id' in d:
            d['_name'] = name
            out.setdefault(int(d['id']), d)
    return out

def void_section_map(void, pattern):
    out = {}
    for f in void_files(void, pattern):
        for name, d in toml_sections(f):
            out.setdefault(name, d)
    return out

def pack(name):
    ids = {}
    for l in open(os.path.join(CONTENT, 'pack', name + '.pack')):
        if '=' in l:
            i, n = l.strip().split('=', 1)
            ids[n] = int(i)
    return ids

def our_blocks(ext):
    """name -> {'file', 'fields': [(key, value)]} across content/scripts (first definition wins
    for 'file'; fields from every definition)."""
    out = {}
    for dp, _, fs in os.walk(os.path.join(CONTENT, 'scripts')):
        for f in fs:
            if not f.endswith(ext):
                continue
            p = os.path.join(dp, f)
            cur = None
            for line in open(p, encoding='utf-8', errors='replace'):
                s = line.strip()
                m = re.match(r'^\[(.+)\]$', s)
                if m:
                    cur = out.setdefault(m.group(1), {'file': p, 'fields': []})
                elif cur is not None and '=' in s and not s.startswith('//'):
                    k, v = s.split('=', 1)
                    cur['fields'].append((k, v))
    return out

def has_field(block, key, prefix=None):
    for k, v in block['fields']:
        if k == key and (prefix is None or v.startswith(prefix)):
            return True
    return False

def append_lines(path, name, lines):
    s = open(path, encoding='utf-8', errors='replace').read()
    m = re.search(r'^\[' + re.escape(name) + r'\]\n(.*?)(?=^\[|\Z)', s, re.S | re.M)
    body = m.group(1)
    tail = '\n' if m.end(1) < len(s) else ''
    new = body.rstrip('\n') + '\n' + '\n'.join(lines) + '\n' + tail
    s = s[:m.start(1)] + new + s[m.end(1):]
    open(path, 'w', encoding='utf-8').write(s)
