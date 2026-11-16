export const PITCH = 12.7;
export const fields = {
  frontTeeth:['前牙盘齿数','齿',28,52,1], rearTeeth:['后链轮齿数','齿',12,32,1],
  cadence:['踏频','r/min',0,120,1], centerDistance:['请求中心距','mm',380,500,1],
  wheelDiameter:['后轮外径','mm',600,740,10], crankLength:['曲柄长度','mm',150,180,1],
  inputPower:['骑行输入功率','W',0,500,5], efficiency:['传动效率','—',.85,1,.01],
};
export const defaults=Object.freeze({frontTeeth:42,rearTeeth:18,cadence:80,centerDistance:430,
  wheelDiameter:700,crankLength:170,inputPower:150,efficiency:.97});
export const assumptions='单速、同平面滚子链教学模型；名义节距 12.7 mm。运动采用连续节线，忽略多边形效应、弹性、齿侧间隙与换挡过程；链节取偶数并自动求实际中心距。后轮与后链轮在踩踏时同步，无滑移理想车速不含风阻、坡度或加速。效率由用户给定，牙型不是制造标准型线。';
export function validate(p){
  for(const [key,[name,unit,min,max]] of Object.entries(fields)){
    if(!Number.isFinite(p[key])||p[key]<min||p[key]>max)throw new RangeError(`${name}须在 ${min}–${max} ${unit} 范围内`);
  }
  if(!Number.isInteger(p.frontTeeth)||!Number.isInteger(p.rearTeeth))throw new RangeError('前后齿数必须为整数');
  return p;
}
// Continuous pitch-line length of an uncrossed two-sprocket chain path.
export function pathLength(center,frontRadius,rearRadius){
  const difference=frontRadius-rearRadius;
  return 2*Math.sqrt(center*center-difference*difference)+Math.PI*(frontRadius+rearRadius)+2*difference*Math.asin(difference/center);
}
export function geometry(p){
  validate(p);
  const frontRadius=PITCH*p.frontTeeth/(2*Math.PI),rearRadius=PITCH*p.rearTeeth/(2*Math.PI);
  const requestedLength=pathLength(p.centerDistance,frontRadius,rearRadius);
  const chainLinks=2*Math.round(requestedLength/PITCH/2),chainLength=chainLinks*PITCH;
  let low=Math.abs(frontRadius-rearRadius)+1,high=chainLength/2;
  for(let i=0;i<65;i++){const middle=(low+high)/2;if(pathLength(middle,frontRadius,rearRadius)<chainLength)low=middle;else high=middle;}
  const effectiveCenterDistance=(low+high)/2;
  const tangentAngle=Math.acos((frontRadius-rearRadius)/effectiveCenterDistance);
  const tangentLength=Math.sqrt(effectiveCenterDistance**2-(frontRadius-rearRadius)**2);
  return {frontRadius,rearRadius,frontPitchRadius:PITCH/(2*Math.sin(Math.PI/p.frontTeeth)),
    rearPitchRadius:PITCH/(2*Math.sin(Math.PI/p.rearTeeth)),chainLinks,chainLength,chainPitch:PITCH,
    requestedCenterDistance:p.centerDistance,effectiveCenterDistance,centerCorrection:effectiveCenterDistance-p.centerDistance,
    tangentLength,tangentAngle,closureError:Math.abs(pathLength(effectiveCenterDistance,frontRadius,rearRadius)-chainLength),
    approximateChainLinks:2*p.centerDistance/PITCH+(p.frontTeeth+p.rearTeeth)/2+
      (p.frontTeeth-p.rearTeeth)**2/(4*Math.PI**2*(p.centerDistance/PITCH))};
}
export function chainPoint(g,distance){
  const {frontRadius:R,rearRadius:r,effectiveCenterDistance:C,tangentAngle:a,tangentLength:t,chainLength:L}=g;
  const s=((distance%L)+L)%L,ca=Math.cos(a),sa=Math.sin(a),rearArc=2*a*r;
  if(s<t){const f=s/t;return [-C/2+R*ca+f*(C+(r-R)*ca),R*sa+f*(r-R)*sa];}
  if(s<t+rearArc){const angle=a-(s-t)/r;return [C/2+r*Math.cos(angle),r*Math.sin(angle)];}
  if(s<2*t+rearArc){const f=(s-t-rearArc)/t;return [C/2+r*ca-f*(C+(r-R)*ca),-r*sa-f*(R-r)*sa];}
  const angle=-a-(s-2*t-rearArc)/R;
  return [-C/2+R*Math.cos(angle),R*Math.sin(angle)];
}
export function estimate(p){
  const g=geometry(p),ratio=p.frontTeeth/p.rearTeeth,rearRPM=p.cadence*ratio;
  const moving=p.cadence>0,outputPower=moving?p.inputPower*p.efficiency:0;
  return {ratio,rearRPM,speedKmh:rearRPM*Math.PI*p.wheelDiameter*60/1e6,inputPower:p.inputPower,
    outputPower,inputTorque:moving?p.inputPower/(p.cadence*Math.PI/30):null,
    outputTorque:moving?outputPower/(rearRPM*Math.PI/30):null,
    chainSpeed:p.cadence*p.frontTeeth*PITCH/60000,
    chainLinks:g.chainLinks,effectiveCenterDistance:g.effectiveCenterDistance,chainPitch:PITCH,geometry:g,
    warning:!moving&&p.inputPower>0?'踏频为 0：链条与后轮静止；给定功率不能构成稳态传动，输出功率按 0 显示，转矩不求解。':''};
}
export function motion(p,elapsedSeconds,speed=1){
  // At 1x the viewer uses one fifth of operating speed so individual links are legible.
  const front=-elapsedSeconds*p.cadence*Math.PI/30*speed*.2;
  return {front,rear:front*p.frontTeeth/p.rearTeeth,wheel:front*p.frontTeeth/p.rearTeeth,
    chainPhase:-front*PITCH*p.frontTeeth/(2*Math.PI)};
}
