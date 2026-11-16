import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../dist/assets/three.module.js';
import {fields,defaults,geometry,estimate,motion,threadRadius,threadMeshData,ANGULAR_SEGMENTS} from '../dist/vice/mechanics.mjs';
const close=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol,`${a} ≈ ${b}`),mod=(x,n)=>(x%n+n)%n;
test('single-start lead, signed travel and energy agree; zero RPM has no static thrust claim',()=>{
  const r=estimate(defaults);assert.equal(r.linearSpeed,2);assert.equal(r.advancePerTurn,4);assert.equal(r.pitch,4);assert.equal(r.starts,1);close(r.thrust,2748.893571891069);close(r.outputPower,r.thrust*Math.abs(r.linearSpeed)/1000);
  const reverse=estimate({...defaults,direction:-1});assert.equal(reverse.linearSpeed,-2);assert.equal(reverse.advancePerTurn,-4);assert.equal(reverse.thrust,r.thrust);
  const zero=estimate({...defaults,inputRPM:0});assert.equal(zero.thrust,null);assert.equal(zero.inputPower,0);assert.equal(zero.outputPower,0);
  assert.equal(Object.is(estimate({...defaults,inputRPM:0,direction:-1}).linearSpeed,-0),false);
  for(const [key,[,,min,max]] of Object.entries(fields))for(const value of [NaN,Infinity,min-.01,max+.01])assert.throws(()=>geometry({...defaults,[key]:value}));
  for(const direction of [0,2,-2,'1',true,NaN])assert.throws(()=>geometry({...defaults,direction}));
});
test('every allowed stroke retains full nut engagement and shared right-hand helix phase',()=>{
  for(const lead of [2,4,8])for(const screwDiameter of [20,24,36])for(const maxOpening of [20,100,140]){
    const p={...defaults,lead,screwDiameter,maxOpening},g=geometry(p);assert.ok(g.rootRadius>0);assert.ok(g.nutLength>=4*lead);
    for(const opening of [0,maxOpening/2,maxOpening]){
      assert.ok(g.threadStart+opening<=g.nutStart-lead+1e-9);assert.ok(g.threadEnd+opening>g.nutEnd);
      const angle=2*Math.PI*(opening-g.midOpening)/lead;
      for(let i=0;i<59;i++){
        const x=g.nutStart+g.nutLength*(i+.3)/59,theta=i*2.173;
        close(threadRadius(g,x-opening,theta-angle,g.midOpening),threadRadius(g,x,theta),1e-8);
      }
    }
    close(motion(p,60/p.inputRPM/.2).displacement,lead);
  }
});
const sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
function rayTriangle(x,theta,t){const o=[x,0,0],d=[0,Math.cos(theta),Math.sin(theta)],e1=sub(t[1],t[0]),e2=sub(t[2],t[0]),h=cross(d,e2),det=dot(e1,h);if(Math.abs(det)<1e-12)return Infinity;const q=sub(o,t[0]),u=dot(q,h)/det;if(u< -1e-6||u>1+1e-6)return Infinity;const k=cross(q,e1),v=dot(d,k)/det;if(v< -1e-6||u+v>1+1e-6)return Infinity;const radius=dot(e2,k)/det;return radius>0?radius:Infinity;}
function radialIndex(data,g){
  const bins=new Map(),step=g.lead/4;
  for(let k=0;k<data.indices.length;k+=3){
    const tri=data.indices.slice(k,k+3).map(i=>data.vertices.slice(3*i,3*i+3).map(Math.fround));
    if(Math.max(...tri.map(v=>v[0]))-Math.min(...tri.map(v=>v[0]))<1e-6)continue;
    if(data.kind==='nut'&&tri.some(v=>Math.hypot(v[1],v[2])>g.screwRadius+g.clearance+.01))continue;
    const xs=tri.map(v=>Math.floor((v[0]-data.start)/step)),angles=tri.map(v=>mod(Math.atan2(v[2],v[1]),2*Math.PI));if(Math.max(...angles)-Math.min(...angles)>Math.PI)for(let i=0;i<3;i++)if(angles[i]<Math.PI)angles[i]+=2*Math.PI;
    const a0=Math.floor(Math.min(...angles)/(2*Math.PI)*ANGULAR_SEGMENTS),a1=Math.floor(Math.max(...angles)/(2*Math.PI)*ANGULAR_SEGMENTS);
    for(let x=Math.min(...xs);x<=Math.max(...xs);x++)for(let a=a0;a<=a1;a++){const key=x+','+mod(a,ANGULAR_SEGMENTS);if(!bins.has(key))bins.set(key,[]);bins.get(key).push(tri);}
  }
  return (x,theta)=>{const xi=Math.floor((x-data.start)/step),ai=Math.floor(mod(theta,2*Math.PI)/(2*Math.PI)*ANGULAR_SEGMENTS);let r=Infinity;for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(const tri of bins.get((xi+i)+','+mod(ai+j,ANGULAR_SEGMENTS))||[])r=Math.min(r,rayTriangle(x,theta,tri));return r;};
}
test('actual Float32 production thread triangles stay separated at multiple translations and rotation phases',()=>{
  for(const lead of [2,4,8])for(const screwDiameter of [20,36])for(const maxOpening of [20,140]){
    const g=geometry({...defaults,lead,screwDiameter,maxOpening}),external=threadMeshData(g),internal=threadMeshData(g,{kind:'nut'}),outside=radialIndex(external,g),inside=radialIndex(internal,g);
    const openings=[0,maxOpening,maxOpening/2,...Array.from({length:13},(_,i)=>maxOpening/2+lead*(i/13-.5))];
    let minGap=Infinity;
    for(const opening of openings){const angle=2*Math.PI*(opening-g.midOpening)/lead;
      for(let i=0;i<17;i++)for(let j=0;j<19;j++){
        const x=g.nutStart+g.nutLength*(i+.371)/17,theta=(j+.217)*2*Math.PI/19,ext=outside(x-opening,theta-angle),int=inside(x,theta);
        assert.ok(Number.isFinite(ext)&&Number.isFinite(int),'closed radial thread surfaces');minGap=Math.min(minGap,int-ext);assert.ok(int-ext>.02,`thread collision ${lead}/${screwDiameter}/${maxOpening} gap ${int-ext}`);
      }
    }
    assert.ok(minGap<g.clearance+.01,'bore is genuinely threaded, not a large smooth cylinder');
    const half=threadMeshData(g,{kind:'nut',half:true});assert.ok(half.vertices.every(Number.isFinite));assert.ok(half.vertices.filter((_,i)=>i%3===2).every(z=>z<1e-5));
  }
});
const moduleUrl=path=>new URL(path,import.meta.url).href;
const source=(await readFile(new URL('../dist/vice/viewer.mjs',import.meta.url),'utf8')).replace("from 'three'",`from '${moduleUrl('../dist/assets/three.module.js')}'`).replace("import {OrbitControls} from '../assets/OrbitControls.js';",'const OrbitControls=class {};').replace("from './mechanics.mjs'",`from '${moduleUrl('../dist/vice/mechanics.mjs')}'`);
const {ViceViewer,steps}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function cpuViewer(){const v=Object.create(ViceViewer.prototype);Object.assign(v,{scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),renderer:{info:{memory:{geometries:0}}},parts:[],selected:'screw',amount:0,step:0,speed:1,labelsOn:false,housingMode:'open',onSelect(){},render(){},home(){},fitModel(){}});return v;}
test('production advance stops at either end, reverses without jumps, and throttles motion notices',()=>{
  const v=cpuViewer();v.build(defaults);assert.equal(v.jawOpening,50);let notices=0;v.onMotion=()=>notices++;
  v.setPlaying(true);const baseline=notices;for(let i=0;i<4;i++)v.advance(.02);assert.equal(notices,baseline);v.advance(.02);assert.equal(notices,baseline+1);close(v.jawOpening,50.04);
  v.advance(1000);assert.equal(v.jawOpening,100);assert.equal(v.playing,false);assert.equal(v.state().limit,'open');assert.equal(v.state().atLimit,true);v.setPlaying(true);assert.equal(v.playing,false);
  const root=v.root;v.build({...v.p,direction:-1});assert.equal(v.root,root);assert.equal(v.jawOpening,100);v.setPlaying(true);v.advance(.1);close(v.jawOpening,99.96);assert.equal(v.state().limit,null);
  v.advance(1000);assert.equal(v.jawOpening,0);assert.equal(v.playing,false);assert.equal(v.state().limit,'closed');close(v.state().screwTurns,-12.5);
  v.build({...v.p,direction:1,inputRPM:90,inputTorque:2,efficiency:.5});assert.equal(v.root,root);assert.equal(v.jawOpening,0);v.setPlaying(true);v.advance(.1);close(v.jawOpening,.12);
  v.build({...v.p,inputRPM:0});assert.equal(v.root,root);close(v.jawOpening,.12);assert.equal(v.playing,false);
  v.build({...v.p,lead:8});assert.notEqual(v.root,root);assert.equal(v.jawOpening,50);assert.equal(v.playing,false);v.restore();assert.equal(v.jawOpening,50);v.clearGeometry();
});
const overlap=(a,b)=>a.min.every((n,i)=>a.max[i]>b.min[i]+1e-5&&b.max[i]>n+1e-5);
test('production T-handle triangles have radial clearance from both guide rails over full stroke and rotation',()=>{
  const v=cpuViewer(),point=new THREE.Vector3();
  for(const [lead,screwDiameter,jawWidth,maxOpening] of [[2,20,40,20],[8,20,40,140],[2,36,120,140],[8,36,40,20],[4,24,80,100]]){
    v.build({...defaults,lead,screwDiameter,jawWidth,maxOpening});const handle=v.parts.find(p=>p.id==='handle'),guide=v.parts.find(p=>p.id==='guide');
    for(const opening of [0,maxOpening/2,maxOpening])for(let phase=0;phase<24;phase++){
      v.jawOpening=opening;v.updateMotion();for(const rotor of v.rotors)rotor.rotation.x=phase*Math.PI/12;v.scene.updateMatrixWorld(true);
      let handleRadius=0;handle.group.traverse(o=>{if(!o.isMesh)return;for(let i=0;i<o.geometry.attributes.position.count;i++){point.fromBufferAttribute(o.geometry.attributes.position,i).applyMatrix4(o.matrixWorld);handleRadius=Math.max(handleRadius,Math.hypot(point.y,point.z));}});
      guide.group.traverse(o=>{if(!o.isMesh)return;const b=new THREE.Box3().setFromObject(o),dy=b.min.y>0?b.min.y:b.max.y<0?-b.max.y:0,dz=b.min.z>0?b.min.z:b.max.z<0?-b.max.z:0;assert.ok(Math.hypot(dy,dz)-handleRadius>=1.99,'solid handle swept envelope / solid guide clearance');});
    }
  }v.clearGeometry();
});
test('real inner/outer mesh, housing modes, nine components and extreme exploded boxes',()=>{
  const v=cpuViewer();
  for(const [lead,screwDiameter,jawWidth,maxOpening] of [[2,20,40,20],[8,20,40,140],[2,36,120,140],[8,36,40,20],[4,24,80,100]]){
    v.build({...defaults,lead,screwDiameter,jawWidth,maxOpening});assert.equal(v.parts.length,9);assert.equal(v.selected,'screw');assert.equal(v.nutHalf.visible,true);assert.equal(v.nutFull.visible,false);
    assert.equal(v.screwBody.geometry.attributes.position.count,threadMeshData(v.g).vertices.length/3);assert.equal(v.nutFull.geometry.attributes.position.count,threadMeshData(v.g,{kind:'nut'}).vertices.length/3);
    v.setHousingMode('solid');assert.equal(v.nutFull.visible,true);assert.equal(v.nutHalf.visible,false);v.setHousingMode('transparent');assert.equal(v.nutFull.material.transparent,true);v.setHousingMode('hidden');assert.equal(v.parts.find(p=>p.id==='nut').group.visible,false);v.setHousingMode('open');
    v.explode(1);const parts=v.state().parts;for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++)assert.equal(overlap(parts[i],parts[j]),false,`${parts[i].id}/${parts[j].id} ${lead}/${screwDiameter}/${jawWidth}/${maxOpening}`);
    v.assembly(steps.length-1);assert.deepEqual(v.state().parts.map(p=>p.position),parts.map(p=>p.position));v.restore();
    assert.ok(v.movers.every(group=>group.position.x===maxOpening/2));assert.ok(v.rotors.every(group=>group.rotation.x===0));
  }
  v.clearGeometry();
});
