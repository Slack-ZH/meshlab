import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {connect,base} from './linkage-browser.mjs';
import {definitions,isLinkage} from '../dist/experiments/catalog.mjs';
const b=await connect(),report={testedAt:new Date().toISOString(),checks:[]};
const state=()=>b.evaluate('window.__experimentLab.getState()');
async function check(name,fn){try{await fn();report.checks.push({name,status:'PASS'});}catch(e){report.checks.push({name,status:'FAIL',error:e.stack});console.error(name,e.message);}}
try{
  for(const kind of Object.keys(definitions)){
    await b.command('Page.bringToFront');await b.viewport(1440,1080);await b.command('Page.navigate',{url:base+kind+'.html'});await b.waitFor('window.__experimentLab?.getState().ready');await b.settle();
    if(!['bevel-gears','scissor-jack','ratchet-pawl'].includes(kind))await check(kind+' physical pointer drives input',async()=>{
      await b.click('#front-view');await b.click('#drag-mode');const s=await state(),pivot=s.view.joints.O||s.view.joints.A;
      const point=['scotch-yoke','quick-return'].includes(kind)?s.view.joints.B:isLinkage(kind)?{x:(s.view.joints.B.x+pivot.x)/2,y:(s.view.joints.B.y+pivot.y)/2}:{x:pivot.x+27,y:pivot.y};
      const dx=point.x-pivot.x,dy=point.y-pivot.y,t=-.25,target={x:pivot.x+dx*Math.cos(t)-dy*Math.sin(t),y:pivot.y+dx*Math.sin(t)+dy*Math.cos(t)};
      await b.command('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});assert.ok(Math.abs((await state()).input-s.input)<.01,'input jumped on grab');await b.command('Input.dispatchMouseEvent',{type:'mouseMoved',...target,button:'left',buttons:1});await b.command('Input.dispatchMouseEvent',{type:'mouseReleased',...target,button:'left',clickCount:1});await b.settle();assert.ok(Math.abs((await state()).input-s.input)>2,'pointer did not change input');assert.equal((await state()).playing,false);await b.click('#drag-mode');await b.click('#reset-parameters');
    });
    if(isLinkage(kind))await check(kind+' joint labels toggle and hide while disassembled',async()=>{await b.click('#joint-toggle');assert.equal(await b.evaluate('document.getElementById("joint-labels").hidden'),false);assert.ok(await b.evaluate('Array.from(document.querySelectorAll("[data-joint]")).some(e=>!e.hidden)'));await b.click('#explode-all');assert.equal(await b.evaluate('Array.from(document.querySelectorAll("[data-joint]")).some(e=>!e.hidden)'),false);await b.click('#assemble-all');await b.click('#joint-toggle');});
    await check(kind+' phone four-step instructions and buttons remain visible without clipping',async()=>{
      await b.viewport(360,740);await b.click('[data-mode="steps"]');for(let i=0;i<4;i++)await b.click('#step-next');await b.evaluate('document.querySelector(".control-deck").scrollIntoView({block:"center"})');await b.settle();
      const r=await b.evaluate(`(()=>{const d=document.querySelector('.control-deck').getBoundingClientRect(),copy=document.getElementById('step-copy').getBoundingClientRect(),next=document.getElementById('step-next').getBoundingClientRect();return{overflow:document.documentElement.scrollWidth>innerWidth+1,deckBottom:d.bottom,copyBottom:copy.bottom,nextBottom:next.bottom,nextTop:next.top,navTop:document.querySelector('.topbar nav').getBoundingClientRect().top};})()`);
      assert.equal(r.overflow,false);assert.ok(r.copyBottom<=r.deckBottom);assert.ok(r.nextBottom<=r.deckBottom);assert.ok(r.nextBottom<=r.navTop+1,'navigation covers step button');
      const shot=await b.command('Page.captureScreenshot',{format:'png'});await writeFile(new URL('../test-results/full-standard/'+kind+'-360-step4.png',import.meta.url),Buffer.from(shot.data,'base64'));await b.click('#step-prev');assert.equal((await state()).view.step,3);
    });
    console.log(kind,report.checks.filter(c=>c.name.startsWith(kind)).map(c=>c.status).join(' '));
  }
}catch(e){report.fatal=e.stack;}finally{report.errors=b.errors;report.status=!report.fatal&&!report.errors.length&&report.checks.every(c=>c.status==='PASS')?'PASS':'FAIL';await writeFile(new URL('../test-results/full-standard/input-browser-report.json',import.meta.url),JSON.stringify(report,null,2));await b.close();}
console.log(JSON.stringify(report));if(report.status!=='PASS')process.exitCode=1;
