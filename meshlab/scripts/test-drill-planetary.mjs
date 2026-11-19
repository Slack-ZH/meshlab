import test from 'node:test';
import assert from 'node:assert/strict';
import { teeth,transmission,initialAngles,advanceAngles,powerPath } from '../dist/drill-planetary/kinematics.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('two stages fit concentrically and three equally spaced planets can be assembled',()=>{
  assert.equal(teeth.ring,teeth.sun+2*teeth.planet);assert.equal((teeth.ring+teeth.sun)%teeth.planets,0);
});
test('default ratios and speeds distinguish fixed-ring low from coupled high',()=>{
  const low=transmission(),high=transmission(6000,'high');
  assert.equal(low.ratio,16);assert.equal(low.output,375);assert.equal(high.ratio,4);assert.equal(high.output,1500);
  assert.equal(low.ring2,0);assert.equal(high.ring2,high.carrier2);assert.equal(high.sun2,high.carrier2);
  assert.equal(high.planet2,0);assert.equal(low.planet2,-1125);
});
test('Willis equation, interstage connection and external mesh constraint over every input',()=>{
  for(let rpm=1000;rpm<=12000;rpm+=100)for(const mode of ['low','high']){
    const n=transmission(rpm,mode);
    for(const i of [1,2]){
      near(teeth.sun*(n[`sun${i}`]-n[`carrier${i}`])+teeth.ring*(n[`ring${i}`]-n[`carrier${i}`]),0);
      near(teeth.planet*n[`planet${i}`]+teeth.sun*(n[`sun${i}`]-n[`carrier${i}`]),0);
    }
    near(n.carrier1,n.sun2);near(n.carrier2,n.output);near(n.highOutput/n.lowOutput,4);
  }
});
test('angular integration keeps all mesh phases consistent, high planets have no relative spin',()=>{
  for(const mode of ['low','high']){
    let a=initialAngles();const n=transmission(6000,mode);
    for(let i=0;i<360;i++)a=advanceAngles(a,n,1/240/60);
    near(a.sun1,Math.PI*5);near(a.carrier1,a.sun2);near(a.output,a.carrier2);
    for(const i of [1,2])near(teeth.sun*(a[`sun${i}`]-a[`carrier${i}`])+teeth.ring*(a[`ring${i}`]-a[`carrier${i}`]),0);
    if(mode==='high'){near(a.planet2,0);assert.ok(a.carrier2>0);}
  }
});
test('power-path endpoints and output scaling remain aligned with gear selection',()=>{
  for(const mode of ['low','high']){
    const nodes=powerPath(9000,mode),n=transmission(9000,mode);
    assert.equal(nodes.length,5);assert.equal(nodes[0].speed,9000);assert.equal(nodes.at(-1).speed,n.output);assert.equal(nodes[1].speed,nodes[2].speed);
  }
});
test('invalid states are rejected and a stopped motor stays stopped',()=>{
  for(const rpm of [-1,NaN,Infinity])assert.throws(()=>transmission(rpm),RangeError);
  assert.throws(()=>transmission(6000,'reverse'),RangeError);assert.equal(transmission(0,'high').output,0);
  assert.throws(()=>advanceAngles(initialAngles(),transmission(),-1),RangeError);
});
