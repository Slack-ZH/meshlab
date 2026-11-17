import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../dist/assets/three.module.js';
import {definitions,defaults,validate,solve,samples,range,advance,bevelGeometry,camMotion,camPoint,ratchetOutline,genevaGeometry,genevaOutline,rad,rollerSpin} from '../dist/mechanisms/mechanics.mjs';
const near=(a,b,label='',eps=1e-7)=>assert.ok(Math.abs(a-b)<eps,`${label}: ${a} != ${b}`),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const rotate=(x,y,t)=>({x:x*Math.cos(t)-y*Math.sin(t),y:x*Math.sin(t)+y*Math.cos(t)});
function segmentDistance(P,A,B){const dx=B[0]-A[0],dy=B[1]-A[1],t=Math.max(0,Math.min(1,((P.x-A[0])*dx+(P.y-A[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(P.x-A[0]-t*dx,P.y-A[1]-t*dy);}
function inside(P,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [x,y]=poly[i],[xx,yy]=poly[j];if((y>P.y)!==(yy>P.y)&&P.x<(xx-x)*(P.y-y)/(yy-y)+x)yes=!yes;}return yes;}

test('bevel gears share a cone apex and tangent generator and obey the exact tooth ratio',()=>{
  for(const z1 of [16,18,30])for(const z2 of [20,30,40])for(const module of [2,4]){const p={...defaults('bevel-gears'),z1,z2,module},g=bevelGeometry(p);near(g.d1+g.d2,Math.PI/2);near(g.z1,g.r2);near(g.z2,g.r1);near(g.r1/g.r2,z1/z2);
    const s=solve('bevel-gears',p,360);near(s.outputAngle,-360*z1/z2);near(s.outputRPM,p.rpm*z1/z2);assert.ok(g.width<g.R/3);}
});
test('scissor jack keeps all four arms rigid and converts turns to lead and nonlinear height',()=>{
  for(const arm of [120,140,180])for(const lead of [2,4,6]){const p={...defaults('scissor-jack'),arm,lead},r=range('scissor-jack',p);for(const s of samples('scissor-jack',p,300)){for(const [a,b]of [['A','L'],['L','T'],['A','R'],['R','T']])near(dist(s[a],s[b]),arm);near(s.width,2*arm*Math.sqrt(.96)-lead*s.input);}
    near(solve('scissor-jack',p,0).height,.4*arm);near(solve('scissor-jack',p,r.max).height,1.85*arm);
    assert.equal(advance('scissor-jack',p,r.max,1,1,1).atLimit,true);assert.ok(advance('scissor-jack',p,r.max,1,1,-1).input<r.max);assert.equal(advance('scissor-jack',p,0,1,1,-1).input,0);}
});
test('ratchet output advances on drive, stays on return, and its rigid pawl follows the tooth surface',()=>{
  for(const teeth of [18,24,36])for(const advanceTeeth of [1,2,4]){const p={...defaults('ratchet-pawl'),teeth,advanceTeeth},outline=ratchetOutline(p);let previous=-1;
    for(const s of samples('ratchet-pawl',p,144)){assert.ok(s.outputAngle>=previous-1e-8);previous=s.outputAngle;near(dist(s.pawl.pivot,s.pawl.tip),31);const tip=rotate(s.pawl.tip.x,s.pawl.tip.y,-rad(s.outputAngle));const closest=Math.min(...outline.map((A,i)=>segmentDistance(tip,A,outline[(i+1)%outline.length])));assert.ok(closest<1e-6,'pawl left tooth surface');if(s.input>=180&&s.input<=360)near(s.outputAngle,360*advanceTeeth/teeth);}
    near(solve('ratchet-pawl',p,720).outputAngle,720*advanceTeeth/teeth);}
});
test('eccentric follower remains tangent to the circular cam and stroke is exactly twice eccentricity',()=>{
  for(const eccentricity of [0,12,20])for(const radius of [40,65]){const p={...defaults('eccentric-follower'),eccentricity,radius};for(const s of samples('eccentric-follower',p)){near(s.follower.y-s.C.y,radius);near(dist(s.C,s.O),eccentricity);near(s.stroke,2*eccentricity);}
    near(solve('eccentric-follower',p,90).displacement,2*eccentricity);near(solve('eccentric-follower',p,270).displacement,0);}
});
test('roller cam phases join smoothly and roller-offset profile remains tangent without penetration',()=>{
  for(const p of [defaults('roller-cam'),{...defaults('roller-cam'),base:60,lift:45,roller:12,rise:90,dwell:60,fall:150}]){
    validate('roller-cam',p);for(const angle of [0,p.rise,p.rise+p.dwell,p.rise+p.dwell+p.fall,360])near(camMotion(p,angle).ds,0);
    near(camMotion(p,p.rise).s,p.lift);near(camMotion(p,p.rise+p.dwell+p.fall).s,0);
    const outline=Array.from({length:1440},(_,i)=>{const q=camPoint(p,i/4);return[q.x,q.y];});
    for(let angle=0;angle<360;angle+=5){const s=solve('roller-cam',p,angle);near(dist(s.follower,s.contact),p.roller);const center=rotate(0,s.follower.y-s.O.y,-rad(angle));const closest=Math.min(...outline.map((A,i)=>segmentDistance(center,A,outline[(i+1)%outline.length])));assert.ok(closest>p.roller-.025,'roller intersects cam');}
    near(rollerSpin(p,720),2*rollerSpin(p,360));
  }
  assert.throws(()=>validate('roller-cam',{...defaults('roller-cam'),rise:150,fall:150,dwell:90}));
});
test('Geneva pin stays in a slot during indexing and output holds throughout dwell for every slot count',()=>{
  for(const slots of [4,5,6,7,8]){const p={...defaults('geneva-drive'),slots},g=genevaGeometry(p);let previous=0;
    for(const s of samples('geneva-drive',p,720)){assert.ok(s.outputAngle<=previous+1e-7);previous=s.outputAngle;
      if(s.engaged){const angle=g.slotBase+rad(s.outputAngle),v={x:s.B.x-s.D.x,y:s.B.y-s.D.y};near(v.x*Math.sin(angle)-v.y*Math.cos(angle),0,'pin on slot axis');assert.ok(Math.hypot(v.x,v.y)>=g.slotEnd-1e-6);}
      else near(s.outputAngle,s.input<180?0:-360/slots);}
    near(solve('geneva-drive',p,360).outputAngle,-360/slots);near(solve('geneva-drive',p,720).outputAngle,-720/slots);near(solve('geneva-drive',p,0).dwellPercent,100*(.5+1/slots));
  }
});
test('Geneva driving pin clears the actual slotted wheel polygon',()=>{
  for(const slots of [4,6,8]){const p={...defaults('geneva-drive'),slots},g=genevaGeometry(p),poly=genevaOutline(p);
    for(let a=0;a<360;a+=2){const s=solve('geneva-drive',p,a);for(let j=0;j<24;j++){const t=j/24*Math.PI*2,point=rotate(s.B.x-s.D.x+g.pin*Math.cos(t),s.B.y-s.D.y+g.pin*Math.sin(t),-rad(s.outputAngle));assert.equal(inside(point,poly),false,`pin penetrates wheel n=${slots} a=${a}`);}}
  }
});
test('zero speed stays still and invalid numbers or tooth counts are rejected',()=>{
  for(const kind of Object.keys(definitions)){const p=defaults(kind),initial=definitions[kind].initial;validate(kind,p);near(advance(kind,{...p,rpm:0},initial,1).input,initial);for(const value of [NaN,Infinity,-1])assert.throws(()=>validate(kind,{...p,[definitions[kind].fields[0].key]:value}));}
  for(const [kind,key]of [['bevel-gears','z1'],['ratchet-pawl','teeth'],['geneva-drive','slots']])assert.throws(()=>validate(kind,{...defaults(kind),[key]:defaults(kind)[key]+.5}));
});
test('Geneva locking sector clears the wheel through both drive and dwell',()=>{
  for(const slots of [4,6,8]){const p={...defaults('geneva-drive'),slots},g=genevaGeometry(p),poly=genevaOutline(p);
    for(let input=0;input<360;input+=3){const s=solve('geneva-drive',p,input);for(let j=0;j<=30;j++)for(const fraction of [.2,.45,.7,.99]){
      const phi=Math.PI/2+j*Math.PI/30+rad(s.driverAngle),point=rotate(s.A.x-s.D.x+g.lock*fraction*Math.cos(phi),s.A.y-s.D.y+g.lock*fraction*Math.sin(phi),-rad(s.outputAngle));assert.equal(inside(point,poly),false,`locking interference n=${slots} input=${input}`);
    }}
  }
});

const resolveImports=(source,base)=>source.replace(/from '(\.\.?\/[^']+)'/g,(_,p)=>`from '${new URL(p,base).href}'`);
const baseUrl=new URL('../dist/linkages/viewer.mjs',import.meta.url);
let baseSource=(await readFile(baseUrl,'utf8')).replace("import {OrbitControls} from '../assets/OrbitControls.js';",'const OrbitControls=class {};');
const baseData='data:text/javascript;base64,'+Buffer.from(resolveImports(baseSource,baseUrl)).toString('base64');
const viewerUrl=new URL('../dist/mechanisms/viewer.mjs',import.meta.url);
let source=(await readFile(viewerUrl,'utf8')).replace("from '../linkages/viewer.mjs'",`from '${baseData}'`);
const {MechanismViewer}=await import('data:text/javascript;base64,'+Buffer.from(resolveImports(source,viewerUrl)).toString('base64'));
function cpu(kind){const v=Object.create(MechanismViewer.prototype);Object.assign(v,{kind,scene:new THREE.Scene(),parts:[],selected:null,amount:0,step:0,housing:'solid',homeDirection:new THREE.Vector3(),stage:{fit(){}},home(){},fit(){},render(){},onSelect(){}});return v;}
test('all six production meshes build, restore their pose and keep independent selection materials',()=>{
  for(const kind of Object.keys(definitions)){const v=cpu(kind),p=defaults(kind),r=range(kind,p);v.build(p,definitions[kind].initial);
    for(const input of [0,.25,r.max/2,r.max]){v.update(input);const before=v.parts.map(p=>p.group.position.toArray());v.explode(1);for(const part of v.parts){const b=new THREE.Box3().setFromObject(part.group);assert.ok([...b.min.toArray(),...b.max.toArray()].every(Number.isFinite),kind+' nonfinite mesh');}
      if(kind!=='bevel-gears'){const boxes=v.parts.map(p=>new THREE.Box3().setFromObject(p.group));for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)assert.equal(boxes[i].intersectsBox(boxes[j]),false,kind+' exploded overlap');}
      v.restore();assert.deepEqual(v.parts.map(p=>p.group.position.toArray()),before);near(v.angle,input);for(let i=0;i<=4;i++)v.assembly(i);v.restore();assert.deepEqual(v.parts.map(p=>p.group.position.toArray()),before);}
    v.select('input');v.select('output');v.input.group.traverse(o=>{if(o.isMesh)assert.equal(o.material.emissiveIntensity,0);});v.output.group.traverse(o=>{if(o.isMesh)assert.equal(o.material.emissiveIntensity,.32);});v.setHousing('transparent');v.frame.group.traverse(o=>{if(o.isMesh)assert.equal(o.material.opacity,.16);});v.clear();}
});
