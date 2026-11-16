import { createBeltChatPayload } from '../belt/chat-context.mjs';

const parameterLabels = {
  driverTeeth:'主动带轮齿数',drivenTeeth:'从动带轮齿数',centerDistance:'目标中心距 mm',
  beltWidth:'带宽 mm',inputRPM:'输入转速 r/min',inputTorque:'输入转矩 N·m',efficiency:'指定总效率',
};
const resultLabels = {
  ratio:'传动比 z2/z1',speedRatio:'转速比 n2/n1',driverRPM:'主动轮转速 r/min',drivenRPM:'从动轮转速 r/min',
  beltSpeed:'理想带速 m/s',driverWrapDeg:'主动轮包角 °',drivenWrapDeg:'从动轮包角 °',
  driverEngagedTeeth:'主动轮理论包络齿数',drivenEngagedTeeth:'从动轮理论包络齿数',
  beltTeeth:'整条带的整数齿数',pitchLength:'闭合节线长度 mm',requestedCenterDistance:'目标中心距 mm',
  effectiveCenterDistance:'匹配闭合后的实际中心距 mm',centerDistanceError:'实际减目标中心距 mm',
  inputTorque:'输入转矩 N·m',outputTorque:'运转输出转矩 N·m',inputPower:'输入功率 W',outputPower:'输出功率 W',efficiency:'指定总效率',
};
const geometryLabels = {pitch:'固定节距 mm',driverRadius:'主动带轮节半径 mm',drivenRadius:'从动带轮节半径 mm',
  centerDistance:'实际中心距 mm',beltWidth:'带宽 mm'};
const cleanText = (value,max) => typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max):'';
const finite = value => typeof value==='number' && Number.isFinite(value) && Math.abs(value)<1e8?value:null;
const copyNumbers = (source,labels) => Object.fromEntries(Object.keys(labels).map(key=>[key,finite(source?.[key])]));
const formatNumbers = (source,labels) => Object.entries(labels).map(([key,label])=>
  `${label}=${source[key]===null?'无效/未提供':Number(source[key].toPrecision(7))}`).join('；');

export function captureTimingContext(state) {
  if(!state || typeof state!=='object' || Array.isArray(state))return null;
  const part=state.selectedPart || {},result=state.result,geometry=state.geometry || result?.geometry;
  return {
    parameters:copyNumbers(state.params || state.parameters,parameterLabels),
    modelParameters:state.modelParameters?copyNumbers(state.modelParameters,parameterLabels):null,
    selectedPart:{id:cleanText(part.id || state.selected || state.view?.selected,80),name:cleanText(part.name,80),
      description:cleanText(part.description,180),spec:cleanText(part.spec,120)},
    result:result && typeof result==='object' && !Array.isArray(result)?copyNumbers(result,resultLabels):null,
    geometry:geometry && typeof geometry==='object' && !Array.isArray(geometry)?copyNumbers(geometry,geometryLabels):null,
    geometryValid:state.geometryValid!==false,
  };
}

export function sanitizeTimingContext(context) {
  if(!context || typeof context!=='object' || Array.isArray(context))return null;
  return captureTimingContext({parameters:context.parameters,modelParameters:context.modelParameters,
    selectedPart:context.selectedPart,result:context.result,geometry:context.geometry,geometryValid:context.geometryValid});
}

export function formatTimingContext(raw,{legacy=false}={}) {
  const context=sanitizeTimingContext(raw);
  if(!context)return '';
  const {parameters:p,modelParameters,selectedPart:part,result,geometry,geometryValid}=context;
  const differs=modelParameters && JSON.stringify(p)!==JSON.stringify(modelParameters);
  return [
    legacy?'本次提问的独立模型是同步带传动。请以本次快照回答，不套用 GL16 减速器、摩擦平带或其他设备的数据。':'【本次提问时的同步带页面快照；数值为用户输入】',
    formatNumbers(p,parameterLabels),
    part.id || part.name?`选中零件：${part.name || part.id}；${part.description}${part.spec?'；'+part.spec:''}`:'尚未选择零件。',
    differs?'输入与当前显示模型不同，模型保留上一有效结构：'+formatNumbers(modelParameters,parameterLabels):'',
    geometryValid?'':'当前几何输入无效，模型保留上一有效结构。',
    result?'页面计算：'+formatNumbers(result,resultLabels):'当前输入没有有效计算结果。',
    geometry?'几何尺寸：'+formatNumbers(geometry,geometryLabels):'',
    '开口同步带靠带齿与轮槽啮合，理想同步时两轮同向，n2=n1×z1/z2。固定节距p=5 mm，节半径=pz/(2π)。整条带取整数齿数N，闭合节线长L=N×5 mm，再反解实际中心距；目标中心距与实际中心距可能不同。包络齿数=z×包角/(2π)，可小数，并非实测同时承载的整数齿数。',
    '运转时P输入=T输入×n1×π/30（W），P输出=ηP输入，T输出=ηT输入×z2/z1（N·m）；η为给定总效率。零速功率为0，运行输出转矩不求解。T5启发梯形教学齿含带齿与轮槽，未按制造标准认证齿根、配合或公差。未求张紧、弹性、跳齿、强度、寿命或负载上限，不能按摩擦平带的滑移模型解释。1×动画为工况20%慢放；请解释操作，不声称已操作或验收模型。',
  ].filter(Boolean).join('\n');
}

export function createTimingChatPayload(turns,{supportsTiming=false,...capabilities}={}) {
  if(!turns.some(turn=>turn.timingContext))return createBeltChatPayload(turns,capabilities);
  if(turns.some(turn=>turn.turbineContext || turn.bicycleContext || turn.frictionContext || turn.spurContext || turn.idlerContext || turn.beltContext))throw new Error('模型已切换，请开始新对话后重试。');
  const messages=turns.map(({role,content,timingContext})=>{
    const snapshot=role==='user'?sanitizeTimingContext(timingContext):null;
    return {role,content:snapshot && !supportsTiming?formatTimingContext(snapshot,{legacy:true})+'\n问题：'+content:content,
      ...(snapshot && supportsTiming?{timingContext:snapshot}:{})};
  });
  if(messages.some(message=>message.role==='user' && message.content.length>2000))
    throw new Error('问题加上模型参数后超过长度限制，请缩短问题后重试。');
  while(messages.length>1 && messages.reduce((sum,message)=>sum+message.content.length,0)>32000)messages.splice(0,2);
  return {messages,...(supportsTiming?{modelContext:'timing'}:{})};
}
