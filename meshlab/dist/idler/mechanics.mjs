import {gearDimensions,PRESSURE_ANGLE,ANIMATION_SCALE} from '../spur/mechanics.mjs';
export {gearDimensions,gearOutline,halfToothAngle,PRESSURE_ANGLE,ANIMATION_SCALE} from '../spur/mechanics.mjs';
export const fields={
  driverTeeth:['主动轮齿数','齿',18,60,1],idlerTeeth:['惰轮齿数','齿',18,60,1],drivenTeeth:['从动轮齿数','齿',18,80,1],
  module:['模数','mm',1,5,.5],faceWidth:['齿宽','mm',8,40,1],inputRPM:['主动轮转速','r/min',0,180,1],
  inputTorque:['输入转矩','N·m',0,20,.1],meshEfficiency:['每次啮合效率','—',.85,1,.01],
};
export const defaults=Object.freeze({driverTeeth:20,idlerTeeth:30,drivenTeeth:40,module:3,faceWidth:20,inputRPM:60,inputTorque:5,meshEfficiency:.98,useIdler:true});
export const assumptions='20°标准全齿高、零变位的平行轴外啮合直齿轮系。三轮两次啮合，惰轮改变转向与轴距而不改变首尾总速比。移除惰轮时改为两轮直接啮合，并重新匹配轴距。工作齿面沿用渐开线，齿根过渡为教学近似；未校核材料、强度、公差和寿命。节圆作理想纯滚动，真实渐开线齿面除节点外存在相对滑动。';
export function validate(p){
  if(typeof p.useIdler!=='boolean')throw new TypeError('惰轮模式必须为布尔值');
  for(const [key,[name,unit,min,max]] of Object.entries(fields)){
    if(key==='idlerTeeth'&&!p.useIdler)continue;
    if(!Number.isFinite(p[key])||p[key]<min||p[key]>max)throw new RangeError(`${name}须在 ${min}–${max} ${unit} 范围内`);
  }
  for(const key of ['driverTeeth','drivenTeeth',...(p.useIdler?['idlerTeeth']:[])])if(!Number.isInteger(p[key]))throw new RangeError('参与啮合的齿数必须为整数');
  return p;
}
function contactRatio(a,b,module){
  const length=Math.sqrt(a.addendumRadius**2-a.baseRadius**2)+Math.sqrt(b.addendumRadius**2-b.baseRadius**2)-(a.pitchRadius+b.pitchRadius)*Math.sin(PRESSURE_ANGLE);
  return length/(Math.PI*module*Math.cos(PRESSURE_ANGLE));
}
export function geometry(p){
  validate(p);
  const gears={driver:gearDimensions(p.driverTeeth,p.module),idler:p.useIdler?gearDimensions(p.idlerTeeth,p.module):null,driven:gearDimensions(p.drivenTeeth,p.module)};
  const centerDistance13=gears.driver.pitchRadius+gears.driven.pitchRadius;
  const centerDistance12=p.useIdler?gears.driver.pitchRadius+gears.idler.pitchRadius:null;
  const centerDistance23=p.useIdler?gears.idler.pitchRadius+gears.driven.pitchRadius:null;
  const centerDistance=p.useIdler?centerDistance12+centerDistance23:centerDistance13;
  const idlerPhase=p.useIdler?Math.PI+Math.PI/p.idlerTeeth:null;
  const drivenPhase=p.useIdler?Math.PI+Math.PI/p.drivenTeeth-idlerPhase*p.idlerTeeth/p.drivenTeeth:Math.PI+Math.PI/p.drivenTeeth;
  const contactRatios=p.useIdler?[contactRatio(gears.driver,gears.idler,p.module),contactRatio(gears.idler,gears.driven,p.module)]:[contactRatio(gears.driver,gears.driven,p.module)];
  const activeGearIds=p.useIdler?['driver','idler','driven']:['driver','driven'];
  const g={centerDistance,centerDistance12,centerDistance23,centerDistance13,faceWidth:p.faceWidth,
    driverCenter:[-centerDistance/2,0,0],idlerCenter:p.useIdler?[-centerDistance/2+centerDistance12,0,0]:null,drivenCenter:[centerDistance/2,0,0],
    driverPhase:0,idlerPhase,drivenPhase,pressureAngle:20,basePitch:Math.PI*p.module*Math.cos(PRESSURE_ANGLE),contactRatios,activeGearIds,
    shaftRadius:Math.min(7.5,...activeGearIds.map(id=>gears[id].rootRadius*.25))};
  for(const id of ['driver','idler','driven'])for(const [suffix,key] of [['Radius','pitchRadius'],['BaseRadius','baseRadius'],['AddendumRadius','addendumRadius'],['RootRadius','rootRadius']])g[id+suffix]=gears[id]?.[key]??null;
  return g;
}
export function estimate(p){
  const g=geometry(p),ratio=p.drivenTeeth/p.driverTeeth,speedRatio=1/ratio,meshCount=p.useIdler?2:1,totalEfficiency=p.meshEfficiency**meshCount;
  const drivenRPM=(p.useIdler?1:-1)*p.inputRPM*speedRatio,idlerRPM=p.useIdler?-p.inputRPM*p.driverTeeth/p.idlerTeeth:null,inputPower=p.inputTorque*p.inputRPM*Math.PI/30;
  return {ratio,speedRatio,driverRPM:p.inputRPM,idlerRPM:idlerRPM===0?0:idlerRPM,drivenRPM:drivenRPM===0?0:drivenRPM,
    meshCount,direction:p.useIdler?'same':'opposite',meshEfficiency:p.meshEfficiency,totalEfficiency,inputTorque:p.inputTorque,
    outputTorque:p.inputRPM>0?p.inputTorque*ratio*totalEfficiency:null,inputPower,outputPower:inputPower*totalEfficiency,
    contactRatios:[...g.contactRatios],minimumContactRatio:Math.min(...g.contactRatios),geometry:g,
    warning:p.inputRPM===0?'主动轮静止，功率为 0；啮合效率不能直接外推静态承载，输出转矩暂不求解。':''};
}
export function motion(p,elapsedSeconds,speed=1){
  validate(p);if(!Number.isFinite(elapsedSeconds)||elapsedSeconds<0||!Number.isFinite(speed)||speed<0)throw new RangeError('无效演示时间或速度');
  const driver=elapsedSeconds*p.inputRPM*Math.PI/30*speed*ANIMATION_SCALE;
  return {driver,idler:p.useIdler?-driver*p.driverTeeth/p.idlerTeeth:null,driven:(p.useIdler?1:-1)*driver*p.driverTeeth/p.drivenTeeth};
}
