// Isolated browser integration: test-only auth and SSE responses; no login or paid request.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {connect,base} from './linkage-browser.mjs';
import {definitions} from '../dist/experiments/catalog.mjs';
const b=await connect(),report={testedAt:new Date().toISOString(),mode:'mocked auth + health + chat; no external requests',checks:[]};
let calls=[],held=null,replyMode='error';
const sse='data: '+JSON.stringify({choices:[{delta:{content:'测试回答：已收到当前机构快照。'}}]})+'\n\ndata: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n';
const auth=`export const currentUser=()=>({uid:'local-test',emailVerified:true});export const canChat=()=>true;export const token=async()=>'local-test-token';export const openAuth=()=>{};export const setBudget=()=>{};export const authUnavailable=()=>{};export function initAuth(config,callback){callback(currentUser());}`;
async function respond(requestId,body,type='application/json'){await b.command('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:type},{name:'Cache-Control',value:'no-store'}],body:Buffer.from(typeof body==='string'?body:JSON.stringify(body)).toString('base64')});}
b.on('Fetch.requestPaused',async({requestId,request})=>{
  const path=new URL(request.url).pathname;
  if(path==='/auth.js')return respond(requestId,auth,'application/javascript');
  if(path==='/chat-config.json')return respond(requestId,{apiBase:'/api',firebase:{projectId:'test-only'}});
  if(path==='/api/health')return respond(requestId,{ready:true,requiresLogin:true,requiresEmailVerification:true,modelContexts:['turbine','bicycle','friction']});
  if(path==='/api/account')return respond(requestId,{});
  if(path==='/api/chat'){calls.push(JSON.parse(request.postData));if(replyMode==='hold'){held=requestId;return;}return replyMode==='error'?respond(requestId,{testError:'intentional non-stream response'}):respond(requestId,sse,'text/event-stream');}
  await b.command('Fetch.continueRequest',{requestId});
});
async function send(text){await b.change('chat-input',text);await b.click('#chat-send');}
const notice=()=>b.evaluate('document.getElementById("chat-notice-text").textContent');
async function completed(){await b.waitFor('document.getElementById("chat-notice-text").textContent.includes("回复完成")');}
async function check(name,run){try{await run();report.checks.push({name,status:'PASS'});}catch(e){report.checks.push({name,status:'FAIL',error:e.stack});console.error(name,e.message);}}
try{
  await b.command('Fetch.enable',{patterns:[{urlPattern:'*/auth.js'},{urlPattern:'*/chat-config.json'},{urlPattern:'*/api/*'}]});
  for(const kind of Object.keys(definitions)){
    calls=[];replyMode='error';await b.command('Page.navigate',{url:new URL(kind+'.html',base).href});await b.waitFor('window.__experimentLab?.getState().ready&&document.getElementById("chat-connection").dataset.state==="ready"');
    await check(kind+' question snapshot, failed response and exact retry',async()=>{
      await b.click('.chat-suggestions button');assert.ok(await b.evaluate('document.getElementById("chat-input").value.length>0'));
      await send('当前输入件的尺寸如何影响输出？');await b.waitFor('!document.getElementById("chat-retry").hidden');assert.match(await notice(),/格式异常/);assert.equal(calls.length,1);assert.ok(calls[0].messages[0].content.includes(definitions[kind].title));assert.equal(calls[0].selectedPartId,undefined);
      const field=definitions[kind].fields[0];await b.change(field.key,field.value+(field.step||1));replyMode='success';await b.click('#chat-retry');await completed();assert.deepEqual(calls[1],calls[0]);assert.ok(await b.evaluate('document.getElementById("chat-messages").textContent.includes("已收到当前机构快照")'));
    });
    await check(kind+' follow-up owns current parameters and prior turns retain original data',async()=>{
      await send('参数改了，再解释一次。');await completed();const payload=calls.at(-1);assert.equal(payload.messages.length,3);assert.deepEqual(payload.messages[0],calls[0].messages[0]);const field=definitions[kind].fields[0];assert.ok(payload.messages[2].content.includes(field.label+'='+(field.value+(field.step||1))+' '+field.unit));
    });
    await check(kind+' invalid parameters and assembly state reach AI accurately',async()=>{
      await b.change(definitions[kind].fields[0].key,-5);await send('参数为什么无效？');await completed();assert.match(calls.at(-1).messages.at(-1).content,/当前输入无效，计算暂停/);assert.match(calls.at(-1).messages.at(-1).content,/画面保留上一有效模型/);
      await b.click('#reset-parameters');await b.click('[data-mode="steps"]');await b.click('#step-next');await send('解释当前拆装步骤。');await completed();assert.ok(calls.at(-1).messages.at(-1).content.includes(await b.evaluate('document.getElementById("step-title").textContent')));
    });
    await check(kind+' stop and new conversation discard pending replies',async()=>{
      replyMode='hold';await send('等待回复测试');await b.waitFor('!document.getElementById("chat-stop").hidden');await b.click('#chat-stop');await b.waitFor('document.getElementById("chat-notice-text").textContent.includes("已停止")');
      if(held){try{await respond(held,sse,'text/event-stream');}catch{}held=null;}
      replyMode='hold';await send('清空测试');await b.waitFor('!document.getElementById("chat-stop").hidden');await b.click('#chat-reset');if(held){try{await respond(held,sse,'text/event-stream');}catch{}held=null;}
      await b.settle();assert.equal(await b.evaluate('document.getElementById("chat-messages").children.length'),0);
      replyMode='success';await send('新对话');await completed();assert.equal(calls.at(-1).messages.length,1);
    });
    console.log(kind,report.checks.filter(c=>c.name.startsWith(kind)).map(c=>c.status).join(' '));
  }
}catch(e){report.fatal=e.stack;}finally{report.errors=b.errors;report.status=!report.fatal&&!report.errors.length&&report.checks.every(c=>c.status==='PASS')?'PASS':'FAIL';await writeFile(new URL('../test-results/full-standard/chat-browser-report.json',import.meta.url),JSON.stringify(report,null,2));await b.close();}
console.log(JSON.stringify({status:report.status,passed:report.checks.filter(c=>c.status==='PASS').length,failed:report.checks.filter(c=>c.status==='FAIL').length,errors:report.errors,fatal:report.fatal}));if(report.status!=='PASS')process.exitCode=1;
