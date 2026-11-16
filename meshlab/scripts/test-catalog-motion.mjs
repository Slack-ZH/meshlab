import test from 'node:test';
import assert from 'node:assert/strict';
import {models,diagnostics as d} from '../dist/catalog/models-motion.mjs';
import {TAU,rad,mod,dot,cross,sub,length} from '../dist/catalog/models-motion-helpers.mjs';
import {gearOutline} from '../dist/spur/mechanics.mjs';
const defaults=m=>({inputRPM:30,...Object.fromEntries(m.fields.map(f=>[f.key,f.value]))}),by=n=>models.find(m=>m.number===n),close=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`${a} ≈ ${b}`);
function finite(value){if(typeof value==='number')assert.ok(Number.isFinite(value));else if(Array.isArray(value))value.forEach(finite);else if(value&&typeof value==='object')Object.values(value).forEach(finite);}
test('all eleven catalog descriptors, defaults, field boundaries, phases and assembly groups are valid',()=>{
  assert.deepEqual(models.map(m=>m.number),Array.from({length:11},(_,i)=>24+i));
  for(const m of models){assert.ok(m.sources.length>0&&m.limits&&m.principle.length>0);const p=defaults(m),cases=[p];for(const f of m.fields)for(const value of f.options?f.options.map(x=>x[0]):[f.min,f.max])cases.push({...p,[f.key]:value});
    for(const c of cases){m.validate(c);const b=m.build(c);assert.ok(b.parts.length>=3,m.id);const ids=new Set();for(const part of b.parts){assert.ok(!ids.has(part.id));ids.add(part.id);assert.ok(part.shapes.length);finite(part);}
      const groups=[...new Set(b.parts.map(x=>x.assemblyGroup).filter(Boolean))];for(const group of groups)assert.equal(b.parts.filter(x=>x.assemblyGroup===group&&!x.hiddenInList).length,1);
      for(const phase of [0,.31,Math.PI/2,Math.PI,TAU,30]){const s=m.sample(c,phase);finite(s);for(const key of Object.keys(s.poses))assert.ok(ids.has(key),m.id+' pose '+key);}
    }
    for(const f of m.fields)if(!f.options)for(const bad of [NaN,Infinity,f.min-1,f.max+1])assert.throws(()=>m.validate({...p,[f.key]:bad}));
    finite(m.sample({...p,inputRPM:0},0));
  }
});
test('single Cardan trunnions are perpendicular and angular derivative matches speed law',()=>{
  for(const angle of [0,5,25,40])for(let i=0;i<181;i++){
    const phi=i*TAU/181,g=d.cardan(rad(angle),phi),e=1e-6,a=d.cardan(rad(angle),phi-e).out,b=d.cardan(rad(angle),phi+e).out;
    close(dot(g.v1,g.v2),0);close(dot(g.a,g.v2),0);close(length(g.v1),1);close(length(g.v2),1);close(Math.atan2(Math.sin(b-a),Math.cos(b-a))/(2*e),g.ratio,1e-6);
    assert.ok(g.ratio>=Math.cos(rad(angle))-1e-8&&g.ratio<=1/Math.cos(rad(angle))+1e-8);
  }
});
test('double Cardan correct phasing cancels unequal instantaneous intermediate speeds',()=>{
  const m=by(25),p=defaults(m);for(const angle of [0,10,25,40])for(let i=0;i<97;i++){
    const q={...p,angle1:angle,angle2:angle,phaseError:0},s=m.sample(q,i*TAU/97),g=d.doubleState(q,i*TAU/97);close(s.metrics[2].value,1,1e-6);close(dot(g.vm,g.vo),0);close(dot(g.vm,g.g.a),0);close(dot(g.vo,g.aout),0);
  }
  const ratios=Array.from({length:97},(_,i)=>m.sample({...p,phaseError:35},i*TAU/97).metrics[2].value);assert.ok(Math.max(...ratios)-Math.min(...ratios)>.1);
});
test('conveyor integer chain loop, carrying/return routes, dual-chain slats and tension contact agree',()=>{
  const m=by(26);for(const teeth of [12,16,24])for(const straightLinks of [12,24]){
    const p={...defaults(m),teeth,straightLinks},g=d.conveyorGeometry(p);close(g.path.length,g.N*25);assert.equal(g.N%2,0);
    const top=g.path.sections.find(x=>x.type==='line'&&x.index===0),bottom=g.path.sections.find(x=>x.type==='line'&&x.index===1);close(top.a[1],g.R);close(bottom.a[1],-g.R);close(top.length,g.Centre);close(bottom.length,g.Centre);
    const b=m.build(p),takeup=b.parts.find(x=>x.id==='takeup');close(takeup.position[1]+18,-g.R);
    for(const phase of [0,.4,2]){const s=m.sample(p,phase);close(s.poses.drive.rotation[2],s.poses.idler.rotation[2]);const first=s.poses.link0,last=m.sample(p,phase-TAU*g.N/p.teeth).poses.link0;close(length(sub(first.position,last.position)),0,1e-7);for(let i=0;i<4;i++){const cargo=s.poses['load'+i],slat=s.poses['link'+2*Math.floor(i*g.N/8)];if(cargo.scale[0]){close(cargo.position[0],slat.position[0]);close(cargo.position[1]-slat.position[1],8.5);}}}
  }
});
test('ball screw lead, spherical groove clearance, closed circulation and travel limit are consistent',()=>{
  const m=by(27);for(const lead of [4,6,10])for(const ballDiameter of [2.5,4]){
    const p={...defaults(m),lead,ballDiameter},g=d.ballGeometry(p);const a=m.sample(p,0),b=m.sample(p,TAU);close(a.poses.nut.position[0]-b.poses.nut.position[0],lead);
    for(let i=0;i<50;i++){const t=i*TAU/25,x=-lead+lead*t/TAU;const inner=d.ballGroove(p,g,x,t,true),outer=d.ballGroove(p,g,x,t,false);assert.ok(inner>g.rc+g.br);assert.ok(outer<g.rc-g.br);}
    close(length(sub(g.path.sample(.000001).position,g.path.sample(g.path.length+.000001).position)),0,1e-7);
    const end=m.sample(p,1e5);close(end.poses.nut.position[0],-p.stroke/2);assert.equal(end.metrics[2].value,0);
  }
});
test('friction plate contact spacing, disengagement and specified-slip speed are separate from capacity',()=>{
  const m=by(28),p=defaults(m),s=m.sample(p,2);close(s.poses.disc.position[2]-2,-12);close(s.poses.disc.position[2]+2,s.poses.pressure.position[2]-4);close(s.poses.disc.rotation[2],s.poses.flywheel.rotation[2]);
  const open=m.sample({...p,mode:'open'},2);assert.equal(open.poses.disc.rotation[2],0);assert.equal(open.metrics[1].value,0);assert.ok(open.poses.pressure.position[2]-4>open.poses.disc.position[2]+2);
  const slip=m.sample({...p,mode:'slipping',slip:30},2);close(slip.poses.disc.rotation[2],1.4);close(m.sample({...p,normalForce:2000},0).metrics[1].value,2*s.metrics[1].value);
  const b=m.build(p),bearing=b.parts.find(x=>x.id==='release').shapes.find(x=>x.kind==='ring'),fingers=b.parts.find(x=>x.id==='pressure').shapes.filter(x=>x.kind==='rod');assert.equal(fingers.length,6);for(const state of [s,open])for(const finger of fingers){close(finger.to[2]+state.poses.pressure.position[2],bearing.position[2]-bearing.length/2+state.poses.release.position[2]);assert.ok(Math.hypot(...finger.to.slice(0,2))>bearing.inner&&Math.hypot(...finger.to.slice(0,2))<bearing.outer);}
});
function segmentDistance(a,b,p){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(a[0]+t*dx-p[0],a[1]+t*dy-p[1]);}
test('roller clutch actual cam polygon clears each roller in locked and released positions',()=>{
  const m=by(29);for(const rollers of [6,8,12])for(const rollerRadius of [4,6])for(const mode of ['lock','overrun']){
    const p={...defaults(m),rollers,rollerRadius,mode},profile=d.rollerCamOutline(p),s=m.sample(p,0);for(let i=0;i<rollers;i++){const c=s.poses['roller'+i].position;for(let j=0;j<profile.length;j++)assert.ok(segmentDistance(profile[j],profile[(j+1)%profile.length],c)>=rollerRadius-1e-6);close(Math.hypot(c[0],c[1])+rollerRadius,42);}
    const moving=m.sample(p,1);if(mode==='lock')close(moving.poses.cam.rotation[2],moving.poses.outer.rotation[2]);else assert.ok(moving.poses.outer.rotation[2]>moving.poses.cam.rotation[2]);
  }
});
test('centrifugal shoes obey spring threshold and stay inside drum at every rotation',()=>{
  const m=by(30),p=defaults(m),threshold=d.centrifugalState(p).threshold;assert.equal(d.centrifugalState({...p,inputRPM:0}).displacement,0);assert.equal(d.centrifugalState({...p,inputRPM:threshold*.99}).contact,false);assert.equal(d.centrifugalState({...p,inputRPM:threshold*1.01}).contact,true);
  for(const inputRPM of [0,500,1200,3000]){const q={...p,inputRPM},state=d.centrifugalState(q),b=m.build(q);for(const s of b.parts.find(x=>x.id==='shoe0').shapes)for(const point of s.points)assert.ok(Math.hypot(point[0]+state.displacement*1000,point[1])<=42+1e-9);if(state.displacement>0&&state.displacement<.005)close(p.shoeMass*state.omega**2*(.027+state.displacement),p.preload+p.springK*1000*state.displacement);}
});
test('Oldham intermediate center lies on both perpendicular sliding constraints',()=>{
  const m=by(31);for(const offset of [0,10,18])for(let i=0;i<101;i++){
    const phi=i*TAU/101,p={...defaults(m),offset},s=m.sample(p,phi),c=s.poses.disc.position,a=s.poses.input.position,b=s.poses.output.position,u=[Math.cos(phi),Math.sin(phi),0],v=[-Math.sin(phi),Math.cos(phi),0];close(dot(sub(c,a),v),0);close(dot(sub(c,b),u),0);close(length(c),offset/2);close(s.poses.output.rotation[2]-s.poses.input.rotation[2],Math.PI/2);
  }
});
test('five rear gears preserve one even link count and cage length while changing ratio and lateral alignment',()=>{
  const m=by(32);for(const frontTeeth of [34,42,48])for(const centerDistance of [320,420])for(const cageLength of [90,120]){
    const counts=[];for(let gear=1;gear<=5;gear++){const p={...defaults(m),frontTeeth,centerDistance,cageLength,gear},g=d.derailleurGeometry(p),s=m.sample(p,.7);counts.push(g.N);assert.equal(g.N%2,0);close(g.path.length,g.N*12.7);close(length(sub(g.guide,g.tension)),cageLength);close(g.guide[2],g.rear[2]);close(g.tension[2],g.rear[2]);close(s.metrics[1].value,p.inputRPM*frontTeeth/[14,17,20,23,26][gear-1]);
      for(const section of g.path.sections){const a=g.path.sample(section.start+1e-5),b=g.path.sample(section.start-1e-5);assert.ok(length(sub(a.position,b.position))<3e-5,'continuous chain path');}
    }assert.ok(counts.every(n=>n===counts[0]));
  }
});
test('one wiper motor closes both linkage loops and blade phase is a fixed mounting offset',()=>{
  const m=by(33);for(const crankRadius of [12,20,24])for(const rockerLength of [40,60])for(let i=0;i<121;i++){
    const p={...defaults(m),crankRadius,rockerLength,mountOffset:15},g=d.wiperState(p,i*TAU/121),s=m.sample(p,i*TAU/121);close(length(sub(g.P,g.O)),crankRadius);close(length(sub(g.B,g.P)),95);close(length(sub(g.B,g.A)),rockerLength);close(length(sub(g.B2,g.A2)),rockerLength);close(length(sub(g.B2,g.B)),210);close(s.poses.blade1.rotation[2]-s.poses.blade0.rotation[2],rad(15));
  }
});
function orient(a,b,c){return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
function segmentsCross(a,b,c,e){if(Math.max(a[0],b[0])<Math.min(c[0],e[0])||Math.max(c[0],e[0])<Math.min(a[0],b[0])||Math.max(a[1],b[1])<Math.min(c[1],e[1])||Math.max(c[1],e[1])<Math.min(a[1],b[1]))return false;return orient(a,b,c)*orient(a,b,e)<-1e-9&&orient(c,e,a)*orient(c,e,b)<-1e-9;}
test('steering tie rods retain length, inner wheel turns further, and production rack/involute outlines do not cross',()=>{
  const m=by(34);for(const direction of [-1,1])for(const pinionTeeth of [18,23,24]){
    const p={...defaults(m),direction,pinionTeeth},base=d.steeringState(p,0),count=Math.ceil((p.trackWidth-130+2*p.stroke)/(Math.PI*p.module)),rack=d.rackPoints(p.module,count),gear=gearOutline(pinionTeeth,p.module);
    for(let i=0;i<21;i++){
      const phi=i*.08,g=d.steeringState(p,phi),s=m.sample(p,phi),angle=s.poses.pinion.rotation[2],co=Math.cos(angle),si=Math.sin(angle),gp=gear.map(([x,y])=>[x*co-y*si,x*si+y*co+g.R]),rp=rack.map(([x,y])=>[x+g.travel,y]);
      g.data.forEach((v,j)=>{close(length(sub(v.A,v.B)),base.data[j].tie);close(length(sub(v.A,v.K)),60);});close(g.travel,g.R*g.pinionAngle);const inner=direction===1?0:1,outer=1-inner;assert.ok(Math.abs(g.data[inner].angle)>=Math.abs(g.data[outer].angle)-1e-9);
      for(let a=0;a<gp.length;a++){if(Math.min(gp[a][1],gp[(a+1)%gp.length][1])>p.module+.01)continue;for(let b=0;b<rp.length;b++)assert.equal(segmentsCross(gp[a],gp[(a+1)%gp.length],rp[b],rp[(b+1)%rp.length]),false,`rack tooth clash ${pinionTeeth} phase ${phi}`);}
    }
  }
});
