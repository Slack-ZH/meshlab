import { createChatPayload } from '../turbine/chat-context.mjs';

// A bounded copy of the values displayed at question time, never a live scene.
const parameterLabels = {
  frontTeeth:'前链轮齿数', rearTeeth:'后链轮齿数', cadence:'踏频 r/min',
  centerDistance:'请求中心距 mm', wheelDiameter:'车轮直径 mm', crankLength:'曲柄长度 mm',
  inputPower:'设定输入功率 W', efficiency:'指定传动效率',
};
const resultLabels = {
  ratio:'后轮/曲柄转速比', rearRPM:'后轮转速 r/min', speedKmh:'无滑移换算车速 km/h',
  inputPower:'设定输入功率 W', outputPower:'输出功率 W', inputTorque:'输入转矩 N·m',
  outputTorque:'后轴输出转矩 N·m', chainSpeed:'链速 m/s', chainLinks:'链条节数',
  effectiveCenterDistance:'闭合链条实际中心距 mm', chainPitch:'链条节距 mm',
};
const cleanText = (value, max) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0,max) : '';
const finite = value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value)<1e8 ? value : null;
const copyNumbers = (source, labels) => Object.fromEntries(Object.keys(labels).map(key=>[key,finite(source?.[key])]));
const formatNumbers = (source, labels) => Object.entries(labels).map(([key,label])=>
  `${label}=${source[key]===null?'无效/未提供':Number(source[key].toPrecision(7))}`).join('；');

export function captureBicycleContext(state) {
  if(!state || typeof state!=='object' || Array.isArray(state))return null;
  const part=state.selectedPart || {};
  const performance=state.result || state.performance;
  return {
    parameters:copyNumbers(state.params || state.parameters,parameterLabels),
    modelParameters:state.modelParameters ? copyNumbers(state.modelParameters,parameterLabels) : null,
    selectedPart:{id:cleanText(part.id || state.selected || state.view?.selected,80),
      name:cleanText(part.name,80),description:cleanText(part.description,180),spec:cleanText(part.spec,120)},
    result:performance && typeof performance==='object' ? copyNumbers(performance,resultLabels) : null,
    geometryValid:state.geometryValid!==false,
  };
}

export function sanitizeBicycleContext(context) {
  if(!context || typeof context!=='object' || Array.isArray(context))return null;
  return captureBicycleContext({parameters:context.parameters,modelParameters:context.modelParameters,
    selectedPart:context.selectedPart,result:context.result,geometryValid:context.geometryValid});
}

export function formatBicycleContext(raw,{legacy=false}={}) {
  const context=sanitizeBicycleContext(raw);
  if(!context)return '';
  const {parameters,modelParameters,selectedPart:part,result,geometryValid}=context;
  const differs=modelParameters && JSON.stringify(parameters)!==JSON.stringify(modelParameters);
  return [
    legacy?'本次提问的独立模型是自行车链条传动。请以本次快照回答，不套用 GL16 减速器或汽轮机的参数与零件。':'【本次提问时的自行车链传动页面快照；数值为用户输入】',
    formatNumbers(parameters,parameterLabels),
    part.id || part.name ? `选中零件：${part.name || part.id}；${part.description}${part.spec?'；'+part.spec:''}` : '尚未选择零件。',
    differs?'输入与当前显示模型不同，模型保留上一有效结构：'+formatNumbers(modelParameters,parameterLabels):'',
    geometryValid?'':'当前几何输入无效，模型保留上一有效结构。',
    result?'页面计算：'+formatNumbers(result,resultLabels):'当前输入没有有效计算结果。',
    '后轮与曲柄转速比=前齿数/后齿数；指定效率下输出功率=输入功率×效率，齿数不产生额外功率。零踏频不求稳态转矩。车速是无滑移换算值，不是道路预测。',
    '几何为单盘单后链轮教学模型：节距12.7 mm，采用连续节线、忽略多边形效应；链长取偶数节，实际中心距随闭合求解。演示速度仅控制慢放，不改变物理计算。未求解换挡、自由轮滑行、风阻滚阻、弹性、磨损和强度。请解释参数和操作步骤，不声称已经操作或验证模型。',
  ].filter(Boolean).join('\n');
}

// Capability negotiation keeps the deployed legacy API usable without a Worker deploy.
// Non-bicycle pages delegate to the existing implementation unchanged.
export function createBicycleChatPayload(turns,{supportsBicycle=false,supportsTurbine=false}={}) {
  if(!turns.some(turn=>turn.bicycleContext))return createChatPayload(turns,{supportsTurbine});
  if(turns.some(turn=>turn.turbineContext))throw new Error('模型已切换，请开始新对话后重试。');
  const messages=turns.map(({role,content,bicycleContext})=>{
    const snapshot=role==='user'?sanitizeBicycleContext(bicycleContext):null;
    return {role,content:snapshot && !supportsBicycle?formatBicycleContext(snapshot,{legacy:true})+'\n问题：'+content:content,
      ...(snapshot && supportsBicycle?{bicycleContext:snapshot}:{})};
  });
  if(messages.some(message=>message.role==='user' && message.content.length>2000))
    throw new Error('问题加上模型参数后超过长度限制，请缩短问题后重试。');
  while(messages.length>1 && messages.reduce((sum,message)=>sum+message.content.length,0)>32000)messages.splice(0,2);
  return {messages,...(supportsBicycle?{modelContext:'bicycle'}:{})};
}
