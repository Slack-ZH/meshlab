import test from 'node:test';
import assert from 'node:assert/strict';
import {definitions,defaults,results,advance,phaseFor,assemblySteps} from '../dist/experiments/catalog.mjs';
import * as linkage from '../dist/linkages/mechanics.mjs';
import * as mechanism from '../dist/mechanisms/mechanics.mjs';
import {captureExperimentContext,formatExperimentContext,createExperimentChatPayload} from '../dist/experiments/chat-context.mjs';
import {createCatalogChatPayload,captureCatalogContext} from '../dist/catalog/chat-context.mjs';
import {models,defaultParameters} from '../dist/catalog/registry.mjs';
import {captureViceContext} from '../dist/vice/chat-context.mjs';
import {captureTimingContext} from '../dist/timing/chat-context.mjs';
import {captureBeltContext} from '../dist/belt/chat-context.mjs';
import {captureIdlerContext} from '../dist/idler/chat-context.mjs';
import {captureSpurContext} from '../dist/spur/chat-context.mjs';
import {captureFrictionContext} from '../dist/friction/chat-context.mjs';
import {captureBicycleContext} from '../dist/bicycle/chat-context.mjs';
import {captureTurbineContext} from '../dist/turbine/chat-context.mjs';
import {createChatApi} from '../server/chat-api.mjs';
import {BudgetLedger} from '../server/budget.mjs';
import {MemoryStorage} from './test-storage.mjs';

const contextFor=(kind)=>{const p=defaults(kind),input=definitions[kind].initial;return captureExperimentContext({kind,params:p,modelParameters:p,input,result:results(kind,p,input),selectedPart:{id:'input',name:'输入件',spec:'参数化尺寸'},view:{step:2},speed:1});};
for(const kind of Object.keys(definitions)){
  test(kind+' captures valid, stopped and invalid snapshots without sharing mutable state',()=>{
    const p=defaults(kind),r=results(kind,p,definitions[kind].initial),part={name:'输入件',spec:'参数化尺寸'},s={kind,params:p,result:r,selectedPart:part,input:definitions[kind].initial,token:'must not leak',view:{step:3,meshes:[1]}};
    const c=captureExperimentContext(s),first=definitions[kind].fields[0].key;
    p[first]=-1;r.secret='private';part.name='changed';
    assert.equal(c.parameters[first],defaults(kind)[first]);assert.equal(c.selectedPart.name,'输入件');assert.equal(c.result.secret,undefined);assert.equal(c.token,undefined);assert.equal(c.view.meshes,undefined);
    const text=formatExperimentContext(c);assert.ok(text.includes(definitions[kind].title));assert.ok(text.includes(assemblySteps[kind][3].title));assert.ok(text.length<1500);
    const invalid=captureExperimentContext({...s,modelParameters:defaults(kind),geometryValid:false});assert.equal(invalid.valid,false);assert.equal(invalid.result,null);assert.equal(invalid.modelParameters[first],defaults(kind)[first]);assert.match(formatExperimentContext(invalid),/不可把上一有效模型/);
    const stopped={...defaults(kind),rpm:0};assert.equal(captureExperimentContext({kind,params:stopped,result:results(kind,stopped,definitions[kind].initial)}).valid,true);
  });
  test(kind+' uses exactly 20% physical playback while preserving engineering results',()=>{
    const p=defaults(kind),input=definitions[kind].initial,phase=phaseFor(kind,p,input),dt=.05,speed=1.7;
    const actual=advance(kind,p,{input,phase},dt,speed);
    const expected=Object.hasOwn(linkage.definitions,kind)?linkage.advance(kind,p,{angle:input,phase},dt*.2,speed):mechanism.advance(kind,p,input,dt*.2,speed,1);
    assert.equal(actual.input,expected.angle??expected.input);
    assert.equal(advance(kind,{...p,rpm:0},{input,phase},10,2).input,input);
  });
  test(kind+' accepted by unchanged API using a mocked upstream without external calls',async()=>{
    let sent;const api=createChatApi({budget:new BudgetLedger(new MemoryStorage()),fetchImpl:async(url,options)=>{sent=JSON.parse(options.body);return new Response('data: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});}});
    const body=createExperimentChatPayload([{role:'user',content:'当前尺寸如何影响运动？',experimentContext:contextFor(kind),selectedPartId:'gear1'}]);
    assert.deepEqual(Object.keys(body),['messages']);assert.deepEqual(Object.keys(body.messages[0]),['role','content']);
    const response=await api(new Request('http://localhost:8080/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost:8080'},body:JSON.stringify(body)}),{DEEPSEEK_API_KEY:'unit-test-only',ALLOWED_ORIGINS:'http://localhost:8080'});
    assert.equal(response.status,200);await response.text();assert.ok(sent.messages[1].content.includes(definitions[kind].title));assert.doesNotMatch(sent.messages[1].content,/材料：|输入齿轮轴/);
  });
}
test('retry preserves original snapshot and follow-up owns its new snapshot',()=>{
  const old=contextFor('scotch-yoke'),turn={role:'user',content:'原问题',experimentContext:old},original=createExperimentChatPayload([turn]);
  const next=contextFor('scotch-yoke');next.parameters.r=50;
  const continued=createExperimentChatPayload([turn,{role:'assistant',content:'答复'},{role:'user',content:'新问题',experimentContext:next}]);
  assert.deepEqual(createExperimentChatPayload([turn]),original);assert.match(continued.messages[0].content,/r=40/);assert.match(continued.messages[2].content,/r=50/);
  assert.throws(()=>createExperimentChatPayload([{...turn,content:'长'.repeat(2000)}]),/缩短/);
  const trimmed=createExperimentChatPayload([turn,{role:'assistant',content:'a'.repeat(24000)},turn,{role:'assistant',content:'b'.repeat(15000)},turn]);assert.equal(trimmed.messages.length,3);assert.ok(trimmed.messages.at(-1).content.endsWith('原问题'));
});
test('all previous experiments retain byte-equivalent payloads across capabilities',()=>{
  const capture={turbine:captureTurbineContext,bicycle:captureBicycleContext,friction:captureFrictionContext,spur:captureSpurContext,idler:captureIdlerContext,belt:captureBeltContext,timing:captureTimingContext,vice:captureViceContext};
  const oldModels=[[{role:'user',content:'问',selectedPartId:'gear1'}],...Object.entries(capture).map(([id,fn])=>[{role:'user',content:'问',[id+'Context']:fn({params:{}})}]),...models.map(model=>[{role:'user',content:'问',catalogContext:captureCatalogContext({model,parameters:defaultParameters(model),result:{metrics:[]}})}])];
  assert.equal(oldModels.length,44);
  const flags=['supportsTurbine','supportsBicycle','supportsFriction','supportsSpur','supportsIdler','supportsBelt','supportsTiming','supportsVice','supportsCatalog'];
  const capabilities=[{},Object.fromEntries(flags.map(f=>[f,true])),...flags.map(f=>({[f]:true}))];
  for(const turns of oldModels)for(const caps of capabilities)assert.equal(JSON.stringify(createExperimentChatPayload(turns,caps)),JSON.stringify(createCatalogChatPayload(turns,caps)));
  assert.equal(captureExperimentContext(null),null);assert.equal(captureExperimentContext({kind:'bicycle'}),null);
});

test('cross-mechanism and mixed old/new histories are rejected without relabelling prior turns',()=>{
  const turn={role:'user',content:'问',experimentContext:contextFor('scotch-yoke')};
  for(const other of [{role:'user',content:'旧问题',selectedPartId:'gear1'},{...turn,experimentContext:contextFor('quick-return')},{role:'user',content:'目录问题',catalogContext:captureCatalogContext({model:models[0],parameters:defaultParameters(models[0])})}])assert.throws(()=>createExperimentChatPayload([turn,{role:'assistant',content:'答复'},other]),/机构已切换/);
});
