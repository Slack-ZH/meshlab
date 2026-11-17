import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sequence, wrap} from './dist/motion.mjs';

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
    if(s.done){assert.equal(s.reveal,1);assert.ok(newSeen);done=true;}
  }
  assert.ok(done);
}
assert.equal(wrap(-1,3),2);
assert.equal(wrap(3,3),0);
const html=await readFile(new URL('./dist/index.html',import.meta.url),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
assert.equal(new Set(ids).size,ids.length,'unique control IDs');
const source=await readFile(new URL('./dist/app.mjs',import.meta.url),'utf8');
for(const [,id]of source.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.includes(id),'missing control '+id);
console.log('PASS: projection order, movement blackout, completion, reduced motion, wraparound and control bindings.');
