export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
export const wrap = (value, length) => ((value % length) + length) % length;

export const timing = Object.freeze({closing:.78, blackout:.12, igniting:.44, launching:.40, forming:1.32, settling:.56});
export function duration({initial=false,reduced=false}={}) {
  return reduced ? (initial?.16:.32) : (initial?0:timing.closing+timing.blackout)+timing.igniting+timing.launching+timing.forming+timing.settling;
}

// One fixed emitter. Light travels first; contours lead the material, then relax.
// Both changing mechanisms and replaying use the same complete shutdown/startup.
export function sequence(seconds, {initial=false,reduced=false}={}) {
  let t = Math.max(0, seconds);
  const sample=(phase, values={})=>({phase,reveal:0,power:0,lift:0,contour:0,discharge:0,travel:1,newModel:true,done:false,...values});
  if (reduced) {
    if(!initial){
      if(t<.16)return sample('closing',{reveal:1-ease(t/.16),newModel:false,travel:0});
      t-=.16;
    }
    if(t<.16)return sample('forming',{reveal:ease(t/.16),power:.32});
    return sample('ready',{reveal:1,power:.32,done:true});
  }
  if(!initial){
    if(t<timing.closing){
      const p=t/timing.closing;
      return sample('closing',{reveal:1-ease(p),power:.32*(1-ease(p))+.3*Math.sin(Math.PI*p),lift:1,contour:Math.sin(Math.PI*p),discharge:ease(p),newModel:false,travel:0});
    }
    t-=timing.closing;
    if(t<timing.blackout)return sample('blackout');
    t-=timing.blackout;
  }
  if(t<timing.igniting)return sample('igniting',{power:.88*ease(t/timing.igniting)});
  t-=timing.igniting;
  if(t<timing.launching){const p=ease(t/timing.launching);return sample('launching',{power:.88+.12*p,lift:p});}
  t-=timing.launching;
  if(t<timing.forming){const p=ease(t/timing.forming);return sample('forming',{reveal:p,power:1,lift:1,contour:1-ease((p-.82)/.18)});}
  t-=timing.forming;
  if(t<timing.settling)return sample('settling',{reveal:1,power:1-.68*ease(t/timing.settling),lift:1});
  return sample('ready',{reveal:1,power:.32,lift:1,done:true});
}
