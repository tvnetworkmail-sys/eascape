# Builds src/plugins/cooking/cooking.json for the Cooking plugin: the game messages that mean
# something was cooked and the ones that mean it was burnt, from Lost City's cooking tables
# (cooking_generic successmessage / burnmessage, and the script's defaults), for every
# revision given (274, then 377). "<...>" in a message (the item's name) becomes ".+".
# Usage: python3 tools/skilling/cooking.py <Content 274> [<Content 377> ...]
import glob, json, os, re, sys

cooked, burnt = set(), set()
for content in sys.argv[1:]:
    for f in glob.glob(os.path.join(content, 'scripts', '**', '*.dbrow'), recursive=True) + glob.glob(os.path.join(content, 'scripts', '**', '*.rs2'), recursive=True):
        if 'cook' not in f:
            continue
        for line in open(f, encoding='utf-8', errors='replace'):
            m = re.match(r'\s*data=(successmessage|burnmessage),(.+)$', line.rstrip())
            if m:
                v = m.group(2).strip().strip('"')
                if v and v not in ('0', 'null'):
                    (cooked if m.group(1) == 'successmessage' else burnt).add(v)
            m = re.search(r'\$(succesmessage|burnmessage) = "([^"]+)"', line)
            if m:
                (cooked if m.group(1) == 'succesmessage' else burnt).add(m.group(2))

def rx(t):
    parts = re.split(r'<[^>]*>', t)
    return '^' + '.+'.join(re.escape(p) for p in parts) + '$'

out = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'plugins', 'cooking', 'cooking.json')
json.dump({'cooked': sorted({rx(t) for t in cooked}), 'burnt': sorted({rx(t) for t in burnt})}, open(out, 'w'), indent=0)
print(len(cooked), 'cooked messages,', len(burnt), 'burnt')
