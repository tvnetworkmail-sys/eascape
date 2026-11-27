"""RuneLite Config interface -> a clone descriptor's `config` block (sections and items), 1:1.

    python3 config.py <path to XConfig.java> [group]

prints `sections: [...]` and `items: [...]` for app/src/plugins/<id>/descriptor.js. Keys, names, descriptions,
positions, sections, defaults, @Range, @Alpha, hidden / secret come from the Java; enum options from the enum's own
file in the same folder (its toString when the constants carry a display string). Keybinds become the descriptor's
'keybind' / 'hotkey' text ("Ctrl+F"); Color defaults '#AARRGGBB' when @Alpha, else '#RRGGBB'.
"""
import os
import re
import sys

COLORS = {'RED': 0xFF0000, 'GREEN': 0x00FF00, 'BLUE': 0x0000FF, 'WHITE': 0xFFFFFF, 'BLACK': 0x000000, 'YELLOW': 0xFFFF00,
          'CYAN': 0x00FFFF, 'MAGENTA': 0xFF00FF, 'ORANGE': 0xFFC800, 'PINK': 0xFFAFAF, 'GRAY': 0x808080,
          'LIGHT_GRAY': 0xC0C0C0, 'DARK_GRAY': 0x404040}


def strip_comments(s):
    s = re.sub(r'/\*.*?\*/', '', s, flags=re.S)
    return re.sub(r'//[^\n]*', '', s)


def ann_args(text):
    """key = value pairs of an annotation's argument list (strings joined, constants left as text)"""
    out = {}
    for m in re.finditer(r'(\w+)\s*=\s*((?:"(?:[^"\\]|\\.)*"\s*\+?\s*)+|[^,)]+)', text):
        v = m.group(2).strip()
        if v.startswith('"'):
            v = ''.join(re.findall(r'"((?:[^"\\]|\\.)*)"', v)).replace('\\"', '"').replace('\\n', '\n')
        out[m.group(1)] = v
    return out


def balanced(s, i):
    """s[i] == '(' -> the index after its matching ')'"""
    depth = 0
    in_str = False
    while i < len(s):
        c = s[i]
        if in_str:
            if c == '\\':
                i += 1
            elif c == '"':
                in_str = False
        elif c == '"':
            in_str = True
        elif c == '(':
            depth += 1
        elif c == ')':
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    return i


def enum_options(folder, name, src_text):
    path = None
    for root, _, files in os.walk(folder):
        if name + '.java' in files:
            path = os.path.join(root, name + '.java')
    text = None
    if path:
        text = strip_comments(open(path).read())
        body = text[text.index('enum ' + name):]
    else:
        m = re.search(r'enum\s+' + name + r'\b', src_text)
        if not m:
            return None
        body = src_text[m.start():]
    body = body[body.index('{') + 1:]
    consts = re.split(r'[;}]', body)[0]
    has_tostring = 'toString' in body
    out = []
    for m in re.finditer(r'\b([A-Z][A-Z0-9_]*)\s*(\(((?:[^()]|\([^()]*\))*)\))?\s*(?=,|$)', consts.strip()):
        label = m.group(1)
        if has_tostring and m.group(3):
            s = re.findall(r'"((?:[^"\\]|\\.)*)"', m.group(3))
            if s:
                label = s[0]
        out.append((m.group(1), label))
    return out


def js(v):
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n') + "'"


def keybind_text(expr):
    if 'NOT_SET' in expr:
        return ''
    m = re.search(r'KeyEvent\.VK_(\w+)\s*,\s*(.*)\)', expr)
    if not m:
        return ''
    key = m.group(1)
    names = {'ESCAPE': 'Escape', 'SPACE': 'Space', 'ENTER': 'Enter', 'BACK_SPACE': 'Backspace', 'TAB': 'Tab', 'UP': 'ArrowUp',
             'DOWN': 'ArrowDown', 'LEFT': 'ArrowLeft', 'RIGHT': 'ArrowRight', 'SHIFT': 'Shift', 'CONTROL': 'Ctrl', 'ALT': 'Alt',
             'MINUS': '-', 'EQUALS': '=', 'OPEN_BRACKET': '[', 'CLOSE_BRACKET': ']'}
    key = names.get(key, key)
    mods = []
    for mod, txt in (('CTRL', 'Ctrl'), ('ALT', 'Alt'), ('SHIFT', 'Shift'), ('META', 'Meta')):
        if mod + '_DOWN_MASK' in m.group(2):
            mods.append(txt)
    if key in ('Ctrl', 'Alt', 'Shift'):
        return key
    return '+'.join(mods + [key])


def color_text(expr, alpha):
    expr = expr.strip()
    m = re.match(r'Color\.(\w+)', expr)
    if m:
        rgb, a = COLORS[m.group(1).upper()], 255
    else:
        m = re.match(r'new Color\((.*)\)$', expr, re.S)
        args = [x.strip() for x in m.group(1).split(',')]
        nums = [int(x, 0) if not x.endswith('f') else round(float(x[:-1]) * 255) for x in args[:4] if re.match(r'^[0-9xXa-fA-F.]+f?$', x)]
        if len(args) >= 3:
            rgb = (nums[0] << 16) | (nums[1] << 8) | nums[2]
            a = nums[3] if len(nums) > 3 else 255
        else:
            v = nums[0]
            has_alpha = len(args) > 1 and args[1] == 'true'
            rgb, a = v & 0xFFFFFF, ((v >> 24) & 0xFF) if has_alpha else 255
    return ('#%02X%06X' % (a, rgb)) if alpha else ('#%06X' % rgb)


def parse(path, group=None):
    raw = open(path).read()
    src = strip_comments(raw)
    folder = os.path.dirname(path)
    consts = {m.group(1): m.group(2) for m in re.finditer(r'String\s+(\w+)\s*=\s*"([^"]*)"', src)}
    if group is None:
        m = re.search(r'@ConfigGroup\(\s*("([^"]*)"|([\w.]+))', src)
        group = m.group(2) or consts.get(m.group(3).split('.')[-1], m.group(3))
    sections = []
    for m in re.finditer(r'@ConfigSection\s*\(', src):
        end = balanced(src, m.end() - 1)
        args = ann_args(src[m.end():end - 1])
        field = re.match(r'\s*String\s+(\w+)\s*=\s*"([^"]*)"', src[end:])
        sections.append({'key': field.group(2), 'field': field.group(1), 'name': args.get('name', ''), 'description': args.get('description', ''),
                         'position': int(args.get('position', '0')), 'closed': args.get('closedByDefault') == 'true'})
    secmap = {s['field']: s['key'] for s in sections}
    items = []
    for m in re.finditer(r'@ConfigItem\s*\(', src):
        end = balanced(src, m.end() - 1)
        args = ann_args(src[m.end():end - 1])
        # annotations between the ConfigItem and the method
        rest = src[end:]
        decl = re.search(r'default\s+([\w<>.]+)\s+(\w+)\s*\(\s*\)\s*\{(.*?)\}', rest, re.S)
        setter = re.match(r'(?:\s*@\w+(?:\([^)]*\))?)*\s*void\s+(\w+)\s*\(', rest)
        if setter and (not decl or rest.index(setter.group(0)) < rest.index(decl.group(0))):
            continue  # a setter (void key(String)) shares the key of its getter
        if not decl:
            continue
        prev = max(src.rfind('}', 0, m.start()), src.rfind(';', 0, m.start()), src.rfind('{', 0, m.start()))
        between = src[prev + 1:m.start()] + rest[:decl.start()]
        rtype, method, body = decl.group(1), decl.group(2), decl.group(3)
        ret = re.search(r'return\s+(.*?);', body, re.S)
        dexpr = ret.group(1).strip() if ret else ''
        key = args.get('keyName', method)
        key = consts.get(key, key)
        it = {'key': key}
        if method != key:
            it['method'] = method
        it['name'] = args.get('name', '')
        it['description'] = args.get('description', '')
        alpha = '@Alpha' in between
        rng = re.search(r'@Range\(([^)]*)\)', between)
        units = re.search(r'@Units\(\s*Units\.(\w+)', between)
        if rtype == 'boolean':
            it['type'] = 'boolean'
            it['default'] = dexpr == 'true'
        elif rtype in ('int', 'long'):
            it['type'] = 'int'
            try:
                it['default'] = int(eval(dexpr.replace('L', '')))
            except Exception:
                it['default'] = dexpr
        elif rtype in ('double', 'float'):
            it['type'] = 'double'
            it['default'] = float(dexpr.rstrip('fFdD'))
        elif rtype == 'String':
            it['type'] = 'string'
            s = re.findall(r'"((?:[^"\\]|\\.)*)"', dexpr)
            it['default'] = ''.join(s).replace('\\n', '\n') if s else consts.get(dexpr, '')
        elif rtype == 'Color':
            it['type'] = 'color'
            if alpha:
                it['alpha'] = True
            it['default'] = color_text(dexpr, alpha) if dexpr and dexpr != 'null' else ''
        elif rtype in ('Keybind', 'ModifierlessKeybind'):
            it['type'] = 'keybind' if rtype == 'Keybind' else 'hotkey'
            it['default'] = keybind_text(dexpr)
        elif rtype == 'Notification':
            it['type'] = 'notification'
            it['default'] = 'ON' in dexpr and 'OFF' not in dexpr
        elif rtype.startswith('Set<'):
            en = rtype[4:-1]
            it['type'] = 'enumset'
            it['options'] = enum_options(folder, en, src) or []
            it['default'] = ','.join(re.findall(en + r'\.(\w+)', dexpr))
        else:
            en = rtype.split('.')[-1]
            opts = enum_options(folder, en, src)
            it['type'] = 'enum'
            it['options'] = opts or []
            dm = re.search(r'(\w+)$', dexpr)
            it['default'] = dm.group(1) if dm else ''
            if opts is None:
                it['enum'] = en
        if rng:
            ra = ann_args(rng.group(1))
            if 'min' in ra:
                it['min'] = int(ra['min'].replace('Integer.MIN_VALUE', '-2147483648'), 0) if re.match(r'^-?\d+$', ra['min']) else ra['min']
            if 'max' in ra:
                it['max'] = int(ra['max'], 0) if re.match(r'^-?\d+$', ra['max']) else ra['max']
        if units:
            it['units'] = units.group(1)
        if 'section' in args:
            it['section'] = secmap.get(args['section'], args['section'])
        if args.get('hidden') == 'true':
            it['hidden'] = True
        if args.get('secret') == 'true':
            it['secret'] = True
        it['position'] = int(args['position']) if 'position' in args and re.match(r'^-?\d+$', args['position']) else -1
        items.append(it)
    return group, sections, items


def render(group, sections, items, indent='      '):
    out = [f"  config: {{\n    group: {js(group)},\n    sections: ["]
    for s in sections:
        extra = ', closedByDefault: true' if s['closed'] else ''
        out.append(f"{indent}{{ key: {js(s['key'])}, name: {js(s['name'])}, description: {js(s['description'])}, position: {s['position']}{extra} }},")
    out.append('    ],\n    items: [')
    for it in items:
        parts = []
        for k, v in it.items():
            if k == 'options':
                v = '[' + ', '.join(f"{{ value: {js(a)}, label: {js(b)} }}" for a, b in v) + ']'
                parts.append(f'options: {v}')
            else:
                parts.append(f'{k}: {js(v)}')
        out.append(f"{indent}{{ {', '.join(parts)} }},")
    out.append('    ],\n  },')
    return '\n'.join(out)


if __name__ == '__main__':
    g, s, i = parse(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
    print(render(g, s, i))
