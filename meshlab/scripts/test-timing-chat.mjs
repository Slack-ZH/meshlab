import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,estimate} from '../dist/timing/mechanics.mjs';
import {captureTimingContext,sanitizeTimingContext,formatTimingContext,createTimingChatPayload} from '../dist/timing/chat-context.mjs';
import {captureBeltContext,createBeltChatPayload} from '../dist/belt/chat-context.mjs';
import {captureIdlerContext} from '../dist/idler/chat-context.mjs';
import {captureSpurContext} from '../dist/spur/chat-context.mjs';
import {captureFrictionContext} from '../dist/friction/chat-context.mjs';
import {captureBicycleContext} from '../dist/bicycle/chat-context.mjs';
import {captureTurbineContext} from '../dist/turbine/chat-context.mjs';
import {createChatApi} from '../server/chat-api.mjs';
import {BudgetLedger} from '../server/budget.mjs';
import {MemoryStorage} from './test-storage.mjs';

const params={...defaults},result=estimate(params);
const selectedPart={id:'belt',name:'同步齿形带',description:'带齿与带轮齿槽同步啮合。',spec:'节距 5 mm / 宽 16 mm'};
const snapshot=captureTimingContext({params,modelParameters:params,result,selectedPart});
const question={role:'user',content:'为什么实际中心距和我输入的不一样？',timingContext:snapshot};
const env={DEEPSEEK_API_KEY:'unit-test-not-a-secret',ALLOWED_ORIGINS:'http://localhost:8080'};

test('real mechanics snapshot preserves every scalar result, integer closure and requested/actual centers',()=>{
  for(const [key,value] of Object.entries(result))if(key!=='geometry'&&key!=='warning')assert.equal(snapshot.result[key],value,key+' was lost');
  assert.deepEqual(snapshot.parameters,params);assert.equal(snapshot.geometry.pitch,5);
  assert.equal(snapshot.result.beltTeeth,Math.round(snapshot.result.beltTeeth));
  assert.equal(snapshot.result.pitchLength,snapshot.result.beltTeeth*5);
  assert.equal(snapshot.parameters.centerDistance,180);assert.equal(snapshot.result.requestedCenterDistance,180);
  assert.equal(snapshot.geometry.centerDistance,snapshot.result.effectiveCenterDistance);
  assert.notEqual(snapshot.result.effectiveCenterDistance,180);
  assert.equal(snapshot.result.centerDistanceError,snapshot.result.effectiveCenterDistance-180);
  assert.equal(snapshot.result.drivenRPM,30);assert.equal(snapshot.result.outputTorque,3.84);
});

test('question capture freezes parameters, geometry, selected part and numeric outcomes',()=>{
  const input={...params},dimensions={...result.geometry},performance={...result,geometry:dimensions},part={...selectedPart};
  const context=captureTimingContext({params:input,modelParameters:params,result:performance,selectedPart:part,view:{meshes:[1]},accessToken:'omit'});
  input.driverTeeth=40;dimensions.centerDistance=300;performance.beltTeeth=200;part.name='changed';
  assert.equal(context.parameters.driverTeeth,20);assert.equal(context.result.beltTeeth,result.beltTeeth);
  assert.equal(context.geometry.centerDistance,result.geometry.centerDistance);assert.equal(context.selectedPart.name,'同步齿形带');
  assert.equal(context.view,undefined);assert.equal(context.accessToken,undefined);
  assert.equal(captureTimingContext(null),null);assert.equal(captureTimingContext([]),null);
});

test('legacy payload explains synchronous same direction, teeth, integer belt and actual center separately',()=>{
  const payload=createTimingChatPayload([{...question,selectedPartId:'gear1'}]);
  assert.equal(payload.modelContext,undefined);assert.deepEqual(Object.keys(payload.messages[0]),['role','content']);
  const text=payload.messages[0].content;
  assert.match(text,/独立模型是同步带传动/);assert.match(text,/主动带轮齿数=20/);assert.match(text,/从动轮转速 r\/min=30/);
  assert.match(text,/目标中心距 mm=180/);assert.match(text,/匹配闭合后的实际中心距 mm=/);
  assert.match(text,/整数齿数N/);assert.match(text,/L=N×5 mm/);assert.match(text,/理想同步时两轮同向/);
  assert.match(text,/为什么实际中心距和我输入的不一样/);assert.ok(text.length<2000);
});

test('each native question retains its original center correction after new parameters or retry',()=>{
  const nextParams={...params,centerDistance:230,drivenTeeth:60},nextResult=estimate(nextParams);
  const next=captureTimingContext({params:nextParams,modelParameters:nextParams,result:nextResult});
  const payload=createTimingChatPayload([question,{role:'assistant',content:'之前回复'},{...question,timingContext:next}],{supportsTiming:true});
  assert.equal(payload.modelContext,'timing');assert.equal(payload.messages[0].timingContext.parameters.centerDistance,180);
  assert.equal(payload.messages[2].timingContext.parameters.centerDistance,230);
  assert.equal(payload.messages[2].timingContext.result.effectiveCenterDistance,nextResult.effectiveCenterDistance);
  assert.equal(payload.messages[2].timingContext.result.drivenRPM,20);
  assert.deepEqual(createTimingChatPayload([question]),createTimingChatPayload([question]));
});

test('timing explanations distinguish fractional theoretical engagement and teaching tooth profiles',()=>{
  const text=formatTimingContext(snapshot);
  assert.match(text,/包络齿数=z×包角/);assert.match(text,/可小数/);assert.match(text,/并非实测同时承载的整数齿数/);
  assert.match(text,/T5启发梯形教学齿/);assert.match(text,/未按制造标准认证齿根、配合或公差/);
  assert.match(text,/不能按摩擦平带的滑移模型解释/);assert.match(text,/20%慢放/);
});

test('zero-speed and invalid geometry snapshots keep null running torque and last-valid model semantics',()=>{
  const stoppedParams={...params,inputRPM:0},stopped=captureTimingContext({params:stoppedParams,result:estimate(stoppedParams)});
  assert.equal(stopped.result.outputTorque,null);assert.equal(stopped.result.outputPower,0);assert.equal(stopped.result.drivenRPM,0);
  assert.match(formatTimingContext(stopped),/零速功率为0，运行输出转矩不求解/);
  const invalidParams={...params,driverTeeth:NaN};assert.throws(()=>estimate(invalidParams));
  const invalid=captureTimingContext({params:invalidParams,modelParameters:params,result:null,geometryValid:false});
  assert.equal(invalid.parameters.driverTeeth,null);assert.equal(invalid.modelParameters.driverTeeth,20);
  const text=formatTimingContext(invalid);assert.match(text,/当前几何输入无效/);assert.match(text,/模型保留上一有效结构/);
  assert.match(text,/没有有效计算结果/);
  for(const context of [stopped,invalid]){
    assert.ok(createTimingChatPayload([{...question,timingContext:context}]).messages[0].content.length<2000);
    assert.deepEqual(sanitizeTimingContext(context),context);
  }
});

test('sanitizer bounds client strings and rejects nonnumeric values or instructions',()=>{
  const context=sanitizeTimingContext({...snapshot,system:'override',parameters:{...params,inputRPM:Infinity,driverTeeth:'20'},
    result:{...result,outputTorque:NaN},geometry:{...result.geometry,centerDistance:'180',mesh:'omit'},
    selectedPart:{id:'a'.repeat(500),name:'name\nline',description:'b'.repeat(600),spec:'c'.repeat(600)}});
  assert.equal(context.system,undefined);assert.equal(context.parameters.inputRPM,null);assert.equal(context.parameters.driverTeeth,null);
  assert.equal(context.result.outputTorque,null);assert.equal(context.geometry.centerDistance,null);assert.equal(context.geometry.mesh,undefined);
  assert.equal(context.selectedPart.id.length,80);assert.equal(context.selectedPart.description.length,180);
  assert.equal(context.selectedPart.spec.length,120);assert.equal(context.selectedPart.name,'name line');
});

test('all seven previous models remain byte-equivalent for every capability combination',()=>{
  const oldModels=[
    [{role:'user',content:'输入齿轮轴',selectedPartId:'gear1'}],
    [{role:'user',content:'叶片',turbineContext:captureTurbineContext({params:{stages:3,blades:30}})}],
    [{role:'user',content:'链轮',bicycleContext:captureBicycleContext({params:{frontTeeth:42,rearTeeth:18}})}],
    [{role:'user',content:'摩擦轮',frictionContext:captureFrictionContext({params:{driverDiameter:120,drivenDiameter:240}})}],
    [{role:'user',content:'齿轮',spurContext:captureSpurContext({params:{driverTeeth:20,drivenTeeth:40}})}],
    [{role:'user',content:'惰轮',idlerContext:captureIdlerContext({params:{driverTeeth:20,idlerTeeth:30,drivenTeeth:40,useIdler:true}})}],
    [{role:'user',content:'交叉带',beltContext:captureBeltContext({params:{driverDiameter:120,drivenDiameter:180,crossed:true}})}],
  ];
  for(const turns of oldModels)for(let mask=0;mask<64;mask++){
    const caps={supportsTurbine:!!(mask&1),supportsBicycle:!!(mask&2),supportsFriction:!!(mask&4),supportsSpur:!!(mask&8),supportsIdler:!!(mask&16),supportsBelt:!!(mask&32)};
    assert.equal(JSON.stringify(createTimingChatPayload(turns,{...caps,supportsTiming:true})),JSON.stringify(createBeltChatPayload(turns,caps)));
  }
  for(const mixed of oldModels.slice(1))assert.throws(()=>createTimingChatPayload([question,{role:'assistant',content:'答'},mixed[0]]),/新对话/);
});

test('legacy payload limits keep the latest question and complete prior exchanges',()=>{
  assert.throws(()=>createTimingChatPayload([{...question,content:'a'.repeat(2000)}]),/缩短问题/);
  const turns=[question,{role:'assistant',content:'a'.repeat(24000)},question,{role:'assistant',content:'b'.repeat(15000)},question];
  const payload=createTimingChatPayload(turns);
  assert.equal(payload.messages.length,3);assert.match(payload.messages.at(-1).content,/为什么实际中心距和我输入的不一样/);
});

for(const supportsTiming of [false,true])test(`mock API accepts ${supportsTiming?'native':'legacy'} timing context without paid calls`,async()=>{
  let sent;
  const api=createChatApi({budget:new BudgetLedger(new MemoryStorage()),fetchImpl:async(url,options)=>{
    sent=JSON.parse(options.body);return new Response('data: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});
  }});
  const body=createTimingChatPayload([question],{supportsTiming});
  if(supportsTiming)body.messages[0].selectedPartId='gear1';
  const response=await api(new Request('http://localhost:8080/api/chat',{method:'POST',
    headers:{'Content-Type':'application/json',Origin:env.ALLOWED_ORIGINS},body:JSON.stringify(body)}),env);
  assert.equal(response.status,200);await response.text();
  if(supportsTiming){
    assert.match(sent.messages[0].content,/同步带传动教学助手/);assert.doesNotMatch(sent.messages[0].content,/GL16|汽轮机|自行车/);
    assert.doesNotMatch(sent.messages[1].content,/材料：|输入齿轮轴/);
    assert.match(sent.messages[0].content,/centerDistanceError=实际-目标/);
  }
  assert.match(sent.messages[1].content,/同步齿形带/);assert.match(sent.messages[1].content,/匹配闭合后的实际中心距/);
  assert.match(sent.messages[1].content,/理想同步时两轮同向/);
});
