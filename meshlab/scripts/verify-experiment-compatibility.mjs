import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {connect,base} from './linkage-browser.mjs';
import {definitions,assemblySteps} from '../dist/experiments/catalog.mjs';
const b=await connect(),report={testedAt:new Date().toISOString(),checks:[],failedResources:[]};
b.on('Network.responseReceived',({response})=>{if(response.status>=400)report.failedResources.push({path:new URL(response.url).pathname,status:response.status});});
async function check(name,fn){try{await fn();report.checks.push({name,status:'PASS'});}catch(e){report.checks.push({name,status:'FAIL',error:e.stack});console.error(name,e.message);}}
try{
  await b.command('Network.enable');await b.viewport(1440,1080);
  for(const [page,stateKey]of [['lab','__gearLab'],['turbine','__turbineLab'],['bicycle','__bicycleLab'],['friction','__frictionLab'],['spur','__spurLab'],['idler','__idlerLab'],['belt','__beltLab'],['timing','__timingLab'],['vice','__viceLab']])await check(page+' shared chat loads without changing original model identity',async()=>{
    await b.command('Page.bringToFront');await b.command('Page.navigate',{url:base+page+'.html'});await b.waitFor(`window.${stateKey}&&document.querySelector('#parts-list button')`);await b.click('#parts-list button');await b.waitFor('document.getElementById("chat-connection").dataset.state==="ready"');
    const r=await b.evaluate('({context:document.getElementById("chat-context-part").textContent,title:document.querySelector("#detail-content h3").textContent,newState:!!window.__experimentLab})');assert.equal(r.newState,false);assert.equal(r.context,r.title);assert.ok(r.context.length>0);await b.click('#details-tab');assert.equal(await b.evaluate('document.getElementById("details-pane").hidden'),false);
  });
  for(const kind of Object.keys(definitions))await check(kind+' final assembly status matches displayed step',async()=>{
    await b.command('Page.navigate',{url:base+kind+'.html'});await b.waitFor('window.__experimentLab?.getState().ready');await b.click('[data-mode="steps"]');for(let i=0;i<4;i++)await b.click('#step-next');assert.ok(await b.evaluate(`document.getElementById('status-message').textContent.includes(${JSON.stringify(assemblySteps[kind][4].title)})`));await b.click('[data-mode="free"]');assert.ok(await b.evaluate('document.getElementById("status-message").textContent.includes("已复原")'));
  });
}catch(e){report.fatal=e.stack;}finally{report.errors=b.errors;report.status=!report.fatal&&!report.errors.length&&!report.failedResources.length&&report.checks.every(c=>c.status==='PASS')?'PASS':'FAIL';await writeFile(new URL('../test-results/full-standard/compatibility-report.json',import.meta.url),JSON.stringify(report,null,2));await b.close();}
console.log(JSON.stringify(report));if(report.status!=='PASS')process.exitCode=1;
