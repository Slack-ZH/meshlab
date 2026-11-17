import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {definitions} from '../dist/experiments/catalog.mjs';
import {models} from '../dist/catalog/registry.mjs';

const expected=['scotch-yoke','crank-rocker','parallelogram','double-rocker','quick-return','bevel-gears','scissor-jack','ratchet-pawl','eccentric-follower','roller-cam','geneva-drive'];
const oldPages=['lab','turbine','bicycle','friction','spur','idler','belt','timing','vice'];
const data=JSON.parse(await readFile(new URL('../dist/catalog/models.json',import.meta.url),'utf8'));
const home=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
test('one searchable homepage exposes all 44 main experiments and exactly the 11 authorized additions',()=>{
  assert.deepEqual(Object.keys(definitions).sort(),[...expected].sort());
  const urls=[...oldPages.map(p=>p+'.html'),...models.map(m=>'catalog.html?model='+m.id),...expected.map(id=>id+'.html')];
  assert.equal(data.count,55);assert.equal(data.items.length,55);assert.equal(new Set(data.items.map(x=>x.url)).size,55);
  assert.deepEqual(data.items.map(x=>x.url).sort(),urls.sort());
  for(const model of models){const row=data.items.find(x=>x.id===model.id);assert.equal(row.title,model.title);assert.equal(row.description,model.description);assert.equal(row.number,model.number);}
  for(const id of expected){const row=data.items.find(x=>x.id===id);assert.equal(row.title,definitions[id].title);assert.equal(row.description,definitions[id].task);}
  const section=home.match(/<!-- catalog:start -->[\s\S]*?<!-- catalog:end -->/)[0];
  assert.equal((section.match(/class="catalog-entry"/g)||[]).length,55);
  for(const url of urls)assert.ok(section.includes('href="'+url+'"'),url);
  assert.ok(!data.items.some(x=>x.url==='rack.html'));
});
test('W runtime imports resolve without the rack page or obsolete lightweight applications',async()=>{
  const files=['experiments/app.mjs','experiments/catalog.mjs','experiments/chat-context.mjs','linkages/viewer.mjs','linkages/mechanics.mjs','mechanisms/viewer.mjs','mechanisms/mechanics.mjs','assets/reference-stage.mjs'];
  for(const path of files){const url=new URL('../dist/'+path,import.meta.url),source=await readFile(url,'utf8');assert.doesNotMatch(source,/from ['"][^'"]*\/rack\//);for(const match of source.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g))await access(new URL(match[1],url));}
  for(const path of ['rack.html','linkages/app.mjs','mechanisms/app.mjs'])await assert.rejects(access(new URL('../dist/'+path,import.meta.url)),{code:'ENOENT'});
});
test('every existing and imported page declares an existing relative favicon',async()=>{
  for(const page of [...oldPages,'index','catalog',...expected]){const url=new URL('../dist/'+page+'.html',import.meta.url),html=await readFile(url,'utf8'),icon=html.match(/<link\b[^>]*rel="icon"[^>]*href="([^"]+)"/);assert.ok(icon,page+' missing icon');assert.ok(!icon[1].startsWith('/'));await access(new URL(icon[1],url));}
});
