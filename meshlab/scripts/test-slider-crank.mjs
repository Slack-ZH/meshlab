import test from 'node:test';
import assert from 'node:assert/strict';
import {pistonPoseAt,DEFAULTS,LIMITS} from '../dist/slider-crank/kinematics.js';
const near=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} != ${expected}`);
const input={...DEFAULTS,angle:0,omega:Math.PI};
test('TDC is zero, BDC is twice the crank radius, both velocities vanish',()=>{
 for(const radius of [20,40,50,70])for(const rodLength of [120,140,240]){
  const top=pistonPoseAt({...input,radius,rodLength}),bottom=pistonPoseAt({...input,radius,rodLength,angle:Math.PI});
  near(top.displacement,0);near(bottom.displacement,2*radius);near(top.velocity,0);near(bottom.velocity,0);
  near(top.pistonY-bottom.pistonY,2*radius);near(top.pistonY,top.tdcY);near(bottom.pistonY,bottom.bdcY);
 }
});
test('vertical linkage closes and downward velocity is the displacement derivative',()=>{
 for(const radius of [LIMITS.radius.min,DEFAULTS.radius,LIMITS.radius.max])for(const rodLength of [LIMITS.rodLength.min,DEFAULTS.rodLength,LIMITS.rodLength.max]){
  for(let degree=0;degree<360;degree+=2){
   const angle=degree*Math.PI/180,p={...input,radius,rodLength,angle},pose=pistonPoseAt(p),h=1e-5;
   near(Math.hypot(pose.crankX,pose.crankY),radius);
   near(Math.hypot(pose.crankX,pose.pistonY-pose.crankY),rodLength);
   near(pose.crankX+rodLength*Math.cos(pose.rodAngle),0);
   near(pose.crankY+rodLength*Math.sin(pose.rodAngle),pose.pistonY);
   near(pose.velocity,(pistonPoseAt({...p,angle:angle+h}).displacement-pistonPoseAt({...p,angle:angle-h}).displacement)/(2*h)*p.omega,1e-5);
   assert.ok(pose.displacement>=-1e-8&&pose.displacement<=2*radius+1e-8);
  }
 }
});
test('changing rod length changes the curve but does not change stroke',()=>{
 const short=pistonPoseAt({...input,angle:Math.PI/2,rodLength:120});
 const long=pistonPoseAt({...input,angle:Math.PI/2,rodLength:240});
 assert.ok(short.displacement>long.displacement);assert.equal(short.stroke,long.stroke);
});
test('a full turn is continuous and nonfinite or impossible input is rejected',()=>{
 const pose=pistonPoseAt({...input,angle:1.23});
 const next=pistonPoseAt({...input,angle:1.23+2*Math.PI});
 near(pose.displacement,next.displacement);near(pose.velocity,next.velocity);
 assert.throws(()=>pistonPoseAt({...input,angle:NaN}));
 assert.throws(()=>pistonPoseAt({...input,rodLength:20}));
});
