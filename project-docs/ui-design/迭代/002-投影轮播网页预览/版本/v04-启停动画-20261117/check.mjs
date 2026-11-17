import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sequence, duration, timing, wrap} from './dist/motion.mjs';

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
