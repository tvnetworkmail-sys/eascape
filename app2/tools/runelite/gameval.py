"""Resolve RuneLite gameval constants (ObjectID.X, ItemID.X, NpcID.X, ...) to ids and check them against the
2007 cache, for era-trimming RuneLite's plugin data.

    python3 gameval.py <RuneLite source root> <Java file> [start-line end-line]

prints each reference as `Kind.NAME osrs-id -> 2007 debug name, display name` (`-` when the id is past the
2007 cache). The clones' data generators in this folder import it.
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
RL = os.environ.get('RUNELITE_SRC', '')
PACKS = {'ObjectID': 'loc', 'ItemID': 'obj', 'NpcID': 'npc', 'AnimationID': 'seq', 'VarbitID': 'varbit', 'SpotanimID': 'spotanim'}
EXT = {'ObjectID': 'loc', 'ItemID': 'obj', 'NpcID': 'npc'}
_cache = {}


def gameval(kind, rl_root=None):
    key = ('gv', kind)
    if key not in _cache:
        path = os.path.join(rl_root or RL, 'runelite-api/src/main/java/net/runelite/api/gameval', kind + '.java')
        # top-level constants only (ItemID's nested Cert / Placeholder classes reuse the names)
        _cache[key] = {m.group(1): int(m.group(2)) for m in re.finditer(r'^\tpublic static final int (\w+) = (-?\d+);', open(path).read(), re.M)}
    return _cache[key]


def pack(kind):
    """id -> 2007 debug name"""
    key = ('pk', kind)
    if key not in _cache:
        out = {}
        for line in open(os.path.join(REPO, 'content/pack', PACKS[kind] + '.pack')):
            k, _, v = line.strip().partition('=')
            if k.isdigit():
                out[int(k)] = v
        _cache[key] = out
    return _cache[key]


def display_names(kind):
    """2007 debug name -> display name (from the content configs)"""
    key = ('dn', kind)
    if key in _cache:
        return _cache[key]
    out = {}
    ext = EXT.get(kind)
    if ext:
        for root, _, files in os.walk(os.path.join(REPO, 'content/scripts')):
            for f in files:
                if not f.endswith('.' + ext):
                    continue
                cur = None
                for line in open(os.path.join(root, f), errors='replace'):
                    line = line.strip()
                    if line.startswith('[') and line.endswith(']'):
                        cur = line[1:-1]
                    elif cur and line.startswith('name='):
                        out.setdefault(cur, line[5:])
    _cache[key] = out
    return out


def name2007(kind, i):
    """(debug name, display name) of id i in the 2007 cache, or None past its end"""
    d = pack(kind).get(i)
    return (d, display_names(kind).get(d, '')) if d else None


def resolve(kind, name):
    """the 2007 id of a gameval constant, or None when it's later content: the id whose 2007 debug name is the gameval name
    (Jagex's; NPCs were renumbered after 2007, so their names are what matches), else for items (whose ids are the same
    in both but our debug names differ) the OSRS id while it's within the 2007 cache"""
    pk = pack(kind)
    osrs = gameval(kind).get(name)
    low = name.lower()
    if low[:1] == '_' and low[1:2].isdigit():
        low = low[1:]  # (a Java name can't start with a digit)
    if osrs is not None and pk.get(osrs) == low:
        return osrs
    key = ('rev', kind)
    if key not in _cache:
        _cache[key] = {}
        for i, n in pk.items():
            _cache[key].setdefault(n, i)
    if low in _cache[key]:
        return _cache[key][low]
    if kind == 'ItemID' and osrs is not None and osrs in pk:
        return osrs
    return None


def split_top(s):
    """split a Java argument list on its top-level commas"""
    out, depth, cur, quoted = [], 0, '', False
    for ch in s:
        if ch == '"' and not cur.endswith('\\'):
            quoted = not quoted
        if quoted:
            cur += ch
            continue
        if ch in '({':
            depth += 1
        elif ch in ')}':
            depth -= 1
        if ch == ',' and depth == 0:
            out.append(cur.strip())
            cur = ''
        else:
            cur += ch
    if cur.strip():
        out.append(cur.strip())
    return out


def enum_entries(src, enum_name):
    """[(NAME, [args], body or None)] of a Java enum's constants (comments stripped)"""
    i = src.index('enum ' + enum_name)
    body = src[src.index('{', i) + 1:]
    body = re.sub(r'//[^\n]*', '', body)
    body = re.sub(r'/\*.*?\*/', '', body, flags=re.S)
    out, pos = [], 0
    pat = re.compile(r'\s*([A-Z][A-Z0-9_]*)\s*(\(|,|;|\{)')
    while True:
        m = pat.match(body, pos)
        if not m:
            break
        name, args, j = m.group(1), [], m.end()
        if m.group(2) == '(':
            depth = 1
            while depth:
                depth += {'(': 1, ')': -1}.get(body[j], 0)
                j += 1
            args = split_top(body[m.end():j - 1])
        else:
            j -= 1
        k = j
        while k < len(body) and body[k] in ' \t\n':
            k += 1
        extra = None
        if k < len(body) and body[k] == '{':
            depth, e = 1, k + 1
            while depth:
                depth += {'{': 1, '}': -1}.get(body[e], 0)
                e += 1
            extra = body[k:e]
            k = e
            while k < len(body) and body[k] in ' \t\n':
                k += 1
        out.append((name, args, extra))
        if k >= len(body) or body[k] == ';':
            break
        pos = k + 1
    return out


def refs(text, kind):
    return list(dict.fromkeys(re.findall(r'\b' + kind + r'\.(\w+)', text)))


if __name__ == '__main__':
    RL = sys.argv[1]
    lines = open(sys.argv[2]).read().split('\n')
    if len(sys.argv) > 4:
        lines = lines[int(sys.argv[3]) - 1:int(sys.argv[4])]
    text = '\n'.join(lines)
    for kind in PACKS:
        for n in refs(text, kind):
            i = gameval(kind, RL).get(n)
            nm = name2007(kind, i)
            print(f'{kind}.{n} {i} -> {nm[0] + " " + repr(nm[1]) if nm else "-"}')


def loc_params(param):
    """2007 loc debug name -> the value of its `param=<param>,...` line, from the server's loc configs
    (content/scripts/**/*.loc; the unpacked all.loc first, the hand-edited configs over it)"""
    root = os.path.join(REPO, 'content/scripts')
    files = []
    for d, _, fs in os.walk(root):
        files += [os.path.join(d, f) for f in fs if f.endswith('.loc')]
    files.sort(key=lambda p: ('_unpack' not in p, p))
    out = {}
    for p in files:
        cur = None
        for line in open(p, encoding='utf-8', errors='replace'):
            line = line.strip()
            if line.startswith('['):
                cur = line[1:-1]
            elif cur and line.startswith('param=' + param + ','):
                out[cur] = line.split(',', 1)[1]
    return out
