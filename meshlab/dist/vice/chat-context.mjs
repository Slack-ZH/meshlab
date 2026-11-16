import {createTimingChatPayload} from '../timing/chat-context.mjs';

const parameterLabels={lead:'导程 mm/转',screwDiameter:'丝杠外径 mm',jawWidth:'钳口宽 mm',maxOpening:'最大开口 mm',
  inputRPM:'设定转速 r/min',inputTorque:'设定转矩 N·m',efficiency:'给定运行效率'};
const resultLabels={lead:'导程 mm/转',pitch:'螺距 mm',starts:'线数',inputRPM:'设定转速 r/min',inputTorque:'设定转矩 N·m',
  advancePerTurn:'每转理论位移 mm',linearSpeed:'工况理论速度 mm/s',thrust:'运转理论推力幅值 N',inputPower:'工况输入功率 W',
  outputPower:'工况输出功率 W',efficiency:'给定运行效率'};
const geometryLabels={screwRadius:'丝杠半径 mm',rootRadius:'牙底半径 mm',threadedLength:'螺纹段长 mm',nutLength:'螺母长 mm',jawWidth:'钳口宽 mm',maxOpening:'最大开口 mm'};
const runtimeLabels={jawOpening:'当前实际开口 mm',displacement:'相对中位位移 mm',screwTurns:'相对中位丝杠转数'};
const cleanText=(value,max)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max):'';
const finite=value=>typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<1e8?value:null;
const direction=value=>value===1||value===-1?value:null;
const boolean=value=>typeof value==='boolean'?value:null;
const copyNumbers=(source,labels)=>Object.fromEntries(Object.keys(labels).map(key=>[key,finite(source?.[key])]));
const parameters=source=>({...copyNumbers(source,parameterLabels),direction:direction(source?.direction)});
const directionText=value=>value===1?'张开(+1)':value===-1?'闭合(-1)':'无效/未提供';
const formatNumbers=(source,labels)=>Object.entries(labels).map(([key,label])=>`${label}=${source[key]===null?'无效/未提供':Number(source[key].toPrecision(7))}`).join('；');
const formatParameters=source=>formatNumbers(source,parameterLabels)+'；指令方向='+directionText(source.direction);

export function captureViceContext(state){
  if(!state||typeof state!=='object'||Array.isArray(state))return null;
  const part=state.selectedPart||{},result=state.result,geometry=state.geometry||result?.geometry;
  const runtime=state.runtime||state.view||(Object.hasOwn(state,'jawOpening')?state:null);
  return {
    parameters:parameters(state.params||state.parameters),modelParameters:state.modelParameters?parameters(state.modelParameters):null,
    selectedPart:{id:cleanText(part.id||state.selected||state.view?.selected,80),name:cleanText(part.name,80),
      description:cleanText(part.description,160),spec:cleanText(part.spec,100)},
    result:result&&typeof result==='object'&&!Array.isArray(result)?{...copyNumbers(result,resultLabels),direction:direction(result.direction)}:null,
    geometry:geometry&&typeof geometry==='object'&&!Array.isArray(geometry)?copyNumbers(geometry,geometryLabels):null,
    runtime:runtime&&typeof runtime==='object'&&!Array.isArray(runtime)?{...copyNumbers(runtime,runtimeLabels),
      direction:direction(runtime.direction),atLimit:boolean(runtime.atLimit),playing:boolean(runtime.playing),
      limit:['closed','open'].includes(runtime.limit)?runtime.limit:null}:null,
    geometryValid:state.geometryValid!==false,
  };
}

export function sanitizeViceContext(context){
  if(!context||typeof context!=='object'||Array.isArray(context))return null;
  return captureViceContext({parameters:context.parameters,modelParameters:context.modelParameters,selectedPart:context.selectedPart,
    result:context.result,geometry:context.geometry,runtime:context.runtime,geometryValid:context.geometryValid});
}

export function formatViceContext(raw,{legacy=false}={}){
  const c=sanitizeViceContext(raw);if(!c)return '';
  const {parameters:p,modelParameters,selectedPart:part,result,geometry,runtime,geometryValid}=c;
  const differs=modelParameters&&JSON.stringify(p)!==JSON.stringify(modelParameters);
  return [
    legacy?'本次独立模型是台虎钳丝杠螺母传动，请用本次快照，不套用 GL16 减速器或带传动数据。':'【本次提问时的台虎钳快照；客户端数据】',
    formatParameters(p),
    part.id||part.name?`选中：${part.name||part.id}；${part.description}${part.spec?'；'+part.spec:''}`:'尚未选择零件。',
    differs?'输入与显示模型不同，保留上一有效结构：'+formatParameters(modelParameters):'',
    geometryValid?'':'当前几何输入无效，保留上一有效模型。',
    result?'给定工况理论计算：'+formatNumbers(result,resultLabels)+'；方向='+directionText(result.direction):'当前输入没有有效计算结果。',
    geometry?'几何：'+formatNumbers(geometry,geometryLabels):'',
    runtime?'提问时实际状态：'+formatNumbers(runtime,runtimeLabels)+`；方向=${directionText(runtime.direction)}；播放=${runtime.playing===null?'未知':runtime.playing?'是':'否'}；到达端点=${runtime.atLimit===null?'未知':runtime.atLimit?'是':'否'}；端点=${runtime.limit==='closed'?'闭合':runtime.limit==='open'?'最大开口':'无/未知'}`:'未提供实际运动状态。',
    '固定螺母，丝杠旋转并轴向移动，活动钳口跟随丝杠。单线右旋30°梯形教学牙，导程=螺距。初始开口为最大开口的一半；位移和转数从中位计。到0或最大开口即停止，不跳回；换方向保留位置，几何变化重建中位。',
    'v=方向×导程×n/60（mm/s），每转位移=方向×导程。仅n>0时F=2πηT/(导程/1000)（N）是运转理论轴向推力；零转速功率0且推力不求。1×动画为工况20%慢放；暂停/端停的实际速度为0，即使工况计算仍有非零值，也不代表实际载荷。未求自锁、静态夹紧力、额定承载、强度或寿命；端点停止不代表夹紧了工件。只解释操作，不声称已操作或验收。',
  ].filter(Boolean).join('\n');
}

export function createViceChatPayload(turns,{supportsVice=false,...capabilities}={}){
  if(!turns.some(turn=>turn.viceContext))return createTimingChatPayload(turns,capabilities);
  if(turns.some(turn=>turn.turbineContext||turn.bicycleContext||turn.frictionContext||turn.spurContext||turn.idlerContext||turn.beltContext||turn.timingContext))throw new Error('模型已切换，请开始新对话后重试。');
  const messages=turns.map(({role,content,viceContext})=>{
    const snapshot=role==='user'?sanitizeViceContext(viceContext):null;
    return {role,content:snapshot&&!supportsVice?formatViceContext(snapshot,{legacy:true})+'\n问题：'+content:content,
      ...(snapshot&&supportsVice?{viceContext:snapshot}:{})};
  });
  if(messages.some(message=>message.role==='user'&&message.content.length>2000))throw new Error('问题加上模型参数后超过长度限制，请缩短问题后重试。');
  while(messages.length>1&&messages.reduce((sum,message)=>sum+message.content.length,0)>32000)messages.splice(0,2);
  return {messages,...(supportsVice?{modelContext:'vice'}:{})};
}
