import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

// Connect to a separately started headless browser. This script never launches a
// browser or opens a visible window. Keep it independent of page implementation.
const base = new URL(process.env.MESHLAB_BASE_URL || 'http://127.0.0.1:8088/');
if (!base.pathname.endsWith('/')) base.pathname += '/';
const cdp = process.env.MESHLAB_CDP_URL || 'http://127.0.0.1:9337';
const destination = new URL('../test-results/layout/', import.meta.url);
const tolerance = 1;
const dimensions = [[1440,1080],[1100,900],[900,1080],[390,844],[360,740]];
const shared = [
  '.topbar','.topbar nav','.brand','#clarity-toggle',
  '.nav-button:nth-child(1)','.nav-button:nth-child(2)','.nav-button:nth-child(3)',
  '.intro','.workspace','.stage-shell','.viewer-panel','#viewport',
  '.viewer-top','#open-parts','.control-mode','.control-mode button:nth-child(1)',
  '.control-mode button:nth-child(2)','.view-tools','#home-view','#top-view',
  '#front-view','#fullscreen','.view-hint','.control-deck','.motion-controls',
  '#play','#speed','#free-controls','#explode','#explode-all','#assemble-all',
  '.assistant-sidebar','.assistant-tabs','#chat-tab','#details-tab','#chat-pane',
  '.chat-header','#chat-reset','.chat-context','.chat-account','#chat-login',
  '.chat-compose','#chat-input','#chat-send',
];
const stepSelectors = ['.workspace','.stage-shell','.viewer-panel','#viewport',
  '.control-deck','.motion-controls','#play','#speed','#assembly-controls',
  '.step-message','#step-prev','#step-next','.assistant-sidebar','#chat-input','#chat-send'];
const panelSelectors = ['#parts-panel','#close-parts','.parts-panel .panel-heading',
  '.parts-panel .search','#part-search','.filter-tabs','.parts-list','.panel-foot'];
const detailSelectors = ['.workspace','.stage-shell','.viewer-panel','#viewport',
  '.assistant-sidebar','.assistant-tabs','#details-pane','.visibility-controls',
  '.visibility-controls>div','.visibility-controls label','#housing-mode',
  '#labels-toggle'];
const selectedDetailSelectors = [...detailSelectors,'#speak'];
const errors = [];
const consoleErrors = [];
let activePage = '';
let socket;
const pending = new Map();
let sequence = 0;
const report = { baseUrl:base.href, tolerancePx:tolerance, testedAt:new Date().toISOString(),
  viewports:[], errors, consoleErrors };

function command(method, params = {}) {
  return new Promise((resolve,reject)=>{
    const id=++sequence;
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method));},30000);
    pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});
    socket.send(JSON.stringify({id,method,params}));
  });
}
async function evaluate(expression) {
  const result=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression, label, timeout=20000) {
  const until=Date.now()+timeout;
  while(Date.now()<until) {
    try {if(await evaluate(expression))return;} catch(error) {
      if(!/context|Cannot find|navigation|destroyed/i.test(error.message))throw error;
    }
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error('Timed out waiting for '+label+' on '+activePage);
}
async function settle() {
  await evaluate(`(async()=>{await document.fonts.ready;await new Promise(resolve=>setTimeout(resolve,250));scrollTo(0,0);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));})()`);
}
async function click(selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  await settle();
}
async function capture(selectors) {
  return evaluate(`(()=>{
    const rects={};
    for(const selector of ${JSON.stringify(selectors)}){
      const element=document.querySelector(selector);
      if(!element){rects[selector]={missing:true};continue;}
      const r=element.getBoundingClientRect(),css=getComputedStyle(element);
      const visible=!!element.getClientRects().length&&css.visibility!=='hidden';
      rects[selector]={x:r.x,y:r.y,width:r.width,height:r.height,visible};
    }
    return {rects,scrollX,scrollY,overflow:document.documentElement.scrollWidth>innerWidth,
      viewport:{width:innerWidth,height:innerHeight},chat:document.getElementById('chat-connection').textContent};
  })()`);
}
async function screenshot(name) {
  // A viewport screenshot leaves CSS viewport units unchanged and is easy to
  // compare at identical dimensions. Mobile assistant coordinates are in JSON.
  const result=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile(new URL(name,destination),Buffer.from(result.data,'base64'));
}
function compare(reference,current,selectors,mode) {
  const differences=[];
  if(reference.overflow||current.overflow)differences.push({mode,problem:'horizontal overflow',gear:reference.overflow,turbine:current.overflow});
  for(const selector of selectors){
    const a=reference.rects[selector],b=current.rects[selector];
    if(a.missing||b.missing){differences.push({mode,selector,problem:'missing component',gear:a,turbine:b});continue;}
    if(a.visible!==b.visible){differences.push({mode,selector,problem:'visibility mismatch',gear:a.visible,turbine:b.visible});continue;}
    if(!a.visible)continue;
    for(const key of ['x','y','width','height']){
      const delta=b[key]-a[key];
      if(Math.abs(delta)>tolerance)differences.push({mode,selector,property:key,gear:a[key],turbine:b[key],delta});
    }
  }
  return differences;
}

await mkdir(destination,{recursive:true});
try {
  const response=await fetch(cdp+'/json/list',{signal:AbortSignal.timeout(10000)});
  assert.ok(response.ok,'CDP inventory unavailable');
  const targets=await response.json();
  const target=targets.find(item=>item.type==='page');
  assert.ok(target,'No headless page available');
  socket=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  socket.onmessage=event=>{
    const message=JSON.parse(event.data);
    if(message.id){
      const request=pending.get(message.id);if(!request)return;pending.delete(message.id);
      if(message.error)request.reject(new Error(message.error.message));else request.resolve(message.result);
    }else if(message.method==='Runtime.exceptionThrown'){
      errors.push({page:activePage,detail:message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text});
    }else if(message.method==='Runtime.consoleAPICalled'&&message.params.type==='error'){
      consoleErrors.push({page:activePage,detail:message.params.args.map(arg=>arg.description||arg.value).join(' ')});
    }
  };
  await command('Runtime.enable');await command('Page.enable');
  await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'},{name:'prefers-reduced-motion',value:'reduce'}]});
  for(const [width,height] of dimensions){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=760});
    const pair={width,height,pages:{},differences:[]};
    report.viewports.push(pair);
    for(const [kind,file,ready] of [
      ['gear','lab.html','window.__gearLab?.getState().ready'],
      ['turbine','turbine.html','window.__turbineLab?.getState().ready'],
    ]){
      activePage=kind+' '+width+'x'+height;
      await command('Page.navigate',{url:new URL(file,base).href});
      await waitFor(ready,'model ready');
      await waitFor(`document.getElementById('chat-connection')&&!document.getElementById('chat-connection').textContent.includes('正在')`,'chat layout settled',15000);
      await click('#chat-tab');await click('.control-mode button:nth-child(1)');
      const free=await capture(shared);
      await screenshot(`${width}-${kind}-free.png`);
      await click('#open-parts');
      const parts=await capture(panelSelectors);
      await screenshot(`${width}-${kind}-parts.png`);
      await click('#close-parts');
      await click('.control-mode button:nth-child(2)');
      const steps=await capture(stepSelectors);
      await screenshot(`${width}-${kind}-steps.png`);
      await click('.control-mode button:nth-child(1)');
      await click('#details-tab');
      const details=await capture(detailSelectors);
      await screenshot(`${width}-${kind}-details.png`);
      await click('#open-parts');
      await click('#parts-list .part-item');
      await click('#close-parts');
      const selectedDetails=await capture(selectedDetailSelectors);
      await screenshot(`${width}-${kind}-selected-details.png`);
      await click('#chat-tab');
      let parameters=null;
      if(kind==='turbine')parameters=await evaluate(`(()=>{
        const p=document.getElementById('parameters'),w=document.querySelector('.workspace'),s=document.querySelector('.stage-shell');
        if(!p)return {missing:true};
        const a=p.getBoundingClientRect(),b=w.getBoundingClientRect();
        return {visible:!!p.getClientRects().length,insideStage:s.contains(p),insideWorkspace:w.contains(p),afterWorkspace:!!(w.compareDocumentPosition(p)&Node.DOCUMENT_POSITION_FOLLOWING),top:a.top,workspaceBottom:b.bottom};
      })()`);
      pair.pages[kind]={free,parts,steps,details,selectedDetails,parameters};
    }
    const gear=pair.pages.gear,turbine=pair.pages.turbine;
    pair.differences.push(...compare(gear.free,turbine.free,shared,'free'),...compare(gear.parts,turbine.parts,panelSelectors,'parts'),...compare(gear.steps,turbine.steps,stepSelectors,'steps'));
    pair.differences.push(...compare(gear.details,turbine.details,detailSelectors,'details'),...compare(gear.selectedDetails,turbine.selectedDetails,selectedDetailSelectors,'selected-details'));
    const parameters=turbine.parameters;
    if(parameters.missing||!parameters.visible||parameters.insideStage||parameters.insideWorkspace||!parameters.afterWorkspace||parameters.top<parameters.workspaceBottom-1)
      pair.differences.push({mode:'parameters',problem:'parameters must follow the common workspace without changing its dimensions',parameters});
    console.log(JSON.stringify({width,height,differences:pair.differences.length,maximumDelta:Math.max(0,...pair.differences.map(d=>Math.abs(d.delta||0)))}));
  }
  report.differenceCount=report.viewports.reduce((total,v)=>total+v.differences.length,0);
  report.status=report.differenceCount===0&&errors.length===0?'PASS':'FAIL';
}catch(error){report.status='ERROR';report.fatal=error.stack;}
finally{
  await writeFile(new URL('comparison.json',destination),JSON.stringify(report,null,2)+'\n');
  for(const request of pending.values())request.reject(new Error('Layout verification ended'));pending.clear();
  if(socket?.readyState===WebSocket.OPEN)socket.close();
}
console.log(JSON.stringify({status:report.status,differences:report.differenceCount,errors:errors.length,fatal:report.fatal,report:destination.href+'comparison.json'}));
if(report.status!=='PASS')process.exitCode=1;
