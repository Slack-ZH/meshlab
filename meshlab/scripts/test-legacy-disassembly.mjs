import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../dist/assets/three.module.js';
import {gearOffset} from '../dist/legacy-disassembly.mjs';
const close=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<t,`${a} ≈ ${b}`);
async function viewer(id){
  const url=new URL(`../dist/${id}/viewer.mjs`,import.meta.url);
  let src=await readFile(url,'utf8');src=src.replace(/import \{OrbitControls\} from '[^']+';/,'const OrbitControls=class {};').replace(/from '([^']+)'/g,(_,path)=>`from '${path==='three'?new URL('../dist/assets/three.module.js',import.meta.url).href:new URL(path,url).href}'`);
  const mod=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64')),Ctor=Object.values(mod).find(v=>typeof v==='function'),v=Object.create(Ctor.prototype);
  Object.assign(v,{scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),renderer:{info:{memory:{geometries:0}}},parts:[],selected:null,amount:0,step:0,speed:1,rotorAngle:0,labelsOn:false,housingMode:'solid',open:false,onSelect(){},render(){},home(){},fitModel(){}});
  const mechanics=await import(new URL(`../dist/${id}/${id==='turbine'?'physics':'mechanics'}.mjs`,import.meta.url));return {v,steps:mod.steps,defaults:mechanics.defaults,mechanics};
}
const bbox=p=>new THREE.Box3().setFromObject(p.group);
for(const id of ['friction','spur','idler','belt','timing'])test(`${id}: production axial withdrawal precedes lateral separation, including fractional/reversed progress`,async()=>{
  const {v,steps,defaults}=await viewer(id),patches={friction:[{driverDiameter:60,drivenDiameter:300,wheelWidth:15},{driverDiameter:300,drivenDiameter:60,wheelWidth:60}],spur:[{driverTeeth:18,drivenTeeth:80,module:1,faceWidth:10}],idler:[{useIdler:false},{driverTeeth:18,idlerTeeth:19,drivenTeeth:60,module:1,faceWidth:10}],belt:[{crossed:false,driverDiameter:60,drivenDiameter:240,centerDistance:400,beltWidth:12}],timing:[{driverTeeth:18,drivenTeeth:80,centerDistance:150,beltWidth:30}]}[id];
  for(const patch of [{},...patches]){
    v.build({...defaults,...patch});const base=new Map(v.parts.map(p=>[p.id,bbox(p)])),max=steps.length-1,position=new Map();
    for(const forward of [true,false])for(let i=0;i<=80;i++){
      const progress=(forward?i:80-i)*max/80;v.explode(progress/max);
      const signature=v.parts.map(p=>p.group.position.toArray());if(forward)position.set(i,signature);else assert.deepEqual(signature,position.get(80-i));
      for(const p of v.parts){const plan=v.disassemblyPlan[p.id],b=base.get(p.id),pos=p.group.position;assert.ok(pos.toArray().every(Number.isFinite));
        if(progress<=plan.step-1)close(pos.z,0);
        if(progress<=max-.4)close(pos.x,0);
        if(pos.x!==0&&plan.role!=='support')assert.ok(b.min.z+pos.z>Math.max(...[...base.values()].map(b=>b.max.z)),'lateral movement waits until clear of every original axial envelope');
        if(['wheel','gear','pulley'].includes(plan.role)&&progress>plan.step-1){const collar=v.parts.find(x=>x.id===p.id.split('-')[0]+'-collar');assert.ok(base.get(collar.id).min.z+collar.group.position.z>b.max.z+pos.z,'collar already outside moving wheel');}
      }
      if(v.parts.some(p=>p.id==='belt')&&progress>1){const belt=v.parts.find(p=>p.id==='belt'),b=base.get('belt');for(const p of v.parts.filter(p=>p.id.endsWith('-flange')))assert.ok(base.get(p.id).min.z+p.group.position.z>b.max.z+belt.group.position.z,'front flange remains beyond closed belt throughout withdrawal');}
    }
    v.restore();assert.ok(v.parts.every(p=>p.group.position.length()===0));
  }v.clearGeometry();
});
test('bicycle retains closed-chain geometry while opposite cranks and outer axle nut clear first',async()=>{
  const {v,defaults}=await viewer('bicycle');for(const patch of [{},{frontTeeth:28,rearTeeth:12,crankLength:180}]){
    v.build({...defaults,...patch});for(let i=0;i<=60;i++){const progress=i/20;v.explode(progress/3);const part=id=>v.parts.find(p=>p.id===id),z=id=>part(id).group.position.z;
      assert.deepEqual(part('chain').group.position.toArray(),part('chainring').group.position.toArray());assert.deepEqual(part('chain').group.position.toArray(),part('rear-sprocket').group.position.toArray());assert.equal(z('wheel'),z('rear-axle'));
      assert.ok(z('crank')>=0&&z('crank-left')<=0);close(z('frame'),0);close(z('bottom-bracket'),0);
      if(progress>1){assert.ok(bbox(part('rear-locknut')).min.z>bbox(part('rear-sprocket')).max.z);assert.ok(bbox(part('crank')).min.z>bbox(part('chain')).max.z);}
      if(progress>2)assert.ok(bbox(part('crank-left')).max.z<bbox(part('wheel')).min.z);
    }v.restore();assert.ok(v.parts.every(p=>p.group.position.length()===0));
  }v.clearGeometry();
});
test('vice unscrews by one lead per turn before side-cover and nut removal',async()=>{
  const {v,defaults,mechanics}=await viewer('vice');for(const patch of [{},{lead:8,screwDiameter:36,jawWidth:40,maxOpening:20},{lead:2,screwDiameter:20,jawWidth:120,maxOpening:140}]){
    v.build({...defaults,...patch});const part=id=>v.parts.find(p=>p.id===id),baseCover=bbox(part('side-cover'));
    for(let i=0;i<=80;i++){const progress=i/20;v.explode(progress/4);const dx=part('screw').group.position.x,angle=v.rotors[0].rotation.x;close(angle*v.p.lead/(2*Math.PI),dx);
      for(const id of ['moving-jaw','collar','handle'])close(part(id).group.position.x,dx);
      if(progress<=1)close(part('side-cover').group.position.z,0);
      if(progress<=2)close(part('nut').group.position.z,0);
      if(progress>1)assert.ok(v.g.threadStart+v.g.midOpening+dx>v.g.nutEnd,'thread fully leaves nut before side cover moves');
      if(progress>2)assert.ok(baseCover.min.z+part('side-cover').group.position.z>bbox(part('nut')).max.z,'cover is beyond nut extraction corridor');
      for(const theta of [0,.7,2.1]){const x=(v.g.nutStart+v.g.nutEnd)/2,local=x-v.g.midOpening-dx;if(local>=v.g.threadStart&&local<=v.g.threadEnd)close(mechanics.threadRadius(v.g,local,theta-angle,v.g.midOpening),mechanics.threadRadius(v.g,x,theta),1e-5);}
    }v.restore();assert.ok(v.rotors.every(r=>r.rotation.x===0));
  }v.clearGeometry();
});
test('turbine keeps actual half-shell and diaphragm ordering and end components withdraw axially',async()=>{
  const {v,defaults}=await viewer('turbine');for(const patch of [{},{stages:6,blades:12,height:180,chord:50,hub:300}]){
    v.build({...defaults,...patch});const p=id=>v.parts.find(p=>p.id===id),shaftHalf=(v.p.stages*(2*v.p.chord+45)+100)/2+140;
    for(let i=0;i<=80;i++){const progress=i/20;v.explode(progress/4);
      if(progress<=1)for(const x of v.parts.filter(p=>p.id.startsWith('bearing')||p.id.startsWith('seal')))close(x.group.position.length(),0);
      if(progress<=3)for(const x of v.parts.filter(p=>p.id.startsWith('stator')))close(x.group.position.length(),0);
      if(progress>=2)for(const x of v.parts.filter(p=>p.id.startsWith('bearing')||p.id.startsWith('seal'))){const b=bbox(x);assert.ok(x.id.endsWith('-1')?b.max.x< -shaftHalf:b.min.x>shaftHalf);}
      if(progress>3)for(const x of v.parts.filter(p=>p.id.startsWith('stator'))){const b=bbox(x);assert.ok(x.id.includes('lower')?b.min.y>bbox(p('lower')).max.y:b.max.y<bbox(p('upper')).min.y,'diaphragm does not reach the already removed same-side casing');}
    }v.restore();
  }
});
test('GL16 production CAD bounds: covers clear shaft ends before complete shaft subassemblies lift',async()=>{
  const model=JSON.parse(await readFile(new URL('../dist/assets/model.json',import.meta.url),'utf8')),boxes=new Map();
  for(const p of model.parts){const data=await readFile(new URL('../dist/assets/'+p.id+'.mesh',import.meta.url)),n=data.readUInt32LE(0),b=new THREE.Box3();for(let i=0;i<n;i++)b.expandByPoint(new THREE.Vector3(data.readFloatLE(8+i*12),data.readFloatLE(12+i*12),data.readFloatLE(16+i*12)));b.translate(new THREE.Vector3(...p.position));boxes.set(p.id,b);}
  const at=(p,t)=>boxes.get(p.id).clone().translate(new THREE.Vector3(...gearOffset(p.id,p.position,t))),shaft=model.parts.filter(p=>['input','middle','output'].includes(p.id));
  for(let i=0;i<=140;i++){const t=i/20;
    if(t<=4)for(const p of shaft)close(gearOffset(p.id,p.position,t)[1],0);
    if(t<=5)for(const p of shaft)close(gearOffset(p.id,p.position,t)[0],0);
    if(t>=4)for(const p of model.parts.filter(p=>p.id.startsWith('cap_')||p.id.startsWith('seal_'))){const b=at(p,t);assert.ok(p.position[2]>0?b.min.z>Math.max(...shaft.map(p=>at(p,t).max.z)):b.max.z<Math.min(...shaft.map(p=>at(p,t).min.z)));}
    if(t>=5)for(const p of shaft)assert.ok(at(p,t).min.y>at(model.parts.find(p=>p.id==='housing_base'),t).max.y);
    for(const p of model.parts.filter(p=>['gear1','gear2','key1','key2'].includes(p.id)))assert.deepEqual(gearOffset(p.id,p.position,t),gearOffset(p.position[0]<0?'middle':'output',p.position,t),'keys/gears retain their shaft fit');
  }
});
