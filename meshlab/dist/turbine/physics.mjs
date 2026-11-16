import { IF97 } from './vendor/if97.mjs';

// Restricted teaching domain: inlet region 2, outlet regions 2 or 4.
// p <= 10 MPa keeps both saturation endpoints in regions 1/2 (Tsat < 623.15 K).
export const fields = {
  height: ['末级叶片高度', 'mm', 20, 180, 5],
  chord: ['根部轴向弦长', 'mm', 15, 100, 5],
  blades: ['每排叶片数', '片', 12, 72, 1],
  hub: ['轮毂直径', 'mm', 180, 500, 10],
  stages: ['级数', '级', 1, 6, 1],
  p1: ['进汽绝对压力', 'MPa', .001, 10, .1],
  temperature: ['进汽温度', '°C', 1, 800, 10],
  flow: ['质量流量', 'kg/s', .01, 100, 1],
  p2: ['排汽绝对压力', 'MPa', .001, 10, .01],
  etaT: ['等熵效率', '—', .01, 1, .01],
  etaM: ['机械效率', '—', .01, 1, .01],
};
export const defaults = Object.freeze({height:80,chord:45,blades:30,hub:280,stages:3,
  p1:3,temperature:400,flow:10,p2:.01,etaT:.8,etaM:.98,work:'impulse',exhaust:'condensing'});
export const assumptions = '单进单出、绝热稳态；忽略动能与位能变化；指定流量和效率。无抽汽、再热、逐级损失或非设计工况求解。几何及类型不直接参与首版功率公式。';
export function pressureToMPa(value, unit) {
  const factors = {MPa:1,kPa:.001,bar:.1};
  if (!Object.hasOwn(factors,unit) || !Number.isFinite(value)) throw new Error('压力单位或数值无效');
  return value*factors[unit];
}
export function validateGeometry(p) {
  for (const [key,[name,unit,min,max]] of Object.entries(fields).slice(0,5)) {
    if (!Number.isFinite(p[key]) || p[key]<min || p[key]>max) throw new Error(`${name}须在 ${min}–${max} ${unit} 范围内`);
  }
  if (!Number.isInteger(p.blades)||!Number.isInteger(p.stages)) throw new Error('叶片数与级数须为整数');
  if (!['impulse','reaction'].includes(p.work)||!['condensing','backpressure'].includes(p.exhaust)) throw new Error('类型预设无效');
  // Blade profile tangential envelope is at most 0.30 chord; leave root clearance.
  if (p.chord*.32>=Math.PI*p.hub/p.blades) throw new Error('无效几何：弦长与叶片数导致叶根周向重叠；减小弦长或叶片数，或增大轮毂直径');
}

export function validate(p) {
  validateGeometry(p);
  for (const [key,[name,unit,min,max]] of Object.entries(fields).slice(5)) {
    if (!Number.isFinite(p[key]) || p[key]<min || p[key]>max) throw new Error(name+'须在 '+min+'–'+max+' '+unit+' 范围内');
  }
  if (p.p2>=p.p1) throw new Error('排汽绝对压力必须低于进汽绝对压力');
}
export function geometry(p) {
  return {area: Math.PI*((p.hub/2+p.height)**2-(p.hub/2)**2)/1e6,
    diameter:p.hub+2*p.height, length:p.stages*(2*p.chord+45)+100,
    totalBlades:2*p.stages*p.blades};
}
export function saturation(p) {
  const T=IF97.r4_P_Tsat(p);
  return {T,liquid:IF97.r1(p,T),vapor:IF97.r2(p,T)};
}
// Invert the forward region-2 equation so endpoint consistency is not limited by
// approximate backward correlations. Saturated mixtures use the lever rule.
export function stateAt(p, value, property) {
  const {T,liquid,vapor}=saturation(p);
  if (value<liquid[property]) throw new Error('出口为压缩液体，超出本实验支持相态');
  if (value<=vapor[property]) {
    const x=(value-liquid[property])/(vapor[property]-liquid[property]);
    return {h:liquid.h+x*(vapor.h-liquid.h),s:liquid.s+x*(vapor.s-liquid.s),T,x,phase:'两相区'};
  }
  if (value>IF97.r2(p,1073.15)[property]) throw new Error('出口状态超出已验证温度范围');
  let lo=T,hi=1073.15;
  for(let i=0;i<65;i++) {const mid=(lo+hi)/2;if(IF97.r2(p,mid)[property]<value)lo=mid;else hi=mid;}
  const result=IF97.r2(p,(lo+hi)/2);
  return {h:result.h,s:result.s,T:(lo+hi)/2,x:null,phase:'过热蒸汽'};
}
export function estimate(p) {
  validate(p);
  const T=p.temperature+273.15;
  if(T<=saturation(p.p1).T+.01) throw new Error('入口须为过热蒸汽：当前温度在饱和线附近或液相区，未支持以干度指定入口');
  const inlet=IF97.r2(p.p1,T),isentropic=stateAt(p.p2,inlet.s,'s');
  const drop=inlet.h-isentropic.h;
  const h2=inlet.h-p.etaT*drop, outlet=stateAt(p.p2,h2,'h');
  const power=p.flow*drop*p.etaT*p.etaM;
  if(!Number.isFinite(power)||power<=0) throw new Error('蒸汽性质计算无效或焓降不为正');
  return {h1:inlet.h,s1:inlet.s,h2s:isentropic.h,h2,drop,power,outlet,geometry:geometry(p)};
}
export function changes(a,b) {return Object.keys(defaults).filter(k=>a[k]!==b[k]);}
export function scan(p,key,start,end,count=5) {
  if(!(key in fields)||!Number.isFinite(start)||!Number.isFinite(end)||!Number.isInteger(count)||count<2||count>21) throw new Error('扫描参数或范围无效');
  return Array.from({length:count},(_,i)=>{
    const value=start+(end-start)*i/(count-1);
    try {return {value,...estimate({...p,[key]:value})};} catch(error) {return {value,error:error.message};}
  });
}
