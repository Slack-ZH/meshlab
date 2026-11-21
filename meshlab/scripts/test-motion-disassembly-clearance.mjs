import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../dist/assets/three.module.js';
import {models,defaultParameters} from '../dist/catalog/registry.mjs';
import {disassemblyParts,prepareDisassembly,applyDisassembly} from '../dist/catalog/disassembly.mjs';

const source=fs.readFileSync(new URL('../dist/catalog/geometry.mjs',import.meta.url),'utf8').replace("from 'three'",`from '${new URL('../dist/assets/three.module.js',import.meta.url).href}'`);
const {shapeMesh}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const by=n=>models.find(m=>m.number===n);
function scene(n,patch={},phase=0){
  const model=by(n),params={...defaultParameters(model),...patch},poses=model.sample(params,phase).poses;
  const parts=disassemblyParts(model,model.build(params).parts).map(p=>{
    const group=new THREE.Group(),pose=poses[p.poseSource||p.id]||{};
    group.position.fromArray(pose.position||p.position||[0,0,0]);group.rotation.set(...(pose.rotation||p.rotation||[0,0,0]));group.scale.fromArray(pose.scale||[1,1,1]);
    p.shapes.forEach(s=>group.add(shapeMesh(s)));group.updateMatrixWorld(true);
    return {...p,group,base:group.position.clone(),offset:new THREE.Vector3()};
  });
  const map=new Map(parts.map(p=>[p.id,p])),stages=prepareDisassembly(model,parts,params);
  return {params,parts,map,stages,at(progress){applyDisassembly(stages,map,progress);for(const p of parts){p.group.position.copy(p.base).add(p.offset);p.group.updateMatrixWorld(true);}},box(id){return new THREE.Box3().setFromObject(map.get(id).group);},dispose(){for(const p of parts)p.group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}};
}
const close=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
// Exact squared distance from a finite segment to an axis-aligned box. The
// squared distance is piecewise quadratic, with breaks at each box face.
function segmentBoxDistance(a,b,box){
  const d=b.clone().sub(a),cuts=[0,1];
  for(const k of ['x','y','z'])if(Math.abs(d[k])>1e-12)for(const v of [box.min[k],box.max[k]]){const t=(v-a[k])/d[k];if(t>0&&t<1)cuts.push(t);}
  cuts.sort((a,b)=>a-b);let best=Infinity;
  const value=t=>box.distanceToPoint(a.clone().addScaledVector(d,t));
  for(let i=1;i<cuts.length;i++){
    const lo=cuts[i-1],hi=cuts[i],mid=(lo+hi)/2;let aa=0,bb=0;
    for(const k of ['x','y','z']){const x=a[k]+mid*d[k],edge=x<box.min[k]?box.min[k]:x>box.max[k]?box.max[k]:null;if(edge!==null){aa+=d[k]**2;bb+=(a[k]-edge)*d[k];}}
    best=Math.min(best,value(lo),value(hi),value(aa?Math.max(lo,Math.min(hi,-bb/aa)):lo));
  }return best;
}

test('24/25 split half-caps leave an open pin corridor throughout fork/cross extraction',()=>{
  let configurations=0,sweeps=0;
  for(const n of [24,25])for(const angle of [0,25,40])for(const phase of [0,.6,Math.PI/2,2.7])for(const sizeOrError of n===24?[28,56]:[-90,0,90]){
    const s=scene(n,n===24?{angle,jointSize:sizeOrError}:{angle1:angle,angle2:40-angle,phaseError:sizeOrError,shaftLength:100},phase);configurations++;
    for(const id of n===24?['input','output']:['input','midA','midB','output']){
      const fork=s.map.get(id),cross=s.map.get(n===24?'cross':id==='input'||id==='midA'?'crossA':'crossB'),side=Math.sign(fork.shapes[0].position[0]);
      const seats=fork.shapes.filter(x=>x.bearingSeat);assert.equal(seats.length,2);assert.equal(fork.shapes.some(x=>x.bearingCap),false);
      for(const seat of seats){
        // The half seat lies only behind the open side. Its polygonal bore,
        // including chord sag, is wider than the 8 mm bearing cup.
        assert.ok(seat.points.every(p=>side*p[0]>=-1e-8));
        const inner=seat.points.slice(49);assert.ok(inner.every(p=>Math.hypot(...p)>8.24));
        assert.ok(8.25*Math.cos(Math.PI/96)>8);
      }
      for(const cup of s.parts.filter(p=>p.poseSource===id&&p.id.includes('-cup'))){const caps=cup.shapes.filter(x=>x.bearingCap);assert.equal(caps.length,1);assert.equal(cup.shapes[0].kind,'ring');assert.ok(caps[0].points.every(p=>side*p[0]<=1e-8));assert.ok(cup.shapes[0].inner>(n===24?5:4));}
      // The corresponding cross rod is aligned with local Y. The second rod
      // lies in local XZ, so it cannot enter either ear at |Y| >= h - 4.
      const q=fork.group.quaternion.clone().invert(),crossQ=cross.group.quaternion;
      const rods=cross.shapes.filter(x=>x.kind==='rod').map(r=>({radius:r.radius,a:new THREE.Vector3(...r.from).applyQuaternion(crossQ).applyQuaternion(q),b:new THREE.Vector3(...r.to).applyQuaternion(crossQ).applyQuaternion(q)}));
      const own=rods.find(r=>Math.abs(r.a.y)>10),other=rods.find(r=>Math.abs(r.a.y)<1e-6);assert.ok(own&&other);
      close(own.a.x,0);close(own.a.z,0);close(other.b.y,0);
      assert.ok(Math.abs(seats[0].position[1])-4>other.radius);
      const boxes=fork.shapes.filter(x=>x.kind==='box').map(x=>new THREE.Box3(new THREE.Vector3(...x.position).sub(new THREE.Vector3(...x.size).multiplyScalar(.5)),new THREE.Vector3(...x.position).add(new THREE.Vector3(...x.size).multiplyScalar(.5))));
      const firstRemoval=s.stages.findIndex(st=>st.moves.some(m=>m.ids.includes(id)||m.ids.includes(cross.id)));
      assert.ok(firstRemoval>s.stages.findIndex(st=>st.title.includes('轴承杯')));
      for(let j=0;j<=50;j++){
        s.at((firstRemoval+j/50)/s.stages.length);
        const center=cross.group.position.clone().sub(fork.group.position).applyQuaternion(q);
        assert.ok(side*center.x<=1e-6);close(center.y,0);close(center.z,0);
        // Moving towards the open half increases the distance to every point
        // on the fixed half-seat; it cannot cross a closed annular ear.
        for(const seat of seats)for(const point of seat.points)assert.ok(Math.hypot(point[0]-center.x,point[1])>own.radius);
        for(const r of rods)for(const box of boxes)assert.ok(segmentBoxDistance(r.a.clone().add(center),r.b.clone().add(center),box)>r.radius+.01,`${n} ${id} arm blocks pin`);
        sweeps++;
      }
    }s.dispose();
  }
  assert.equal(configurations,60);assert.equal(sweeps,9792);
});

test('26 cargo clears the complete upward conveyor sweep before the closed assembly is lifted',()=>{
  for(const teeth of [12,16,24])for(const straightLinks of [12,24])for(const phase of [0,.7,2.4]){
    const s=scene(26,{teeth,straightLinks},phase),last=s.stages.length-1;
    for(let j=0;j<=40;j++){
      s.at((last+j/40)/s.stages.length);
      const chain=new THREE.Box3();for(const p of s.parts.filter(p=>/^(drive|idler|link)/.test(p.id)))chain.union(s.box(p.id));
      for(const p of s.parts.filter(p=>/^load/.test(p.id)&&p.group.scale.lengthSq()>0))assert.ok(s.box(p.id).min.y>chain.max.y+1);
    }s.dispose();
  }
});

test('28 release bearing and pressure plate clear the output shaft at every intermediate position',()=>{
  for(const outerRadius of [35,55,80])for(const mode of ['engaged','slipping','open']){
    const s=scene(28,{outerRadius,mode}),disc=s.map.get('disc'),shaft=disc.group.children.at(-1);
    for(let j=0;j<=120;j++){
      s.at(j/120);
      for(const id of ['release','pressure'])for(let k=0;k<24;k++){
        const angle=k*Math.PI/12,ray=new THREE.Raycaster(new THREE.Vector3(6*Math.cos(angle),6*Math.sin(angle),-100),new THREE.Vector3(0,0,1),0,500);
        assert.equal(ray.intersectObject(s.map.get(id).group,true).length,0,`${id}: actual mesh blocks shaft envelope`);
      }
      if(j>=80){const shaftBox=new THREE.Box3().setFromObject(shaft);assert.ok(s.box('pressure').min.z>shaftBox.max.z+1);}
      if(j>=40)assert.ok(s.box('release').min.z>s.box('pressure').max.z+1);
    }s.dispose();
  }
});

test('30 drum retreats axially before shoes move beyond its bore or springs remain in their lane',()=>{
  for(const inputRPM of [0,1200,3000]){
    const s=scene(30,{inputRPM});
    for(let j=0;j<=120;j++){
      s.at(j/120);const drum=s.box('drum');
      for(const id of ['shoe0','shoe1','shoe2']){
        if(j<=40)assert.equal(s.map.get(id).offset.length(),0);
        else assert.ok(drum.max.z<s.box(id).min.z-1);
        if(j>=80)for(const spring of ['spring0','spring1','spring2'])assert.ok(s.box(spring).min.z>s.box(id).max.z+1);
      }
      if(j<=40){const ray=new THREE.Raycaster(new THREE.Vector3(7,0,-180),new THREE.Vector3(0,0,1),0,400);assert.equal(ray.intersectObject(s.map.get('drum').group,true).length,0);}
    }s.dispose();
  }
});

test('32 hanger meets the rear cage plate and stays behind the guide pulley during extraction',()=>{
  for(const gear of [1,2,3,4,5])for(const cageLength of [55,85]){
    const s=scene(32,{gear,cageLength}),hanger=s.map.get('hanger').group.children[1],guide=s.box('guide');
    const hangerBox=new THREE.Box3().setFromObject(hanger);assert.ok(hangerBox.max.z<guide.min.z-1);
    // The rear-plate connection remains adjacent to the same guide center,
    // while its 4 mm oblique rod no longer enters the 4.25 mm axial pin bore.
    close(s.map.get('hanger').shapes[1].to[2],s.map.get('guide').base.z-10);
    for(let j=0;j<=40;j++){s.at(.5+j/80);assert.ok(hangerBox.max.z<s.box('guide').min.z-1);}
    s.dispose();
  }
});

test('34 tie rods leave the wheel lane first, then parked wheels clear the rack withdrawal corridor',()=>{
  const s=scene(34);
  for(let j=0;j<=100;j++){
    s.at(j/100);
    for(const tie of ['tie0','tie1'])for(const wheel of ['knuckle0','knuckle1']){
      const a=s.box(tie),b=new THREE.Box3();for(const mesh of s.map.get(wheel).group.children.slice(1))b.union(new THREE.Box3().setFromObject(mesh));assert.ok(!a.intersectsBox(b),`${tie}/${wheel} at ${j}%`);
    }
    if(j>=80)for(const wheel of ['knuckle0','knuckle1'])assert.ok(s.box(wheel).max.z<s.box('rack').min.z-1);
  }s.dispose();
});

test('all eleven motion plans reverse the same multi-stage path back to the exact assembled pose',()=>{
  for(let n=24;n<=34;n++){
    const s=scene(n),checkpoints=[0,.11,.31,.57,.83,1],offsets=[];
    for(const p of checkpoints){s.at(p);offsets.push(s.parts.map(p=>p.offset.toArray()));}
    for(let i=checkpoints.length-1;i>=0;i--){s.at(checkpoints[i]);assert.deepEqual(s.parts.map(p=>p.offset.toArray()),offsets[i]);}
    for(const p of s.parts)assert.ok(p.group.position.equals(p.base));s.dispose();
  }
});
