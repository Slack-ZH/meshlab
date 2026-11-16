import test from 'node:test';
import assert from 'node:assert/strict';
import {captureViceContext,sanitizeViceContext,formatViceContext,createViceChatPayload} from '../dist/vice/chat-context.mjs';
import {captureTimingContext,createTimingChatPayload} from '../dist/timing/chat-context.mjs';
import {captureBeltContext} from '../dist/belt/chat-context.mjs';
import {captureIdlerContext} from '../dist/idler/chat-context.mjs';
import {captureSpurContext} from '../dist/spur/chat-context.mjs';
import {captureFrictionContext} from '../dist/friction/chat-context.mjs';
import {captureBicycleContext} from '../dist/bicycle/chat-context.mjs';
import {captureTurbineContext} from '../dist/turbine/chat-context.mjs';
import {createChatApi} from '../server/chat-api.mjs';
import {BudgetLedger} from '../server/budget.mjs';
import {MemoryStorage} from './test-storage.mjs';

const params={lead:4,screwDiameter:24,jawWidth:80,maxOpening:100,inputRPM:30,inputTorque:5,efficiency:.35,direction:1};
const result={lead:4,pitch:4,starts:1,direction:1,inputRPM:30,inputTorque:5,advancePerTurn:4,linearSpeed:2,
  thrust:2*Math.PI*.35*5/.004,inputPower:5*Math.PI,outputPower:1.75*Math.PI,efficiency:.35};
const view={jawOpening:50,displacement:0,screwTurns:0,direction:1,atLimit:false,limit:null,playing:false};
const selectedPart={id:'screw',name:'梯形丝杠',description:'丝杠在固定螺母中旋转并轴向移动。',spec:'导程 4 mm / 外径 24 mm'};
const snapshot=captureViceContext({params,modelParameters:params,result,selectedPart,view});
const question={role:'user',content:'当前开口多少？导程对位移有什么影响？',viceContext:snapshot};
const env={DEEPSEEK_API_KEY:'unit-test-not-a-secret',ALLOWED_ORIGINS:'http://localhost:8080'};

test('vice capture freezes actual motion separately from setpoint theory and drops scene/account data',()=>{
  const input={...params},actual={...view},performance={...result},part={...selectedPart};
  const context=captureViceContext({params:input,modelParameters:params,result:performance,selectedPart:part,view:{...actual,meshes:[1]},accessToken:'omit'});
  input.lead=8;actual.jawOpening=80;performance.thrust=0;part.name='changed';
  assert.equal(context.parameters.lead,4);assert.equal(context.runtime.jawOpening,50);assert.equal(context.runtime.playing,false);
  assert.equal(context.result.linearSpeed,2);assert.equal(context.result.thrust,result.thrust);assert.equal(context.selectedPart.name,'梯形丝杠');
  assert.equal(context.runtime.meshes,undefined);assert.equal(context.accessToken,undefined);
  assert.equal(captureViceContext(null),null);assert.equal(captureViceContext([]),null);
});

test('direction accepts only numeric +1/-1 and runtime flags require actual booleans',()=>{
  for(const direction of [1,-1]){
    const context=sanitizeViceContext({...snapshot,parameters:{...params,direction},runtime:{...view,direction}});
    assert.equal(context.parameters.direction,direction);assert.equal(context.runtime.direction,direction);
  }
  for(const direction of ['1','-1',0,2,true,null,undefined]){
    const context=sanitizeViceContext({...snapshot,parameters:{...params,direction},runtime:{...view,direction,atLimit:'false',playing:1,limit:'override'}});
    assert.equal(context.parameters.direction,null);assert.equal(context.runtime.direction,null);
    assert.equal(context.runtime.atLimit,null);assert.equal(context.runtime.playing,null);assert.equal(context.runtime.limit,null);
    assert.match(formatViceContext(context),/指令方向=无效\/未提供/);
  }
});

test('legacy context names the vice and explicitly distinguishes paused actual state from theoretical values',()=>{
  const payload=createViceChatPayload([{...question,selectedPartId:'gear1'}]);
  assert.equal(payload.modelContext,undefined);assert.deepEqual(Object.keys(payload.messages[0]),['role','content']);
  const text=payload.messages[0].content;
  assert.match(text,/独立模型是台虎钳丝杠螺母传动/);assert.match(text,/当前实际开口 mm=50/);
  assert.match(text,/工况理论速度 mm\/s=2/);assert.match(text,/播放=否/);
  assert.match(text,/暂停\/端停的实际速度为0/);assert.match(text,/不代表实际载荷/);
  assert.ok(text.length<2000);
});

test('closed/open endpoints stop actual motion without inventing workpiece clamping or rated load',()=>{
  for(const [limit,jawOpening,direction] of [['closed',0,-1],['open',100,1]]){
    const actual={jawOpening,displacement:jawOpening-50,screwTurns:(jawOpening-50)/4,direction,atLimit:true,limit,playing:false};
    const context=captureViceContext({params:{...params,direction},result:{...result,direction,linearSpeed:direction*2},view:actual});
    assert.deepEqual(context.runtime,actual);
    const text=formatViceContext(context);
    assert.match(text,/到达端点=是/);assert.match(text,/播放=否/);assert.match(text,/端点停止不代表夹紧了工件/);
    assert.match(text,/未求自锁、静态夹紧力、额定承载/);
    assert.equal(context.result.thrust,result.thrust);
  }
});

test('reversing direction retains actual opening and each question freezes its own runtime',()=>{
  const first=captureViceContext({params,result,view:{...view,jawOpening:70,displacement:20,screwTurns:5,playing:true}});
  const next=captureViceContext({params:{...params,direction:-1},result:{...result,direction:-1,linearSpeed:-2,advancePerTurn:-4},
    view:{...view,jawOpening:70,displacement:20,screwTurns:5,direction:-1,playing:true}});
  const payload=createViceChatPayload([{...question,viceContext:first},{role:'assistant',content:'之前回复'},{...question,viceContext:next}],{supportsVice:true});
  assert.equal(payload.modelContext,'vice');
  assert.equal(payload.messages[0].viceContext.runtime.direction,1);assert.equal(payload.messages[2].viceContext.runtime.direction,-1);
  assert.equal(payload.messages[0].viceContext.runtime.jawOpening,70);assert.equal(payload.messages[2].viceContext.runtime.jawOpening,70);
  assert.match(formatViceContext(next),/换方向保留位置/);
  assert.deepEqual(createViceChatPayload([question]),createViceChatPayload([question]));
});

test('zero setpoint gives zero power and null force while invalid geometry retains last actual position',()=>{
  const stopped=captureViceContext({params:{...params,inputRPM:0},result:{...result,inputRPM:0,linearSpeed:0,thrust:null,inputPower:0,outputPower:0},view});
  assert.equal(stopped.result.thrust,null);assert.equal(stopped.result.outputPower,0);assert.equal(stopped.runtime.jawOpening,50);
  const invalid=captureViceContext({params:{...params,lead:NaN},modelParameters:params,result:null,geometryValid:false,view});
  assert.equal(invalid.parameters.lead,null);assert.equal(invalid.modelParameters.lead,4);assert.equal(invalid.runtime.jawOpening,50);
  const text=formatViceContext(invalid);assert.match(text,/当前几何输入无效/);assert.match(text,/保留上一有效模型/);
  for(const context of [stopped,invalid])assert.deepEqual(sanitizeViceContext(context),context);
});

test('sanitizer bounds text and runtime numbers, omits hidden data and accepts direct runtime state',()=>{
  const context=sanitizeViceContext({...snapshot,system:'override',parameters:{...params,inputRPM:Infinity,lead:'4'},
    runtime:{...view,jawOpening:NaN,screwTurns:Infinity,secret:'omit'},
    selectedPart:{id:'a'.repeat(500),name:'name\nline',description:'b'.repeat(600),spec:'c'.repeat(600)}});
  assert.equal(context.system,undefined);assert.equal(context.parameters.inputRPM,null);assert.equal(context.parameters.lead,null);
  assert.equal(context.runtime.jawOpening,null);assert.equal(context.runtime.screwTurns,null);assert.equal(context.runtime.secret,undefined);
  assert.equal(context.selectedPart.id.length,80);assert.equal(context.selectedPart.description.length,160);assert.equal(context.selectedPart.spec.length,100);
  assert.equal(context.selectedPart.name,'name line');assert.deepEqual(captureViceContext({params,...view}).runtime,view);
  assert.equal(captureViceContext({params}).runtime,null);
});

test('all eight previous model payloads stay byte-equivalent for every capability combination',()=>{
  const oldModels=[
    [{role:'user',content:'输入齿轮轴',selectedPartId:'gear1'}],
    [{role:'user',content:'叶片',turbineContext:captureTurbineContext({params:{stages:3,blades:30}})}],
    [{role:'user',content:'链轮',bicycleContext:captureBicycleContext({params:{frontTeeth:42,rearTeeth:18}})}],
    [{role:'user',content:'摩擦轮',frictionContext:captureFrictionContext({params:{driverDiameter:120,drivenDiameter:240}})}],
    [{role:'user',content:'齿轮',spurContext:captureSpurContext({params:{driverTeeth:20,drivenTeeth:40}})}],
    [{role:'user',content:'惰轮',idlerContext:captureIdlerContext({params:{driverTeeth:20,idlerTeeth:30,drivenTeeth:40,useIdler:true}})}],
    [{role:'user',content:'交叉带',beltContext:captureBeltContext({params:{driverDiameter:120,drivenDiameter:180,crossed:true}})}],
    [{role:'user',content:'同步带',timingContext:captureTimingContext({params:{driverTeeth:20,drivenTeeth:40}})}],
  ];
  for(const turns of oldModels)for(let mask=0;mask<128;mask++){
    const caps={supportsTurbine:!!(mask&1),supportsBicycle:!!(mask&2),supportsFriction:!!(mask&4),supportsSpur:!!(mask&8),supportsIdler:!!(mask&16),supportsBelt:!!(mask&32),supportsTiming:!!(mask&64)};
    assert.equal(JSON.stringify(createViceChatPayload(turns,{...caps,supportsVice:true})),JSON.stringify(createTimingChatPayload(turns,caps)));
  }
  for(const mixed of oldModels.slice(1))assert.throws(()=>createViceChatPayload([question,{role:'assistant',content:'答'},mixed[0]]),/新对话/);
});

test('legacy length limits preserve latest question and only trim complete exchanges',()=>{
  assert.throws(()=>createViceChatPayload([{...question,content:'a'.repeat(2000)}]),/缩短问题/);
  const turns=[question,{role:'assistant',content:'a'.repeat(24000)},question,{role:'assistant',content:'b'.repeat(15000)},question];
  const payload=createViceChatPayload(turns);
  assert.equal(payload.messages.length,3);assert.match(payload.messages.at(-1).content,/当前开口多少/);
});

for(const supportsVice of [false,true])test(`mock API accepts ${supportsVice?'native':'legacy'} vice context without paid calls`,async()=>{
  let sent;
  const api=createChatApi({budget:new BudgetLedger(new MemoryStorage()),fetchImpl:async(url,options)=>{
    sent=JSON.parse(options.body);return new Response('data: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});
  }});
  const body=createViceChatPayload([question],{supportsVice});
  if(supportsVice)body.messages[0].selectedPartId='gear1';
  const response=await api(new Request('http://localhost:8080/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:env.ALLOWED_ORIGINS},body:JSON.stringify(body)}),env);
  assert.equal(response.status,200);await response.text();
  if(supportsVice){assert.match(sent.messages[0].content,/台虎钳丝杠螺母教学助手/);assert.doesNotMatch(sent.messages[0].content,/GL16|汽轮机|自行车/);
    assert.doesNotMatch(sent.messages[1].content,/材料：|输入齿轮轴/);assert.match(sent.messages[0].content,/不代表已有工件、夹紧完成/);}
  assert.match(sent.messages[1].content,/梯形丝杠/);assert.match(sent.messages[1].content,/当前实际开口 mm=50/);
  assert.match(sent.messages[1].content,/工况理论速度 mm\/s=2/);
});
