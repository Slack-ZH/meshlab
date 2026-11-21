import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../dist/assets/three.module.js';
import {drillSteps,drillPath} from '../dist/drill-planetary/disassembly.js';
import {initialAngles,advanceAngles,transmission} from '../dist/drill-planetary/kinematics.js';
const data=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const threeURL=new URL('../dist/assets/three.module.js',import.meta.url).href;
const sceneURL=new URL('../dist/drill-planetary/scene.js',import.meta.url);
const gearURL=data(fs.readFileSync(new URL('../dist/drill-planetary/gears.js',import.meta.url),'utf8').replace("from 'three'",`from '${threeURL}'`));
let src=fs.readFileSync(sceneURL,'utf8');
src=src.replace("import * as THREE from 'three';",`import * as RealTHREE from '${threeURL}';
export const captured={};
class Renderer {constructor(){this.domElement={setAttribute(){},addEventListener(){}};} setSize(){} render(scene){captured.scene=scene;}}
const THREE={...RealTHREE,WebGLRenderer:Renderer};`)
.replace(/import \{ OrbitControls \} from '[^']+';/,"const OrbitControls=class {constructor(){this.target=new THREE.Vector3();}update(){}};")
.replace(/import \{ materialOptions, metalLighting, referenceGround, highlight \} from '[^']+';/,"const materialOptions=()=>({}),metalLighting=()=>{},referenceGround=()=>({setY(){}}),highlight=()=>{};")
.replace("from './gears.js'",`from '${gearURL}'`)
.replace("import { createExplodedView } from '../exploded-view.js';",`import {createExplodedView as engine} from '${new URL('../dist/exploded-view.js',import.meta.url).href}';
const createExplodedView=args=>{const x=engine(args),set=x.setParts;x.setParts=entries=>{captured.entries=entries;set(entries);};return x;};`)
.replace("from './disassembly.js'",`from '${new URL('../dist/drill-planetary/disassembly.js',import.meta.url).href}'`);
const {createDrillScene,captured}=await import(data(src));
globalThis.matchMedia=()=>({matches:true});globalThis.ResizeObserver=class {observe(){}};
globalThis.document={createElement:()=>({dataset:{},style:{},setAttribute(){}})};
const container={clientWidth:1200,clientHeight:700,append(){}};
const role=e=>e.object.userData.disassemblyRole||e.object.userData.part;
const bounds=entries=>{const b=new THREE.Box3();for(const e of entries)b.union(new THREE.Box3().setFromObject(e.object));return b;};
const overlap=(a,b)=>['x','y','z'].every(k=>Math.min(a.max[k],b.max[k])-Math.max(a.min[k],b.min[k])>.001);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} versus ${b}`);
function build(mode,phase=0){const scene=createDrillScene(container,()=>{});scene.setMode(mode);scene.setPose(advanceAngles(initialAngles(),transmission(6000,mode),phase));scene.render(0);return {scene,entries:captured.entries};}
function at(scene,progress){scene.explosion.setTarget(progress/drillSteps.length,{immediate:true});scene.render(0);}

test('drill: production uses twelve sequential paths and every non-housing role is accounted for',()=>{
 const {entries}=build('low');assert.equal(drillSteps.length,12);
 for(const e of entries){const r=role(e);assert.deepEqual(e.path,drillPath(r));assert.equal(e.path.length>0,r!=='housing');for(const move of e.path){assert.ok(move.step>=0&&move.step<12);assert.ok(move.offset.every(Number.isFinite));}}
 assert.ok(entries.some(e=>role(e)==='coupling2'));
});
test('drill: both gear modes, carrier phases and reversed fractions preserve axial withdrawal before side parking',()=>{
 for(const mode of ['low','high'])for(const phase of [0,.019,.073]){
  const {scene,entries}=build(mode,phase),part=r=>entries.filter(e=>role(e)===r),base=new Map(entries.map(e=>[e,bounds([e])])),saved=new Map();
  for(const forward of [true,false])for(let i=0;i<=96;i++){
   const tick=forward?i:96-i,progress=tick/8;at(scene,progress);
   const state=entries.map(e=>e.object.getWorldPosition(new THREE.Vector3()).toArray());
   if(forward)saved.set(tick,state);else for(let j=0;j<state.length;j++)for(let k=0;k<3;k++)near(state[j][k],saved.get(tick)[j][k]);
   for(const r of ['planet1','planet2'])for(const e of part(r)){const b=bounds([e]),old=base.get(e);if(progress<=9){near(b.min.y,old.min.y);near(b.min.z,old.min.z);}if(progress>9){const n=Number(r.at(-1)),pinEnd=n===1?-78.5:44.5;assert.ok(b.max.x<pinEnd-1,'planet must fully leave its pin before transverse motion');}}
   if(progress<=4)for(const r of ['ring1','ring2'])for(const e of part(r))near(bounds([e]).min.x,base.get(e).min.x);
   if(progress<=5)for(const r of ['ring1','ring2'])for(const e of part(r)){near(bounds([e]).min.y,base.get(e).min.y);near(bounds([e]).min.z,base.get(e).min.z);}
   if(progress>4&&progress<=10)assert.ok(bounds(part('coupling2')).min.x>bounds(part('carrier2')).max.x,'coupling has cleared output shaft before ring withdrawal');
  }
  at(scene,0);for(const e of entries){const b=bounds([e]);for(const k of ['x','y','z']){near(b.min[k],base.get(e).min[k]);near(b.max[k],base.get(e).max[k]);}}
 }
});
test('drill: fully separated physical groups do not overlap in final production geometry',()=>{
 for(const mode of ['low','high'])for(const phase of [0,.019,.073]){const {scene,entries}=build(mode,phase);at(scene,12);const groups=new Map();for(const e of entries){const key=JSON.stringify(e.path);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);}const all=[...groups.values()];for(let a=0;a<all.length;a++)for(let b=a+1;b<all.length;b++)assert.ok(!overlap(bounds(all[a]),bounds(all[b])),`${mode}: ${role(all[a][0])} / ${role(all[b][0])} ${JSON.stringify([bounds(all[a]),bounds(all[b])])}`);}
});
test('drill: actual bores and selector passage clear the independent shafts and coupling rim',()=>{
 const {entries}=build('low'),radial=(object,c=[0,0])=>{const v=object.geometry.attributes.position;let r=Infinity;for(let i=0;i<v.count;i++)r=Math.min(r,Math.hypot(v.getY(i)-c[0],v.getZ(i)-c[1]));return r;};
 const gear=entries.find(e=>role(e)==='sun2'&&e.object.geometry.type==='ExtrudeGeometry').object;assert.ok(radial(gear)>8.05,'sun2 must clear the radius-8 interstage shaft');
 const coupling=entries.filter(e=>role(e)==='coupling2');const hub=coupling.find(e=>e.object.geometry.type==='ExtrudeGeometry').object;assert.ok(radial(hub)>9.1,'coupling hub must slide on the radius-9 output shaft');
 for(const e of coupling.filter(e=>e.object.geometry.type==='BoxGeometry'&&e.object.geometry.parameters.height===47)){const g=e.object.geometry.parameters;assert.ok(Math.hypot(e.object.position.y,e.object.position.z)-g.height/2>9.1,'coupling spokes start beyond shaft');}
 const selector=entries.filter(e=>role(e)==='selector'),hoop=selector.find(e=>e.object.geometry.type==='TorusGeometry').object.geometry.parameters;assert.ok(hoop.radius-hoop.tube>64.2,'selector must clear coupling and dog outer rims');
 const eye=selector.find(e=>e.object.geometry.type==='ExtrudeGeometry').object;assert.ok(radial(eye)>2.2,'selector eye must clear the radius-2 guide rail');
 const ringMarkers=entries.filter(e=>/^ring[12]$/.test(role(e))&&e.object.geometry.type==='BoxGeometry'&&e.object.geometry.parameters.width===1.1);for(const e of ringMarkers){assert.ok(Math.hypot(e.object.position.y,e.object.position.z)-e.object.geometry.parameters.height/2>58,'ring marker must stay on the rim instead of crossing moving gears');}
});
