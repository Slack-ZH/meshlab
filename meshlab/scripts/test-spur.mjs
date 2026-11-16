import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../dist/assets/three.module.js';
import {fields,defaults,estimate,geometry,motion,gearDimensions,gearOutline,halfToothAngle,PRESSURE_ANGLE} from '../dist/spur/mechanics.mjs';
const close=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<=tol,`${a} ≈ ${b}`);
test('standard 20/40 gear geometry, signed speed, torque and energy are consistent',()=>{
  const r=estimate(defaults),g=r.geometry;
  assert.equal(r.ratio,2);assert.equal(r.driverRPM,60);assert.equal(r.drivenRPM,-30);assert.equal(r.outputTorque,9.8);
  close(r.inputPower,10*Math.PI);close(r.outputPower,9.8*Math.PI);close(r.outputTorque*Math.abs(r.drivenRPM)*Math.PI/30,r.outputPower);
  assert.equal(g.driverRadius,30);assert.equal(g.drivenRadius,60);assert.equal(g.centerDistance,90);
  assert.equal(g.driverRootRadius,26.25);assert.equal(g.driverAddendumRadius,33);close(g.driverBaseRadius,30*Math.cos(PRESSURE_ANGLE));
  close(g.contactRatio,1.6351859635714583);assert.equal(g.driverPhase,0);close(g.drivenPhase,Math.PI+Math.PI/40);
});
test('every permitted tooth pair has equal base pitch and positive continuous contact ratio',()=>{
  for(let driverTeeth=18;driverTeeth<=60;driverTeeth++)for(let drivenTeeth=18;drivenTeeth<=80;drivenTeeth++){
    const p={...defaults,driverTeeth,drivenTeeth},g=geometry(p),m=motion(p,3.7,1.4);
    close(g.driverBaseRadius/driverTeeth,g.drivenBaseRadius/drivenTeeth);
    close(m.driver*driverTeeth+m.driven*drivenTeeth,0,1e-9);
    assert.ok(g.contactRatio>1&&g.contactRatio<2);assert.ok(g.shaftRadius<Math.min(g.driverRootRadius,g.drivenRootRadius));
  }
});
test('production outline has the requested tooth count, involute pitch thickness and full depth',()=>{
  for(let z=18;z<=80;z++){
    const g=gearDimensions(z,2.5),points=gearOutline(z,2.5),radii=points.map(([x,y])=>Math.hypot(x,y));
    let tips=0;for(let i=0;i<radii.length;i++)if(Math.abs(radii[i]-g.addendumRadius)<1e-8&&Math.abs(radii[(i+radii.length-1)%radii.length]-g.addendumRadius)>=1e-8)tips++;
    assert.equal(tips,z);close(Math.min(...radii),g.rootRadius);close(Math.max(...radii),g.addendumRadius);
    close(2*g.pitchRadius*halfToothAngle(g,g.pitchRadius),Math.PI*2.5/2);
    assert.ok(halfToothAngle(g,g.addendumRadius)>0);
  }
});
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const transform=(points,angle,cx)=>{const c=Math.cos(angle),s=Math.sin(angle);return points.map(([x,y])=>[cx+c*x-s*y,s*x+c*y]);};
function pointSegment(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy,t=d?Math.min(1,Math.max(0,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
function properIntersection(a,b,c,d){return cross(a,b,c)*cross(a,b,d)<-1e-16&&cross(c,d,a)*cross(c,d,b)<-1e-16;}
test('actual extrusion outlines stay in contact without tooth penetration over 3066 mesh phases',()=>{
  let worstGap=0;
  // The outline is linear in module, so m=1 covers all module scales.
  for(const z1 of [18,19,20,23,40,60])for(const z2 of [18,19,20,37,40,79,80]){
    const p={...defaults,driverTeeth:z1,drivenTeeth:z2,module:1},g=geometry(p),a0=gearOutline(z1,1),b0=gearOutline(z2,1);
    for(let k=0;k<73;k++){
      const phase=2*Math.PI/z1*k/73,a=transform(a0,phase,0),b=transform(b0,g.drivenPhase-phase*z1/z2,g.centerDistance);
      const ae=a.map((pt,i)=>[pt,a[(i+1)%a.length]]).filter(e=>Math.max(e[0][0],e[1][0])>g.centerDistance-g.drivenAddendumRadius-1e-8);
      const be=b.map((pt,i)=>[pt,b[(i+1)%b.length]]).filter(e=>Math.min(e[0][0],e[1][0])<g.driverAddendumRadius+1e-8);
      let gap=Infinity;
      for(const [p1,p2] of ae)for(const [q1,q2] of be){
        assert.equal(properIntersection(p1,p2,q1,q2),false,`penetration z=${z1}/${z2}, phase=${k}`);
        gap=Math.min(gap,pointSegment(p1,q1,q2),pointSegment(p2,q1,q2),pointSegment(q1,p1,p2),pointSegment(q2,p1,p2));
      }
      worstGap=Math.max(worstGap,gap);
      assert.ok(gap<.0004,`sampling clearance ${gap} m at z=${z1}/${z2}, phase=${k}`);
    }
  }
  assert.ok(worstGap>0,'polyline sampling leaves a measurable bounded approximation gap');
});
test('zero speed avoids efficiency-based static torque claims and width does not create power',()=>{
  const stopped=estimate({...defaults,inputRPM:0});assert.equal(stopped.outputTorque,null);assert.equal(stopped.outputPower,0);assert.equal(stopped.drivenRPM,0);assert.match(stopped.warning,/静态/);
  const thin=estimate({...defaults,faceWidth:8}),wide=estimate({...defaults,faceWidth:40});assert.equal(thin.outputPower,wide.outputPower);assert.equal(thin.outputTorque,wide.outputTorque);
  assert.equal(estimate({...defaults,inputTorque:0}).outputTorque,0);
});
test('invalid and noninteger parameters fail before constructing a mesh',()=>{
  for(const [key,[,,min,max]] of Object.entries(fields))for(const value of [NaN,Infinity,min-1,max+1])assert.throws(()=>estimate({...defaults,[key]:value}));
  assert.throws(()=>estimate({...defaults,driverTeeth:20.5}));assert.throws(()=>estimate({...defaults,drivenTeeth:18.1}));
});
const moduleUrl=path=>new URL(path,import.meta.url).href;
const source=(await readFile(new URL('../dist/spur/viewer.mjs',import.meta.url),'utf8'))
  .replace("from 'three'",`from '${moduleUrl('../dist/assets/three.module.js')}'`)
  .replace("import {OrbitControls} from '../assets/OrbitControls.js';",'const OrbitControls=class {};')
  .replace("from './mechanics.mjs'",`from '${moduleUrl('../dist/spur/mechanics.mjs')}'`);
const {SpurViewer,steps}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function cpuViewer(){const v=Object.create(SpurViewer.prototype);Object.assign(v,{scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),renderer:{info:{memory:{geometries:0}}},parts:[],selected:'driver-gear',amount:0,step:0,speed:1,labelsOn:false,housingMode:'solid',onSelect(){},render(){},home(){},fitModel(){}});return v;}
const overlap=(a,b)=>a.min.every((n,i)=>a.max[i]>b.min[i]+1e-5&&b.max[i]>n+1e-5);
test('production meshes use the checked profile, scale attachments and separate all exploded groups',()=>{
  const v=cpuViewer();
  for(const [driverTeeth,drivenTeeth,module] of [[18,18,1],[18,80,1],[60,18,1],[20,40,3],[60,80,5],[19,37,2.5]])for(const faceWidth of [8,20,40]){
    const p={...defaults,driverTeeth,drivenTeeth,module,faceWidth};v.build(p);assert.equal(v.parts.length,8);
    for(const [side,z] of [['driver',driverTeeth],['driven',drivenTeeth]]){
      const part=v.parts.find(p=>p.id===side+'-gear');let body;part.group.traverse(o=>{if(o.userData.gearTeeth)body=o;});
      const outline=gearOutline(z,module);assert.equal(body.userData.gearTeeth,z);assert.equal(body.userData.profileVertices,outline.length);
      const attribute=body.geometry.getAttribute('position'),xy=new Set();
      for(let i=0;i<attribute.count;i++)xy.add(attribute.getX(i).toFixed(3)+','+attribute.getY(i).toFixed(3));
      // Compare a deterministic spread of points with the actual extrusion's float coordinates.
      for(let i=0;i<outline.length;i+=Math.max(1,Math.floor(outline.length/50)))assert.ok(xy.has(Math.fround(outline[i][0]).toFixed(3)+','+Math.fround(outline[i][1]).toFixed(3)));
      const hubLimit=v.g[side+'RootRadius'];assert.ok(v.g.shaftRadius*2<hubLimit);
    }
    v.rotations={driver:.23,driven:-.23*driverTeeth/drivenTeeth};v.updateMotion();
    for(const {group,side} of v.spinGroups)close(group.rotation.z,v.g[side+'Phase']+v.rotations[side]);
    v.explode(1);const parts=v.state().parts;
    for(let i=0;i<parts.length;i++){assert.ok(parts[i].min.concat(parts[i].max).every(Number.isFinite));for(let j=i+1;j<parts.length;j++)assert.equal(overlap(parts[i],parts[j]),false);}
    for(const side of ['driver','driven']){
      const ordered=['support','shaft','gear','collar'].map(suffix=>parts.find(p=>p.id===side+'-'+suffix));
      assert.ok(ordered.every(p=>p.position[0]===ordered[0].position[0]&&p.position[1]===0));
      for(let j=1;j<ordered.length;j++)assert.ok(ordered[j].min[2]-ordered[j-1].max[2]>=55-1e-5);
    }
    v.assembly(steps.length-1);assert.deepEqual(v.state().parts.map(p=>p.position),parts.map(p=>p.position));v.restore();assert.ok(v.state().parts.every(p=>p.position.every(n=>n===0)));
  }
  v.clearGeometry();
});
test('operating updates retain meshes and tooth/module/width updates rebuild while stopped',()=>{
  const v=cpuViewer();v.build(defaults);const root=v.root;v.setPlaying(true);
  v.build({...defaults,inputRPM:80,inputTorque:8,efficiency:.9});assert.equal(v.root,root);assert.equal(v.playing,true);
  v.build({...defaults,inputRPM:0});assert.equal(v.root,root);assert.equal(v.playing,false);
  for(const patch of [{driverTeeth:30},{drivenTeeth:23},{module:4},{faceWidth:30}]){const previous=v.root;v.build({...defaults,...patch});assert.notEqual(v.root,previous);assert.equal(v.playing,false);}
  const validRoot=v.root;assert.throws(()=>v.build({...defaults,driverTeeth:15}));assert.equal(v.root,validRoot);v.clearGeometry();
});
