import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runInNewContext} from 'node:vm';
import {models,expectedNumbers,modelFields,defaultParameters,validateParameters,parseParameterValue} from '../dist/catalog/registry.mjs';
import {captureCatalogContext,sanitizeCatalogContext,formatCatalogContext,createCatalogChatPayload} from '../dist/catalog/chat-context.mjs';
import {captureViceContext,createViceChatPayload} from '../dist/vice/chat-context.mjs';
import {captureTimingContext} from '../dist/timing/chat-context.mjs';
import {captureBeltContext} from '../dist/belt/chat-context.mjs';
import {captureIdlerContext} from '../dist/idler/chat-context.mjs';
import {captureSpurContext} from '../dist/spur/chat-context.mjs';
import {captureFrictionContext} from '../dist/friction/chat-context.mjs';
import {captureBicycleContext} from '../dist/bicycle/chat-context.mjs';
import {captureTurbineContext} from '../dist/turbine/chat-context.mjs';
import {createChatApi} from '../server/chat-api.mjs';
import worker from '../server/worker.mjs';
import {BudgetLedger} from '../server/budget.mjs';
import {MemoryStorage} from './test-storage.mjs';

const url=relative=>new URL(relative,import.meta.url).href;
const dataURL=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const THREE=await import(url('../dist/assets/three.module.js'));
const geometrySource=fs.readFileSync(new URL('../dist/catalog/geometry.mjs',import.meta.url),'utf8').replace("from 'three'",`from '${url('../dist/assets/three.module.js')}'`);
const geometryURL=dataURL(geometrySource),{geometryFor,shapeMesh}=await import(geometryURL);
const viewerSource=fs.readFileSync(new URL('../dist/catalog/viewer.mjs',import.meta.url),'utf8')
 .replace("from 'three'",`from '${url('../dist/assets/three.module.js')}'`)
 .replace("import {OrbitControls} from '../assets/OrbitControls.js';",'const OrbitControls=class {};')
 .replace("from './geometry.mjs'",`from '${geometryURL}'`)
 .replace("from './registry.mjs'",`from '${url('../dist/catalog/registry.mjs')}'`);
const {CatalogViewer}=await import(dataURL(viewerSource));
const near=(a,b,tolerance=1e-5)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
const clone=value=>JSON.parse(JSON.stringify(value));
function fakeViewer(){return Object.assign(Object.create(CatalogViewer.prototype),{scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),parts:[],amount:0,phase:0,playing:false,speed:1,housingMode:'solid',direction:new THREE.Vector3(.4,.28,1),render(){},home(){},fit(){}});}
function groupBoxes(viewer){const groups=new Map();viewer.root.updateMatrixWorld(true);for(const p of viewer.parts){const key=p.assemblyGroup||p.id;if(!groups.has(key))groups.set(key,new THREE.Box3());groups.get(key).union(new THREE.Box3().setFromObject(p.group));}return [...groups.entries()];}
function snapshot(model,changes={}){const p=defaultParameters(model),part=model.build(p).parts.find(p=>!p.hiddenInList);return captureCatalogContext({model,parameters:p,modelParameters:p,selectedPart:part,result:model.sample(p,1.3),phase:1.3,playing:false,geometryValid:true,description:model.description,limits:model.limits,principle:model.principle,...changes});}
const question=(model=models[0])=>({role:'user',content:'请解释当前参数和选中零件。',catalogContext:snapshot(model)});

test('all 35 unclaimed checklist items register exactly once, with typed fields and valid defaults',()=>{
 assert.equal(models.length,35);assert.deepEqual(models.map(m=>m.number),expectedNumbers);assert.equal(new Set(models.map(m=>m.id)).size,35);assert.ok(!models.some(m=>[35,38].includes(m.number)));
 for(const model of models){const fields=modelFields(model),p=defaultParameters(model);assert.equal(new Set(fields.map(f=>f.key)).size,fields.length);assert.ok(fields.some(f=>f.key==='inputRPM'));validateParameters(model,p);for(const f of fields){const values=f.options?f.options.map(o=>o[0]):[f.value,f.min,f.max];for(const value of values)assert.equal(parseParameterValue(f,String(value)),value,model.id+'.'+f.key);}}
});

test('shape origins and axes follow the production contract',()=>{
 const cylinder=geometryFor({kind:'cylinder',radius:2,length:10});cylinder.computeBoundingBox();near(cylinder.boundingBox.min.z,-5);near(cylinder.boundingBox.max.z,5);near(cylinder.boundingBox.max.y,2);cylinder.dispose();
 const ring=geometryFor({kind:'ring',outer:5,inner:3,length:4});ring.computeBoundingBox();near(ring.boundingBox.min.z,-2);near(ring.boundingBox.max.z,2);ring.dispose();
 const rod=geometryFor({kind:'rod',from:[2,3,4],to:[12,3,4],radius:1});rod.computeBoundingBox();near(rod.boundingBox.min.x,2);near(rod.boundingBox.max.x,12);near(rod.boundingBox.getCenter(new THREE.Vector3()).y,3);rod.dispose();
 const mesh=shapeMesh({kind:'box',size:[2,4,6],position:[10,20,30],rotation:[0,0,Math.PI/2]});mesh.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(mesh);near(b.getCenter(new THREE.Vector3()).z,30);near(b.getSize(new THREE.Vector3()).x,4);mesh.geometry.dispose();mesh.material.dispose();
});

test('model-specific home camera is opt-in and reset uses the same direction',()=>{
 const v=fakeViewer();for(const model of [models[0],models.find(m=>m.id==='valvetrain'),models.find(m=>m.id==='manual-gearbox')]){v.model=model;CatalogViewer.prototype.home.call(v);const expected=new THREE.Vector3(...(model.cameraDirection||[.4,.28,1])).normalize();near(v.direction.distanceTo(expected),0);}
 v.model={...models[0],cameraUp:[0,0,1],cameraDirection:[1,-1,.8]};CatalogViewer.prototype.home.call(v);assert.deepEqual(v.camera.up.toArray(),[0,0,1]);v.view('top');near(v.direction.z,1,.001);v.view('front');assert.deepEqual(v.camera.up.toArray(),[0,0,1]);assert.deepEqual(v.direction.toArray(),[0,-1,0]);v.model=models.find(m=>!m.cameraUp);CatalogViewer.prototype.home.call(v);assert.deepEqual(v.camera.up.toArray(),[0,1,0]);
 v.build({...models[0],cameraUp:[0,0,1]},defaultParameters(models[0]));v.setExplode(1);assert.deepEqual(v.camera.up.toArray(),[0,0,1]);assert.ok(Math.abs(v.direction.dot(v.camera.up))<.3);v.clear();
});

for(const model of models)test(`${model.number} ${model.id}: real production buffers and group explosion have finite, disjoint bounds`,()=>{
 const viewer=fakeViewer(),p=defaultParameters(model);viewer.build(model,p);assert.ok(viewer.parts.length>1);
 for(const part of viewer.parts){assert.ok(part.group.children.length,model.id+' empty part '+part.id);for(const mesh of part.group.children){const geometry=mesh.geometry;assert.ok(geometry.attributes.position.count>0);for(const [name,a] of Object.entries(geometry.attributes)){assert.ok(a.array.every(Number.isFinite),model.id+' nonfinite '+name);}if(geometry.index){assert.ok(geometry.index.array.every(i=>i<geometry.attributes.position.count));}geometry.computeBoundingBox();assert.equal(geometry.boundingBox.isEmpty(),false);}}
 for(const phase of [0,.7,5.8]){viewer.phase=phase;viewer.amount=0;viewer.applyPose();viewer.prepareExplosion();viewer.amount=1;viewer.applyPose();const groups=groupBoxes(viewer);for(const [id,b] of groups){assert.ok([...b.min,...b.max].every(Number.isFinite),model.id+' nonfinite bounds '+id);}for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++)assert.equal(groups[i][1].intersectsBox(groups[j][1]),false,`${model.id} exploded ${groups[i][0]} overlaps ${groups[j][0]}`);}
 viewer.setPlaying(true);assert.equal(viewer.playing,false,'cannot run exploded');viewer.restore();assert.equal(viewer.amount,0);assert.equal(viewer.phase,0);viewer.clear();
});

test('parameter boundaries and invalid viewer mutations retain the last valid geometry',()=>{
 const v=fakeViewer();assert.doesNotThrow(()=>v.restore());
 for(const model of models){const p=defaultParameters(model);for(const f of modelFields(model)){if(f.options){assert.throws(()=>validateParameters(model,{...p,[f.key]:'unregistered-option'}));assert.equal(parseParameterValue(f,'unregistered-option'),undefined);}else{assert.ok(Number.isNaN(parseParameterValue(f,'')));assert.ok(Number.isNaN(parseParameterValue(f,'  ')));for(const bad of [NaN,Infinity,null,String(f.value),f.min-1,f.max+1])assert.throws(()=>validateParameters(model,{...p,[f.key]:bad}),model.id+'.'+f.key);}}}
 const model=models[0],p=defaultParameters(model);v.build(model,p);const root=v.root,parts=v.parts,saved=clone(v.params);v.phase=2.5;v.playing=true;
 assert.throws(()=>v.build(model,{...p,inputRPM:NaN}));assert.equal(v.root,root);assert.equal(v.parts,parts);assert.deepEqual(v.params,saved);
 assert.throws(()=>v.setParameters({...p,inputRPM:-1}));assert.deepEqual(v.params,saved);assert.equal(v.phase,2.5);
 v.setParameters({...p,inputRPM:0});assert.equal(v.root,root);assert.equal(v.parts,parts);assert.equal(v.phase,2.5);assert.equal(v.playing,false);v.clear();
});

test('catalog snapshots freeze parameters, motion, selected part and formulas at question time',()=>{
 for(const model of models){const p=defaultParameters(model),source={model:{id:model.id,title:model.title},parameters:p,modelParameters:{...p},selectedPart:{id:'a',name:'零件',description:'用途'},result:clone(model.sample(p,1.2)),phase:1.2,playing:true,geometryValid:true,limits:model.limits,description:model.description,principle:clone(model.principle)};
  const c=captureCatalogContext(source),saved=clone(c);source.parameters.inputRPM=99;source.model.title='mutated';source.selectedPart.name='mutated';source.result.metrics[0].value='mutated';source.principle[0].formula='mutated';assert.deepEqual(c,saved);assert.deepEqual(sanitizeCatalogContext(c),c);assert.ok(formatCatalogContext(c).length<=1450);assert.match(formatCatalogContext(c),/20%慢放/);}
 assert.equal(captureCatalogContext(null),null);assert.equal(captureCatalogContext([]),null);assert.equal(captureCatalogContext({model:{id:'bad id'}}),null);
 const c=captureCatalogContext({model:{id:'cvt',title:'a\nb'},parameters:Object.fromEntries(Array.from({length:50},(_,i)=>['k'+i,'v'.repeat(1000)])),result:{metrics:Array.from({length:50},()=>({label:'x'.repeat(200),value:Infinity,unit:'y'.repeat(100)}))},phase:Infinity,playing:'true',principle:'invalid',accessToken:'never-include'});
 assert.equal(c.title,'a b');assert.equal(Object.keys(c.parameters).length,24);assert.equal(c.parameters.k0.length,60);assert.equal(c.metrics.length,8);assert.equal(c.metrics[0].value,null);assert.equal(c.phase,null);assert.equal(c.playing,false);assert.equal(c.accessToken,undefined);
 const invalid=snapshot(models[0],{parameters:{inputRPM:NaN},geometryValid:false});assert.equal(invalid.parameters.inputRPM,null);assert.match(formatCatalogContext(invalid),/输入无效/);assert.match(formatCatalogContext(invalid),/上次有效工况/);
});

test('native and legacy catalog payloads bound history and reject cross-model conversations',()=>{
 const turn=question();for(const supportsCatalog of [false,true]){const p=createCatalogChatPayload([turn],{supportsCatalog});assert.equal(p.modelContext,supportsCatalog?'catalog':undefined);assert.equal(!!p.messages[0].catalogContext,supportsCatalog);assert.equal(p.messages[0].selectedPartId,undefined);if(!supportsCatalog)assert.match(p.messages[0].content,/不沿用GL16/);
  const turns=Array.from({length:20},(_,i)=>[{...turn,content:'问题'+i},{role:'assistant',content:'答'.repeat(2200)}]).flat();turns.push({...turn,content:'最新问题保留'});const history=createCatalogChatPayload(turns,{supportsCatalog});assert.ok(history.messages.length<=21&&history.messages.length%2===1);assert.match(history.messages.at(-1).content,/最新问题保留/);assert.ok(history.messages.reduce((n,m)=>n+m.content.length+(m.catalogContext?formatCatalogContext(m.catalogContext).length:0),0)<=32000);assert.ok(new TextEncoder().encode(JSON.stringify(history)).length<=120000);
 }
 assert.throws(()=>createCatalogChatPayload([{...turn,content:'a'.repeat(2000)}]),/过长/);assert.throws(()=>createCatalogChatPayload([{...turn,content:'a'.repeat(2001)}],{supportsCatalog:true}),/过长/);
 for(const other of [question(models[1]),{role:'user',content:'旧减速器',selectedPartId:'gear1'},{role:'user',content:'丝杠',viceContext:captureViceContext({})}])assert.throws(()=>createCatalogChatPayload([turn,{role:'assistant',content:'回复'},other],{supportsCatalog:true}),/新对话/);
 const a=createCatalogChatPayload([turn],{supportsCatalog:true});turn.catalogContext.parameters.inputRPM=100;assert.notEqual(a.messages[0].catalogContext.parameters.inputRPM,100);
});

test('production chat UI blocks unsupported catalog send, submit and retry; native and old pages stay enabled',async()=>{
 const source=fs.readFileSync(new URL('../dist/chat.js',import.meta.url),'utf8').replace(/^import[^\n]+\n/gm,'').replace('void connect();','')+
  '\nglobalThis.chatTest={setBackend(value,supported){ready=value;supportsCatalog=supported;updateButtons();},requestReply};';
 function harness(catalog){
  const elements=new Map(),suggestions=[];let calls=0;
  const element=()=>({value:'解释当前模型',textContent:'',children:[],dataset:{},listeners:{},hidden:false,disabled:false,readOnly:false,addEventListener(name,fn){this.listeners[name]=fn;},setAttribute(){},append(...els){this.children.push(...els);},replaceChildren(...els){this.children=els;},focus(){},remove(){},querySelector(){return element();}});
  const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};for(let k=0;k<3;k++)suggestions.push(element());
  const window={addEventListener(){},...(catalog?{__catalogLab:{getState:()=>({model:{id:'planetary',title:'简单行星齿轮传动'},parameters:{inputRPM:30},result:{metrics:[]}})}}:{})};
  const context={window,document:{getElementById:get,querySelector:selector=>get(selector),querySelectorAll:()=>suggestions,createElement:()=>element()},MutationObserver:class {observe(){}},console,
   canChat:()=>true,openAuth:()=>{throw Error('Unexpected login prompt');},captureExperimentContext:()=>null,captureCatalogContext,captureViceContext,captureTimingContext,captureBeltContext,captureIdlerContext,captureSpurContext,captureFrictionContext,captureBicycleContext,captureTurbineContext,createChatPayload:createCatalogChatPayload,
   fetch:async()=>{calls++;throw Error('Unexpected provider call');},setTimeout,clearTimeout,AbortController,URL};
  runInNewContext(source,context);return {get,suggestions,api:context.chatTest,get calls(){return calls;}};
 }
 const blocked=harness(true);blocked.api.setBackend(true,false);assert.equal(blocked.get('chat-send').disabled,true);assert.equal(blocked.get('chat-input').readOnly,true);assert.ok(blocked.suggestions.every(b=>b.disabled));assert.equal(blocked.get('chat-notice-text').textContent,'当前机构AI服务待更新');
 blocked.get('chat-form').listeners.submit({preventDefault(){}});await blocked.api.requestReply(question());assert.equal(blocked.calls,0);assert.equal(blocked.get('chat-input').value,'解释当前模型');assert.equal(blocked.get('chat-messages').children.length,0);
 blocked.api.setBackend(true,true);assert.equal(blocked.get('chat-send').disabled,false);assert.equal(blocked.get('chat-input').readOnly,false);assert.ok(blocked.suggestions.every(b=>!b.disabled));
 const old=harness(false);old.api.setBackend(true,false);assert.equal(old.get('chat-send').disabled,false);assert.equal(old.get('chat-input').readOnly,false);assert.ok(old.suggestions.every(b=>!b.disabled));assert.notEqual(old.get('chat-notice-text').textContent,'当前机构AI服务待更新');
});

test('all nine existing experiment payloads remain byte-equivalent in all capability combinations',()=>{
 const old=[
  {role:'user',content:'输入齿轮轴',selectedPartId:'gear1'},
  {role:'user',content:'叶片',turbineContext:captureTurbineContext({params:{stages:3,blades:30}})},
  {role:'user',content:'链条',bicycleContext:captureBicycleContext({params:{frontTeeth:42,rearTeeth:18}})},
  {role:'user',content:'摩擦轮',frictionContext:captureFrictionContext({params:{driverDiameter:120,drivenDiameter:240}})},
  {role:'user',content:'直齿轮',spurContext:captureSpurContext({params:{driverTeeth:20,drivenTeeth:40}})},
  {role:'user',content:'惰轮',idlerContext:captureIdlerContext({params:{useIdler:true,driverTeeth:20,idlerTeeth:30,drivenTeeth:40}})},
  {role:'user',content:'交叉带',beltContext:captureBeltContext({params:{crossed:true,driverDiameter:120,drivenDiameter:180}})},
  {role:'user',content:'同步带',timingContext:captureTimingContext({params:{driverTeeth:20,drivenTeeth:40}})},
  {role:'user',content:'丝杠',viceContext:captureViceContext({params:{lead:4,inputRPM:30,direction:1}})}
 ];const names=['supportsTurbine','supportsBicycle','supportsFriction','supportsSpur','supportsIdler','supportsBelt','supportsTiming','supportsVice'];
 for(const t of old)for(let mask=0;mask<256;mask++){const caps=Object.fromEntries(names.map((name,k)=>[name,!!(mask&(1<<k))]));for(const supportsCatalog of [false,true])assert.equal(JSON.stringify(createCatalogChatPayload([t],{...caps,supportsCatalog})),JSON.stringify(createViceChatPayload([t],caps)));}
});

const env={DEEPSEEK_API_KEY:'mock-no-billing',ALLOWED_ORIGINS:'http://localhost:8080'};
const request=body=>new Request('http://localhost:8080/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:env.ALLOWED_ORIGINS},body:JSON.stringify(body)});
function mockApi(){let sent=null,calls=0;const api=createChatApi({budget:new BudgetLedger(new MemoryStorage()),fetchImpl:async(url,options)=>{calls++;sent=JSON.parse(options.body);return new Response('data: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});}});return {api,get sent(){return sent;},get calls(){return calls;}};}

test('all 35 native catalog snapshots use generic system and canonical model metadata, with no paid API',async()=>{
 for(const model of models){const mock=mockApi(),payload=createCatalogChatPayload([question(model)],{supportsCatalog:true});payload.messages[0].selectedPartId='gear1';payload.messages[0].catalogContext.title='forged-title';payload.messages[0].catalogContext.limits='forged-limits';
  const response=await mock.api(request(payload),env);assert.equal(response.status,200,model.id+' '+await(response.status===200?Promise.resolve(''):response.text()));await response.text();assert.equal(mock.calls,1);assert.match(mock.sent.messages[0].content,/机械机构教学助手/);assert.doesNotMatch(mock.sent.messages[0].content,/GL16|1440|输入齿轮轴/);assert.ok(mock.sent.messages[1].content.includes(model.title));assert.doesNotMatch(mock.sent.messages[1].content,/forged-title|forged-limits|材料：/);assert.ok(mock.sent.messages[1].content.includes(model.limits.slice(0,20)));}
});

test('server rejects missing, unknown and mixed catalog snapshots before any upstream call',async()=>{
 const good=createCatalogChatPayload([question()],{supportsCatalog:true});const cases=[{modelContext:'catalog',messages:[{role:'user',content:'没有快照'}]}, {...good,messages:[{...good.messages[0],catalogContext:{...good.messages[0].catalogContext,id:'unknown-model'}}]}, {modelContext:'catalog',messages:[good.messages[0],{role:'assistant',content:'回答'},createCatalogChatPayload([question(models[1])],{supportsCatalog:true}).messages[0]]}];
 for(const payload of cases){const mock=mockApi(),r=await mock.api(request(payload),env);assert.equal(r.status,400);assert.equal(mock.calls,0);}
 const mock=mockApi(),legacy=createCatalogChatPayload([question()]);const response=await mock.api(request(legacy),env);assert.equal(response.status,200);await response.text();assert.match(mock.sent.messages[1].content,/不沿用GL16/);
 const a=await mock.api(new Request('http://localhost:8080/api/health'),env),b=await worker.fetch(new Request('https://example.workers.dev/api/health'),{});assert.ok((await a.json()).modelContexts.includes('catalog'));assert.ok((await b.json()).modelContexts.includes('catalog'));
});

test('generated catalog page provides all static app IDs once and shares the original control order',()=>{
 const html=fs.readFileSync(new URL('../dist/catalog.html',import.meta.url),'utf8'),app=fs.readFileSync(new URL('../dist/catalog/app.mjs',import.meta.url),'utf8'),timing=fs.readFileSync(new URL('../dist/timing.html',import.meta.url),'utf8');
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);for(const [,id]of app.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.includes(id),'missing '+id);
 const controls=['play','speed','explode','explode-all','assemble-all','step-prev','step-next','home-view','front-view','top-view','fullscreen','housing-mode','labels-toggle'];const order=text=>controls.slice().sort((a,b)=>text.indexOf('id="'+a+'"')-text.indexOf('id="'+b+'"'));assert.deepEqual(order(html),order(timing));assert.ok(html.indexOf('id="parameters"')>html.indexOf('id="viewport"'));assert.match(app,/\$\('chat-reset'\)\.click\(\)/);
});
