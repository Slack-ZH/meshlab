import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, differentialSpeeds, initialAngles, advanceAngles } from '../dist/open-differential/kinematics.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≠ ${b}`);

test('straight: equal half-shafts, zero spin relative to revolving carrier',()=>{
  const n=differentialSpeeds();near(n.left,60);near(n.right,60);near(n.spider,0);near(n.input,240);
  const a=advanceAngles(initialAngles(),n,.5);near(a.left,Math.PI);near(a.right,Math.PI);near(a.carrier,Math.PI);near(a.spider,0);
});
test('left/right cornering: inner/outer rolling distances and opposite spider spin',()=>{
  const l=differentialSpeeds(defaults,'left'),r=differentialSpeeds(defaults,'right');
  near(l.left,48);near(l.right,72);near(l.spider,-24);near(r.left,72);near(r.right,48);near(r.spider,24);
  near(l.left/l.right,(4-.8)/(4+.8));near(l.left+r.left,120);
});
test('entire UI parameter range conserves average speed and bounds outputs',()=>{
  for(let rpm=10;rpm<=120;rpm+=11)for(let track=1.2;track<=2;track+=.1)for(let radius=3;radius<=20;radius+=.5){
    for(const mode of ['straight','left','right']){
      const n=differentialSpeeds({carrierRpm:rpm,trackWidth:track,turnRadius:radius},mode);
      near((n.left+n.right)/2,rpm);assert.ok(n.left>0&&n.right>0);near(n.spider,n.left-n.right);
    }
  }
});
test('turn radius controls differential action; straight does not depend on radius',()=>{
  assert.ok(Math.abs(differentialSpeeds({...defaults,turnRadius:3},'left').delta)>Math.abs(differentialSpeeds({...defaults,turnRadius:12},'left').delta));
  assert.deepEqual(differentialSpeeds({...defaults,turnRadius:3}),differentialSpeeds({...defaults,turnRadius:20}));
});
test('switching mode preserves angular phase and reverses relative spin smoothly',()=>{
  const straight=differentialSpeeds(),left=differentialSpeeds(defaults,'left'),right=differentialSpeeds(defaults,'right');
  let a=advanceAngles(initialAngles(),left,.23),before={...a};
  assert.deepEqual(advanceAngles(a,right,0),before);
  a=advanceAngles(a,straight,.5);near(a.spider,before.spider);near((a.left+a.right)/2,a.carrier);
  a=advanceAngles(a,right,.23);near(a.spider,0);near(a.left,a.right);
  near(a.input,4*a.carrier);near(a.spider,a.left-a.right);
});
test('bad inputs rejected before invalid motion reaches the renderer',()=>{
  for(const params of [{...defaults,turnRadius:.8},{...defaults,trackWidth:0},{...defaults,carrierRpm:NaN}])assert.throws(()=>differentialSpeeds(params),RangeError);
  assert.throws(()=>differentialSpeeds(defaults,'unknown'),RangeError);assert.throws(()=>advanceAngles(initialAngles(),differentialSpeeds(),-1),RangeError);
});
