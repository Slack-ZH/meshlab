import * as THREE from '../assets/three.module.js';
import {LinkageViewer} from '../linkages/viewer.mjs';
import {definitions,solve,samples,range,rad,deg,wrap,clamp,bevelGeometry,ratchetOutline,genevaGeometry,genevaOutline,camPoint,rollerSpin} from './mechanics.mjs';

export class MechanismViewer extends LinkageViewer {
  constructor(host,kind,onSelect,onDrag){super(host,kind,onSelect,onDrag);this.draggablePartIds=['input','locking'];this.renderer.domElement.setAttribute('aria-label',definitions[kind].title+'三维视图；拖动旋转、点击选件，使用输入滑块驱动。');}
  part(id,name,description,order=2){return this.addPart(id,name,description,order,0);}
  shape(part,points,depth=10,bore=0,finish='gear',parent=part.group){
    const shape=points instanceof THREE.Shape?points:new THREE.Shape(points.map(p=>new THREE.Vector2(...p)));
    if(bore){const hole=new THREE.Path();hole.absarc(0,0,bore,0,Math.PI*2,true);shape.holes.push(hole);}
    const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:48});g.translate(0,0,-depth/2);return this.mesh(part,g,finish,[0,0,0],parent);
  }
  circle(part,r,depth,pos=[0,0,0],bore=6,finish='gear',parent=part.group){const s=new THREE.Shape();s.absarc(pos[0],pos[1],r,0,Math.PI*2);const m=this.shape(part,s,depth,bore,finish,parent);m.position.z=pos[2];return m;}
  segment(part,A,B,r=4,finish='shaft',parent=part.group){const a=new THREE.Vector3(...A),b=new THREE.Vector3(...B),g=new THREE.CylinderGeometry(r,r,a.distanceTo(b),28);const m=this.mesh(part,g,finish,a.clone().add(b).multiplyScalar(.5).toArray(),parent);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.sub(a).normalize());return m;}
  tube(part,points,r=1,parent=part.group){const curve=new THREE.CatmullRomCurve3(points);return this.mesh(part,new THREE.TubeGeometry(curve,Math.max(32,points.length*2),r,6,false),'fastener',[0,0,0],parent);}
  deck(frame,width=170,depth=95,x=0,z=-10){this.box(frame,[width,10,depth],[x,3,z]);for(const dx of [-width/2+12,width/2-12])for(const dz of [-depth/2+12,depth/2-12])this.box(frame,[18,5,18],[x+dx,-4,z+dz],'rubber');}
  support(part,P){
    // The pedestal ends below the bore, leaving a continuous shaft passage.
    this.box(part,[30,P.y-29,24],[P.x,(P.y+5)/2,-26]);this.ring(part,19,6.2,24,[P.x,P.y,-26]);this.box(part,[52,9,62],[P.x,12.5,-17]);
    for(const x of [-18,18])for(const z of [-38,6])this.cylinder(part,3,4,[P.x+x,19,z],'fastener').rotation.x=Math.PI/2;
  }
  fit(){
    if(this.kind==='bevel-gears'&&this.motionBounds){const box=this.amount||this.step?new THREE.Box3().setFromObject(this.root):this.motionBounds;this.stage.fit(box,box.getCenter(new THREE.Vector3()));}
    super.fit();
  }
  build(p,input){
    this.clear();this.p={...p};this.parts=[];this.root=new THREE.Group();this.scene.add(this.root);this.amount=0;this.step=0;this.separationDirection=null;
    this.frame=this.part('frame','底座与固定支承','固定轴承和底座构成机架，保持各固定转轴与导向位置。',4);
    this.input=this.part('input',this.kind==='scissor-jack'?'丝杠与手柄':this.kind==='ratchet-pawl'?'摆动手柄与棘爪座':this.kind==='geneva-drive'?'主动盘与驱动销':this.kind==='bevel-gears'?'主动锥齿轮':'主动凸轮','输入构件。改变输入位置或点击播放，观察它如何带动后续构件。',3);
    this.output=this.part('output',this.kind==='scissor-jack'?'起升托座':this.kind==='ratchet-pawl'?'棘轮与套筒输出轴':this.kind==='geneva-drive'?'径向槽轮':this.kind==='bevel-gears'?'从动锥齿轮':'直动从动件','输出构件的位置由当前机构的几何或单向约束决定。',2);
    if(this.kind==='bevel-gears')this.buildBevel(p);
    else if(this.kind==='scissor-jack')this.buildJack(p);
    else if(this.kind==='ratchet-pawl')this.buildRatchet(p);
    else if(this.kind==='geneva-drive')this.buildGeneva(p);
    else this.buildCam(p);
    this.update(input,false);
    // Allocate separate bands along assembly axes for the exploded presentation.
    let cursor=0;
    for(const part of [...this.parts].sort((a,b)=>(a.id==='frame'?-1:b.id==='frame'?1:0))){const box=new THREE.Box3().setFromObject(part.group);if(this.kind==='scissor-jack'&&part.id==='input'){box.min.z=-56;box.max.z=56;}part.zOffset=cursor-box.min.z;cursor+=box.max.z-box.min.z+26;}
    for(const part of this.parts)part.zOffset-=(cursor-26)/2;
    this.motionBounds=new THREE.Box3();
    for(const s of samples(this.kind,p,60)){this.update(s.input,false);this.motionBounds.union(new THREE.Box3().setFromObject(this.root));}
    this.update(input,false);this.stage.fit(this.motionBounds,this.motionBounds.getCenter(new THREE.Vector3()));
    this.homeDirection.set(...(this.kind==='bevel-gears'?[-1,.65,-1.2]:[.35,.26,1])).normalize();
    this.setHousing(this.housing);this.home();this.select(null);
  }
  buildBevel(p){
    const g=this.g=bevelGeometry(p),O=solve(this.kind,p,0).O;
    this.deck(this.frame,g.z1+135,g.z2+130,(g.z1+45)/2,(g.z2+40)/2);
    const make=(part,z,delta)=>{
      const rotor=new THREE.Group();part.group.add(rotor);const c=Math.cos(delta),s=Math.sin(delta),inner=g.R-g.width,root=-1.18*p.module;
      const profile=[[6,inner*c-root*s],[inner*s+root*c,inner*c-root*s],[g.R*s+root*c,g.R*c-root*s],[g.R*s+root*c,g.R*c-root*s+5],[6,g.R*c-root*s+5],[6,inner*c-root*s]];
      const blank=new THREE.LatheGeometry(profile.map(v=>new THREE.Vector2(...v)),96);blank.rotateX(Math.PI/2);this.mesh(part,blank,'gear',[0,0,0],rotor);
      const position=(R,h,a)=>[Math.cos(a)*(R*s+h*c),Math.sin(a)*(R*s+h*c),R*c-h*s];
      for(let tooth=0;tooth<z;tooth++){
        const angle=tooth*2*Math.PI/z,pitch=2*Math.PI/z,vertices=[];
        for(const R of [inner,g.R])for(const [h,side]of [[root,-.39],[root,.39],[p.module,.17],[p.module,-.17]])vertices.push(position(R,h,angle+side*pitch));
        const idx=[0,1,2,0,2,3,4,7,6,4,6,5,0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0];
        const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flat(),3));geo.setIndex(idx);geo.computeVertexNormals();this.mesh(part,geo,'gear',[0,0,0],rotor);
      }
      this.ring(part,12,6,9,[0,0,g.R*c+8],rotor);this.box(part,[6,2,1],[g.R*s*.7,0,g.R*c+5.5],'fastener',rotor);return rotor;
    };
    this.input.group.rotation.y=Math.PI/2;this.inputSpin=make(this.input,p.z1,g.d1);this.outputSpin=make(this.output,p.z2,g.d2);
    this.inputShaft=this.part('input-shaft','输入轴','输入轴与主动锥齿轮同轴，沿 X 方向布置。',1);
    this.outputShaft=this.part('output-shaft','输出轴','输出轴与从动锥齿轮同轴，沿 Z 方向布置；两轴延长线相交。',1);
    this.inputShaft.group.rotation.y=Math.PI/2;
    for(const [part,z,axis]of [[this.inputShaft,g.z1,'x'],[this.outputShaft,g.z2,'z']]){
      this.cylinder(part,5.8,76,[0,0,z+30]);this.cylinder(part,10,7,[0,0,z+66],'fastener');
      const x=axis==='x'?z+37:0,zz=axis==='z'?z+37:0;
      this.box(this.frame,[axis==='x'?23:33,O.y-30,axis==='x'?33:23],[x,(O.y+6)/2,zz]);
      const ring=this.ring(this.frame,17,6.2,23,[x,O.y,zz]);if(axis==='x')ring.rotation.y=Math.PI/2;
      this.box(this.frame,[45,9,48],[x,12.5,zz]);
    }
  }
  buildJack(p){
    this.deck(this.frame,150,86,0,0);this.box(this.frame,[38,10,32],[0,13,0]);this.ring(this.frame,14,4.7,32,[0,25,0]);
    this.box(this.output,[90,12,64],[0,19,0],'housing');this.ring(this.output,14,4.7,28,[0,0,0]);this.box(this.output,[70,5,45],[0,27,0],'rubber');
    this.legs=[];for(const [id,name,ends,z]of [['lower-left','左下支臂',['A','L'],-10],['upper-left','左上支臂',['L','T'],10],['lower-right','右下支臂',['A','R'],10],['upper-right','右上支臂',['R','T'],-10]]){const part=this.part(id,name,'等长支臂，通过铰链与相邻支臂组成菱形。运动中长度保持不变。',3);this.bar(part,p.arm);this.legs.push({part,ends,z});}
    const length=2*p.arm*Math.sqrt(.96)+28;this.segment(this.input,[0,0,0],[length,0,0],5.5);
    const turns=length/p.lead,segments=Math.ceil(turns*16),points=Array.from({length:segments+1},(_,i)=>{const x=length*i/segments,t=x/p.lead*2*Math.PI;return new THREE.Vector3(x,6.4*Math.cos(t),6.4*Math.sin(t));});
    this.tube(this.input,points,.8);this.segment(this.input,[-30,-35,0],[-30,35,0],3);this.segment(this.input,[-30,0,0],[0,0,0],5.5);this.segment(this.input,[-30,-35,0],[-30,-48,0],6,'rubber');
    this.nuts=[];for(const id of ['L','R']){const part=this.part('nut-'+id,id==='L'?'丝杠止推座':'移动螺母','铰接螺母与支臂连接，丝杠转动改变左右铰点间距。',2);const r=this.ring(part,14,6.8,24,[0,0,0]);r.rotation.y=Math.PI/2;for(const z of [-19,19])this.cylinder(part,4.5,16,[0,0,z]);this.nuts.push({part,key:id});}
    this.pins=this.part('pins','上下铰链销','连接底座与托座处的支臂，限制轴向窜动。',1);this.pinGroups=[['A',this.pin(this.pins,{x:0,y:0},0,43)],['T',this.pin(this.pins,{x:0,y:0},0,43)]];
  }
  buildRatchet(p){
    const O=solve(this.kind,p,0).O;this.deck(this.frame,150,95);this.support(this.frame,O);
    this.shape(this.output,ratchetOutline(p),12,6);this.ring(this.output,22,6,18,[0,0,0]);this.cylinder(this.output,8,38,[0,0,24]);this.box(this.output,[13,13,13],[0,0,46],'fastener');
    this.ring(this.input,24,8.4,8,[0,0,-12]);this.segment(this.input,[0,0,-12],[-125,30,-12],7,'shaft');this.segment(this.input,[-88,21,-12],[-133,32,-12],11,'rubber');
    this.segment(this.input,[0,0,-12],[30,74,-12],6);this.cylinder(this.input,5,30,[30,74,-1],'fastener');
    this.pawl=this.part('pawl','弹簧压紧棘爪','驱动时抵住陡齿面；回程时绕手柄上的支点抬起，越过齿背。',1);
    const outline=[[0,-7],[16,-5],[31,0],[18,7],[0,7]];this.shape(this.pawl,outline,8,3.5,'shaft');this.ring(this.pawl,8,3.5,10,[0,0,0]);
    this.spring=this.part('spring','棘爪压紧弹簧（示意）','弹簧使棘爪趋向齿面。这里展示弹簧位置，不计算压紧力。',1);
    const springPoints=Array.from({length:64},(_,i)=>{const t=i/63*Math.PI*4;return new THREE.Vector3(4*Math.cos(t),4*Math.sin(t),t/(Math.PI*4)*8);});this.tube(this.spring,springPoints,.65);
  }
  buildCam(p){
    const kind=this.kind,s=solve(kind,p,0),O=s.O,isRoller=kind==='roller-cam';
    this.deck(this.frame,170,100);this.support(this.frame,O);
    if(isRoller)this.shape(this.input,Array.from({length:721},(_,i)=>{const q=camPoint(p,i/2);return[q.x,q.y];}),14,6);
    else {this.circle(this.input,p.radius,14,[p.eccentricity,0,0],6);this.cylinder(this.input,2,1,[p.eccentricity,0,7.6],'fastener');if(p.eccentricity>0)this.segment(this.input,[0,0,7.6],[p.eccentricity,0,7.6],.6,'fastener');}
    this.ring(this.input,12,6,20,[0,0,0]);
    this.shaft=this.part('shaft','驱动轴与挡圈','驱动轴穿过凸轮转轴孔，向凸轮输入旋转运动。',1);this.cylinder(this.shaft,5.8,55,[0,0,-8]);this.ring(this.shaft,10,6,4,[0,0,21]);
    const upper=O.y+(isRoller?p.base+p.roller+p.lift:p.radius+p.eccentricity)+75;
    this.guide=this.part('guide','竖直导向与支柱','导向套约束从动件只沿竖直方向平移。',4);
    this.box(this.guide,[17,upper-20,24],[59,(upper+20)/2,-20]);this.box(this.guide,[44,16,24],[37,upper,-10]);
    const collar=this.ring(this.guide,15,4.1,22,[0,upper,0]);collar.rotation.x=Math.PI/2;
    this.box(this.guide,[42,10,52],[59,13,-20]);this.guideHeight=upper;
    if(isRoller){
      this.roller=this.part('roller','接触滚子','滚子中心按升程曲线移动，实际凸轮轮廓按滚子半径偏置；两者保持相切。',1);
      this.ring(this.roller,p.roller,3,12,[0,0,0]);this.cylinder(this.roller,2.8,26,[0,0,0],'fastener');this.box(this.roller,[p.roller*.65,1,1],[p.roller*.55,0,6.5],'fastener');
      for(const z of [-11,11])this.box(this.output,[6,24,4],[0,11,z],'shaft');
      this.segment(this.output,[0,21,0],[0,145,0],3.5);this.box(this.output,[30,4,26],[0,27,0],'bearing');
    }else{
      this.box(this.output,[2*(p.eccentricity+17),8,26],[0,4,0],'shaft');this.segment(this.output,[0,8,0],[0,145,0],3.5);this.box(this.output,[28,4,25],[0,20,0],'bearing');
    }
    this.spring=this.part('spring','接触保持弹簧（示意）','压缩弹簧使从动件趋向凸轮表面。仅展示几何，不模拟弹簧动力学。',2);
    const pts=Array.from({length:145},(_,i)=>{const t=i/144*Math.PI*16;return new THREE.Vector3(10*Math.cos(t),60*i/144,10*Math.sin(t));});this.springMesh=this.tube(this.spring,pts,1.1);
  }
  buildGeneva(p){
    const g=this.g=genevaGeometry(p),s=solve(this.kind,p,0);
    this.deck(this.frame,p.center+2*g.outer+60,100,0,-12);this.support(this.frame,s.A);this.support(this.frame,s.D);
    this.circle(this.input,g.r+g.pin+7,6,[0,0,-16],6,'shaft');this.cylinder(this.input,g.pin,35,[g.r,0,0],'bearing');this.ring(this.input,15,6,22,[0,0,-6]);
    // Relief on the drive-facing half opens space while the pin is in a slot.
    const lock=new THREE.Shape();lock.moveTo(0,0);lock.absarc(0,0,g.lock,Math.PI/2,3*Math.PI/2,false);lock.closePath();
    this.locking=this.part('locking','锁止扇面','主动销退出时，圆弧锁止面对应槽轮的凹圆弧，帮助理解停歇定位。',2);this.shape(this.locking,lock,10,0,'cover');
    this.shape(this.output,genevaOutline(p),12,6.3);this.ring(this.output,16,6.3,20,[0,0,0]);
    this.shaft=this.part('shaft','固定轴与挡圈','两根平行固定轴支承主动盘和槽轮；中心距决定主动销圆的尺寸。',1);
    this.pinGroups=[['A',this.pin(this.shaft,s.A,-9,52)],['D',this.pin(this.shaft,s.D,-9,52)]];
  }
  update(input,render=true){
    this.angle=input;const s=this.solution=solve(this.kind,this.p,input),p=this.p;
    if(this.kind==='bevel-gears'){
      for(const part of [this.input,this.output,this.inputShaft,this.outputShaft])part.base.set(0,s.O.y,0);
      this.inputSpin.rotation.z=rad(input)+Math.PI;this.outputSpin.rotation.z=rad(s.outputAngle)+Math.PI/p.z2;
    }else if(this.kind==='scissor-jack'){
      this.output.base.set(s.T.x,s.T.y,0);for(const {part,ends,z}of this.legs)this.poseBar(part,s[ends[0]],s[ends[1]],z);
      this.input.base.set(s.L.x-12,s.L.y,0);this.input.group.rotation.x=input*2*Math.PI;
      for(const {part,key}of this.nuts)part.base.set(s[key].x,s[key].y,0);
      for(const [key,group]of this.pinGroups)group.position.set(s[key].x,s[key].y,0);
    }else if(this.kind==='ratchet-pawl'){
      this.input.base.set(0,s.O.y,0);this.output.base.set(0,s.O.y,0);this.input.group.rotation.z=rad(s.handleAngle);this.output.group.rotation.z=rad(s.outputAngle);
      this.pawl.base.set(s.pawl.pivot.x,s.O.y+s.pawl.pivot.y,1);this.pawl.group.rotation.z=s.pawl.rotation;
      this.spring.base.set(s.pawl.pivot.x,s.O.y+s.pawl.pivot.y,7);this.spring.group.rotation.z=rad(s.handleAngle);
    }else if(this.kind==='geneva-drive'){
      this.input.base.set(s.A.x,s.A.y,0);this.input.group.rotation.z=rad(s.driverAngle);
      this.locking.base.set(s.A.x,s.A.y,0);this.locking.group.rotation.z=rad(s.driverAngle);
      this.output.base.set(s.D.x,s.D.y,0);this.output.group.rotation.z=rad(s.outputAngle);
    }else{
      this.input.base.set(0,s.O.y,0);this.input.group.rotation.z=rad(input);this.shaft.base.set(0,s.O.y,0);
      this.output.base.set(0,s.follower.y,0);
      const offset=this.kind==='roller-cam'?30:24;this.spring.base.set(0,s.follower.y+offset,0);this.springMesh.scale.y=(this.guideHeight-12-s.follower.y-offset)/60;
      if(this.roller){this.roller.base.set(0,s.follower.y,0);this.roller.group.rotation.z=rollerSpin(p,input);}
    }
    this.applyOffsets();if(render)this.render();
  }
  applyOffsets(){
    for(const part of this.parts){const amount=this.step?(part.order<=this.step?1:0):this.amount;part.group.position.copy(part.base);
      if(this.kind==='bevel-gears'){
        const offsets={input:[105,0,0],output:[0,0,105],'input-shaft':[195,0,0],'output-shaft':[0,0,195],frame:[0,-70,0]};part.group.position.addScaledVector(new THREE.Vector3(...offsets[part.id]),amount);
      }else part.group.position.z+=part.zOffset*amount;
    }
  }
  pointerAngle(e){
    const v=new THREE.Vector3();if(!this.ray(e).ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),0),v))return;
    const origin=this.solution.O||this.solution.A;return deg(Math.atan2(v.y-origin.y,v.x-origin.x));
  }
  pointerDown(e){if(this.root)this.dragAnchor={pointer:this.pointerAngle(e),input:this.angle};super.pointerDown(e);}
  dragTo(e){
    if(['scissor-jack','ratchet-pawl','bevel-gears'].includes(this.kind))return;
    const angle=this.pointerAngle(e);if(!Number.isFinite(angle)||!Number.isFinite(this.dragAnchor?.pointer))return;
    this.onDrag(wrap(this.dragAnchor.input+wrap(angle-this.dragAnchor.pointer+180)-180));
  }
}
