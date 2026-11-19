import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,wormResults,poseAt,cycleProgress,TAU} from '../dist/worm-drive/kinematics.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('default and comparison operating points',()=>{
  const r=wormResults();assert.equal(r.ratio,40);assert.equal(r.outputRpm,3);assert.equal(r.centerDistance,78);
  assert.equal(wormResults({...defaults,starts:2}).outputRpm,6);
  assert.equal(wormResults({...defaults,starts:4}).outputRpm,12);
  assert.equal(wormResults({...defaults,wheelTeeth:60}).outputRpm,2);
});
test('all supported structures satisfy speed, lead and one-turn constraints',()=>{
  for(let starts=1;starts<=4;starts++)for(let wheelTeeth=20;wheelTeeth<=60;wheelTeeth++)for(const rpm of [60,120,600]){
    const p={starts,wheelTeeth,rpm},r=wormResults(p),pose=poseAt(TAU,p),progress=cycleProgress(TAU,p);
    near(r.outputRpm*r.ratio,rpm);near(pose.wheel/TAU*wheelTeeth,starts);
    assert.equal(progress.teeth,starts);near(progress.wheelDegrees,360*starts/wheelTeeth);
    near(r.lead/r.axialPitch,starts);near(Math.tan(r.leadAngle*Math.PI/180),starts/12);
    near(r.centerDistance,(r.wormDiameter+r.wheelDiameter)/2);assert.equal(r.wheelDiameter,3*wheelTeeth);
  }
});
test('partial turns track continuous displacement',()=>{
  const p={...defaults,starts:3,wheelTeeth:45};near(cycleProgress(TAU*.25,p).teeth,.75);near(cycleProgress(TAU*.25,p).wheelDegrees,6);
  near(poseAt(TAU*7.5,p).wheel,Math.PI);assert.equal(wormResults({...defaults,rpm:0}).outputRpm,0);
});
test('invalid input cannot produce nonfinite geometry or motion',()=>{
  for(const starts of [0,5,2.5,NaN,Infinity])assert.throws(()=>wormResults({...defaults,starts}),RangeError);
  for(const wheelTeeth of [19,61,40.5,NaN])assert.throws(()=>wormResults({...defaults,wheelTeeth}),RangeError);
  for(const rpm of [-1,NaN,Infinity])assert.throws(()=>wormResults({...defaults,rpm}),RangeError);
  assert.throws(()=>poseAt(Infinity),RangeError);assert.throws(()=>cycleProgress(-1),RangeError);
});
