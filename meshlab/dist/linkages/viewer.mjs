import * as THREE from '../assets/three.module.js';
import {OrbitControls} from '../assets/OrbitControls.js';
import {createReferenceStage, fitReferenceCamera, finishes, setPartHighlight, machinedRing} from '../assets/reference-stage.mjs';
import {solve, samples, definitions, clamp, angleRange, deg, wrap} from './mechanics.mjs';

// Parts stay in separate axial layers. The exploded state moves the entire part,
// including its fasteners, along the real pin axes; pose coordinates remain intact.
export class LinkageViewer {
  constructor(host,kind,onSelect,onDrag) {
    Object.assign(this,{host,kind,onSelect,onDrag,parts:[],selected:null,amount:0,step:0,dragMode:false,housing:'solid',labels:false});
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(33,1,1,10000);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    host.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label',(definitions[kind]?.title||'机械机构')+'三维视图；可在零件目录选择，使用下方角度滑块驱动。');
    this.stage=createReferenceStage(this.scene,this.renderer);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.enableDamping=false;this.controls.minDistance=60;this.controls.maxDistance=4000;
    this.controls.addEventListener('change',()=>this.render());
    this.dark=matchMedia('(prefers-color-scheme: dark)');
    this.theme=()=>{this.stage.setDark(this.dark.matches);this.render();};this.dark.addEventListener('change',this.theme);this.theme();
    this.resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();if(this.root)this.fit();this.render();});this.resize.observe(host);
    this.events=new AbortController();const options={signal:this.events.signal};
    host.addEventListener('pointerdown',e=>this.pointerDown(e),options);
    host.addEventListener('pointermove',e=>this.pointerMove(e),options);
    for(const type of ['pointerup','pointercancel','lostpointercapture'])host.addEventListener(type,e=>this.pointerEnd(e),options);
    this.homeDirection=new THREE.Vector3(.32,.27,1).normalize();
  }
  addPart(id,name,description,order,zOffset) {
    const group=new THREE.Group();this.root.add(group);
    const p={id,name,description,group,order,zOffset,base:new THREE.Vector3()};this.parts.push(p);return p;
  }
  mesh(part,geometry,finish='gear',position=[0,0,0],parent=part.group) {
    const material=new THREE.MeshStandardMaterial({...finishes[finish]});
    const m=new THREE.Mesh(geometry,material);m.position.set(...position);m.castShadow=true;m.receiveShadow=true;m.userData.partId=part.id;parent.add(m);return m;
  }
  box(part,size,pos,finish='housing',parent=part.group) {return this.mesh(part,new THREE.BoxGeometry(...size),finish,pos,parent);}
  cylinder(part,r,length,pos,finish='shaft',parent=part.group) {const g=new THREE.CylinderGeometry(r,r,length,40);g.rotateX(Math.PI/2);return this.mesh(part,g,finish,pos,parent);}
  ring(part,outer,inner,depth,pos,parent=part.group) {return this.mesh(part,machinedRing(outer,inner,depth),'bearing',pos,parent);}
  capsule(length,radius,Type=THREE.Shape,start=0) {
    const shape=new Type();shape.moveTo(start,-radius);shape.lineTo(start+length,-radius);
    shape.absarc(start+length,0,radius,-Math.PI/2,Math.PI/2,false);shape.lineTo(start,radius);
    shape.absarc(start,0,radius,Math.PI/2,3*Math.PI/2,false);return shape;
  }
  bar(part,length,slot=false) {
    const shape=this.capsule(length,11);
    for(const x of [0,length]){const h=new THREE.Path();h.absarc(x,0,4.7,0,2*Math.PI,true);shape.holes.push(h);}
    if(slot)shape.holes.push(this.capsule(length-36,6.6,THREE.Path,18));
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:7,bevelEnabled:true,bevelSize:.6,bevelThickness:.6,bevelSegments:2,curveSegments:20});geometry.translate(0,0,-3.5);
    this.mesh(part,geometry,'gear');
    for(const x of [0,length])this.ring(part,8,4.8,9,[x,0,0]);
  }
  support(part,P) {
    this.box(part,[30,P.y-17,24],[P.x,(P.y+17)/2,-26]);
    this.ring(part,19,6.2,24,[P.x,P.y,-26]);
    this.box(part,[52,9,62],[P.x,12.5,-17]);
    for(const x of [-18,18])for(const z of [-38,6])this.cylinder(part,3,4,[P.x+x,19,z],'fastener').rotation.x=Math.PI/2;
  }
  pin(parent,point,z,length=29) {
    const group=new THREE.Group();parent.group.add(group);group.position.set(point.x,point.y,z);
    this.cylinder(parent,4.5,length,[0,0,0],'shaft',group);
    this.ring(parent,8,4.5,2,[0,0,length/2-1],group);
    const cap=this.cylinder(parent,6,3,[0,0,length/2+1],'fastener',group);
    this.box(parent,[6,1,1],[0,0,length/2+2.7],'bearing',group);
    return group;
  }
  poseBar(part,P,Q,z) {part.base.set(P.x,P.y,z);part.group.rotation.z=Math.atan2(Q.y-P.y,Q.x-P.x);}
  clear() {
    if(!this.root)return;
    this.root.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});this.scene.remove(this.root);
  }
  build(params,angle) {
    this.clear();this.p={...params};this.parts=[];this.root=new THREE.Group();this.scene.add(this.root);this.amount=0;this.step=0;this.separationDirection=null;
    const s=solve(this.kind,params,angle),p=params,kind=this.kind;
    const frame=this.addPart('frame','机架与轴承支座','固定转轴与底座构成机架，轴承支承输入轴，约束机构的固定端。',4,-100);
    this.frame=frame;
    const trajectory=samples(kind,p,72),all=trajectory.flatMap(v=>['A','B','C','D','O','slider'].flatMap(k=>v[k]?[v[k]]:[]));
    const minX=kind==='scotch-yoke'?-p.r-80:s.D?-40:Math.min(...all.map(v=>v.x))-35;
    const maxX=kind==='scotch-yoke'?p.r+80:s.D?p.d+40:Math.max(...all.map(v=>v.x))+35;
    this.baseBounds={minX,maxX};this.box(frame,[maxX-minX,10,98],[(minX+maxX)/2,3,-15]);
    for(const x of [minX+12,maxX-12])for(const z of [-48,18])this.box(frame,[18,5,18],[x,-4,z],'rubber');
    for(const point of [s.A,...(s.D?[s.D]:[]),...(s.O?[s.O]:[])])this.support(frame,point);
    this.input=this.addPart('input',kind==='double-rocker'?'输入摇杆':kind==='parallelogram'?'左侧台灯臂':'输入曲柄','输入构件绕固定转轴运动。开启“拖动输入杆”可直接驱动，也可使用角度滑块。',3,-45);
    this.bar(this.input,p.a||p.r);
    this.pins=this.addPart('pins','铰链销与挡圈','销轴连接相邻构件，允许绕轴转动。拆卸时先释放轴向挡圈与连接销。',1,150);
    this.pinGroups=[];
    if(kind==='scotch-yoke') {
      this.output=this.addPart('output','开槽轭架','竖直槽让曲柄销上下滑动，轭架被水平导向，位移只取曲柄销的水平分量。',2,75);
      const shape=this.capsule(2*p.r+20,15),hole=this.capsule(2*p.r+12,6.7,THREE.Path,4);shape.holes.push(hole);
      const geo=new THREE.ExtrudeGeometry(shape,{depth:9,bevelEnabled:true,bevelSize:.7,bevelThickness:.7,bevelSegments:2,curveSegments:24});geo.translate(-p.r-10,0,-4.5);geo.rotateZ(Math.PI/2);this.mesh(this.output,geo);
      for(const side of [-1,1]){const length=p.r+110;const rod=this.cylinder(this.output,5,length,[side*(15+length/2),0,0]);rod.rotation.y=Math.PI/2;}
      this.slider=this.addPart('slider','槽内滑块','滑块绕曲柄销转动，并沿轭架内槽滑动；它与轭架的相对竖直位移为 r sin θ。',2,110);
      this.box(this.slider,[12,12,11],[0,0,0],'bearing');
      this.guide=this.addPart('guide','直线导向座','两侧导向座固定在机架上，仅允许轭架水平移动。',4,-145);
      for(const side of [-1,1]){const x=side*(p.r+55);this.box(this.guide,[24,82,28],[x,55,12]);this.box(this.guide,[45,8,55],[x,12,12]);const ring=this.ring(this.guide,13,5.2,25,[x,105,12]);ring.rotation.y=Math.PI/2;}
      this.pinGroups.push(['A',this.pin(this.pins,s.A,-12,45)],['B',this.pin(this.pins,s.B,6,30)]);
    } else if(kind==='quick-return') {
      this.output=this.addPart('output','摆动导杆','导杆绕下方 A 轴摆动；曲柄销上的滑块在长槽中运动，形成不对称的行程时间。',3,68);this.bar(this.output,p.lever,true);
      this.slider=this.addPart('slider','导杆槽内滑块','滑块连接曲柄销与开槽导杆。滑块随导杆方向转动，同时沿槽移动。',2,110);this.box(this.slider,[14,12,9],[0,0,0],'bearing');
      this.coupler=this.addPart('coupler','滑枕连杆','连接导杆顶端与滑枕，补偿导杆末端弧线运动的竖直分量。',2,190);this.bar(this.coupler,p.rod);
      this.ram=this.addPart('ram','刨床滑枕与刀架','滑枕沿水平导轨往复。正转时向左慢速工作，向右快速空回。刀架仅作结构示意。',3,240);
      this.box(this.ram,[38,27,50],[0,0,-15],'cover');this.box(this.ram,[13,40,15],[-16,-22,3],'shaft');this.box(this.ram,[7,18,8],[-19,-47,3],'fastener');
      this.guide=this.addPart('guide','滑枕导轨','固定导轨把滑枕约束为水平直线运动。',4,-155);
      const xs=trajectory.map(v=>v.slider.x),lo=Math.min(...xs)-32,hi=Math.max(...xs)+32,y=s.slider.y;
      for(const dy of [-20,20])this.box(this.guide,[hi-lo,10,12],[(lo+hi)/2,y+dy,-4],'housing');
      for(const x of [lo+6,hi-6]){this.box(this.guide,[12,y-22,15],[x,(y-22)/2,-10]);this.box(this.guide,[28,8,45],[x,12,-10]);}
      this.pinGroups.push(['O',this.pin(this.pins,s.O,-12,45)],['A',this.pin(this.pins,s.A,0,65)],['B',this.pin(this.pins,s.B,7,28)],['C',this.pin(this.pins,s.C,20,28)],['slider',this.pin(this.pins,s.slider,29,28)]);
    } else {
      this.coupler=this.addPart('coupler',kind==='parallelogram'?'水平末端连杆与灯头':'中间连杆','连接输入端与输出端，使四根构件形成闭环。'+(kind==='parallelogram'?'灯头与此连杆固定，保持相对机架水平。':''),2,85);this.bar(this.coupler,p.b||p.d);
      this.output=this.addPart('output',kind==='parallelogram'?'右侧台灯臂':'输出摇杆','输出构件绕右侧固定轴摆动，其角度由四杆闭合关系决定。',3,45);this.bar(this.output,p.c||p.a);
      if(kind==='parallelogram') {
        this.box(this.coupler,[48,7,28],[p.d/2,18,0],'cover');this.box(this.coupler,[37,2,23],[p.d/2,13,0],'bearing');this.box(this.coupler,[8,15,10],[p.d/2,8,0],'shaft');
      }
      this.pinGroups.push(['A',this.pin(this.pins,s.A,-10,46)],['D',this.pin(this.pins,s.D,-10,46)],['B',this.pin(this.pins,s.B,6,30)],['C',this.pin(this.pins,s.C,6,30)]);
    }
    this.update(angle);
    // Allocate non-overlapping axial bands from actual part thicknesses. This
    // also keeps wide base plates apart from the rails at full disassembly.
    let cursor=0;
    for(const id of ['frame','guide','input','output','slider','pins','coupler','ram']) {
      const part=this.parts.find(p=>p.id===id);if(!part)continue;
      const box=new THREE.Box3().setFromObject(part.group);
      part.zOffset=cursor-box.min.z;cursor+=box.max.z-box.min.z+28;
    }
    for(const part of this.parts)part.zOffset-=(cursor-28)/2;
    this.motionBounds=new THREE.Box3();
    for(const v of trajectory){this.update(v.angle,false);this.motionBounds.union(new THREE.Box3().setFromObject(this.root));}
    this.update(angle,false);this.stage.fit(this.motionBounds,this.motionBounds.getCenter(new THREE.Vector3()));
    this.setHousing(this.housing);this.home();this.select(null);
  }
  update(angle,render=true) {
    this.angle=angle;const s=this.solution=solve(this.kind,this.p,angle);
    this.poseBar(this.input,s.O||s.A,s.B,0);
    if(this.kind==='scotch-yoke'){this.output.base.set(s.slider.x,s.slider.y,12);this.slider.base.set(s.B.x,s.B.y,12);}
    else if(this.kind==='quick-return') {
      this.poseBar(this.output,s.A,s.C,12);this.poseBar(this.coupler,s.C,s.slider,26);
      this.slider.base.set(s.B.x,s.B.y,12);this.slider.group.rotation.z=this.output.group.rotation.z;
      this.ram.base.set(s.slider.x,s.slider.y,29);
    } else {this.poseBar(this.output,s.D,s.C,0);this.poseBar(this.coupler,s.B,s.C,12);}
    for(const [key,group]of this.pinGroups){group.position.x=s[key].x;group.position.y=s[key].y;}
    this.applyOffsets();if(render)this.render();
  }
  applyOffsets() {for(const part of this.parts){const amount=this.step?(part.order<=this.step?1:0):this.amount;part.group.position.copy(part.base);part.group.position.z+=part.zOffset*amount;}}
  separationView(active) {
    if(!this.camera)return;
    if(active&&!this.separationDirection){this.separationDirection=this.camera.position.clone().sub(this.controls.target).normalize();this.camera.position.copy(this.controls.target).add(new THREE.Vector3(1.15,.45,1));}
    if(!active&&this.separationDirection){this.camera.position.copy(this.controls.target).add(this.separationDirection);this.separationDirection=null;}
  }
  explode(amount) {this.separationView(amount>0);this.amount=clamp(amount,0,1);this.step=0;this.applyOffsets();this.fit();}
  assembly(step) {this.separationView(step>0);this.step=clamp(step,0,4);this.amount=0;this.applyOffsets();this.fit();}
  restore() {this.separationView(false);this.step=0;this.amount=0;this.applyOffsets();this.fit();}
  setHousing(mode) {this.housing=mode;for(const p of this.parts.filter(p=>p.id==='frame'||p.id==='guide')){p.group.visible=mode!=='hidden';p.group.traverse(o=>{if(o.isMesh){o.material.transparent=mode==='transparent';o.material.opacity=mode==='transparent'?.16:1;o.material.depthWrite=mode!=='transparent';}});}this.render();}
  select(id) {this.selected=this.parts.some(p=>p.id===id)?id:null;setPartHighlight(this.parts,this.selected);this.onSelect(this.parts.find(p=>p.id===this.selected)||null);this.render();}
  home() {this.camera.up.set(0,1,0);this.camera.position.copy(this.controls.target).add(this.homeDirection);this.fit();}
  view(which) {this.camera.up.set(0,1,0);this.camera.position.copy(this.controls.target).add(which==='front'?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,.001));this.fit();}
  fit() {
    if(!this.motionBounds)return;this.controls.update();
    const box=this.amount||this.step?new THREE.Box3().setFromObject(this.root):this.motionBounds;
    fitReferenceCamera(this.host,this.camera,this.controls,box.getCenter(new THREE.Vector3()),[box]);this.render();
  }
  render() {
    if(!this.renderer)return;this.renderer.render(this.scene,this.camera);
    if(this.labels&&this.solution){for(const element of this.host.parentElement.querySelectorAll('[data-joint]')){const point=this.solution[element.dataset.joint];element.hidden=!point||!!(this.amount||this.step);if(!point)continue;const v=new THREE.Vector3(point.x,point.y,35).project(this.camera);element.style.left=(v.x+1)*this.host.clientWidth/2+'px';element.style.top=(1-v.y)*this.host.clientHeight/2+'px';}}
  }
  ray(e) {const r=this.host.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),this.camera);return ray;}
  hit(e) {return this.ray(e).intersectObjects(this.parts.filter(p=>p.group.visible).map(p=>p.group),true).find(h=>h.object.isMesh);}
  pointerDown(e) {
    if(e.button!==0||!this.root)return;
    this.dragAnchor={pointer:this.pointerAngle(e),input:this.angle};
    this.down={x:e.clientX,y:e.clientY,id:e.pointerId};
    const hit=this.hit(e);
    if(this.dragMode&&!this.amount&&!this.step&&hit&&(this.draggablePartIds||['input','coupler','output','slider','pins','ram']).includes(hit.object.userData.partId)) {
      this.dragging=e.pointerId;this.controls.enabled=false;this.host.setPointerCapture(e.pointerId);
      this.onDrag(this.angle);this.select('input');this.dragTo(e);
    }
  }
  pointerMove(e) {if(this.dragging===e.pointerId)this.dragTo(e);}
  pointerAngle(e) {
    const point=new THREE.Vector3(),plane=new THREE.Plane(new THREE.Vector3(0,0,1),0);
    if(!this.ray(e).ray.intersectPlane(plane,point))return;
    const pivot=this.solution.O||this.solution.A;
    return deg(Math.atan2(point.y-pivot.y,point.x-pivot.x));
  }
  dragTo(e) {
    const pointer=this.pointerAngle(e);if(!Number.isFinite(pointer)||!Number.isFinite(this.dragAnchor?.pointer))return;
    let angle=this.dragAnchor.input+wrap(pointer-this.dragAnchor.pointer+180)-180;
    const range=angleRange(this.kind,this.p);
    angle=range.max===360?wrap(angle):clamp(angle,range.min,range.max);
    this.onDrag(angle);
  }
  pointerEnd(e) {
    if(this.dragging===e.pointerId){this.dragging=null;this.controls.enabled=!this.dragMode;this.down=null;if(this.host.hasPointerCapture(e.pointerId))this.host.releasePointerCapture(e.pointerId);return;}
    if(e.type==='pointerup'&&this.down&&Math.hypot(e.clientX-this.down.x,e.clientY-this.down.y)<6){const h=this.hit(e);this.select(h?.object.userData.partId||null);}this.down=null;
  }
  setDragMode(active) {this.dragMode=active;this.controls.enabled=!active;this.host.classList.toggle('driving',active);}
  state() {
    const r=this.host.getBoundingClientRect();
    return {angle:this.angle,amount:this.amount,step:this.step,selected:this.selected,housing:this.housing,dragMode:this.dragMode,
      parts:this.parts.map(p=>{const box=new THREE.Box3().setFromObject(p.group),min=box.min.toArray(),max=box.max.toArray();const projected=[];for(const x of [min[0],max[0]])for(const y of [min[1],max[1]])for(const z of [min[2],max[2]]){const v=new THREE.Vector3(x,y,z).project(this.camera);projected.push([r.left+(v.x+1)*r.width/2,r.top+(1-v.y)*r.height/2]);}return {id:p.id,min,max,visible:p.group.visible,projected,highlighted:p.id===this.selected};}),
      joints:Object.fromEntries(Object.entries(this.solution).filter(([,v])=>v&&typeof v==='object'&&'x'in v).map(([key,p])=>{const v=new THREE.Vector3(p.x,p.y,0).project(this.camera);return [key,{x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2}];}))};
  }
  dispose(){this.events.abort();this.resize.disconnect();this.dark.removeEventListener('change',this.theme);this.controls.dispose();this.clear();this.stage.dispose();this.renderer.dispose();}
}
