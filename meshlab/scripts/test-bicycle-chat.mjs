import test from 'node:test';
import assert from 'node:assert/strict';
import { captureBicycleContext, sanitizeBicycleContext, createBicycleChatPayload } from '../dist/bicycle/chat-context.mjs';
import { captureTurbineContext, createChatPayload } from '../dist/turbine/chat-context.mjs';
import { createChatApi } from '../server/chat-api.mjs';
import { BudgetLedger } from '../server/budget.mjs';
import { MemoryStorage } from './test-storage.mjs';

const params={frontTeeth:42,rearTeeth:18,cadence:80,centerDistance:430,wheelDiameter:700,crankLength:170,inputPower:150,efficiency:.97};
const result={ratio:42/18,rearRPM:80*42/18,speedKmh:24.6300864,inputPower:150,outputPower:145.5,inputTorque:17.9049311,outputTorque:7.4433368,chainSpeed:.7112,chainLinks:98,effectiveCenterDistance:427.5,chainPitch:12.7};
const selectedPart={id:'chain',name:'传动链条',description:'滚子链传递运动。',spec:'节距 12.7 mm'};
const snapshot=captureBicycleContext({params,result,selectedPart});
const question={role:'user',content:'增加后链轮齿数会改变什么？',bicycleContext:snapshot};
const env={DEEPSEEK_API_KEY:'unit-test-not-a-secret',ALLOWED_ORIGINS:'http://localhost:8080'};

test('question snapshot copies requested/displayed parameters and omits scene and account data',()=>{
  const input={...params},performance={...result},part={...selectedPart};
  const context=captureBicycleContext({params:input,modelParameters:{...params},result:performance,selectedPart:part,view:{meshes:new Array(10000)},accessToken:'omit'});
  input.frontTeeth=52;performance.rearRPM=0;part.name='changed';
  assert.equal(context.parameters.frontTeeth,42);
  assert.equal(context.result.rearRPM,80*42/18);
  assert.equal(context.selectedPart.name,'传动链条');
  assert.equal(context.view,undefined);assert.equal(context.accessToken,undefined);
  assert.equal(captureBicycleContext(null),null);assert.equal(captureBicycleContext([]),null);
});

test('legacy cloud gets bicycle snapshot and question without another model part ID',()=>{
  const payload=createBicycleChatPayload([{...question,selectedPartId:'gear1'}]);
  assert.equal(payload.modelContext,undefined);
  assert.equal(payload.messages[0].selectedPartId,undefined);
  assert.equal(payload.messages[0].bicycleContext,undefined);
  assert.match(payload.messages[0].content,/独立模型是自行车链条传动/);
  assert.match(payload.messages[0].content,/前链轮齿数=42/);
  assert.match(payload.messages[0].content,/输出功率 W=145.5/);
  assert.match(payload.messages[0].content,/增加后链轮齿数会改变什么/);
  assert.match(payload.messages[0].content,/实际中心距随闭合求解/);
  assert.ok(payload.messages[0].content.length<2000);
});

test('new protocol preserves each question snapshot and retry values after parameters change',()=>{
  const next=captureBicycleContext({params:{...params,rearTeeth:28},result:null,selectedPart});
  const turns=[question,{role:'assistant',content:'先前回答'}, {...question,bicycleContext:next}];
  const payload=createBicycleChatPayload(turns,{supportsBicycle:true,supportsTurbine:true});
  assert.equal(payload.modelContext,'bicycle');
  assert.equal(payload.messages[0].bicycleContext.parameters.rearTeeth,18);
  assert.equal(payload.messages[2].bicycleContext.parameters.rearTeeth,28);
  assert.equal(payload.messages[2].bicycleContext.result,null);
  assert.deepEqual(createBicycleChatPayload([question]),createBicycleChatPayload([question]));
});

test('invalid input and stationary zero-power results remain distinct from an active valid state',()=>{
  const invalid=captureBicycleContext({params:{...params,frontTeeth:NaN},modelParameters:params,result:null,geometryValid:false});
  const text=createBicycleChatPayload([{...question,bicycleContext:invalid}]).messages[0].content;
  assert.match(text,/输入与当前显示模型不同/);assert.match(text,/没有有效计算结果/);
  assert.match(text,/前链轮齿数=无效/);
  const stopped=captureBicycleContext({params:{...params,cadence:0},result:{...result,rearRPM:0,outputPower:0,inputTorque:null,outputTorque:null}});
  assert.equal(stopped.result.outputPower,0);assert.equal(stopped.result.outputTorque,null);
  const stoppedText=createBicycleChatPayload([{...question,bicycleContext:stopped}]).messages[0].content;
  assert.match(stoppedText,/输出功率 W=0/);assert.match(stoppedText,/零踏频不求稳态转矩/);
});

test('server and browser sanitizer reject nonnumeric values and bound external text',()=>{
  const context=sanitizeBicycleContext({...snapshot,system:'override',parameters:{...params,cadence:Infinity,inputPower:'500'},result:{...result,outputTorque:NaN},selectedPart:{id:'a'.repeat(500),name:'name\nline',description:'b'.repeat(600),spec:'c'.repeat(600)}});
  assert.equal(context.system,undefined);assert.equal(context.parameters.cadence,null);assert.equal(context.parameters.inputPower,null);
  assert.equal(context.result.outputTorque,null);assert.equal(context.selectedPart.id.length,80);
  assert.equal(context.selectedPart.description.length,180);assert.equal(context.selectedPart.spec.length,120);
  assert.equal(context.selectedPart.name,'name line');
});

test('GL16 and turbine payloads remain byte-equivalent and mixed model history fails explicitly',()=>{
  const gear=[{role:'user',content:'输入齿轮轴',selectedPartId:'gear1'}];
  assert.deepEqual(createBicycleChatPayload(gear),createChatPayload(gear));
  const turbine=[{role:'user',content:'叶片',turbineContext:captureTurbineContext({params:{stages:3,blades:30}})}];
  for(const supportsTurbine of [false,true])assert.deepEqual(createBicycleChatPayload(turbine,{supportsTurbine}),createChatPayload(turbine,{supportsTurbine}));
  assert.throws(()=>createBicycleChatPayload([question,{role:'assistant',content:'答'},turbine[0]]),/新对话/);
});

test('long questions fail clearly while old complete turns may be removed without changing the latest question',()=>{
  assert.throws(()=>createBicycleChatPayload([{...question,content:'a'.repeat(2000)}]),/缩短问题/);
  const turns=[question,{role:'assistant',content:'a'.repeat(24000)},question,{role:'assistant',content:'b'.repeat(15000)},question];
  const payload=createBicycleChatPayload(turns);
  assert.equal(payload.messages.length,3);assert.match(payload.messages.at(-1).content,/增加后链轮齿数会改变什么/);
});

test('local server selects bicycle instructions and avoids gearbox part injection',async()=>{
  let sent;
  const api=createChatApi({budget:new BudgetLedger(new MemoryStorage()),fetchImpl:async(url,options)=>{
    sent=JSON.parse(options.body);return new Response('data: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});
  }});
  const body=createBicycleChatPayload([question],{supportsBicycle:true});body.messages[0].selectedPartId='gear1';
  const response=await api(new Request('http://localhost:8080/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:env.ALLOWED_ORIGINS},body:JSON.stringify(body)}),env);
  assert.equal(response.status,200);await response.text();
  assert.match(sent.messages[0].content,/自行车链传动教学助手/);
  assert.doesNotMatch(sent.messages[0].content,/GL16|汽轮机/);
  assert.match(sent.messages[1].content,/前链轮齿数=42/);assert.match(sent.messages[1].content,/传动链条/);
  assert.doesNotMatch(sent.messages[1].content,/材料：|输入齿轮轴/);
});

test('legacy formatted payload remains accepted by existing API and contains complete bicycle data',async()=>{
  let sent;
  const api=createChatApi({budget:new BudgetLedger(new MemoryStorage()),fetchImpl:async(url,options)=>{
    sent=JSON.parse(options.body);return new Response('data: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});
  }});
  const response=await api(new Request('http://localhost:8080/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:env.ALLOWED_ORIGINS},body:JSON.stringify(createBicycleChatPayload([question]))}),env);
  assert.equal(response.status,200);await response.text();
  assert.match(sent.messages[1].content,/自行车链条传动/);assert.match(sent.messages[1].content,/节距 mm=12.7/);
});
