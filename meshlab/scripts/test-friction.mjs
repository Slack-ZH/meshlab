import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../dist/assets/three.module.js';
import {fields,defaults,estimate,geometry,motion} from '../dist/friction/mechanics.mjs';

const close=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<=tol,`${a} ≈ ${b}`);
test('default external contact reverses rotation and preserves contact velocity',()=>{
  const r=estimate(defaults),g=r.geometry;
  assert.equal(r.ratio,2);assert.equal(r.speedRatio,.5);assert.equal(r.driverRPM,60);assert.equal(r.drivenRPM,-30);
  close(r.surfaceSpeed,.37699111843077515);close(r.torqueCapacity,9.6);close(r.tractionDemand,1/.12);
  assert.equal(r.frictionLimit,80);assert.equal(r.tractionFeasible,true);assert.equal(r.contactState,'rolling');
  close(r.theoreticalOutputPower,Math.PI);close(g.centerDistance,180);
  close(g.contactPoint[0],g.driverCenter[0]+g.driverRadius);close(g.contactPoint[0],g.drivenCenter[0]-g.drivenRadius);
});
test('diameter sweeps remain tangent and equal in tangential speed',()=>{
  for(let driverDiameter=60;driverDiameter<=300;driverDiameter+=5)for(let drivenDiameter=60;drivenDiameter<=300;drivenDiameter+=5){
    const p={...defaults,driverDiameter,drivenDiameter},g=geometry(p),r=estimate(p),m=motion(p,2.7,1.3);
    close(g.drivenCenter[0]-g.driverCenter[0]-g.driverRadius-g.drivenRadius,0);
    close(r.driverRPM*g.driverRadius+r.drivenRPM*g.drivenRadius,0,1e-9);
    close(m.driver*g.driverRadius+m.driven*g.drivenRadius,0,1e-9);
    assert.ok(m.driver>0&&m.driven<0);
  }
});
test('traction boundary distinguishes demand from capacity and does not invent slip speed',()=>{
  const capacity=estimate(defaults).torqueCapacity;
  const boundary=estimate({...defaults,loadTorque:capacity}),over=estimate({...defaults,loadTorque:capacity+.01});
  assert.equal(boundary.tractionFeasible,true);assert.equal(over.tractionFeasible,false);assert.equal(over.contactState,'overload');
  assert.equal(over.drivenRPM,-30);assert.match(over.warning,/不代表实际/);
  const unloaded=estimate({...defaults,loadTorque:0});assert.equal(unloaded.tractionDemand,0);assert.equal(unloaded.utilization,0);assert.equal(unloaded.frictionLimit,80);
  close(estimate({...defaults,normalForce:400}).torqueCapacity,2*capacity);
  close(estimate({...defaults,frictionCoefficient:.8}).torqueCapacity,2*capacity);
});
test('zero speed has finite capacity but no motion or delivered steady power',()=>{
  const r=estimate({...defaults,inputRPM:0});
  assert.equal(r.drivenRPM,0);assert.equal(r.surfaceSpeed,0);assert.equal(r.theoreticalOutputPower,0);assert.equal(r.contactState,'stationary');
  assert.equal(motion({...defaults,inputRPM:0},500).driver,0);assert.ok(Object.values(r).filter(v=>typeof v==='number').every(Number.isFinite));
});
test('wheel width changes geometry without fabricating traction capacity',()=>{
  const a=estimate({...defaults,wheelWidth:15}),b=estimate({...defaults,wheelWidth:60});
  assert.notEqual(a.geometry.wheelWidth,b.geometry.wheelWidth);assert.equal(a.torqueCapacity,b.torqueCapacity);assert.equal(a.drivenRPM,b.drivenRPM);
});
test('invalid and nonfinite input fails before geometry creation',()=>{
  for(const [key,[,,min,max]] of Object.entries(fields))for(const value of [NaN,Infinity,-Infinity,min-1,max+1])assert.throws(()=>estimate({...defaults,[key]:value}),RangeError);
  assert.throws(()=>motion(defaults,-1));assert.throws(()=>motion(defaults,1,NaN));
});

// Exercise production meshes and their grouping without a WebGL context or a browser.
const moduleUrl=path=>new URL(path,import.meta.url).href;
const source=(await readFile(new URL('../dist/friction/viewer.mjs',import.meta.url),'utf8'))
  .replace("from 'three'",`from '${moduleUrl('../dist/assets/three.module.js')}'`)
  .replace("import {OrbitControls} from '../assets/OrbitControls.js';",'const OrbitControls=class {};')
  .replace("from '../assets/reference-stage.mjs'",`from '${moduleUrl('../dist/assets/reference-stage.mjs')}'`)
  .replace("from './mechanics.mjs'",`from '${moduleUrl('../dist/friction/mechanics.mjs')}'`);
const {FrictionViewer,steps}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function cpuViewer(){
  const v=Object.create(FrictionViewer.prototype);
  Object.assign(v,{scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),renderer:{info:{memory:{geometries:0}}},parts:[],selected:'driver-wheel',
    amount:0,step:0,speed:1,labelsOn:false,housingMode:'solid',onSelect(){},render(){},home(){},fitModel(){}});
  return v;
}
function overlaps(a,b){return a.min.every((n,i)=>a.max[i]>b.min[i]+1e-5&&b.max[i]>n+1e-5);}
test('all production exploded groups are finite and disjoint across boundary dimensions',()=>{
  const v=cpuViewer();
  for(const driverDiameter of [60,120,300])for(const drivenDiameter of [60,240,300])for(const wheelWidth of [15,32,60]){
    v.build({...defaults,driverDiameter,drivenDiameter,wheelWidth});assert.equal(v.parts.length,8);
    v.explode(1);const parts=v.state().parts;
    for(let i=0;i<parts.length;i++){
      assert.ok(parts[i].min.concat(parts[i].max).every(Number.isFinite));
      for(let j=i+1;j<parts.length;j++)assert.equal(overlaps(parts[i],parts[j]),false,`${parts[i].id} / ${parts[j].id}`);
    }
    for(const side of ['driver','driven']){
      const ordered=['support','shaft','wheel','collar'].map(suffix=>parts.find(p=>p.id===side+'-'+suffix));
      assert.ok(ordered.every(p=>p.position[0]===ordered[0].position[0]&&p.position[1]===0),'components share one exploded shaft line');
      for(let j=1;j<ordered.length;j++)assert.ok(ordered[j].min[2]-ordered[j-1].max[2]>=55-1e-5,'support/shaft/wheel/collar axial order');
    }
    v.assembly(steps.length-1);assert.deepEqual(v.state().parts.map(p=>p.position),parts.map(p=>p.position));
    v.restore();assert.ok(v.state().parts.every(p=>p.position.every(n=>n===0)));
  }
  v.clearGeometry();
});
test('operating controls reuse geometry; geometry controls rebuild and stop playback',()=>{
  const v=cpuViewer();v.build(defaults);const root=v.root;
  v.setPlaying(true);assert.equal(v.playing,true);
  v.build({...defaults,inputRPM:80,normalForce:300});assert.equal(v.root,root);assert.equal(v.playing,true);
  v.build({...defaults,inputRPM:0});assert.equal(v.root,root);assert.equal(v.playing,false);
  v.setPlaying(true);assert.equal(v.playing,false);
  v.build({...defaults,driverDiameter:200});assert.notEqual(v.root,root);assert.equal(v.playing,false);
  v.setHousingMode('open');assert.equal(v.state().parts.filter(p=>p.visible).length,6);
  v.setHousingMode('solid');assert.equal(v.state().parts.filter(p=>p.visible).length,8);
  const validRoot=v.root;assert.throws(()=>v.build({...defaults,driverDiameter:0}));assert.equal(v.root,validRoot);
  v.clearGeometry();
});
