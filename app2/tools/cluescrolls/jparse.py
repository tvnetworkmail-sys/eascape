"""Parse RuneLite's clue data lists (Java builder / constructor literals) into Python trees."""
import re, os, json

S = os.environ.get('RL_SRC', 'runelite-src')  # a RuneLite checkout
GV = S + '/runelite-api/src/main/java/net/runelite/api/gameval/'
CL = S + '/runelite-client/src/main/java/net/runelite/client/plugins/cluescrolls/clues/'


def consts(*files):
    d = {}
    for f in files:
        for m in re.finditer(r'public static final int (\w+) = (-?\d+);', open(GV + f).read()):
            d.setdefault(m.group(1), int(m.group(2)))
    return d


ITEM = consts('ItemID.java')
OBJ = consts('ObjectID.java', 'ObjectID1.java') if os.path.exists(GV + 'ObjectID1.java') else consts('ObjectID.java')
NPC = consts('NpcID.java')

TOK = re.compile(r'\s+|//[^\n]*|/\*.*?\*/|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|\d+(?:\.\d+)?[fFdDlL]?|->|::|[A-Za-z_]\w*|.', re.S)


def tokens(s):
    out = []
    for m in TOK.finditer(s):
        t = m.group(0)
        if t.isspace() or t.startswith('//') or t.startswith('/*'):
            continue
        out.append(t)
    return out


class P:
    def __init__(self, toks):
        self.t = toks
        self.i = 0

    def peek(self, k=0):
        return self.t[self.i + k] if self.i + k < len(self.t) else None

    def next(self):
        v = self.t[self.i]
        self.i += 1
        return v

    def expect(self, v):
        n = self.next()
        assert n == v, (n, v, self.t[self.i - 5:self.i + 5])

    def args(self):
        self.expect('(')
        out = []
        while self.peek() != ')':
            out.append(self.expr())
            if self.peek() == ',':
                self.next()
        self.expect(')')
        return out

    def expr(self):
        # lambda: ident -> ...  or (a, b) -> ...
        if re.match(r'[A-Za-z_]\w*$', self.peek() or '') and self.peek(1) == '->':
            start = self.i
            self.next(); self.next()
            self.skip_lambda_body()
            return ('lambda', ' '.join(self.t[start:self.i]))
        e = self.unary()
        # binary ops (string concat etc.)
        while self.peek() in ('+', '-', '*', '/', '?', ':', '==', '!=', '&&', '||'):
            op = self.next()
            r = self.unary()
            e = ('bin', op, e, r)
        return e

    def skip_lambda_body(self):
        depth = 0
        while True:
            t = self.peek()
            if t in ('(', '{', '['):
                depth += 1
            elif t in (')', '}', ']'):
                if depth == 0:
                    return
                depth -= 1
            elif t == ',' and depth == 0:
                return
            self.next()

    def unary(self):
        t = self.peek()
        if t == '-':
            self.next()
            v = self.unary()
            return ('num', -v[1]) if v[0] == 'num' else ('neg', v)
        if t == '(':
            self.next()
            e = self.expr()
            self.expect(')')
            return self.postfix(e)
        if t.startswith('"'):
            self.next()
            s = json.loads(t)
            return self.postfix(('str', s))
        if re.match(r'\d', t):
            self.next()
            return ('num', float(t.rstrip('fFdDlL')) if '.' in t else int(t.rstrip('lL')))
        if t == 'new':
            self.next()
            name = self.next()
            while self.peek() == '.':
                self.next(); name += '.' + self.next()
            if self.peek() == '[':  # new X[]{...}
                self.next(); self.expect(']')
                self.expect('{')
                items = []
                while self.peek() != '}':
                    items.append(self.expr())
                    if self.peek() == ',':
                        self.next()
                self.expect('}')
                return ('array', items)
            return self.postfix(('new', name, self.args()))
        if t in ('true', 'false', 'null'):
            self.next()
            return ('lit', t)
        name = self.next()
        return self.postfix(('name', name))

    def postfix(self, e):
        while True:
            if self.peek() == '.':
                self.next()
                n = self.next()
                if self.peek() == '(':
                    e = ('call', e, n, self.args())
                else:
                    e = ('field', e, n)
            elif self.peek() == '::':
                self.next()
                e = ('ref', e, self.next())
            elif self.peek() == '(' and e[0] == 'name':
                e = ('fn', e[1], self.args())
            else:
                return e


def list_of(path, start_pat):
    src = open(path).read()
    i = src.index(start_pat) + len(start_pat) - 1
    toks = tokens(src[i:])
    p = P(toks)
    return p.args(), src


def strconsts(src):
    d = {}
    for m in re.finditer(r'static final String (\w+) = ("(?:\\.|[^"\\])*");', src):
        d[m.group(1)] = json.loads(m.group(2))
    return d
