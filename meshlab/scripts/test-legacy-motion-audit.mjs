import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {gearOffset} from '../dist/legacy-disassembly.mjs';
import * as THREE from '../dist/assets/three.module.js';
import {defaults as bicycleDefaults} from '../dist/bicycle/mechanics.mjs';
import {models,diagnostics as d} from '../dist/catalog/models-motion.mjs';

const close=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<t,`${a} ≈ ${b}`);
const by=n=>models.find(m=>m.number===n),defaults=m=>({inputRPM:30,...Object.fromEntries(m.fields.map(f=>[f.key,f.value]))});

test('GL16 production RPM handler drives all three animated shafts and keeps slow-play and fixed ratios',async()=>{
  const source=await readFile(new URL('../dist/app.js',import.meta.url),'utf8');
  const handler=source.split(/\r?\n/).find(s=>s.startsWith("$('calc-rpm').oninput="));
  const frame=source.split(/\r?\n/).find(s=>s.startsWith('let last=performance.now();function frame'));
  const els=new Map(),$=id=>{if(!els.has(id))els.set(id,{hidden:true});return els.get(id);};
  const parts=[1,-.25,.0625].map((spin,i)=>({amount:0,data:{id:'shaft'+i,spin},mesh:{position:new THREE.Vector3(),rotation:{z:0}},base:new THREE.Vector3(),offset:new THREE.Vector3()}));
  const ctx=vm.createContext({$,THREE,parts,gearOffset,disassemblyProgress:0,performance:{now:()=>0},requestAnimationFrame(){},angle:0,playing:true,speed:1,inputRPM:1440,mode:'explore',step:0,explodeTarget:0,reduced:false,floor:{position:{}},grid:{position:{}},controls:{update(){}},needsRender:false});
  vm.runInContext(handler+'\n'+frame,ctx);
  const advance=(rpm,speed=1)=>{ctx.speed=speed;$( 'calc-rpm').oninput({target:{value:String(rpm)}});const old=ctx.angle;ctx.frame((ctx.now=(ctx.now||0)+20));return ctx.angle-old;};
  const base=advance(1440),half=advance(720),slow=advance(720,.5);close(half,base/2);close(slow,base/4);close(base,.02*1.256637);
  close(parts[1].mesh.rotation.z,-parts[0].mesh.rotation.z/4);close(parts[2].mesh.rotation.z,parts[0].mesh.rotation.z/16);
  assert.equal($('calc-middle').textContent,'180');assert.equal($('calc-output').textContent,'45');
  ctx.playing=false;close(advance(1000),0);$( 'calc-rpm').oninput({target:{value:'NaN'}});assert.equal(ctx.inputRPM,1000);
});

const moduleUrl=path=>new URL(path,import.meta.url).href;
const bicycleSource=(await readFile(new URL('../dist/bicycle/viewer.mjs',import.meta.url),'utf8'))
  .replace("from '../legacy-disassembly.mjs'",`from '${moduleUrl('../dist/legacy-disassembly.mjs')}'`)
  .replace("from 'three'",`from '${moduleUrl('../dist/assets/three.module.js')}'`)
  .replace("import {OrbitControls} from '../assets/OrbitControls.js';",'const OrbitControls=class {};')
  .replace("from './mechanics.mjs'",`from '${moduleUrl('../dist/bicycle/mechanics.mjs')}'`);
const {BicycleViewer}=await import('data:text/javascript;base64,'+Buffer.from(bicycleSource).toString('base64'));
function bicycleViewer(){const v=Object.create(BicycleViewer.prototype);Object.assign(v,{scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),parts:[],selected:'chainring',amount:0,step:0,speed:1,labelsOn:false,housingMode:'solid',onSelect(){},render(){},home(){},fitModel(){}});return v;}
test('bicycle production meshes leave continuous clearance for both shafts through frame, hubs and crank',()=>{
  const v=bicycleViewer();
  for(const patch of [{},{frontTeeth:28,rearTeeth:12,wheelDiameter:600,crankLength:150},{frontTeeth:52,rearTeeth:32,wheelDiameter:740,crankLength:180}]){
    v.build({...bicycleDefaults,...patch});
    for(const angle of [0,.4,1.7]){
      v.rotations={front:angle,rear:angle*2,wheel:angle*2};v.updateMotion();v.scene.updateMatrixWorld(true);
      for(const [side,radius,ids] of [[-1,7.9,['frame','chainring','crank']],[1,4.9,['frame','wheel','rear-sprocket']]]){
        const x=side*v.g.effectiveCenterDistance/2;
        for(const id of ids)for(let i=0;i<16;i++){
          const a=i*Math.PI/8,ray=new THREE.Raycaster(new THREE.Vector3(x+radius*Math.cos(a),radius*Math.sin(a),-150),new THREE.Vector3(0,0,1),0,320);
          assert.equal(ray.intersectObject(v.parts.find(p=>p.id===id).group,true).length,0,`${id}: solid intrudes into shaft sweep`);
        }
      }
    }
    const sleeve=v.parts.find(p=>p.id==='rear-sprocket').group.children[0].children.at(-1),flange=v.wheelSpin.children[4];
    const a=new THREE.Box3().setFromObject(sleeve),b=new THREE.Box3().setFromObject(flange);assert.ok(a.min.z<b.max.z&&a.max.z>b.min.z,'rear sleeve reaches the wheel hub flange');
    const shaft=new THREE.Box3().setFromObject(v.parts.find(p=>p.id==='bottom-bracket').group.children[0]);assert.ok(shaft.min.z<-88.5&&shaft.max.z>18.5,'bottom-bracket shaft reaches both crank hubs');
  }
  v.clearGeometry();
});
test('bicycle operating inputs preserve geometry, zero cadence stops, and changed teeth rebuild',()=>{
  const v=bicycleViewer();v.build(bicycleDefaults);const root=v.root;v.setPlaying(true);v.build({...bicycleDefaults,cadence:0});assert.equal(v.root,root);assert.equal(v.playing,false);v.setPlaying(true);assert.equal(v.playing,false);
  v.build({...bicycleDefaults,inputPower:220});assert.equal(v.root,root);v.setPlaying(true);assert.equal(v.playing,true);v.build({...bicycleDefaults,rearTeeth:20});assert.notEqual(v.root,root);assert.equal(v.playing,false);v.clearGeometry();
});
test('universal-joint journal holes and support scale leave positive radial clearance at every size',()=>{
  for(const number of [24,25])for(const jointSize of [28,36,56]){
    const m=by(number),p={...defaults(m),jointSize},b=m.build(p),pin=number===24?5:4;
    for(const part of b.parts.filter(p=>/input|output|midA|midB/.test(p.id))){const cups=part.shapes.filter(s=>s.kind==='ring');assert.equal(cups.length,2);for(const cup of cups){assert.ok(cup.inner>pin);assert.ok(cup.outer>cup.inner);}
      const arms=part.shapes.filter(s=>s.kind==='box'&&s.size[0]===22);for(const arm of arms)assert.ok(Math.abs(arm.position[0])-arm.size[0]/2>pin,'arm clears journal');}
    if(number===24){const shaft=b.parts.find(p=>p.id==='input').shapes[0],support=b.parts.find(p=>p.id==='support').shapes[0];assert.ok(support.inner>shaft.radius);}
  }
});
test('freewheel roller contact-point speed matches prescribed outer-ring speed',()=>{
  const m=by(29);for(const mode of ['lock','overrun'])for(const rollerRadius of [4,5,6])for(const overrunRatio of [1.05,1.6,2.5])for(const phase of [0,.6,2.1]){
    const p={...defaults(m),mode,rollerRadius,overrunRatio},e=1e-6,a=m.sample(p,phase-e),b=m.sample(p,phase+e),s=m.sample(p,phase),pos=s.poses.roller0.position,rc=Math.hypot(pos[0],pos[1]),t=[-pos[1]/rc,pos[0]/rc];
    const vc=t.reduce((sum,v,i)=>sum+v*(b.poses.roller0.position[i]-a.poses.roller0.position[i])/(2*e),0),spin=(b.poses.roller0.rotation[2]-a.poses.roller0.rotation[2])/(2*e),outer=(b.poses.outer.rotation[2]-a.poses.outer.rotation[2])/(2*e);
    close(vc+rollerRadius*spin,42*outer,1e-6);
  }
});
test('conveyor and derailleur shafts fit actual polygonal bores and roller support contacts',()=>{
  const conveyor=by(26),derailleur=by(32);
  const bore=shape=>Math.min(...shape.holes[0].map((a,i,arr)=>{const b=arr[(i+1)%arr.length];return Math.abs(a[0]*b[1]-a[1]*b[0])/Math.hypot(b[0]-a[0],b[1]-a[1]);}));
  for(const teeth of [12,16,24]){
    const p={...defaults(conveyor),teeth},b=conveyor.build(p),g=d.conveyorGeometry(p),drive=b.parts.find(x=>x.id==='drive');
    for(const s of drive.shapes.filter(s=>s.holes))assert.ok(bore(s)>8);
    for(const s of drive.shapes.filter(s=>s.kind==='ring'))assert.ok(s.inner<8.5&&s.inner>8,'hub hole must not grow away from the fixed shaft');
    const rollerRadius=25*.22,takeup=b.parts.find(x=>x.id==='takeup');close(takeup.position[1]+18,-g.R-rollerRadius);
    for(const rail of b.parts.find(x=>x.id==='rails').shapes.filter(s=>s.size[1]===9))close(rail.position[1]+rail.size[1]/2,g.R-rollerRadius);
  }
  for(const gear of [1,2,3,4,5]){
    const p={...defaults(derailleur),gear},b=derailleur.build(p),g=d.derailleurGeometry(p),s=derailleur.sample(p,.7);
    for(const id of ['front','cassette','guide','tension'])for(const shape of b.parts.find(x=>x.id===id).shapes.filter(x=>x.holes))assert.ok(bore(shape)>(id==='front'||id==='cassette'?6:4));
    const pose=s.poses.cage,matrix=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...pose.rotation));
    for(const pin of b.parts.find(x=>x.id==='cage').shapes.filter(x=>x.kind==='cylinder')){
      const center=new THREE.Vector3(...pin.position).applyMatrix4(matrix).add(new THREE.Vector3(...pose.position));
      assert.ok(Math.min(center.distanceTo(new THREE.Vector3(...g.guide)),center.distanceTo(new THREE.Vector3(...g.tension)))<1e-7,'guide pins are coaxial with both pulleys');
    }
  }
});
test('conditional controls declare exactly the operating conditions in which they affect results',()=>{
  const clutch=by(28),slip=clutch.fields.find(f=>f.key==='slip');assert.equal(slip.enabledWhen(defaults(clutch)),false);assert.equal(slip.enabledWhen({...defaults(clutch),mode:'slipping'}),true);assert.equal(slip.enabledWhen({...defaults(clutch),mode:'slipping',normalForce:0}),false);
  const roller=by(29),ratio=roller.fields.find(f=>f.key==='overrunRatio');assert.equal(ratio.enabledWhen(defaults(roller)),false);assert.equal(ratio.enabledWhen({...defaults(roller),mode:'overrun'}),true);
});
test('ball-screw journals reach both bearing bores with positive clearance and axial engagement',()=>{
  const m=by(27);for(const screwDiameter of [26,32,40])for(const stroke of [60,180]){
    const p={...defaults(m),screwDiameter,stroke},b=m.build(p),journals=b.parts.find(x=>x.id==='screw').shapes.filter(x=>x.kind==='cylinder'),bearings=b.parts.find(x=>x.id==='supports').shapes.filter(x=>x.kind==='ring');
    assert.equal(journals.length,2);assert.equal(bearings.length,2);
    for(const bearing of bearings){const journal=journals.find(j=>j.position[0]*bearing.position[0]>0);assert.ok(bearing.inner>journal.radius&&bearing.inner-journal.radius<.5);assert.ok(Math.abs(bearing.position[0]-journal.position[0])+bearing.length/2<journal.length/2);}
  }
});
test('centrifugal shoe guide slots clear the rods through the complete radial stroke',()=>{
  const m=by(30),b=m.build(defaults(m)),shoe=b.parts.find(x=>x.id==='shoe0'),guide=b.parts.find(x=>x.id==='hub').shapes.find(s=>s.kind==='rod');
  assert.equal(shoe.shapes.length,4);
  for(const displacement of [0,1,2,3,4,5]){
    for(const half of shoe.shapes.filter(s=>s.depth===12))assert.ok(half.points.every(v=>Math.abs(v[1])>guide.radius));
    for(const cap of shoe.shapes.filter(s=>s.depth===2))assert.ok(Math.abs(cap.position[2])-cap.depth/2>guide.radius);
    assert.ok(guide.to[0]>(25+displacement),'guide rod remains engaged at full outward travel');
    assert.ok(guide.to[0]<37+displacement,'guide rod remains inside the shoe envelope');
  }
});
