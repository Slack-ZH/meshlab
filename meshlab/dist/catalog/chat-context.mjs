import {createViceChatPayload} from '../vice/chat-context.mjs';
const clean=(v,n)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,n):'';
const finite=v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<1e12?Number(v.toPrecision(7)):null;
const scalar=v=>v==null?null:typeof v==='boolean'?v:typeof v==='number'?finite(v):clean(v,60);
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const parameters=v=>Object.fromEntries(Object.entries(object(v)).slice(0,24).map(([k,v])=>[clean(k,40),scalar(v)]));
export function captureCatalogContext(state){
 if(!state||Array.isArray(state)||typeof state.model?.id!=='string'||! /^[a-z0-9][a-z0-9-]{0,59}$/.test(state.model.id))return null;
 return {id:clean(state.model.id,60),title:clean(state.model.title,80),description:clean(state.description,120),
 parameters:parameters(state.parameters),
 modelParameters:state.modelParameters?parameters(state.modelParameters):null,
 selectedPart:{id:clean(state.selectedPart?.id,60),name:clean(state.selectedPart?.name,60),description:clean(state.selectedPart?.description,150)},
 metrics:(Array.isArray(state.result?.metrics)?state.result.metrics:[]).slice(0,8).map(m=>({label:clean(m?.label,40),value:scalar(m?.value),unit:clean(m?.unit,20)})),
 status:clean(state.result?.status,180),phase:finite(state.phase),playing:state.playing===true,geometryValid:state.geometryValid!==false,
 limits:clean(state.limits,260),formulas:(Array.isArray(state.principle)?state.principle:[]).map(p=>clean(p?.formula,100)).filter(Boolean).slice(0,3)};
}
export function sanitizeCatalogContext(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 return captureCatalogContext({model:{id:raw.id,title:raw.title},description:raw.description,parameters:raw.parameters,modelParameters:raw.modelParameters,
  selectedPart:raw.selectedPart,result:{metrics:raw.metrics,status:raw.status},phase:raw.phase,playing:raw.playing,geometryValid:raw.geometryValid,
  limits:raw.limits,principle:(Array.isArray(raw.formulas)?raw.formulas:[]).map(formula=>({formula}))});
}
export function formatCatalogContext(raw,{legacy=false}={}){
 const c=sanitizeCatalogContext(raw);if(!c)return '';
 const lines=[`当前独立机构：${c.title}（${c.id}）${legacy?'；按此快照解释，不沿用GL16减速器参数。':'；本次提问时的客户端快照。'}`,
 '模型范围：'+c.limits,
 `提问时${c.playing?'播放':'暂停'}，输入相位=${c.phase} rad。1×演示为设定转速20%慢放；暂停时实际不转。`,
 !c.geometryValid?'输入无效，屏幕及以下计算保留上次有效工况：'+JSON.stringify(c.modelParameters).slice(0,350):'',c.description,
 '设定参数：'+JSON.stringify(c.parameters),
 '选中零件：'+c.selectedPart.name+'；'+c.selectedPart.description,
 '计算：'+c.metrics.map(m=>m.label+'='+m.value+(m.unit||'')).join('；'),
 c.status,'关系：'+c.formulas.join('；')];
 return lines.filter(Boolean).join('\n').slice(0,1450);
}
export function createCatalogChatPayload(turns,{supportsCatalog=false,...capabilities}={}){
 if(!turns.some(t=>t.catalogContext))return createViceChatPayload(turns,capabilities);
 const ids=new Set(turns.filter(t=>t.catalogContext).map(t=>t.catalogContext.id));if(ids.size>1||turns.some(t=>(t.role==='user'&&!t.catalogContext)||t.viceContext||t.timingContext||t.beltContext||t.idlerContext||t.spurContext||t.frictionContext||t.bicycleContext||t.turbineContext))throw new Error('机构已切换，请开始新对话。');
 const messages=turns.map(t=>{const c=t.role==='user'?sanitizeCatalogContext(t.catalogContext):null;if(t.role==='user'&&!c)throw new Error('机构快照无效，请刷新页面。');return {role:t.role,content:c&&!supportsCatalog?formatCatalogContext(c,{legacy:true})+'\n问题：'+t.content:t.content,...(c&&supportsCatalog?{catalogContext:c}:{})};});
 if(messages.some(m=>m.role==='user'&&m.content.length>2000))throw new Error('问题与模型快照合计过长，请缩短问题后重试。');
 const payload={messages,...(supportsCatalog?{modelContext:'catalog'}:{})};
 while(messages.length>1&&(messages.length>21||messages.reduce((n,m)=>n+m.content.length+(m.catalogContext?formatCatalogContext(m.catalogContext).length:0),0)>32000||new TextEncoder().encode(JSON.stringify(payload)).length>120000))messages.splice(0,2);
 return payload;
}
