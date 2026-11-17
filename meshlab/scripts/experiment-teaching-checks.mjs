import assert from 'node:assert/strict';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
// New mechanisms must register a meaningful expected teaching behaviour here.
// A shared UI passing cannot substitute for the mechanism's actual behaviour.
export const teachingChecks={
  'scotch-yoke':async(b,state)=>{await b.change('angle',90);const s=await state();near(s.result.displacement,s.params.r);assert.ok(s.result.comparison>s.result.displacement);},
  'crank-rocker':checkRocker,
  'parallelogram':async(b,state)=>{for(const a of [30,110]){await b.change('angle',a);near((await state()).result.couplerAngle,0);}},
  'double-rocker':checkRocker,
  'quick-return':async(b,state)=>{const s=await state();assert.ok(s.result.workTime>s.result.returnTime);near(s.result.workTime/s.result.returnTime,s.result.ratio);},
  'bevel-gears':async(b,state)=>{await b.change('z2',36);const s=await state();near(s.result.ratio,36/s.params.z1);near(s.result.outputRPM,s.params.rpm*s.params.z1/36);},
  'scissor-jack':async(b,state)=>{const r=(await state()).range;await b.change('angle-number',r.max);await b.click('#play');assert.equal((await state()).playing,false);await b.click('#reverse');await b.click('#play');await b.wait(180);assert.ok((await state()).input<r.max);await b.click('#play');},
  'ratchet-pawl':async(b,state)=>{await b.click('#drive-phase');assert.equal((await state()).result.driving,true);await b.click('#return-phase');assert.equal((await state()).result.driving,false);const value=(await state()).result.outputAngle;await b.change('angle',320);near((await state()).result.outputAngle,value);},
  'eccentric-follower':async(b,state)=>{await b.change('eccentricity',0);near((await state()).result.stroke,0);for(const a of [90,270]){await b.change('angle',a);near((await state()).result.displacement,0);}},
  'roller-cam':async(b,state)=>{for(const [angle,phase]of [[60,'推程'],[150,'高位停歇'],[240,'回程'],[330,'低位停歇']]){await b.change('angle',angle);assert.equal((await state()).result.phase,phase);}for(const [key,v]of [['rise',150],['dwell',90],['fall',150]])await b.change(key,v);assert.equal((await state()).valid,false);},
  'geneva-drive':async(b,state)=>{await b.change('slots',6);near((await state()).result.stepAngle,60);await b.change('angle',40);const angle=(await state()).result.outputAngle;await b.change('angle',80);near((await state()).result.outputAngle,angle);await b.change('angle',210);assert.ok((await state()).result.outputAngle<angle);},
};
async function checkRocker(b,state){const s=await state();assert.ok(s.result.maximum>s.result.minimum);await b.change('angle',s.range.max);assert.ok((await state()).result.outputAngle<=(await state()).result.maximum+1);}
export function assertTeachingCoverage(kinds){for(const kind of kinds)assert.equal(typeof teachingChecks[kind],'function',kind+': 缺少机构专属行为检查，不能只靠通用页面通过验收');}
