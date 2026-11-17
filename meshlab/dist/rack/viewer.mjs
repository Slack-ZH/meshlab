import * as THREE from 'three';
import {OrbitControls} from '../assets/OrbitControls.js';
import {geometry,validate,ANIMATION_SCALE,pinionOutline,rackOutline,advanceMotion} from './mechanics.mjs';

export const steps=['完整装配','取下锁紧环','移开小齿轮','抽出传动轴','分离齿条与导轨'];
const geometryKeys=['module','teeth','rackTeeth','faceWidth'];
const steel=0xa4b0bd,dark=0x354353,blue=0x2082a2,warm=0xba8750;
export class RackViewer {
  constructor(host,onSelect){
    this.host=host;this.onSelect=onSelect;this.parts=[];this.amount=0;this.step=0;this.selected='pinion';
    this.playing=false;this.speed=1;this.labelsOn=false;this.housingMode='solid';this.open=false;
    this.angle=0;this.direction=1;this.time=0;this.onMotion=()=>{};this.contactView=false;
    this.events=new AbortController();this.label=host.closest('.viewer-panel')?.querySelector('#selection-label');
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(35,1,1,12000);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    host.append(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','齿轮齿条传动三维视图，拖动旋转，滚轮缩放；点击选择零件。');
    this.onControlChange=()=>this.render();this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.enableDamping=true;this.controls.minDistance=20;this.controls.maxDistance=7000;
    this.controls.addEventListener('change',this.onControlChange);
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x798597,3));
    for(const [x,y,z,power] of [[-400,900,1100,3],[800,200,-500,2],[-800,-250,400,1]]){
      const light=new THREE.DirectionalLight(0xffffff,power);light.position.set(x,y,z);this.scene.add(light);
    }
    this.home();
    this.resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();if(this.root)this.fitModel();this.render();});
    this.resize.observe(host);
    let down;
    const pointers = new Set();
    host.addEventListener('pointerdown',e=>{
      pointers.add(e.pointerId);
      down=pointers.size===1?[e.clientX,e.clientY]:null;
    },{signal:this.events.signal});
    host.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);down=null;},{signal:this.events.signal});
    host.addEventListener('pointerup',e=>{
      pointers.delete(e.pointerId);
      if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;
      down=null;
      const r=host.getBoundingClientRect(),ray=new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),this.camera);
      const pick=[];this.scene.traverse(o=>{if(o.isMesh&&o.userData.partId&&this.isVisible(o))pick.push(o);});
      const hit=ray.intersectObjects(pick,false)[0];if(hit)this.select(hit.object.userData.partId);
    },{signal:this.events.signal});
    const loop=now=>{
      if(this.disposed)return;this.frame=requestAnimationFrame(loop);
      const dt=this.lastFrame===undefined?0:Math.min((now-this.lastFrame)/1000,.05);this.lastFrame=now;
      if(this.playing&&this.root){
        this.time += dt;
        const next = advanceMotion(this.p,this.angle,this.direction,dt,this.speed);
        this.angle = next.angle;
        if (next.atLimit) this.playing = false;
        this.updateMotion();
        this.onMotion();
        this.render();
      }
      this.controls.update();
    };
    this.frame=requestAnimationFrame(loop);
  }
  isVisible(o){while(o){if(!o.visible)return false;o=o.parent;}return true;}
  render(){if(this.disposed)return;const part=this.parts.find(p=>p.id===this.selected);if(this.label){this.label.hidden=!(this.labelsOn&&part&&this.isVisible(part.group));if(part&&this.label.textContent!==part.name)this.label.textContent=part.name;}this.renderer.render(this.scene,this.camera);}
  material(color){return new THREE.MeshStandardMaterial({color,metalness:.68,roughness:.32,side:THREE.DoubleSide});}
  part(id,name,description,spec,step){const group=new THREE.Group();group.userData.partId=id;this.root.add(group);const p={id,name,description,spec,step,group,offset:new THREE.Vector3()};this.parts.push(p);return p;}
  mesh(p,geo,color,pos=[0,0,0],parent=p.group){const mesh=new THREE.Mesh(geo,this.material(color));mesh.position.set(...pos);mesh.userData.partId=p.id;parent.add(mesh);return mesh;}
  cylinder(p,radius,length,color,pos=[0,0,0],parent=p.group){const geo=new THREE.CylinderGeometry(radius,radius,length,96);geo.rotateX(Math.PI/2);return this.mesh(p,geo,color,pos,parent);}
  ring(p,outer,inner,depth,color,parent=p.group){
    const shape=new THREE.Shape();shape.absarc(0,0,outer,0,2*Math.PI);const hole=new THREE.Path();hole.absarc(0,0,inner,0,2*Math.PI,true);shape.holes.push(hole);
    const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:96});geo.translate(0,0,-depth/2);return this.mesh(p,geo,color,[0,0,0],parent);
  }
  profile(part, outline, depth, color, holeRadius=0, parent=part.group) {
    const shape = new THREE.Shape(outline.map(([x,y]) => new THREE.Vector2(x,y)));
    if (holeRadius) {
      const hole = new THREE.Path();
      hole.absarc(0,0,holeRadius,0,Math.PI*2,true);
      shape.holes.push(hole);
      const webInner = holeRadius * 1.7;
      const windowRadius = (this.g.rootRadius - webInner) * 0.22;
      const windowCircle = (this.g.rootRadius + webInner) / 2;
      for(let i=0;i<6;i++) {
        const angle=i*Math.PI/3, window=new THREE.Path();
        window.absarc(windowCircle*Math.cos(angle),windowCircle*Math.sin(angle),windowRadius,0,Math.PI*2,true);
        shape.holes.push(window);
      }
    }
    const mesh = this.mesh(part, new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled:false, curveSegments:48,
    }), color, [0,0,-depth/2], parent);
    return mesh;
  }
  build(p) {
    validate(p);
    if (this.p && geometryKeys.every(key=>this.p[key]===p[key])) {
      this.p={...p};
      if(p.inputRPM===0)this.setPlaying(false);
      return;
    }
    this.clearGeometry();
    this.parts=[];
    this.angle=0;this.playing=false;this.amount=0;this.step=0;
    this.p={...p};this.g=geometry(p);
    this.root=new THREE.Group();this.scene.add(this.root);
    const {radius,length,pitch}=this.g, m=p.module, width=p.faceWidth;
    const rackBottom=-radius-5.25*m;
    const shaftRadius=Math.min(5,radius*.22);
    const pinion=this.part('pinion','小齿轮','小齿轮通过齿面啮合推动齿条。分度圆直径等于模数乘齿数；轮辐上的孔方便看清旋转相位。转过一齿，齿条前进一个齿距。','模数 '+m+' mm · '+p.teeth+' 齿 · 分度圆 Ø'+(radius*2)+' mm',2);
    pinion.category='transmission';
    this.rotor=new THREE.Group();pinion.group.add(this.rotor);
    this.profile(pinion,pinionOutline(p),width,blue,shaftRadius+.15,this.rotor);
    this.ring(pinion,shaftRadius*1.7,shaftRadius+.15,width+4,steel,this.rotor);
    this.mesh(pinion,new THREE.BoxGeometry(this.g.rootRadius*.12,m*.4,.4),0xeac285,[this.g.rootRadius*.91,0,width/2+.3],this.rotor);
    const rack=this.part('rack','齿条','齿条的直线齿形与小齿轮具有相同模数和压力角。导向槽约束其沿 X 方向移动，橙色标记用于观察位移。','长 '+length.toFixed(1)+' mm · '+p.rackTeeth+' 齿 · 宽 '+width+' mm',4);
    rack.category='transmission';
    this.slider=new THREE.Group();rack.group.add(this.slider);
    this.profile(rack,rackOutline(p),width,warm,0,this.slider);
    this.mesh(rack,new THREE.BoxGeometry(m,3*m,.5),0xf6d390,[0,-radius-3*m,width/2+.3],this.slider);
    const shaft=this.part('shaft','传动轴','传动轴与小齿轮同步旋转，将旋转输入传给啮合副。','教学轴与键连接',3);
    shaft.category='transmission';
    this.cylinder(shaft,shaftRadius,width+30,steel,[0,0,-8]);
    this.mesh(shaft,new THREE.BoxGeometry(shaftRadius*.5,shaftRadius*.25,width*.65),dark,[0,shaftRadius,width*.05]);
    const collar=this.part('collar','轴端锁紧环','锁紧环限制小齿轮的轴向移动，拆装时先沿轴端取下。','轴向定位',1);
    collar.category='transmission';
    this.ring(collar,shaftRadius*1.6,shaftRadius+.1,3,steel).position.z=width/2+5;
    this.cylinder(collar,shaftRadius*.25,1.2,dark,[shaftRadius*1.3,0,width/2+7]);
    this.spinGroups=[this.rotor,shaft.group,collar.group];
    const bearing=this.part('bearing','轴承支座','后置支座固定传动轴，保持轴心到齿条分度线的距离。立柱和安装脚将支承位置延伸到导轨的安装平面。','轴心至分度线 '+radius.toFixed(1)+' mm',4);
    bearing.category='housing';
    const bearingZ=-width/2-18, footTop=rackBottom-2*m;
    this.ring(bearing,shaftRadius*2.3,shaftRadius+.15,8,dark).position.z=bearingZ;
    for(const sign of [-1,1])this.ring(bearing,shaftRadius*1.7,shaftRadius+.15,.5,steel).position.z=bearingZ+sign*4.3;
    const columnTop=-shaftRadius*1.4, columnHeight=columnTop-footTop;
    this.mesh(bearing,new THREE.BoxGeometry(shaftRadius*3,columnHeight,8),dark,[0,footTop+columnHeight/2,bearingZ]);
    this.mesh(bearing,new THREE.BoxGeometry(shaftRadius*7,2*m,18),dark,[0,footTop-m,bearingZ]);
    for(const x of [-shaftRadius*2.5,shaftRadius*2.5]) {
      this.mesh(bearing,new THREE.CylinderGeometry(m,m,m,6),steel,[x,footTop+m/2,bearingZ]);
    }
    const guide=this.part('guide','直线导轨','短导向槽托住齿条底面，两侧导向条约束横向偏移。有效行程内，齿条始终跨过中央支承区；到达边界时演示自动停止。','导向区长 '+(6*pitch).toFixed(1)+' mm · 两端预留 2 齿距',4);
    guide.category='housing';
    this.mesh(guide,new THREE.BoxGeometry(6*pitch,m,width+6),dark,[0,rackBottom-m/2,0]);
    for(const z of [-width/2-1.5,width/2+1.5]) {
      this.mesh(guide,new THREE.BoxGeometry(6*pitch,2*m,2.8),steel,[0,rackBottom+m,z]);
    }
    for(const x of [-pitch,pitch]) {
      this.mesh(guide,new THREE.BoxGeometry(pitch,3*m,width+12),dark,[x,rackBottom-2.5*m,0]);
      for(const z of [-width/2-4,width/2+4])this.mesh(guide,new THREE.CylinderGeometry(m*.7,m*.7,m*.6,6),steel,[x,rackBottom-.7*m,z]);
    }
    this.pitchGuide=new THREE.Group();
    this.root.add(this.pitchGuide);
    const circle=Array.from({length:161},(_,i)=>new THREE.Vector3(radius*Math.cos(i*Math.PI/80),radius*Math.sin(i*Math.PI/80),width/2+1));
    const material=new THREE.LineDashedMaterial({color:0x2989c2,dashSize:m,gapSize:m*.6});
    const circleLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints(circle),material);
    circleLine.computeLineDistances();this.pitchGuide.add(circleLine);
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-length/2,-radius,width/2+1),new THREE.Vector3(length/2,-radius,width/2+1)
    ]),material.clone());
    line.computeLineDistances();this.pitchGuide.add(line);
    this.pitchGuide.visible=this.pitchVisible!==false;
    const gap=Math.max(25,width+10);
    pinion.offset.set(0,0,gap*2);
    rack.offset.set(0,-radius-m*8,gap*2);
    collar.offset.set(0,0,gap*4);
    shaft.offset.set(0,0,-gap*2);
    bearing.offset.set(0,0,-gap*4);
    guide.offset.set(0,-radius-m*16,0);
    this.updateMotion();this.pose();this.select(this.selected);
    if(this.contactView)this.focusContact();else this.home();
  }
  updateMotion() {
    if(!this.rotor||!this.slider)return;
    for(const group of this.spinGroups)group.rotation.z=this.angle*Math.PI/180;
    this.slider.position.x=this.g.radius*this.angle*Math.PI/180;
  }
  pauseMotion() {
    this.playing=false;this.lastFrame=undefined;
  }
  setAngle(angle) {
    if(!Number.isFinite(angle))return;
    if(this.amount||this.step)this.restore();
    this.playing=false;
    this.angle=THREE.MathUtils.clamp(angle,-this.g.maxAngle,this.g.maxAngle);
    this.updateMotion();this.render();
    this.onMotion();
  }
  setPitchVisible(visible) {
    this.pitchVisible=visible;
    if(this.pitchGuide)this.pitchGuide.visible=visible&&!this.amount&&!this.step;
    this.render();
  }
  setPlaying(value){if(value&&(this.amount>0||this.step>0))this.restore();this.playing=Boolean(value)&&this.p?.inputRPM>0;this.lastFrame=undefined;this.render();}
  setSpeed(value){if(!Number.isFinite(value))throw new RangeError('无效演示速度');this.speed=THREE.MathUtils.clamp(value,.1,2);}
  setLabels(value){this.labelsOn=Boolean(value);this.render();}
  setHousingMode(mode){if(!['solid','open','transparent','hidden'].includes(mode))throw new RangeError('无效支座显示方式');this.housingMode=mode;this.open=mode==='open';this.pose();this.fitModel();}
  pose(){
    const assembled=this.amount===0&&this.step===0;
    for(const p of this.parts){
      const factor=this.step?THREE.MathUtils.clamp(this.step-p.step+1,0,1):this.amount;
      p.group.position.copy(p.offset).multiplyScalar(factor);
      const hideForMode=['open','hidden'].includes(this.housingMode)&&p.category==='housing';
      p.group.visible=!(assembled&&hideForMode);
      if(p.category==='housing')p.group.traverse(o=>{if(!o.isMesh)return;const transparent=assembled&&this.housingMode==='transparent';o.material.transparent=transparent;o.material.opacity=transparent?.18:1;o.material.depthWrite=!transparent;});
    }
    if(this.pitchGuide)this.pitchGuide.visible=this.pitchVisible!==false&&assembled;
    this.scene.updateMatrixWorld(true);this.render();
  }
  explode(value){this.pauseMotion();this.contactView=false;this.amount=THREE.MathUtils.clamp(value,0,1);this.step=0;this.pose();this.fitModel();this.onMotion();}
  assembly(step){this.pauseMotion();this.contactView=false;this.step=THREE.MathUtils.clamp(step,0,steps.length-1);this.amount=0;this.pose();this.fitModel();this.onMotion();}
  restore(){this.pauseMotion();this.amount=0;this.step=0;this.pose();this.home();this.onMotion();}
  select(id){const part=this.parts.find(x=>x.id===id);if(!part)return;this.selected=id;for(const p of this.parts)p.group.traverse(o=>{if(o.isMesh)o.material.emissive.setHex(p.id===id?0x122638:0);});this.onSelect(part);this.render();}
  home(direction=this.amount>0||this.step>0?[.5,.45,1.5]:[.2,.5,1]){
    this.contactView=false;
    const up=Math.abs(new THREE.Vector3(...direction).normalize().y)>.999?new THREE.Vector3(0,0,-1):new THREE.Vector3(0,1,0);
    if(!this.camera.up.equals(up)){const previous=this.controls;previous.removeEventListener('change',this.onControlChange);previous.dispose();this.camera.up.copy(up);this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.minDistance=20;this.controls.maxDistance=7000;this.controls.addEventListener('change',this.onControlChange);}
    const damp=this.controls.enableDamping;this.controls.enableDamping=false;this.controls.update();this.controls.target.set(0,0,0);this.camera.position.set(...direction).multiplyScalar(900);if(this.root)this.fitModel();else this.controls.update();this.controls.enableDamping=damp;
  }
  focusContact() {
    if(!this.g)return;
    if(this.amount||this.step)this.restore();
    this.home([0,.16,1]);
    this.contactView=true;
    const center=new THREE.Vector3(0,-this.g.radius*.4,0);
    const direction=new THREE.Vector3(0,.16,1).normalize();
    const distance=Math.max(this.g.radius*1.9/Math.min(1,this.camera.aspect)/Math.tan(this.camera.fov*Math.PI/360),this.p.faceWidth*3);
    this.controls.target.copy(center);
    this.camera.position.copy(center).addScaledVector(direction,distance);
    this.controls.update();this.render();
  }
  fitModel(){
    if(this.contactView){this.focusContact();return;}
    if(!this.root)return;this.scene.updateMatrixWorld(true);const bounds=new THREE.Box3();const boxes=[];
    this.root.traverse(mesh=>{if(!mesh.isMesh||!this.isVisible(mesh))return;let b;
      if(mesh.isInstancedMesh){mesh.computeBoundingBox();b=mesh.boundingBox.clone();}else{if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();b=mesh.geometry.boundingBox.clone();}
      b.applyMatrix4(mesh.matrixWorld);bounds.union(b);boxes.push(b);
    });
    if(bounds.isEmpty())return;const center=bounds.getCenter(new THREE.Vector3()),direction=this.camera.position.clone().sub(this.controls.target).normalize();
    const right=new THREE.Vector3().crossVectors(this.camera.up,direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right);
    const tv=Math.tan(this.camera.fov*Math.PI/360),th=tv*this.camera.aspect;let distance=0;
    for(const b of boxes)for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const v=new THREE.Vector3(x,y,z).sub(center),depth=v.dot(direction);distance=Math.max(distance,depth+Math.abs(v.dot(right))/th,depth+Math.abs(v.dot(up))/tv);}
    this.controls.target.copy(center);this.camera.position.copy(center).addScaledVector(direction,distance*1.12);this.controls.update();
  }
  state(){
    this.scene.updateMatrixWorld(true);
    return {p:this.p&&{...this.p},amount:this.amount,step:this.step,selected:this.selected,playing:this.playing,speed:this.speed,
      housingMode:this.housingMode,open:this.open,labelsOn:this.labelsOn,contactView:this.contactView,time:this.time,angle:this.angle,direction:this.direction,displacement:this.g?this.g.radius*this.angle*Math.PI/180:0,animationScale:ANIMATION_SCALE,
      geometry:this.g?{...this.g}:null,
      parts:this.parts.map(p=>{const b=new THREE.Box3().setFromObject(p.group);return {id:p.id,position:p.group.position.toArray(),visible:this.isVisible(p.group),min:b.min.toArray(),max:b.max.toArray()};}),
      camera:this.camera.position.toArray(),geometries:this.renderer.info.memory.geometries};
  }
  clearGeometry(){if(!this.root)return;const geometries=new Set(),materials=new Set();this.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);if(o.isInstancedMesh)o.dispose();});geometries.forEach(x=>x.dispose());materials.forEach(x=>x.dispose());this.scene.remove(this.root);this.root=null;this.rotor=null;this.slider=null;}
  dispose(){this.disposed=true;cancelAnimationFrame(this.frame);this.events.abort();this.resize.disconnect();this.controls.removeEventListener('change',this.onControlChange);this.controls.dispose();this.clearGeometry();this.renderer.dispose();this.renderer.domElement.remove();this.parts=[];}
}
