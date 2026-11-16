import { createFrictionChatPayload } from '../friction/chat-context.mjs';

const parameterLabels = {
  driverTeeth:'主动轮齿数', drivenTeeth:'从动轮齿数', module:'模数 mm', faceWidth:'齿宽 mm',
  inputRPM:'输入转速 r/min', inputTorque:'输入转矩 N·m', efficiency:'指定传动效率',
};
const resultLabels = {
  ratio:'传动比 z2/z1', speedRatio:'转速比 |n2|/n1', driverRPM:'主动轮转速 r/min', drivenRPM:'从动轮转速 r/min',
  inputTorque:'输入转矩 N·m', outputTorque:'运转输出转矩 N·m', staticTorqueRatio:'理想静态转矩比',
  efficiency:'指定传动效率', inputPower:'输入功率 W', outputPower:'输出功率 W',
  contactRatio:'端面重合度', pressureAngle:'压力角 °',
};
const geometryLabels = {centerDistance:'中心距 mm',driverRadius:'主动轮节圆半径 mm',drivenRadius:'从动轮节圆半径 mm',faceWidth:'齿宽 mm'};
const cleanText = (value,max) => typeof value==='string' ? value.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max) : '';
const finite = value => typeof value==='number' && Number.isFinite(value) && Math.abs(value)<1e8 ? value : null;
const copyNumbers = (source,labels) => Object.fromEntries(Object.keys(labels).map(key=>[key,finite(source?.[key])]));
const formatNumbers = (source,labels) => Object.entries(labels).map(([key,label])=>
  `${label}=${source[key]===null?'无效/未提供':Number(source[key].toPrecision(7))}`).join('；');

export function captureSpurContext(state) {
  if(!state || typeof state!=='object' || Array.isArray(state))return null;
  const part=state.selectedPart || {}, result=state.result;
  const geometry=state.geometry || result?.geometry;
  return {
    parameters:copyNumbers(state.params || state.parameters,parameterLabels),
    modelParameters:state.modelParameters ? copyNumbers(state.modelParameters,parameterLabels) : null,
    selectedPart:{id:cleanText(part.id || state.selected || state.view?.selected,80),name:cleanText(part.name,80),
      description:cleanText(part.description,180),spec:cleanText(part.spec,120)},
    result:result && typeof result==='object' && !Array.isArray(result) ? copyNumbers(result,resultLabels) : null,
    geometry:geometry && typeof geometry==='object' && !Array.isArray(geometry) ? copyNumbers(geometry,geometryLabels) : null,
    geometryValid:state.geometryValid!==false,
  };
}

export function sanitizeSpurContext(context) {
  if(!context || typeof context!=='object' || Array.isArray(context))return null;
  return captureSpurContext({parameters:context.parameters,modelParameters:context.modelParameters,
    selectedPart:context.selectedPart,result:context.result,geometry:context.geometry,geometryValid:context.geometryValid});
}

export function formatSpurContext(raw,{legacy=false}={}) {
  const context=sanitizeSpurContext(raw);
  if(!context)return '';
  const {parameters,modelParameters,selectedPart:part,result,geometry,geometryValid}=context;
  const differs=modelParameters && JSON.stringify(parameters)!==JSON.stringify(modelParameters);
  return [
    legacy?'本次提问的独立模型是单级直齿圆柱齿轮。请以本次快照回答，不套用 GL16 两级斜齿减速器或其他设备的参数与零件。':'【本次提问时的单级直齿齿轮页面快照；数值为用户输入】',
    formatNumbers(parameters,parameterLabels),
    part.id || part.name ? `选中零件：${part.name || part.id}；${part.description}${part.spec?'；'+part.spec:''}` : '尚未选择零件。',
    differs?'输入与当前显示模型不同，模型保留上一有效结构：'+formatNumbers(modelParameters,parameterLabels):'',
    geometryValid?'':'当前几何输入无效，模型保留上一有效结构。',
    result?'页面计算：'+formatNumbers(result,resultLabels):'当前输入没有有效计算结果。',
    geometry?'几何尺寸：'+formatNumbers(geometry,geometryLabels):'',
    '两轮外啮合、反向：n2=-n1×z1/z2；d=mz、a=m(z1+z2)/2（mm）。输入功率=T1×n1×π/30（W），运转时 P2=ηP1、T2=T1×(z2/z1)×η（N·m）。零转速时功率为0，运转输出转矩不求解；理想静态转矩比=z2/z1，不能把运行效率直接用于静态力矩。',
    '节圆相切且节圆线速度相等；实际齿面接触通常滚动与滑动并存，只有节点处纯滚动。齿顶圆相交是正常啮合范围，判断穿模应检查实体轮齿交集。',
    '20°标准无变位渐开线工作齿面，齿数从18起；齿根过渡为教学近似，不能称为完整制造齿形。模数和齿宽改变几何，不改变给定齿数的速比；效率是用户给定值，未求强度、寿命、热损失或实际效率。动画1×为工况转速的20%慢放，演示倍速不改变计算。请解释参数与操作，不声称已操作或验收模型。',
  ].filter(Boolean).join('\n');
}

// Preserve every existing model payload and support the currently deployed legacy API.
export function createSpurChatPayload(turns,{supportsSpur=false,...capabilities}={}) {
  if(!turns.some(turn=>turn.spurContext))return createFrictionChatPayload(turns,capabilities);
  if(turns.some(turn=>turn.turbineContext || turn.bicycleContext || turn.frictionContext))throw new Error('模型已切换，请开始新对话后重试。');
  const messages=turns.map(({role,content,spurContext})=>{
    const snapshot=role==='user'?sanitizeSpurContext(spurContext):null;
    return {role,content:snapshot && !supportsSpur?formatSpurContext(snapshot,{legacy:true})+'\n问题：'+content:content,
      ...(snapshot && supportsSpur?{spurContext:snapshot}:{})};
  });
  if(messages.some(message=>message.role==='user' && message.content.length>2000))
    throw new Error('问题加上模型参数后超过长度限制，请缩短问题后重试。');
  while(messages.length>1 && messages.reduce((sum,message)=>sum+message.content.length,0)>32000)messages.splice(0,2);
  return {messages,...(supportsSpur?{modelContext:'spur'}:{})};
}
