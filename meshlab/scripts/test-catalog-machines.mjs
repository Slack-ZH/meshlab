import test from 'node:test';
import assert from 'node:assert/strict';
import {models} from '../dist/catalog/models-machines.mjs';
import {TAU,rad,rot,flatCam,valveLift,conjugateLift,cvtGeometry,beltPath,openBeltLength,synchronizerState,cvBall,indexProfile,indexState,cycloidGeometry,ellipseRadius} from '../dist/catalog/models-machines-geometry.mjs';

const defaults=m=>Object.fromEntries([['inputRPM',30],...m.fields.map(f=>[f.key,f.value])]);
const get=id=>models.find(m=>m.id===id);
const close=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<tol,`${a} differs from ${b}`);
const metric=(result,label)=>result.metrics.find(m=>m.label===label)?.value;
function finite(value,path='root'){if(typeof value==='number')assert.ok(Number.isFinite(value),path+' is not finite');else if(value&&typeof value==='object')for(const [k,v] of Object.entries(value))finite(v,path+'.'+k);}
function checkModel(m,p){m.validate(p);const spec=m.build(p);finite(spec);assert.ok(spec.parts.length>1);const ids=new Set(spec.parts.map(p=>p.id));assert.equal(ids.size,spec.parts.length);for(const part of spec.parts){assert.ok(part.name&&part.description&&part.shapes.length);if(part.hiddenInList)assert.ok(spec.parts.some(x=>x.assemblyGroup===part.assemblyGroup&&!x.hiddenInList));for(const shape of part.shapes){if(shape.kind==='mesh'){assert.equal(shape.vertices.length%3,0);assert.equal(shape.indices.length%3,0);assert.ok(shape.indices.every(i=>Number.isInteger(i)&&i>=0&&i<shape.vertices.length/3));}if(shape.kind==='ring')assert.ok(shape.outer>shape.inner&&shape.inner>0);if(shape.kind==='tube')assert.ok(shape.points.length>2&&shape.radius>0);}}
 for(const phase of [0,.37,1.6,Math.PI,TAU,TAU*3+.72,100]){const state=m.sample(p,phase);finite(state);assert.ok(state.status&&state.metrics.length>=3);for(const id of Object.keys(state.poses))assert.ok(ids.has(id),m.id+' unknown pose '+id);}
}

test('machines registry matches 12 unclaimed checklist numbers and has primary references',()=>{assert.deepEqual(models.map(m=>m.number),[36,37,39,40,41,42,43,44,45,46,47,48]);assert.equal(new Set(models.map(m=>m.id)).size,12);for(const m of models){assert.ok(m.sources.length&&m.sources.every(s=>s.url.startsWith('https://')));assert.ok(m.principle.length&&m.limits&&m.questions.length>=3);}});
for(const m of models)test(`${m.number} ${m.id}: defaults, each option, numeric boundaries, deterministic phases and invalid inputs`,()=>{
 const p=defaults(m);checkModel(m,p);assert.deepEqual(m.sample(p,2.3),m.sample(p,2.3));
 for(const f of m.fields){for(const value of f.options?f.options.map(o=>o[0]):[f.min,f.max])checkModel(m,{...p,[f.key]:value});assert.throws(()=>m.validate({...p,[f.key]:f.options?'invalid':NaN}));}
 checkModel(m,{...p,inputRPM:0});checkModel(m,{...p,inputRPM:120});assert.throws(()=>m.validate({...p,inputRPM:-1}));
});

test('four-stroke valve timing closes compression/power and repeats every two crank turns',()=>{
 const m=get('valvetrain'),p=defaults(m);for(const lift of [4,6,8]){close(valveLift(-Math.PI/4,lift).s,lift);close(valveLift(-7*Math.PI/4,lift,true).s,lift);for(const q of [1.25,1.75,2.25,2.75]){close(valveLift(-q*Math.PI/2,lift).s,0);close(valveLift(-q*Math.PI/2,lift,true).s,0);}for(const t of [.1,1.4,4.1])close(valveLift(t,lift).s,valveLift(t+TAU,lift).s);}
 close(metric(m.sample(p,1),'凸轮轴转速'),-15);
 for(const exhaust of [false,true]){const points=flatCam(t=>valveLift(t,8,exhaust),70,-1);for(let j=0;j<60;j++){const a=TAU*j/60,s=valveLift(a,8,exhaust).s,min=Math.min(...points.map(q=>rot(...q,a)[1]));close(min,-70-s,.003);}}
});

test('all fixed-member planetary modes satisfy Willis and orbit/self-spin independently',()=>{
 const m=get('planetary');for(const zs of [18,24,36])for(const zp of [18,24,30])for(const fixed of ['ring','sun','carrier']){const p={...defaults(m),sunTeeth:zs,planetTeeth:zp,fixed};for(const t of [.3,2,10]){const s=m.sample(p,t),ps=s.poses;close(metric(s,'Willis 约束残差'),0);close(ps[fixed].rotation[2],0);for(let k=0;k<3;k++)close(Math.hypot(...ps['planet-'+k].position.slice(0,2)),1.6*(zs+zp)/2);}}
 const hub=get('three-speed-hub');for(const [g,r] of [['1',.75],['2',1],['3',4/3]]){const s=hub.sample({...defaults(hub),selectedGear:g},3);close(s.poses['hub-shell'].rotation[2],3*r);close(s.poses.sun.rotation[2],0);}
});

test('manual gearbox constant center distance and neutral decoupling',()=>{
 const m=get('manual-gearbox'),p=defaults(m);for(const selectedGear of ['N','1','2','3','4']){const q={...p,selectedGear},s=m.sample(q,2),b=m.build(q),input=b.parts.find(p=>p.id==='input'),out=b.parts.find(p=>p.id==='output');close(out.position[0]-input.position[0],30*q.module);for(let k=0;k<4;k++){const a=b.parts.find(p=>p.id==='input-'+k).shapes[0],c=b.parts.find(p=>p.id==='loose-'+k).shapes[0];assert.equal(a.teeth+c.teeth,60);close(s.poses['loose-'+k].rotation[2]-(Math.PI-Math.PI/c.teeth),-2*a.teeth/c.teeth);}if(selectedGear==='N'){close(s.poses.output.rotation[2],0);assert.notEqual(s.poses['loose-0'].rotation[2],0);}}
});

test('synchronizer phase integral matches displayed speed; sleeve locks only after equal speed',()=>{
 const m=get('synchronizer');for(const initialRatio of [.2,.4,.8])for(const shiftTurns of [1,2,4]){const p={...defaults(m),initialRatio,shiftTurns},D=shiftTurns*TAU;for(const u of [.05,.3,.45,.59,.7,1,2]){const t=u*D,s=synchronizerState(p,t),h=1e-5,derivative=(synchronizerState(p,t+h).outputAngle-synchronizerState(p,t-h).outputAngle)/(2*h);close(derivative,s.ratio,1e-7);if(s.sleeve<-5)close(s.ratio,1);}
 const end=synchronizerState(p,2*D);close(end.sleeve,-23);close(end.ratio,1);close(synchronizerState(p,3*D).outputAngle-end.outputAngle,D);const dog=m.build(p).parts.find(p=>p.id==='free-gear').shapes[1];close(2*D+dog.rotation[2],end.outputAngle);}
});

test('CVT conserves belt length, closed path and both contact surface speeds',()=>{
 const m=get('cvt');for(const driveRadius of [25,32,40,49,55])for(const centerDistance of [160,180,220]){const p={...defaults(m),driveRadius,centerDistance},g=cvtGeometry(p),path=beltPath(g.r1,g.r2,g.C);close(openBeltLength(g.r1,g.r2,g.C),g.L);close(path.length,g.L);assert.ok(g.r2>17&&g.r2<65);close(g.r1,g.ratio*g.r2);const a=path.at(0),b=path.at(g.L);close(a.x,b.x);close(a.y,b.y);for(let j=0;j<200;j++){const a=path.at(path.length*j/200),b=path.at(path.length*j/200+.001);close(Math.hypot(b.x-a.x,b.y-a.y),.001,1e-7);}const before=m.sample(p,0).poses['element-0'].position,after=m.sample(p,.5).poses['element-0'].position;assert.notDeepEqual(before,after);}
});

test('six Rzeppa balls satisfy outer groove, inner groove and bisector constraints through 40 degrees',()=>{
 for(const deg of [0,10,25,40]){const beta=rad(deg);for(let j=0;j<60;j++)for(let k=0;k<6;k++){const phase=j*TAU/60,alpha=phase+k*TAU/6,[x,y,z]=cvBall(beta,phase,k);close(Math.hypot(x,y,z),32);close(Math.sin(beta/2)*x+Math.cos(beta/2)*z,0);close(-Math.sin(alpha)*x+Math.cos(alpha)*y,0);const ix=Math.cos(beta)*x-Math.sin(beta)*z;close(-Math.sin(alpha)*ix+Math.cos(alpha)*y,0);}}
 const m=get('rzeppa-joint'),p=defaults(m);close(metric(m.sample(p,2),'输出 / 输入转速'),1);
});

test('complementary cams actually support both faces of the same rigid follower',()=>{
 for(const A of [6,12,16]){const law=t=>conjugateLift(t,A),upper=flatCam(law,42,1),lower=flatCam(t=>{const l=law(t);return {s:-l.s,ds:-l.ds};},42,-1);assert.notDeepEqual(upper,lower);for(let j=0;j<80;j++){const t=TAU*j/80,l=law(t),max=Math.max(...upper.map(q=>rot(...q,t)[1])),min=Math.min(...lower.map(q=>rot(...q,t)[1]));close(max,42+l.s,.003);close(min,-42+l.s,.003);close(max-min,84,.006);}}
});

test('indexing cam envelope contacts the rollers without overlap and locks during dwell',()=>{
 for(const stops of [4,6,8])for(const moveDegrees of [210,230,250]){const g=indexProfile(stops,moveDegrees);for(let j=0;j<64;j++){const t=TAU*j/64,s=indexState(stops,moveDegrees,t),points=g.points.map(q=>rot(...q,t));let contact=Infinity;for(let k=0;k<stops;k++){const a=Math.PI+s.angle+TAU*k/stops,c=[g.C+g.R*Math.cos(a),g.R*Math.sin(a)];const d=Math.min(...points.map(q=>Math.hypot(q[0]-c[0],q[1]-c[1])));assert.ok(d>=g.roller-.002,`roller penetration ${d}`);contact=Math.min(contact,d);}assert.ok(contact<g.roller+.008,`lost cam contact ${contact}`);if(t>rad(moveDegrees))close(s.derivative,0);}
 close(indexState(stops,moveDegrees,TAU+1).angle-indexState(stops,moveDegrees,1).angle,TAU/stops);}
});

test('cycloidal roller envelope and eccentric/output pin compensation hold at boundaries',()=>{
 for(const pinCount of [9,13,25])for(const ringRadius of [45,70])for(const pinRadius of [2,3.5]){const p={pinCount,ringRadius,pinRadius},g=cycloidGeometry(p);for(let j=0;j<12;j++){const t=TAU*j/12,spin=-t/(pinCount-1),points=g.points.map(q=>{const r=rot(...q,spin);return [r[0]+g.e*Math.cos(t),r[1]+g.e*Math.sin(t)];});let contact=Infinity;for(let k=0;k<pinCount;k++){const c=[g.R*Math.cos(TAU*k/pinCount),g.R*Math.sin(TAU*k/pinCount)],d=Math.min(...points.map(q=>Math.hypot(q[0]-c[0],q[1]-c[1])));assert.ok(d>=pinRadius-.002);contact=Math.min(contact,d);}assert.ok(contact<pinRadius+.006);for(let k=0;k<6;k++){const q=rot(g.outputCircle*Math.cos(TAU*k/6),g.outputCircle*Math.sin(TAU*k/6),spin);close(Math.hypot(q[0]+g.e*Math.cos(t)-q[0],q[1]+g.e*Math.sin(t)-q[1]),g.e);}}}
});

test('harmonic material teeth move slowly while deformation lobes follow input',()=>{
 const m=get('harmonic');for(const flexTeeth of [40,60,80]){const p={...defaults(m),flexTeeth},R=flexTeeth/2,s=m.sample(p,TAU);close(s.poses.output.rotation[2],-2*TAU/flexTeeth);close(s.poses.wave.rotation[2],TAU);for(const t of [0,.7,2.1]){const state=m.sample(p,t);for(let k=0;k<flexTeeth;k++){const a=TAU*k/flexTeeth-2*t/flexTeeth,q=state.poses['flex-tooth-'+k].position;close(Math.hypot(q[0],q[1]),ellipseRadius(a-t,R+1,R-1));}}}
});

test('ordinary/enveloping worm geometry differs while starts/teeth keep the same ratio',()=>{
 const m=get('enveloping-worm'),p=defaults(m),ordinary=m.build({...p,wormType:'cylindrical'}),enveloping=m.build(p);assert.notDeepEqual(ordinary.parts[0].shapes[0].vertices,enveloping.parts[0].shapes[0].vertices);assert.equal(m.build({...p,contactOverlay:'off'}).parts.some(p=>p.id==='contact-guide'),false);for(const starts of [1,2,4])for(const wheelTeeth of [24,40,60])for(const wormType of ['cylindrical','enveloping']){const q={...p,starts,wheelTeeth,wormType};close(m.sample(q,TAU).poses.wheel.rotation[2],TAU*starts/wheelTeeth);}assert.match(m.limits,/TCA/);assert.match(m.limits,/人为选作教学/);
});
