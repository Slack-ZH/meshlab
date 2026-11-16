import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,estimate,geometry,chainPoint,motion,pathLength,PITCH} from '../dist/bicycle/mechanics.mjs';

test('reference ratio, chain speed and power/torque are physically consistent',()=>{
  const r=estimate(defaults);
  assert.equal(r.ratio,42/18);assert.ok(Math.abs(r.rearRPM-80*42/18)<1e-10);
  assert.ok(Math.abs(r.speedKmh-24.630086404143977)<1e-10);
  assert.equal(r.outputPower,145.5);assert.equal(r.chainSpeed,.7112);
  assert.ok(Math.abs(r.outputTorque*r.rearRPM*Math.PI/30-r.outputPower)<1e-10);
  assert.ok(Math.abs(r.outputTorque/r.inputTorque-defaults.efficiency/r.ratio)<1e-10);
});
test('every accepted tooth pair closes an even-link chain without roller collisions',()=>{
  for(let frontTeeth=28;frontTeeth<=52;frontTeeth++)for(let rearTeeth=12;rearTeeth<=32;rearTeeth++)for(const centerDistance of [380,430,500]){
    const g=geometry({...defaults,frontTeeth,rearTeeth,centerDistance});
    assert.equal(g.chainLinks%2,0);assert.ok(g.closureError<1e-9);assert.ok(Math.abs(g.centerCorrection)<6.5);
    assert.ok(Math.abs(pathLength(g.effectiveCenterDistance,g.frontRadius,g.rearRadius)-g.chainLinks*PITCH)<1e-9);
    for(const phase of [0,PITCH*.23,PITCH*.77])for(let i=0;i<g.chainLinks;i++){
      const a=chainPoint(g,phase+i*PITCH),b=chainPoint(g,phase+(i+1)*PITCH),distance=Math.hypot(a[0]-b[0],a[1]-b[1]);
      assert.ok(distance>12.5&&distance<=PITCH+1e-8,'continuous-pitch model bounds chord shortening explicitly');
    }
    const a=chainPoint(g,-3.2),b=chainPoint(g,g.chainLength-3.2);
    assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-9);
  }
});
test('zero cadence never divides by zero or invents finite steady torque',()=>{
  const r=estimate({...defaults,cadence:0});
  assert.equal(r.rearRPM,0);assert.equal(r.speedKmh,0);assert.equal(r.outputPower,0);
  assert.equal(r.inputTorque,null);assert.equal(r.outputTorque,null);assert.ok(r.warning);
});
test('geometry controls and drive controls have distinct, predictable effects',()=>{
  const base=estimate(defaults),largeWheel=estimate({...defaults,wheelDiameter:740});
  assert.equal(largeWheel.ratio,base.ratio);assert.ok(Math.abs(largeWheel.speedKmh/base.speedKmh-740/700)<1e-12);
  assert.deepEqual(geometry({...defaults,crankLength:180}),geometry(defaults));
  assert.equal(estimate({...defaults,inputPower:300}).outputPower,2*base.outputPower);
  assert.equal(estimate({...defaults,rearTeeth:24}).rearRPM,140);
});
test('one chain phase drives both sprockets and wheel at any playback speed',()=>{
  for(const speed of [.1,1,2])for(const seconds of [0,.1,3.3,1000]){
    const m=motion(defaults,seconds,speed),g=geometry(defaults);
    assert.equal(m.rear,m.front*42/18);assert.equal(m.wheel,m.rear);
    assert.ok(Math.abs(m.chainPhase+m.front*g.frontRadius)<1e-8);
    assert.ok(Math.abs(m.chainPhase+m.rear*g.rearRadius)<1e-8);
  }
});
test('invalid teeth, empty inputs and out-of-range values fail before model construction',()=>{
  for(const patch of [{frontTeeth:27},{rearTeeth:12.1},{cadence:NaN},{efficiency:1.01},{wheelDiameter:Infinity},{centerDistance:370}])assert.throws(()=>estimate({...defaults,...patch}));
});
