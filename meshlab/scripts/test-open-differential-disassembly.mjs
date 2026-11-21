
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../dist/assets/three.module.js';

const url=p=>new URL('../dist/'+p,import.meta.url).href;
const data=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const source=p=>fs.readFileSync(new URL('../dist/'+p,import.meta.url),'utf8').replace("from 'three'","from '"+url('assets/three.module.js')+"'");
const sceneModule=source('open-differential/scene.js')
  .replace("import { OrbitControls } from '../assets/OrbitControls.js';","class OrbitControls { target=new THREE.Vector3(); update(){} }")
  .replace("from '../mechanical-style.js'","from '"+url('mechanical-style.js')+"'")
  .replace("from '../exploded-view.js'","from '"+url('exploded-view.js')+"'")
  .replace("from './gears.js'","from '"+data(source('open-differential/gears.js'))+"'")
  .replace('new THREE.WebGLRenderer','new globalThis.RendererStub')
  .replace('const assembly=new THREE.Group();','const assembly=globalThis.diffAssembly=new THREE.Group();');
const {createDifferentialScene}=await import(data(sceneModule));
const stub=()=>({style:{},dataset:{},append(){},addEventListener(){},setAttribute(){},getBoundingClientRect(){return {width:480,height:320,left:0,top:0};}});
globalThis.RendererStub=class{shadowMap={};domElement=stub();setSize(){} setPixelRatio(){} render(){}};
globalThis.devicePixelRatio=1;globalThis.document={createElement:stub};globalThis.ResizeObserver=class{observe(){}};
const position=o=>o.getWorldPosition(new THREE.Vector3());
test('open differential withdraws the shafts and covers before the spider cartridge can leave the shell',()=>{
  const scene=createDifferentialScene({...stub(),clientWidth:480,clientHeight:320},()=>{});
  for(const angle of [0,.4,2.1,4.7]){
    scene.explosion.setTarget(0,{immediate:true});
    scene.setPose({carrier:angle,left:angle-.3,right:angle+.3,input:4*angle,spider:.6});
    const root=globalThis.diffAssembly,left=root.getObjectByName('left-halfshaft'),spider=root.getObjectByName('upper-spider-axis').children[0].children[0].children[0];
    const sideGear=left.children[0].children[0],shaft=left.children[2];
    const shell=root.getObjectByName('complete-case').children[0],cover=root.getObjectByName('complete-case').children[1];
    const initial=new Map([shaft,sideGear,spider,shell,cover].map(m=>[m,position(m)]));
    const delta=m=>position(m).sub(initial.get(m));
    const go=step=>scene.explosion.setTarget(step/7,{immediate:true});
    go(.5);assert.ok(delta(shaft).x < -100);assert.ok(delta(sideGear).length()<1e-7);assert.ok(delta(cover).length()<1e-7);
    go(4);assert.ok(delta(cover).x < -100);assert.ok(delta(spider).length()<1e-7);
    go(5);assert.ok(delta(sideGear).x < -100);assert.ok(delta(spider).length()<1e-7);
    go(5.5);assert.ok(Math.abs(delta(spider).x+46)<1e-5);assert.ok(Math.hypot(delta(spider).y,delta(spider).z)<1e-5);
    go(7);assert.ok(Math.abs(delta(spider).x+92)<1e-5);assert.ok(Math.abs(Math.hypot(delta(spider).y,delta(spider).z)-76)<1e-5);
    assert.ok(delta(shell).length()<1e-7);
    go(0);for(const m of initial.keys())assert.ok(delta(m).length()<1e-7);
  }
});
