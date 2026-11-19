export const teeth = Object.freeze({ sun: 18, planet: 18, ring: 54, planets: 3 });
export const defaults = Object.freeze({ motorRpm: 6000 });
export const animationScale = 1 / 240;
export const modes = Object.freeze({ low: '低挡', high: '高挡' });

export function transmission(motorRpm = defaults.motorRpm, mode = 'low') {
  if (!Number.isFinite(motorRpm) || motorRpm < 0) throw new RangeError('电机转速须为非负数');
  if (!Object.hasOwn(modes, mode)) throw new RangeError('未知挡位');
  const stageRatio = 1 + teeth.ring / teeth.sun;
  const c1 = motorRpm / stageRatio, c2 = mode === 'low' ? c1 / stageRatio : c1;
  return { sun1: motorRpm, ring1: 0, carrier1: c1, planet1: -(motorRpm-c1)*teeth.sun/teeth.planet,
    sun2: c1, ring2: mode === 'low' ? 0 : c2, carrier2: c2, planet2: -(c1-c2)*teeth.sun/teeth.planet || 0,
    output: c2, ratio: mode === 'low' ? stageRatio*stageRatio : stageRatio,
    lowOutput: motorRpm/stageRatio**2, highOutput: c1,
    stage1Ratio: stageRatio, stage2Ratio: mode === 'low' ? stageRatio : 1 };
}
export const angleKeys = Object.freeze(['sun1','ring1','carrier1','planet1','sun2','ring2','carrier2','planet2','output']);
export function initialAngles(){ return Object.fromEntries(angleKeys.map(key=>[key,0])); }
export function advanceAngles(angles, speeds, seconds) {
  if(!Number.isFinite(seconds)||seconds<0)throw new RangeError('时间须非负');
  return Object.fromEntries(angleKeys.map(key=>[key,angles[key]+speeds[key]*seconds*Math.PI/30]));
}
export function powerPath(motorRpm,mode) {
  const n=transmission(motorRpm,mode);
  return [
    {part:'sun1',title:'电机 / 一级太阳轮',speed:n.sun1,note:'电机轴直接驱动一级太阳轮。'},
    {part:'carrier1',title:'一级行星架',speed:n.carrier1,note:'一级齿圈固定，行星轮滚动并带动行星架，完成 4 : 1 减速。'},
    {part:'sun2',title:'二级太阳轮',speed:n.sun2,note:'与一级行星架刚性相连，承接第一级输出。'},
    {part:'carrier2',title:mode==='low'?'二级行星架':'二级整体直联',speed:n.carrier2,note:mode==='low'?'二级齿圈锁在机壳上，再减速 4 : 1。行星轮有相对自转。':'二级齿圈锁接行星架，太阳轮、齿圈与行星架等速；行星轮相对行星架不自转。'},
    {part:'output',title:'输出轴 / 夹头',speed:n.output,note:mode==='low'?'总减速比 16 : 1，输出转速为输入的 1/16。':'总减速比 4 : 1，输出转速为输入的 1/4。'}
  ];
}
