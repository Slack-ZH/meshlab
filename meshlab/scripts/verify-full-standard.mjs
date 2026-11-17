import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {connect,base} from './linkage-browser.mjs';
import {definitions,assemblySteps,defaults,isLinkage} from '../dist/experiments/catalog.mjs';
import {teachingChecks,assertTeachingCoverage} from './experiment-teaching-checks.mjs';
assertTeachingCoverage(Object.keys(definitions));
const b=await connect(),out=new URL('../test-results/full-standard/',import.meta.url),downloads=new URL('downloads-'+Date.now()+'/',out);
const report={testedAt:new Date().toISOString(),checks:[],errors:b.errors};
const state=()=>b.evaluate('window.__experimentLab.getState()');
const near=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
async function shot(name){const r=await b.command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(new URL(name+'.png',out),Buffer.from(r.data,'base64'));}
async function check(name,run){try{await run();report.checks.push({name,status:'PASS'});}catch(e){report.checks.push({name,status:'FAIL',error:e.stack});console.error(name,e.message);}}
async function layout(){
  const r=await b.evaluate(`(()=>{const p=document.getElementById('viewport').getBoundingClientRect(),h=document.querySelector('.view-hint').getBoundingClientRect(),d=document.querySelector('.control-deck').getBoundingClientRect();return{overflow:document.documentElement.scrollWidth>innerWidth+1,visible:!document.getElementById('explore').hidden,left:p.left,right:p.right,top:p.top,bottom:p.bottom,hint:h.bottom,deck:d.top};})()`);assert.equal(r.overflow,false,'horizontal overflow');
  if(r.visible){assert.ok(r.hint<=r.deck+1,'hint overlaps deck');for(const p of (await state()).view.parts.filter(p=>p.visible))for(const [x,y]of p.projected){assert.ok(x>=r.left-1&&x<=r.right+1,`clipped x ${p.id} ${x} [${r.left},${r.right}]`);assert.ok(y>=r.top-1&&y<=r.bottom+1,`clipped y ${p.id} ${y} [${r.top},${r.bottom}]`);}}
}
async function navigate(kind){await b.command('Page.bringToFront');await b.command('Page.navigate',{url:new URL(kind+'.html',base).href});await b.waitFor('window.__experimentLab?.getState().ready');await b.settle();}
async function catalogue(){if(await b.evaluate('document.getElementById("parts-panel").hidden'))await b.click('#open-parts');}
async function closeCatalogue(){if(!await b.evaluate('document.getElementById("parts-panel").hidden'))await b.click('#close-parts');}
async function select(id){await catalogue();await b.click('[data-part="'+id+'"]');await closeCatalogue();}
try{
  await mkdir(out,{recursive:true});await mkdir(downloads,{recursive:true});await b.command('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:fileURLToPath(downloads)});
  await b.command('Page.addScriptToEvaluateOnNewDocument',{source:`window.__spoken=[];Object.defineProperty(window,'speechSynthesis',{value:{speaking:false,speak(u){window.__spoken.push({text:u.text,lang:u.lang});this.speaking=true;},cancel(){this.speaking=false;}}});`});
  await b.command('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});
  for(const kind of Object.keys(definitions)){
    await b.viewport(1440,1080);await navigate(kind);
    await check(kind+' full baseline shell, real service health and login entry',async()=>{
      const ids=await b.evaluate('Array.from(document.querySelectorAll("[id]"),e=>e.id)');assert.equal(new Set(ids).size,ids.length,'duplicate IDs');for(const id of ['auth-dialog','chat-tab','details-tab','part-search','part-spec','part-material','speak','clarity-toggle','labels-toggle','download-parameters','download-data'])assert.ok(ids.includes(id),id);
      await b.waitFor('document.getElementById("chat-connection").textContent.includes("已连接")');
      await b.waitFor('!document.getElementById("chat-login").disabled');await b.click('#chat-login');assert.equal(await b.evaluate('document.getElementById("auth-dialog").open'),true);await b.click('#auth-close');assert.equal(await b.evaluate('document.getElementById("auth-dialog").open'),false);
      await layout();await shot(kind+'-desktop-default');
    });
    await check(kind+' searchable categorized catalogue and all part specifications',async()=>{
      const parts=(await state()).view.parts;
      assert.deepEqual([...new Set(assemblySteps[kind].flatMap(s=>s.parts))].sort(),parts.map(p=>p.id).sort(),'all actual parts assigned a step');
      for(const part of parts){await select(part.id);const s=await state();assert.equal(s.selectedPart.id,part.id);assert.ok(s.selectedPart.spec.length>4);assert.ok(s.selectedPart.description.length>8);assert.equal(s.view.parts.filter(p=>p.highlighted).length,1);assert.equal(await b.evaluate('document.getElementById("chat-context-part").textContent'),s.selectedPart.name);}
      await catalogue();await b.change('part-search','no-such-part');assert.equal(await b.evaluate('document.querySelectorAll("#parts-list [data-part]").length'),0);await b.change('part-search','');await b.click('[data-filter="housing"]');assert.ok(await b.evaluate('document.querySelectorAll("#parts-list [data-part]").length>0'));await b.click('[data-filter="transmission"]');assert.ok(await b.evaluate('document.querySelectorAll("#parts-list [data-part]").length>0'));await b.click('[data-filter="all"]');assert.equal(await b.evaluate('document.querySelectorAll("#parts-list [data-part]").length'),parts.length);
      for(const type of ['keyDown','keyUp'])await b.command('Input.dispatchKeyEvent',{type,key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await b.settle();assert.equal(await b.evaluate('document.getElementById("parts-panel").hidden'),true);
    });
    await check(kind+' details, narration API, highlight label, clarity and support modes',async()=>{
      await select('output');await b.click('#details-tab');assert.equal(await b.evaluate('document.getElementById("details-pane").hidden'),false);await b.click('#speak');const utterance=await b.evaluate('window.__spoken.at(-1)');assert.equal(utterance.lang,'zh-CN');assert.ok(utterance.text.includes((await state()).selectedPart.spec));await b.click('#speak');assert.equal(await b.evaluate('speechSynthesis.speaking'),false);
      await b.click('#labels-toggle');assert.equal(await b.evaluate('document.getElementById("selection-label").hidden'),false);await shot(kind+'-desktop-selected');await b.click('#labels-toggle');
      const previous=await b.evaluate('document.getElementById("clarity-toggle").getAttribute("aria-pressed")');await b.click('#clarity-toggle');assert.notEqual(await b.evaluate('document.getElementById("clarity-toggle").getAttribute("aria-pressed")'),previous);await b.click('#clarity-toggle');
      for(const mode of ['transparent','open','solid']){await b.change('housing-mode',mode,'change');assert.equal((await state()).view.housing,mode==='open'?'hidden':mode);}
      await b.click('#chat-tab');await b.evaluate('document.getElementById("chat-tab").focus()');for(const type of ['keyDown','keyUp'])await b.command('Input.dispatchKeyEvent',{type,key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});await b.settle();assert.equal(await b.evaluate('document.getElementById("details-tab").getAttribute("aria-selected")'),'true');await b.click('#chat-tab');
    });
    await check(kind+' free explosion and four distinct assembly steps preserve input',async()=>{
      const input=(await state()).input;await b.click('#explode-all');assert.equal((await state()).view.amount,1);assert.equal((await state()).playing,false);await layout();await shot(kind+'-desktop-exploded');await b.click('#assemble-all');near((await state()).input,input);
      await b.click('[data-mode="steps"]');for(let i=1;i<=4;i++){await b.click('#step-next');assert.equal((await state()).view.step,i);assert.equal(await b.evaluate('document.getElementById("step-title").textContent'),assemblySteps[kind][i].title);await layout();}for(let i=3;i>=0;i--){await b.click('#step-prev');assert.equal((await state()).view.step,i);}near((await state()).input,input);await b.click('[data-mode="free"]');
    });
    await check(kind+' immediate numeric/slider changes, invalid-state isolation and recovery',async()=>{
      const before=await state(),field=definitions[kind].fields[0],key=field.key,value=field.value+(field.step||1);
      await b.change(key,value);let s=await state();assert.equal(s.valid,true);assert.equal(s.params[key],value);assert.equal(s.modelParameters[key],value);assert.equal(await b.evaluate(`Number(document.getElementById('${key}-slider').value)`),value);
      await b.change(key+'-slider',field.value);assert.equal((await state()).params[key],field.value);assert.equal(await b.evaluate(`Number(document.getElementById('${key}').value)`),field.value);
      await b.change(key,-5);s=await state();assert.equal(s.valid,false);assert.equal(s.params[key],-5);assert.deepEqual(s.modelParameters,before.modelParameters);assert.equal(s.result,null);assert.equal(await b.evaluate('document.getElementById("download-data").disabled'),true);assert.equal(await b.evaluate('document.getElementById("angle").disabled'),true);assert.match(await b.evaluate('document.querySelector(".chat-context>span").textContent'),/参数待修正/);await b.click('#play');assert.equal((await state()).playing,false);
      await b.change(key,field.value);assert.equal((await state()).valid,true);assert.equal(await b.evaluate('document.getElementById("download-data").disabled'),false);await b.click('#reset-parameters');
    });
    await check(kind+' input, 20% playback, pause and zero RPM',async()=>{
      const before=(await state()).input;await b.click('#play');await b.wait(180);assert.notEqual((await state()).input,before);await b.click('#play');const stopped=(await state()).input;await b.wait(150);near((await state()).input,stopped);assert.equal((await state()).view.animationScale,.2);
      const r=(await state()).range;await b.change('angle-number',r.min+(r.max-r.min)*.63);near((await state()).input,r.min+(r.max-r.min)*.63,.01);
      await b.change('rpm',0);await b.click('#play');assert.equal((await state()).playing,false);await b.change('speed',1.5);assert.equal((await state()).speed,1.5);await b.change('speed',1);await b.click('#reset-parameters');
    });
    await check(kind+' orthographic views and fullscreen',async()=>{for(const id of ['front-view','top-view','home-view']){await b.click('#'+id);await layout();}await b.command('Page.bringToFront');await b.evaluate('document.getElementById("fullscreen").onclick()');await b.waitFor('!!document.fullscreenElement');await b.settle();await layout();await b.evaluate('document.exitFullscreen()');await b.settle();await layout();});
    await check(kind+' specific teaching behaviour',async()=>{
      await teachingChecks[kind](b,state);
      await b.click('#reset-parameters');
    });
    await check(kind+' live principles and JSON/CSV exports',async()=>{await b.click('[data-tab="performance"]');assert.ok(await b.evaluate('document.getElementById("current-example").textContent.includes("当前输入")'));await layout();await b.click('[data-tab="calibration"]');await b.click('#download-parameters');await b.click('#download-data');await b.wait(150);const json=JSON.parse(await readFile(new URL(kind+'-experiment.json',downloads),'utf8'));assert.equal(json.mechanism,kind);assert.deepEqual(json.parameters,(await state()).modelParameters);assert.equal(json.animationScale,.2);const csv=await readFile(new URL(kind+'-experiment.csv',downloads),'utf8');assert.equal(csv.trim().split(/\r?\n/).length,362);assert.ok(!csv.includes('NaN'));await b.click('[data-tab="explore"]');});
    for(const [width,height]of [[390,844],[360,740]])await check(kind+` ${width}px default, selected, exploded and controls layout`,async()=>{
      await b.viewport(width,height);await b.click('#reset-parameters');await b.evaluate('scrollTo(0,0)');await b.settle();await layout();await shot(`${kind}-${width}-default`);await select('output');await layout();await shot(`${kind}-${width}-selected`);await b.click('#explode-all');await layout();await shot(`${kind}-${width}-exploded`);await b.click('#assemble-all');assert.ok(await b.evaluate('document.querySelector(".parameter-panel").getBoundingClientRect().top<document.querySelector(".assistant-sidebar").getBoundingClientRect().top'));await b.evaluate('document.querySelector(".parameter-panel").scrollIntoView({block:"start"})');await b.settle();await layout();await shot(`${kind}-${width}-parameters`);await b.evaluate('scrollTo(0,0)');
    });
    await check(kind+' dark appearance',async()=>{await b.viewport(1440,1080);await b.command('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'}]});await b.settle();await layout();await shot(kind+'-dark');await b.command('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});});
    console.log(kind,report.checks.filter(c=>c.name.startsWith(kind)).map(c=>c.status).join(' '));
  }
  report.status=report.checks.every(c=>c.status==='PASS')&&!report.errors.length?'PASS':'FAIL';
}catch(e){report.status='ERROR';report.fatal=e.stack;}finally{await writeFile(new URL('browser-report.json',out),JSON.stringify(report,null,2));await b.close();}
console.log(JSON.stringify({status:report.status,passed:report.checks.filter(c=>c.status==='PASS').length,failed:report.checks.filter(c=>c.status==='FAIL').length,errors:report.errors,fatal:report.fatal}));if(report.status!=='PASS')process.exitCode=1;
