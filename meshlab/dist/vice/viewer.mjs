import * as THREE from 'three';
import {phase} from '../legacy-disassembly.mjs';
import {OrbitControls} from '../assets/OrbitControls.js';
import {geometry,validate,ANIMATION_SCALE,threadMeshData,motion} from './mechanics.mjs';

export const steps=['完整台虎钳','旋出丝杠与活动钳口总成','移开教学可拆侧盖','侧向取出固定螺母','分离钳口垫'];
const geometryKeys=['lead','screwDiameter','jawWidth','maxOpening'];
const steel=0xa4b0bd,dark=0x354353,blue=0x2082a2,warm=0xba8750;
export class ViceViewer {
  constructor(host,onSelect){
    this.host=host;this.onSelect=onSelect;this.parts=[];this.amount=0;this.step=0;this.selected='screw';
    this.playing=false;this.speed=1;this.labelsOn=false;this.housingMode='open';this.open=true;
    this.rotations={driver:0,driven:0};this.beltTravel=0;this.time=0;
    this.events=new AbortController();this.label=host.closest('.viewer-panel')?.querySelector('#selection-label');
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(35,1,1,12000);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    host.append(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','丝杠螺母台虎钳三维视图，拖动旋转，滚轮缩放；点击选择零件。');
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
  thread(part,kind,half,parent){
    const data=threadMeshData(this.g,{kind,half}),geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(data.vertices,3));geo.setIndex(data.indices);geo.computeVertexNormals();
    const mesh=this.mesh(part,geo,kind==='nut'?warm:steel,[0,0,0],parent);mesh.userData.threadKind=kind;mesh.userData.half=half;return mesh;
  }
  cylinderX(part,radius,length,color,pos,parent){const mesh=this.cylinder(part,radius,length,color,pos,parent);mesh.rotation.y=Math.PI/2;return mesh;}
  ringX(part,outer,inner,length,color,pos,parent){const mesh=this.ring(part,outer,inner,length,color,parent);mesh.rotation.y=Math.PI/2;mesh.position.set(...pos);return mesh;}
  jawBlock(part,x,depth,parent){
    const g=this.g,shape=new THREE.Shape(),w=g.jawWidth/2;shape.moveTo(-w,g.jawBase);shape.lineTo(w,g.jawBase);shape.lineTo(w,g.jawTop);shape.lineTo(-w,g.jawTop);shape.closePath();
    const hole=new THREE.Path();hole.absarc(0,0,g.journalRadius+.5,0,Math.PI*2,true);shape.holes.push(hole);
    const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:64});geo.translate(0,0,-depth/2);geo.rotateY(Math.PI/2);return this.mesh(part,geo,blue,[x,0,0],parent);
  }
  build(p){
    validate(p);
    if(this.p&&geometryKeys.every(key=>this.p[key]===p[key])){this.p={...p};if(p.inputRPM===0||this.blockedDirection())this.playing=false;this.onMotion?.();this.render();return;}
    const hadRoot=!!this.root;this.clearGeometry();this.p={...p};this.g=geometry(p);this.playing=false;this.jawOpening=p.maxOpening/2;this.time=0;this.lastFrame=undefined;this.motionNotice=0;this.amount=0;this.step=0;this.parts=[];this.root=new THREE.Group();this.scene.add(this.root);this.movers=[];this.rotors=[];this.frontBody=[];
    const g=this.g,W=p.jawWidth,D=p.screwDiameter,mid=g.midOpening;
    const fixed=this.part('fixed-body','固定钳体','固定钳口、紧凑安装脚和侧壁构成台虎钳固定体。内部固定螺母承受丝杠轴向作用，导轨约束活动钳口转动。半剖模式移除前侧壁，观察螺纹配合。','钳口宽 '+W+' mm · 紧凑安装脚',4);fixed.category='housing';
    const bodyLength=-g.bodyBack+24,bodyCenter=(g.bodyBack+24)/2,wallZ=Math.max(W*.33,g.nutOuterRadius+5);
    this.mesh(fixed,new THREE.BoxGeometry(18,g.jawTop-g.nutOuterRadius-3,Math.max(W,2*wallZ+7)),blue,[-12,(g.jawTop+g.nutOuterRadius+3)/2,0]);
    for(const sign of [-1,1]){const wall=this.mesh(fixed,new THREE.BoxGeometry(bodyLength,g.nutOuterRadius*2+16,7),blue,[bodyCenter,-4,sign*wallZ]);if(sign===1){wall.userData.cutaway=true;this.frontBody.push(wall);}}
    this.mesh(fixed,new THREE.BoxGeometry(bodyLength,8,2*wallZ+7),blue,[bodyCenter,-g.nutOuterRadius-10,0]);
    for(const sign of [-1,1]){const foot=this.mesh(fixed,new THREE.BoxGeometry(34,6,18),dark,[g.bodyBack+17,-g.nutOuterRadius-17,sign*(wallZ+5)]);this.mesh(fixed,new THREE.CylinderGeometry(3.2,3.2,3,6),steel,[g.bodyBack+17,-g.nutOuterRadius-12.5,sign*(wallZ+5)]);}
    const nut=this.part('nut','固定内螺纹螺母','螺母固定在钳体中，不随丝杠旋转或移动。内外牙导程一致，旋转带来轴向进给；半剖可观察30°梯形牙的配合和间隙。','单线右旋 · 有效长度 '+g.nutLength.toFixed(1)+' mm',3);nut.category='housing';
    this.nutFull=this.thread(nut,'nut',false);this.nutHalf=this.thread(nut,'nut',true);
    const nutMount=this.ringX(nut,g.nutOuterRadius+3,g.nutOuterRadius-1,3,dark,[(g.nutStart+g.nutEnd)/2,0,0]);nutMount.userData.cutaway=true;this.nutMount=nutMount;
    const moving=this.part('moving-jaw','活动钳口','活动钳口由丝杠轴向捕获，同时沿下方导轨直线移动。丝杠每转一周，钳口移动一个导程；闭合端仅表示钳口接触，不代表实际夹紧力已建立。','开口范围 0–'+p.maxOpening+' mm',2);moving.category='transmission';
    const movingGroup=new THREE.Group();moving.group.add(movingGroup);this.movers.push(movingGroup);this.jawBlock(moving,g.padThickness+g.jawDepth/2,g.jawDepth,movingGroup);
    this.mesh(moving,new THREE.BoxGeometry(g.jawDepth+12,9,W*.72),dark,[g.padThickness+g.jawDepth/2,g.jawBase-4.5,0],movingGroup);
    for(const [id,name,x,step,moves] of [['fixed-pad','固定钳口垫',-g.padThickness/2,4,false],['moving-pad','活动钳口垫',g.padThickness/2,2,true]]){
      const pad=this.part(id,name,'钢制钳口垫提供平行夹持面。标示开口测量的是两个钳口垫相向表面之间的距离。表面刻线仅作视觉定位，不据此预测工件压伤或摩擦。','宽 '+W+' mm · 垫厚 '+g.padThickness+' mm',step);pad.category='transmission';const group=new THREE.Group();pad.group.add(group);if(moves)this.movers.push(group);
      this.mesh(pad,new THREE.BoxGeometry(g.padThickness,g.padHeight,W),steel,[x,g.padCenter,0],group);
    }
    const guide=this.part('guide','双导轨','两条平行导轨约束活动钳口的侧向位移和转动。导轨仅示意导向功能，未求解接触应力、挠度或导向间隙。','行程覆盖 '+p.maxOpening+' mm',4);guide.category='transmission';
    for(const sign of [-1,1])this.mesh(guide,new THREE.BoxGeometry(g.guideLength,8,9),steel,[(g.bodyBack+p.maxOpening+g.jawDepth+20)/2,g.guideY-5,sign*W*.25]);
    const screw=this.part('screw','右旋梯形丝杠','丝杠在固定螺母内旋转并沿轴向移动，其肩部和止推环捕获活动钳口。单线导程等于螺距，丝杠每转一周，活动钳口移动一个导程。正向张开，反向闭合；到行程端点停止。','外径 '+D+' mm · 导程 '+p.lead+' mm/转',3);screw.category='transmission';
    const screwMover=new THREE.Group(),screwRotor=new THREE.Group();screw.group.add(screwMover);screwMover.add(screwRotor);this.movers.push(screwMover);this.rotors.push(screwRotor);this.screwBody=this.thread(screw,'screw',false,screwRotor);
    this.cylinderX(screw,g.journalRadius,g.journalEnd-g.threadEnd,steel,[(g.journalEnd+g.threadEnd)/2,0,0],screwRotor);
    const collar=this.part('collar','轴向捕获止推环','两侧止推环捕获活动钳口。拆解保留丝杠、止推环、钳口与手柄为总成；旋出螺母后再展示，不虚构整环穿过钳口。','随丝杠移动与旋转',1);collar.category='transmission';const collarMover=new THREE.Group(),collarRotor=new THREE.Group();collar.group.add(collarMover);collarMover.add(collarRotor);this.movers.push(collarMover);this.rotors.push(collarRotor);
    for(const x of [g.padThickness-2,g.padThickness+g.jawDepth+2])this.ringX(collar,g.journalRadius*1.6,g.journalRadius*1.015,4,warm,[x,0,0],collarRotor);
    const handle=this.part('handle','T形操作手柄','手柄与丝杠一起旋转和轴向移动。输入转速与转矩为给定运行工况；真实手动操作的加速、停顿及夹紧弹性未求解。','T柄转一周 = 钳口移动 '+p.lead+' mm',1);handle.category='transmission';const handleMover=new THREE.Group(),handleRotor=new THREE.Group();handle.group.add(handleMover);handleMover.add(handleRotor);this.movers.push(handleMover);this.rotors.push(handleRotor);
    this.cylinderX(handle,g.journalRadius*1.35,16,dark,[g.journalEnd+3,0,0],handleRotor);const arm=g.handleLength;this.tube(handle,[g.journalEnd+3,0,-arm/2],[g.journalEnd+3,0,arm/2],2.6,steel,handleRotor);for(const sign of [-1,1])this.mesh(handle,new THREE.SphereGeometry(4,16,12),warm,[g.journalEnd+3,0,sign*arm/2],handleRotor);
    const sideCover=this.part('side-cover','可拆侧盖','教学模型采用可拆侧盖：丝杠旋出后，先沿法向移走侧盖，再侧向取出螺母；实际整体铸造钳体不能照此拆开。','紧固件未细分；用于揭示内部连接',2);sideCover.category='housing';for(const wall of this.frontBody){sideCover.group.add(wall);wall.userData.partId=sideCover.id;}
    this.updateMotion();this.scene.updateMatrixWorld(true);
    const boxes=new Map(this.parts.map(p=>[p.id,new THREE.Box3().setFromObject(p.group)])),body=boxes.get('fixed-body'),guideBox=boxes.get('guide');
    this.disassemblyPlan={withdraw:Math.max(g.nutEnd,guideBox.max.x)-(g.threadStart+mid)+40,nutOut:W+80,coverOut:2*W+200,padLift:W+70};
    for(const part of this.parts)part.assemblyGroup=['fixed-body','guide'].includes(part.id)?'body-guide':['screw','moving-jaw','collar','handle'].includes(part.id)?'captured-carriage':part.id;
    this.pose();this.select(this.parts.some(x=>x.id===this.selected)?this.selected:'screw');if(hadRoot)this.fitModel();else this.home();this.onMotion?.();
  }
  blockedDirection(){return !!this.p&&(this.jawOpening<=1e-9&&this.p.direction<0||this.jawOpening>=this.p.maxOpening-1e-9&&this.p.direction>0);}
  advance(dt){
    if(!this.playing||!this.root)return;const next=motion(this.p,dt,this.speed,this.jawOpening);this.jawOpening=next.jawOpening;this.time+=dt;this.updateMotion();
    if(this.blockedDirection())this.playing=false;this.motionNotice=(this.motionNotice||0)+dt;
    if(!this.playing||this.motionNotice>=.1){this.motionNotice=0;this.onMotion?.();}
  }
  updateMotion(){
    if(!this.root||!this.movers)return;const displacement=this.jawOpening-this.p.maxOpening/2,angle=2*Math.PI*displacement/this.p.lead;
    for(const group of this.movers)group.position.x=this.jawOpening;for(const group of this.rotors)group.rotation.x=angle;this.rotations={screw:angle};
  }
  resetMotion(){this.playing=false;this.time=0;this.lastFrame=undefined;this.motionNotice=0;if(this.p)this.jawOpening=this.p.maxOpening/2;if(this.root)this.updateMotion();this.onMotion?.();}
  setPlaying(value){if(value&&(this.amount>0||this.step>0))this.restore();this.playing=Boolean(value)&&this.p?.inputRPM>0&&!this.blockedDirection();this.lastFrame=undefined;this.onMotion?.();this.render();}
  setSpeed(value){if(!Number.isFinite(value))throw new RangeError('无效演示速度');this.speed=THREE.MathUtils.clamp(value,.1,2);}
  setLabels(value){this.labelsOn=Boolean(value);this.render();}
  setHousingMode(mode){if(!['solid','open','transparent','hidden'].includes(mode))throw new RangeError('无效固定体显示方式');this.housingMode=mode;this.open=mode==='open';this.pose();this.fitModel();}
  pose(){
    const assembled=this.amount===0&&this.step===0;
    const progress=this.step||this.amount*(steps.length-1),plan=this.disassemblyPlan,withdraw=plan.withdraw*phase(progress,0);
    for(const rotor of this.rotors)rotor.rotation.x=2*Math.PI*((this.jawOpening-this.p.maxOpening/2)+withdraw)/this.p.lead;
    for(const part of this.parts){const carriage=['screw','moving-jaw','collar','handle','moving-pad'].includes(part.id),body=['fixed-body','guide'].includes(part.id);part.group.position.set(carriage?withdraw:0,['fixed-pad','moving-pad'].includes(part.id)?plan.padLift*phase(progress,3):0,part.id==='nut'?plan.nutOut*phase(progress,2):part.id==='side-cover'?plan.coverOut*phase(progress,1):0);part.group.visible=!(assembled&&this.housingMode==='hidden'&&part.category==='housing');
      if(part.category==='housing')part.group.traverse(o=>{if(!o.isMesh)return;const transparent=assembled&&this.housingMode==='transparent';o.material.transparent=transparent;o.material.opacity=transparent?.22:1;o.material.depthWrite=!transparent;if(o.userData.cutaway)o.visible=!(assembled&&this.housingMode==='open');});
    }
    if(this.nutFull){this.nutFull.visible=!(assembled&&this.housingMode==='open');this.nutHalf.visible=assembled&&this.housingMode==='open';}
    this.scene.updateMatrixWorld(true);this.render();
  }
  explode(value){const wasAssembled=this.amount===0&&this.step===0;this.resetMotion();this.amount=THREE.MathUtils.clamp(value,0,1);this.step=0;this.pose();if(wasAssembled&&this.amount>0||!wasAssembled&&this.amount===0)this.home();else this.fitModel();}
  assembly(step){const wasAssembled=this.amount===0&&this.step===0;this.resetMotion();this.step=THREE.MathUtils.clamp(step,0,steps.length-1);this.amount=0;this.pose();if(wasAssembled&&this.step>0||!wasAssembled&&this.step===0)this.home();else this.fitModel();}
  restore(){this.resetMotion();this.amount=0;this.step=0;this.pose();this.home();}
  select(id){const part=this.parts.find(x=>x.id===id);if(!part)return;this.selected=id;for(const p of this.parts)p.group.traverse(o=>{if(o.isMesh)o.material.emissive.setHex(p.id===id?0x122638:0);});this.onSelect(part);this.render();}
  home(direction=this.amount>0||this.step>0?[.3,.25,1]:[.55,.55,1]){
    const up=Math.abs(new THREE.Vector3(...direction).normalize().y)>.999?new THREE.Vector3(0,0,-1):new THREE.Vector3(0,1,0);
    if(!this.camera.up.equals(up)){const previous=this.controls;previous.removeEventListener('change',this.onControlChange);previous.dispose();this.camera.up.copy(up);this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.minDistance=100;this.controls.maxDistance=7000;this.controls.addEventListener('change',this.onControlChange);}
    const damp=this.controls.enableDamping;this.controls.enableDamping=false;this.controls.update();this.controls.target.set(0,0,0);this.camera.position.set(...direction).multiplyScalar(900);if(this.root)this.fitModel();else this.controls.update();this.controls.enableDamping=damp;
  }
  fitModel(){
    if(!this.root)return;this.scene.updateMatrixWorld(true);const bounds=new THREE.Box3();const boxes=[];
    this.root.traverse(mesh=>{if(!mesh.isMesh||!this.isVisible(mesh))return;let b;
      if(mesh.isInstancedMesh){mesh.computeBoundingBox();b=mesh.boundingBox.clone();}else{if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();b=mesh.geometry.boundingBox.clone();}
      b.applyMatrix4(mesh.matrixWorld);if(this.amount===0&&this.step===0&&['moving-jaw','moving-pad','screw','collar','handle'].includes(mesh.userData.partId)){b.min.x-=this.jawOpening;b.max.x+=this.p.maxOpening-this.jawOpening;}bounds.union(b);boxes.push(b);
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
      housingMode:this.housingMode,open:this.open,labelsOn:this.labelsOn,time:this.time,rotations:{...this.rotations},animationScale:ANIMATION_SCALE,
      jawOpening:this.jawOpening,displacement:this.jawOpening-this.p.maxOpening/2,screwTurns:(this.jawOpening-this.p.maxOpening/2)/this.p.lead,direction:this.p.direction,
      atLimit:this.jawOpening<=1e-9||this.jawOpening>=this.p.maxOpening-1e-9,limit:this.jawOpening<=1e-9?'closed':this.jawOpening>=this.p.maxOpening-1e-9?'open':null,
      geometry:this.g?{...this.g}:null,explosionLayout:this.explosionLayout&&{...this.explosionLayout,order:[...this.explosionLayout.order]},
      parts:this.parts.map(p=>{const b=new THREE.Box3().setFromObject(p.group);return {id:p.id,position:p.group.position.toArray(),visible:this.isVisible(p.group),min:b.min.toArray(),max:b.max.toArray()};}),
      camera:this.camera.position.toArray(),geometries:this.renderer.info.memory.geometries};
  }
  clearGeometry(){if(!this.root)return;const geometries=new Set(),materials=new Set();this.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);if(o.isInstancedMesh)o.dispose();});geometries.forEach(x=>x.dispose());materials.forEach(x=>x.dispose());this.scene.remove(this.root);this.root=null;}
  dispose(){this.disposed=true;cancelAnimationFrame(this.frame);this.events.abort();this.resize.disconnect();this.controls.removeEventListener('change',this.onControlChange);this.controls.dispose();this.clearGeometry();this.renderer.dispose();this.renderer.domElement.remove();this.parts=[];}
}
