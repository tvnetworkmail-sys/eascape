# bump the fallback level of merged files that fail to compile
import re,json,os,sys
S='/tmp/claude-0/-home-claude/75994f91-c279-5580-8356-99c172c3a22d/scratchpad'
rep=json.load(open(S+'/mt/merge-report.json'))
merged=set(rep.get('file_merged',[]))
fb={}
p=S+'/mt/fallback.txt'
if os.path.exists(p):
    for l in open(p):
        if l.strip(): k,v=l.rstrip('\n').rsplit('\t',1); fb[k]=int(v)
bad=set()
for l in open(S+'/build.log'):
    m=re.match(r'/home/claude/eascape/content/scripts/(.+?\.rs2):\d+:\d+: ERROR',l)
    if m: bad.add(m.group(1))
# procs/labels 377 defines in a file whose merge dropped them
import subprocess
miss=set()
for l in open(S+'/build.log'):
    m=re.search(r"ERROR: '([~@])(\w+)' cannot be resolved to a (proc|label)",l)
    if m: miss.add(('proc' if m.group(1)=='~' else 'label', m.group(2)))
for kind,name in miss:
    r=subprocess.run(['grep','-rl','--include=*.rs2',f'^\\[{kind},{name}\\]',S+'/mt/eas/scripts'],capture_output=True,text=True).stdout.split()
    for f in r:
        rel=os.path.relpath(f,S+'/mt/eas/scripts')
        if rel in merged: bad.add(rel)
n=0
for f in bad:
    if f in merged and fb.get(f,0)<2:
        fb[f]=fb.get(f,0)+1; n+=1
open(p,'w').write(''.join(f'{k}\t{v}\n' for k,v in fb.items()))
print('bad',len(bad),'bumped',n,'not merged', sorted(bad-merged)[:60])

# procs/labels 274 code needs that only 274 defines: remember them so the merge copies them in
need=set()
np=S+'/mt/needed.txt'
if os.path.exists(np): need=set(l.strip() for l in open(np) if l.strip())
for kind,name in miss:
    r=subprocess.run(['grep','-rl','--include=*.rs2',f'^\\[{kind},{name}\\]',S+'/mt/eas/scripts'],capture_output=True,text=True).stdout.split()
    if not r: need.add(f'{kind},{name}')
open(np,'w').write('\n'.join(sorted(need))+'\n')
print('needed',len(need))
