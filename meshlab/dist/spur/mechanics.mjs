export const fields={
  driverTeeth:['主动轮齿数','齿',18,60,1],drivenTeeth:['从动轮齿数','齿',18,80,1],
  module:['模数','mm',1,5,.5],faceWidth:['齿宽','mm',8,40,1],inputRPM:['主动轮转速','r/min',0,180,1],
  inputTorque:['输入转矩','N·m',0,20,.1],efficiency:['传动效率','—',.85,1,.01],
};
export const defaults=Object.freeze({driverTeeth:20,drivenTeeth:40,module:3,faceWidth:20,inputRPM:60,inputTorque:5,efficiency:.98});
export const PRESSURE_ANGLE=20*Math.PI/180;
export const ANIMATION_SCALE=.2;
export const assumptions='20°压力角、标准全齿高、零变位的外啮合直齿圆柱齿轮；两轮模数相同，齿数从18起。工作齿面为渐开线，齿根以下用径向连接与齿根圆弧作教学近似，不是滚刀包络。效率为给定值，不预测承载强度、接触应力、润滑或寿命；几何未包含制造侧隙、公差和修形。';
export function validate(p){
  for(const [key,[name,unit,min,max]] of Object.entries(fields))if(!Number.isFinite(p[key])||p[key]<min||p[key]>max)throw new RangeError(`${name}须在 ${min}–${max} ${unit} 范围内`);
  for(const key of ['driverTeeth','drivenTeeth'])if(!Number.isInteger(p[key]))throw new RangeError('齿数必须为整数');
  return p;
}
export const involute=angle=>Math.tan(angle)-angle;
export function gearDimensions(teeth,module){
  if(!Number.isInteger(teeth)||teeth<18||teeth>80||!Number.isFinite(module)||module<1||module>5)throw new RangeError('无效齿轮尺寸');
  const pitchRadius=module*teeth/2,baseRadius=pitchRadius*Math.cos(PRESSURE_ANGLE);
  return {teeth,module,pitchRadius,baseRadius,addendumRadius:pitchRadius+module,rootRadius:pitchRadius-1.25*module,
    pitchThickness:Math.PI*module/2,halfPitchAngle:Math.PI/(2*teeth),baseHalfAngle:Math.PI/(2*teeth)+involute(PRESSURE_ANGLE)};
}
export function halfToothAngle(g,radius){
  return g.halfPitchAngle+involute(PRESSURE_ANGLE)-involute(Math.acos(Math.min(1,g.baseRadius/radius)));
}
// This exact sampled outline also feeds the production extrusion and collision tests.
export function gearOutline(teeth,module,flankSegments=24){
  const g=gearDimensions(teeth,module),startRadius=Math.max(g.rootRadius,g.baseRadius),pitch=2*Math.PI/teeth;
  const lowerHalf=halfToothAngle(g,startRadius),tipHalf=halfToothAngle(g,g.addendumRadius),points=[];
  const add=(r,a)=>points.push([r*Math.cos(a),r*Math.sin(a)]);
  for(let tooth=0;tooth<teeth;tooth++){
    const angle=tooth*pitch;
    add(g.rootRadius,angle-lowerHalf);
    for(let j=0;j<=flankSegments;j++){
      const r=startRadius+(g.addendumRadius-startRadius)*j/flankSegments;add(r,angle-halfToothAngle(g,r));
    }
    for(let j=1;j<=5;j++)add(g.addendumRadius,angle-tipHalf+2*tipHalf*j/5);
    for(let j=flankSegments-1;j>=0;j--){const r=startRadius+(g.addendumRadius-startRadius)*j/flankSegments;add(r,angle+halfToothAngle(g,r));}
    add(g.rootRadius,angle+lowerHalf);
    for(let j=1;j<5;j++)add(g.rootRadius,angle+lowerHalf+(pitch-2*lowerHalf)*j/5);
  }
  // Remove duplicate radius/angle points when the root lies above the base circle.
  return points.filter((p,i)=>!i||Math.hypot(p[0]-points[i-1][0],p[1]-points[i-1][1])>1e-9);
}
export function geometry(p){
  validate(p);const d=gearDimensions(p.driverTeeth,p.module),r=gearDimensions(p.drivenTeeth,p.module);
  const centerDistance=d.pitchRadius+r.pitchRadius;
  const contactPath=Math.sqrt(d.addendumRadius**2-d.baseRadius**2)+Math.sqrt(r.addendumRadius**2-r.baseRadius**2)-centerDistance*Math.sin(PRESSURE_ANGLE);
  const basePitch=Math.PI*p.module*Math.cos(PRESSURE_ANGLE),contactRatio=contactPath/basePitch;
  return {driverRadius:d.pitchRadius,drivenRadius:r.pitchRadius,driverBaseRadius:d.baseRadius,drivenBaseRadius:r.baseRadius,
    driverAddendumRadius:d.addendumRadius,drivenAddendumRadius:r.addendumRadius,driverRootRadius:d.rootRadius,drivenRootRadius:r.rootRadius,
    centerDistance,faceWidth:p.faceWidth,driverCenter:[-centerDistance/2,0,0],drivenCenter:[centerDistance/2,0,0],
    driverPhase:0,drivenPhase:Math.PI+Math.PI/p.drivenTeeth,pressureAngle:20,contactPath,basePitch,contactRatio,
    shaftRadius:Math.min(7.5,Math.min(d.rootRadius,r.rootRadius)*.25)};
}
export function estimate(p){
  const g=geometry(p),ratio=p.drivenTeeth/p.driverTeeth,speedRatio=1/ratio,drivenRPM=-p.inputRPM*speedRatio,inputPower=p.inputTorque*p.inputRPM*Math.PI/30;
  return {ratio,speedRatio,driverRPM:p.inputRPM,drivenRPM:drivenRPM===0?0:drivenRPM,inputTorque:p.inputTorque,
    outputTorque:p.inputRPM>0?p.inputTorque*ratio*p.efficiency:null,staticTorqueRatio:ratio,efficiency:p.efficiency,inputPower,outputPower:inputPower*p.efficiency,
    contactRatio:g.contactRatio,pressureAngle:20,geometry:g,warning:p.inputRPM===0?'主动轮静止，功率为 0；运动效率不能直接外推静态承载，输出转矩暂不求解。':''};
}
export function motion(p,elapsedSeconds,speed=1){
  validate(p);if(!Number.isFinite(elapsedSeconds)||elapsedSeconds<0||!Number.isFinite(speed)||speed<0)throw new RangeError('无效演示时间或速度');
  const driver=elapsedSeconds*p.inputRPM*Math.PI/30*speed*ANIMATION_SCALE;
  return {driver,driven:-driver*p.driverTeeth/p.drivenTeeth};
}
