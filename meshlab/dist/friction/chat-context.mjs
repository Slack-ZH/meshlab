import { createBicycleChatPayload } from '../bicycle/chat-context.mjs';

// Copy only the bounded values shown when the question is submitted.
const parameterLabels = {
  driverDiameter:'主动轮直径 mm', drivenDiameter:'从动轮直径 mm', wheelWidth:'轮宽 mm',
  inputRPM:'主动轮转速 r/min', normalForce:'压紧力 N', frictionCoefficient:'指定摩擦系数', loadTorque:'负载转矩 N·m',
};
const resultLabels = {
  ratio:'理论传动比 n1/|n2|', speedRatio:'理论转速比 |n2|/n1', driverRPM:'主动轮转速 r/min',
  drivenRPM:'理论从动轮转速 r/min', surfaceSpeed:'接触圆周线速 m/s', normalForce:'压紧力 N',
  frictionLimit:'摩擦力上限 N', tractionDemand:'负载所需牵引力 N', torqueCapacity:'从动轮转矩容量 N·m',
  loadTorque:'负载转矩 N·m', utilization:'牵引利用率', theoreticalOutputPower:'理想转速下负载功率 W',
};
const contactStates = {stationary:'静止', rolling:'无滑动条件可满足', overload:'牵引超限，实际滑移与转速未求解'};
const cleanText = (value,max) => typeof value==='string' ? value.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max) : '';
const finite = value => typeof value==='number' && Number.isFinite(value) && Math.abs(value)<1e8 ? value : null;
const copyNumbers = (source,labels) => Object.fromEntries(Object.keys(labels).map(key=>[key,finite(source?.[key])]));
const formatNumbers = (source,labels) => Object.entries(labels).map(([key,label])=>
  `${label}=${source[key]===null?'无效/未提供':Number(source[key].toPrecision(7))}`).join('；');

export function captureFrictionContext(state) {
  if(!state || typeof state!=='object' || Array.isArray(state))return null;
  const part=state.selectedPart || {}, result=state.result;
  return {
    parameters:copyNumbers(state.params || state.parameters,parameterLabels),
    modelParameters:state.modelParameters ? copyNumbers(state.modelParameters,parameterLabels) : null,
    selectedPart:{id:cleanText(part.id || state.selected || state.view?.selected,80),name:cleanText(part.name,80),
      description:cleanText(part.description,180),spec:cleanText(part.spec,120)},
    result:result && typeof result==='object' && !Array.isArray(result) ? {
      ...copyNumbers(result,resultLabels),
      tractionFeasible:typeof result.tractionFeasible==='boolean' ? result.tractionFeasible : null,
      contactState:Object.hasOwn(contactStates,result.contactState) ? result.contactState : null,
    } : null,
    geometryValid:state.geometryValid!==false,
  };
}

export function sanitizeFrictionContext(context) {
  if(!context || typeof context!=='object' || Array.isArray(context))return null;
  return captureFrictionContext({parameters:context.parameters,modelParameters:context.modelParameters,
    selectedPart:context.selectedPart,result:context.result,geometryValid:context.geometryValid});
}

export function formatFrictionContext(raw,{legacy=false}={}) {
  const context=sanitizeFrictionContext(raw);
  if(!context)return '';
  const {parameters,modelParameters,selectedPart:part,result,geometryValid}=context;
  const differs=modelParameters && JSON.stringify(parameters)!==JSON.stringify(modelParameters);
  return [
    legacy?'本次提问的独立模型是摩擦轮传动。请以本次快照回答，不套用 GL16 减速器、汽轮机或自行车的参数与零件。':'【本次提问时的摩擦轮页面快照；数值为用户输入】',
    formatNumbers(parameters,parameterLabels),
    part.id || part.name ? `选中零件：${part.name || part.id}；${part.description}${part.spec?'；'+part.spec:''}` : '尚未选择零件。',
    differs?'输入与当前显示模型不同，模型保留上一有效结构：'+formatNumbers(modelParameters,parameterLabels):'',
    geometryValid?'':'当前几何输入无效，模型保留上一有效结构。',
    result?'页面计算：'+formatNumbers(result,resultLabels):'当前输入没有有效计算结果。',
    result?`牵引条件：${result.tractionFeasible===null?'未提供':result.tractionFeasible?'可满足':'超限'}；接触状态：${contactStates[result.contactState] || '未提供'}。`:'',
    '两轮外接、轴线平行，理想无滑动时 n2=-n1×D1/D2，负号表示反向；中心距=(D1+D2)/2。摩擦力上限=μN，负载牵引力=T负载/(D2/2000)，转矩容量=μN×D2/2000，直径输入为 mm。',
    '超限时实际滑移、转速和输出功率未求解，不能把理想转速下负载功率当成可实现功率；动画始终是无滑动基准。零转速时两轮静止、负载功率为0。轮宽用于几何展示，未进入接触应力计算。未模拟弹性、温升、磨损、轴承损失或强度，给定摩擦系数不是实测值。演示倍速不改变计算。请解释参数与操作，不声称已操作或验收模型。',
  ].filter(Boolean).join('\n');
}

// Keep the deployed legacy Worker usable; old model payloads pass through unchanged.
export function createFrictionChatPayload(turns,{supportsFriction=false,...capabilities}={}) {
  if(!turns.some(turn=>turn.frictionContext))return createBicycleChatPayload(turns,capabilities);
  if(turns.some(turn=>turn.turbineContext || turn.bicycleContext))throw new Error('模型已切换，请开始新对话后重试。');
  const messages=turns.map(({role,content,frictionContext})=>{
    const snapshot=role==='user'?sanitizeFrictionContext(frictionContext):null;
    return {role,content:snapshot && !supportsFriction?formatFrictionContext(snapshot,{legacy:true})+'\n问题：'+content:content,
      ...(snapshot && supportsFriction?{frictionContext:snapshot}:{})};
  });
  if(messages.some(message=>message.role==='user' && message.content.length>2000))
    throw new Error('问题加上模型参数后超过长度限制，请缩短问题后重试。');
  while(messages.length>1 && messages.reduce((sum,message)=>sum+message.content.length,0)>32000)messages.splice(0,2);
  return {messages,...(supportsFriction?{modelContext:'friction'}:{})};
}
