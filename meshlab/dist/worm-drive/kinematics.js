export const defaults=Object.freeze({starts:1,wheelTeeth:40,rpm:120});
export const geometry=Object.freeze({module:3,diameterFactor:12,faceWidth:20,threadLength:100});
export const animationScale=1/4;
export const TAU=Math.PI*2;

export function wormResults({starts,wheelTeeth,rpm}=defaults){
  if(!Number.isInteger(starts)||starts<1||starts>4)throw new RangeError('蜗杆头数须为 1—4 的整数');
  if(!Number.isInteger(wheelTeeth)||wheelTeeth<20||wheelTeeth>60)throw new RangeError('蜗轮齿数须为 20—60 的整数');
  if(!Number.isFinite(rpm)||rpm<0)throw new RangeError('转速须非负');
  const m=geometry.module,q=geometry.diameterFactor,ratio=wheelTeeth/starts;
  return {ratio,outputRpm:rpm/ratio,inputRpm:rpm,wormDiameter:m*q,wheelDiameter:m*wheelTeeth,
    centerDistance:m*(q+wheelTeeth)/2,axialPitch:Math.PI*m,lead:Math.PI*m*starts,
    leadAngle:Math.atan(starts/q)*180/Math.PI,teethPerTurn:starts,wheelDegreesPerTurn:360/ratio};
}
export function poseAt(inputAngle,parameters=defaults){
  if(!Number.isFinite(inputAngle))throw new RangeError('转角须为有效数值');
  const result=wormResults(parameters);
  return {worm:inputAngle,wheel:inputAngle/result.ratio};
}
export function cycleProgress(inputRadians,parameters=defaults){
  if(!Number.isFinite(inputRadians)||inputRadians<0)throw new RangeError('累计转角须非负');
  const result=wormResults(parameters),turns=inputRadians/TAU;
  return {turns,teeth:turns*parameters.starts,wheelDegrees:turns*result.wheelDegreesPerTurn};
}
