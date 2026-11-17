export const fields = {
  driverDiameter:['主动轮直径','mm',60,300,1], drivenDiameter:['从动轮直径','mm',60,300,1],
  wheelWidth:['轮宽','mm',15,60,1], inputRPM:['主动轮转速','r/min',0,180,1],
  normalForce:['压紧力','N',20,1000,10], frictionCoefficient:['静摩擦系数','—',.1,.8,.01],
  loadTorque:['从动轴负载转矩','N·m',0,30,.1],
};
export const defaults=Object.freeze({driverDiameter:120,drivenDiameter:240,wheelWidth:32,inputRPM:60,
  normalForce:200,frictionCoefficient:.4,loadTorque:1});
export const assumptions='两圆柱摩擦轮外接，轴线平行；刚体、理想无滑动的运动基准，忽略弹性蠕滑、轴承阻力与滚动损耗。静摩擦系数和压紧力由用户给定；μN 是牵引上限，不是始终存在的实际摩擦力。超限时只提示无法维持所设稳态，不预测真实滑移速度。轮宽仅改变几何，不据此预测接触应力或材料寿命。';
export const ANIMATION_SCALE=.2;
export function validate(p){
  for(const [key,[name,unit,min,max]] of Object.entries(fields)){
    if(!Number.isFinite(p[key])||p[key]<min||p[key]>max)throw new RangeError(`${name}须在 ${min}–${max} ${unit} 范围内`);
  }
  return p;
}
export function geometry(p){
  validate(p);
  const driverRadius=p.driverDiameter/2,drivenRadius=p.drivenDiameter/2,centerDistance=driverRadius+drivenRadius;
  return {driverRadius,drivenRadius,centerDistance,wheelWidth:p.wheelWidth,
    driverCenter:[-centerDistance/2,0,0],drivenCenter:[centerDistance/2,0,0],
    contactPoint:[-centerDistance/2+driverRadius,0,0],contactGap:0};
}
export function estimate(p){
  const g=geometry(p),ratio=p.drivenDiameter/p.driverDiameter,speedRatio=1/ratio;
  const drivenRPM=-p.inputRPM*speedRatio,surfaceSpeed=Math.PI*p.driverDiameter*p.inputRPM/60000;
  const frictionLimit=p.frictionCoefficient*p.normalForce,tractionDemand=p.loadTorque/(g.drivenRadius/1000);
  const torqueCapacity=frictionLimit*g.drivenRadius/1000,utilization=tractionDemand/frictionLimit;
  const tractionFeasible=tractionDemand<=frictionLimit+Number.EPSILON*Math.max(1,frictionLimit)*8;
  const contactState=!tractionFeasible?'overload':p.inputRPM===0?'stationary':'rolling';
  const warning=!tractionFeasible?'负载所需切向力超过静摩擦牵引上限，无法维持所设无滑动稳态。转速与动画仍为理想基准，不代表实际滑移后的转速。':
    p.inputRPM===0?'主动轮静止，理想从动转速和功率均为 0；牵引余量仅作静态容量比较。':'';
  return {ratio,speedRatio,driverRPM:p.inputRPM,drivenRPM:drivenRPM===0?0:drivenRPM,surfaceSpeed,
    normalForce:p.normalForce,frictionLimit,tractionDemand,torqueCapacity,loadTorque:p.loadTorque,utilization,tractionFeasible,
    theoreticalOutputPower:p.loadTorque*Math.abs(drivenRPM)*Math.PI/30,contactState,warning,geometry:g};
}
export function motion(p,elapsedSeconds,speed=1){
  validate(p);
  if(!Number.isFinite(elapsedSeconds)||elapsedSeconds<0||!Number.isFinite(speed)||speed<0)throw new RangeError('无效演示时间或速度');
  const driver=elapsedSeconds*p.inputRPM*Math.PI/30*speed*ANIMATION_SCALE;
  return {driver,driven:-driver*p.driverDiameter/p.drivenDiameter};
}
