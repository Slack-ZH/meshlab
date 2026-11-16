export const fields={
  driverDiameter:['主动轮有效直径','mm',60,200,1],drivenDiameter:['从动轮有效直径','mm',60,240,1],
  centerDistance:['轴间中心距','mm',260,600,1],beltWidth:['平带宽度','mm',8,36,1],
  inputRPM:['主动轮转速','r/min',0,180,1],inputTorque:['输入转矩','N·m',0,20,.1],efficiency:['传动效率','—',.8,1,.01],
};
export const defaults=Object.freeze({driverDiameter:120,drivenDiameter:180,centerDistance:360,beltWidth:20,inputRPM:60,inputTorque:5,efficiency:.95,crossed:true});
export const ANIMATION_SCALE=.2,BELT_THICKNESS=2;
export const assumptions='理想无滑移平带教学模型，直径为带中性层有效节径。交叉模式反向、开口模式同向；包角与投影带长按平面公切线精确计算。交叉处采用离面与平滑半扭转避免相互穿模，显示空间中心线长度也不是实际制造带长；不求材料伸长、张紧、跑偏、蠕滑、强度或寿命。';
export function validate(p){
  if(typeof p.crossed!=='boolean')throw new TypeError('交叉模式必须为布尔值');
  for(const [key,[name,unit,min,max]] of Object.entries(fields))if(!Number.isFinite(p[key])||p[key]<min||p[key]>max)throw new RangeError(`${name}须在 ${min}–${max} ${unit} 范围内`);
  return p;
}
export function geometry(p){
  validate(p);const R=p.driverDiameter/2,r=p.drivenDiameter/2,C=p.centerDistance;
  const offset=p.crossed?R+r:R-r,angle=Math.asin(offset/C),a=Math.PI/2-angle;
  const tangentLength=Math.sqrt(C*C-offset*offset),driverWrap=Math.PI+2*angle,drivenWrap=p.crossed?driverWrap:Math.PI-2*angle;
  const projectedBeltLength=2*tangentLength+R*driverWrap+r*drivenWrap,crossingLift=p.crossed?p.beltWidth*.5+3:0,crossingFraction=R/(R+r);
  const lut=[0],count=256,step=1/count,slope=t=>{const q=crossWarp(t,crossingFraction);return crossingLift*Math.PI*Math.sin(2*Math.PI*q.value)*q.derivative/tangentLength;};
  const integrand=t=>tangentLength*Math.hypot(1,slope(t));
  for(let j=1;j<=count;j++){const start=(j-1)*step;lut.push(lut[j-1]+step*(integrand(start)+4*integrand(start+step/2)+integrand(start+step))/6);}
  const spatialSpanLength=lut[count],spatialCenterlineLength=2*spatialSpanLength+R*driverWrap+r*drivenWrap;
  return {crossed:p.crossed,driverRadius:R,drivenRadius:r,centerDistance:C,beltWidth:p.beltWidth,pulleyWidth:p.beltWidth+6,beltThickness:BELT_THICKNESS,
    driverCenter:[-C/2,0,0],drivenCenter:[C/2,0,0],driverPulleyRadius:R-BELT_THICKNESS/2-.05,drivenPulleyRadius:r-BELT_THICKNESS/2-.05,
    tangentAngle:a,crossingAngle:angle,tangentLength,driverWrap,drivenWrap,projectedBeltLength,spatialCenterlineLength,spatialSpanLength,crossingLift,crossingFraction,
    shaftRadius:7.5,spanArcLUT:lut};
}
const smooth=t=>t*t*t*(10+t*(-15+6*t));
function crossWarp(t,fraction){const denom=t*(1-fraction)+(1-t)*fraction;return {value:t*(1-fraction)/denom,derivative:fraction*(1-fraction)/(denom*denom)};}
function frame(position,tx,ty,zSlope,twist,segment){
  const norm=Math.hypot(1,zSlope),tangent=[tx/norm,ty/norm,zSlope/norm],up=[-zSlope*tx/norm,-zSlope*ty/norm,1/norm],normal2=[-ty,tx,0];
  const width=up.map((v,i)=>v*Math.cos(twist)+normal2[i]*Math.sin(twist));
  const normal=[tangent[1]*width[2]-tangent[2]*width[1],tangent[2]*width[0]-tangent[0]*width[2],tangent[0]*width[1]-tangent[1]*width[0]];
  return {position,tangent,width,normal,segment,twist};
}
export function sampleProjected(g,distance){
  const {driverRadius:R,drivenRadius:r,centerDistance:C,tangentAngle:a,tangentLength:T,projectedBeltLength:L,crossed}=g;
  const s=((distance%L)+L)%L,ca=Math.cos(a),sa=Math.sin(a),rearArc=r*g.drivenWrap;
  const firstA=[-C/2+R*ca,R*sa],firstB=crossed?[C/2-r*ca,-r*sa]:[C/2+r*ca,r*sa];
  const secondA=crossed?[C/2-r*ca,r*sa]:[C/2+r*ca,-r*sa],secondB=[-C/2+R*ca,-R*sa];
  if(s<T||s>=T+rearArc&&s<2*T+rearArc){
    const first=s<T,t=(first?s:s-T-rearArc)/T,A=first?firstA:secondA,B=first?firstB:secondB,sign=first?1:-1;
    const warp=crossWarp(t,first?g.crossingFraction:1-g.crossingFraction),q=warp.value;
    const lift=crossed?sign*g.crossingLift*Math.sin(Math.PI*q)**2:0,zSlope=crossed?sign*g.crossingLift*Math.PI*Math.sin(2*Math.PI*q)*warp.derivative/T:0;
    const twist=crossed?(first?0:Math.PI)+Math.PI*smooth(q):0;
    return frame([A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,lift],(B[0]-A[0])/T,(B[1]-A[1])/T,zSlope,twist,first?'span1':'span2');
  }
  if(s<T+rearArc){
    const direction=crossed?1:-1,theta=(crossed?a-Math.PI:a)+direction*(s-T)/r;
    return frame([C/2+r*Math.cos(theta),r*Math.sin(theta),0],-direction*Math.sin(theta),direction*Math.cos(theta),0,crossed?Math.PI:0,'driven-wrap');
  }
  const theta=-a-(s-2*T-rearArc)/R;
  return frame([-C/2+R*Math.cos(theta),R*Math.sin(theta),0],Math.sin(theta),-Math.cos(theta),0,crossed?Math.PI*2:0,'driver-wrap');
}
function projectedSpan(g,spatial){
  if(!g.crossed)return spatial;const lut=g.spanArcLUT;let lo=0,hi=lut.length-1;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(lut[mid]<spatial)lo=mid;else hi=mid;}
  const start=lo/(lut.length-1),end=hi/(lut.length-1),f=t=>{const q=crossWarp(t,g.crossingFraction),dz=g.crossingLift*Math.PI*Math.sin(2*Math.PI*q.value)*q.derivative;return Math.hypot(g.tangentLength,dz);};
  let t=start+(end-start)*(spatial-lut[lo])/(lut[hi]-lut[lo]);
  for(let i=0;i<2;i++){const arc=lut[lo]+(t-start)*(f(start)+4*f((start+t)/2)+f(t))/6;t=Math.max(start,Math.min(end,t-(arc-spatial)/f(t)));}
  return g.tangentLength*t;
}
export function beltSample(g,travel){
  const L=g.spatialCenterlineLength,s=((travel%L)+L)%L,T=g.spatialSpanLength,B=g.drivenRadius*g.drivenWrap;
  let projected;
  if(s<T)projected=projectedSpan(g,s);
  else if(s<T+B)projected=g.tangentLength+s-T;
  else if(s<2*T+B)projected=g.tangentLength+B+g.tangentLength-projectedSpan(g,T-(s-T-B));
  else projected=2*g.tangentLength+B+s-2*T-B;
  return sampleProjected(g,projected);
}
// Closed rectangular belt extrusion. The viewer consumes these exact faces.
export function beltMeshData(g){
  const distances=[],T=g.tangentLength,B=g.drivenRadius*g.drivenWrap;
  const spans=[[0,T,128],[T,B,Math.ceil(g.drivenWrap/(Math.PI/144))],[T+B,T,128],[2*T+B,g.driverRadius*g.driverWrap,Math.ceil(g.driverWrap/(Math.PI/144))]];
  for(const [start,length,count] of spans)for(let j=0;j<count;j++)distances.push(start+length*j/count);
  const vertices=[],indices=[],sections=[],samples=distances.map(d=>sampleProjected(g,d));
  for(const sample of samples){
    sections.push(sample.segment);
    for(const [w,t] of [[-1,-1],[1,-1],[1,1],[-1,1]])vertices.push(...sample.position.map((v,i)=>v+w*g.beltWidth/2*sample.width[i]+t*g.beltThickness/2*sample.normal[i]));
  }
  for(let i=0;i<samples.length;i++)for(let edge=0;edge<4;edge++){
    const a=i*4+edge,b=i*4+(edge+1)%4,c=((i+1)%samples.length)*4+(edge+1)%4,d=((i+1)%samples.length)*4+edge;
    indices.push(a,b,c,a,c,d);
  }
  return {vertices,indices,sections,samples};
}
export function estimate(p){
  const g=geometry(p),ratio=p.drivenDiameter/p.driverDiameter,speedRatio=1/ratio,drivenRPM=(p.crossed?-1:1)*p.inputRPM*speedRatio,inputPower=p.inputTorque*p.inputRPM*Math.PI/30;
  return {ratio,speedRatio,driverRPM:p.inputRPM,drivenRPM:drivenRPM===0?0:drivenRPM,beltSpeed:p.inputRPM*Math.PI*p.driverDiameter/60000,
    driverWrapDeg:g.driverWrap*180/Math.PI,drivenWrapDeg:g.drivenWrap*180/Math.PI,projectedBeltLength:g.projectedBeltLength,spatialCenterlineLength:g.spatialCenterlineLength,
    inputTorque:p.inputTorque,outputTorque:p.inputRPM>0?p.inputTorque*ratio*p.efficiency:null,inputPower,outputPower:inputPower*p.efficiency,efficiency:p.efficiency,geometry:g,
    warning:p.inputRPM===0?'主动轮静止，功率为 0；运动效率不能用于推断静态承载，输出转矩暂不求解。':''};
}
export function motion(p,elapsedSeconds,speed=1){
  validate(p);if(!Number.isFinite(elapsedSeconds)||elapsedSeconds<0||!Number.isFinite(speed)||speed<0)throw new RangeError('无效演示时间或速度');
  const driver=elapsedSeconds*p.inputRPM*Math.PI/30*speed*ANIMATION_SCALE;
  return {driver,driven:(p.crossed?-1:1)*driver*p.driverDiameter/p.drivenDiameter,beltTravel:-driver*p.driverDiameter/2};
}
