import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sequence, duration, timing, wrap} from './dist/motion.mjs';
import {createPresentation,createPlayback,AUTO_SPEED,RESUME_DELAY,PITCH_LIMIT} from './dist/presentation.mjs';
import {matchesQuery} from './dist/catalogue.mjs';

for (const mode of [{},{replay:true},{initial:true},{reduced:true}]) {
  let oldClosed=false,newSeen=false,done=false;
  for(let t=0;t<5;t+=.005){
    const s=sequence(t,mode);
    assert.ok(s.reveal>=0&&s.reveal<=1&&s.power>=0&&s.power<=1);
    if(s.reveal===0||mode.initial)oldClosed=true;
    if(s.newModel){
      if(!mode.reduced)assert.ok(oldClosed,'new projection must not start over the old projection');
      newSeen=true;
    }
    if(s.phase==='moving'){assert.equal(s.reveal,0);assert.equal(s.power,0);}
    if(mode.replay)assert.notEqual(s.phase,'moving','single-unit sequence must not move the projector');
    if(s.done){assert.equal(s.reveal,1);assert.ok(newSeen);done=true;}
  }
  assert.ok(done);
}
assert.equal(wrap(-1,3),2);
assert.equal(wrap(3,3),0);
// Protect the visible sequence, zero-overlap model exchange, and smooth envelopes.
for(const mode of [{},{initial:true},{replay:true},{reduced:true},{reduced:true,initial:true}]){
  const phases=[];let previous=sequence(0,mode);
  for(let t=0;t<duration(mode)+.02;t+=.001){
    const current=sequence(t,mode);
    if(phases.at(-1)!==current.phase)phases.push(current.phase);
    for(const key of ['reveal','power','lift','contour','discharge'])assert.ok(Number.isFinite(current[key])&&current[key]>=0&&current[key]<=1,key+' is bounded');
    if(current.newModel&&!previous.newModel){assert.ok(previous.reveal<.001);assert.ok(current.reveal<.001,'no visible surface at model exchange (1 ms sampling)');}
    assert.ok(Math.abs(current.reveal-previous.reveal)<.015,'surface visibility must not jump');
    if(!mode.reduced)assert.ok(Math.abs(current.power-previous.power)<.015,'emitter energy must not jump');
    if(current.phase==='launching'||current.phase==='igniting')assert.equal(current.reveal,0,'source and light lead the model');
    if(mode.reduced){assert.equal(current.contour,0);assert.equal(current.lift,0);}
    assert.notEqual(current.phase,'moving','the only device stays fixed');
    previous=current;
  }
  assert.deepEqual(phases,mode.reduced?(mode.initial?['forming','ready']:['closing','forming','ready']):(mode.initial?['igniting','launching','forming','settling','ready']:['closing','blackout','igniting','launching','forming','settling','ready']));
  assert.ok(sequence(duration(mode)+.001,mode).done);
}
assert.equal(sequence(timing.closing+.01).power,0,'source shuts down before restarting');
const html=await readFile(new URL('./dist/index.html',import.meta.url),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
assert.equal(new Set(ids).size,ids.length,'unique control IDs');
const source=await readFile(new URL('./dist/app.mjs',import.meta.url),'utf8');
for(const [,id]of source.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.includes(id),'missing control '+id);
console.log('PASS: projection order, movement blackout, completion, reduced motion, wraparound and control bindings.');

// A new model starts moving before the projection reaches ready, without a phase jump.
for(const fps of [30,60,120]){
  const clock=createPlayback();let lastTime=0,lastSpeed=0,movedWhileForming=false;
  for(let elapsed=0;elapsed<duration({initial:true})+.5;elapsed+=1/fps){
    const sample=sequence(elapsed,{initial:true});
    const time=clock.advance(1/fps,sample.drive);
    assert.ok(time>=lastTime&&time-lastTime<=1/fps+1e-9,'no skipped pose or backwards motion');
    assert.ok(Math.abs(clock.speed-lastSpeed)<.075,'motion eases across formation/settling/ready');
    if(sample.phase==='forming'&&clock.speed>.01)movedWhileForming=true;
    lastTime=time;lastSpeed=clock.speed;
  }
  assert.ok(movedWhileForming,'start the mechanism during the forming tail');
  assert.ok(clock.speed>.98,'reach normal motion smoothly');
}
const a=createPlayback(),b=createPlayback();
a.advance(2);const saved=a.time;b.advance(30);
assert.equal(a.time,saved,'hidden model retains its own phase');
a.advance(10,1,true);assert.equal(a.time,saved,'paused/exploded frames do not accumulate motion');
a.advance(.016,1);assert.ok(a.time-saved<.016,'resume without catch-up jump');
const rotation=createPresentation();
for(let i=0;i<240;i++)rotation.advance(1/60);
assert.ok(rotation.yaw>.2&&rotation.speed>AUTO_SPEED*.99,'idle rotation is active');
rotation.begin();rotation.drag(400,10000,800,450);assert.equal(rotation.pitch,PITCH_LIMIT);
const draggedYaw=rotation.yaw;rotation.advance(1);assert.equal(rotation.yaw,draggedYaw,'no auto turn during drag');
rotation.end();rotation.advance(RESUME_DELAY-.1);assert.equal(rotation.yaw,draggedYaw,'hold the angle after release');
rotation.advance(.2);assert.ok(rotation.yaw>draggedYaw,'resume from the chosen angle');
const still=rotation.yaw;rotation.advance(2,{frozen:true});assert.equal(rotation.yaw,still,'pause and reduced mode stop auto turn');
rotation.reset();rotation.advance(.6,{frozen:true});assert.equal(rotation.yaw,0);assert.equal(rotation.pitch,0);
const byStep=createPresentation(),bySecond=createPresentation();
for(let i=0;i<60;i++)byStep.advance(1/60);bySecond.advance(1);
assert.ok(Math.abs(byStep.yaw-bySecond.yaw)<1e-10,'rotation does not depend on frame rate');
console.log('PASS: smooth mechanical handoff at 30/60/120 FPS, per-model phase retention, pause/resume, drag bounds, delayed auto rotation, reset and frame-rate-independent integration.');
assert.ok(matchesQuery('齿轮齿条 rack pinion 啮合传动 直线',' 齿条 直线 '));
assert.ok(matchesQuery('摩擦轮传动 friction 接触传动','ＦＲＩＣＴＩＯＮ'));
assert.ok(matchesQuery('摩擦轮传动',''));
assert.ok(!matchesQuery('摩擦轮传动 friction','齿条'));
assert.ok(!matchesQuery('齿轮齿条 rack','rack friction'));
console.log('PASS: catalogue Chinese/English search, Unicode normalization, multiword matching, empty queries and no results.');
