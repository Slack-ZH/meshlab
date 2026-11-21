
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../dist/assets/three.module.js';
import {models,defaultParameters,modelFields,validateParameters} from '../dist/catalog/registry.mjs';
import {disassemblyParts,prepareDisassembly,applyDisassembly} from '../dist/catalog/disassembly.mjs';

const threeURL=new URL('../dist/assets/three.module.js',import.meta.url).href;
const geometry=fs.readFileSync(new URL('../dist/catalog/geometry.mjs',import.meta.url),'utf8').replace("from 'three'","from '"+threeURL+"'");
const {shapeMesh}=await import('data:text/javascript;base64,'+Buffer.from(geometry).toString('base64'));

function assemble(model,params){
  const poses=model.sample(params,0).poses;
  const parts=disassemblyParts(model,model.build(params).parts).map(p=>{
    const group=new THREE.Group(),pose=poses[p.poseSource||p.id]||{};
    group.position.fromArray(pose.position||p.position||[0,0,0]);
    group.rotation.set(...(pose.rotation||p.rotation||[0,0,0]));
    group.scale.fromArray(pose.scale||[1,1,1]);
    for(const s of p.shapes)group.add(shapeMesh(s));
    return {...p,group,offset:new THREE.Vector3()};
  });
  return {parts,stages:prepareDisassembly(model,parts,params)};
}

// Exercise the actual assembled pose, including combinations of shaft angles,
// alternate modes and the pose-dependent roller and derailleur geometry.
for(const model of models.filter(m=>m.number>=24&&m.number<=34))test('motion extraction envelope '+model.id,()=>{
  const defaults=defaultParameters(model),variants=[defaults];
  for(const f of modelFields(model)){
    if(f.key==='inputRPM' && model.number!==30)continue;
    for(const value of f.options?f.options.map(o=>o[0]):[f.min,f.max])
      variants.push({...defaults,[f.key]:value});
  }
  if(model.number===25)for(const angle1 of [0,40])for(const angle2 of [0,40])for(const phaseError of [-90,45,90])variants.push({...defaults,angle1,angle2,phaseError});
  for(const params of variants){
    try{validateParameters(model,params);}catch{continue;}
    const {parts,stages}=assemble(model,params),byId=new Map(parts.map(p=>[p.id,p]));
    applyDisassembly(stages,byId,1);
    const bodies=parts.filter(p=>p.group.scale.lengthSq()>0).map(p=>({
      id:p.id,box:new THREE.Box3().setFromObject(p.group).translate(p.offset),
      path:stages.map(s=>s.moves.find(m=>m.ids.includes(p.id))?.offset.toArray().join(',')||'_').join('/')
    }));
    for(let i=0;i<bodies.length;i++)for(let j=0;j<i;j++){
      const a=bodies[i],b=bodies[j];if(a.path===b.path)continue;
      assert.ok(!a.box.intersectsBox(b.box),model.id+' '+a.id+' / '+b.id+' '+JSON.stringify(params));
    }
    if(model.number===25||model.number===24)for(const move of stages.find(s=>s.title.includes('轴承杯')).moves){
      const p=byId.get(move.ids[0]),axis=new THREE.Vector3(0,Math.sign(p.shapes[0].position[1]),0).applyQuaternion(p.group.quaternion);
      assert.ok(move.offset.clone().normalize().dot(axis)>.99999);
    }
    if(model.number===32){
      assert.ok(stages[0].moves.every(m=>m.ids.every(id=>id==='outer-plate')));
      const chain=parts.filter(p=>/^chain\d+$/.test(p.id));
      for(const p of chain)assert.ok(p.offset.equals(byId.get('cassette').offset));
      assert.equal(byId.get('hanger').offset.length(),0);
    }
    for(const p of parts)p.group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  }
});
