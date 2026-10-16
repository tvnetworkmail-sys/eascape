#!/usr/bin/env python3
# Merge Lost City's 274 script changes (base -> t274) into our 377 tree (eas), producing out/.
# Configs are merged block by block and key by key (377 wins where both changed a key);
# scripts (.rs2) and interfaces (.if) are merged file by file with git merge-file (274 wins conflicts).
import os, sys, shutil, subprocess, collections, re, json

R = sys.argv[1]  # dir holding base/ t274/ eas/
BASE, T, O, OUT = [os.path.join(R, d, 'scripts') for d in ('base', 't274', 'eas', 'out')]
PACK377 = sys.argv[2]  # dir with 377 pack files

BLOCK_TYPES = {'obj', 'npc', 'loc', 'seq', 'spotanim', 'idk', 'flo', 'inv', 'varp', 'varbit', 'varn', 'vars',
               'param', 'enum', 'struct', 'dbrow', 'dbtable', 'hunt', 'mesanim'}
CACHE_TYPES = {'obj', 'npc', 'loc', 'seq', 'spotanim', 'idk', 'flo', 'inv', 'varp', 'varbit'}
SKIP_KEYS = re.compile(r'^(model\d*|manwear\d*|womanwear\d*|manhead\d*|womanhead\d*|head\d*|models?|recol\d*[sd]|retex\d*[sd]|2d\w+|xan|yan|zan|zoom|ambient|contrast|resizex|resizey|resizez|resizeh|resizev|anim|frames?|iframes?|walkanim|readyanim|walk\w*anim|turn\w*|name|desc)$')
# name/desc: 377 text is the May 2006 text, keep it

report = collections.defaultdict(list)
FALLBACK = {}
_fb = os.path.join(R, 'fallback.txt')
if os.path.exists(_fb):
    for l in open(_fb):
        if l.strip():
            k, v = l.rstrip('\n').rsplit('\t', 1)
            FALLBACK[k] = int(v)
# keys the client never sees: the only ones we may change on cache types (377 client data must stay exact)
SERVER_KEYS = {
    'obj': {'category', 'dummyitem', 'tradeable', 'wearpos', 'wearpos2', 'wearpos3', 'weight', 'param', 'respawnrate'},
    'npc': {'attack', 'attackrange', 'blockwalk', 'category', 'defaultmode', 'defence', 'givechase', 'hitpoints', 'huntmode', 'huntrange', 'magic', 'moverestrict', 'ranged', 'respawnrate', 'strength', 'timer', 'wanderrange', 'maxrange', 'param', 'regenrate'},
    'loc': {'category', 'param'},
    'inv': {'allstock', 'protect', 'restock', 'runweight', 'scope', 'stackall'},
    'varp': {'protect', 'scope', 'type', 'transmit'},
    'seq': set(), 'spotanim': set(), 'idk': set(), 'flo': set(), 'varbit': set(),
}

def files(root):
    out = []
    for d, _, fs in os.walk(root):
        for f in fs:
            out.append(os.path.relpath(os.path.join(d, f), root))
    return out

def ext(p):
    return p.rsplit('.', 1)[-1] if '.' in p else ''

def parse_blocks(path):
    """returns list of (name, [lines]) preserving order; lines exclude the [name] header"""
    blocks = []
    cur = None
    with open(path, encoding='utf-8', errors='surrogateescape') as fh:
        for raw in fh:
            line = raw.rstrip('\n')
            m = re.match(r'^\[([^\]]+)\]\s*$', line)
            if m:
                cur = (m.group(1), [])
                blocks.append(cur)
            elif cur is not None:
                cur[1].append(line)
    return blocks

def index_blocks(root, typ):
    idx = {}
    for p in files(root):
        if ext(p) != typ:
            continue
        for name, lines in parse_blocks(os.path.join(root, p)):
            idx[name] = (p, lines)
    return idx

def content(lines):
    return [l.strip() for l in lines if l.strip() and not l.strip().startswith('//')]

def ident(line, counts):
    k = line.split('=', 1)[0]
    if counts.get(k, 0) > 1 or k in ('param', 'val', 'data', 'row', 'column', 'stock', 'op', 'iop'):
        v = line.split('=', 1)[1] if '=' in line else ''
        return k + '=' + v.split(',', 1)[0]
    return k

def merge_block(b, t, o, typ=''):
    """b, t, o: content lines. returns new o-lines list (content) or None if unchanged"""
    if b == t:
        return None
    counts = collections.Counter()
    for ls in (b, t, o):
        c = collections.Counter(l.split('=', 1)[0] for l in ls)
        for k, n in c.items():
            counts[k] = max(counts[k], n)
    bi = {ident(l, counts): l for l in b}
    ti = {ident(l, counts): l for l in t}
    oi = {ident(l, counts): l for l in o}
    res = list(o)
    changed = False
    for key in list(ti.keys()) + [k for k in bi if k not in ti]:
        k0 = key.split('=', 1)[0]
        if SKIP_KEYS.match(k0):
            continue
        if typ in SERVER_KEYS and not (k0 in SERVER_KEYS[typ] or re.sub(r'\d+$', '', k0) in SERVER_KEYS[typ]):
            continue
        bv, tv, ov = bi.get(key), ti.get(key), oi.get(key)
        if bv == tv:
            continue
        if ov != bv:
            continue  # 377 changed it too (or 377 lacks/has it differently): 377 wins
        # 377 still has the base value: take 274's
        if typ == 'dbtable':
            if tv is None:
                continue  # never drop a column 377-only rows may use
            if bv is None:
                tv = tv.replace(',REQUIRED', '')
        if tv is None:
            res.remove(ov)
        elif ov is None:
            res.append(tr_cfg_line(tv))
        else:
            res[res.index(ov)] = tr_cfg_line(tv)
        changed = True
    return res if changed else None

def write_blocks_into(path, updates):
    """rewrite blocks in file at path: updates {name: new content lines} (comments in block are dropped only for changed blocks)"""
    with open(path, encoding='utf-8', errors='surrogateescape') as fh:
        lines = fh.read().split('\n')
    out = []
    i = 0
    while i < len(lines):
        m = re.match(r'^\[([^\]]+)\]\s*$', lines[i])
        if m and m.group(1) in updates:
            out.append(lines[i])
            i += 1
            while i < len(lines) and not re.match(r'^\[([^\]]+)\]\s*$', lines[i]):
                i += 1
            # keep a trailing blank line before next block
            out.extend(updates[m.group(1)])
            out.append('')
            continue
        out.append(lines[i])
        i += 1
    with open(path, 'w', encoding='utf-8', errors='surrogateescape') as fh:
        fh.write('\n'.join(out))

def pack_names(typ):
    p = os.path.join(PACK377, typ + '.pack')
    names = set()
    if os.path.exists(p):
        for l in open(p):
            if '=' in l:
                names.add(l.strip().split('=', 1)[1])
    return names

# ---- names 274 renamed: translate to the 377 name for the same id, where 377 doesn't know the 274 name
MM = os.path.join(R, '..', 'mm')
def rdpack(p):
    d = {}
    if os.path.exists(p):
        for l in open(p):
            if '=' in l:
                k, v = l.strip().split('=', 1)
                d[v] = k
    return d
trans, varptrans = {}, {}
modeltrans = {}
for t in ('obj', 'npc', 'loc', 'seq', 'spotanim', 'synth', 'varp', 'varbit', 'idk', 'model'):
    a, b = rdpack(os.path.join(MM, t + '.274')), rdpack(os.path.join(MM, t + '.377'))
    bid = {v: k for k, v in b.items()}
    for name, i in a.items():
        if name not in b and i in bid:
            tgt = varptrans if t == 'varp' else modeltrans if t == 'model' else trans
            if name in tgt and tgt[name] != bid[i]:
                tgt[name] = None
            else:
                tgt[name] = bid[i]
trans = {k: v for k, v in trans.items() if v}
varptrans = {k: v for k, v in varptrans.items() if v}
modeltrans = {k: v for k, v in modeltrans.items() if v}
tok = re.compile(r'(?<![\w$^@~.\-])(%?)([A-Za-z_][A-Za-z0-9_]*)\b')
IFMAP = json.load(open(os.path.join(R, 'ifmap.json')))
IFROOT = {k: v for k, v in IFMAP.items() if ':' not in k}
IFCLASH = set(json.load(open(os.path.join(R, 'ifclash.json'))))
IFCOM = {k: v for k, v in IFMAP.items() if ':' in k}
for k, v in IFROOT.items():
    if k not in IFCLASH:
        trans.setdefault(k, v)
ifcall = re.compile(r'\b(if_\w+|\.if_\w+)\(\s*(' + '|'.join(map(re.escape, IFCLASH)) + r')\b') if IFCLASH else None
coltok = re.compile(r'(?<![\w$^@~.\-])([A-Za-z_]\w*):(\w+)')
def tr_coms(text):
    def rep(m):
        k = m.group(1) + ':' + m.group(2)
        if k in IFCOM:
            return IFCOM[k]
        if m.group(1) in IFROOT:
            return IFROOT[m.group(1)] + ':' + m.group(2)
        return m.group(0)
    return coltok.sub(rep, text)
def tr_coms_if(text):
    text = tr_coms(text)
    return ifcall.sub(lambda m: m.group(1) + '(' + m.group(2) + '_274', text) if ifcall else text
def tr_part(text):
    text = tr_coms(text)
    if ifcall:
        text = ifcall.sub(lambda m: m.group(1) + '(' + m.group(2) + '_274', text)
    def rep(m):
        pre, w = m.group(1), m.group(2)
        if pre == '%':
            return '%' + varptrans[w] if w in varptrans else m.group(0)
        return trans.get(w, w) if not pre else m.group(0)
    return tok.sub(rep, text)
def tr_cfg_line(line):
    if '=' not in line or re.match(r'^(name|desc|text|op\d*|iop\d*|title)=', line):
        return line
    k, v = line.split('=', 1)
    return k + '=' + tr_part(v)

# ---- start from our tree
if os.path.exists(OUT):
    shutil.rmtree(OUT)
shutil.copytree(O, OUT)

new_blocks = collections.defaultdict(list)  # typ -> [(srcfile, name, lines)]
catpairs = collections.defaultdict(set)

for typ in sorted(BLOCK_TYPES):
    bidx, tidx, oidx = index_blocks(BASE, typ), index_blocks(T, typ), index_blocks(OUT, typ)
    packn = pack_names(typ) if typ in CACHE_TYPES else None
    per_file = collections.defaultdict(dict)
    olow = {k.lower(): k for k in oidx}
    if typ in ('obj', 'npc', 'loc'):
        def cat(lines):
            return next((l.split('=', 1)[1].strip() for l in content(lines) if l.startswith('category=')), None)
        allo = {cat(l) for _, l in oidx.values()}
        for name, (tp, tl) in tidx.items():
            if name in oidx:
                a, b = cat(tl), cat(oidx[name][1])
                if a and b and a != b and a not in allo:
                    catpairs[a].add(b)
    for name, (tp, tl) in tidx.items():
        t = content(tl)
        if name not in oidx and name.lower() in olow:
            report['config_case_differs_kept_377'].append(f'{typ}:{name}')
            trans[name] = olow[name.lower()]
            continue
        if name in oidx:
            op, ol = oidx[name]
            o = content(ol)
            if name in bidx:
                r = merge_block(content(bidx[name][1]), t, o, typ)
            else:
                r = merge_block([], t, o, typ)  # both added: 377 wins, 274 fills keys 377 lacks
            if r is not None:
                per_file[op][name] = r
                report['config_merged'].append(f'{typ}:{name}')
        elif name in bidx:
            # 377 removed or renamed it; 274 kept it
            if content(bidx[name][1]) != t:
                report['config_changed_but_gone_in_377'].append(f'{typ}:{name} ({tp})')
        else:
            # new in 274
            if packn is not None:
                report['new_274_cache_config_skipped'].append(f'{typ}:{name} ({tp})')
            else:
                new_blocks[typ].append((tp, name, tl))
    for op, ups in per_file.items():
        write_blocks_into(os.path.join(OUT, op), ups)
        report['_cfg_files'].append(op)

os.makedirs(os.path.join(OUT, '_merge274', 'configs'), exist_ok=True)
for a, bs in catpairs.items():
    if len(bs) == 1:
        trans[a] = next(iter(bs))
        report['category_renamed'].append(f'{a} -> {trans[a]}')

# dbrows only fit if their table (as it ends up) has every column they use
tables = {}
for name, (p_, lines) in index_blocks(OUT, 'dbtable').items():
    tables[name] = {l.split('=', 1)[1].split(',', 1)[0] for l in content(lines) if l.startswith('column=')}
def row_fits(lines):
    c = content(lines)
    tb = next((l.split('=', 1)[1] for l in c if l.startswith('table=')), None)
    if tb not in tables:
        return False
    return all(l.split('=', 1)[1].split(',', 1)[0] in tables[tb] for l in c if l.startswith('data='))
keep = []
for tp, name, tl in new_blocks.get('dbrow', []):
    if row_fits(tl):
        keep.append((tp, name, tl))
    else:
        report['new_dbrow_dropped_377_table_differs'].append(name)
new_blocks['dbrow'] = keep
for typ, bl in new_blocks.items():
    with open(os.path.join(OUT, '_merge274', 'configs', 'from274.' + typ), 'w', encoding='utf-8', errors='surrogateescape') as fh:
        for tp, name, tl in bl:
            fh.write(f'// from 274: {tp}\n[{name}]\n' + '\n'.join(tr_cfg_line(l) for l in tl).rstrip('\n') + '\n\n')
            report['config_added'].append(f'{typ}:{name}')

# ---- constants: line based "^name = value"
def consts(root):
    d = {}
    for p in files(root):
        if ext(p) == 'constant':
            for l in open(os.path.join(root, p), encoding='utf-8', errors='surrogateescape'):
                m = re.match(r'^\^(\w+)\s*=\s*(.*?)\s*$', l)
                if m:
                    d[m.group(1)] = (p, m.group(2))
    return d
cb, ct, co = consts(BASE), consts(T), consts(OUT)
newc = []
for n, (tp, tv) in ct.items():
    if n in co:
        op, ov = co[n]
        bv = cb.get(n, (None, None))[1]
        if tv != bv and ov == bv:
            path = os.path.join(OUT, op)
            s = open(path, encoding='utf-8', errors='surrogateescape').read()
            s = re.sub(r'(?m)^\^' + n + r'\s*=.*$', f'^{n} = {tv}', s)
            open(path, 'w', encoding='utf-8', errors='surrogateescape').write(s)
            report['constant_merged'].append(n)
    elif n not in cb:
        newc.append(f'^{n} = {tv}')
if newc:
    open(os.path.join(OUT, '_merge274', 'configs', 'from274.constant'), 'w').write('\n'.join(newc) + '\n')
    report['constant_added'] += [c.split(' ')[0] for c in newc]

# ---- scripts and interfaces: file merges
ofiles_by_base = collections.defaultdict(list)
for p in files(OUT):
    ofiles_by_base[os.path.basename(p)].append(p)

for p in files(T):
    e = ext(p)
    if e in BLOCK_TYPES or e == 'constant':
        continue
    tpath, bpath = os.path.join(T, p), os.path.join(BASE, p)
    if e == 'if' and os.path.basename(p)[:-3] in IFCLASH:
        n_ = os.path.basename(p)[:-3]
        dst = os.path.join(OUT, '_merge274', 'interfaces', n_ + '_274.if')
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy(tpath, dst)
        report['file_added'].append(os.path.relpath(dst, OUT))
        report['if_clash_renamed'].append(f'{p} -> {n_}_274')
        continue
    target = p if os.path.exists(os.path.join(OUT, p)) else None
    if target is None and len(ofiles_by_base.get(os.path.basename(p), [])) == 1 and os.path.exists(bpath):
        target = ofiles_by_base[os.path.basename(p)][0]  # 377 moved it
    has_base = os.path.exists(bpath)
    if has_base and open(bpath, 'rb').read() == open(tpath, 'rb').read():
        continue  # 274 didn't touch it
    if target is None:
        if has_base:
            report['file_changed_but_gone_in_377'].append(p)
        else:
            dst = os.path.join(OUT, p)
            if e == 'if' and os.path.basename(p)[:-3] in IFROOT:
                report['if_renamed_in_274_use_377'].append(p)
                continue
            if e == 'if' and os.path.basename(p) in ofiles_by_base:
                report['if_new_but_name_exists'].append(p)
                continue
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy(tpath, dst)
            report['file_added'].append(p)
        continue
    opath = os.path.join(OUT, target)
    if not has_base:
        # both added: keep 377's
        if open(opath, 'rb').read() != open(tpath, 'rb').read():
            report['file_both_added_kept_377'].append(target)
        continue
    if e == 'if':
        report['if_changed_in_274_kept_377'].append(target)
        continue
    level = FALLBACK.get(target, 0)
    if level >= 2:
        report['file_kept_377'].append(target)
        continue
    orig = open(opath, 'rb').read()
    r = subprocess.run(['git', 'merge-file', '--ours' if level == 1 else '--theirs', '-q', opath, bpath, tpath])
    res = open(opath, 'rb').read()
    if res.count(b'/*') != res.count(b'*/'):
        open(opath, 'wb').write(orig)
        report['file_kept_377'].append(target + ' (merge broke a comment)')
        continue
    report['file_merged'].append(target)

touched = set(report['file_merged']) | set(report['file_added']) | {p for p in files(OUT) if p.startswith('_merge274')}

tok = re.compile(r'(?<![\w$^@~.\-])(%?)([A-Za-z_][A-Za-z0-9_]*)\b')
nt = 0
for p in touched:
    fp = os.path.join(OUT, p)
    if not os.path.exists(fp):
        continue
    s0 = open(fp, encoding='utf-8', errors='surrogateescape').read()
    def rep(m):
        global nt
        pre, w = m.group(1), m.group(2)
        if pre == '%':
            if w in varptrans:
                nt += 1
                return '%' + varptrans[w]
            return m.group(0)
        if w in trans:
            nt += 1
            return trans[w]
        if w.startswith('_') and w[1:] in trans:
            nt += 1
            return '_' + trans[w[1:]]
        return m.group(0)
    outl = []
    for line in s0.split('\n'):
        st = line.lstrip()
        mm_ = re.match(r'^(\s*\w*model\w*=)([\w+]+)(.*)$', line)
        if mm_ and p.endswith('.if'):
            outl.append(mm_.group(1) + modeltrans.get(mm_.group(2), mm_.group(2)) + mm_.group(3))
            continue
        if st.startswith('//') or re.match(r'^(name|desc|text|op\d*|iop\d*|title|value)=', st):
            outl.append(line)
            continue
        parts = line.split('"')
        for i in range(0, len(parts), 2):
            parts[i] = tok.sub(rep, tr_coms_if(parts[i].split('//')[0])) + ('//' + parts[i].split('//', 1)[1] if '//' in parts[i] else '')
        outl.append('"'.join(parts))
    s1 = '\n'.join(outl)
    if s1 != s0:
        open(fp, 'w', encoding='utf-8', errors='surrogateescape').write(s1)
report['renamed_refs'] = [str(nt)]
report.pop('_cfg_files', None)

json.dump(report, open(os.path.join(R, 'merge-report.json'), 'w'), indent=1)
for k, v in report.items():
    print(k, len(v))

# ---- scripts defined twice (274 added a file for something 377 already has elsewhere):
# keep 274's definition, take the duplicate out of the 377-only file
from274 = set(report['file_added']) | set(report['file_merged'])
def headers(lines):
    # yields (index, match or None) skipping headers inside /* */ comments
    inc = False
    for i, line in enumerate(lines):
        m = None if inc else hdr.match(line)
        yield i, m
        st = line.strip()
        if not inc and '/*' in st and '*/' not in st.split('/*', 1)[1]:
            inc = True
        elif inc and '*/' in st:
            inc = False
defs = collections.defaultdict(list)
hdr = re.compile(r'^\[(\w+),([^\]]+)\]')
for p in files(OUT):
    if not p.endswith('.rs2'):
        continue
    _ls = open(os.path.join(OUT, p), encoding='utf-8', errors='surrogateescape').read().split('\n')
    for i, m in headers(_ls):
        if m:
            defs[(m.group(1), m.group(2))].append(p)
drop = collections.defaultdict(set)
samefile = collections.defaultdict(set)
for d, ps in defs.items():
    if len(ps) > 1 and len(set(ps)) == 1:
        samefile[ps[0]].add(d)
        report['dup_removed'].append(f'[{d[0]},{d[1]}] second copy in {ps[0]}')
        continue
    if len(set(ps)) < 2:
        continue
    keep = [p for p in ps if p in report['file_added']] or [p for p in ps if p in from274] or ps[:1]
    for p in set(ps):
        if p != keep[0]:
            drop[p].add(d)
            report['dup_removed'].append(f'[{d[0]},{d[1]}] from {p} (kept {keep[0]})')
for p, ds in drop.items():
    fp = os.path.join(OUT, p)
    lines = open(fp, encoding='utf-8', errors='surrogateescape').read().split('\n')
    out, skipping = [], False
    for i, m in headers(lines):
        line = lines[i]
        if m:
            skipping = (m.group(1), m.group(2)) in ds
        if not skipping:
            out.append(line)
    open(fp, 'w', encoding='utf-8', errors='surrogateescape').write('\n'.join(out))
for p, ds in samefile.items():
    fp = os.path.join(OUT, p)
    lines = open(fp, encoding='utf-8', errors='surrogateescape').read().split('\n')
    out, skipping, seen = [], False, set()
    for i, m in headers(lines):
        line = lines[i]
        if m:
            k = (m.group(1), m.group(2))
            skipping = k in ds and k in seen
            seen.add(k)
        if not skipping:
            out.append(line)
    open(fp, 'w', encoding='utf-8', errors='surrogateescape').write('\n'.join(out))
# copy in procs/labels 274 code needs that ended up missing (their file kept 377's version)
_np = os.path.join(R, 'needed.txt')
if os.path.exists(_np):
    need = {l.strip() for l in open(_np) if l.strip()}
    have = set()
    for p in files(OUT):
        if p.endswith('.rs2'):
            _ls = open(os.path.join(OUT, p), encoding='utf-8', errors='surrogateescape').read().split('\n')
            for i, m in headers(_ls):
                if m:
                    have.add(m.group(1) + ',' + m.group(2))
    outtxt = []
    for p in files(T):
        if not p.endswith('.rs2'):
            continue
        _ls = open(os.path.join(T, p), encoding='utf-8', errors='surrogateescape').read().split('\n')
        cur = None
        for i, m in headers(_ls):
            if m:
                k = m.group(1) + ',' + m.group(2)
                cur = k if (k in need and k not in have) else None
                if cur:
                    have.add(k)
                    outtxt.append(f'// from 274: {p}')
                    report['proc_copied_from_274'].append(k)
            if cur:
                outtxt.append(tr_part(_ls[i]) if not _ls[i].lstrip().startswith('//') else _ls[i])
    if outtxt:
        os.makedirs(os.path.join(OUT, '_merge274', 'scripts'), exist_ok=True)
        open(os.path.join(OUT, '_merge274', 'scripts', 'from274.rs2'), 'w', encoding='utf-8', errors='surrogateescape').write('\n'.join(outtxt) + '\n')
json.dump(report, open(os.path.join(R, 'merge-report.json'), 'w'), indent=1)
print('dup_removed', len(report['dup_removed']))
