import test from 'node:test';
import assert from 'node:assert/strict';
import { captureBeltContext, sanitizeBeltContext, formatBeltContext, createBeltChatPayload } from '../dist/belt/chat-context.mjs';
import { captureIdlerContext, createIdlerChatPayload } from '../dist/idler/chat-context.mjs';
import { captureSpurContext } from '../dist/spur/chat-context.mjs';
import { captureFrictionContext } from '../dist/friction/chat-context.mjs';
import { captureBicycleContext } from '../dist/bicycle/chat-context.mjs';
import { captureTurbineContext } from '../dist/turbine/chat-context.mjs';
import { createChatApi } from '../server/chat-api.mjs';
import { BudgetLedger } from '../server/budget.mjs';
import { MemoryStorage } from './test-storage.mjs';

const params={driverDiameter:120,drivenDiameter:180,centerDistance:360,beltWidth:20,inputRPM:60,inputTorque:5,efficiency:.95,crossed:true};
const geometry={driverRadius:60,drivenRadius:90,centerDistance:360,beltWidth:20,pulleyWidth:26,beltThickness:2,crossingLift:12};
// Display-only length fields are deliberately distinct to catch conflation of the two.
const result={ratio:1.5,speedRatio:2/3,driverRPM:60,drivenRPM:-40,beltSpeed:Math.PI*.12,
  driverWrapDeg:229.2486367043,drivenWrapDeg:229.2486367043,projectedBeltLength:1254.7,spatialCenterlineLength:1258.4,
  inputTorque:5,outputTorque:7.125,inputPower:10*Math.PI,outputPower:9.5*Math.PI,efficiency:.95,geometry};
const selectedPart={id:'belt',name:'连续平带',description:'交叉处有空间分离及扭转过渡。',spec:'宽 20 mm'};
const snapshot=captureBeltContext({params,modelParameters:params,result,selectedPart});
const openResult={...result,drivenRPM:40,driverWrapDeg:170.44,drivenWrapDeg:189.56,
  projectedBeltLength:1193.74,spatialCenterlineLength:1193.74,geometry:{...geometry,crossingLift:0}};
const question={role:'user',content:'开口带和交叉带的转向有什么区别？',beltContext:snapshot};
const env={DEEPSEEK_API_KEY:'unit-test-not-a-secret',ALLOWED_ORIGINS:'http://localhost:8080'};

test('belt question snapshot freezes mode, parameters, geometry, lengths and selected part',()=>{
  const input={...params},dimensions={...geometry},performance={...result,geometry:dimensions},part={...selectedPart};
  const context=captureBeltContext({params:input,modelParameters:params,result:performance,selectedPart:part,view:{meshes:[1]},accessToken:'omit'});
  input.crossed=false;input.driverDiameter=200;dimensions.centerDistance=500;performance.spatialCenterlineLength=0;part.name='changed';
  assert.equal(context.parameters.crossed,true);assert.equal(context.parameters.driverDiameter,120);
  assert.equal(context.modelParameters.crossed,true);assert.equal(context.geometry.centerDistance,360);
  assert.equal(context.result.projectedBeltLength,1254.7);assert.equal(context.result.spatialCenterlineLength,1258.4);
  assert.equal(context.selectedPart.name,'连续平带');assert.equal(context.view,undefined);assert.equal(context.accessToken,undefined);
  assert.equal(captureBeltContext(null),null);assert.equal(captureBeltContext([]),null);
});

test('crossed accepts only boolean values; string false cannot enable or disable the belt mode',()=>{
  for(const crossed of [true,false]){
    const context=sanitizeBeltContext({...snapshot,parameters:{...params,crossed},modelParameters:{...params,crossed}});
    assert.equal(context.parameters.crossed,crossed);assert.equal(context.modelParameters.crossed,crossed);
  }
  for(const crossed of ['true','false',1,0,null,undefined,[],{}]){
    const context=sanitizeBeltContext({...snapshot,parameters:{...params,crossed}});
    assert.equal(context.parameters.crossed,null);assert.match(formatBeltContext(context),/带型开关无效\/未提供/);
  }
});

test('legacy payload identifies flat belts and preserves signed output speed without gearbox part ID',()=>{
  const payload=createBeltChatPayload([{...question,selectedPartId:'gear1'}]);
  assert.equal(payload.modelContext,undefined);assert.deepEqual(Object.keys(payload.messages[0]),['role','content']);
  const text=payload.messages[0].content;
  assert.match(text,/独立模型是平带传动/);assert.match(text,/交叉平带：反向传动/);
  assert.match(text,/主动轮有效直径 mm=120/);assert.match(text,/从动轮转速 r\/min=-40/);
  assert.match(text,/运转输出转矩 N·m=7.125/);assert.match(text,/指定总效率=0.95/);
  assert.match(text,/开口带和交叉带的转向有什么区别/);assert.ok(text.length<2000);
});

test('switching to open belt preserves per-question snapshots and applies the same total efficiency',()=>{
  const next=captureBeltContext({params:{...params,crossed:false},result:openResult});
  const payload=createBeltChatPayload([question,{role:'assistant',content:'之前回复'},{...question,beltContext:next}],{supportsBelt:true});
  assert.equal(payload.modelContext,'belt');assert.equal(payload.messages[0].beltContext.parameters.crossed,true);
  assert.equal(payload.messages[2].beltContext.parameters.crossed,false);
  assert.equal(payload.messages[0].beltContext.result.drivenRPM,-40);assert.equal(payload.messages[2].beltContext.result.drivenRPM,40);
  assert.equal(payload.messages[0].beltContext.result.efficiency,.95);assert.equal(payload.messages[2].beltContext.result.efficiency,.95);
  assert.match(formatBeltContext(next),/开口平带：同向传动/);
  assert.deepEqual(createBeltChatPayload([question]),createBeltChatPayload([question]));
});

test('belt explanations distinguish planar theory, spatial display and manufacturing requirements',()=>{
  const text=formatBeltContext(snapshot);
  assert.match(text,/平面理论带长 mm=1254.7/);assert.match(text,/显示路径中心线长 mm=1258.4/);
  assert.match(text,/交叉处有空间分离及扭转过渡/);assert.match(text,/不是全部共面/);
  assert.match(text,/都不是制造带长/);assert.match(text,/带中性层的有效直径/);
  assert.match(text,/η为单个总效率，不平方/);assert.match(text,/未求张力、打滑、强度、疲劳或功率上限/);
  assert.match(text,/20%慢放/);
});

test('invalid active dimensions retain the previous model and zero speed has no running output torque',()=>{
  const invalid=captureBeltContext({params:{...params,centerDistance:NaN,crossed:false},modelParameters:params,result:null,geometryValid:false});
  const text=formatBeltContext(invalid);
  assert.match(text,/输入与当前显示模型不同/);assert.match(text,/当前几何输入无效/);assert.match(text,/没有有效计算结果/);
  assert.match(text,/开口平带：同向传动/);assert.match(text,/交叉平带：反向传动/);
  const stopped=captureBeltContext({params:{...params,inputRPM:0},result:{...result,driverRPM:0,drivenRPM:0,beltSpeed:0,inputPower:0,outputPower:0,outputTorque:null}});
  assert.equal(stopped.result.outputPower,0);assert.equal(stopped.result.outputTorque,null);assert.equal(stopped.result.beltSpeed,0);
  assert.match(formatBeltContext(stopped),/不求运行输出转矩或用运行效率推静态力矩/);
});

test('sanitizer bounds external text and drops nonnumeric and unknown fields',()=>{
  const context=sanitizeBeltContext({...snapshot,system:'override',parameters:{...params,inputRPM:Infinity,efficiency:'1'},
    result:{...result,outputTorque:NaN},geometry:{...geometry,centerDistance:'360',mesh:'omit'},
    selectedPart:{id:'a'.repeat(500),name:'name\nline',description:'b'.repeat(600),spec:'c'.repeat(600)}});
  assert.equal(context.system,undefined);assert.equal(context.parameters.inputRPM,null);assert.equal(context.parameters.efficiency,null);
  assert.equal(context.result.outputTorque,null);assert.equal(context.geometry.centerDistance,null);assert.equal(context.geometry.mesh,undefined);
  assert.equal(context.selectedPart.id.length,80);assert.equal(context.selectedPart.description.length,180);
  assert.equal(context.selectedPart.spec.length,120);assert.equal(context.selectedPart.name,'name line');
});

test('all six previous model payloads remain byte-equivalent for every capability combination',()=>{
  const oldModels=[
    [{role:'user',content:'输入齿轮轴',selectedPartId:'gear1'}],
    [{role:'user',content:'叶片',turbineContext:captureTurbineContext({params:{stages:3,blades:30}})}],
    [{role:'user',content:'链轮',bicycleContext:captureBicycleContext({params:{frontTeeth:42,rearTeeth:18}})}],
    [{role:'user',content:'摩擦轮',frictionContext:captureFrictionContext({params:{driverDiameter:120,drivenDiameter:240}})}],
    [{role:'user',content:'齿轮',spurContext:captureSpurContext({params:{driverTeeth:20,drivenTeeth:40}})}],
    [{role:'user',content:'惰轮',idlerContext:captureIdlerContext({params:{driverTeeth:20,idlerTeeth:30,drivenTeeth:40,useIdler:true}})}],
  ];
  for(const turns of oldModels)for(let mask=0;mask<32;mask++){
    const caps={supportsTurbine:!!(mask&1),supportsBicycle:!!(mask&2),supportsFriction:!!(mask&4),supportsSpur:!!(mask&8),supportsIdler:!!(mask&16)};
    assert.equal(JSON.stringify(createBeltChatPayload(turns,{...caps,supportsBelt:true})),JSON.stringify(createIdlerChatPayload(turns,caps)));
  }
  for(const mixed of oldModels.slice(1))assert.throws(()=>createBeltChatPayload([question,{role:'assistant',content:'答'},mixed[0]]),/新对话/);
});

test('legacy length limit keeps the latest question and removes only complete previous exchanges',()=>{
  assert.throws(()=>createBeltChatPayload([{...question,content:'a'.repeat(2000)}]),/缩短问题/);
  const turns=[question,{role:'assistant',content:'a'.repeat(24000)},question,{role:'assistant',content:'b'.repeat(15000)},question];
  const payload=createBeltChatPayload(turns);
  assert.equal(payload.messages.length,3);assert.match(payload.messages.at(-1).content,/开口带和交叉带的转向有什么区别/);
});

for(const supportsBelt of [false,true])test(`mock API accepts ${supportsBelt?'native':'legacy'} belt payload without network or paid inference`,async()=>{
  let sent;
  const api=createChatApi({budget:new BudgetLedger(new MemoryStorage()),fetchImpl:async(url,options)=>{
    sent=JSON.parse(options.body);return new Response('data: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});
  }});
  const body=createBeltChatPayload([question],{supportsBelt});
  if(supportsBelt)body.messages[0].selectedPartId='gear1';
  const response=await api(new Request('http://localhost:8080/api/chat',{method:'POST',
    headers:{'Content-Type':'application/json',Origin:env.ALLOWED_ORIGINS},body:JSON.stringify(body)}),env);
  assert.equal(response.status,200);await response.text();
  if(supportsBelt){
    assert.match(sent.messages[0].content,/平带传动教学助手/);assert.doesNotMatch(sent.messages[0].content,/GL16|汽轮机|自行车/);
    assert.doesNotMatch(sent.messages[1].content,/材料：|输入齿轮轴/);
    assert.match(sent.messages[0].content,/crossed 为严格布尔/);assert.match(sent.messages[0].content,/不按两带轮重复平方/);
  }
  assert.match(sent.messages[1].content,/从动轮有效直径 mm=180/);assert.match(sent.messages[1].content,/连续平带/);
  assert.match(sent.messages[1].content,/都不是制造带长/);
});
