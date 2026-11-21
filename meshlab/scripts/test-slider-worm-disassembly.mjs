import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../dist/assets/three.module.js';
import {linkGeometry} from '../dist/slider-crank/disassembly.js';
import {pistonPoseAt} from '../dist/slider-crank/kinematics.js';
const url=path=>new URL(path,import.meta.url).href,data=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const shim=data(`export * from '${url('../dist/assets/three.module.js')}';export const renderers=[];export class WebGLRenderer{constructor(){this.domElement={setAttribute(){},addEventListener(){}};renderers.push(this);}setClearColor(){}setSize(){}render(scene){this.scene=scene;}}`);
const {renderers}=await import(shim);
const dom=`const document={createElement:()=>({style:{},dataset:{},classList:{toggle(){}},hidden:false})};const ResizeObserver=class{observe(){}};`;
async function load(path){const base=new URL(path,import.meta.url);let src=await readFile(base,'utf8');src=src.replace(/import \{[^\n]*\} from '..\/mechanical-style.js';/,'const materialOptions=()=>({}),highlight=()=>{},metalLighting=()=>{},referenceGround=()=>({setY(){}});').replace(/import \{\s*OrbitControls\s*\} from '[^']+';/,'const OrbitControls=class{constructor(){this.target=new THREE.Vector3();}addEventListener(){}update(){}};');
  const g=src.includes("from './geometries.js'")?data((await readFile(new URL('./geometries.js',base),'utf8')).replace(/from '([^']+)'/g,(_,p)=>`from '${p==='three'?url('../dist/assets/three.module.js'):new URL(p,base).href}'`)):null;
  src=src.replace(/from '([^']+)'/g,(_,p)=>`from '${p==='three'?shim:p==='./geometries.js'?g:new URL(p,base).href}'`);return import(data(dom+src));}
const container=()=>({clientWidth:900,clientHeight:600,append(){}}),close=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<t,`${a} ≈ ${b}`),box=o=>new THREE.Box3().setFromObject(o);
test('production crank and rod meshes have clear pin bores at all size endpoints',()=>{
  for(const part of ['crank','rod'])for(const length of part==='crank'?[20,40,70]:[120,140,240]){
    const g=linkGeometry(THREE,length,part),mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld();
    for(const [x,r] of [[0,part==='crank'?13:5],[length,5]])for(let i=0;i<32;i++){
      const a=i*Math.PI/16,ray=new THREE.Raycaster(new THREE.Vector3(x+r*Math.cos(a),r*Math.sin(a),-30),new THREE.Vector3(0,0,1));assert.equal(ray.intersectObject(mesh).length,0,'pin cylinder must not meet solid link faces');
    }g.dispose();mesh.material.dispose();
  }
});
test('production piston scene withdraws crank pin before lifting captured piston/rod through cylinder end',async()=>{
  const {createScene}=await load('../dist/slider-crank/piston-scene.js');const api=await createScene({container:container(),onAngle(){},onSelect(){},onDragStart(){}});
  for(const params of [{radius:20,rodLength:120,rpm:30},{radius:70,rodLength:120,rpm:30},{radius:70,rodLength:240,rpm:30}])for(const angle of [0,Math.PI/2,Math.PI]){
    api.explosion.setTarget(0,{immediate:true});api.update(pistonPoseAt({...params,angle,omega:1}),params);api.render(0);const scene=renderers.at(-1).scene;
    const find=part=>scene.children.find(o=>o.isGroup&&o.children.some(c=>c.userData.part===part)),crank=find('crank'),rod=find('rod'),piston=find('slider'),base=[crank,rod,piston].map(o=>o.position.clone());
    for(let i=0;i<=80;i++){const progress=i/20;api.explosion.setTarget(progress/4,{immediate:true});api.render(0);const dr=rod.position.clone().sub(base[1]),dp=piston.position.clone().sub(base[2]);assert.ok(dr.distanceTo(dp)<1e-6,'wrist-pin assembly stays captured');
      close(dr.x,0);close(dr.z,0);if(progress<=1)close(dr.y,0);if(progress<=3)close(crank.position.z-base[0].z,0);
      if(progress>=2)assert.ok(box(rod).min.y>params.rodLength+params.radius+26,'complete rod clears cylinder upper end');
    }
    api.explosion.setTarget(0,{immediate:true});api.render(0);[crank,rod,piston].forEach((o,i)=>assert.deepEqual(o.position.toArray(),base[i].toArray()));
  }
});
test('production worm scene removes output stands, disengages worm, and withdraws intact wheel bearing assembly',async()=>{
  const {createWormScene}=await load('../dist/worm-drive/scene.js'),api=createWormScene(container(),{starts:1,wheelTeeth:40,rpm:120},()=>{});
  for(const params of [{starts:1,wheelTeeth:20,rpm:120},{starts:4,wheelTeeth:60,rpm:120}]){
    api.explosion.setTarget(0,{immediate:true});api.rebuild(params);api.setPose({worm:.7,wheel:.1});api.render(0);const scene=renderers.at(-1).scene,model=scene.getObjectByName('worm-transmission'),worm=scene.getObjectByName('worm-shaft'),wheel=scene.getObjectByName('worm-wheel'),supports=scene.getObjectByName('support-frame'),baseW=worm.position.clone(),baseG=wheel.position.clone(),bearings=supports.children.filter(o=>o.userData.part==='bearings'),positions=new Map(bearings.map(o=>[o,o.position.clone()]));
    for(let i=0;i<=80;i++){const progress=i/20;api.explosion.setTarget(progress/4,{immediate:true});api.render(0);model.updateMatrixWorld(true);const dw=worm.position.clone().sub(baseW),dg=wheel.position.clone().sub(baseG);
      if(progress<=1)close(dw.length(),0);if(progress<=2)close(dg.length(),0);if(progress<=3)close(dw.x,0);
      for(const bearing of bearings)assert.ok(bearing.position.clone().sub(positions.get(bearing)).distanceTo(positions.get(bearing).x!==0?dw:dg)<1e-6,'bearing retains same displacement as its shouldered shaft');
      if(progress>=2)assert.ok(box(worm).min.y>box(wheel).max.y,'worm is fully disengaged before wheel extraction');
      if(progress>2)for(const stand of supports.children.filter(o=>o.userData.part==='frame'&&o.position.z>400))assert.ok(box(stand).min.z>box(wheel).max.z,'removed front stand stays beyond output extraction path');
    }
    api.explosion.setTarget(0,{immediate:true});api.render(0);assert.deepEqual(worm.position.toArray(),baseW.toArray());assert.deepEqual(wheel.position.toArray(),baseG.toArray());
  }
});
