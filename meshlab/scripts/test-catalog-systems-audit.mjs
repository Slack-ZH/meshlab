import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/assets/three.module.js';
import {models} from '../dist/catalog/models-systems.mjs';
import {cncState,clockState,wristState} from '../dist/catalog/models-systems-machines.mjs';
import {TAU,helix} from '../dist/catalog/models-systems-helpers.mjs';

const defaults=m=>Object.fromEntries(m.fields.map(f=>[f.key,f.value]));
const model=n=>models.find(m=>m.number===n),near=(a,b,eps=1e-8)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
const item=(b,id)=>b.parts.find(x=>x.id===id),gear=p=>p.shapes.find(s=>s.kind==='gear');
function finite(v){if(typeof v==='number')assert.ok(Number.isFinite(v));else if(v&&typeof v==='object')Object.values(v).forEach(finite);}
function corners(m){return m.fields.reduce((all,f)=>all.flatMap(p=>(f.options?f.options.map(o=>o[0]):[f.min,f.max]).map(v=>({...p,[f.key]:v}))),[{}]);}
function vector(v,rot=[0,0,0],pos=[0,0,0]){return new THREE.Vector3(...v).applyEuler(new THREE.Euler(...rot)).add(new THREE.Vector3(...pos)).toArray();}
function segmentDistance(q,poly){let d=Infinity;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],x=b[0]-a[0],y=b[1]-a[1],t=Math.max(0,Math.min(1,((q[0]-a[0])*x+(q[1]-a[1])*y)/(x*x+y*y))),u=q[0]-a[0]-t*x,v=q[1]-a[1]-t*y;d=Math.min(d,u*u+v*v);}return Math.sqrt(d);}
function inside(q,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>q[1])!==(b[1]>q[1])&&q[0]<(b[0]-a[0])*(q[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}

for(const m of models)test(`${m.number}: all simultaneous endpoint/option combinations and 8 phases`,()=>{
  for(const p of corners(m)){
    m.validate(p);const b=m.build(p),ids=new Set(b.parts.map(x=>x.id));finite(b);
    for(const a of [0,.013,.37,Math.PI/2,Math.PI,TAU,13.7,97.3]){const s=m.sample(p,a);finite(s);for(const id of Object.keys(s.poses))assert.ok(ids.has(id));}
  }
  const p=defaults(m);for(const f of m.fields)for(const value of f.options?['invalid']:[NaN,Infinity,f.min-1,f.max+1])assert.throws(()=>m.validate({...p,[f.key]:value}));
});

test('each parameter has an observable geometry, pose or result effect, with explicit phase-clock exception',()=>{
  const inert=[];
  for(const m of models){const p=defaults(m);for(const f of m.fields){
    if(f.key==='inputRPM')continue; // The viewer integrates this into phase, even if a pose-only model has no RPM metric.
    const values=f.options?f.options.map(o=>o[0]):[f.min,f.max];
    const outputs=values.map(v=>{const q={...p,[f.key]:v};return JSON.stringify([m.build(q),...[.23,1.71].map(a=>m.sample(q,a))]);});
    if(new Set(outputs).size===1)inert.push(`${m.number}/${f.key}`);
  }}assert.deepEqual(inert,[]);
  // Explicitly conditional controls are ignored in the mode in which they have no physical meaning.
  for(const [n,patch,key,a,b] of [[52,{mode:'locked'},'speedRatio',0,.98],[53,{mode:'start'},'engineTorque',0,150],[54,{lock:'locked'},'difference',-.8,.8],[56,{mode:'line'},'rotaryRatio',0,2]]){
    const m=model(n),p={...defaults(m),...patch},field=m.fields.find(f=>f.key===key);assert.deepEqual(m.sample({...p,[key]:a},1.1),m.sample({...p,[key]:b},1.1));
    assert.equal(field.enabledWhen(p),false);assert.equal(field.enabledWhen(defaults(m)),true);assert.ok(field.inactiveHint.length>10);
  }
});

test('49: all accepted front gear combinations clear adjacent tips and eccentric holes stay within the discs',()=>{
  for(let sun=12;sun<=30;sun++)for(let crank=30;crank<=54;crank++)if((sun+crank)%3===0){
    const c=(sun+crank)/2;assert.ok(Math.sqrt(3)*c>crank+2);assert.ok(c+6<58-1.5-2.81);
  }
  const m=model(49);for(const sunTeeth of [12,30])for(const crankTeeth of [30,54])for(const pins of [14,24]){
    const p={...defaults(m),sunTeeth,crankTeeth,pins},b=m.build(p);
    for(const a of [0,.8,13.7]){const s=m.sample(p,a);for(let d=0;d<2;d++)for(let j=0;j<3;j++){
      const disc=item(b,'rv-disc'+d),pose=s.poses[disc.id],hole=disc.shapes[0].holes[j],center=hole.reduce((sum,v)=>sum.map((n,i)=>n+v[i]/hole.length),[0,0]);
      const actual=vector([...center,0],pose.rotation,pose.position),crank=s.poses['rv-crank'+j],expected=vector([d?-1.5:1.5,0,d?9:0],crank.rotation,crank.position);
      actual.forEach((v,i)=>near(v,expected[i]));
    }}
  }
});

test('49: pin roller/disc boundary clearance over every pin count and eccentric cycle',()=>{
  const m=model(49);let worst=Infinity;
  for(let pins=14;pins<=24;pins++){
    const p={...defaults(m),pins},b=m.build(p),ratio=1+pins*p.crankTeeth/p.sunTeeth;
    for(let j=0;j<32;j++){const s=m.sample(p,(j+.137)*TAU*ratio/(32*(pins-1)));for(const id of ['rv-disc0','rv-disc1']){
      const pose=s.poses[id],poly=item(b,id).shapes[0].points,c=Math.cos(pose.rotation[2]),sn=Math.sin(pose.rotation[2]);
      for(let i=0;i<pins;i++){const x=58*Math.cos(i*TAU/pins)-pose.position[0],y=58*Math.sin(i*TAU/pins)-pose.position[1],q=[x*c+y*sn,-x*sn+y*c];assert.ok(!inside(q,poly));worst=Math.min(worst,segmentDistance(q,poly)-2.8);}
    }}
  }assert.ok(worst>0,`sampled signed clearance ${worst}`);
});

test('50: coaxial shaft ranges and gear bores are physically compatible',()=>{
  const m=model(50);for(const p of corners(m)){const b=m.build(p),tube=item(b,'dct-even-shaft'),r=tube.shapes[0],min=tube.position[2]-r.length/2,max=tube.position[2]+r.length/2;
    for(let i=0;i<4;i++){const g=item(b,'dct-driver'+i),s=gear(g),z=g.position[2];if(i%2){assert.ok(s.hole>=r.outer);assert.ok(z-s.width/2>=min&&z+s.width/2<=max);}else{assert.ok(z-s.width/2>max);near(s.hole,4);}}
  }
});

test('51/53/55: output bearing, fixed motor case and PTO bores clear independent moving shafts',()=>{
  let m=model(51);for(const [mode] of m.fields[0].options){const b=m.build({...defaults(m),mode});for(const s of item(b,'at-case').shapes.filter(s=>s.outer===10))assert.ok(s.inner>6);}
  m=model(53);const hb=item(m.build(defaults(m)),'hsd-engine-case').shapes[0];assert.equal(hb.kind,'polygon');assert.ok(hb.holes[0].every(p=>Math.hypot(...p)>6));
  m=model(55);const b=m.build(defaults(m)),tube=item(b,'pto-input-tube').shapes[0];for(const id of ['slow','fast'])assert.ok(gear(item(b,'pto-in-'+id)).hole>=tube.outer);assert.ok(item(b,'pto-clutch').shapes[0].inner>=tube.outer);assert.ok(gear(item(b,'drive-axle')).hole>=6);
});

test('51/53/54/60: carrier and low-speed-input spokes clear the actual independent sun shaft',()=>{
  function radialClearance(rod){const a=rod.from,b=rod.to,x=b[0]-a[0],y=b[1]-a[1],t=Math.max(0,Math.min(1,-(a[0]*x+a[1]*y)/(x*x+y*y)));return Math.hypot(a[0]+t*x,a[1]+t*y)-rod.radius;}
  for(const [n,prefix] of [[51,'at'],[53,'hsd'],[54,'tr'],[60,'wind']]){
    const m=model(n);for(const p of corners(m)){
      const b=m.build(p),sun=item(b,prefix+'-sun'),shaft=sun.shapes.find(s=>s.kind==='cylinder'),carrier=item(b,prefix+'-carrier');
      for(const spoke of carrier.shapes.filter(s=>s.kind==='rod'))assert.ok(radialClearance(spoke)>shaft.radius);
      if(n===60)for(const spoke of item(b,'wind-rotor').shapes.filter(s=>s.kind==='rod'))assert.ok(radialClearance(spoke)>shaft.radius);
      if(n===51&&['overdrive','reverse'].includes(p.mode)){
        const port=item(b,'at-port'),tube=port.shapes.find(s=>s.kind==='ring'&&s.outer===8),hub=carrier.shapes.find(s=>s.kind==='ring');
        const tubeStart=port.position[2]+tube.position[2]-tube.length/2,hubEnd=carrier.position[2]+hub.position[2]+hub.length/2;
        assert.ok(tubeStart>hubEnd,'ring-output tube must not pass through stationary/differential-speed carrier hub');
        for(const spoke of port.shapes.filter(s=>s.kind==='rod'))assert.ok(radialClearance(spoke)>shaft.radius);
      }
    }
  }
});

test('56: all three helices have the same positive-turn/positive-feed relation',()=>{
  for(const axis of ['x','y','z'])for(const lead of [4,16]){
    const h=helix(4,lead,105,axis),k={x:0,y:1,z:2}[axis],a=h.points[40],b=h.points[41],displacement=b[k]-a[k],theta=displacement*TAU/lead,rotation=[0,0,0];rotation[k]=theta;
    const after=vector(b,rotation);after[k]-=displacement;after.forEach((v,i)=>near(v,a[i]));
  }
});

test('56: bored nuts clear screw envelope; whole XY travel clears column and Z guides',()=>{
  const m=model(56),p={...defaults(m),travel:50},b=m.build(p);
  for(const id of ['cnc-xnut','cnc-ynut','cnc-znut']){const nut=item(b,id).shapes[0];assert.equal(nut.kind,'polygon');assert.ok(5*Math.cos(Math.PI/nut.holes[0].length)>4.7);}
  const column=item(b,'cnc-column'),front=column.shapes[0].position[1]-column.shapes[0].size[1]/2,guideFront=column.shapes[1].from[1]-column.shapes[1].radius;
  for(let i=0;i<240;i++){const q=cncState(p,i*TAU/240);assert.ok(q.y+37.5<front);assert.ok(q.y+37.5<guideFront);near(q.toolLocal[2],q.z-36);}
});

test('57: outer fork bearing ends and pitch hinge remain coincident in all modes',()=>{
  const m=model(57),b=m.build(defaults(m)),outer=item(b,'wr-outer'),arms=outer.shapes.filter(s=>s.kind==='rod');
  for(const p of corners(m))for(const a of [0,.9,17]){const s=m.sample(p,a),q=wristState(p,a);for(let i=0;i<2;i++){
    const tip=vector(arms[i].to,s.poses['wr-outer'].rotation,outer.position),hinge=vector([0,i?-27:27,0],s.poses['wr-bend'].rotation,q.pivot);tip.forEach((v,j)=>near(v,hinge[j]));
  }}
});

test('58: both actual pallet cylinders clear tooth outline across release/lock, alternate locking resists further advance',()=>{
  const m=model(58),p=defaults(m),b=m.build(p),wheel=item(b,'clk-escape'),profile=wheel.shapes.find(s=>s.kind==='polygon'),fork=item(b,'clk-fork'),pins=fork.shapes.filter(s=>s.kind==='cylinder'&&s.radius===1.6);
  function gaps(a,extra=0){const s=m.sample(p,a),angle=s.poses[wheel.id].rotation[2]+profile.rotation[2]+extra,c=Math.cos(angle),sn=Math.sin(angle);return pins.map(pin=>{const pt=vector(pin.position,s.poses[fork.id].rotation,fork.position),x=pt[0]-wheel.position[0],y=pt[1]-wheel.position[1],q=[x*c+y*sn,-x*sn+y*c];return (inside(q,profile.points)?-1:1)*segmentDistance(q,profile.points)-pin.radius;});}
  let worst=Infinity;for(let i=0;i<1440;i++)worst=Math.min(worst,...gaps((i+.31)*TAU/1440));assert.ok(worst>=-.0001,`sampled pallet clearance ${worst}`);
  const first=gaps(.8*Math.PI),second=gaps(1.8*Math.PI);assert.ok(Math.min(...first)<.006&&Math.min(...second)<.006);assert.ok(Math.max(...first)>.5&&Math.max(...second)>.5);assert.notEqual(first.indexOf(Math.min(...first)),second.indexOf(Math.min(...second)));
  assert.ok(Math.min(...gaps(.8*Math.PI,.003))<-.01);assert.ok(Math.min(...gaps(1.8*Math.PI,.003))<-.01);
  for(const f of [.1,.35]){const q={...p,releaseFraction:f};near(clockState(q,TAU+.7).escape-clockState(q,.7).escape,TAU/15);}
});

test('59: coaxial drive gears, tubes and rotors have non-intersecting axial/bore arrangement',()=>{
  const m=model(59);for(const rotorTeeth of [60,80,100]){const b=m.build({...defaults(m),rotorTeeth}),lo=item(b,'heli-lower'),tube=lo.shapes.find(s=>s.kind==='ring'),hi=item(b,'heli-upper'),upper=gear(hi),idler=item(b,'heli-idler');
    assert.ok(gear(lo).hole>=tube.outer);assert.ok(upper.position[2]+upper.width/2<tube.position[2]-tube.length/2);assert.ok(item(b,'heli-rotor-low').shapes[0].inner>5);
    const shaft=idler.shapes.find(s=>s.kind==='cylinder');assert.ok(idler.position[2]+shaft.position[2]+shaft.length/2<item(b,'heli-rotor-low').position[2]-2);
    near(idler.position[2]+idler.shapes.filter(s=>s.kind==='gear')[1].position[2],upper.position[2]);
  }
});

test('51/53/54/60: all corner states preserve independent Willis and power constraints',()=>{
  const val=(s,name)=>s.metrics.find(v=>v.label===name).value;
  for(const n of [51,53,54,60]){const m=model(n);for(const p of corners(m)){const s=m.sample(p,.79);if(n===51)near(val(s,'Willis残差'),0);if(n===53){near(30*val(s,'MG1转速')+78*val(s,'输出/MG2转速'),108*val(s,'发动机转速'));near(val(s,'功率平衡残差'),0);}if(n===54)near((val(s,'前轴转速')+val(s,'后轴转速'))/2,val(s,'差速壳转速'));if(n===60){near(val(s,'输出功率'),val(s,'输入功率')*p.efficiency**3);near(val(s,'输出转矩')*val(s,'发电机轴转速')*TAU/60,val(s,'输出功率'));}}
  }
});
