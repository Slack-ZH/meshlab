import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../dist/assets/three.module.js';
import {fields,defaults,geometry,estimate,motion,beltSample,pitchPathLength,pulleyOutline,toothPolygon,toothMeshData,beltMeshData,PITCH,PROFILE_SAMPLES} from '../dist/timing/mechanics.mjs';
const close=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol,`${a} ≈ ${b}`);
const mod=(x,n)=>(x%n+n)%n;
test('integer closed belt and exact tangent geometry: all 2709 tooth pairs at both centre limits',()=>{
  for(let driverTeeth=18;driverTeeth<=60;driverTeeth++)for(let drivenTeeth=18;drivenTeeth<=80;drivenTeeth++)for(const centerDistance of [150,360]){
    const p={...defaults,driverTeeth,drivenTeeth,centerDistance},g=geometry(p);
    assert.ok(Number.isInteger(g.beltTeeth));close(g.pitchLength,g.beltTeeth*5);close(pitchPathLength(g.driverRadius,g.drivenRadius,g.centerDistance),g.pitchLength,1e-9);
    assert.ok(Math.abs(g.centerDistanceError)<1.34);assert.ok(g.centerDistance>g.driverRadius+g.drivenRadius+2);
    close(g.driverRadius*2*Math.PI,driverTeeth*5);close(g.drivenRadius*2*Math.PI,drivenTeeth*5);
    const r=estimate(p);close(r.drivenRPM,60*driverTeeth/drivenTeeth);close(r.outputPower,r.outputTorque*r.drivenRPM*Math.PI/30);
    assert.ok(Math.min(r.driverEngagedTeeth,r.drivenEngagedTeeth)>6);
  }
  const equal=geometry({...defaults,driverTeeth:20,drivenTeeth:20,centerDistance:180});close(equal.pitchLength,460);close(equal.centerDistance,180);
  const d=estimate(defaults);assert.equal(d.ratio,2);assert.equal(d.drivenRPM,30);assert.equal(d.outputTorque,3.84);close(d.beltSpeed,.1);
});
test('tooth lattice closes and aligns both complete pulley wraps at every motion phase',()=>{
  for(const [driverTeeth,drivenTeeth] of [[18,18],[18,80],[60,18],[19,37],[23,40],[59,79],[20,40]]){
    const p={...defaults,driverTeeth,drivenTeeth},g=geometry(p);
    for(let phase=0;phase<37;phase++){
      const m=motion(p,phase*.137,1.3),travel=m.beltTravel;
      for(let i=0;i<g.beltTeeth;i++){
        const f=beltSample(g,i*5+travel);if(!f.segment.endsWith('-wrap'))continue;
        const side=f.segment.startsWith('driver')?'driver':'driven',c=g[side+'Center'],angle=Math.atan2(f.position[1],f.position[0]-c[0]);
        const phaseError=mod((angle-g[side+'Phase']-m[side])*p[side+'Teeth'],2*Math.PI);assert.ok(Math.min(phaseError,2*Math.PI-phaseError)<1e-9);
      }
      const first=beltSample(g,travel),last=beltSample(g,travel+g.beltTeeth*5);close(Math.hypot(...first.position.map((v,j)=>v-last.position[j])),0);
    }
  }
});
function orient(a,b,c){return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
function crosses(a,b,c,d){
  if(Math.max(a[0],b[0])<Math.min(c[0],d[0])||Math.max(c[0],d[0])<Math.min(a[0],b[0])||Math.max(a[1],b[1])<Math.min(c[1],d[1])||Math.max(c[1],d[1])<Math.min(a[1],b[1]))return false;
  return orient(a,b,c)*orient(a,b,d)<-1e-12&&orient(c,d,a)*orient(c,d,b)<-1e-12;
}
function radiusAt(outline,angle){
  const count=outline.length,teeth=count/PROFILE_SAMPLES,step=2*Math.PI/count,index=Math.floor(mod(angle+Math.PI/teeth,2*Math.PI)/step),a=outline[index],b=outline[(index+1)%count],dx=Math.cos(angle),dy=Math.sin(angle),ex=b[0]-a[0],ey=b[1]-a[1];
  return (a[0]*ey-a[1]*ex)/(dx*ey-dy*ex);
}
function assertSeparated(tooth,outline,teeth,label){
  for(const q of tooth)assert.ok(Math.hypot(...q)>radiusAt(outline,Math.atan2(q[1],q[0]))-1e-5,'tooth vertex penetrates '+label);
  const middle=tooth.reduce((a,q)=>[a[0]+q[0]/4,a[1]+q[1]/4],[0,0]),slot=Math.round(Math.atan2(middle[1],middle[0])/(2*Math.PI/teeth));
  for(let sector=slot-1;sector<=slot+1;sector++)for(let j=0;j<PROFILE_SAMPLES;j++){
    const index=mod(sector*PROFILE_SAMPLES+j,outline.length),a=outline[index],b=outline[(index+1)%outline.length];
    for(let k=0;k<4;k++)assert.equal(crosses(a,b,tooth[k],tooth[(k+1)%4]),false,'tooth edge intersects '+label);
  }
}
test('actual extruded groove outlines clear rigid belt tooth faces throughout entry, wrap and exit',()=>{
  for(const [driverTeeth,drivenTeeth,centerDistance] of [[18,18,150],[18,80,150],[60,18,150],[19,37,150],[23,40,360],[59,79,360],[20,40,180],[60,80,150]]){
    const p={...defaults,driverTeeth,drivenTeeth,centerDistance},g=geometry(p),outlines={driver:pulleyOutline(driverTeeth).map(q=>q.map(Math.fround)),driven:pulleyOutline(drivenTeeth).map(q=>q.map(Math.fround))};
    for(let phase=0;phase<65;phase++){
      const travel=5*phase/65,rot={driver:-travel/g.driverRadius,driven:-travel/g.drivenRadius};
      for(let i=0;i<g.beltTeeth;i++){
        const poly=toothPolygon(g,i*5+travel);
        for(const side of ['driver','driven']){
          const cx=g[side+'Center'][0],R=g[side+'Radius'];if(Math.min(...poly.map(q=>Math.hypot(q[0]-cx,q[1])))>R+.2)continue;
          const angle=-(g[side+'Phase']+rot[side]),co=Math.cos(angle),si=Math.sin(angle),local=poly.map(([x,y])=>[(x-cx)*co-y*si,(x-cx)*si+y*co]);
          assertSeparated(local,outlines[side],p[side+'Teeth'],`${side} ${driverTeeth}/${drivenTeeth}/${centerDistance} phase ${phase}`);
        }
      }
    }
  }
});
test('validation enforces discrete wheel teeth and zero speed avoids a static torque claim',()=>{
  for(const [key,[,,min,max]] of Object.entries(fields))for(const value of [NaN,Infinity,min-1,max+1])assert.throws(()=>geometry({...defaults,[key]:value}));
  for(const key of ['driverTeeth','drivenTeeth'])assert.throws(()=>geometry({...defaults,[key]:20.5}));
  const r=estimate({...defaults,inputRPM:0});assert.equal(r.drivenRPM,0);assert.equal(r.inputPower,0);assert.equal(r.outputPower,0);assert.equal(r.outputTorque,null);
});
const moduleUrl=path=>new URL(path,import.meta.url).href;
const source=(await readFile(new URL('../dist/timing/viewer.mjs',import.meta.url),'utf8')).replace("from 'three'",`from '${moduleUrl('../dist/assets/three.module.js')}'`).replace("import {OrbitControls} from '../assets/OrbitControls.js';",'const OrbitControls=class {};').replace("from './mechanics.mjs'",`from '${moduleUrl('../dist/timing/mechanics.mjs')}'`);
const {TimingViewer,steps}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function cpuViewer(){const v=Object.create(TimingViewer.prototype);Object.assign(v,{scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),renderer:{info:{memory:{geometries:0}}},parts:[],selected:'belt',amount:0,step:0,speed:1,labelsOn:false,housingMode:'solid',onSelect(){},render(){},home(){},fitModel(){}});return v;}
const overlap=(a,b)=>a.min.every((n,i)=>a.max[i]>b.min[i]+1e-5&&b.max[i]>n+1e-5);
test('production meshes have actual tooth counts and production RAF shares exact motion and phases',()=>{
  const v=cpuViewer();v.build(defaults);assert.equal(v.beltTeeth.count,v.g.beltTeeth);
  const td=toothMeshData(defaults.beltWidth);assert.equal(v.beltTeeth.geometry.index.count,td.indices.length);const bd=beltMeshData(v.g);assert.equal(v.beltBody.geometry.index.count,bd.indices.length);
  const wheels=[];v.root.traverse(o=>{if(o.userData.pulleyTeeth)wheels.push(o);});assert.deepEqual(wheels.map(o=>o.userData.pulleyTeeth),[20,40]);
  v.setSpeed(1.4);v.setPlaying(true);v.advance(.02);v.advance(.03);const m=motion(defaults,.05,1.4);close(v.rotations.driver,m.driver);close(v.rotations.driven,m.driven);close(v.beltTravel,m.beltTravel);
  for(const {group,side} of v.spinGroups)close(group.rotation.z,v.g[side+'Phase']+m[side]);
  const matrix=new THREE.Matrix4(),vertex=new THREE.Vector3();
  for(let i=0;i<v.beltTeeth.count;i++){
    v.beltTeeth.getMatrixAt(i,matrix);const f=beltSample(v.g,i*5+v.beltTravel);close(new THREE.Vector3().setFromMatrixPosition(matrix).distanceTo(new THREE.Vector3(...f.position)),0,1e-5);
    const poly=toothPolygon(v.g,i*5+v.beltTravel);for(let j=0;j<4;j++){vertex.fromBufferAttribute(v.beltTeeth.geometry.attributes.position,j).applyMatrix4(matrix);close(vertex.x,poly[j][0],1e-5);close(vertex.y,poly[j][1],1e-5);}
  }
  v.clearGeometry();
});
test('production nine-part assembly and all final exploded boxes stay disjoint at size extremes',()=>{
  const v=cpuViewer();
  for(const [driverTeeth,drivenTeeth,centerDistance,beltWidth] of [[18,80,150,30],[60,18,360,8],[20,40,180,16],[60,80,150,30],[19,37,360,8]]){
    v.build({...defaults,driverTeeth,drivenTeeth,centerDistance,beltWidth});assert.equal(v.parts.length,9);assert.equal(v.selected,'belt');
    v.explode(1);const parts=v.state().parts;for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++)assert.equal(overlap(parts[i],parts[j]),false,parts[i].id+' / '+parts[j].id);
    v.assembly(steps.length-1);assert.deepEqual(v.state().parts.map(p=>p.position),parts.map(p=>p.position));v.restore();
  }
  const root=v.root;v.setPlaying(true);v.build({...v.p,inputRPM:80,inputTorque:8,efficiency:.8});assert.equal(v.root,root);assert.equal(v.playing,true);
  v.build({...v.p,driverTeeth:21});assert.notEqual(v.root,root);assert.equal(v.playing,false);v.build({...v.p,inputRPM:0});v.setPlaying(true);assert.equal(v.playing,false);v.clearGeometry();
});
