// Use an isolated, already running headless browser; no user's profile is read.
import {writeFile,mkdir} from 'node:fs/promises';
export const base=process.env.MESHLAB_BASE_URL||'http://127.0.0.1:8090/';
const cdp=process.env.MESHLAB_CDP_URL||'http://127.0.0.1:9338';
export const destination=new URL('../test-results/linkages/',import.meta.url);
export async function connect(){
  await mkdir(destination,{recursive:true});
  const target=await (await fetch(cdp+'/json/new?about:blank',{method:'PUT'})).json();
  const socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let seq=0;const pending=new Map(),errors=[],listeners=new Map();
  socket.onmessage=e=>{const data=JSON.parse(e.data);if(data.id){const p=pending.get(data.id);if(p){pending.delete(data.id);clearTimeout(p.timer);data.error?p.reject(Error(JSON.stringify(data.error))):p.resolve(data.result);}}else{if(data.method==='Runtime.exceptionThrown')errors.push(data.params.exceptionDetails.exception?.description||data.params.exceptionDetails.text);else if(data.method==='Log.entryAdded'&&data.params.entry.level==='error')errors.push(data.params.entry.text);for(const fn of listeners.get(data.method)||[])Promise.resolve(fn(data.params)).catch(e=>errors.push('event handler: '+e.message));}};
  function command(method,params={}){return new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},30000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
  async function evaluate(expression){const r=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  async function waitFor(expression){for(let i=0;i<150;i++){try{if(await evaluate(expression))return;}catch{}await wait(100);}throw Error('Wait failed '+expression+' '+errors.join(';'));}
  async function settle(){await evaluate('document.fonts.ready');await wait(180);}
  async function navigate(page){await command('Page.navigate',{url:new URL(page,base).href});await waitFor('window.__linkageLab?.getState().ready');await settle();}
  async function click(selector){await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);await settle();}
  async function change(id,value,event='input'){await evaluate(`(()=>{let e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));})()`);await settle();}
  async function screenshot(name){const r=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(new URL(name,destination),Buffer.from(r.data,'base64'));}
  async function viewport(width,height){await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await settle();}
  async function close(){socket.close();await fetch(cdp+'/json/close/'+target.id);}
  await command('Runtime.enable');await command('Log.enable');await command('Page.enable');
  return {command,evaluate,wait,waitFor,settle,navigate,click,change,screenshot,viewport,close,errors,on:(method,fn)=>{if(!listeners.has(method))listeners.set(method,[]);listeners.get(method).push(fn);},state:()=>evaluate('window.__linkageLab.getState()')};
}
