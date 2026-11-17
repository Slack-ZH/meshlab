export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
export const wrap = (value, length) => ((value % length) + length) % length;

// Close the old projection completely before either moving or igniting the new one.
export function sequence(seconds, {replay = false, initial = false, reduced = false} = {}) {
  const t = Math.max(0, seconds);
  if (reduced) {
    if (t < .12 && !initial) return {phase:'closing', reveal:1 - t / .12, power:0, travel:0, newModel:false, done:false};
    if (t < .24) return {phase:'forming', reveal:clamp((t - .12) / .12), power:.32, travel:1, newModel:true, done:false};
    return {phase:'ready', reveal:1, power:.32, travel:1, newModel:true, done:true};
  }
  let cursor = 0;
  if (!initial) {
    if (t < .62) { const p = ease(t / .62); return {phase:'closing', reveal:1-p, power:(1-p)*.75, travel:0, newModel:false, done:false}; }
    cursor = .62;
    if (!replay) {
      if (t < cursor + .72) return {phase:'moving', reveal:0, power:0, travel:ease((t-cursor)/.72), newModel:true, done:false};
      cursor += .72;
    }
  }
  if (t < cursor + .3) return {phase:'igniting', reveal:0, power:ease((t-cursor)/.3), travel:1, newModel:true, done:false};
  cursor += .3;
  if (t < cursor + 1.12) return {phase:'forming', reveal:ease((t-cursor)/1.12), power:1, travel:1, newModel:true, done:false};
  cursor += 1.12;
  if (t < cursor + .42) return {phase:'settling', reveal:1, power:1-.68*ease((t-cursor)/.42), travel:1, newModel:true, done:false};
  return {phase:'ready', reveal:1, power:.32, travel:1, newModel:true, done:true};
}
