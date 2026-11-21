import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../dist/assets/three.module.js';
import {fields,defaults,geometry,estimate,motion,beltSample,sampleProjected,beltMeshData} from '../dist/belt/mechanics.mjs';
const close=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol,`${a} ≈ ${b}`);
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
test('open/crossed wrap and length match independent tangent geometry reference cases',()=>{
  const equal={...defaults,driverDiameter:120,drivenDiameter:120,centerDistance:360,crossed:false},open=estimate(equal);
  close(open.projectedBeltLength,720+120*Math.PI);assert.equal(open.driverWrapDeg,180);assert.equal(open.drivenWrapDeg,180);assert.equal(open.drivenRPM,60);
  const r=estimate(defaults),beta=Math.asin(150/360);
  close(r.driverWrapDeg,180+2*beta*180/Math.PI);close(r.driverWrapDeg,r.drivenWrapDeg);close(r.projectedBeltLength,2*Math.sqrt(360**2-150**2)+150*(Math.PI+2*beta));
  assert.equal(r.drivenRPM,-40);assert.equal(r.outputTorque,7.125);close(r.outputPower,r.outputTorque*Math.abs(r.drivenRPM)*Math.PI/30);
  close(r.beltSpeed,Math.PI*.12);assert.ok(r.spatialCenterlineLength>r.projectedBeltLength);
  assert.equal(estimate({...defaults,crossed:false}).drivenRPM,40);
});
test('path is closed with continuous tangent and material frame at all pulley junctions',()=>{
  for(const crossed of [true,false])for(const [driverDiameter,drivenDiameter] of [[60,240],[200,60],[120,180]]){
    const g=geometry({...defaults,crossed,driverDiameter,drivenDiameter,beltWidth:36,centerDistance:260});
    for(const s of [0,g.tangentLength,g.tangentLength+g.drivenRadius*g.drivenWrap,2*g.tangentLength+g.drivenRadius*g.drivenWrap]){
      const a=sampleProjected(g,s-1e-6),b=sampleProjected(g,s+1e-6);
      assert.ok(distance(a.position,b.position)<3e-6);assert.ok(distance(a.tangent,b.tangent)<1e-5);assert.ok(distance(a.width,b.width)<1e-5);
    }
    if(crossed){const a=sampleProjected(g,g.tangentLength*g.crossingFraction),b=sampleProjected(g,g.tangentLength+g.drivenRadius*g.drivenWrap+g.tangentLength*(1-g.crossingFraction));close(a.position[0],b.position[0]);close(a.position[1],b.position[1]);assert.ok(a.position[2]-b.position[2]>g.beltThickness);close(Math.abs(a.width[2]),0);close(Math.abs(b.width[2]),0);}
  }
});
test('spatial marker distance stays uniform on both asymmetric spans and wraps',()=>{
  for(const crossed of [true,false])for(const [driverDiameter,drivenDiameter,centerDistance,beltWidth] of [[60,240,260,36],[200,60,260,36],[60,60,600,36],[120,180,360,20]]){
    const g=geometry({...defaults,crossed,driverDiameter,drivenDiameter,centerDistance,beltWidth});
    for(let i=0;i<700;i++){
      const s=i*g.spatialCenterlineLength/700,a=beltSample(g,s),b=beltSample(g,s+.01);close(distance(a.position,b.position),.01,1e-7);
      close(Math.hypot(...a.tangent),1);close(Math.hypot(...a.width),1);close(a.tangent.reduce((sum,v,j)=>sum+v*a.width[j],0),0);
    }
    close(distance(beltSample(g,-1).position,beltSample(g,g.spatialCenterlineLength-1).position),0);
  }
});
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function segmentTriangle(a,b,tri){
  const dir=sub(b,a),e1=sub(tri[1],tri[0]),e2=sub(tri[2],tri[0]),h=cross(dir,e2),det=dot(e1,h);if(Math.abs(det)<1e-9)return false;
  const inv=1/det,s=sub(a,tri[0]),u=inv*dot(s,h);if(u< -1e-8||u>1+1e-8)return false;
  const q=cross(s,e1),v=inv*dot(dir,q);if(v< -1e-8||u+v>1+1e-8)return false;
  const t=inv*dot(e2,q);return t>1e-8&&t<1-1e-8;
}
function triangles(data){return Array.from({length:data.indices.length/3},(_,i)=>{const points=data.indices.slice(i*3,i*3+3).map(index=>data.vertices.slice(index*3,index*3+3).map(Math.fround));return {points,section:data.sections[Math.floor(data.indices[i*3]/4)],min:[0,1,2].map(j=>Math.min(...points.map(p=>p[j]))),max:[0,1,2].map(j=>Math.max(...points.map(p=>p[j])))};});}
function intersect(a,b){if(a.min.some((v,i)=>v>b.max[i]+1e-8||b.min[i]>a.max[i]+1e-8))return false;for(let i=0;i<3;i++)if(segmentTriangle(a.points[i],a.points[(i+1)%3],b.points)||segmentTriangle(b.points[i],b.points[(i+1)%3],a.points))return true;return false;}
function clipZ(poly,z,lower){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],insideA=lower?a[2]>=z:a[2]<=z,insideB=lower?b[2]>=z:b[2]<=z;if(insideA)out.push(a);if(insideA!==insideB){const t=(z-a[2])/(b[2]-a[2]);out.push(a.map((v,j)=>v+t*(b[j]-v)));}}return out;}
function radialMinimum(poly,cx){
  if(!poly.length)return Infinity;let inside=false,min=Infinity;
  for(let i=0;i<poly.length;i++){
    const a=[poly[i][0]-cx,poly[i][1]],b=[poly[(i+1)%poly.length][0]-cx,poly[(i+1)%poly.length][1]],dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,-(a[0]*dx+a[1]*dy)/d)):0;
    min=Math.min(min,Math.hypot(a[0]+t*dx,a[1]+t*dy));if((a[1]>0)!==(b[1]>0)&&0<(b[0]-a[0])*(-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside?0:min;
}
test('production belt faces neither intersect across branches nor penetrate either pulley at 54 extreme configurations',()=>{
  for(const driverDiameter of [60,120,200])for(const drivenDiameter of [60,180,240])for(const centerDistance of [260,360,600])for(const beltWidth of [8,36]){
    const g=geometry({...defaults,driverDiameter,drivenDiameter,centerDistance,beltWidth}),data=beltMeshData(g),faces=triangles(data);
    const first=faces.filter(t=>t.section==='span1'),second=faces.filter(t=>t.section==='span2');
    for(const a of first)for(const b of second)assert.equal(intersect(a,b),false,`belt crossing ${driverDiameter}/${drivenDiameter}/${centerDistance}/${beltWidth}`);
    for(const face of faces)for(const side of ['driver','driven']){
      const clipped=clipZ(clipZ(face.points,-g.pulleyWidth/2,true),g.pulleyWidth/2,false);
      assert.ok(radialMinimum(clipped,g[side+'Center'][0])>=g[side+'PulleyRadius']-1e-4,`belt enters ${side} ${driverDiameter}/${drivenDiameter}/${centerDistance}/${beltWidth}`);
    }
  }
});
test('zero speed and invalid inputs do not create undefined power or static efficiency claims',()=>{
  const r=estimate({...defaults,inputRPM:0});assert.equal(r.outputTorque,null);assert.equal(r.inputPower,0);assert.equal(r.outputPower,0);assert.equal(r.drivenRPM,0);
  for(const [key,[,,min,max]] of Object.entries(fields))for(const value of [NaN,Infinity,min-1,max+1])assert.throws(()=>estimate({...defaults,[key]:value}));
  assert.throws(()=>estimate({...defaults,crossed:'true'}));
});
const moduleUrl=path=>new URL(path,import.meta.url).href;
const source=(await readFile(new URL('../dist/belt/viewer.mjs',import.meta.url),'utf8')).replace("from '../legacy-disassembly.mjs'",`from '${new URL('../dist/legacy-disassembly.mjs',import.meta.url).href}'`)
  .replace("from 'three'",`from '${moduleUrl('../dist/assets/three.module.js')}'`).replace("import {OrbitControls} from '../assets/OrbitControls.js';",'const OrbitControls=class {};').replace("from './mechanics.mjs'",`from '${moduleUrl('../dist/belt/mechanics.mjs')}'`);
const {BeltViewer,steps}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function cpuViewer(){const v=Object.create(BeltViewer.prototype);Object.assign(v,{scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),renderer:{info:{memory:{geometries:0}}},parts:[],selected:'belt',amount:0,step:0,speed:1,labelsOn:false,housingMode:'solid',onSelect(){},render(){},home(){},fitModel(){}});return v;}
const overlap=(a,b)=>a.min.every((n,i)=>a.max[i]>b.min[i]+1e-5&&b.max[i]>n+1e-5);
test('production RAF advancement and belt markers match signed rotation and no-slip wrap motion',()=>{
  const v=cpuViewer();
  for(const crossed of [true,false]){
    const p={...defaults,crossed};v.build(p);v.setSpeed(1.4);v.setPlaying(true);v.advance(.02);v.advance(.03);const m=motion(p,.05,1.4);
    close(v.rotations.driver,m.driver);close(v.rotations.driven,m.driven);close(v.beltTravel,m.beltTravel);assert.ok(v.rotations.driver>0);
    for(const {group,side} of v.spinGroups)close(group.rotation.z,v.rotations[side]);
    const g=v.g,positions=[g.spatialSpanLength+g.drivenRadius*g.drivenWrap/2,2*g.spatialSpanLength+g.drivenRadius*g.drivenWrap+g.driverRadius*g.driverWrap/2];
    for(const [index,s] of positions.entries()){
      const side=index?'driver':'driven',a=beltSample(g,s),b=beltSample(g,s+.01),center=g[side+'Center'],va=[a.position[0]-center[0],a.position[1]],vb=[b.position[0]-center[0],b.position[1]];
      const angle=Math.atan2(va[0]*vb[1]-va[1]*vb[0],va[0]*vb[0]+va[1]*vb[1]);close(angle,(side==='driver'?-1:crossed?1:-1)*.01/g[side+'Radius']);
    }
    assert.ok(v.beltMarkers.every(marker=>marker.position.toArray().every(Number.isFinite)));
  }
  v.clearGeometry();
});
test('production eleven-part mesh preserves selected belt, rebuilds on mode/geometry and explodes without overlap',()=>{
  const v=cpuViewer();
  for(const crossed of [true,false])for(const [driverDiameter,drivenDiameter,centerDistance,beltWidth] of [[60,240,260,36],[200,60,600,8],[120,180,360,20]]){
    const p={...defaults,crossed,driverDiameter,drivenDiameter,centerDistance,beltWidth};v.build(p);assert.equal(v.parts.length,11);assert.equal(v.selected,'belt');
    const data=beltMeshData(v.g);assert.equal(v.beltBody.geometry.getAttribute('position').count,data.vertices.length/3);assert.equal(v.beltBody.geometry.index.count,data.indices.length);
    v.explode(1);const parts=v.state().parts;for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++)assert.equal(overlap(parts[i],parts[j]),false);
    v.assembly(steps.length-1);assert.deepEqual(v.state().parts.map(p=>p.position),parts.map(p=>p.position));v.restore();
  }
  const root=v.root;v.setPlaying(true);v.build({...v.p,inputRPM:80,inputTorque:8,efficiency:.8});assert.equal(v.root,root);assert.equal(v.playing,true);
  v.build({...v.p,crossed:!v.p.crossed});assert.notEqual(v.root,root);assert.equal(v.playing,false);assert.equal(v.selected,'belt');
  v.build({...v.p,inputRPM:0});v.setPlaying(true);assert.equal(v.playing,false);v.clearGeometry();
});
