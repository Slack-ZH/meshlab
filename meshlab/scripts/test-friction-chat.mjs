import test from 'node:test';
import assert from 'node:assert/strict';
import { captureFrictionContext, sanitizeFrictionContext, formatFrictionContext, createFrictionChatPayload } from '../dist/friction/chat-context.mjs';
import { captureBicycleContext, createBicycleChatPayload } from '../dist/bicycle/chat-context.mjs';
import { captureTurbineContext } from '../dist/turbine/chat-context.mjs';
import { createChatApi } from '../server/chat-api.mjs';
import { BudgetLedger } from '../server/budget.mjs';
import { MemoryStorage } from './test-storage.mjs';

const params={driverDiameter:120,drivenDiameter:240,wheelWidth:32,inputRPM:60,normalForce:200,frictionCoefficient:.4,loadTorque:1};
const result={ratio:2,speedRatio:.5,driverRPM:60,drivenRPM:-30,surfaceSpeed:Math.PI*.12,
  normalForce:200,frictionLimit:80,tractionDemand:1/.12,torqueCapacity:9.6,loadTorque:1,
  utilization:1/9.6,tractionFeasible:true,theoreticalOutputPower:Math.PI,contactState:'rolling'};
const selectedPart={id:'driver-wheel',name:'主动摩擦轮',description:'靠接触摩擦传力。',spec:'直径 120 mm'};
const snapshot=captureFrictionContext({params,result,selectedPart});
const question={role:'user',content:'增加负载会发生什么？',frictionContext:snapshot};
const env={DEEPSEEK_API_KEY:'unit-test-not-a-secret',ALLOWED_ORIGINS:'http://localhost:8080'};

test('friction snapshot stays immutable and contains only question-relevant fields',()=>{
  const input={...params},performance={...result},part={...selectedPart};
  const context=captureFrictionContext({params:input,modelParameters:params,result:performance,selectedPart:part,
    view:{meshes:[{private:'scene'}]},accessToken:'omit'});
  input.driverDiameter=200;performance.drivenRPM=-50;part.name='changed';
  assert.equal(context.parameters.driverDiameter,120);assert.equal(context.result.drivenRPM,-30);
  assert.equal(context.selectedPart.name,'主动摩擦轮');
  assert.equal(context.view,undefined);assert.equal(context.accessToken,undefined);
  assert.equal(captureFrictionContext(null),null);assert.equal(captureFrictionContext([]),null);
});

test('legacy payload carries mechanics and selected part without gearbox context or new fields',()=>{
  const payload=createFrictionChatPayload([{...question,selectedPartId:'gear1'}]);
  assert.equal(payload.modelContext,undefined);
  assert.deepEqual(Object.keys(payload.messages[0]),['role','content']);
  assert.match(payload.messages[0].content,/独立模型是摩擦轮传动/);
  assert.match(payload.messages[0].content,/主动轮直径 mm=120/);
  assert.match(payload.messages[0].content,/理论从动轮转速 r\/min=-30/);
  assert.match(payload.messages[0].content,/主动摩擦轮/);
  assert.match(payload.messages[0].content,/摩擦力上限=μN/);
  assert.match(payload.messages[0].content,/增加负载会发生什么/);
  assert.ok(payload.messages[0].content.length<2000);
});

test('new protocol keeps snapshots per turn and retry after parameter changes',()=>{
  const next=captureFrictionContext({params:{...params,loadTorque:20},result:{...result,loadTorque:20,tractionFeasible:false,contactState:'overload'}});
  const turns=[question,{role:'assistant',content:'先前回复'}, {...question,frictionContext:next}];
  const payload=createFrictionChatPayload(turns,{supportsFriction:true,supportsBicycle:true,supportsTurbine:true});
  assert.equal(payload.modelContext,'friction');
  assert.equal(payload.messages[0].frictionContext.parameters.loadTorque,1);
  assert.equal(payload.messages[2].frictionContext.parameters.loadTorque,20);
  assert.equal(payload.messages[2].frictionContext.result.tractionFeasible,false);
  assert.equal(payload.messages[2].frictionContext.result.contactState,'overload');
  assert.deepEqual(createFrictionChatPayload([question]),createFrictionChatPayload([question]));
});

test('overload context never labels theoretical speed or power as actual output',()=>{
  const context=captureFrictionContext({params:{...params,loadTorque:20},result:{...result,loadTorque:20,
    tractionDemand:20/.12,utilization:20/9.6,tractionFeasible:false,contactState:'overload',theoreticalOutputPower:20*Math.PI}});
  const text=formatFrictionContext(context);
  assert.match(text,/牵引条件：超限/);assert.match(text,/实际滑移与转速未求解/);
  assert.match(text,/理论从动轮转速/);assert.match(text,/理想转速下负载功率/);
  assert.match(text,/不能把理想转速下负载功率当成可实现功率/);
  assert.doesNotMatch(text,/实际从动轮转速|实测功率/);
});

test('invalid parameters preserve last model and zero input remains a valid stationary result',()=>{
  const invalid=captureFrictionContext({params:{...params,driverDiameter:NaN},modelParameters:params,result:null,geometryValid:false});
  const text=formatFrictionContext(invalid);
  assert.match(text,/输入与当前显示模型不同/);assert.match(text,/没有有效计算结果/);
  assert.match(text,/主动轮直径 mm=无效/);
  const stopped=captureFrictionContext({params:{...params,inputRPM:0},result:{...result,driverRPM:0,drivenRPM:0,surfaceSpeed:0,theoreticalOutputPower:0,contactState:'stationary'}});
  assert.equal(stopped.result.theoreticalOutputPower,0);assert.equal(stopped.result.drivenRPM,0);
  assert.match(formatFrictionContext(stopped),/接触状态：静止/);
});

test('sanitizer bounds text and rejects invalid numbers, states and hidden client fields',()=>{
  const context=sanitizeFrictionContext({...snapshot,system:'override',parameters:{...params,inputRPM:Infinity,normalForce:'100'},
    result:{...result,tractionFeasible:'yes',contactState:'override',theoreticalOutputPower:NaN},
    selectedPart:{id:'a'.repeat(500),name:'name\nline',description:'b'.repeat(600),spec:'c'.repeat(600)}});
  assert.equal(context.system,undefined);assert.equal(context.parameters.inputRPM,null);assert.equal(context.parameters.normalForce,null);
  assert.equal(context.result.tractionFeasible,null);assert.equal(context.result.contactState,null);
  assert.equal(context.result.theoreticalOutputPower,null);assert.equal(context.selectedPart.id.length,80);
  assert.equal(context.selectedPart.description.length,180);assert.equal(context.selectedPart.spec.length,120);
  assert.equal(context.selectedPart.name,'name line');
});

test('all prior model payloads remain byte-equivalent under each capability combination',()=>{
  const oldModels=[
    [{role:'user',content:'输入齿轮轴',selectedPartId:'gear1'}],
    [{role:'user',content:'叶片',turbineContext:captureTurbineContext({params:{stages:3,blades:30}})}],
    [{role:'user',content:'链轮',bicycleContext:captureBicycleContext({params:{frontTeeth:42,rearTeeth:18}})}],
  ];
  for(const turns of oldModels)for(const supportsTurbine of [false,true])for(const supportsBicycle of [false,true]){
    const caps={supportsTurbine,supportsBicycle};
    assert.equal(JSON.stringify(createFrictionChatPayload(turns,{...caps,supportsFriction:true})),JSON.stringify(createBicycleChatPayload(turns,caps)));
  }
  for(const mixed of oldModels.slice(1))assert.throws(()=>createFrictionChatPayload([question,{role:'assistant',content:'答'},mixed[0]]),/新对话/);
});

test('legacy length limit preserves latest question and removes old complete exchanges only',()=>{
  assert.throws(()=>createFrictionChatPayload([{...question,content:'a'.repeat(2000)}]),/缩短问题/);
  const turns=[question,{role:'assistant',content:'a'.repeat(24000)},question,{role:'assistant',content:'b'.repeat(15000)},question];
  const payload=createFrictionChatPayload(turns);
  assert.equal(payload.messages.length,3);
  assert.match(payload.messages.at(-1).content,/增加负载会发生什么/);
});

for(const supportsFriction of [false,true])test(`mock API accepts ${supportsFriction?'native':'legacy'} friction payload without charging or networking`,async()=>{
  let sent;
  const api=createChatApi({budget:new BudgetLedger(new MemoryStorage()),fetchImpl:async(url,options)=>{
    sent=JSON.parse(options.body);return new Response('data: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});
  }});
  const body=createFrictionChatPayload([question],{supportsFriction});
  if(supportsFriction)body.messages[0].selectedPartId='gear1';
  const response=await api(new Request('http://localhost:8080/api/chat',{method:'POST',
    headers:{'Content-Type':'application/json',Origin:env.ALLOWED_ORIGINS},body:JSON.stringify(body)}),env);
  assert.equal(response.status,200);await response.text();
  if(supportsFriction){
    assert.match(sent.messages[0].content,/摩擦轮传动教学助手/);
    assert.doesNotMatch(sent.messages[0].content,/GL16|汽轮机|自行车/);
    assert.doesNotMatch(sent.messages[1].content,/材料：|输入齿轮轴/);
  }
  assert.match(sent.messages[1].content,/主动轮直径 mm=120/);
  assert.match(sent.messages[1].content,/主动摩擦轮/);
  assert.match(sent.messages[1].content,/实际滑移、转速和输出功率未求解/);
});
