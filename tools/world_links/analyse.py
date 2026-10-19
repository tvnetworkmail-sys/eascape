import re,os,json,collections,math,sys
C=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','content')
ids={}
for l in open(C+'/pack/loc.pack'):
    l=l.strip()
    if '=' in l: i,n=l.split('=',1); ids[int(i)]=n
locs={}
for dp,_,fs in os.walk(C+'/scripts'):
    for f in fs:
        if not f.endswith('.loc'): continue
        cur=None
        for line in open(os.path.join(dp,f),encoding='utf-8',errors='replace'):
            line=line.strip()
            m=re.match(r'^\[(.+)\]$',line)
            if m: cur=locs.setdefault(m.group(1),{'ops':{},'cat':None,'name':None}); continue
            if cur is None: continue
            m=re.match(r'^op(\d)=(.*)$',line)
            if m: cur['ops'][int(m.group(1))]=m.group(2)
            elif line.startswith('category='): cur['cat']=line[9:]
            elif line.startswith('name='): cur['name']=line[5:]
trig=set()
for dp,_,fs in os.walk(C+'/scripts'):
    for f in fs:
        if f.endswith('.rs2') and f!='eascape_world.rs2':
            for m in re.finditer(r'^\[(?:op|ap)loc(\d),([^\]]+)\]',open(os.path.join(dp,f),encoding='utf-8',errors='replace').read(),re.M):
                trig.add((int(m.group(1)),m.group(2)))
def handled(n,o):
    d=locs[n]
    return (o,n) in trig or (d['cat'] and (o,'_'+d['cat']) in trig)
# placements
place=collections.defaultdict(list)   # name -> [(level,x,z,shape,angle)]
bypos=collections.defaultdict(list)   # (level, x//8, z//8) -> [(name,level,x,z)]
for fn in os.listdir(C+'/maps'):
    m=re.match(r'm(\d+)_(\d+)\.jm2',fn)
    if not m: continue
    mx,mz=int(m.group(1)),int(m.group(2))
    sec=None
    for line in open(C+'/maps/'+fn):
        if line.startswith('===='): sec=line.strip('= \n'); continue
        if sec!='LOC': continue
        if ':' not in line: continue
        head,rest=line.split(':')
        lv,lx,lz=map(int,head.split()); p=rest.split()
        n=ids.get(int(p[0]))
        if n is None or n not in locs: continue
        x,z=mx*64+lx,mz*64+lz
        place[n].append((lv,x,z,int(p[1]) if len(p)>1 else 10,int(p[2]) if len(p)>2 else 0))
        bypos[(lv,x//8,z//8)].append((n,lv,x,z))
UP=('Climb-up','Walk-up','Go-up','Climb up')
DOWN=('Climb-down','Walk-down','Go-down','Climb down')
AMB=('Climb','Enter','Exit','Squeeze-through','Crawl-through','Go-through','Leave','Walk-into','Jump-in','Descend','Ascend')
def kind(t):
    if t in UP: return 'up'
    if t in DOWN: return 'down'
    if t in AMB: return 'amb'
    return None
def near(lv,x,z,r):
    out=[]
    for bx in range((x-r)//8,(x+r)//8+1):
        for bz in range((z-r)//8,(z+r)//8+1):
            for e in bypos.get((lv,bx,bz),[]):
                if abs(e[2]-x)<=r and abs(e[3]-z)<=r: out.append(e)
    return out
def opkinds(n): return {kind(t) for t in locs[n]['ops'].values()}
WALL={0,9}
doorish=('Open','Go-through','Walk-through','Pass','Pass-through','Push','Enter')
doors=set(); links=[]; unres=collections.Counter(); skipped=collections.Counter()
for n,d in locs.items():
    for o,t in d['ops'].items():
        if not place.get(n): continue
        h=handled(n,o)
        shapes={p[3] for p in place[n]}
        nm=(d['name'] or '').lower()
        if t in doorish and shapes<=WALL and 'trapdoor' not in nm:
            if not h: doors.add((o,n))
            continue
        k=kind(t)
        if t=='Open' and 'trapdoor' in nm: k='down'
        if k is None:
            skipped[t]+=1; continue
        for (lv,x,z,sh,an) in place[n]:
            cands=[]
            under = z>=6400
            def tryset(tl,tx,tz,r,want):
                best=None
                for e in near(tl,tx,tz,r):
                    if e[0]==n and e[1]==lv and e[2]==x and e[3]==z: continue
                    ks=opkinds(e[0])
                    if want in ks or 'amb' in ks:
                        dd=math.hypot(e[2]-tx,e[3]-tz)
                        if best is None or dd<best[0]: best=(dd,e)
                return best
            order=[]
            if k=='up':
                if under and lv==0: order.append((0,x,z-6400,16,'down'))
                if lv<3: order.append((lv+1,x,z,6,'down'))
            elif k=='down':
                if lv>0: order.append((lv-1,x,z,6,'up'))
                if not under and lv==0: order.append((0,x,z+6400,16,'up'))
            else:
                if under: order.append((0,x,z-6400,24,'down'))
                else: order.append((0,x,z+6400,24,'up'))
                if lv<3: order.append((lv+1,x,z,6,'down'))
                if lv>0: order.append((lv-1,x,z,6,'up'))
            found=None
            for (tl,tx,tz,r,want) in order:
                b=tryset(tl,tx,tz,r,want)
                if b: found=b[1]; break
            if found:
                same = found[2]==x and found[3]==z
                updir = 1 if (found[1]>lv or (found[3]<z-3000)) else 0
                links.append(dict(name=n,op=o,frm=(lv,x,z),to=(found[1],found[2],found[3]),same=same,up=updir,h=bool(h)))
            elif 'ladder' in nm and k in ('up','down') and ((k=='up' and lv<3) or (k=='down' and lv>0)):
                tl=lv+1 if k=='up' else lv-1
                links.append(dict(name=n,op=o,frm=(lv,x,z),to=(tl,x,z),same=True,up=1 if k=='up' else 0,h=bool(h)))
            elif not h:
                unres[(n,t)]+=1
print('door locs/ops',len(doors)); print('links',len(links)); print('unresolved',sum(unres.values()),len(unres))
print(unres.most_common(40)); print('skipped',skipped.most_common(20))
json.dump({'doors':sorted(doors),'links':links,'unres':[[a,b,c] for (a,b),c in unres.items()]},open(os.path.dirname(__file__)+'/out.json','w'))
