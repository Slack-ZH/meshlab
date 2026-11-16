import * as THREE from 'three';
import {OrbitControls} from '../assets/OrbitControls.js';
import {geometry,validate,ANIMATION_SCALE,beltSample,beltMeshData} from './mechanics.mjs';

export const steps=['完整传动','取下锁紧环','移开整条平带','沿轴向移开带轮','抽出轴系与支座'];
const geometryKeys=['crossed','driverDiameter','drivenDiameter','centerDistance','beltWidth'];
const steel=0xa4b0bd,dark=0x354353,blue=0x2082a2,warm=0xba8750;
export class BeltViewer {
  constructor(host,onSelect){
    this.host=host;this.onSelect=onSelect;this.parts=[];this.amount=0;this.step=0;this.selected='belt';
    this.playing=false;this.speed=1;this.labelsOn=false;this.housingMode='solid';this.open=false;
    this.rotations={driver:0,driven:0};this.beltTravel=0;this.time=0;
    this.events=new AbortController();this.label=host.closest('.viewer-panel')?.querySelector('#selection-label');
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(35,1,1,12000);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    host.append(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','交叉与开口平带传动三维视图，拖动旋转，滚轮缩放；点击选择零件。');
    this.onControlChange=()=>this.render();this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.enableDamping=true;this.controls.minDistance=100;this.controls.maxDistance=7000;
    this.controls.addEventListener('change',this.onControlChange);
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x798597,3));
    for(const [x,y,z,power] of [[-400,900,1100,3],[800,200,-500,2],[-800,-250,400,1]]){
      const light=new THREE.DirectionalLight(0xffffff,power);light.position.set(x,y,z);this.scene.add(light);
    }
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
      if(this.playing&&this.root)this.advance(dt);
      this.controls.update();if(this.playing)this.render();
    };
    this.frame=requestAnimationFrame(loop);
  }
  isVisible(o){while(o){if(!o.visible)return false;o=o.parent;}return true;}
  render(){if(this.disposed)return;const part=this.parts.find(p=>p.id===this.selected);if(this.label){this.label.hidden=!(this.labelsOn&&part&&this.isVisible(part.group));if(part&&this.label.textContent!==part.name)this.label.textContent=part.name;}this.renderer.render(this.scene,this.camera);}
  material(color){return new THREE.MeshStandardMaterial({color,metalness:.68,roughness:.32,side:THREE.DoubleSide});}
  part(id,name,description,spec,step){const group=new THREE.Group();group.userData.partId=id;this.root.add(group);const p={id,name,description,spec,step,group,offset:new THREE.Vector3()};this.parts.push(p);return p;}
  mesh(p,geo,color,pos=[0,0,0],parent=p.group){const mesh=new THREE.Mesh(geo,this.material(color));mesh.position.set(...pos);mesh.userData.partId=p.id;parent.add(mesh);return mesh;}
  cylinder(p,radius,length,color,pos=[0,0,0],parent=p.group){const geo=new THREE.CylinderGeometry(radius,radius,length,96);geo.rotateX(Math.PI/2);return this.mesh(p,geo,color,pos,parent);}
  tube(p,a,b,r,color,parent=p.group){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),dir=end.clone().sub(start);const mesh=this.mesh(p,new THREE.CylinderGeometry(r,r,dir.length(),16),color,start.clone().add(end).multiplyScalar(.5).toArray(),parent);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());return mesh;}
  torus(p,r,t,color,pos=[0,0,0],parent=p.group){return this.mesh(p,new THREE.TorusGeometry(r,t,10,96),color,pos,parent);}
  ring(p,outer,inner,depth,color,parent=p.group){
    const shape=new THREE.Shape();shape.absarc(0,0,outer,0,2*Math.PI);const hole=new THREE.Path();hole.absarc(0,0,inner,0,2*Math.PI,true);shape.holes.push(hole);
    const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:96});geo.translate(0,0,-depth/2);return this.mesh(p,geo,color,[0,0,0],parent);
  }
  pulley(part,radius,width,color,parent){
    this.ring(part,radius,radius-6,width,steel,parent);
    this.ring(part,15,8,width+4,color,parent);
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3;
      const spoke=this.mesh(part,new THREE.BoxGeometry(radius-20,Math.max(5,radius*.075),width*.45),color,
        [(radius+8)/2*Math.cos(a),(radius+8)/2*Math.sin(a),0],parent);spoke.rotation.z=a;
    }
    for(const sign of [-1,1]){
      this.ring(part,radius-1,radius-3,1,color,parent).position.z=sign*(width/2+.5);
      const index=this.mesh(part,new THREE.BoxGeometry(4,1.2,.3),0xf0b45f,[radius-3,0,sign*(width/2+1.2)],parent);
    }
  }
  makeBelt(part){
    const data=beltMeshData(this.g),geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(data.vertices,3));geo.setIndex(data.indices);geo.computeVertexNormals();
    const body=this.mesh(part,geo,0x35424b);body.material.metalness=.04;body.material.roughness=.8;body.userData.beltBody=true;
    this.beltBody=body;this.beltMarkers=[];this.beltFrame=new THREE.Matrix4();
    for(let i=0;i<16;i++){const marker=this.mesh(part,new THREE.BoxGeometry(3,this.p.beltWidth*.75,.25),i%4===0?0xe2ab52:0x73919d);marker.userData.beltMarker=i;this.beltMarkers.push(marker);}
  }
  bearing(part,x,z){
    const bearing=new THREE.Group();bearing.position.set(x,0,z);part.group.add(bearing);
    this.ring(part,20,13,14,blue,bearing);
    this.ring(part,13,7.7,14,steel,bearing);
    for(const side of [-1,1])this.ring(part,12,8,1,dark,bearing).position.z=side*7.5;
    this.mesh(part,new THREE.BoxGeometry(30,17,18),blue,[0,-20,0],bearing);
    this.mesh(part,new THREE.BoxGeometry(48,6,26),blue,[0,-31.5,0],bearing);
    for(const dx of [-18,18]){
      this.mesh(part,new THREE.CylinderGeometry(3,3,4,6),steel,[dx,-27,0],bearing);
      this.mesh(part,new THREE.BoxGeometry(3,1,10),dark,[dx,-34.8,0],bearing);
    }
  }
  build(p){
    validate(p);
    if(this.p&&geometryKeys.every(key=>this.p[key]===p[key])){this.p={...p};if(p.inputRPM===0)this.setPlaying(false);return;}
    const hadRoot=!!this.root;this.clearGeometry();this.resetMotion();this.amount=0;this.step=0;this.p={...p};this.g=geometry(p);this.parts=[];this.root=new THREE.Group();this.scene.add(this.root);
    this.spinGroups=[];
    const w=this.g.pulleyWidth;
    for(const [side,name,x,radius,color] of [
      ['driver','主动',this.g.driverCenter[0],this.g.driverPulleyRadius,0x397d9a],
      ['driven','从动',this.g.drivenCenter[0],this.g.drivenPulleyRadius,warm],
    ]){
      const pulley=this.part(side+'-pulley',name+'平带轮',side==='driver'?
        '主动轮通过平带传递运动。有效直径指带中性层的节径；模型固定带厚2mm，轮的实体外圆相应略小。金色刻线与带上标记展示同步运动。':
        p.crossed?'交叉平带驱动从动轮反转。两轮的理想包角相同，速比由有效直径之比决定；交叉处的空间避让不属于制造带长计算。':'开口平带使从动轮与主动轮同向旋转。小轮包角更小；中心距改变几何与带长，不直接改变理想速比。',
        '有效直径 '+p[side+'Diameter']+' mm · 轮宽 '+w+' mm',3);pulley.category='transmission';
      const rotor=new THREE.Group();rotor.position.set(x,0,0);pulley.group.add(rotor);this.pulley(pulley,radius,w,color,rotor);this.spinGroups.push({group:rotor,side});
      const shaft=this.part(side+'-shaft',name+'轴',name+'轴支承带轮并传递转矩。轴、轮毂与锁紧环作为同步转动的教学组件；键槽和配合公差不作制造级建模。','示意轴径 15 mm · 两轴平行',4);shaft.category='transmission';
      const shaftSpin=new THREE.Group();shaftSpin.position.set(x,0,0);shaft.group.add(shaftSpin);this.cylinder(shaft,7.5,w+74,steel,[0,0,-13],shaftSpin);
      this.mesh(shaft,new THREE.BoxGeometry(2,2,10),dark,[0,6.9,w/2+14],shaftSpin);this.spinGroups.push({group:shaftSpin,side});
      const support=this.part(side+'-support',name+'轴承支座','独立轴承支座约束轴线。中心距由参数设定，两支座随轴距移动；省略张紧执行器，不根据模型形状推算预张力。','无大底座 · 支座随中心距移动',4);support.category='housing';this.bearing(support,x,-w/2-24);
      const collar=this.part(side+'-collar',name+'锁紧环','锁紧环限制轮毂轴向移动。拆装时先释放锁紧环，再沿轴线移开带轮，最后抽轴并分离支座。','分组拆装示意',1);collar.category='transmission';
      const collarSpin=new THREE.Group();collarSpin.position.set(x,0,w/2+7);collar.group.add(collarSpin);this.ring(collar,12,7.7,6,steel,collarSpin);
      this.mesh(collar,new THREE.BoxGeometry(3,3,3),dark,[0,11,0],collarSpin);this.spinGroups.push({group:collarSpin,side});
    }
    const belt=this.part('belt','闭合平带','完整平带把两个带轮连成连续传动。交叉模式采用两段平滑半扭转并在交点离面分层，避免实体穿模；这只是结构教学示意。移动色标沿显示中心线等速行进，绕轮段与带轮角速度一致。','带宽 '+p.beltWidth+' mm · 带厚 2 mm',2);belt.category='transmission';this.makeBelt(belt);
    this.updateMotion();this.scene.updateMatrixWorld(true);
    // Preserve each shaft's assembly line. Separate the two lines laterally, then
    // put support -> shaft -> wheel -> collar in the same axial order on both.
    const largestRadius=Math.max(this.g.driverRadius,this.g.drivenRadius);
    const columnSpread=largestRadius*1.2+50,axialGap=Math.max(55,largestRadius*.8);
    this.explosionLayout={columnSpread,axialGap,order:['support','shaft','pulley','collar']};
    for(const [side,sign] of [['driver',-1],['driven',1]]){
      let cursor=0;const layers=[];
      for(const suffix of this.explosionLayout.order){
        const part=this.parts.find(part=>part.id===side+'-'+suffix),box=new THREE.Box3().setFromObject(part.group);
        layers.push({part,z:cursor-box.min.z});cursor+=box.max.z-box.min.z+axialGap;
      }
      const middle=(cursor-axialGap)/2;
      for(const {part,z} of layers)part.offset.set(sign*columnSpread,0,z-middle);
    }
    const beltBox=new THREE.Box3().setFromObject(belt.group);
    const frontmost=Math.max(...this.parts.filter(part=>part.id!=='belt').map(part=>new THREE.Box3().setFromObject(part.group).max.z+part.offset.z));
    belt.offset.set(0,0,frontmost+50-beltBox.min.z);
    this.pose();this.select(this.parts.some(x=>x.id===this.selected)?this.selected:'belt');
    if(hadRoot)this.fitModel();else this.home();
  }
  advance(dt){
    if(!this.playing||!this.root)return;
    this.time+=dt;this.rotations.driver+=dt*this.p.inputRPM*Math.PI/30*this.speed*ANIMATION_SCALE;
    this.rotations.driven=(this.p.crossed?-1:1)*this.rotations.driver*this.p.driverDiameter/this.p.drivenDiameter;
    this.beltTravel=-this.rotations.driver*this.g.driverRadius;this.updateMotion();
  }
  updateMotion(){
    if(!this.root||!this.spinGroups)return;for(const {group,side} of this.spinGroups)group.rotation.z=this.rotations[side];
    if(!this.beltMarkers)return;
    this.beltMarkers.forEach((marker,i)=>{const sample=beltSample(this.g,this.beltTravel+i*this.g.spatialCenterlineLength/this.beltMarkers.length);
      marker.position.set(...sample.position.map((v,j)=>v-sample.normal[j]*(this.g.beltThickness/2+.18)));
      this.beltFrame.makeBasis(new THREE.Vector3(...sample.tangent),new THREE.Vector3(...sample.width),new THREE.Vector3(...sample.normal));marker.quaternion.setFromRotationMatrix(this.beltFrame);
    });
  }
  resetMotion(){this.playing=false;this.time=0;this.lastFrame=undefined;this.rotations={driver:0,driven:0};this.beltTravel=0;if(this.root)this.updateMotion();}
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
    this.scene.updateMatrixWorld(true);this.render();
  }
  explode(value){this.resetMotion();this.amount=THREE.MathUtils.clamp(value,0,1);this.step=0;this.pose();this.fitModel();}
  assembly(step){this.resetMotion();this.step=THREE.MathUtils.clamp(step,0,steps.length-1);this.amount=0;this.pose();this.fitModel();}
  restore(){this.resetMotion();this.amount=0;this.step=0;this.pose();this.home();}
  select(id){const part=this.parts.find(x=>x.id===id);if(!part)return;this.selected=id;for(const p of this.parts)p.group.traverse(o=>{if(o.isMesh)o.material.emissive.setHex(p.id===id?0x122638:0);});this.onSelect(part);this.render();}
  home(direction=this.amount>0||this.step>0?[1.25,.55,1.5]:[.27,.16,1]){
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
    if(bounds.isEmpty())return;const center=bounds.getCenter(new THREE.Vector3()),direction=this.camera.position.clone().sub(this.controls.target).normalize();
    const right=new THREE.Vector3().crossVectors(this.camera.up,direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right);
    const tv=Math.tan(this.camera.fov*Math.PI/360),th=tv*this.camera.aspect;let distance=0;
    for(const b of boxes)for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const v=new THREE.Vector3(x,y,z).sub(center),depth=v.dot(direction);distance=Math.max(distance,depth+Math.abs(v.dot(right))/th,depth+Math.abs(v.dot(up))/tv);}
    this.controls.target.copy(center);this.camera.position.copy(center).addScaledVector(direction,distance*1.12);this.controls.update();
  }
  state(){
    this.scene.updateMatrixWorld(true);
    return {p:this.p&&{...this.p},amount:this.amount,step:this.step,selected:this.selected,playing:this.playing,speed:this.speed,
      housingMode:this.housingMode,open:this.open,labelsOn:this.labelsOn,time:this.time,rotations:{...this.rotations},beltTravel:this.beltTravel,animationScale:ANIMATION_SCALE,
      geometry:this.g?{...this.g}:null,explosionLayout:this.explosionLayout&&{...this.explosionLayout,order:[...this.explosionLayout.order]},
      parts:this.parts.map(p=>{const b=new THREE.Box3().setFromObject(p.group);return {id:p.id,position:p.group.position.toArray(),visible:this.isVisible(p.group),min:b.min.toArray(),max:b.max.toArray()};}),
      camera:this.camera.position.toArray(),geometries:this.renderer.info.memory.geometries};
  }
  clearGeometry(){if(!this.root)return;const geometries=new Set(),materials=new Set();this.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);if(o.isInstancedMesh)o.dispose();});geometries.forEach(x=>x.dispose());materials.forEach(x=>x.dispose());this.scene.remove(this.root);this.root=null;}
  dispose(){this.disposed=true;cancelAnimationFrame(this.frame);this.events.abort();this.resize.disconnect();this.controls.removeEventListener('change',this.onControlChange);this.controls.dispose();this.clearGeometry();this.renderer.dispose();this.renderer.domElement.remove();this.parts=[];}
}
