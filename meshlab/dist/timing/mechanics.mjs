import {sampleProjected} from '../belt/mechanics.mjs';

export const fields={
  driverTeeth:['主动轮齿数','齿',18,60,1],drivenTeeth:['从动轮齿数','齿',18,80,1],
  centerDistance:['目标中心距','mm',150,360,1],beltWidth:['同步带宽度','mm',8,30,1],
  inputRPM:['主动轮转速','r/min',0,180,1],inputTorque:['输入转矩','N·m',0,10,.1],efficiency:['传动效率','—',.8,1,.01],
};
export const defaults=Object.freeze({driverTeeth:20,drivenTeeth:40,centerDistance:180,beltWidth:16,inputRPM:60,inputTorque:2,efficiency:.96});
export const PITCH=5,ANIMATION_SCALE=.2,TOOTH_HEIGHT=1.2,BACK_THICKNESS=1;
export const TOOTH_BASE_WIDTH=2.65,TOOTH_TIP_WIDTH=TOOTH_BASE_WIDTH-2*TOOTH_HEIGHT*Math.tan(Math.PI/9);
// The cord/pitch line is 0.4 mm outside the tooth root. This is a teaching
// placement, not a manufacturer-certified pitch-line differential.
export const ROOT_DEPTH=.4,LAND_CLEARANCE=.08,GROOVE_CLEARANCE=.12,PROFILE_SAMPLES=192;
export const assumptions='固定5mm节距、T5启发梯形带齿教学模型：齿高1.2mm、背厚1mm、齿夹角40°。闭合带节长为整数带齿数×5mm，由目标中心距匹配最近整数齿数并反求实际中心距。两轮同向、理想无跳齿；齿槽为刚性带齿入/出啮合扫掠避让轮廓，包含教学间隙，不是认证T5制造齿槽。不计算预张力、弹性、齿载荷分配、强度或寿命。';
export function validate(p){
  for(const [key,[name,unit,min,max]] of Object.entries(fields)){
    if(!Number.isFinite(p[key])||p[key]<min||p[key]>max)throw new RangeError(`${name}须在 ${min}–${max} ${unit} 范围内`);
    if(key.endsWith('Teeth')&&!Number.isInteger(p[key]))throw new RangeError(`${name}必须为整数`);
  }return p;
}
export function pitchPathLength(R,r,C){const d=R-r,b=Math.asin(d/C);return 2*Math.sqrt(C*C-d*d)+Math.PI*(R+r)+2*d*b;}
export function geometry(p){
  validate(p);const R=p.driverTeeth*PITCH/(2*Math.PI),r=p.drivenTeeth*PITCH/(2*Math.PI);
  const requestedCenterDistance=p.centerDistance,beltTeeth=Math.round(pitchPathLength(R,r,requestedCenterDistance)/PITCH),pitchLength=beltTeeth*PITCH;
  let lo=R+r+2,hi=requestedCenterDistance+PITCH;
  for(let i=0;i<64;i++){const mid=(lo+hi)/2;if(pitchPathLength(R,r,mid)<pitchLength)lo=mid;else hi=mid;}
  const C=(lo+hi)/2,b=Math.asin((R-r)/C),tangentAngle=Math.PI/2-b,tangentLength=Math.sqrt(C*C-(R-r)**2),driverWrap=Math.PI+2*b,drivenWrap=Math.PI-2*b;
  // Belt tooth zero is at the start of the upper straight span. Angular zero
  // on each pulley is a groove centre. Both phases follow that same tooth lattice.
  const driverPhase=tangentAngle,drivenPhase=tangentAngle+tangentLength/r;
  return {pitch:PITCH,beltTeeth,pitchLength,requestedCenterDistance,effectiveCenterDistance:C,centerDistance:C,centerDistanceError:C-requestedCenterDistance,
    driverTeeth:p.driverTeeth,drivenTeeth:p.drivenTeeth,driverRadius:R,drivenRadius:r,driverCenter:[-C/2,0,0],drivenCenter:[C/2,0,0],
    driverPhase,drivenPhase,beltWidth:p.beltWidth,pulleyWidth:p.beltWidth+2,beltThickness:BACK_THICKNESS,
    driverPulleyRadius:R-ROOT_DEPTH-LAND_CLEARANCE,drivenPulleyRadius:r-ROOT_DEPTH-LAND_CLEARANCE,
    shaftRadius:Math.min(7.5,(Math.min(R,r)-ROOT_DEPTH-TOOTH_HEIGHT-GROOVE_CLEARANCE)*.25),
    crossed:false,tangentAngle,tangentLength,driverWrap,drivenWrap,projectedBeltLength:pitchLength,spatialCenterlineLength:pitchLength,
    crossingFraction:R/(R+r),crossingLift:0};
}
export function beltSample(g,travel){return sampleProjected(g,travel);}
export function toothSection(){return [[-TOOTH_BASE_WIDTH/2,ROOT_DEPTH],[TOOTH_BASE_WIDTH/2,ROOT_DEPTH],[TOOTH_TIP_WIDTH/2,ROOT_DEPTH+TOOTH_HEIGHT],[-TOOTH_TIP_WIDTH/2,ROOT_DEPTH+TOOTH_HEIGHT]];}
export function toothPolygon(g,travel){const f=beltSample(g,travel);return toothSection().map(([u,v])=>[f.position[0]+u*f.tangent[0]+v*f.normal[0],f.position[1]+u*f.tangent[1]+v*f.normal[1]]);}
export function toothMeshData(width){
  const vertices=[],indices=[],profile=toothSection();
  for(const sign of [-1,1])for(const [u,v] of profile)vertices.push(u,sign*width/2,v);
  indices.push(0,2,1,0,3,2,4,5,6,4,6,7);
  for(let i=0;i<4;i++){const j=(i+1)%4;indices.push(i,j,j+4,i,j+4,i+4);}
  return {vertices,indices};
}
const profileCache=new Map();
function radialHit(poly,angle){
  const dx=Math.cos(angle),dy=Math.sin(angle);let result=Infinity;
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],ex=b[0]-a[0],ey=b[1]-a[1],den=dx*ey-dy*ex;
    if(Math.abs(den)<1e-12)continue;const t=(a[0]*dy-a[1]*dx)/den,r=(a[0]*ey-a[1]*ex)/den;
    if(t>=-1e-9&&t<=1+1e-9&&r>0)result=Math.min(result,r);
  }return result;
}
export function pulleyOutline(teeth){
  if(profileCache.has(teeth))return profileCache.get(teeth);
  const R=teeth*PITCH/(2*Math.PI),period=2*Math.PI/teeth,land=R-ROOT_DEPTH-LAND_CLEARANCE,section=toothSection();
  // Envelope of the actual rigid tooth approaching/leaving a tangent. In the
  // pulley frame a point is Rot(s/R) * [R-depth, -s-u]. On the wrap s=0.
  const extent=Math.sqrt(2*R*(ROOT_DEPTH+TOOTH_HEIGHT))+PITCH,polygons=[];
  const count=Math.ceil(2*extent/.04);
  for(let i=0;i<=count;i++){
    const s=-extent+2*extent*i/count,angle=s/R,co=Math.cos(angle),si=Math.sin(angle);
    polygons.push(section.map(([u,v])=>{const x=R-v,y=-s-u;return [x*co-y*si,x*si+y*co];}));
  }
  polygons.push(section.map(([u,v])=>[R-v,-u]));
  const radii=[];
  for(let i=0;i<PROFILE_SAMPLES;i++){
    const theta=-period/2+i*period/PROFILE_SAMPLES;let radial=land;
    for(const poly of polygons)for(const shift of [-period,0,period])radial=Math.min(radial,radialHit(poly,theta+shift)-GROOVE_CLEARANCE);
    radii.push(radial);
  }
  const outline=[];
  for(let tooth=0;tooth<teeth;tooth++)for(let i=0;i<PROFILE_SAMPLES;i++){
    const a=(tooth-.5)*period+i*period/PROFILE_SAMPLES,r=radii[i];outline.push([r*Math.cos(a),r*Math.sin(a)]);
  }
  profileCache.set(teeth,outline);return outline;
}
export function beltMeshData(g){
  const distances=[],T=g.tangentLength,B=g.drivenRadius*g.drivenWrap;
  for(const [start,length,count] of [[0,T,2],[T,B,Math.ceil(B/.4)],[T+B,T,2],[2*T+B,g.driverRadius*g.driverWrap,Math.ceil(g.driverRadius*g.driverWrap/.4)]])for(let j=0;j<count;j++)distances.push(start+length*j/count);
  const vertices=[],indices=[];
  for(const d of distances){const f=beltSample(g,d);for(const [w,depth] of [[-1,-.6],[1,-.6],[1,ROOT_DEPTH],[-1,ROOT_DEPTH]])vertices.push(...f.position.map((v,i)=>v+w*g.beltWidth/2*f.width[i]+depth*f.normal[i]));}
  for(let i=0;i<distances.length;i++)for(let edge=0;edge<4;edge++){const a=i*4+edge,b=i*4+(edge+1)%4,c=((i+1)%distances.length)*4+(edge+1)%4,d=((i+1)%distances.length)*4+edge;indices.push(a,b,c,a,c,d);}
  return {vertices,indices};
}
export function estimate(p){
  const g=geometry(p),ratio=p.drivenTeeth/p.driverTeeth,inputPower=p.inputTorque*p.inputRPM*Math.PI/30;
  return {ratio,speedRatio:1/ratio,driverRPM:p.inputRPM,drivenRPM:p.inputRPM/ratio,beltSpeed:p.inputRPM*p.driverTeeth*PITCH/60000,
    driverWrapDeg:g.driverWrap*180/Math.PI,drivenWrapDeg:g.drivenWrap*180/Math.PI,driverEngagedTeeth:p.driverTeeth*g.driverWrap/(2*Math.PI),drivenEngagedTeeth:p.drivenTeeth*g.drivenWrap/(2*Math.PI),
    beltTeeth:g.beltTeeth,pitchLength:g.pitchLength,requestedCenterDistance:p.centerDistance,effectiveCenterDistance:g.centerDistance,centerDistanceError:g.centerDistanceError,
    inputTorque:p.inputTorque,outputTorque:p.inputRPM>0?p.inputTorque*ratio*p.efficiency:null,inputPower,outputPower:inputPower*p.efficiency,efficiency:p.efficiency,geometry:g,
    warning:p.inputRPM===0?'主动轮静止，功率为0；运动效率不能用于推断静态承载，输出转矩暂不求解。':''};
}
export function motion(p,elapsedSeconds,speed=1){validate(p);if(!Number.isFinite(elapsedSeconds)||elapsedSeconds<0||!Number.isFinite(speed)||speed<0)throw new RangeError('无效演示时间或速度');const driver=elapsedSeconds*p.inputRPM*Math.PI/30*speed*ANIMATION_SCALE;return {driver,driven:driver*p.driverTeeth/p.drivenTeeth,beltTravel:-driver*p.driverTeeth*PITCH/(2*Math.PI)};}
