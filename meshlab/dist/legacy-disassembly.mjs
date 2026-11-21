// Progress is a reversible sequence, not simultaneous interpolation to a layout.
export const phase=(p,start,end=start+1)=>Math.max(0,Math.min(1,(p-start)/(end-start)));
export function axialPlan(items,{gap=55,stages=4}={}){
  const maxZ=Math.max(...items.map(p=>p.max[2]));
  const height=s=>Math.max(0,...items.filter(p=>p.id===s||p.id.endsWith('-'+s)).map(p=>p.max[2]-p.min[2]));
  const wheel=items.some(p=>p.id.endsWith('-wheel'))?'wheel':items.some(p=>p.id.endsWith('-gear'))?'gear':'pulley';
  const levels={shaft:maxZ+gap};levels[wheel]=levels.shaft+height('shaft')+gap;
  levels.belt=levels[wheel]+height(wheel)+gap;levels.flange=levels.belt+height('belt')+gap;levels.collar=levels.flange+height('flange')+gap;
  return Object.fromEntries(items.map(p=>{
    const role=p.id==='belt'?'belt':p.id.split('-').at(-1),step=role==='collar'||role==='flange'?1:role==='belt'?2:role===wheel?(stages===5?3:2):role==='shaft'?(stages===5?4:3):stages;
    return [p.id,{role,step,stages,final:[p.spread||0,0,role==='support'?-gap:levels[role]-p.min[2]]}];
  }));
}
export function axialPose(plan,progress){
  const z=phase(progress,plan.step-1,plan.role==='support'?plan.stages-.45:plan.step);
  return [plan.final[0]*phase(progress,plan.stages-.4,plan.stages),0,plan.final[2]*z];
}
export function gearOffset(id,position,p){
  if(id.startsWith('nut_'))return [0,-400*phase(p,0),0];
  if(id.startsWith('bolt_'))return [0,1000*phase(p,1),0];
  if(['housing_top','inspection','breather'].includes(id))return [0,600*phase(p,2),0];
  if(id.startsWith('cap_')||id.startsWith('seal_'))return [0,0,Math.sign(position[2])*500*phase(p,3)];
  if(id==='housing_base')return [0,-200*phase(p,6),0];
  return [(position[0]<-50?-200:position[0]>50?200:0)*phase(p,5),250*phase(p,4),0];
}
