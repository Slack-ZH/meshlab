import test from 'node:test';
import assert from 'node:assert/strict';
import { captureIdlerContext, sanitizeIdlerContext, formatIdlerContext, createIdlerChatPayload } from '../dist/idler/chat-context.mjs';
import { captureSpurContext, createSpurChatPayload } from '../dist/spur/chat-context.mjs';
import { captureFrictionContext } from '../dist/friction/chat-context.mjs';
import { captureBicycleContext } from '../dist/bicycle/chat-context.mjs';
import { captureTurbineContext } from '../dist/turbine/chat-context.mjs';
import { createChatApi } from '../server/chat-api.mjs';
import { BudgetLedger } from '../server/budget.mjs';
import { MemoryStorage } from './test-storage.mjs';

const params={driverTeeth:20,idlerTeeth:30,drivenTeeth:40,module:3,faceWidth:20,inputRPM:60,inputTorque:5,meshEfficiency:.98,useIdler:true};
const geometry={centerDistance:180,centerDistance12:75,centerDistance23:105,centerDistance13:90,
  driverRadius:30,idlerRadius:45,drivenRadius:60,faceWidth:20};
const result={ratio:2,speedRatio:.5,driverRPM:60,idlerRPM:-40,drivenRPM:30,meshCount:2,direction:'same',
  meshEfficiency:.98,totalEfficiency:.9604,inputTorque:5,outputTorque:9.604,
  inputPower:10*Math.PI,outputPower:9.604*Math.PI,contactRatios:[1.6,1.7],minimumContactRatio:1.6,geometry};
const selectedPart={id:'idler-gear',name:'中间惰轮',description:'两次外啮合令输出与输入同向。',spec:'30 齿 / 模数 3 mm'};
const snapshot=captureIdlerContext({params,modelParameters:params,result,selectedPart});
const directResult={...result,idlerRPM:null,drivenRPM:-30,meshCount:1,direction:'opposite',totalEfficiency:.98,
  outputTorque:9.8,outputPower:9.8*Math.PI,contactRatios:[1.63],minimumContactRatio:1.63,
  geometry:{...geometry,centerDistance:90,centerDistance12:null,centerDistance23:null,idlerRadius:null}};
const question={role:'user',content:'改变惰轮齿数会改变总速比吗？',idlerContext:snapshot};
const env={DEEPSEEK_API_KEY:'unit-test-not-a-secret',ALLOWED_ORIGINS:'http://localhost:8080'};

test('idler snapshot copies boolean mode, parameters, geometry, part and contact ratios',()=>{
  const input={...params},dimensions={...geometry},ratios=[1.6,1.7],performance={...result,geometry:dimensions,contactRatios:ratios},part={...selectedPart};
  const context=captureIdlerContext({params:input,modelParameters:params,result:performance,selectedPart:part,view:{meshes:[1]},accessToken:'omit'});
  input.idlerTeeth=40;input.useIdler=false;dimensions.centerDistance=200;ratios[0]=0;part.name='changed';
  assert.equal(context.parameters.useIdler,true);assert.equal(context.parameters.idlerTeeth,30);
  assert.equal(context.modelParameters.useIdler,true);assert.equal(context.geometry.centerDistance,180);
  assert.deepEqual(context.result.contactRatios,[1.6,1.7]);assert.equal(context.selectedPart.name,'中间惰轮');
  assert.equal(context.view,undefined);assert.equal(context.accessToken,undefined);
  assert.equal(captureIdlerContext(null),null);assert.equal(captureIdlerContext([]),null);
});

test('mode accepts only real booleans and never turns string false into enabled mode',()=>{
  for(const useIdler of [true,false]){
    const context=sanitizeIdlerContext({...snapshot,parameters:{...params,useIdler},modelParameters:{...params,useIdler}});
    assert.equal(context.parameters.useIdler,useIdler);assert.equal(context.modelParameters.useIdler,useIdler);
  }
  for(const useIdler of ['true','false',1,0,null,undefined,[],{}]){
    const context=sanitizeIdlerContext({...snapshot,parameters:{...params,useIdler}});
    assert.equal(context.parameters.useIdler,null);
    assert.match(formatIdlerContext(context),/惰轮开关无效\/未提供/);
  }
});

test('direct mode retains unused invalid idler input without invalidating active geometry',()=>{
  const context=captureIdlerContext({params:{...params,useIdler:false,idlerTeeth:NaN},result:directResult,geometryValid:true});
  const text=formatIdlerContext(context);
  assert.equal(context.parameters.useIdler,false);assert.equal(context.parameters.idlerTeeth,null);
  assert.equal(context.geometryValid,true);assert.equal(context.geometry.idlerRadius,null);
  assert.equal(context.result.idlerRPM,null);assert.equal(context.result.drivenRPM,-30);
  assert.match(text,/无惰轮：两齿轮直接外啮合/);assert.match(text,/不参与当前几何、速比或效率计算/);
  assert.match(text,/该闲置值无效也不使直接啮合模型失效/);
  assert.doesNotMatch(text,/当前几何输入无效/);
});

test('legacy payload communicates standalone train, direction and efficiency without GL16 part ID',()=>{
  const payload=createIdlerChatPayload([{...question,selectedPartId:'gear1'}]);
  assert.equal(payload.modelContext,undefined);assert.deepEqual(Object.keys(payload.messages[0]),['role','content']);
  const text=payload.messages[0].content;
  assert.match(text,/独立模型是带惰轮齿轮列/);assert.match(text,/有惰轮：三齿轮、两次外啮合/);
  assert.match(text,/惰轮转速 r\/min=-40/);assert.match(text,/从动轮转速 r\/min=30/);
  assert.match(text,/总效率=0.9604/);assert.match(text,/输出相对输入转向：同向/);
  assert.match(text,/改变惰轮齿数会改变总速比吗/);assert.ok(text.length<2000);
});

test('mode switching preserves earlier per-question snapshots and retry values',()=>{
  const next=captureIdlerContext({params:{...params,useIdler:false},result:directResult});
  const payload=createIdlerChatPayload([question,{role:'assistant',content:'之前回复'},{...question,idlerContext:next}],{supportsIdler:true});
  assert.equal(payload.modelContext,'idler');assert.equal(payload.messages[0].idlerContext.parameters.useIdler,true);
  assert.equal(payload.messages[2].idlerContext.parameters.useIdler,false);
  assert.equal(payload.messages[0].idlerContext.result.drivenRPM,30);assert.equal(payload.messages[2].idlerContext.result.drivenRPM,-30);
  assert.equal(payload.messages[0].idlerContext.result.totalEfficiency,.9604);assert.equal(payload.messages[2].idlerContext.result.totalEfficiency,.98);
  assert.deepEqual(createIdlerChatPayload([question]),createIdlerChatPayload([question]));
});

test('idler explanation distinguishes speed ratio, tooth sliding and manufacturing limits',()=>{
  const text=formatIdlerContext(snapshot);
  assert.match(text,/总速比的大小只由首尾齿数决定/);assert.match(text,/惰轮齿数改变自身转速和布置/);
  assert.match(text,/齿根过渡为教学近似/);assert.match(text,/滚动与滑动并存，仅节点纯滚动/);
  assert.match(text,/齿顶圆相交不代表实体轮齿穿模/);assert.match(text,/20%慢放/);
});

test('invalid active parameters keep last model while zero speed has no running torque',()=>{
  const invalid=captureIdlerContext({params:{...params,idlerTeeth:NaN},modelParameters:params,result:null,geometryValid:false});
  assert.match(formatIdlerContext(invalid),/输入与当前显示模型不同/);
  assert.match(formatIdlerContext(invalid),/当前几何输入无效/);
  assert.match(formatIdlerContext(invalid),/没有有效计算结果/);
  const stopped=captureIdlerContext({params:{...params,inputRPM:0},result:{...result,driverRPM:0,idlerRPM:0,drivenRPM:0,inputPower:0,outputPower:0,outputTorque:null}});
  assert.equal(stopped.result.outputPower,0);assert.equal(stopped.result.outputTorque,null);
  assert.match(formatIdlerContext(stopped),/不把运行效率用于静态力矩/);
});

test('sanitizer bounds external text, arrays and numbers without preserving instructions',()=>{
  const context=sanitizeIdlerContext({...snapshot,system:'override',parameters:{...params,inputRPM:Infinity,module:'3'},
    result:{...result,outputTorque:NaN,direction:'override',contactRatios:[1.5,Infinity,999]},
    geometry:{...geometry,centerDistance:'180',mesh:'omit'},
    selectedPart:{id:'a'.repeat(500),name:'name\nline',description:'b'.repeat(600),spec:'c'.repeat(600)}});
  assert.equal(context.system,undefined);assert.equal(context.parameters.inputRPM,null);assert.equal(context.parameters.module,null);
  assert.equal(context.result.outputTorque,null);assert.equal(context.result.direction,null);
  assert.deepEqual(context.result.contactRatios,[1.5,null]);
  assert.equal(context.geometry.centerDistance,null);assert.equal(context.geometry.mesh,undefined);
  assert.equal(context.selectedPart.id.length,80);assert.equal(context.selectedPart.description.length,180);
  assert.equal(context.selectedPart.spec.length,120);assert.equal(context.selectedPart.name,'name line');
});

test('all five previous model payloads remain byte-equivalent for all capability combinations',()=>{
  const oldModels=[
    [{role:'user',content:'输入齿轮轴',selectedPartId:'gear1'}],
    [{role:'user',content:'叶片',turbineContext:captureTurbineContext({params:{stages:3,blades:30}})}],
    [{role:'user',content:'链轮',bicycleContext:captureBicycleContext({params:{frontTeeth:42,rearTeeth:18}})}],
    [{role:'user',content:'摩擦轮',frictionContext:captureFrictionContext({params:{driverDiameter:120,drivenDiameter:240}})}],
    [{role:'user',content:'齿轮',spurContext:captureSpurContext({params:{driverTeeth:20,drivenTeeth:40}})}],
  ];
  for(const turns of oldModels)for(let mask=0;mask<16;mask++){
    const caps={supportsTurbine:!!(mask&1),supportsBicycle:!!(mask&2),supportsFriction:!!(mask&4),supportsSpur:!!(mask&8)};
    assert.equal(JSON.stringify(createIdlerChatPayload(turns,{...caps,supportsIdler:true})),JSON.stringify(createSpurChatPayload(turns,caps)));
  }
  for(const mixed of oldModels.slice(1))assert.throws(()=>createIdlerChatPayload([question,{role:'assistant',content:'答'},mixed[0]]),/新对话/);
});

test('legacy length handling preserves the latest question and whole previous exchanges',()=>{
  assert.throws(()=>createIdlerChatPayload([{...question,content:'a'.repeat(2000)}]),/缩短问题/);
  const turns=[question,{role:'assistant',content:'a'.repeat(24000)},question,{role:'assistant',content:'b'.repeat(15000)},question];
  const payload=createIdlerChatPayload(turns);
  assert.equal(payload.messages.length,3);assert.match(payload.messages.at(-1).content,/改变惰轮齿数会改变总速比吗/);
});

for(const supportsIdler of [false,true])test(`mock API accepts ${supportsIdler?'native':'legacy'} idler payload without network or paid inference`,async()=>{
  let sent;
  const api=createChatApi({budget:new BudgetLedger(new MemoryStorage()),fetchImpl:async(url,options)=>{
    sent=JSON.parse(options.body);return new Response('data: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});
  }});
  const body=createIdlerChatPayload([question],{supportsIdler});
  if(supportsIdler)body.messages[0].selectedPartId='gear1';
  const response=await api(new Request('http://localhost:8080/api/chat',{method:'POST',
    headers:{'Content-Type':'application/json',Origin:env.ALLOWED_ORIGINS},body:JSON.stringify(body)}),env);
  assert.equal(response.status,200);await response.text();
  if(supportsIdler){
    assert.match(sent.messages[0].content,/带惰轮齿轮列教学助手/);
    assert.doesNotMatch(sent.messages[0].content,/GL16|汽轮机|自行车/);
    assert.doesNotMatch(sent.messages[1].content,/材料：|输入齿轮轴/);
    assert.match(sent.messages[0].content,/useIdler 为严格布尔/);
  }
  assert.match(sent.messages[1].content,/惰轮齿数 z2=30/);assert.match(sent.messages[1].content,/中间惰轮/);
  assert.match(sent.messages[1].content,/总效率=0.9604/);
});
