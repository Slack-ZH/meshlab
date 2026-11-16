// Illustrative cascade geometry. These are purpose-built teaching profiles,
// not a vendor airfoil, a NACA profile, or a standards-certified design.
export const MAX_ENVELOPE_RATIO = 0.30;
const sectionCount = 9, samples = 32;

function section(work, moving, span) {
  const impulseRotor = work === 'impulse' && moving;
  const perimeter = [];
  const twist = work === 'reaction' ? span * 4 * Math.PI / 180 : 0;
  const taper = work === 'reaction' ? 1 - .08 * span : 1;
  for (const side of [1,-1]) for (let i=0;i<=samples;i++) {
    const t = side === 1 ? i/samples : 1-i/samples;
    const x = t-.5;
    const sine = t===0 || t===1 ? 0 : Math.sin(Math.PI*t);
    // Impulse rotor: equal inlet/outlet camber slopes and symmetric thickness.
    // Nozzle/reaction sections: asymmetric camber and a rounded nose/thin tail.
    const camber = impulseRotor ? .20 * sine - .10
      : .18*(t-.5) + .075*sine*(1+.3*(2*t-1));
    const thickness = impulseRotor ? .040*Math.sqrt(sine)+.004
      : .052*Math.pow(sine,.6)*(1-.3*t)+.004;
    const y = (camber+side*thickness)*(moving ? -1 : 1);
    perimeter.push([(x*Math.cos(twist)-y*Math.sin(twist))*taper,
      (x*Math.sin(twist)+y*Math.cos(twist))*taper]);
  }
  return perimeter;
}

// One fixed scale for each profile family; never shrink blades in response to
// blade count. The input remains the axial root chord, and invalid inputs stay
// invalid. The 0.30 envelope fits the existing 0.32-chord validation allowance.
const profileCache = new Map();
function profiles(work, moving) {
  const key = work+':'+moving;
  if (profileCache.has(key)) return profileCache.get(key);
  const sections = Array.from({length:sectionCount},(_,i)=>section(work,moving,i/(sectionCount-1)));
  const tangents = sections.flat().map(p=>p[1]);
  const min = Math.min(...tangents), max = Math.max(...tangents);
  const scale = Math.min(1,MAX_ENVELOPE_RATIO/(max-min));
  for (const points of sections) for (const point of points) point[1]=(point[1]-(max+min)/2)*scale;
  profileCache.set(key,sections);
  return sections;
}

export function bladeLayout(p) {
  const hub = p.hub/2;
  const stages = Array.from({length:p.stages},(_,index)=>{
    const fraction = p.stages===1 ? 1 : index/(p.stages-1);
    // Deliberately exposed visual preset. No stage thermodynamic solver exists.
    const firstRatio = p.exhaust==='condensing' ? .68 : .82;
    const height = p.height*(firstRatio+(1-firstRatio)*fraction);
    const rootPitch = 2*Math.PI*hub/p.blades;
    return {
      stage:index+1, height, chord:p.chord, tipDiameter:2*(hub+height),
      statorProfile:'非对称导流翼型',
      rotorProfile:p.work==='impulse' ? '对称冲动叶型' : '非对称反动翼型',
      rootPitch, minimumGap:rootPitch-MAX_ENVELOPE_RATIO*p.chord,
      spanTwistDeg:p.work==='reaction' ? 4 : 0,
      area:Math.PI*((hub+height)**2-hub**2)/1e6,
    };
  });
  return {basis:'illustrative',stages,maxEnvelopeRatio:MAX_ENVELOPE_RATIO,
    note:'叶型与逐级增长为教学几何预设；间隙是周向包络下界，不是气动喉口。未作速度三角形、CFD、强度或标准符合性认证。'};
}

export function bladeMeshData(p, stage, moving) {
  const hub=p.hub/2, sections=profiles(p.work,moving), positions=[], indices=[];
  const width=sections[0].length;
  for (let row=0;row<sections.length;row++) {
    const r=hub+stage.height*row/(sections.length-1);
    for(const [axial,tangential] of sections[row]) {
      const angle=tangential*p.chord/r;
      // Cylindrical wrapping gives exact hub/tip radii instead of flat caps
      // protruding into the casing at large chord / short blade settings.
      positions.push(axial*p.chord,r*Math.cos(angle)-hub,r*Math.sin(angle));
    }
  }
  for(let row=0;row<sections.length-1;row++)for(let col=0;col<width;col++) {
    const a=row*width+col,b=row*width+(col+1)%width,c=a+width,d=b+width;
    indices.push(...(moving ? [a,c,b,b,c,d] : [a,b,c,b,d,c]));
  }
  return {positions,indices,width,sectionCount:sections.length,
    capProfiles:[sections[0],sections.at(-1)]};
}
