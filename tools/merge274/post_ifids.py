import sys,os,re
S=sys.argv[1]
pk='pack/interface.pack'
lines=[l for l in open(pk).read().split('\n') if l]
names={l.split('=',1)[1] for l in lines}
mx=max(int(l.split('=')[0]) for l in lines)
roots=[]
t274=[l for l in open(S+'/mm/interface.274').read().split('\n') if '=' in l]
for d,_,fs in os.walk('scripts'):
    for f in sorted(fs):
        if f.endswith('.if'):
            n=f[:-3]
            if n in names: continue
            coms=[l.split('=',1)[1] for l in t274 if l.split('=',1)[1].startswith(n+':')]
            have=set(coms)
            coms+= [n+':'+m for m in re.findall(r'(?m)^\[(\w+)\]',open(os.path.join(d,f)).read()) if n+':'+m not in have]
            for nm in [n]+coms:
                mx+=1; lines.append(f'{mx}={nm}'); roots.append(mx)
open(pk,'w').write('\n'.join(lines)+'\n')
o=open('pack/interface.order').read().rstrip('\n')
open('pack/interface.order','w').write(o+'\n'+''.join(f'{r}\n' for r in roots))
