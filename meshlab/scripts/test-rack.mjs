import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../dist/assets/three.module.js';
import {defaults, estimate, geometry, pinionOutline, rackOutline, advanceMotion} from '../dist/rack/mechanics.mjs';
import {captureRackContext, createRackChatPayload} from '../dist/rack/chat-context.mjs';
import {createFrictionChatPayload} from '../dist/friction/chat-context.mjs';

test('rotation, one-tooth travel, reversals and zero speed use consistent units', () => {
  assert.ok(Math.abs(estimate(defaults, 360).displacement - 48 * Math.PI) < 1e-9);
  assert.ok(Math.abs(estimate(defaults, 15).displacement - 2 * Math.PI) < 1e-9);
  assert.equal(estimate(defaults, -90).displacement, -estimate(defaults, 90).displacement);
  assert.equal(estimate({...defaults, inputRPM: 0}).velocity, 0);
  assert.throws(() => estimate({...defaults, teeth: 24.5}));
  assert.throws(() => estimate({...defaults, module: NaN}));
  assert.throws(() => estimate(defaults, 1000));
});

test('travel limits stop outward motion and allow an inward restart', () => {
  const {maxAngle} = geometry(defaults);
  assert.equal(advanceMotion(defaults,maxAngle,1,1).angle,maxAngle);
  assert.equal(advanceMotion(defaults,maxAngle,1,1).atLimit,true);
  assert.equal(advanceMotion(defaults,maxAngle,-1,0).atLimit,false);
  assert.ok(advanceMotion(defaults,maxAngle,-1,1).angle<maxAngle);
  assert.equal(advanceMotion(defaults,-maxAngle,-1,1).angle,-maxAngle);
  assert.equal(advanceMotion(defaults,-maxAngle,1,0).atLimit,false);
  assert.ok(advanceMotion(defaults,-maxAngle,1,1).angle>-maxAngle);
  assert.equal(advanceMotion({...defaults,inputRPM:0},90,1,20).angle,90);
  assert.equal(advanceMotion(defaults,0,1,1,2).angle,2*advanceMotion(defaults,0,1,1).angle);
});

// Use the production mesh builders without creating a browser or WebGL context.
const moduleUrl = path => new URL(path,import.meta.url).href;
const source = (await readFile(new URL('../dist/rack/viewer.mjs',import.meta.url),'utf8'))
  .replace("from 'three'",`from '${moduleUrl('../dist/assets/three.module.js')}'`)
  .replace("import {OrbitControls} from '../assets/OrbitControls.js';",'const OrbitControls=class {};')
  .replace("from './mechanics.mjs'",`from '${moduleUrl('../dist/rack/mechanics.mjs')}'`);
const {RackViewer,steps} = await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function cpuViewer() {
  const viewer = Object.create(RackViewer.prototype);
  Object.assign(viewer,{scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),parts:[],selected:'pinion',
    renderer:{info:{memory:{geometries:0}}},amount:0,step:0,speed:1,direction:1,labelsOn:false,housingMode:'solid',
    onSelect(){},onMotion(){},render(){},home(){},fitModel(){}});
  return viewer;
}
const overlaps = (a,b) => a.min.every((min,i)=>a.max[i]>b.min[i]+1e-5&&b.max[i]>min+1e-5);

test('disassembly and reassembly preserve both angle and physical rack position', () => {
  const viewer=cpuViewer();viewer.build(defaults);viewer.setAngle(90);
  const position=viewer.slider.position.x;
  viewer.explode(1);viewer.restore();
  assert.equal(viewer.angle,90);assert.equal(viewer.slider.position.x,position);
  for(let step=0;step<steps.length;step++)viewer.assembly(step);
  viewer.restore();assert.equal(viewer.angle,90);assert.equal(viewer.slider.position.x,position);
  viewer.build({...defaults,inputRPM:30});assert.equal(viewer.angle,90);
  viewer.build({...defaults,module:3});assert.equal(viewer.angle,0);
  viewer.clearGeometry();
});

test('exploded production parts remain separated throughout boundary geometries', () => {
  const viewer=cpuViewer();
  for(const module of [1,4]) for(const teeth of [18,40]) for(const faceWidth of [10,30]) {
    viewer.build({...defaults,module,teeth,faceWidth});
    for(const angle of [-viewer.g.maxAngle,0,viewer.g.maxAngle]) {
      viewer.setAngle(angle);viewer.explode(1);
      const parts=viewer.state().parts;
      assert.equal(parts.length,6);
      for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++) {
        assert.equal(overlaps(parts[i],parts[j]),false,`${parts[i].id} / ${parts[j].id}, m=${module}, z=${teeth}, width=${faceWidth}`);
      }
      viewer.restore();assert.equal(viewer.angle,angle);
    }
  }
  viewer.clearGeometry();
});

function inside(point, polygon) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [x, y] = point, [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < (xj-xi)*(y-yi)/(yj-yi)+xi) hit = !hit;
  }
  return hit;
}

test('gear and rack tooth profiles clear each other over a whole tooth engagement', () => {
  for (const teeth of [18, 24, 40]) for (const rackTeeth of [32, 33, 64, 79, 80]) {
    const p = {...defaults, teeth, rackTeeth}, g = geometry(p);
    const gear = pinionOutline(p), rack = rackOutline(p);
    assert.equal(rack.length, 4 * rackTeeth + 4);
    for (let step = 0; step <= 60; step++) {
      const angle = step / 60 * 2 * Math.PI / teeth;
      const shifted = rack.map(([x,y]) => [x + g.radius * angle, y]);
      const turned = gear.map(([x,y]) => [x*Math.cos(angle)-y*Math.sin(angle), x*Math.sin(angle)+y*Math.cos(angle)]);
      for (const point of turned) assert.equal(inside(point, shifted), false, `gear penetrates rack, z=${teeth}, phase=${step}`);
      for (const point of shifted) assert.equal(inside(point, turned), false, `rack penetrates gear, z=${teeth}, phase=${step}`);
    }
  }
});

test('chat uses an immutable snapshot and preserves all existing model builders', () => {
  const state = {params:{...defaults}, view:{angle:90}, zeroPosition:0, selectedPart:{name:'齿条'}};
  const snapshot = captureRackContext(state);
  state.params.module = 3;
  assert.equal(snapshot.parameters.module, 2);
  const payload = createRackChatPayload([{role:'user', content:'走了多少？', rackContext:snapshot}]);
  assert.match(payload.messages[0].content, /37\.6991/);
  assert.equal(payload.messages[0].selectedPartId, undefined);
  assert.throws(() => createRackChatPayload([{role:'user', content:'字'.repeat(2000), rackContext:snapshot}]));
  const other = [{role:'user', content:'说明输入轴', selectedPartId:'shaft_in'}];
  assert.deepEqual(createRackChatPayload(other), createFrictionChatPayload(other));
  for (const key of ['bicycleContext', 'turbineContext', 'frictionContext']) {
    const turns = [{role:'user', content:'解释当前参数', [key]:{parameters:{}, selectedPart:{}}}];
    assert.deepEqual(createRackChatPayload(turns), createFrictionChatPayload(turns));
  }
  assert.equal(captureRackContext({...state, geometryValid:false}).result, null);
  const reversed=captureRackContext({...state,params:defaults,view:{angle:90,direction:-1}});
  assert.ok(reversed.result.velocity<0);
  const stopped=captureRackContext({...state,params:{...defaults,inputRPM:0},view:{angle:90,direction:-1}});
  assert.equal(Object.is(stopped.result.velocity,-0),false);
  const invalid=captureRackContext({...state,params:{...defaults,module:NaN},modelParameters:defaults,geometryValid:false});
  assert.equal(invalid.parameters.module,null);
  assert.equal(invalid.modelParameters.module,2);
});
