import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {connect,base} from './linkage-browser.mjs';
import {models} from '../dist/catalog/registry.mjs';
import {definitions} from '../dist/experiments/catalog.mjs';

const expected=JSON.parse(await readFile(new URL('../dist/catalog/models.json',import.meta.url),'utf8')).items;
const b=await connect(),report={testedAt:new Date().toISOString(),checks:[],failedResources:[]};
b.on('Network.responseReceived',({response})=>{if(response.status>=400)report.failedResources.push({path:new URL(response.url).pathname,status:response.status});});
async function check(name,run){try{await run();report.checks.push({name,status:'PASS'});console.log('PASS',name);}catch(e){report.checks.push({name,status:'FAIL',error:e.stack});console.error(name,e.message);}}
async function home(){await b.command('Page.navigate',{url:base+'index.html'});await b.waitFor('document.querySelectorAll(".catalog-entry").length===55');await b.settle();}
try{
  await b.command('Network.enable');await b.command('Page.bringToFront');
  for(const [width,height]of [[1440,1080],[390,844],[360,740]])await check(`home ${width}px preserves all 55 links and searchable W entries`,async()=>{
    await b.viewport(width,height);await home();
    const actual=await b.evaluate('Array.from(document.querySelectorAll(".catalog-entry"),a=>a.getAttribute("href"))');
    assert.deepEqual(actual.sort(),expected.map(m=>m.url).sort());
    assert.equal(await b.evaluate('document.documentElement.scrollWidth>innerWidth+1'),false,'horizontal overflow');
    for(const [id,d]of Object.entries(definitions)){await b.change('catalog-search',d.title);assert.ok(await b.evaluate(`!document.querySelector('.catalog-entry[href="${id}.html"]').hidden`));}
    await b.change('catalog-search','unmatched-integration-query');assert.equal(await b.evaluate('document.querySelectorAll(".catalog-entry:not([hidden])").length'),0);assert.equal(await b.evaluate('document.getElementById("catalog-empty").hidden'),false);
    await b.change('catalog-search','');assert.equal(await b.evaluate('document.querySelectorAll(".catalog-entry:not([hidden])").length'),55);
  });
  await b.viewport(1440,1080);
  for(const [id,d]of Object.entries(definitions))await check(id+' homepage link opens the correct complete experiment',async()=>{
    await home();await b.click(`.catalog-entry[href="${id}.html"]`);await b.waitFor(`window.__experimentLab?.getState().ready&&window.__experimentLab.getState().kind===${JSON.stringify(id)}`);
    assert.equal(await b.evaluate('document.querySelector("h1").textContent'),d.title);assert.equal(await b.evaluate('!!window.__catalogLab'),false);
  });
  for(const model of models)await check(model.id+' existing catalog identity, selection, motion and assembly remain available',async()=>{
    await b.command('Page.navigate',{url:base+'catalog.html?model='+encodeURIComponent(model.id)});
    await b.waitFor(`window.__catalogLab?.getState().model?.id===${JSON.stringify(model.id)}&&document.querySelector('#parts-list button')`);
    await b.waitFor('["ready","pending"].includes(document.getElementById("chat-connection").dataset.state)');
    await b.click('#parts-list button');
    const snapshot=await b.evaluate('window.__catalogLab.getState()');assert.equal(snapshot.model.id,model.id);assert.equal(snapshot.geometryValid,true);assert.equal(await b.evaluate('document.getElementById("chat-context-part").textContent'),snapshot.selectedPart.name);assert.equal(await b.evaluate('!!window.__experimentLab'),false);
    if(await b.evaluate('document.getElementById("chat-connection").dataset.state==="pending"'))assert.equal(await b.evaluate('document.getElementById("chat-input").readOnly&&document.getElementById("chat-send").disabled'),true,'unsupported catalog protocol must remain blocked');
    await b.click('#play');await b.waitFor('window.__catalogLab.getState().playing');await b.wait(120);assert.notEqual((await b.evaluate('window.__catalogLab.getState()')).phase,snapshot.phase);await b.click('#play');
    await b.click('#explode-all');assert.equal(await b.evaluate('document.getElementById("explode").value'),'100');assert.equal((await b.evaluate('window.__catalogLab.getState()')).playing,false);
    await b.click('#assemble-all');assert.equal(await b.evaluate('document.getElementById("explode").value'),'0');
  });
}catch(e){report.fatal=e.stack;}finally{
  report.errors=b.errors;report.status=!report.fatal&&!report.errors.length&&!report.failedResources.length&&report.checks.every(c=>c.status==='PASS')?'PASS':'FAIL';
  const out=new URL('../test-results/w11-integration/',import.meta.url);await mkdir(out,{recursive:true});await writeFile(new URL('integration-browser-report.json',out),JSON.stringify(report,null,2));await b.close();
}
console.log(JSON.stringify({status:report.status,checks:report.checks.length,failures:report.checks.filter(c=>c.status==='FAIL'),errors:report.errors,failedResources:report.failedResources,fatal:report.fatal}));if(report.status!=='PASS')process.exitCode=1;
