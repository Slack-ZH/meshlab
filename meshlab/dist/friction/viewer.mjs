import * as THREE from 'three';
import {OrbitControls} from '../assets/OrbitControls.js';
import {createReferenceStage,finishes,fitReferenceCamera,machinedRing,setPartHighlight} from '../assets/reference-stage.mjs';
import {geometry,validate,ANIMATION_SCALE} from './mechanics.mjs';

export const steps=['完整传动','取下轴端锁紧环','沿轴向移开摩擦轮','抽出两根传动轴','分离轴承支座'];
const geometryKeys=['driverDiameter','drivenDiameter','wheelWidth'];
const {gear,shaft,bearing,fastener,cover,housing,rubber}=finishes;
export class FrictionViewer {
  constructor(host,onSelect){
    this.host=host;this.onSelect=onSelect;this.parts=[];this.amount=0;this.step=0;this.selected='driver-wheel';
    this.playing=false;this.speed=1;this.labelsOn=false;this.housingMode='solid';this.open=false;
    this.rotations={driver:0,driven:0};this.time=0;
    this.events=new AbortController();this.label=host.closest('.viewer-panel')?.querySelector('#selection-label');
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(38,1,1,12000);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.stage=createReferenceStage(this.scene,this.renderer);
    host.append(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','摩擦轮传动三维视图，拖动旋转，滚轮缩放；点击选择零件。');
    this.onControlChange=()=>this.render();this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.enableDamping=true;this.controls.minDistance=100;this.controls.maxDistance=7000;
    this.controls.addEventListener('change',this.onControlChange);
    const appearance=matchMedia('(prefers-color-scheme: dark)');
    const updateAppearance=()=>{this.stage.setDark(appearance.matches);this.render();};
    appearance.addEventListener('change',updateAppearance,{signal:this.events.signal});
    this.stage.setDark(appearance.matches);
    this.home();
    this.resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();if(this.root)this.fitModel();this.render();});
    this.resize.observe(host);
    let down;
    host.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];},{signal:this.events.signal});
    host.addEventListener('pointerup',e=>{
      if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;
      const r=host.getBoundingClientRect(),ray=new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),this.camera);
      const pick=[];this.scene.traverse(o=>{if(o.isMesh&&o.userData.partId&&this.isVisible(o))pick.push(o);});
      const hit=ray.intersectObjects(pick,false)[0];if(hit)this.select(hit.object.userData.partId);
    },{signal:this.events.signal});
    const loop=now=>{
      if(this.disposed)return;this.frame=requestAnimationFrame(loop);
      const dt=this.lastFrame===undefined?0:Math.min((now-this.lastFrame)/1000,.05);this.lastFrame=now;
      if(this.playing&&this.root){
        this.time+=dt;this.rotations.driver+=dt*this.p.inputRPM*Math.PI/30*this.speed*ANIMATION_SCALE;
        this.rotations.driven=-this.rotations.driver*this.p.driverDiameter/this.p.drivenDiameter;this.updateMotion();
      }
      this.controls.update();if(this.playing)this.render();
    };
    this.frame=requestAnimationFrame(loop);
  }
  isVisible(o){while(o){if(!o.visible)return false;o=o.parent;}return true;}
  render(){if(this.disposed)return;const part=this.parts.find(p=>p.id===this.selected);if(this.label){this.label.hidden=!(this.labelsOn&&part&&this.isVisible(part.group));if(part&&this.label.textContent!==part.name)this.label.textContent=part.name;}this.renderer.render(this.scene,this.camera);}
  material(finish){return new THREE.MeshStandardMaterial({...finish,side:THREE.DoubleSide});}
  part(id,name,description,spec,step){const group=new THREE.Group();group.userData.partId=id;this.root.add(group);const p={id,name,description,spec,step,group,offset:new THREE.Vector3()};this.parts.push(p);return p;}
  mesh(p,geo,finish,pos=[0,0,0],parent=p.group){const mesh=new THREE.Mesh(geo,this.material(finish));mesh.position.set(...pos);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.partId=p.id;parent.add(mesh);return mesh;}
  cylinder(p,radius,length,color,pos=[0,0,0],parent=p.group){const geo=new THREE.CylinderGeometry(radius,radius,length,96);geo.rotateX(Math.PI/2);return this.mesh(p,geo,color,pos,parent);}
  ring(p,outer,inner,depth,finish,parent=p.group){
    return this.mesh(p,machinedRing(outer,inner,depth),finish,[0,0,0],parent);
  }
  wheel(part,radius,width,finish,parent){
    const shape=new THREE.Shape();shape.absarc(0,0,radius,0,2*Math.PI);
    const hole=new THREE.Path();hole.absarc(0,0,radius-5,0,2*Math.PI,true);shape.holes.push(hole);
    const contactSurface=new THREE.ExtrudeGeometry(shape,{depth:width,bevelEnabled:false,curveSegments:96});
    contactSurface.translate(0,0,-width/2);
    this.mesh(part,contactSurface,rubber,[0,0,0],parent);
    this.ring(part,radius-5,radius-10,width*.76,bearing,parent);
    this.ring(part,15,8,width+4,finish,parent);
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3;
      const spoke=this.mesh(part,new THREE.BoxGeometry(radius-19,Math.max(5,radius*.075),width*.45),finish,
        [(radius+9)/2*Math.cos(a),(radius+9)/2*Math.sin(a),0],parent);spoke.rotation.z=a;
      for(const z of [-width*.4,width*.4])this.cylinder(part,2.0,2,fastener,
        [(radius-8)*Math.cos(a),(radius-8)*Math.sin(a),z],parent);
    }
    for(const sign of [-1,1]){
      const face=sign*(width/2+.2);
      // Surface indices reveal rotation without changing the cylindrical contact envelope.
      for(let i=0;i<12;i++){
        const a=i*Math.PI/6,mark=this.mesh(part,new THREE.BoxGeometry(i===0?4.6:2.7,i===0?1.8:.85,.25),bearing,
          [(radius-2.5)*Math.cos(a),(radius-2.5)*Math.sin(a),face],parent);mark.rotation.z=a;
      }
      this.ring(part,14,10,1,shaft,parent).position.z=sign*(width/2+2.5);
    }
  }
  bearing(part,x,z){
    const support=new THREE.Group();support.position.set(x,0,z);part.group.add(support);
    this.ring(part,20,13,14,housing,support);
    this.ring(part,13,7.7,14,bearing,support);
    for(const side of [-1,1])this.ring(part,12,8,1,cover,support).position.z=side*7.5;
    this.mesh(part,new THREE.BoxGeometry(30,17,18),housing,[0,-20,0],support);
    this.mesh(part,new THREE.BoxGeometry(48,6,26),housing,[0,-31.5,0],support);
    for(const dx of [-18,18]){
      this.mesh(part,new THREE.CylinderGeometry(3,3,4,6),fastener,[dx,-27,0],support);
      this.mesh(part,new THREE.BoxGeometry(3,1,10),cover,[dx,-34.8,0],support);
    }
  }
  build(p){
    validate(p);
    if(this.p&&geometryKeys.every(key=>this.p[key]===p[key])){this.p={...p};if(p.inputRPM===0)this.setPlaying(false);return;}
    const hadRoot=!!this.root;this.clearGeometry();this.resetMotion();this.amount=0;this.step=0;this.p={...p};this.g=geometry(p);this.parts=[];this.root=new THREE.Group();this.scene.add(this.root);
    this.spinGroups=[];
    const w=p.wheelWidth;
    for(const [side,name,x,radius,finish] of [
      ['driver','主动',this.g.driverCenter[0],this.g.driverRadius,shaft],
      ['driven','从动',this.g.drivenCenter[0],this.g.drivenRadius,gear],
    ]){
      const wheel=this.part(side+'-wheel',name+'摩擦轮',side==='driver'?
        '主动轮通过接触处的静摩擦力驱动从动轮。轮径改变时，两轮自动保持外接相切；外周胶圈是接触面。':
        '从动轮与主动轮反向旋转。理想无滑动时接触线速度相同，直径越大，转速越低；超出牵引容量后不能再据此预测实际转速。',
        '外径 '+radius*2+' mm · 轮宽 '+w+' mm',2);wheel.category='transmission';
      const rotor=new THREE.Group();rotor.position.set(x,0,0);wheel.group.add(rotor);this.wheel(wheel,radius,w,finish,rotor);this.spinGroups.push({group:rotor,side});
      const shaftPart=this.part(side+'-shaft',name+'轴',name+'轴支承摩擦轮并传递转矩。轴、轮毂与锁紧环在此作为同步转动的教学组件；键槽和配合公差不作制造级建模。','示意轴径 15 mm · 两轴平行',3);shaftPart.category='transmission';
      const shaftSpin=new THREE.Group();shaftSpin.position.set(x,0,0);shaftPart.group.add(shaftSpin);this.cylinder(shaftPart,7.5,w+74,shaft,[0,0,-13],shaftSpin);
      this.mesh(shaftPart,new THREE.BoxGeometry(2,2,10),cover,[0,6.9,w/2+14],shaftSpin);this.spinGroups.push({group:shaftSpin,side});
      const support=this.part(side+'-support',name+'轴承支座','独立轴承支座约束轴线。改变轮径会调整中心距；支座示意省略基础与压紧执行机构，压紧力作为外部给定的接触载荷。','无大底座 · 支座随中心距移动',4);support.category='housing';this.bearing(support,x,-w/2-24);
      const collar=this.part(side+'-collar',name+'锁紧环','锁紧环限制轮毂轴向移动。拆装时先释放锁紧环，再沿轴线移开摩擦轮，最后抽轴并分离支座。','分组拆装示意',1);collar.category='transmission';
      const collarSpin=new THREE.Group();collarSpin.position.set(x,0,w/2+7);collar.group.add(collarSpin);this.ring(collar,12,7.7,6,shaft,collarSpin);
      this.mesh(collar,new THREE.BoxGeometry(3,3,3),fastener,[0,11,0],collarSpin);this.spinGroups.push({group:collarSpin,side});
    }
    this.updateMotion();this.scene.updateMatrixWorld(true);
    // Preserve each shaft's assembly line. Separate the two lines laterally, then
    // put support -> shaft -> wheel -> collar in the same axial order on both.
    const largestRadius=Math.max(this.g.driverRadius,this.g.drivenRadius);
    const columnSpread=largestRadius*1.2+50,axialGap=Math.max(55,largestRadius*.8);
    this.explosionLayout={columnSpread,axialGap,order:['support','shaft','wheel','collar']};
    for(const [side,sign] of [['driver',-1],['driven',1]]){
      let cursor=0;const layers=[];
      for(const suffix of this.explosionLayout.order){
        const part=this.parts.find(part=>part.id===side+'-'+suffix),box=new THREE.Box3().setFromObject(part.group);
        layers.push({part,z:cursor-box.min.z});cursor+=box.max.z-box.min.z+axialGap;
      }
      const middle=(cursor-axialGap)/2;
      for(const {part,z} of layers)part.offset.set(sign*columnSpread,0,z-middle);
    }
    this.pose();this.select(this.parts.some(x=>x.id===this.selected)?this.selected:'driver-wheel');
    if(hadRoot)this.fitModel();else this.home();
  }
  updateMotion(){if(!this.root||!this.spinGroups)return;for(const {group,side} of this.spinGroups)group.rotation.z=this.rotations[side];}
  resetMotion(){this.playing=false;this.time=0;this.lastFrame=undefined;this.rotations={driver:0,driven:0};if(this.root)this.updateMotion();}
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
      if(p.category==='housing')p.group.traverse(o=>{if(!o.isMesh)return;const transparent=assembled&&this.housingMode==='transparent';o.material.transparent=transparent;o.material.opacity=transparent?.16:1;o.material.depthWrite=!transparent;o.castShadow=!transparent;});
    }
    this.scene.updateMatrixWorld(true);this.render();
  }
  explode(value){this.resetMotion();this.amount=THREE.MathUtils.clamp(value,0,1);this.step=0;this.pose();this.fitModel();}
  assembly(step){this.resetMotion();this.step=THREE.MathUtils.clamp(step,0,steps.length-1);this.amount=0;this.pose();this.fitModel();}
  restore(){this.resetMotion();this.amount=0;this.step=0;this.pose();this.home();}
  select(id){const part=this.parts.find(x=>x.id===id);if(!part)return;this.selected=id;setPartHighlight(this.parts,id);this.onSelect(part);this.render();}
  home(direction=this.amount>0||this.step>0?[1.05,.72,1]:[.5,.55,1]){
    const up=Math.abs(new THREE.Vector3(...direction).normalize().y)>.999?new THREE.Vector3(0,0,-1):new THREE.Vector3(0,1,0);
    if(!this.camera.up.equals(up)){const previous=this.controls;previous.removeEventListener('change',this.onControlChange);previous.dispose();this.camera.up.copy(up);this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.minDistance=100;this.controls.maxDistance=7000;this.controls.addEventListener('change',this.onControlChange);}
    const damp=this.controls.enableDamping;this.controls.enableDamping=false;this.controls.update();this.controls.target.set(0,0,0);this.camera.position.set(...direction).multiplyScalar(900);if(this.root)this.fitModel();else this.controls.update();this.controls.enableDamping=damp;
  }
  fitModel(){
    if(!this.root)return;this.scene.updateMatrixWorld(true);const bounds=new THREE.Box3();const boxes=[];
    this.root.traverse(mesh=>{if(!mesh.isMesh||!this.isVisible(mesh))return;let b;
      if(mesh.isInstancedMesh){mesh.computeBoundingBox();b=mesh.boundingBox.clone();}else{if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();b=mesh.geometry.boundingBox.clone();}
      b.applyMatrix4(mesh.matrixWorld);bounds.union(b);boxes.push(b);
    });
    if(bounds.isEmpty())return;const center=bounds.getCenter(new THREE.Vector3());
    this.stage.fit(bounds,center);
    fitReferenceCamera(this.host,this.camera,this.controls,center,boxes);
  }
  state(){
    this.scene.updateMatrixWorld(true);
    return {p:this.p&&{...this.p},amount:this.amount,step:this.step,selected:this.selected,playing:this.playing,speed:this.speed,
      housingMode:this.housingMode,open:this.open,labelsOn:this.labelsOn,time:this.time,rotations:{...this.rotations},animationScale:ANIMATION_SCALE,
      geometry:this.g?{...this.g}:null,explosionLayout:this.explosionLayout&&{...this.explosionLayout,order:[...this.explosionLayout.order]},
      parts:this.parts.map(p=>{const b=new THREE.Box3().setFromObject(p.group);return {id:p.id,position:p.group.position.toArray(),visible:this.isVisible(p.group),min:b.min.toArray(),max:b.max.toArray()};}),
      camera:this.camera.position.toArray(),geometries:this.renderer.info.memory.geometries};
  }
  clearGeometry(){if(!this.root)return;const geometries=new Set(),materials=new Set();this.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);if(o.isInstancedMesh)o.dispose();});geometries.forEach(x=>x.dispose());materials.forEach(x=>x.dispose());this.scene.remove(this.root);this.root=null;}
  dispose(){this.disposed=true;cancelAnimationFrame(this.frame);this.events.abort();this.resize.disconnect();this.controls.removeEventListener('change',this.onControlChange);this.controls.dispose();this.clearGeometry();this.stage.dispose();this.renderer.dispose();this.renderer.domElement.remove();this.parts=[];}
}
