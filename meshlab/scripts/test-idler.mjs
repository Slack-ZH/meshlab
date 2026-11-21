import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../dist/assets/three.module.js';
import {defaults,fields,estimate,geometry,motion,gearOutline} from '../dist/idler/mechanics.mjs';
import {gearOutline as approvedOutline} from '../dist/spur/mechanics.mjs';
const close=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<=tol,`${a} ≈ ${b}`);
test('three-wheel train has two meshes, same output direction and compounded mesh efficiency',()=>{
  const r=estimate(defaults),g=r.geometry;
  assert.equal(r.meshCount,2);assert.equal(r.direction,'same');assert.equal(r.ratio,2);assert.equal(r.idlerRPM,-40);assert.equal(r.drivenRPM,30);
  close(r.totalEfficiency,.9604);close(r.outputTorque,9.604);close(r.outputPower,r.outputTorque*r.drivenRPM*Math.PI/30);
  assert.equal(g.centerDistance12,75);assert.equal(g.centerDistance23,105);assert.equal(g.centerDistance,180);assert.equal(g.centerDistance13,90);
  close(g.drivenPhase+g.idlerPhase*defaults.idlerTeeth/defaults.drivenTeeth,Math.PI+Math.PI/defaults.drivenTeeth);
  assert.equal(gearOutline,approvedOutline,'production shares the already reviewed involute outline');
});
test('idler size changes its speed and spacing without changing the end ratio or output torque',()=>{
  const base=estimate(defaults);
  for(let idlerTeeth=18;idlerTeeth<=60;idlerTeeth++){
    const p={...defaults,idlerTeeth},r=estimate(p),m=motion(p,2.7,1.6),g=r.geometry;
    assert.equal(r.ratio,base.ratio);assert.equal(r.drivenRPM,base.drivenRPM);assert.equal(r.outputTorque,base.outputTorque);
    close(r.idlerRPM,-defaults.inputRPM*defaults.driverTeeth/idlerTeeth);close(g.centerDistance,90+3*idlerTeeth);
    close(m.driver*defaults.driverTeeth+m.idler*idlerTeeth,0,1e-9);close(m.idler*idlerTeeth+m.driven*defaults.drivenTeeth,0,1e-9);
    assert.ok(r.minimumContactRatio>1);assert.equal(r.contactRatios.length,2);
  }
});
test('direct mode reverses output, uses one efficiency factor and ignores invalid parked idler values',()=>{
  const direct=estimate({...defaults,useIdler:false});
  assert.equal(direct.drivenRPM,-30);assert.equal(direct.idlerRPM,null);assert.equal(direct.meshCount,1);assert.equal(direct.direction,'opposite');
  assert.equal(direct.totalEfficiency,.98);assert.equal(direct.outputTorque,9.8);assert.equal(direct.geometry.centerDistance,90);
  for(const idlerTeeth of [NaN,undefined,Infinity,-1,18.5,1000]){
    const p={...defaults,useIdler:false,idlerTeeth},r=estimate(p);assert.deepEqual(r,direct);assert.equal(motion(p,1).idler,null);
    assert.equal(r.geometry.idlerRadius,null);assert.equal(r.geometry.idlerCenter,null);assert.equal(r.geometry.centerDistance12,null);
    assert.throws(()=>estimate({...p,useIdler:true}));
  }
});
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const transform=(points,angle,cx)=>{const c=Math.cos(angle),s=Math.sin(angle);return points.map(([x,y])=>[cx+c*x-s*y,s*x+c*y]);};
function pointSegment(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy,t=d?Math.min(1,Math.max(0,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
function checkMesh(a,b,cxA,cxB,rA,rB,label){
  const ae=a.map((pt,i)=>[pt,a[(i+1)%a.length]]).filter(e=>Math.max(e[0][0],e[1][0])>cxB-rB-1e-8);
  const be=b.map((pt,i)=>[pt,b[(i+1)%b.length]]).filter(e=>Math.min(e[0][0],e[1][0])<cxA+rA+1e-8);
  let gap=Infinity;
  for(const [p,q] of ae)for(const [r,s] of be){
    assert.ok(!(cross(p,q,r)*cross(p,q,s)<-1e-16&&cross(r,s,p)*cross(r,s,q)<-1e-16),label+' tooth crossing');
    gap=Math.min(gap,pointSegment(p,r,s),pointSegment(q,r,s),pointSegment(r,p,q),pointSegment(s,p,q));
  }
  assert.ok(gap<.0004,label+' sampling gap '+gap);
}
test('both production gear meshes maintain correct phase and contact for odd/even idlers',()=>{
  const triples=[[18,18,18],[18,19,80],[60,19,18],[19,60,79],[20,30,40],[23,37,41],[60,60,80],[18,59,19]];
  for(const [driverTeeth,idlerTeeth,drivenTeeth] of triples)for(const useIdler of [true,false]){
    const p={...defaults,driverTeeth,idlerTeeth,drivenTeeth,useIdler,module:1},g=geometry(p);
    const outlines=Object.fromEntries(g.activeGearIds.map(id=>[id,gearOutline(p[id+'Teeth'],1)]));
    for(let k=0;k<89;k++){
      const driver=2*Math.PI/driverTeeth*k/89,rotations={driver,idler:-driver*driverTeeth/idlerTeeth,driven:(useIdler?1:-1)*driver*driverTeeth/drivenTeeth};
      const contours=Object.fromEntries(g.activeGearIds.map(id=>[id,transform(outlines[id],g[id+'Phase']+rotations[id],g[id+'Center'][0])]));
      for(let i=1;i<g.activeGearIds.length;i++){
        const left=g.activeGearIds[i-1],right=g.activeGearIds[i];
        checkMesh(contours[left],contours[right],g[left+'Center'][0],g[right+'Center'][0],g[left+'AddendumRadius'],g[right+'AddendumRadius'],`${driverTeeth}/${idlerTeeth}/${drivenTeeth} ${useIdler} ${left}-${right} ${k}`);
      }
    }
  }
});
test('zero speed and input validation keep stopped and active modes distinct',()=>{
  for(const useIdler of [true,false]){const r=estimate({...defaults,useIdler,inputRPM:0});assert.equal(r.outputTorque,null);assert.equal(r.inputPower,0);assert.equal(r.outputPower,0);assert.equal(r.drivenRPM,0);assert.equal(r.idlerRPM,useIdler?0:null);}
  for(const [key,[,,min,max]] of Object.entries(fields))for(const value of [NaN,Infinity,min-1,max+1])assert.throws(()=>estimate({...defaults,[key]:value}));
  for(const useIdler of ['false',null,0])assert.throws(()=>estimate({...defaults,useIdler}));
  assert.throws(()=>estimate({...defaults,driverTeeth:20.5}));assert.throws(()=>estimate({...defaults,idlerTeeth:30.5}));
});
const moduleUrl=path=>new URL(path,import.meta.url).href;
const source=(await readFile(new URL('../dist/idler/viewer.mjs',import.meta.url),'utf8'))
  .replace("from '../legacy-disassembly.mjs'",`from '${new URL('../dist/legacy-disassembly.mjs',import.meta.url).href}'`)
  .replace("from 'three'",`from '${moduleUrl('../dist/assets/three.module.js')}'`)
  .replace("import {OrbitControls} from '../assets/OrbitControls.js';",'const OrbitControls=class {};')
  .replace("from './mechanics.mjs'",`from '${moduleUrl('../dist/idler/mechanics.mjs')}'`);
const {IdlerViewer,steps}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function cpuViewer(){const v=Object.create(IdlerViewer.prototype);Object.assign(v,{scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),renderer:{info:{memory:{geometries:0}}},parts:[],selected:'driver-gear',amount:0,step:0,speed:1,labelsOn:false,housingMode:'solid',onSelect(){},render(){},home(){},fitModel(){}});return v;}
const overlap=(a,b)=>a.min.every((n,i)=>a.max[i]>b.min[i]+1e-5&&b.max[i]>n+1e-5);
test('production gears match checked profiles, scale attachments and explode into disjoint shaft columns',()=>{
  const v=cpuViewer();
  for(const [driverTeeth,idlerTeeth,drivenTeeth,module] of [[18,18,18,1],[18,19,80,1],[60,18,19,1],[20,30,40,3],[60,60,80,5],[19,37,41,2.5]])for(const useIdler of [true,false])for(const faceWidth of [8,40]){
    const p={...defaults,driverTeeth,idlerTeeth,drivenTeeth,module,useIdler,faceWidth};v.build(p);assert.equal(v.parts.length,useIdler?12:8);
    for(const side of v.g.activeGearIds){
      const part=v.parts.find(p=>p.id===side+'-gear');let body;part.group.traverse(o=>{if(o.userData.gearTeeth)body=o;});
      assert.equal(body.userData.gearTeeth,p[side+'Teeth']);assert.equal(body.userData.profileVertices,gearOutline(p[side+'Teeth'],module).length);
      assert.ok(v.g.shaftRadius*2<v.g[side+'RootRadius']);
    }
    v.rotations=motion(p,1.3,1.2);v.updateMotion();for(const {group,side} of v.spinGroups)close(group.rotation.z,v.g[side+'Phase']+v.rotations[side]);
    v.explode(1);const parts=v.state().parts;
    for(let i=0;i<parts.length;i++){assert.ok(parts[i].min.concat(parts[i].max).every(Number.isFinite));for(let j=i+1;j<parts.length;j++)assert.equal(overlap(parts[i],parts[j]),false);}
    for(const side of v.g.activeGearIds){const ordered=['support','shaft','gear','collar'].map(suffix=>parts.find(p=>p.id===side+'-'+suffix));assert.ok(ordered.every(p=>p.position[0]===ordered[0].position[0]&&p.position[1]===0));for(let j=1;j<ordered.length;j++)assert.ok(ordered[j].min[2]-ordered[j-1].max[2]>=55-1e-5);}
    v.assembly(steps.length-1);assert.deepEqual(v.state().parts.map(p=>p.position),parts.map(p=>p.position));v.restore();assert.ok(v.state().parts.every(p=>p.position.every(n=>n===0)));
  }
  v.clearGeometry();
});
test('mode switches replace 12/8/12 parts, clear invalid selections, and preserve valid direct geometry',()=>{
  const v=cpuViewer(),selections=[];v.onSelect=part=>selections.push(part.id);v.build(defaults);v.select('idler-gear');v.setPlaying(true);
  const oldRoot=v.root;const direct={...defaults,useIdler:false,idlerTeeth:NaN};v.build(direct);
  assert.notEqual(v.root,oldRoot);assert.equal(v.parts.length,8);assert.equal(v.playing,false);assert.equal(v.selected,'driver-gear');assert.equal(selections.at(-1),'driver-gear');assert.equal(v.state().rotations.idler,null);
  const directRoot=v.root;v.build({...direct,idlerTeeth:Infinity});assert.equal(v.root,directRoot);
  assert.throws(()=>v.build({...direct,useIdler:true}));assert.equal(v.root,directRoot);assert.equal(v.parts.length,8);
  v.build({...defaults,idlerTeeth:19});assert.equal(v.parts.length,12);assert.equal(v.playing,false);assert.equal(v.selected,'driver-gear');
  for(const selected of ['idler-shaft','idler-support','idler-collar']){v.select(selected);v.build({...defaults,useIdler:false});assert.equal(v.selected,'driver-gear');assert.equal(selections.at(-1),'driver-gear');v.build(defaults);}
  const operatingRoot=v.root;v.setPlaying(true);v.build({...defaults,inputRPM:80,inputTorque:8,meshEfficiency:.9});assert.equal(v.root,operatingRoot);assert.equal(v.playing,true);
  v.build({...defaults,inputRPM:0});assert.equal(v.root,operatingRoot);assert.equal(v.playing,false);
  const previous=v.root;v.build({...defaults,idlerTeeth:31});assert.notEqual(v.root,previous);assert.equal(v.playing,false);v.clearGeometry();
});
