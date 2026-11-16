import { createSpurChatPayload } from '../spur/chat-context.mjs';

const parameterLabels = {
  driverTeeth:'主动轮齿数 z1', idlerTeeth:'惰轮齿数 z2', drivenTeeth:'从动轮齿数 z3', module:'模数 mm',
  faceWidth:'齿宽 mm', inputRPM:'输入转速 r/min', inputTorque:'输入转矩 N·m', meshEfficiency:'每次啮合指定效率',
};
const resultLabels = {
  ratio:'总传动比 z3/z1', speedRatio:'转速比 |n3|/n1', driverRPM:'主动轮转速 r/min',
  idlerRPM:'惰轮转速 r/min', drivenRPM:'从动轮转速 r/min', meshCount:'啮合次数',
  meshEfficiency:'每次啮合效率', totalEfficiency:'总效率', inputTorque:'输入转矩 N·m',
  outputTorque:'运转输出转矩 N·m', inputPower:'输入功率 W', outputPower:'输出功率 W', minimumContactRatio:'最小端面重合度',
};
const geometryLabels = {centerDistance:'首尾轴距 mm',centerDistance12:'主动轮至惰轮轴距 mm',
  centerDistance23:'惰轮至从动轮轴距 mm',centerDistance13:'直接啮合中心距 mm',
  driverRadius:'主动轮节圆半径 mm',idlerRadius:'惰轮节圆半径 mm',drivenRadius:'从动轮节圆半径 mm',faceWidth:'齿宽 mm'};
const cleanText = (value,max) => typeof value==='string' ? value.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max) : '';
const finite = value => typeof value==='number' && Number.isFinite(value) && Math.abs(value)<1e8 ? value : null;
const copyNumbers = (source,labels) => Object.fromEntries(Object.keys(labels).map(key=>[key,finite(source?.[key])]));
const parameters = source => ({...copyNumbers(source,parameterLabels),useIdler:typeof source?.useIdler==='boolean'?source.useIdler:null});
const formatNumbers = (source,labels) => Object.entries(labels).map(([key,label])=>
  `${label}=${source[key]===null?'无效/未提供/不参与':Number(source[key].toPrecision(7))}`).join('；');
const mode = value => value===true?'有惰轮：三齿轮、两次外啮合':value===false?'无惰轮：两齿轮直接外啮合':'惰轮开关无效/未提供';
const formatParameters = source => mode(source.useIdler)+'；'+formatNumbers(source,parameterLabels);

export function captureIdlerContext(state) {
  if(!state || typeof state!=='object' || Array.isArray(state))return null;
  const part=state.selectedPart || {}, result=state.result, geometry=state.geometry || result?.geometry;
  return {
    parameters:parameters(state.params || state.parameters),
    modelParameters:state.modelParameters ? parameters(state.modelParameters) : null,
    selectedPart:{id:cleanText(part.id || state.selected || state.view?.selected,80),name:cleanText(part.name,80),
      description:cleanText(part.description,180),spec:cleanText(part.spec,120)},
    result:result && typeof result==='object' && !Array.isArray(result) ? {
      ...copyNumbers(result,resultLabels),direction:['same','opposite'].includes(result.direction)?result.direction:null,
      contactRatios:Array.isArray(result.contactRatios)?result.contactRatios.slice(0,2).map(finite):[],
    } : null,
    geometry:geometry && typeof geometry==='object' && !Array.isArray(geometry) ? copyNumbers(geometry,geometryLabels) : null,
    geometryValid:state.geometryValid!==false,
  };
}

export function sanitizeIdlerContext(context) {
  if(!context || typeof context!=='object' || Array.isArray(context))return null;
  return captureIdlerContext({parameters:context.parameters,modelParameters:context.modelParameters,
    selectedPart:context.selectedPart,result:context.result,geometry:context.geometry,geometryValid:context.geometryValid});
}

export function formatIdlerContext(raw,{legacy=false}={}) {
  const context=sanitizeIdlerContext(raw);
  if(!context)return '';
  const {parameters:p,modelParameters,selectedPart:part,result,geometry,geometryValid}=context;
  const differs=modelParameters && JSON.stringify(p)!==JSON.stringify(modelParameters);
  return [
    legacy?'本次提问的独立模型是带惰轮齿轮列，可切换直接啮合。请以本次快照回答，不套用 GL16 两级斜齿减速器或其他设备的数据。':'【本次提问时的带惰轮齿轮列页面快照；数值为用户输入】',
    formatParameters(p),
    p.useIdler===false?'当前直接啮合：惰轮齿数只是保留的设置，不参与当前几何、速比或效率计算；该闲置值无效也不使直接啮合模型失效。':'',
    part.id || part.name ? `选中零件：${part.name || part.id}；${part.description}${part.spec?'；'+part.spec:''}` : '尚未选择零件。',
    differs?'输入与当前显示模型不同，模型保留上一有效结构：'+formatParameters(modelParameters):'',
    geometryValid?'':'当前几何输入无效，模型保留上一有效结构。',
    result?'页面计算：'+formatNumbers(result,resultLabels):'当前输入没有有效计算结果。',
    result?`输出相对输入转向：${result.direction==='same'?'同向':result.direction==='opposite'?'反向':'未提供'}；各次端面重合度=${result.contactRatios.map(v=>v===null?'未知':Number(v.toPrecision(6))).join('、') || '未提供'}。`:'',
    geometry?'几何尺寸：'+formatNumbers(geometry,geometryLabels):'',
    '有惰轮时 n2=-n1×z1/z2，n3=+n1×z1/z3；直接啮合 n3=-n1×z1/z3。总速比的大小只由首尾齿数决定，惰轮齿数改变自身转速和布置。总效率=每次啮合效率^(2或1)，运转时 P2=η总×T1×n1×π/30（W）、T输出=T1×(z3/z1)×η总（N·m）。零速功率为0，不求运行输出转矩，也不把运行效率用于静态力矩。',
    '20°无变位渐开线工作齿面，齿根过渡为教学近似；节圆相切，实际齿面滚动与滑动并存，仅节点纯滚动。齿顶圆相交不代表实体轮齿穿模。1×动画为工况20%慢放；未求强度、寿命或实测效率。请解释参数和操作，不声称已操作或验收模型。',
  ].filter(Boolean).join('\n');
}

export function createIdlerChatPayload(turns,{supportsIdler=false,...capabilities}={}) {
  if(!turns.some(turn=>turn.idlerContext))return createSpurChatPayload(turns,capabilities);
  if(turns.some(turn=>turn.turbineContext || turn.bicycleContext || turn.frictionContext || turn.spurContext))throw new Error('模型已切换，请开始新对话后重试。');
  const messages=turns.map(({role,content,idlerContext})=>{
    const snapshot=role==='user'?sanitizeIdlerContext(idlerContext):null;
    return {role,content:snapshot && !supportsIdler?formatIdlerContext(snapshot,{legacy:true})+'\n问题：'+content:content,
      ...(snapshot && supportsIdler?{idlerContext:snapshot}:{})};
  });
  if(messages.some(message=>message.role==='user' && message.content.length>2000))
    throw new Error('问题加上模型参数后超过长度限制，请缩短问题后重试。');
  while(messages.length>1 && messages.reduce((sum,message)=>sum+message.content.length,0)>32000)messages.splice(0,2);
  return {messages,...(supportsIdler?{modelContext:'idler'}:{})};
}
