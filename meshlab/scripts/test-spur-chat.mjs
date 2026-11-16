import test from 'node:test';
import assert from 'node:assert/strict';
import { captureSpurContext, sanitizeSpurContext, formatSpurContext, createSpurChatPayload } from '../dist/spur/chat-context.mjs';
import { captureFrictionContext, createFrictionChatPayload } from '../dist/friction/chat-context.mjs';
import { captureBicycleContext } from '../dist/bicycle/chat-context.mjs';
import { captureTurbineContext } from '../dist/turbine/chat-context.mjs';
import { createChatApi } from '../server/chat-api.mjs';
import { BudgetLedger } from '../server/budget.mjs';
import { MemoryStorage } from './test-storage.mjs';

const params={driverTeeth:20,drivenTeeth:40,module:3,faceWidth:20,inputRPM:60,inputTorque:5,efficiency:.98};
const geometry={centerDistance:90,driverRadius:30,drivenRadius:60,faceWidth:20};
const result={ratio:2,speedRatio:.5,driverRPM:60,drivenRPM:-30,inputTorque:5,outputTorque:9.8,
  staticTorqueRatio:2,efficiency:.98,inputPower:Math.PI*10,outputPower:Math.PI*9.8,
  contactRatio:1.635185963571458,pressureAngle:20,geometry};
const selectedPart={id:'driver-gear',name:'主动直齿齿轮',description:'渐开线齿面啮合传力。',spec:'20 齿 / 模数 3 mm'};
const snapshot=captureSpurContext({params,result,selectedPart});
const question={role:'user',content:'改变模数能改变速比吗？',spurContext:snapshot};
const env={DEEPSEEK_API_KEY:'unit-test-not-a-secret',ALLOWED_ORIGINS:'http://localhost:8080'};

test('spur question captures immutable parameters, geometry and part without meshes or identity',()=>{
  const input={...params},dimensions={...geometry},performance={...result,geometry:dimensions},part={...selectedPart};
  const context=captureSpurContext({params:input,modelParameters:params,result:performance,selectedPart:part,
    view:{meshes:[{private:'scene'}]},accessToken:'omit'});
  input.driverTeeth=30;performance.drivenRPM=-50;part.name='changed';dimensions.centerDistance=100;
  assert.equal(context.parameters.driverTeeth,20);assert.equal(context.result.drivenRPM,-30);
  assert.equal(context.selectedPart.name,'主动直齿齿轮');assert.equal(context.geometry.centerDistance,90);
  assert.equal(context.view,undefined);assert.equal(context.accessToken,undefined);
  assert.equal(captureSpurContext(null),null);assert.equal(captureSpurContext([]),null);
});

test('legacy payload carries the standalone spur model without injecting GL16 selected IDs',()=>{
  const payload=createSpurChatPayload([{...question,selectedPartId:'gear1'}]);
  assert.equal(payload.modelContext,undefined);
  assert.deepEqual(Object.keys(payload.messages[0]),['role','content']);
  const text=payload.messages[0].content;
  assert.match(text,/独立模型是单级直齿圆柱齿轮/);assert.match(text,/主动轮齿数=20/);
  assert.match(text,/从动轮转速 r\/min=-30/);assert.match(text,/运转输出转矩 N·m=9.8/);
  assert.match(text,/中心距 mm=90/);assert.match(text,/改变模数能改变速比吗/);
  assert.ok(text.length<2000);
});

test('native protocol keeps each question snapshot and retries unchanged',()=>{
  const next=captureSpurContext({params:{...params,drivenTeeth:60},modelParameters:params,result:null,geometryValid:false});
  const payload=createSpurChatPayload([question,{role:'assistant',content:'先前回复'},{...question,spurContext:next}],{supportsSpur:true});
  assert.equal(payload.modelContext,'spur');assert.equal(payload.messages[0].spurContext.parameters.drivenTeeth,40);
  assert.equal(payload.messages[2].spurContext.parameters.drivenTeeth,60);
  assert.equal(payload.messages[2].spurContext.modelParameters.drivenTeeth,40);
  assert.equal(payload.messages[2].spurContext.result,null);
  assert.deepEqual(createSpurChatPayload([question]),createSpurChatPayload([question]));
});

test('tooth contact explains sliding, pitch circles and manufacturing limits accurately',()=>{
  const text=formatSpurContext(snapshot);
  assert.match(text,/20°标准无变位渐开线工作齿面/);assert.match(text,/齿根过渡为教学近似/);
  assert.match(text,/模数和齿宽改变几何，不改变给定齿数的速比/);
  assert.match(text,/节圆相切且节圆线速度相等/);assert.match(text,/滚动与滑动并存/);
  assert.match(text,/只有节点处纯滚动/);assert.match(text,/检查实体轮齿交集/);
  assert.match(text,/20%慢放/);assert.doesNotMatch(text,/全接触无滑动|轮缘相切/);
});

test('invalid geometry and zero-speed static force are not treated as valid running output',()=>{
  const invalid=captureSpurContext({params:{...params,driverTeeth:NaN},modelParameters:params,result:null,geometryValid:false});
  const text=formatSpurContext(invalid);
  assert.match(text,/输入与当前显示模型不同/);assert.match(text,/没有有效计算结果/);
  assert.match(text,/主动轮齿数=无效/);
  const stopped=captureSpurContext({params:{...params,inputRPM:0},result:{...result,driverRPM:0,drivenRPM:0,inputPower:0,outputPower:0,outputTorque:null}});
  assert.equal(stopped.result.outputPower,0);assert.equal(stopped.result.outputTorque,null);
  assert.equal(stopped.result.staticTorqueRatio,2);
  assert.match(formatSpurContext(stopped),/不能把运行效率直接用于静态力矩/);
});

test('sanitizer bounds supplied text and drops nonnumeric or unexpected fields',()=>{
  const context=sanitizeSpurContext({...snapshot,system:'override',parameters:{...params,inputRPM:Infinity,module:'3'},
    result:{...result,outputTorque:NaN},geometry:{...geometry,centerDistance:'90',mesh:'omit'},
    selectedPart:{id:'a'.repeat(500),name:'name\nline',description:'b'.repeat(600),spec:'c'.repeat(600)}});
  assert.equal(context.system,undefined);assert.equal(context.parameters.inputRPM,null);assert.equal(context.parameters.module,null);
  assert.equal(context.result.outputTorque,null);assert.equal(context.geometry.centerDistance,null);assert.equal(context.geometry.mesh,undefined);
  assert.equal(context.selectedPart.id.length,80);assert.equal(context.selectedPart.description.length,180);
  assert.equal(context.selectedPart.spec.length,120);assert.equal(context.selectedPart.name,'name line');
});

test('all four previous model payloads are byte-equivalent for all capability combinations',()=>{
  const oldModels=[
    [{role:'user',content:'输入齿轮轴',selectedPartId:'gear1'}],
    [{role:'user',content:'叶片',turbineContext:captureTurbineContext({params:{stages:3,blades:30}})}],
    [{role:'user',content:'链轮',bicycleContext:captureBicycleContext({params:{frontTeeth:42,rearTeeth:18}})}],
    [{role:'user',content:'摩擦轮',frictionContext:captureFrictionContext({params:{driverDiameter:120,drivenDiameter:240}})}],
  ];
  for(const turns of oldModels)for(const supportsTurbine of [false,true])for(const supportsBicycle of [false,true])for(const supportsFriction of [false,true]){
    const caps={supportsTurbine,supportsBicycle,supportsFriction};
    assert.equal(JSON.stringify(createSpurChatPayload(turns,{...caps,supportsSpur:true})),JSON.stringify(createFrictionChatPayload(turns,caps)));
  }
  for(const mixed of oldModels.slice(1))assert.throws(()=>createSpurChatPayload([question,{role:'assistant',content:'答'},mixed[0]]),/新对话/);
});

test('legacy length limit preserves latest question and removes only complete old exchanges',()=>{
  assert.throws(()=>createSpurChatPayload([{...question,content:'a'.repeat(2000)}]),/缩短问题/);
  const turns=[question,{role:'assistant',content:'a'.repeat(24000)},question,{role:'assistant',content:'b'.repeat(15000)},question];
  const payload=createSpurChatPayload(turns);
  assert.equal(payload.messages.length,3);assert.match(payload.messages.at(-1).content,/改变模数能改变速比吗/);
});

for(const supportsSpur of [false,true])test(`mock API accepts ${supportsSpur?'native':'legacy'} spur payload without network or paid inference`,async()=>{
  let sent;
  const api=createChatApi({budget:new BudgetLedger(new MemoryStorage()),fetchImpl:async(url,options)=>{
    sent=JSON.parse(options.body);return new Response('data: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});
  }});
  const body=createSpurChatPayload([question],{supportsSpur});
  if(supportsSpur)body.messages[0].selectedPartId='gear1';
  const response=await api(new Request('http://localhost:8080/api/chat',{method:'POST',
    headers:{'Content-Type':'application/json',Origin:env.ALLOWED_ORIGINS},body:JSON.stringify(body)}),env);
  assert.equal(response.status,200);await response.text();
  if(supportsSpur){
    assert.match(sent.messages[0].content,/单级直齿圆柱齿轮教学助手/);
    assert.doesNotMatch(sent.messages[0].content,/GL16|汽轮机|自行车/);
    assert.doesNotMatch(sent.messages[1].content,/材料：|输入齿轮轴/);
    assert.match(sent.messages[0].content,/仅节点处纯滚动/);
  }
  assert.match(sent.messages[1].content,/主动轮齿数=20/);assert.match(sent.messages[1].content,/主动直齿齿轮/);
  assert.match(sent.messages[1].content,/齿根过渡为教学近似/);
});
