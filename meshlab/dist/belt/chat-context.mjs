import { createIdlerChatPayload } from '../idler/chat-context.mjs';

const parameterLabels = {
  driverDiameter:'主动轮有效直径 mm', drivenDiameter:'从动轮有效直径 mm', centerDistance:'中心距 mm',
  beltWidth:'带宽 mm', inputRPM:'输入转速 r/min', inputTorque:'输入转矩 N·m', efficiency:'指定总效率',
};
const resultLabels = {
  ratio:'传动比 D2/D1', speedRatio:'转速比 |n2|/n1', driverRPM:'主动轮转速 r/min', drivenRPM:'从动轮转速 r/min',
  beltSpeed:'理想带速 m/s', driverWrapDeg:'主动轮平面理论包角 °', drivenWrapDeg:'从动轮平面理论包角 °',
  projectedBeltLength:'平面理论带长 mm', spatialCenterlineLength:'显示路径中心线长 mm',
  inputTorque:'输入转矩 N·m', outputTorque:'运转输出转矩 N·m', inputPower:'输入功率 W', outputPower:'输出功率 W', efficiency:'指定总效率',
};
const geometryLabels = {driverRadius:'主动有效半径 mm',drivenRadius:'从动有效半径 mm',centerDistance:'中心距 mm',
  beltWidth:'带宽 mm',pulleyWidth:'带轮宽 mm',beltThickness:'示意带厚 mm',crossingLift:'交叉离面展示量 mm'};
const cleanText = (value,max) => typeof value==='string' ? value.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max) : '';
const finite = value => typeof value==='number' && Number.isFinite(value) && Math.abs(value)<1e8 ? value : null;
const copyNumbers = (source,labels) => Object.fromEntries(Object.keys(labels).map(key=>[key,finite(source?.[key])]));
const parameters = source => ({...copyNumbers(source,parameterLabels),crossed:typeof source?.crossed==='boolean'?source.crossed:null});
const formatNumbers = (source,labels) => Object.entries(labels).map(([key,label])=>
  `${label}=${source[key]===null?'无效/未提供':Number(source[key].toPrecision(7))}`).join('；');
const mode = value => value===true?'交叉平带：反向传动':value===false?'开口平带：同向传动':'带型开关无效/未提供';
const formatParameters = source => mode(source.crossed)+'；'+formatNumbers(source,parameterLabels);

export function captureBeltContext(state) {
  if(!state || typeof state!=='object' || Array.isArray(state))return null;
  const part=state.selectedPart || {}, result=state.result, geometry=state.geometry || result?.geometry;
  return {
    parameters:parameters(state.params || state.parameters),
    modelParameters:state.modelParameters ? parameters(state.modelParameters) : null,
    selectedPart:{id:cleanText(part.id || state.selected || state.view?.selected,80),name:cleanText(part.name,80),
      description:cleanText(part.description,180),spec:cleanText(part.spec,120)},
    result:result && typeof result==='object' && !Array.isArray(result) ? copyNumbers(result,resultLabels) : null,
    geometry:geometry && typeof geometry==='object' && !Array.isArray(geometry) ? copyNumbers(geometry,geometryLabels) : null,
    geometryValid:state.geometryValid!==false,
  };
}

export function sanitizeBeltContext(context) {
  if(!context || typeof context!=='object' || Array.isArray(context))return null;
  return captureBeltContext({parameters:context.parameters,modelParameters:context.modelParameters,
    selectedPart:context.selectedPart,result:context.result,geometry:context.geometry,geometryValid:context.geometryValid});
}

export function formatBeltContext(raw,{legacy=false}={}) {
  const context=sanitizeBeltContext(raw);
  if(!context)return '';
  const {parameters:p,modelParameters,selectedPart:part,result,geometry,geometryValid}=context;
  const differs=modelParameters && JSON.stringify(p)!==JSON.stringify(modelParameters);
  return [
    legacy?'本次提问的独立模型是平带传动，可切换交叉和开口。请以本次快照回答，不套用 GL16 减速器、齿轮列或其他设备的数据。':'【本次提问时的平带传动页面快照；数值为用户输入】',
    formatParameters(p),
    part.id || part.name ? `选中零件：${part.name || part.id}；${part.description}${part.spec?'；'+part.spec:''}` : '尚未选择零件。',
    differs?'输入与当前显示模型不同，模型保留上一有效结构：'+formatParameters(modelParameters):'',
    geometryValid?'':'当前几何输入无效，模型保留上一有效结构。',
    result?'页面计算：'+formatNumbers(result,resultLabels):'当前输入没有有效计算结果。',
    geometry?'几何尺寸：'+formatNumbers(geometry,geometryLabels):'',
    '理想无滑动：交叉带 n2=-n1×D1/D2，开口带 n2=+n1×D1/D2；D为带中性层的有效直径(mm)，带速=πD1n1/60000（m/s）。P输入=T输入×n1×π/30（W），P输出=ηP输入，运转T输出=ηT输入×D2/D1（N·m）；η为单个总效率，不平方。零速功率为0，不求运行输出转矩或用运行效率推静态力矩。',
    '包角和平面理论带长采用二维切线圆弧；交叉处有空间分离及扭转过渡，整条交叉带不是全部共面。显示路径中心线长和平面理论带长都不是制造带长。带宽改变显示几何，轴距还影响包角和长度；未求张力、打滑、强度、疲劳或功率上限，给定效率不是实测值。1×动画为工况20%慢放。请解释参数和操作，不声称已操作或验收模型。',
  ].filter(Boolean).join('\n');
}

export function createBeltChatPayload(turns,{supportsBelt=false,...capabilities}={}) {
  if(!turns.some(turn=>turn.beltContext))return createIdlerChatPayload(turns,capabilities);
  if(turns.some(turn=>turn.turbineContext || turn.bicycleContext || turn.frictionContext || turn.spurContext || turn.idlerContext))throw new Error('模型已切换，请开始新对话后重试。');
  const messages=turns.map(({role,content,beltContext})=>{
    const snapshot=role==='user'?sanitizeBeltContext(beltContext):null;
    return {role,content:snapshot && !supportsBelt?formatBeltContext(snapshot,{legacy:true})+'\n问题：'+content:content,
      ...(snapshot && supportsBelt?{beltContext:snapshot}:{})};
  });
  if(messages.some(message=>message.role==='user' && message.content.length>2000))
    throw new Error('问题加上模型参数后超过长度限制，请缩短问题后重试。');
  while(messages.length>1 && messages.reduce((sum,message)=>sum+message.content.length,0)>32000)messages.splice(0,2);
  return {messages,...(supportsBelt?{modelContext:'belt'}:{})};
}
