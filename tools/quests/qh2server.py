#!/usr/bin/env python3
# Quest Helper guides from RuneLite's Quest Helper (Zoinkwiz/quest-helper, BSD 2-Clause), for the
# server's Quest Helper (content/scripts/eascape_questhelper). Quest Helper picks the step from the
# quest's varp (or varbit) the way the game sets it; our 2006 quests use the same varps and the
# same values (Lost City kept Jagex's), so its stage table carries over. For each quest this
# writes, next to the quest:
#   configs/<key>_helper.dbrow   the guide row and a row per step (text, NPC, object, place,
#                                dialogue options, items), numbered in Quest Helper's panel order
#   scripts/<key>_helper.rs2     ~questhelper_<key>: the step for your stage, with Quest Helper's
#                                conditions (items you carry, where you stand, varbits, NPCs about)
# What it can't carry over (conditions on interface text, chat messages, dialogue seen...) counts
# as not met, so the guide shows the step before it; each guide lists those in its header.
# Usage: qh2server.py <quest key> <guide number> [<Quest Helper folder>]  (see QUESTS below)
import re, os, sys, json, glob

QH = '/home/claude/questhelper/src/main/java/com/questhelper'
RL = '/home/claude/rlgameval'
E = '/home/claude/eascape/content'

def rd(p): return open(p, encoding='utf-8', errors='replace').read()

def gameval(name):
    out = {}
    for m in re.finditer(r'public static final int (\w+)\s*=\s*(-?\d+);', rd(f'{RL}/{name}.java')):
        out.setdefault(m.group(1), int(m.group(2)))
    return out
GV = {k: gameval(k) for k in ('ItemID', 'NpcID', 'ObjectID', 'VarbitID', 'VarPlayerID')}

def pack(t):
    d = {}
    for l in open(f'{E}/pack/{t}.pack'):
        if '=' in l:
            a, b = l.strip().split('=', 1); d[int(a)] = b
    return d
PK = {t: pack(t) for t in ('obj', 'npc', 'loc', 'varp', 'varbit')}
PKN = {t: set(v.values()) for t, v in PK.items()}
ORIG = {'obj': 7957, 'npc': 3852, 'loc': 14974}

def resolve(kind, name):
    """an ItemID/NpcID/ObjectID constant -> our config name (by name, else by the id, which
    hasn't changed since 2006 for items and objects)"""
    t = {'ItemID': 'obj', 'NpcID': 'npc', 'ObjectID': 'loc'}[kind]
    low = name.lower()
    if low in PKN[t]:
        return low
    i = GV[kind].get(name)
    if i is not None and t != 'npc' and i < ORIG[t] and i in PK[t]:
        return PK[t][i]
    return None

# item collections (Quest Helper's ItemCollections: "any axe" and the like)
COLL = {}
for m in re.finditer(r'^\s*(\w+)\((?:"[^"]*",\s*)?ImmutableList\.of\((.*?)\)\)', rd(f'{QH}/collections/ItemCollections.java'), re.M | re.S):
    COLL[m.group(1)] = re.findall(r'ItemID\.(\w+)', m.group(2))  # some have a name first, some don't

# ---------------------------------------------------------------- a little Java expression parser
TOK = re.compile(r'\s*(?:(//[^\n]*|/\*.*?\*/)|("(?:[^"\\]|\\.)*")|(\d+(?:\.\d+)?[fFL]?)|([A-Za-z_][\w]*)|(->|::|&&|\|\||==|!=|<=|>=|[(){}\[\],.;=!<>+\-*/:?&|]))', re.S)
def tokens(s):
    out, i = [], 0
    while i < len(s):
        m = TOK.match(s, i)
        if not m:
            i += 1; continue
        i = m.end()
        if m.group(1): continue
        if m.group(2): out.append(('str', json.loads(m.group(2)) if '\\u' not in m.group(2) else m.group(2)[1:-1]))
        elif m.group(3): out.append(('num', m.group(3)))
        elif m.group(4): out.append(('id', m.group(4)))
        else: out.append(('op', m.group(5)))
    return out

class P:
    def __init__(s, toks): s.t = toks; s.i = 0
    def peek(s, k=0): return s.t[s.i + k] if s.i + k < len(s.t) else ('eof', None)
    def eat(s, v=None):
        tk = s.peek()
        if v is not None and tk[1] != v: raise SyntaxError(f'want {v} got {tk}')
        s.i += 1; return tk
    def args(s):
        s.eat('('); out = []
        while s.peek()[1] != ')':
            out.append(s.expr())
            if s.peek()[1] == ',': s.eat(',')
        s.eat(')'); return out
    def expr(s):
        e = s.unary()
        while s.peek()[1] in ('&&', '||', '+', '-', '*', '==', '!=', '<', '>', '<=', '>=', '?', ':'):
            op = s.eat()[1]; e = ('bin', op, e, s.unary())
        return e
    def unary(s):
        if s.peek()[1] == '!': s.eat(); return ('not', s.unary())
        if s.peek()[1] == '-': s.eat(); return ('neg', s.unary())
        return s.postfix(s.primary())
    def primary(s):
        tk = s.peek()
        if tk[0] == 'str': s.eat(); return ('str', tk[1])
        if tk[0] == 'num': s.eat(); return ('num', int(float(tk[1].rstrip('fFL'))))
        if tk[1] == '(':
            s.eat('('); e = s.expr(); s.eat(')'); return e
        if tk[1] == 'new':
            s.eat(); name = s.eat()[1]
            if s.peek()[1] == '<':  # generics
                while s.eat()[1] != '>': pass
            if s.peek()[1] == '[':
                while s.peek()[1] != '{': s.eat()
                s.eat('{'); items = []
                while s.peek()[1] != '}':
                    items.append(s.expr())
                    if s.peek()[1] == ',': s.eat(',')
                s.eat('}'); return ('list', items)
            return ('new', name, s.args())
        if tk[0] == 'id':
            s.eat()
            if s.peek()[1] == '(':
                return ('call', None, tk[1], s.args())
            if tk[1] == 'this' and s.peek()[1] == '.' and s.peek(2)[1] != '(':
                s.eat('.'); return ('name', s.eat()[1])
            return ('name', tk[1])
        if tk[1] == '{':
            s.eat('{'); items = []
            while s.peek()[1] != '}':
                items.append(s.expr())
                if s.peek()[1] == ',': s.eat(',')
            s.eat('}'); return ('list', items)
        raise SyntaxError(f'unexpected {tk}')
    def postfix(s, e):
        while s.peek()[1] in ('.', '::'):
            s.eat(); name = s.eat()[1]
            if s.peek()[1] == '(':
                e = ('call', e, name, s.args())
            else:
                e = ('field', e, name)
        return e

def statements(body):
    """split Java into statements: at ';' and at braces outside brackets (a method header or an
    if/for line before '{' becomes its own fragment, dropped later)"""
    out, depth, cur, instr = [], 0, [], False
    i = 0
    while i < len(body):
        ch = body[i]
        if ch == '"' and (i == 0 or body[i - 1] != '\\'):
            instr = not instr
        if not instr:
            if ch in '([': depth += 1
            elif ch in ')]': depth -= 1
            elif depth == 0 and ch in ';{}':
                frag = ''.join(cur).strip()
                if frag: out.append((frag, ch))
                cur = []; i += 1; continue
        cur.append(ch); i += 1
    return out

# ---------------------------------------------------------------- reading one quest
def load(dirname):
    src = ''.join(rd(f) for f in sorted(glob.glob(f'{QH}/helpers/quests/{dirname}/*.java')))
    src = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
    src = re.sub(r'(?m)//[^\n]*$', '', src)
    out, fields, rename = [], set(), {}
    for frag, end in statements(src):
        if end != ';':
            continue  # a header (class, method, if, for, else) before a brace
        st = frag.strip()
        if re.match(r'^(package|import|return\b)', st):
            continue
        # a local (var x = ...) with a field's name, like "var giveLetter = new ConditionalStep(this,
        # this.giveLetter)": the local gets its own name from here on
        m = re.match(r'^(?:final\s+)?(?:var|ConditionalStep|QuestStep)\s+(\w+)\s*=', st)
        for a, b in rename.items():
            st = re.sub(r'(?<![.\w])' + a + r'\b', b, st)
        if m and m.group(1) in fields:
            new = m.group(1) + '__local'
            rename[m.group(1)] = new
            st = st.replace(m.group(1), new, 1)
            st = st.replace('this.' + new, 'this.' + m.group(1))
        mm = re.match(r'^(?:this\.)?(\w+)\s*=', st)
        if mm and not m:
            fields.add(mm.group(1))
        # declarations: drop the type in front of "name = ..."
        st = re.sub(r'^(?:@\w+\s*)*(?:(?:public|private|protected|static|final|var|int|boolean|String|[A-Z]\w*(?:<[^=]*?>)?(?:\[\])?)\s+)+(?=\w+\s*=)', '', st)
        out.append(st)
    return out

CHAIN = {'addStep', 'addDialogStep', 'addDialogSteps', 'addSubSteps', 'addAlternateNpcs', 'addIcon', 'addTeleport', 'addWidgetHighlight', 'addTileMarker', 'addTileMarkers', 'setLockingCondition', 'setAllowInCutscene', 'addSpellHighlight'}

WRAP = ('copy', 'puzzleWrapStep', 'puzzleWrapStepWithDefaultText')

def parse_all(stmts):
    assigns, calls, puts = {}, [], []
    for st in stmts:
        st = st.rstrip(';').strip()
        if not st: continue
        m = re.match(r'^(?:this\.)?(\w+)\s*=\s*(.*)$', st, re.S)
        try:
            if m and not re.match(r'return\b', st):
                v, e = m.group(1), P(tokens(m.group(2))).expr()
                # new ConditionalStep(...).addStep(a, b).addStep(c, d): the builder calls return
                # the step itself, so they're calls on v
                chain = []
                while e[0] == 'call' and e[1] is not None and e[2] in CHAIN:
                    chain.append(('call', ('name', v), e[2], e[3])); e = e[1]
                old = assigns.get(v)
                if old and old[0] == 'new' and old[1].endswith('Step') and not (e[0] == 'new' and e[1].endswith('Step')) and not (e[0] == 'call' and e[2] in ('copy', 'puzzleWrapStep', 'puzzleWrapStepWithDefaultText')):
                    continue  # a list or panel later reusing a step's name in another method
                assigns[v] = e
                calls.extend(reversed(chain))
                continue
            e = P(tokens(st)).expr()
        except Exception:
            continue
        if e[0] == 'call':
            if e[2] == 'put' and e[1] and e[1][0] == 'name':
                puts.append(e)
            else:
                calls.append(e)
    return assigns, calls, puts

# ---------------------------------------------------------------- the conversion
def coord(x, y, z):
    return f'{z}_{x >> 6}_{y >> 6}_{x & 63}_{y & 63}'

def helpers(dirname):
    """methods with one 'return new XStep(...)' body: name -> (params, expression text)"""
    src = ''.join(rd(f) for f in sorted(glob.glob(f'{QH}/helpers/quests/{dirname}/*.java')))
    out = {}
    for m in re.finditer(r'\b(?:private|public|protected)?\s*(?:\w+Step|QuestStep)\s+(\w+)\s*\(([^)]*)\)\s*\{\s*return\s+(new\s+\w+Step\s*\(.*?\));\s*\}', src, re.S):
        params = [p.strip().split()[-1] for p in m.group(2).split(',') if p.strip()]
        out[m.group(1)] = (params, m.group(3))
    return out

def block_helpers(dirname):
    """methods that build a step in several statements and return it:
    name -> (params, [statement texts], returned local)"""
    src = ''.join(rd(f) for f in sorted(glob.glob(f'{QH}/helpers/quests/{dirname}/*.java')))
    src = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
    src = re.sub(r'(?m)//[^\n]*$', '', src)
    out = {}
    for m in re.finditer(r'\b(?:private|public|protected)\s+(?:\w+Step|QuestStep)\s+(\w+)\s*\(([^)]*)\)\s*\{', src):
        i, depth = m.end(), 1
        while i < len(src) and depth:
            depth += {'{': 1, '}': -1}.get(src[i], 0); i += 1
        body = src[m.end():i - 1]
        frags = [f for f, end in statements(body) if end == ';']
        if len(frags) < 2: continue
        r = re.match(r'^return\s+(\w+)$', frags[-1].strip())
        if not r: continue
        params = []
        for prm in m.group(2).split(','):
            prm = prm.strip()
            if prm: params.append((prm.split()[-1], '...' in prm))
        sts = []
        for f in frags[:-1]:
            f = re.sub(r'^(?:final\s+)?(?:var|[A-Z]\w*(?:<[^=]*?>)?)\s+(?=\w+\s*=)', '', f.strip())
            sts.append(f)
        out[m.group(1)] = (params, sts, r.group(1))
    return out

class Quest:
    def __init__(s, key, num, dirname):
        s.key, s.guide, s.dir = key, num, dirname
        s.assigns, s.calls, s.puts = parse_all(load(dirname))
        s.warn = []
        s.helpers = helpers(dirname)
        # inline those helpers where a step is assigned from one
        for v, e in list(s.assigns.items()):
            if e[0] == 'call' and e[1] is None and e[2] in s.helpers:
                params, text = s.helpers[e[2]]
                try:
                    body = P(tokens(text)).expr()
                except Exception:
                    continue
                sub = dict(zip(params, e[3]))
                def rep(x):
                    if isinstance(x, tuple):
                        if x[0] == 'name' and x[1] in sub: return sub[x[1]]
                        return tuple(rep(y) for y in x)
                    if isinstance(x, list): return [rep(y) for y in x]
                    return x
                s.assigns[v] = rep(body)
        # and the helpers that take several statements (Jungle Potion's getReturnHerbStep): their
        # locals get the caller's name in front, and the one returned is the caller's step
        blocks = block_helpers(dirname)
        extra = []
        for v, e in list(s.assigns.items()):
            if not (e[0] == 'call' and e[1] is None and e[2] in blocks): continue
            params, sts, ret = blocks[e[2]]
            sub = {}
            for k, (pn, va) in enumerate(params):
                sub[pn] = ('list', list(e[3][k:])) if va else (e[3][k] if k < len(e[3]) else ('name', 'null'))
            a2, c2, _ = parse_all(sts)
            local = {n: (v if n == ret else f'{v}__{n}') for n in a2}
            def rep(x):
                if isinstance(x, tuple):
                    if len(x) == 2 and x[0] == 'name':
                        if x[1] in sub: return sub[x[1]]
                        if x[1] in local: return ('name', local[x[1]])
                    return tuple(rep(y) for y in x)
                if isinstance(x, list): return [rep(y) for y in x]
                return x
            for n, ex in a2.items():
                ex = rep(ex)
                if ex[0] == 'call' and ex[1] is None and ex[2] in s.helpers:
                    hp, ht = s.helpers[ex[2]]
                    try:
                        hb = P(tokens(ht)).expr()
                        hs = dict(zip(hp, ex[3]))
                        def rep2(x):
                            if isinstance(x, tuple):
                                if len(x) == 2 and x[0] == 'name' and x[1] in hs: return hs[x[1]]
                                return tuple(rep2(y) for y in x)
                            if isinstance(x, list): return [rep2(y) for y in x]
                            return x
                        ex = rep2(hb)
                    except Exception:
                        pass
                s.assigns[local[n]] = ex
            extra += [rep(c) for c in c2]
        s.calls = extra + s.calls
        # cond.addStep(req, new ObjectStep(...)): the step gets a name of its own
        for k, c in enumerate(s.calls):
            if c[0] == 'call' and c[2] == 'addStep' and len(c[3]) == 2 and c[1] and c[1][0] == 'name':
                st = c[3][1]
                if st[0] == 'new' and st[1].endswith('Step') and st[1] != 'ConditionalStep':
                    nm = f'{c[1][1]}__step{k}'
                    s.assigns[nm] = st
                    s.calls[k] = ('call', c[1], 'addStep', [c[3][0], ('name', nm)])
        s.procs = {}      # condition proc name -> body lines
        s.condcache = {}
        s.steps = {}      # step var -> dict
        s.subs = {}       # step var -> [sub step vars]
        s.cond = {}       # conditional var -> (default, [(cond, step)])
        for c in s.calls:
            obj, name, args = c[1], c[2], c[3]
            if obj is None or obj[0] != 'name': continue
            v = obj[1]
            if name == 'addSubSteps':
                s.subs.setdefault(v, []).extend(a[1] for a in args if a[0] == 'name')

    def val(s, e):
        """an expression's value: follow names to their assignment"""
        seen = 0
        while e and e[0] == 'name' and e[1] in s.assigns and seen < 20:
            e = s.assigns[e[1]]; seen += 1
        return e

    def wp(s, e):
        e = s.val(e)
        if e and e[0] == 'new' and e[1] == 'WorldPoint' and len(e[2]) == 3 and all(a[0] == 'num' for a in e[2]):
            return tuple(a[1] for a in e[2])
        return None

    def num(s, e):
        e = s.val(e)
        if e[0] == 'num': return e[1]
        if e[0] == 'neg' and e[1][0] == 'num': return -e[1][1]
        if e[0] == 'field' and e[1] == ('name', 'VarbitID'): return GV['VarbitID'].get(e[2])
        if e[0] == 'field' and e[1] == ('name', 'VarPlayerID'): return GV['VarPlayerID'].get(e[2])
        if e[0] == 'call' and e[2] == 'getId' and e[1] and e[1][0] == 'field':
            return None
        return None

    def ids(s, e, kind):
        """ItemID.X / list / collection -> our names"""
        e = s.val(e)
        if e[0] == 'field' and e[1] == ('name', kind):
            r = resolve(kind, e[2]); return [r] if r else []
        if e[0] == 'field' and e[1] == ('name', 'ItemCollections'):
            return [r for r in (resolve('ItemID', n) for n in COLL.get(e[2], [])) if r]
        if e[0] == 'call' and e[2] in ('of', 'asList') :
            out = []
            for a in e[3]: out += s.ids(a, kind)
            return out
        if e[0] == 'list':
            out = []
            for a in e[1]: out += s.ids(a, kind)
            return out
        if e[0] == 'name' and e[1] in COLL:
            return [r for r in (resolve('ItemID', n) for n in COLL[e[1]]) if r]
        return []

    # ---- requirements -> condition procs (each returns a boolean)
    def cond_proc(s, e, hint=''):
        key = repr(e)
        if key in s.condcache: return s.condcache[key]
        body = s.cond_body(e)
        if body is None:
            return None
        name = f'qh_{s.key}_c{len(s.procs) + 1}'
        s.procs[name] = body
        s.condcache[key] = name
        return name

    def cond_body(s, e):
        """lines of a proc body returning true/false, or None (can't say)"""
        orig = e
        e = s.val(e)
        if e is None: return None
        t = e[0]
        if t == 'call' and e[1] is not None and e[2] in ('alsoCheckBank', 'highlighted', 'isNotConsumed', 'showConditioned', 'hideConditioned', 'canBeObtainedDuringQuest', 'setTooltip', 'equipped', 'doNotAggregate', 'setUrlSuffix', 'setHighlightInInventory', 'quantity', 'named'):
            inner = s.cond_body(e[1])
            if e[2] == 'quantity' and inner and e[3] and s.num(e[3][0]) is not None:
                return [l.replace('>= 1)', f'>= {s.num(e[3][0])})') for l in inner]
            return inner
        if t == 'call' and e[1] is None and e[2] in ('and', 'or', 'nor', 'not'):
            subs = [s.cond_proc(a) for a in e[3]]
            return s.logic(e[2], subs)
        if t == 'new' and e[1] == 'Conditions':
            a = e[2]; logic = 'and'
            if a and s.val(a[0])[0] == 'field' and s.val(a[0])[1] == ('name', 'LogicType'):
                logic = s.val(a[0])[2].lower(); a = a[1:]
            if a and a[0][0] == 'name' and a[0][1] in ('true', 'false'):
                a = a[1:]
            subs = [s.cond_proc(x) for x in a if s.val(x)[0] not in ('str', 'num')]
            return s.logic(logic, subs)
        if t == 'new' and e[1] in ('ItemRequirement',):
            a = e[2]
            if a and a[0][0] == 'name' and a[0][1] in ('true', 'false'): a = a[1:]
            if len(a) < 2: return None
            objs = s.ids(a[1], 'ItemID')
            qty = s.num(a[2]) if len(a) > 2 and s.num(a[2]) is not None else 1
            if qty is not None and qty < 1: qty = 1
            if not objs:
                s.warn.append(f'item {a[1]} not in our game'); return None
            sums = ' + '.join(f'inv_total(inv, {o}) + inv_total(worn, {o})' for o in dict.fromkeys(objs[:12]))
            return [f'if (calc({sums}) >= {qty}) return(true);', 'return(false);']
        if t == 'new' and e[1] == 'ItemRequirements':
            a = e[2]; logic = 'and'
            if a and s.val(a[0])[0] == 'field' and s.val(a[0])[1] == ('name', 'LogicType'):
                logic = s.val(a[0])[2].lower(); a = a[1:]
            a = [x for x in a if s.val(x)[0] != 'str']
            return s.logic(logic, [s.cond_proc(x) for x in a])
        if t == 'new' and e[1] == 'ZoneRequirement':
            a = e[2]; neg = False
            if a and a[0][0] == 'str': a = a[1:]
            if a and a[0][0] == 'name' and a[0][1] in ('true', 'false'):
                neg = a[0][1] == 'true'; a = a[1:]
            zones = []
            for z in a:
                zz = s.zone(z)
                if zz is None: return None
                zones.append(zz)
            if not zones: return None
            tests = ' | '.join(f'inzone({a_}, {b_}, coord) = true' for a_, b_ in zones)
            return [f'if ({tests}) return({"false" if neg else "true"});', f'return({"true" if neg else "false"});']
        if t == 'new' and e[1] in ('VarbitRequirement', 'VarplayerRequirement'):
            a = [x for x in e[2] if s.val(x)[0] != 'str']
            vid = s.num(a[0]) if a else None
            t2 = 'varbit' if e[1] == 'VarbitRequirement' else 'varp'
            if vid is None or vid not in PK[t2]:
                s.warn.append(f'{e[1]} {a[0] if a else ""} not in our game'); return None
            var = PK[t2][vid]
            rest = a[1:]
            if len(rest) >= 2 and rest[0][0] == 'name' and rest[0][1] in ('true', 'false'):
                bit = s.num(rest[1])
                return [f'if (testbit(%{var}, {bit}) = {"^true" if rest[0][1] == "true" else "^false"}) return(true);', 'return(false);']
            op, value = '=', None
            for x in rest:
                xv = s.val(x)
                if xv[0] == 'field' and xv[1] == ('name', 'Operation'):
                    op = {'GREATER': '>', 'LESS': '<', 'LESS_EQUAL': '<=', 'EQUAL': '=', 'GREATER_EQUAL': '>=', 'NOT_EQUAL': '!'}[xv[2]]
                elif value is None and s.num(x) is not None:
                    value = s.num(x)
            if value is None: return None
            if len(rest) == 2 and all(s.num(x) is not None for x in rest) and e[1] == 'VarplayerRequirement':
                # (varp, value, bitShiftRight)
                return [f'if (calc(%{var} >> {s.num(rest[1])}) = {s.num(rest[0])}) return(true);', 'return(false);'] if False else [f'if (getbit_range(%{var}, {s.num(rest[1])}, 31) = {s.num(rest[0])}) return(true);', 'return(false);']
            return [f'if (%{var} {op} {value}) return(true);', 'return(false);']
        if t == 'new' and e[1] == 'SkillRequirement':
            a = e[2]
            sk = s.val(a[0])
            if sk[0] == 'field' and s.num(a[1]) is not None:
                return [f'if (stat_base({sk[2].lower()}) >= {s.num(a[1])}) return(true);', 'return(false);']
            return None
        if t == 'new' and e[1] == 'NpcCondition':
            npcs = s.ids(e[2][0], 'NpcID') if e[2] else []
            if not npcs: return None
            return [f'if (npc_find(coord, {npcs[0]}, 15, 0) = true) return(true);', 'return(false);']
        if t == 'new' and e[1] == 'ObjectCondition':
            locs = s.ids(e[2][0], 'ObjectID') if e[2] else []
            p = s.wp(e[2][1]) if len(e[2]) > 1 else None
            if not locs or not p: return None
            return [f'if (loc_find({coord(*p)}, {locs[0]}) = true) return(true);', 'return(false);']
        if t == 'new' and e[1] == 'FreeInventorySlotRequirement':
            n = s.num(e[2][-1]) if e[2] else 1
            return [f'if (inv_freespace(inv) >= {n or 1}) return(true);', 'return(false);']
        if t == 'name' and orig[0] == 'name':
            s.warn.append(f'condition {orig[1]} unknown'); return None
        what = e[1] if t == 'new' else e[2] if t == 'call' else t
        s.warn.append(f'{what} not carried over')
        return None

    def logic(s, kind, subs):
        known = [x for x in subs if x]
        if kind == 'and':
            if len(known) < len(subs): return None  # a part we can't check: can't say
            return [f'if (~{x} = false) return(false);' for x in known] + ['return(true);']
        if kind == 'or':
            if not known: return None
            return [f'if (~{x} = true) return(true);' for x in known] + ['return(false);']
        if kind in ('nor', 'not'):
            if len(known) < len(subs): return None
            return [f'if (~{x} = true) return(false);' for x in known] + ['return(true);']
        if kind == 'nand':
            if len(known) < len(subs): return None
            return [f'if (~{x} = false) return(true);' for x in known] + ['return(false);']
        return None

    def zone(s, z):
        z = s.val(z)
        if z[0] == 'new' and z[1] == 'Zone':
            pts = [s.wp(x) for x in z[2]]
            if len(pts) == 2 and all(pts):
                (x1, y1, p1), (x2, y2, p2) = pts
                return coord(min(x1, x2), min(y1, y2), min(p1, p2)), coord(max(x1, x2), max(y1, y2), max(p1, p2))
            if len(pts) == 1 and pts[0]:
                return coord(*pts[0]), coord(*pts[0])
            if len(z[2]) >= 1 and s.num(z[2][0]) is not None:
                r = s.num(z[2][0]); x, y = ((r >> 8) & 0xff) << 6, (r & 0xff) << 6
                pl = s.num(z[2][1]) if len(z[2]) > 1 else 0
                return coord(x, y, pl or 0), coord(x + 63, y + 63, pl or 0)
        if z[0] == 'new' and z[1] == 'WorldPoint':
            p = s.wp(z)
            return coord(*p), coord(*p)
        return None

    # ---- steps
    def step(s, var):
        if var in s.steps: return s.steps[var]
        e = s.val(('name', var))
        # x = other.copy() (Quest Helper's QuestStep.copy): the same step, maybe retitled after
        base = None
        while e and e[0] == 'call' and e[2] in ('copy', 'withNoHelpHiddenInSidebar', 'puzzleWrapStep', 'puzzleWrapStepWithDefaultText') and e[1] is not None:
            if e[2] in ('puzzleWrapStep', 'puzzleWrapStepWithDefaultText') and e[1][0] == 'name':
                base = e[1][1]; e = s.val(e[1]); continue
            if e[1][0] == 'name':
                base = e[1][1]
            e = s.val(e[1])
        if e and e[0] == 'new' and e[1] == 'PuzzleWrapperStep' and len(e[2]) > 1:
            inner = e[2][1]
            if inner[0] == 'name':
                e = s.val(inner)
            else:
                e = inner
        if not e or e[0] != 'new' or not e[1].endswith('Step') or e[1] == 'ConditionalStep':
            return None
        if base and base != var and base in s.assigns and s.step(base):
            st = dict(s.steps[base]); st['var'] = var
            st['options'] = list(st['options']); st['npc'] = list(st['npc'])
            s.steps[var] = st
            for c in s.calls:
                if c[1] == ('name', var) and c[2] == 'setText' and c[3] and c[3][0][0] == 'str':
                    st['text'] = c[3][0][1]
                if c[1] == ('name', var) and c[2] in ('addDialogStep', 'addDialogSteps'):
                    st['options'] += [x[1] for x in c[3] if x[0] == 'str']
            return st
        a = e[2]
        st = {'var': var, 'type': e[1], 'text': '', 'npc': [], 'loc': None, 'obj': [], 'at': None, 'options': [], 'items': []}
        rest = list(a[1:]) if a and a[0] == ('name', 'this') else list(a)
        for x in rest:
            xv = s.val(x)
            if xv[0] == 'field' and xv[1] == ('name', 'NpcID'):
                r = resolve('NpcID', xv[2]); st['npc'] += [r] if r else []
                if not r: s.warn.append(f'NPC {xv[2]} not matched')
            elif xv[0] == 'field' and xv[1] == ('name', 'ObjectID'):
                r = resolve('ObjectID', xv[2]); st['loc'] = st['loc'] or r
            elif xv[0] == 'field' and xv[1] == ('name', 'ItemID') and e[1] == 'ItemStep':
                r = resolve('ItemID', xv[2]); st['obj'] += [r] if r else []
            elif xv[0] == 'new' and xv[1] == 'WorldPoint' and not st['at']:
                st['at'] = s.wp(xv)
            elif xv[0] == 'str' and not st['text']:
                st['text'] = xv[1]
            elif x[0] == 'name' and xv and xv[0] == 'new' and xv[1] in ('ItemRequirement', 'ItemRequirements'):
                ia = [y for y in xv[2] if not (y[0] == 'name' and y[1] in ('true', 'false'))]
                if len(ia) >= 2:
                    objs = s.ids(ia[1], 'ItemID')
                    q = s.num(ia[2]) if len(ia) > 2 and s.num(ia[2]) is not None else 1
                    if objs: st['items'].append((objs[0], max(1, q)))
        for c in s.calls:
            obj, name, args = c[1], c[2], c[3]
            if obj != ('name', var): continue
            if name in ('addDialogStep', 'addDialogSteps', 'addDialogStepWithExclusion', 'addDialogStepWithExclusions'):
                for x in args[:1] if 'Exclusion' in name else args:
                    if x[0] == 'str': st['options'].append(x[1])
            elif name == 'addAlternateNpcs':
                for x in args:
                    xv = s.val(x)
                    if xv[0] == 'field' and xv[1] == ('name', 'NpcID'):
                        r = resolve('NpcID', xv[2])
                        if r and r not in st['npc']: st['npc'].append(r)
            elif name in ('setText',) and args and args[0][0] == 'str':
                st['text'] = args[0][1]
        st['text'] = st['text'] or var
        s.steps[var] = st
        return st

    def is_cond(s, var):
        e = s.val(('name', var))
        while e and e[0] == 'call' and e[2] in WRAP and e[1] is not None and e[1][0] == 'name':
            e = s.val(e[1])
        return e and e[0] == 'new' and e[1] in ('ConditionalStep', 'ConditionalStep')

    def cond_step(s, var):
        if var in s.cond: return s.cond[var]
        e = s.val(('name', var))
        if e and e[0] == 'call' and e[2] in WRAP and e[1] and e[1][0] == 'name':
            d, br = s.cond_step(e[1][1])
            own = [(c[3][0], c[3][1]) for c in s.calls if c[1] == ('name', var) and c[2] == 'addStep' and len(c[3]) == 2]
            s.cond[var] = (d, list(br) + own); return s.cond[var]
        default = e[2][1] if len(e[2]) > 1 else None
        branches = []
        for c in s.calls:
            if c[1] == ('name', var) and c[2] == 'addStep' and len(c[3]) == 2:
                branches.append((c[3][0], c[3][1]))
        s.cond[var] = (default, branches)
        return s.cond[var]

    def leaf_steps(s, e, acc):
        """every plain step a stage can lead to"""
        e0 = e
        if e[0] == 'name' and s.is_cond(e[1]):
            d, br = s.cond_step(e[1])
            for c, st in br: s.leaf_steps(st, acc)
            if d: s.leaf_steps(d, acc)
        elif e[0] == 'name' and s.step(e[1]):
            acc.append(e[1])
        elif e[0] == 'new' and e[1] == 'ConditionalStep':
            if len(e[2]) > 1: s.leaf_steps(e[2][1], acc)
        return acc

    def emit_choice(s, e, lines, ind, number):
        """lines that return the step number for a step expression"""
        if e[0] == 'name' and s.is_cond(e[1]):
            d, br = s.cond_step(e[1])
            for c, st in br:
                if c == ('name', 'null'):  # addStep(null, x): always
                    s.emit_choice(st, lines, ind, number); return
                cp = s.cond_proc(c)
                if cp is None: continue
                lines.append(f'{ind}if (~{cp} = true) {{')
                s.emit_choice(st, lines, ind + '    ', number)
                lines.append(f'{ind}}}')
            if d: s.emit_choice(d, lines, ind, number)
            else: lines.append(f'{ind}return(-1);')
            return
        if e[0] == 'name' and e[1] in number:
            lines.append(f'{ind}return({number[e[1]]});')
            return
        lines.append(f'{ind}return(-1); // {e}')

    def build(s, stagevar, journal, title):
        # the stage table
        stages = []
        for p in s.puts:
            if p[1] != ('name', 'steps'):
                continue  # other maps (bank items and the like)
            args = p[3]
            if len(args) == 2 and s.num(args[0]) is not None:
                stages.append((s.num(args[0]), args[1]))
        stages.sort(key=lambda x: x[0])
        # panel order: getPanels' PanelDetails
        panels = []
        for var, e in s.assigns.items():
            pass
        for c in s.calls + [('call', None, 'x', [])]:
            pass
        sections = []
        for st in re.finditer(r'new PanelDetails\(\s*"([^"]+)"\s*,\s*(?:List\.of|Arrays\.asList|Collections\.singletonList)?\(?([^;]*?)\)\s*(?:,|\)\s*;)', s.raw, re.S):
            names = re.findall(r'\b([a-z]\w*)\b', st.group(2))
            sections.append((st.group(1), [n for n in names if s.step(n) or s.is_cond(n)]))
        order, seen = [], set()
        def add(v, sec):
            if v in seen: return
            if s.is_cond(v):
                for l in s.leaf_steps(('name', v), []): add(l, sec)
                return
            if not s.step(v): return
            seen.add(v); order.append((v, sec))
            for sub in s.subs.get(v, []): add(sub, sec)
        for i, (_, names) in enumerate(sections):
            for n in names: add(n, i)
        for _, e in stages:
            for l in s.leaf_steps(e, []): add(l, max(0, len(sections) - 1))
        if not sections:
            sections = [('Steps', [])]
        number = {v: i + 1 for i, (v, _) in enumerate(order)}

        # the proc
        lines = [f'[proc,questhelper_{s.key}]()(int)', f'def_int $v = %{stagevar};']
        maxk = stages[-1][0] if stages else 0
        lines.append(f'if ($v > {maxk}) {{\n    return(0); // done\n}}')
        for k, e in reversed(stages):
            lines.append(f'if ($v >= {k}) {{')
            s.emit_choice(e, lines, '    ', number)
            lines.append('}')
        lines.append('return(1);')
        return order, number, sections, '\n'.join(lines)

def q(v):
    v = re.sub(r'\s*\n\s*', ' ', str(v)).replace('"', "'").strip()
    return f'"{v}"' if re.search(r'[,"]', v) else v

def method_exprs(raw, method):
    """the expressions a Quest Helper list method returns (return Arrays.asList(a, b) /
    List.of / singletonList, or reqs.add(a) ... return reqs)"""
    m = re.search(r'\b' + method + r'\s*\(\s*\)\s*\{', raw)
    if not m: return []
    i, depth = m.end(), 1
    while i < len(raw) and depth:
        depth += {'{': 1, '}': -1}.get(raw[i], 0); i += 1
    out = []
    for frag, end in statements(raw[m.end():i - 1]):
        if end != ';': continue
        st = frag.strip()
        try:
            if st.startswith('return'):
                e = P(tokens(st[6:].strip())).expr()
                if e[0] == 'new' and e[2] and e[2][0][0] == 'call': e = e[2][0]  # new ArrayList<>(Arrays.asList(...))
                if e[0] == 'call' and e[2] in ('asList', 'of', 'singletonList', 'toArrayList'): out += e[3]
            else:
                e = P(tokens(st)).expr()
                if e[0] == 'call' and e[2] == 'add' and e[3]: out.append(e[3][0])
                elif e[0] == 'call' and e[2] == 'addAll' and e[3] and e[3][0][0] == 'call': out += e[3][0][3]
        except Exception:
            pass
    return out

def req_items(qq, method):
    """[(our obj, count)] for the item requirements a list method gives"""
    got = []
    for e in method_exprs(qq.raw, method):
        qty = None
        while e[0] == 'call' and e[1] is not None:  # x.quantity(n).highlighted()...
            if e[2] == 'quantity' and e[3]: qty = qq.num(e[3][0])
            e = e[1]
        if e[0] != 'name': continue
        v = qq.val(e)
        while v and v[0] == 'call' and v[1] is not None:
            if v[2] == 'quantity' and v[3] and qty is None: qty = qq.num(v[3][0])
            v = qq.val(v[1])
        if v and v[0] == 'new' and v[1] == 'KeyringRequirement' and len(v[2]) >= 2 and v[2][1][0] == 'field':
            r = resolve('ItemID', v[2][1][2])  # KeyringCollection.DUSTY_KEY: the key itself
            if r: got.append((r, 1))
            continue
        if not v or v[0] != 'new' or v[1] != 'ItemRequirement': continue
        ia = [y for y in v[2] if not (y[0] == 'name' and y[1] in ('true', 'false'))]
        if len(ia) < 2: continue
        objs = qq.ids(ia[1], 'ItemID')
        if not objs: continue
        if qty is None: qty = qq.num(ia[2]) if len(ia) > 2 and qq.num(ia[2]) is not None else 1
        got.append((objs[0], max(1, qty)))
    seen, out = set(), []
    for o, c in got:
        if o not in seen: seen.add(o); out.append((o, c))
    return out

def req_skills(qq):
    out = []
    for e in method_exprs(qq.raw, 'getGeneralRequirements'):
        if e[0] == 'name': e = qq.val(e)
        if e and e[0] == 'new' and e[1] == 'SkillRequirement' and len(e[2]) >= 2 and e[2][0][0] == 'field':
            lvl = qq.num(e[2][1])
            if lvl: out.append(f'{lvl} {e[2][0][2].title()}')
    return out

def write(key, num, dirname, stagevar, journal, title, outdir, rewards=None):
    qq = Quest(key, num, dirname)
    qq.raw = re.sub(r'//[^\n]*', '', rd_all(dirname))
    order, number, sections, proc = qq.build(stagevar, journal, title)
    rows = [f"// Quest Helper guide for {title}: converted from RuneLite's Quest Helper ({dirname}, by Zoinkwiz",
            '// and contributors, BSD 2-Clause) by tools/quests/qh2server.py.',
            f'[questhelper_guide_{key}]', 'table=questhelper_guide', f'data=guide,^qh_{key}', f'data=key,{key}',
            f'data=name,{q(re.sub(r' I$', '', title))}', f'data=journal,{q(journal)}']  # no OSRS "I" in 2006 names
    for o, c in req_items(qq, 'getItemRequirements')[:20]: rows.append(f'data=required,{o},{c}')
    for o, c in req_items(qq, 'getItemRecommended')[:20]: rows.append(f'data=recommended,{o},{c}')
    for sk in req_skills(qq): rows.append(f'data=skill,{q(sk)}')
    for r in rewards or []: rows.append(f'data=reward,{q(r)}')
    for sname, _ in sections: rows.append(f'data=section,{q(sname)}')
    for v, sec in order:
        st = qq.steps[v]; n = number[v]
        rows += ['', f'[questhelper_step_{key}_{n}]', 'table=questhelper_step', f'data=id,{num * 1000 + n}', f'data=section,{sec}', f'data=text,{q(st["text"])}']
        for x in st['npc'][:6]: rows.append(f'data=npc,{x}')
        if st['loc']: rows.append(f'data=loc,{st["loc"]}')
        for x in st['obj'][:4]: rows.append(f'data=obj,{x}')
        if st['at']: rows.append(f'data=coord,{coord(*st["at"])}')
        for o in st['options'][:8]: rows.append(f'data=option,{q(o)}')
        for o, c in st['items'][:6]: rows.append(f'data=item,{o},{c}')
    warn = sorted(set(qq.warn))
    head = [f'// EASCape: Quest Helper for {title}, converted from RuneLite\'s Quest Helper ({dirname}, BSD 2-Clause)',
            '// by tools/quests/qh2server.py. Conditions it couldn\'t carry over count as not met:']
    head += [f'//   {w}' for w in warn[:30]] or ['//   (none)']
    body = '\n'.join(head) + '\n\n' + proc + '\n'
    for name, lines in qq.procs.items():
        body += f'\n[proc,{name}]()(boolean)\n' + '\n'.join(lines) + '\n'
    os.makedirs(os.path.join(outdir, 'configs'), exist_ok=True)
    os.makedirs(os.path.join(outdir, 'scripts'), exist_ok=True)
    open(os.path.join(outdir, 'configs', f'{key}_helper.dbrow'), 'w').write('\n'.join(rows) + '\n')
    open(os.path.join(outdir, 'scripts', f'{key}_helper.rs2'), 'w').write(body)
    return len(order), warn

def rd_all(dirname):
    return ''.join(rd(f) for f in sorted(glob.glob(f'{QH}/helpers/quests/{dirname}/*.java')))

if __name__ == '__main__':
    key, num, dirname, stagevar, journal, title, outdir = sys.argv[1:8]
    n, warn = write(key, int(num), dirname, stagevar, journal, title, outdir)
    print(key, n, 'steps;', len(warn), 'warnings')
    for w in warn: print('  ', w)
