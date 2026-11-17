import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../dist/assets/three.module.js';
import {definitions,defaults,validate,solve,samples,angleRange,advance,phaseForAngle,rad} from '../dist/linkages/mechanics.mjs';
const close=(a,b,message='',tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${message}: ${a} ≠ ${b}`);
const distance=(P,Q)=>Math.hypot(P.x-Q.x,P.y-Q.y);

test('four-bar lengths remain closed through each full demonstration range and parameter bounds',()=>{
  let accepted=0,rejected=0;
  for(const kind of ['crank-rocker','double-rocker','parallelogram']) {
    const base=defaults(kind),fields=definitions[kind].fields.filter(f=>f.key!=='rpm');
    const candidates=[base,...Array.from({length:2**fields.length},(_,i)=>({...base,...Object.fromEntries(fields.map((f,j)=>[f.key,(i>>j)&1?f.max:f.min]))}))];
    for(const p of candidates){try{validate(kind,p);}catch{rejected++;continue;}accepted++;
      for(const s of samples(kind,p,720)){
        close(distance(s.A,s.B),p.a,'AB');close(distance(s.B,s.C),p.b||p.d,'BC');close(distance(s.C,s.D),p.c||p.a,'CD');close(distance(s.A,s.D),p.d,'AD');
        if(kind==='parallelogram')close(s.couplerAngle,0,'lamp orientation');
      }
    }
  }
  assert.ok(accepted>6);assert.ok(rejected>6);
});
test('Scotch yoke and slider-crank have identical endpoints and independently known quarter-turn displacement',()=>{
  const p=defaults('scotch-yoke');
  for(const theta of [0,180,360]){const s=solve('scotch-yoke',p,theta);close(s.displacement,s.comparison);}
  const mid=solve('scotch-yoke',p,90);close(mid.displacement,p.r);close(mid.comparison,p.r+p.rod-Math.sqrt(p.rod**2-p.r**2));
  assert.ok(solve('scotch-yoke',{...p,rod:220},90).comparison-mid.displacement<mid.comparison-mid.displacement);
  for(const s of samples('scotch-yoke',p)) {close(s.slider.x,s.B.x);close(s.slotTravel,s.B.y-s.A.y);close(distance(s.A,s.B),p.r);}
});
test('quick-return joints close, both strokes share endpoints, and measured work/return fractions match theory',()=>{
  for(const r of [20,30,45])for(const d of [70,90,130]) {
    const p={...defaults('quick-return'),r,d,lever:240};try{validate('quick-return',p);}catch{continue;}
    const data=samples('quick-return',p,3600),first=data[0];let work=0;
    for(const s of data.slice(0,-1)) {close(distance(s.O,s.B),p.r);close(distance(s.A,s.C),p.lever);close(distance(s.C,s.slider),p.rod);close((s.B.x-s.A.x)*(s.C.y-s.A.y)-(s.B.y-s.A.y)*(s.C.x-s.A.x),0,'slot alignment',1e-6);if(s.phase==='工作行程')work++;}
    close(work/3600,first.workFraction,'measured work fraction',.001);
    close(first.workTime+first.returnTime,60/p.rpm);close(first.workTime/first.returnTime,first.ratio);
    const alpha=Math.asin(r/d)*180/Math.PI;
    const left=solve('quick-return',p,180+alpha),right=solve('quick-return',p,360-alpha);
    close(left.displacement,0);close(right.displacement,2*p.lever*r/d);assert.ok(first.workTime>first.returnTime);
    const atStop=solve('quick-return',{...p,rpm:0},45);assert.equal(atStop.workTime,null);assert.equal(atStop.returnTime,null);
  }
});
test('rotary playback respects real RPM and reciprocating playback never leaves the valid branch',()=>{
  for(const kind of Object.keys(definitions)) {
    const p=defaults(kind),range=angleRange(kind,p);let s={angle:definitions[kind].initial,phase:phaseForAngle(kind,p,definitions[kind].initial)};
    const still=advance(kind,{...p,rpm:0},s,100);assert.deepEqual(still,s);
    for(let i=0;i<1000;i++){s=advance(kind,p,s,.05,2);assert.ok(s.angle>=range.min-1e-8&&s.angle<=range.max+1e-8);solve(kind,p,s.angle);}
  }
  const p=defaults('quick-return');close(advance('quick-return',p,{angle:0,phase:0},1).angle,72);
});
test('bad numbers and invalid topology are rejected before applying',()=>{
  for(const k of Object.keys(definitions)){const p=defaults(k),key=definitions[k].fields[0].key;assert.throws(()=>validate(k,{...p,[key]:NaN}));assert.throws(()=>validate(k,{...p,[key]:Infinity}));assert.throws(()=>validate(k,{...p,[key]:-1}));}
  assert.throws(()=>validate('crank-rocker',{...defaults('crank-rocker'),a:65,b:105,c:80,d:170}));
  assert.throws(()=>validate('quick-return',{...defaults('quick-return'),r:45,d:130,lever:180}));
});

// Exercise the actual production mesh builder without a DOM or a GPU.
let source=await readFile(new URL('../dist/linkages/viewer.mjs',import.meta.url),'utf8');
source=source.replace("import {OrbitControls} from '../assets/OrbitControls.js';",'const OrbitControls=class {};');
source=source.replace(/from '(\.\.?\/[^']+)'/g,(_,p)=>`from '${new URL(p,new URL('../dist/linkages/viewer.mjs',import.meta.url)).href}'`);
const {LinkageViewer}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function cpu(kind){const v=Object.create(LinkageViewer.prototype);Object.assign(v,{kind,scene:new THREE.Scene(),parts:[],selected:null,amount:0,step:0,housing:'solid',stage:{fit(){}},home(){},fit(){},render(){},onSelect(){}});return v;}
test('production mesh layers follow joint positions and restore exactly after disassembly',()=>{
  for(const kind of Object.keys(definitions)) {
    const v=cpu(kind),p=defaults(kind),range=angleRange(kind,p);v.build(p,definitions[kind].initial);
    for(const angle of [range.min,(range.min+range.max)/2,range.max]) {
      v.update(angle);const original=v.parts.map(p=>p.group.position.toArray());
      v.explode(1);
      const boxes=v.parts.map(p=>({id:p.id,box:new THREE.Box3().setFromObject(p.group)}));
      for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)assert.equal(boxes[i].box.intersectsBox(boxes[j].box),false,kind+' exploded '+boxes[i].id+' / '+boxes[j].id);
      v.restore();assert.deepEqual(v.parts.map(p=>p.group.position.toArray()),original);close(v.angle,angle);
      for(let i=0;i<=4;i++)v.assembly(i);v.restore();assert.deepEqual(v.parts.map(p=>p.group.position.toArray()),original);
      for(const [key,group]of v.pinGroups){close(group.position.x,v.solution[key].x);close(group.position.y,v.solution[key].y);}
      for(const part of v.parts){const b=new THREE.Box3().setFromObject(part.group);assert.ok([...b.min.toArray(),...b.max.toArray()].every(Number.isFinite));}
    }
    v.select('input');v.select('output');
    v.input.group.traverse(o=>{if(o.isMesh)assert.equal(o.material.emissiveIntensity,0);});
    v.output.group.traverse(o=>{if(o.isMesh){assert.equal(o.material.emissive.getHex(),0x226ad8);assert.equal(o.material.emissiveIntensity,.32);}});
    v.setHousing('transparent');v.frame.group.traverse(o=>{if(o.isMesh)assert.equal(o.material.opacity,.16);});
    v.setHousing('hidden');assert.equal(v.frame.group.visible,false);v.clear();
  }
});
