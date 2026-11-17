import assert from 'node:assert/strict';
import {writeFile,readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {connect,destination} from './linkage-browser.mjs';
const b=await connect(),report={testedAt:new Date().toISOString(),checks:[],errors:b.errors};
const kinds=['scotch-yoke','crank-rocker','parallelogram','double-rocker','quick-return'];
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
async function check(name,run){try{await run();report.checks.push({name,status:'PASS'});}catch(e){report.checks.push({name,status:'FAIL',error:e.stack});console.error(name,e.message);}}
async function assertLayout(){
  const layout=await b.evaluate(`(()=>{const r=document.getElementById('viewport').getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth+1,viewport:{x:r.x,y:r.y,right:r.right,bottom:r.bottom},visible:!document.getElementById('explore').hidden}})()`);
  assert.equal(layout.overflow,false,'page has horizontal overflow');
  if(layout.visible){const s=await b.state();for(const part of s.view.parts.filter(p=>p.visible))for(const [x,y]of part.projected){assert.ok(x>=layout.viewport.x-1&&x<=layout.viewport.right+1,`${part.id} clipped horizontally: ${x}`);assert.ok(y>=layout.viewport.y-1&&y<=layout.viewport.bottom+1,`${part.id} clipped vertically: ${y}`);}}
}
try {
  await b.command('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});
  for(const kind of kinds){
    await b.viewport(1440,1080);await b.navigate(kind+'.html');
    await check(kind+' default model and chart',async()=>{const s=await b.state();assert.equal(s.ready,true);assert.ok(s.view.parts.length>=5);assert.ok(await b.evaluate(`document.getElementById('chart').width>0`));await assertLayout();await b.screenshot(kind+'-desktop.png');});
    await check(kind+' selection, support visibility, exploded and reverse assembly',async()=>{
      await b.click('[data-part="input"]');assert.equal((await b.state()).view.selected,'input');
      await b.click('[data-part="output"]');let s=await b.state();assert.equal(s.view.parts.filter(p=>p.highlighted).length,1);await b.screenshot(kind+'-selected-desktop.png');
      for(const mode of ['transparent','hidden','solid']){await b.change('housing',mode,'change');assert.equal((await b.state()).view.housing,mode);}
      const angle=s.angle;await b.click('#explode-all');s=await b.state();assert.equal(s.view.amount,1);assert.equal(s.playing,false);await assertLayout();await b.screenshot(kind+'-exploded-desktop.png');
      await b.click('#assemble-all');near((await b.state()).angle,angle);await b.click('[data-mode="steps"]');
      for(let i=1;i<=4;i++){await b.click('#step-next');assert.equal((await b.state()).view.step,i);}assert.equal(await b.evaluate('document.getElementById("step-next").disabled'),true);
      for(let i=3;i>=0;i--){await b.click('#step-prev');assert.equal((await b.state()).view.step,i);}near((await b.state()).angle,angle);await b.click('[data-mode="free"]');
    });
    await check(kind+' playback, angle control and zero speed',async()=>{
      const before=(await b.state()).angle;await b.click('#play');await b.wait(250);assert.notEqual((await b.state()).angle,before);await b.click('#play');const paused=(await b.state()).angle;await b.wait(100);near((await b.state()).angle,paused);
      const range=(await b.state()).range;await b.change('angle',(range.min+range.max)*.5);assert.ok(Math.abs((await b.state()).angle-(range.min+range.max)*.5)<.051,'angle slider did not update');
      await b.change('param-rpm',0);await b.click('#parameter-form button[type="submit"]');await b.click('#play');assert.equal((await b.state()).playing,false);await b.click('#reset');
    });
    await check(kind+' invalid parameters retain model and valid geometry changes rebuild',async()=>{
      const before=await b.state(),key=kind==='scotch-yoke'||kind==='quick-return'?'r':'a';
      await b.change('param-'+key,-5);await b.click('#parameter-form button[type="submit"]');let s=await b.state();assert.equal(s.valid,false);assert.deepEqual(s.params,before.params);assert.equal(await b.evaluate('document.getElementById("parameter-error").hidden'),false);
      await b.change('param-'+key,before.params[key]+2);await b.click('#parameter-form button[type="submit"]');s=await b.state();assert.equal(s.valid,true);near(s.params[key],before.params[key]+2);await b.click('#reset');
    });
    await check(kind+' pointer drag drives input in front view',async()=>{
      await b.click('#front-view');await b.click('#drag-mode');const s=await b.state(),point=s.view.joints.B,pivot=s.view.joints.O||s.view.joints.A;
      await b.command('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});
      const dx=point.x-pivot.x,dy=point.y-pivot.y,t=.15,target={x:pivot.x+dx*Math.cos(t)-dy*Math.sin(t),y:pivot.y+dx*Math.sin(t)+dy*Math.cos(t)};
      await b.command('Input.dispatchMouseEvent',{type:'mouseMoved',...target,button:'left',buttons:1});
      await b.command('Input.dispatchMouseEvent',{type:'mouseReleased',...target,button:'left',clickCount:1});await b.settle();
      const after=await b.state();assert.ok(Math.abs(after.angle-s.angle)>2,'drag did not change input angle');assert.equal(after.playing,false);await b.click('#drag-mode');await b.click('#reset');
    });
    await check(kind+' documentation, export and tab roundtrip',async()=>{
      await b.command('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:fileURLToPath(destination),eventsEnabled:true});
      await b.click('[data-tab="principle"]');await assertLayout();assert.equal(await b.evaluate('document.getElementById("principle").hidden'),false);
      await b.click('[data-tab="resources"]');await b.click('#download-json');await b.click('#download-csv');await b.wait(150);
      const json=JSON.parse(await readFile(new URL(kind+'-experiment.json',destination),'utf8'));assert.equal(json.mechanism,kind);
      const csv=await readFile(new URL(kind+'-experiment.csv',destination),'utf8');assert.equal(csv.trim().split(/\r?\n/).length,362);
      await b.click('[data-tab="explore"]');await assertLayout();
    });
    for(const [width,height]of [[390,844],[360,740]]){
      await b.viewport(width,height);await b.evaluate('scrollTo(0,0)');await b.settle();
      await check(kind+` ${width}px default, selected, exploded, controls and chart`,async()=>{
        await b.click('#reset');await assertLayout();await b.screenshot(`${kind}-${width}-default.png`);
        await b.click('[data-part="output"]');await assertLayout();await b.screenshot(`${kind}-${width}-selected.png`);
        await b.click('#explode-all');await assertLayout();await b.screenshot(`${kind}-${width}-exploded.png`);await b.click('#assemble-all');
        await b.evaluate('document.querySelector(".motion-card").scrollIntoView({block:"start"})');await b.settle();await assertLayout();await b.screenshot(`${kind}-${width}-readouts.png`);
        await b.evaluate('scrollTo(0,0)');
      });
    }
    console.log(kind,report.checks.filter(c=>c.name.startsWith(kind)).map(c=>c.status).join(' '));
  }
  await check('homepage provides all five entry links',async()=>{await b.command('Page.navigate',{url:'http://127.0.0.1:8090/'});await b.waitFor('document.getElementById("linkage-experiments")');const hrefs=await b.evaluate('Array.from(document.querySelectorAll(".linkage-links a"),a=>a.getAttribute("href"))');assert.deepEqual(hrefs,kinds.map(k=>k+'.html'));});
  report.status=report.checks.every(c=>c.status==='PASS')&&!b.errors.length?'PASS':'FAIL';
}catch(e){report.status='ERROR';report.fatal=e.stack;}finally{await writeFile(new URL('browser-report.json',destination),JSON.stringify(report,null,2));await b.close();}
console.log(JSON.stringify({status:report.status,passed:report.checks.filter(c=>c.status==='PASS').length,failed:report.checks.filter(c=>c.status==='FAIL').length,errors:b.errors,fatal:report.fatal}));
if(report.status!=='PASS')process.exitCode=1;
