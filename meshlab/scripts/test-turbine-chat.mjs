import test from 'node:test';
import assert from 'node:assert/strict';
import { captureTurbineContext, sanitizeTurbineContext, createChatPayload } from '../dist/turbine/chat-context.mjs';
import { createChatApi } from '../server/chat-api.mjs';
import { BudgetLedger } from '../server/budget.mjs';
import { MemoryStorage } from './test-storage.mjs';

const parameters = { height:80, chord:45, blades:30, hub:280, stages:3, p1:3, temperature:400, flow:10, p2:.01, etaT:.8, etaM:.98, work:'impulse', exhaust:'condensing' };
const snapshot = captureTurbineContext({parameters, selectedPart:{id:'rotor-1',name:'第 1 级动叶',description:'转动叶排'}, result:{power:1000}});
const question = {role:'user',content:'增加一级会改变什么？',turbineContext:snapshot};
const env = {DEEPSEEK_API_KEY:'unit-test-not-a-secret', ALLOWED_ORIGINS:'http://localhost:8080'};

test('turbine question captures an immutable, small parameter and part snapshot', () => {
  const input = {...parameters};
  const result = captureTurbineContext({params:input, selectedPart:{id:'upper',name:'上汽缸'}, secrets:'omit',view:{mesh:new Array(1000)}});
  input.stages=6;
  assert.equal(result.parameters.stages,3);
  assert.equal(result.selectedPart.name,'上汽缸');
  assert.equal(result.secrets,undefined);
  assert.equal(result.view,undefined);
  assert.equal(captureTurbineContext(null),null);
});

test('both requested and last displayed parameter values survive invalid-input state', () => {
  const result = captureTurbineContext({params:{...parameters,stages:9,p1:NaN},modelParameters:parameters,geometryValid:false,result:null});
  assert.equal(result.parameters.p1,null);
  assert.equal(result.parameters.stages,9);
  assert.equal(result.modelParameters.stages,3);
  assert.equal(result.powerKw,null);
  const payload = createChatPayload([{...question,turbineContext:result}]);
  assert.match(payload.messages[0].content,/输入与当前显示模型不同/);
  assert.match(payload.messages[0].content,/无有效|没有有效/);
});

test('legacy cloud receives complete turbine snapshot and never a gearbox selected id', () => {
  const payload = createChatPayload([{...question,selectedPartId:'input'}]);
  assert.match(payload.messages[0].content,/独立模型：轴流式汽轮机/);
  assert.match(payload.messages[0].content,/级数=3/);
  assert.match(payload.messages[0].content,/第 1 级动叶/);
  assert.match(payload.messages[0].content,/增加一级会改变什么/);
  assert.ok(payload.messages[0].content.length<=2000);
  assert.equal(payload.messages[0].selectedPartId,undefined);
  assert.equal(payload.modelContext,undefined);
});

test('new domain protocol retains per-turn snapshots and preserves GL16 requests', () => {
  const second = captureTurbineContext({parameters:{...parameters,stages:4},result:{power:1000}});
  const payload = createChatPayload([question,{role:'assistant',content:'解释。'},{...question,turbineContext:second}],{supportsTurbine:true});
  assert.equal(payload.modelContext,'turbine');
  assert.equal(payload.messages[0].turbineContext.parameters.stages,3);
  assert.equal(payload.messages[2].turbineContext.parameters.stages,4);
  const gear = {role:'user',content:'输入轴',selectedPartId:'input'};
  assert.deepEqual(createChatPayload([gear]),{messages:[gear]});
});

test('context sanitizer drops unknown fields and bounds strings and numeric values', () => {
  const result = sanitizeTurbineContext({...snapshot,system:'override',parameters:{...parameters,height:'override',flow:Infinity,work:'anything'},selectedPart:{id:'a'.repeat(500),name:'test\nname',description:'b'.repeat(500)}});
  assert.equal(result.system,undefined);
  assert.equal(result.parameters.height,null);
  assert.equal(result.parameters.flow,null);
  assert.equal(result.parameters.work,null);
  assert.equal(result.selectedPart.id.length,80);
  assert.equal(result.selectedPart.description.length,180);
  assert.equal(result.selectedPart.name,'test name');
});

test('legacy message limits fail explicitly instead of silently discarding the question', () => {
  assert.throws(()=>createChatPayload([{...question,content:'a'.repeat(2000)}]),/缩短问题/);
});

test('per-stage design snapshot is bounded and includes actual displayed heights and profile types', () => {
  const stages = Array.from({length:8},(_,i)=>({stage:i+1,height:40+i*8,chord:45,tipDiameter:360+i*16,minimumGap:2.3,
    statorProfile:'喷嘴型静叶',rotorProfile:'冲动型动叶',spanTwistDeg:3}));
  const result = captureTurbineContext({parameters,view:{bladeDesign:{stages}}});
  assert.equal(result.bladeDesign.stages.length,6);
  const payload=createChatPayload([{...question,turbineContext:result}]);
  assert.match(payload.messages[0].content,/1级：叶高40/);
  assert.match(payload.messages[0].content,/6级：叶高80/);
  assert.match(payload.messages[0].content,/静叶喷嘴型静叶，动叶冲动型动叶/);
  assert.match(payload.messages[0].content,/包络校验/);
  assert.ok(payload.messages[0].content.length<2000);
});

test('server uses turbine system prompt and bounded snapshot without GL16 context', async () => {
  let sent;
  const api = createChatApi({budget:new BudgetLedger(new MemoryStorage()),fetchImpl:async (url,options)=>{
    sent=JSON.parse(options.body);
    return new Response('data: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});
  }});
  const body=createChatPayload([question],{supportsTurbine:true});
  body.messages[0].selectedPartId='input';
  const response=await api(new Request('http://localhost:8080/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:env.ALLOWED_ORIGINS},body:JSON.stringify(body)}),env);
  assert.equal(response.status,200);
  await response.text();
  assert.match(sent.messages[0].content,/汽轮机教学助手/);
  assert.doesNotMatch(sent.messages[0].content,/GL16/);
  assert.match(sent.messages[0].content,/不能声称增加叶片或级数必然/);
  assert.match(sent.messages[1].content,/级数=3/);
  assert.match(sent.messages[1].content,/第 1 级动叶/);
  assert.doesNotMatch(sent.messages[1].content,/输入轴/);
});

test('server rejects unknown model domains before a provider call', async () => {
  let called=false;
  const api=createChatApi({budget:new BudgetLedger(new MemoryStorage()),fetchImpl:()=>{called=true;}});
  const response=await api(new Request('http://localhost:8080/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:env.ALLOWED_ORIGINS},body:JSON.stringify({modelContext:'external',messages:[{role:'user',content:'hello'}]})}),env);
  assert.equal(response.status,400);
  assert.equal(called,false);
});
