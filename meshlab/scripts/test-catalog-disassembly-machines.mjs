import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {models} from '../dist/catalog/models-machines.mjs';
import {machinePlans,splitMachineParts,machineReferences} from '../dist/catalog/disassembly-machines.mjs';
const TAU=Math.PI*2,defaults=m=>({inputRPM:30,...Object.fromEntries(m.fields.map(f=>[f.key,f.value]))});
const u=new URL('../dist/assets/three.module.js',import.meta.url).href,THREE=await import(u);
const {geometryFor}=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(new URL('../dist/catalog/geometry.mjs',import.meta.url),'utf8').replace("from 'three'",`from '${u}'`)).toString('base64'));
const matrix=(position=[0,0,0],rotation=[0,0,0],scale=[1,1,1])=>new THREE.Matrix4().compose(new THREE.Vector3(...position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),new THREE.Vector3(...scale));
function boxes(m,p,parts){const state=m.sample(p,0);return parts.map(part=>{const pose=state.poses[part.poseSource||part.id]||{},world=matrix(pose.position||part.position,pose.rotation||part.rotation,pose.scale),box=new THREE.Box3();for(const s of part.shapes){const geo=geometryFor(s);geo.computeBoundingBox();box.union(geo.boundingBox.clone().applyMatrix4(world.clone().multiply(matrix(s.position,s.rotation))));geo.dispose();}return box;});}
const intersection=(a,b)=>Math.min(a.max.x,b.max.x)-Math.max(a.min.x,b.min.x)>1e-5&&Math.min(a.max.y,b.max.y)-Math.max(a.min.y,b.min.y)>1e-5&&Math.min(a.max.z,b.max.z)-Math.max(a.min.z,b.min.z)>1e-5;
const stageIndex=(stages,id)=>stages.findIndex(s=>s.moves.some(m=>m.ids.includes(id)));
function setup(m,p){const original=m.build(p).parts,parts=splitMachineParts(m,original),stages=machinePlans[m.id](parts,p);return {original,parts,stages};}
test('all twelve plans cover every displayed part or an explicit reference for defaults and all field boundaries',()=>{
 assert.deepEqual(Object.keys(machinePlans).sort(),models.map(m=>m.id).sort());
 for(const m of models){const p=defaults(m),cases=[p];for(const f of m.fields)for(const v of f.options?f.options.map(o=>o[0]):[f.min,f.max])cases.push({...p,[f.key]:v});
 for(const q of cases){m.validate(q);const {parts,stages}=setup(m,q),ids=new Set(parts.map(p=>p.id)),moved=new Set();assert.ok(stages.length>=3&&stages.length<=14,m.id);assert.equal(ids.size,parts.length);
 for(const s of stages){assert.ok(s.title&&s.description&&s.moves.length);const inStage=new Set();for(const move of s.moves){assert.ok(move.ids.length&&move.distance>0&&Number.isFinite(move.distance));assert.ok(Math.abs(Math.hypot(...move.axis)-1)<1e-10);for(const id of move.ids){assert.ok(ids.has(id),m.id+' unknown '+id);assert.ok(!inStage.has(id),'part moves twice in same stage');inStage.add(id);moved.add(id);}}}
 const refs=new Set(machineReferences[m.id]);for(const part of parts)assert.equal(moved.has(part.id),!refs.has(part.id),m.id+' coverage '+part.id);
 }}
});
test('split preserves exactly all original shapes and carries parent poseSource without mutating build specs',()=>{
 for(const m of models){const p=defaults(m),original=m.build(p).parts,before=JSON.stringify(original),parts=splitMachineParts(m,original),sourceIDs=new Set(original.map(p=>p.id));assert.equal(JSON.stringify(original),before);
 for(const parent of original){const family=parts.filter(p=>(p.poseSource||p.id)===parent.id),old=parent.shapes.map(s=>JSON.stringify(s)).sort(),actual=family.flatMap(p=>p.shapes.map(s=>JSON.stringify(s))).sort();assert.deepEqual(actual,old,m.id+' lost/duplicated shape');assert.ok(parts.find(p=>p.id===parent.id).shapes.length);for(const child of family){assert.deepEqual(child.position,parent.position);assert.deepEqual(child.rotation,parent.rotation);assert.ok(sourceIDs.has(child.poseSource||child.id));}}
 }
});
test('mechanical blocking dependencies are respected instead of moving all parts at once',()=>{
 const checks={valvetrain:[['cam-drive','intake-cam'],['intake-cam','intake-tappet'],['intake-tappet','intake-spring'],['intake-spring','intake-valve']],planetary:[['carrier','ring'],['ring','planet-0'],['planet-0','sun']], 'three-speed-hub':[['hub-shell','carrier'],['selector','carrier'],['carrier','ring']],synchronizer:[['fork','sleeve'],['sleeve','free-gear'],['free-gear','blocker'],['blocker','hub']],cvt:[['primary-front-sheave','element-0'],['secondary-front-sheave','element-0'],['element-0','secondary']], 'rzeppa-joint':[['outer-track-0','ball-0'],['ball-0','cage'],['cage','inner-race']], 'conjugate-cam':[['shaft','upper-cam']], 'indexing-cam':[['lock-pin','turret'],['turret','roller-0']],cycloidal:[['output','disc'],['disc','eccentric']],harmonic:[['output','wave'],['wave','flex-body']], 'enveloping-worm':[['worm-left-bearing','worm'],['worm-right-bearing','worm'],['bearings','wheel']]};
 for(const m of models){const {stages}=setup(m,defaults(m));for(const [a,b]of checks[m.id]||[])assert.ok(stageIndex(stages,a)<stageIndex(stages,b),m.id+' '+a+' before '+b);}
 const manual=models.find(m=>m.number===40);for(const selectedGear of ['N','1','2','3','4']){const {stages}=setup(manual,{...defaults(manual),selectedGear});assert.ok(stageIndex(stages,'input-3')<stageIndex(stages,'input-2'));assert.ok(stageIndex(stages,'input-2')<stageIndex(stages,'input-1'));if(selectedGear!=='N'&&selectedGear!=='1')assert.ok(stageIndex(stages,'dog')<stageIndex(stages,'input-'+(Number(selectedGear)-1)));}
});
test('flexible closed assemblies keep identical paths; tilted output extraction follows its actual axis',()=>{
 for(const [n,group]of [[42,'pushbelt'],[47,'flexspline']]){const m=models.find(m=>m.number===n),{parts,stages}=setup(m,defaults(m)),family=parts.filter(p=>p.assemblyGroup===group).map(p=>p.id);for(const s of stages)for(const move of s.moves)if(move.ids.some(id=>family.includes(id)))assert.ok(family.every(id=>move.ids.includes(id)));}
 const m=models.find(m=>m.number===43);for(const angle of [0,25,40]){const {stages}=setup(m,{...defaults(m),angle}),out=stages.flatMap(s=>s.moves).find(m=>m.ids.includes('inner-race')),cage=stages.flatMap(s=>s.moves).find(m=>m.ids.includes('cage'));assert.ok(Math.abs(out.axis[0]-Math.sin(angle*Math.PI/180))<1e-12);assert.ok(Math.abs(cage.axis[0]-Math.sin(angle*Math.PI/360))<1e-12);}
});
test('production geometry final bounds are separated between independent movement histories at default and all-high dimensions',()=>{
 for(const m of models){const p=defaults(m),largest={...p,...Object.fromEntries(m.fields.filter(f=>!f.options).map(f=>[f.key,f.max]))};for(const q of [p,largest]){const {parts,stages}=setup(m,q),bb=boxes(m,q,parts),histories=new Map(),offsets=parts.map(()=>new THREE.Vector3());
 for(let i=0;i<parts.length;i++){const history=stages.map((s,k)=>{const move=s.moves.find(v=>v.ids.includes(parts[i].id));return move?[k,move.axis,move.distance]:null;}).filter(Boolean),key=JSON.stringify(history);if(!histories.has(key))histories.set(key,[]);histories.get(key).push(i);for(const h of history)offsets[i].addScaledVector(new THREE.Vector3(...h[1]),h[2]);}
 const groups=[...histories.values()].map(indices=>{const box=new THREE.Box3();for(const i of indices)box.union(bb[i].clone().translate(offsets[i]));return {box,ids:indices.map(i=>parts[i].id)};});for(let a=0;a<groups.length;a++)for(let b=a+1;b<groups.length;b++)assert.ok(!intersection(groups[a].box,groups[b].box),m.id+' final overlap '+groups[a].ids+' / '+groups[b].ids);
 }}
});

// These checks inspect the actual production descriptors / mesh vertices at sampled
// intermediate positions. They complement endpoint boxes, which alone are not path tests.
test('43: all balls exit radially through the actual two-ring cage windows at every shaft tilt',()=>{
 const m=models.find(m=>m.number===43);for(const angle of [0,25,40]){const p={...defaults(m),angle},{parts,stages}=setup(m,p),state=m.sample(p,0),cage=parts.find(x=>x.id==='cage'),cp=state.poses.cage||{};
 for(const ball of parts.filter(x=>/^ball-\d+$/.test(x.id))){const center=new THREE.Vector3(...state.poses[ball.id].position),radius=ball.shapes[0].radius,move=stages.flatMap(s=>s.moves).find(v=>v.ids.includes(ball.id));
 for(let f=0;f<=20;f++){const q=center.clone().addScaledVector(new THREE.Vector3(...move.axis),move.distance*f/20);for(const tor of cage.shapes){const inv=matrix(cp.position||cage.position,cp.rotation||cage.rotation,cp.scale).multiply(matrix(tor.position,tor.rotation)).invert(),local=q.clone().applyMatrix4(inv),clearance=Math.hypot(Math.hypot(local.x,local.y)-tor.radius,local.z)-tor.tube-radius;assert.ok(clearance>=-1e-5,'ball/cage penetration during radial exit');}}
 }}
});
test('48: cylindrical worm production mesh clears wheel through radial extraction; enveloping matching pair stays rigid',()=>{
 const m=models.find(m=>m.number===48),base=defaults(m);
 for(const starts of [1,4])for(const wheelTeeth of [24,60])for(const module of [2,3.5]){
  const p={...base,starts,wheelTeeth,module,wormType:'cylindrical'},b=m.build(p),worm=b.parts.find(x=>x.id==='worm'),R=wheelTeeth*module/2,wr=5*module,phase=m.sample(p,0).poses.wheel.rotation[2],period=TAU/wheelTeeth;
  const {parts,stages}=setup(m,p),path=stages.flatMap(s=>s.moves).find(v=>v.ids.includes('worm'));assert.deepEqual(path.axis,[0,1,0]);assert.ok(stageIndex(stages,'worm')<stageIndex(stages,'wheel'));
  for(const shape of worm.shapes){const geo=geometryFor(shape),vertices=geo.attributes.position,mat=matrix(worm.position,worm.rotation).multiply(matrix(shape.position,shape.rotation));
   for(let i=0;i<vertices.count;i++){const v=new THREE.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(mat);for(let f=0;f<=40;f++){const x=v.x,y=v.y+f*.25*module,z=v.z;if(Math.abs(z)>=2*module-.01)continue;const r=Math.hypot(x,y),a=Math.atan2(y,x)-phase-z*starts/(10*R),d=((a+Math.PI/wheelTeeth)%period+period)%period-Math.PI/wheelTeeth,sag=wr-Math.sqrt(wr*wr-z*z);assert.ok(!(r<R-1.15*module-.01||r<R+module+sag-.01&&r>R-1.15*module+sag+.01&&Math.abs(d)<Math.PI*.42/wheelTeeth-.0002),'cylindrical worm passes into wheel during extraction');}}
   geo.dispose();
  }
  const env=setup(m,{...p,wormType:'enveloping'}).stages,wm=env.flatMap(s=>s.moves).filter(v=>v.ids.includes('worm')),gm=env.flatMap(s=>s.moves).filter(v=>v.ids.includes('wheel'));assert.deepEqual(wm,gm,'interlocking enveloping pair must leave as one assembly');
 }
});
