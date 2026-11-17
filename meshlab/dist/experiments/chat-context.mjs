import {definitions,readouts,validate,inputLabel,inputUnit,assemblySteps,ANIMATION_SCALE} from './catalog.mjs';
import {createCatalogChatPayload} from '../catalog/chat-context.mjs';

const finite=v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<1e8?v:null;
const text=(v,max)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max):'';
const numbers=(fields,source)=>Object.fromEntries(fields.map(f=>[f.key,finite(source?.[f.key])]));
export function captureExperimentContext(state){
  if(!state||typeof state!=='object'||!Object.hasOwn(definitions,state.kind))return null;
  const kind=state.kind,d=definitions[kind],part=state.selectedPart||{};
  let valid=state.geometryValid!==false;try{validate(kind,state.params||{});}catch{valid=false;}
  const resultKeys=[...new Set([...readouts(kind).map(r=>r[1]),'outputAngle','couplerAngle','displacement','comparison','slotTravel','height','stroke','ratio','workTime','returnTime','workFraction','stepAngle','dwellPercent','indexCount'])];
  const result=valid&&state.result?Object.fromEntries(resultKeys.filter(k=>typeof state.result[k]==='number'||state.result[k]===null).map(k=>[k,finite(state.result[k])])):null;
  return{kind,title:d.title,parameters:numbers(d.fields,state.params),modelParameters:numbers(d.fields,state.modelParameters||state.params),valid,result,input:finite(state.input),phase:text(state.result?.phase,70),
    selectedPart:{id:text(part.id,60),name:text(part.name,60),description:text(part.description,180),spec:text(part.spec,140)},
    view:{playing:Boolean(state.playing),step:Number.isInteger(state.view?.step)?Math.max(0,Math.min(4,state.view.step)):0,amount:finite(state.view?.amount)||0,speed:finite(state.speed)||1,animationScale:ANIMATION_SCALE,direction:state.direction===-1?-1:1}};
}
const value=v=>v===null?'无效/未提供':typeof v==='number'?Number(v.toPrecision(7)).toString():String(v);
export function formatExperimentContext(context){
  const d=definitions[context.kind];if(!d)throw Error('无法识别当前实验，请刷新页面后重试。');
  const parameters=p=>d.fields.map(f=>`${f.label}=${value(p[f.key])} ${f.unit}`).join('；');
  const metrics=readouts(context.kind),metricKeys=new Set(metrics.map(m=>m[1]));
  const extraLabels={workTime:'工作用时 s',returnTime:'空回用时 s',stroke:'总行程 mm',outputAngle:'输出角度 °',couplerAngle:'末端姿态 °',slotTravel:'槽内位移 mm'};
  const r=context.result;
  const resultText=r?[...metrics.map(([label,key,unit])=>`${label}=${value(r[key]??null)} ${unit}`),...Object.entries(extraLabels).filter(([key])=>!metricKeys.has(key)&&key in r).map(([key,label])=>`${label}=${value(r[key])}`)].join('；'):'当前输入无效，计算暂停；不可把上一有效模型的结果当作当前输入的结果。';
  return[
    `本次独立实验：${d.title}（${context.kind}）。请按本实验解释，不套用 GL16 减速器。以下是提问时的页面快照：`,
    parameters(context.parameters),!context.valid?'画面保留上一有效模型：'+parameters(context.modelParameters):'',
    `${inputLabel(context.kind)}=${value(context.input)}${inputUnit(context.kind)}；${context.phase}`,resultText,
    `选中零件：${context.selectedPart.name||'未选择'}。${context.selectedPart.description} ${context.selectedPart.spec}`,
    `装配状态：${context.view.amount>0?'自由展开 '+Math.round(context.view.amount*100)+'%':assemblySteps[context.kind][context.view.step].title}；${context.view.playing?'演示中':'已暂停'}。${context.kind==='scissor-jack'?(context.view.direction===1?'上升方向。':'下降方向。'):''}`,
    `关系：${d.formula}。1× 为工况的 20% 慢放，当前 ${context.view.speed}×；读数按工况计算。`,d.note+' 请解释数据，不要声称已操作页面或完成制造校核。',
  ].filter(Boolean).join('\n');
}
// Existing deployed endpoint accepts bounded textual per-turn snapshots.
// Older experiments retain their exact payload builder and protocol.
export function createExperimentChatPayload(turns,capabilities){
  if(!turns.some(t=>t.experimentContext))return createCatalogChatPayload(turns,capabilities);
  const kinds=new Set(turns.filter(t=>t.experimentContext).map(t=>t.experimentContext.kind));
  if(kinds.size!==1||turns.some(t=>(t.role==='user'&&!t.experimentContext)||t.catalogContext||t.viceContext||t.timingContext||t.beltContext||t.idlerContext||t.spurContext||t.frictionContext||t.bicycleContext||t.turbineContext))throw new Error('机构已切换，请开始新对话。');
  const messages=turns.map(({role,content,experimentContext})=>({role,content:role==='user'&&experimentContext?formatExperimentContext(experimentContext)+'\n问题：'+content:content}));
  if(messages.some(m=>m.role==='user'&&m.content.length>2000))throw Error('问题加上当前机构数据后超过长度限制，请缩短问题后重试。');
  while(messages.length>1&&messages.reduce((sum,m)=>sum+m.content.length,0)>32000)messages.splice(0,2);
  return{messages};
}
