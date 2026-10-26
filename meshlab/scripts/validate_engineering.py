import os
os.environ.setdefault('XDG_CACHE_HOME','/tmp/gear-cache')
import cadquery as cq,json,math
from pathlib import Path
root=Path(__file__).resolve().parents[1];dl=root/'dist/downloads'
data=json.loads((root/'dist/assets/model.json').read_text());p=data['parameters'];g=p['gears']
assert len(data['parts'])==len(set(x['id'] for x in data['parts']))
assert g[1]['z']/g[0]['z']*g[3]['z']/g[2]['z']==p['ratio']==16
for i,a in enumerate(p['centerDistances']):
 g1,g2=g[2*i:2*i+2];assert abs((g1['d']+g2['d'])/2-a)<1e-8
 assert abs(g1['beta']-g2['beta'])<1e-8 and g1['hand']==-g2['hand']
assert p['inputRPM']/p['ratio']==p['outputRPM']
assert abs(p['outputTorque']-152.8)<1e-6
sh={}
for n in ['input','middle','output','gear1','gear2','housing_top','housing_base']:
 s=cq.importers.importStep(str(dl/(n+'.step'))).val();assert s.isValid(),n;sh[n]=s;print('STEP VALID',n,flush=True)
results=[]
for label,a,b,apos,bpos,zc in [('stage1','input','gear1',(-96,0,0),(-16,0,-30),-30),('stage2','middle','gear2',(-16,0,0),(96,0,30),30)]:
 for angle in [0,4.5,9]:
  sa=sh[a].rotate((0,0,0),(0,0,1),angle).translate(apos)
  sb=sh[b].rotate((0,0,0),(0,0,1),-angle/4).translate(bpos)
  v=sa.intersect(sb).Volume();print('GEAR PAIR',label,angle,'intersection mm3',v,flush=True)
  results.append({'pair':label,'input_angle':angle,'intersection_volume_mm3':v})
  assert v<.05,(label,angle,v)
(root/'scripts/engineering-validation.json').write_text(json.dumps({'passed':True,'part_count':len(data['parts']),'gear_pair_samples':results},indent=2))
