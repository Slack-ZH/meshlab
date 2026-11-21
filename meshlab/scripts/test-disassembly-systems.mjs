import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../dist/assets/three.module.js';
import {models} from '../dist/catalog/models-systems.mjs';
import {systemPlans,splitSystemParts} from '../dist/catalog/disassembly-systems.mjs';

const defaults=m=>Object.fromEntries(m.fields.map(f=>[f.key,f.value]));
const corners=m=>m.fields.reduce((all,f)=>all.flatMap(p=>(f.options?f.options.map(o=>o[0]):[f.min,f.max]).map(v=>({...p,[f.key]:v}))),[{}]);
const model=n=>models.find(m=>m.number===n);
const fixture=(n,p={})=>{const m=model(n),params={...defaults(m),...p},parts=splitSystemParts(m,m.build(params).parts);return {m,params,parts,stages:systemPlans[m.id](parts,params)};};
const first=(stages,id)=>stages.findIndex(s=>s.moves.some(m=>m.ids.includes(id)));
const initialMove=(stages,id)=>stages[first(stages,id)]?.moves.find(m=>m.ids.includes(id));
const before=(stages,a,b)=>{assert.ok(first(stages,a)>=0,a+' missing');assert.ok(first(stages,a)<first(stages,b),`${a} must precede ${b}`);};
const sameMove=(stages,ids)=>assert.ok(stages.some(s=>s.moves.some(m=>ids.every(id=>m.ids.includes(id)))),ids.join('+'));
const closeVector=(a,b)=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-8,`${a} != ${b}`));
const references={49:['rv-ring'],50:['dct-even-shaft'],51:['at-ring'],52:['tc-pump'],53:['hsd-ring'],54:['tr-ring'],55:['pto-engine','pto-input-tube','pto-in-slow','pto-in-fast','drive-in-low','drive-in-high'],56:['cnc-bed','cnc-column'],57:['wr-outer'],58:['clk-plate'],59:['heli-bearing'],60:['wind-ring']};

test('exactly twelve model-specific system plans',()=>assert.deepEqual(Object.keys(systemPlans).sort(),models.map(m=>m.id).sort()));
for(const m of models)test(`${m.number}: full endpoint/mode matrix yields valid plans, preserves reference and covers every part`,()=>{
  for(const params of corners(m)){
    const parts=splitSystemParts(m,m.build(params).parts),stages=systemPlans[m.id](parts,params),ids=new Set(parts.map(p=>p.id)),moved=new Set();
    assert.ok(stages.length>=5);assert.equal(ids.size,parts.length);
    for(const s of stages){assert.ok(s.title.length>3&&s.description.length>10);assert.ok(s.moves.length>0);const simultaneous=new Set();
      for(const mv of s.moves){assert.ok(mv.ids.length);closeVector([Math.hypot(...mv.axis)],[1]);assert.equal(mv.axis.length,3);assert.ok(mv.axis.every(Number.isFinite));if(mv.distance!==undefined)assert.ok(mv.distance>0&&Number.isFinite(mv.distance));
        for(const id of mv.ids){assert.ok(ids.has(id),id);assert.ok(!simultaneous.has(id),'part cannot receive two simultaneous moves');simultaneous.add(id);moved.add(id);}
        for(const p of parts.filter(p=>mv.ids.includes(p.id)&&p.assemblyGroup))for(const other of parts.filter(o=>o.assemblyGroup===p.assemblyGroup))assert.ok(mv.ids.includes(other.id),'assemblyGroup was broken');
      }
    }
    assert.deepEqual(parts.filter(p=>!moved.has(p.id)).map(p=>p.id).sort(),[...references[m.number]].sort());
  }
});

test('49: unload output and input first; opposing eccentric shoulders remain in one cartridge',()=>{
  const {stages}=fixture(49);before(stages,'rv-output','rv-disc0');before(stages,'rv-input','rv-disc0');
  sameMove(stages,['rv-disc0','rv-disc1','rv-crank0','rv-crank1','rv-crank2']);closeVector(initialMove(stages,'rv-disc0').axis,[0,0,-1]);
  const last=stages.flatMap(s=>s.moves).filter(m=>m.ids.includes('rv-disc1'));assert.ok(last.some(m=>m.ids.length===1&&m.axis[2]===1));
  assert.ok(!stages.some(s=>s.moves.some(m=>m.ids.includes('rv-disc0')&&!m.ids.includes('rv-crank0'))),'rear disc cannot pass opposite-phase eccentric shoulder');
});
test('50: input-side clutches removed in axial order, output train first disengages radially',()=>{
  for(const gear of ['0','1','2','3','4'])for(const preselect of ['off','on']){
    const {stages}=fixture(50,{gear,preselect});before(stages,'dct-engine','dct-clutch0');before(stages,'dct-clutch0','dct-clutch1');before(stages,'dct-output','dct-driver2');before(stages,'dct-driver2','dct-driver0');before(stages,'dct-driver0','dct-odd-shaft');before(stages,'dct-driver3','dct-driver1');
    sameMove(stages,['dct-output','dct-dog','dct-predog',...Array.from({length:4},(_,i)=>'dct-driven'+i)]);closeVector(initialMove(stages,'dct-output').axis,[1,0,0]);
  }
});
test('51/52: separate end caps before shell, leaving a real axial opening',()=>{
  for(const n of [51,52])for(const params of corners(model(n))){const {stages,parts}=fixture(n,params),prefix=n===51?'at-case':'tc-case';before(stages,prefix+'-front-cap',prefix+'-shell');before(stages,prefix+'-rear-cap',prefix+'-shell');
    closeVector(initialMove(stages,prefix+'-front-cap').axis,[0,0,1]);closeVector(initialMove(stages,prefix+'-rear-cap').axis,[0,0,-1]);
    const shell=parts.find(p=>p.id===prefix+'-shell');assert.equal(shell.shapes.length,1);assert.equal(shell.shapes[0].kind,'ring');
    const front=parts.find(p=>p.id===prefix+'-front-cap').shapes[0],rear=parts.find(p=>p.id===prefix+'-rear-cap').shapes[0];assert.ok(front.position[2]>0&&rear.position[2]<0);
    if(n===51){before(stages,'at-port','at-carrier');before(stages,'at-clutch','at-sun');before(stages,'at-sun','at-carrier');if(params.mode==='overdrive')sameMove(stages,['at-brake','at-clutch']);}
    else {before(stages,'tc-lock','tc-turbine');before(stages,'tc-turbine','tc-stator');sameMove(stages,Array.from({length:10},(_,i)=>'tc-flow'+i));}
  }
});
test('53: fixed cases precede rotors and planetary connectors',()=>{
  const {stages}=fixture(53);for(const [a,b] of [['hsd-engine-case','hsd-engine'],['hsd-mg1-case','hsd-mg1'],['hsd-mg2-case','hsd-mg2'],['hsd-mg1','hsd-sun'],['hsd-engine','hsd-carrier'],['hsd-sun','hsd-carrier']])before(stages,a,b);
});
test('54: opposite half-shell directions; differential stays a rigid module before low-range strip',()=>{
  const {stages}=fixture(54);before(stages,'tr-diff-shell-upper','tr-diff');before(stages,'tr-diff-shell-lower','tr-diff');before(stages,'tr-diff','tr-sun');before(stages,'tr-range','tr-sun');before(stages,'tr-sun','tr-carrier');
  closeVector(initialMove(stages,'tr-diff-shell-upper').axis,[0,1,0]);closeVector(initialMove(stages,'tr-diff-shell-lower').axis,[0,-1,0]);sameMove(stages,['tr-diff','tr-front','tr-rear','tr-spider','tr-lock']);
});
test('55: PTO and wheel branches detach as distinct rigid assemblies',()=>{
  const {stages}=fixture(55);before(stages,'pto-implement','pto-shaft');before(stages,'drive-axle','drive-counter');sameMove(stages,['pto-shaft','pto-selector','pto-out-slow','pto-out-fast']);sameMove(stages,['drive-axle','drive-wheels']);sameMove(stages,['drive-counter','drive-selector','drive-out-low','drive-out-high']);
  closeVector(initialMove(stages,'pto-shaft').axis,[1,0,0]);closeVector(initialMove(stages,'drive-axle').axis,[-1,0,0]);
});
test('56: clear top stack, remove each screw on its own axis, then lift the now-free slide',()=>{
  const {stages}=fixture(56);for(const [a,b] of [['cnc-tool','cnc-rotary'],['cnc-znut','cnc-rotary'],['cnc-znut','cnc-zscrew'],['cnc-rotary','cnc-yscrew'],['cnc-yscrew','cnc-ynut'],['cnc-ynut','cnc-xscrew'],['cnc-xscrew','cnc-xnut']])before(stages,a,b);
  closeVector(initialMove(stages,'cnc-xscrew').axis,[-1,0,0]);closeVector(initialMove(stages,'cnc-yscrew').axis,[0,-1,0]);closeVector(initialMove(stages,'cnc-zscrew').axis,[0,0,1]);
});
test('57: extraction and trunnion axes agree with production stopped world pose, including angle extremes',()=>{
  for(const axis4 of [-90,0,90])for(const axis5 of [-40,0,40])for(const axis6 of [-90,90]){
    const {m,params,stages}=fixture(57,{axis4,axis5,axis6}),poses=m.sample(params,0).poses;
    const tool=new THREE.Vector3(0,0,1).applyEuler(new THREE.Euler(...poses['wr-flange'].rotation)).toArray();
    const hinge=new THREE.Vector3(0,1,0).applyEuler(new THREE.Euler(...poses['wr-bend'].rotation)).toArray();
    closeVector(initialMove(stages,'wr-flange').axis,tool);closeVector(initialMove(stages,'wr-transfer').axis,tool);closeVector(initialMove(stages,'wr-bend-journal-positive').axis,hinge);closeVector(initialMove(stages,'wr-bend-journal-negative').axis,hinge.map(v=>-v));
    for(const id of ['wr-flange','wr-transfer','wr-bend']){const parking=stages[first(stages,id)+1].moves.find(m=>m.ids.includes(id));assert.ok(Math.abs(parking.axis.reduce((sum,v,i)=>sum+v*tool[i],0))<1e-8,'side parking must stay in the already-cleared extraction plane');}
    before(stages,'wr-flange','wr-transfer');before(stages,'wr-transfer','wr-inner');before(stages,'wr-inner','wr-bend-journal-positive');before(stages,'wr-bend-journal-positive','wr-bend');before(stages,'wr-bend','wr-middle');closeVector(initialMove(stages,'wr-middle').axis,[0,0,1]);
  }
});
test('58: top down axial sequence clears pallets before releasing escapement wheel',()=>{
  const {stages}=fixture(58),ids=['clk-spring','clk-balance','clk-fork','clk-escape','clk-third','clk-center','clk-barrel'];for(let i=1;i<ids.length;i++)before(stages,ids[i-1],ids[i]);for(const id of ids)closeVector(initialMove(stages,id).axis,[0,0,1]);
});
test('59: coaxial large gears exit below after rotors, base and interfering input branch clear',()=>{
  const {stages}=fixture(59);for(const [a,b] of [['heli-rotor-high','heli-rotor-low'],['heli-bearing-base','heli-upper'],['heli-idler','heli-input'],['heli-input','heli-upper'],['heli-upper','heli-lower']])before(stages,a,b);
  closeVector(initialMove(stages,'heli-upper').axis,[0,0,-1]);closeVector(initialMove(stages,'heli-lower').axis,[0,0,-1]);closeVector(initialMove(stages,'heli-idler').axis,[0,1,0]);
});
test('60: strip high-speed stages first, low input before sun, then planetary cartridge',()=>{
  const {stages}=fixture(60),ids=['wind-stator','wind-generator','wind-stage3','wind-stage2','wind-rotor','wind-sun','wind-carrier'];for(let i=1;i<ids.length;i++)before(stages,ids[i-1],ids[i]);closeVector(initialMove(stages,'wind-rotor').axis,[0,0,-1]);closeVector(initialMove(stages,'wind-sun').axis,[0,0,-1]);sameMove(stages,['wind-carrier','wind-planet0','wind-planet1','wind-planet2']);
});

test('split parts are pure/idempotent, retain source poses and preserve the existing shapes',()=>{
  function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
  for(const m of models){const parts=freeze(m.build(defaults(m)).parts),snapshot=JSON.stringify(parts),split=splitSystemParts(m,parts);assert.equal(JSON.stringify(parts),snapshot);assert.deepEqual(splitSystemParts(m,split),split);
    for(const p of split){const source=parts.find(x=>x.id===(p.poseSource||p.id));assert.ok(source);assert.deepEqual(p.position,source.position);assert.deepEqual(p.rotation,source.rotation);assert.equal(p.assemblyGroup,source.assemblyGroup);assert.ok(p.shapes.length);}
    for(const original of parts){const children=split.filter(p=>(p.poseSource||p.id)===original.id);if(original.id!=='tr-diff')assert.deepEqual(children.flatMap(p=>p.shapes).sort((a,b)=>original.shapes.indexOf(a)-original.shapes.indexOf(b)),original.shapes);}
  }
});
test('dynamic IDs include all members of a flow-marker assembly, including added markers',()=>{
  const {m,params,parts}=fixture(52),extra={...parts.find(p=>p.id==='tc-flow0'),id:'another-marker'},all=[...parts,extra];
  const stages=systemPlans[m.id](all,params);assert.ok(initialMove(stages,'tc-flow0').ids.includes(extra.id));assert.deepEqual(systemPlans[m.id]([],params),[]);
});

const source=(await readFile(new URL('../dist/catalog/geometry.mjs',import.meta.url),'utf8')).replace("from 'three'",`from '${new URL('../dist/assets/three.module.js',import.meta.url).href}'`);
const {geometryFor}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('all newly split shapes build with the actual production renderer; two half-shells retain annulus area',()=>{
  let count=0;for(const m of models){const raw=m.build(defaults(m)).parts,split=splitSystemParts(m,raw);for(const p of split.filter(p=>p.poseSource))for(const s of p.shapes){const g=geometryFor(s);assert.ok(g.attributes.position.count>0);assert.ok(g.attributes.position.array.every(Number.isFinite));g.computeBoundingBox();assert.ok(g.boundingBox.min.toArray().every(Number.isFinite));g.dispose();count++;}}
  assert.ok(count>20);
  const {parts}=fixture(54);const halves=parts.filter(p=>p.id.startsWith('tr-diff-shell-')).map(p=>p.shapes[0]);
  const area=pts=>Math.abs(pts.reduce((a,p,i)=>{const q=pts[(i+1)%pts.length];return a+p[0]*q[1]-q[0]*p[1];},0))/2;
  assert.ok(Math.abs(halves.reduce((a,s)=>a+area(s.points),0)-Math.PI*(35**2-28**2))<2);
  assert.ok(halves[0].points.every(p=>p[1]>=-1e-10));assert.ok(halves[1].points.every(p=>p[1]<=1e-10));
});
