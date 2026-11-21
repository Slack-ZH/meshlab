import * as THREE from 'three';
import {phase} from '../legacy-disassembly.mjs';
import {OrbitControls} from '../assets/OrbitControls.js';
import {geometry,chainPoint,PITCH,validate} from './mechanics.mjs';

export const steps=['完整传动','退出两侧曲柄与后轴外螺母','沿轴取下闭链与双链轮总成','后移车轮花鼓轴总成'];
const geometryKeys=['frontTeeth','rearTeeth','centerDistance','wheelDiameter','crankLength'];
const steel=0xa4b0bd,dark=0x354353,blue=0x2082a2,warm=0xba8750;
export class BicycleViewer {
  constructor(host,onSelect){
    this.host=host;this.onSelect=onSelect;this.parts=[];this.amount=0;this.step=0;this.selected='chainring';
    this.playing=false;this.speed=1;this.labelsOn=false;this.housingMode='solid';this.open=false;
    this.rotations={front:0,rear:0,wheel:0};this.chainPhase=0;this.time=0;
    this.events=new AbortController();this.label=host.closest('.viewer-panel')?.querySelector('#selection-label');
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(35,1,1,12000);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    host.append(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','自行车链传动三维视图，拖动旋转，滚轮缩放；点击选择零件。');
    this.onControlChange=()=>this.render();this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.enableDamping=true;this.controls.minDistance=250;this.controls.maxDistance=7000;
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
      if(this.playing&&this.root){
        this.time+=dt;this.rotations.front-=dt*this.p.cadence*Math.PI/30*this.speed*.2;
        this.rotations.rear=this.rotations.front*this.p.frontTeeth/this.p.rearTeeth;this.rotations.wheel=this.rotations.rear;
        this.chainPhase=-this.rotations.front*this.g.frontRadius;this.updateMotion();
      }
      this.controls.update();if(this.playing)this.render();
    };
    this.frame=requestAnimationFrame(loop);
  }
  isVisible(o){while(o){if(!o.visible)return false;o=o.parent;}return true;}
  render(){if(this.disposed)return;const part=this.parts.find(p=>p.id===this.selected);if(this.label){this.label.hidden=!(this.labelsOn&&part&&this.isVisible(part.group));if(part&&this.label.textContent!==part.name)this.label.textContent=part.name;}this.renderer.render(this.scene,this.camera);}
  material(color){return new THREE.MeshStandardMaterial({color,metalness:.68,roughness:.32,side:THREE.DoubleSide});}
  part(id,name,description,spec,step){const group=new THREE.Group();group.userData.partId=id;this.root.add(group);const p={id,name,description,spec,step,group,offset:new THREE.Vector3()};this.parts.push(p);return p;}
  mesh(p,geo,color,pos=[0,0,0],parent=p.group){const mesh=new THREE.Mesh(geo,this.material(color));mesh.position.set(...pos);mesh.userData.partId=p.id;parent.add(mesh);return mesh;}
  cylinder(p,radius,length,color,pos=[0,0,0],parent=p.group){const geo=new THREE.CylinderGeometry(radius,radius,length,40);geo.rotateX(Math.PI/2);return this.mesh(p,geo,color,pos,parent);}
  tube(p,a,b,r,color,parent=p.group){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),dir=end.clone().sub(start);const mesh=this.mesh(p,new THREE.CylinderGeometry(r,r,dir.length(),16),color,start.clone().add(end).multiplyScalar(.5).toArray(),parent);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());return mesh;}
  torus(p,r,t,color,pos=[0,0,0],parent=p.group){return this.mesh(p,new THREE.TorusGeometry(r,t,10,96),color,pos,parent);}
  ring(p,outer,inner,depth,color,parent=p.group){
    const shape=new THREE.Shape();shape.absarc(0,0,outer,0,2*Math.PI);const hole=new THREE.Path();hole.absarc(0,0,inner,0,2*Math.PI,true);shape.holes.push(hole);
    const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:48});geo.translate(0,0,-depth/2);return this.mesh(p,geo,color,[0,0,0],parent);
  }
  sprocket(p,teeth,radius,color,parent,bore){
    const shape=new THREE.Shape(),pitch=2*Math.PI/teeth;
    // Rounded roller pockets with thin tooth tips: a generic teaching profile.
    const profile=[[0,radius-4.7],[.12,radius-4.15],[.26,radius-1.3],[.38,radius+1.65],
      [.62,radius+1.65],[.74,radius-1.3],[.88,radius-4.15],[1,radius-4.7]];
    for(let i=0;i<teeth;i++)for(const [j,[fraction,r]] of profile.entries()){
      const a=(i+fraction)*pitch,x=r*Math.cos(a),y=r*Math.sin(a);if(i===0&&j===0)shape.moveTo(x,y);else shape.lineTo(x,y);
    }
    shape.closePath();const hole=new THREE.Path();hole.absarc(0,0,radius-13,0,2*Math.PI,true);shape.holes.push(hole);
    const geo=new THREE.ExtrudeGeometry(shape,{depth:2.7,bevelEnabled:false,curveSegments:20});geo.translate(0,0,-1.35);this.mesh(p,geo,color,[0,0,0],parent);
    this.ring(p,13,bore,4,color,parent);
    for(let i=0;i<5;i++){const a=i*2*Math.PI/5;this.tube(p,[11*Math.cos(a),11*Math.sin(a),0],[(radius-9)*Math.cos(a),(radius-9)*Math.sin(a),0],3.8,color,parent);}
  }
  makeChain(part){
    const n=this.g.chainLinks;
    const plate=new THREE.Shape();plate.moveTo(-PITCH/2,-3.5);plate.bezierCurveTo(-PITCH/2-4.2,-3.5,-PITCH/2-4.2,3.5,-PITCH/2,3.5);
    plate.bezierCurveTo(-2,3.5,-2,2.25,0,2.25);plate.bezierCurveTo(2,2.25,2,3.5,PITCH/2,3.5);
    plate.bezierCurveTo(PITCH/2+4.2,3.5,PITCH/2+4.2,-3.5,PITCH/2,-3.5);plate.bezierCurveTo(2,-3.5,2,-2.25,0,-2.25);plate.bezierCurveTo(-2,-2.25,-2,-3.5,-PITCH/2,-3.5);
    for(const x of [-PITCH/2,PITCH/2]){const hole=new THREE.Path();hole.absarc(x,0,1.65,0,2*Math.PI,true);plate.holes.push(hole);}
    const plateGeo=new THREE.ExtrudeGeometry(plate,{depth:1.0,bevelEnabled:false,curveSegments:5});plateGeo.translate(0,0,-.5);
    const rollerGeo=new THREE.CylinderGeometry(3.45,3.45,3.3,14);rollerGeo.rotateX(Math.PI/2);
    const pinGeo=new THREE.CylinderGeometry(1.45,1.45,10,10);pinGeo.rotateX(Math.PI/2);
    const create=(geo,color,count)=>{const mesh=new THREE.InstancedMesh(geo,this.material(color),count);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.userData.partId=part.id;part.group.add(mesh);return mesh;};
    this.chainMeshes={plates:create(plateGeo,0x7e94a5,n*2),rollers:create(rollerGeo,steel,n),pins:create(pinGeo,0xd0ad71,n)};
    this.dummy=new THREE.Object3D();
  }
  build(p){
    validate(p);
    if(this.p&&geometryKeys.every(key=>this.p[key]===p[key])){this.p={...p};if(p.cadence===0)this.playing=false;return;}
    const hadRoot=!!this.root;this.clearGeometry();this.resetMotion();this.amount=0;this.step=0;this.p={...p};this.g=geometry(p);this.parts=[];this.root=new THREE.Group();this.scene.add(this.root);
    const C=this.g.effectiveCenterDistance,front=-C/2,rear=C/2;
    const frame=this.part('frame','后车架','后车架约束中轴与后轮轴的位置。输入中心距会按偶数链节自动匹配为实际中心距。','实际中心距 '+C.toFixed(1)+' mm',4);
    const seat=[front+70,280,-39],bb=[front,0,-39],drop=[rear,0,-39];
    const inset=(a,b,d)=>new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).normalize().multiplyScalar(d).add(new THREE.Vector3(...a)).toArray();
    for(const [a,b,r] of [[inset(bb,seat,16),seat,11],[seat,inset(drop,seat,15),8],[inset(drop,bb,15),inset(bb,drop,16),8]])this.tube(frame,a,b,r,blue);
    this.ring(frame,18,10.5,12,blue).position.set(...drop);
    this.ring(frame,23,8.3,48,blue).position.set(front,0,-28);this.tube(frame,seat,[front+92,365,-39],8,dark);
    const saddle=this.mesh(frame,new THREE.BoxGeometry(87,12,38),dark,[front+68,368,-39]);saddle.rotation.z=-.06;
    const wheel=this.part('wheel','后轮与花鼓','后链轮把转矩传给花鼓，后轮在踩踏状态下与链轮同转速。轮胎直径影响无滑移条件下的理想车速。','后轮外径 '+p.wheelDiameter+' mm',4);
    this.wheelSpin=new THREE.Group();this.wheelSpin.position.set(rear,0,-64);wheel.group.add(this.wheelSpin);
    this.torus(wheel,p.wheelDiameter/2-9,9,0x384350,[0,0,0],this.wheelSpin);this.torus(wheel,p.wheelDiameter/2-21,3,steel,[0,0,0],this.wheelSpin);
    this.ring(wheel,16,5.3,38,steel,this.wheelSpin);this.ring(wheel,24,5.3,5,steel,this.wheelSpin).position.z=-20;this.ring(wheel,24,5.3,5,steel,this.wheelSpin).position.z=20;
    for(let i=0;i<28;i++){const a=i*2*Math.PI/28,b=a+(i%2?-.12:.12);this.tube(wheel,[20*Math.cos(b),20*Math.sin(b),i%2?18:-18],[(p.wheelDiameter/2-22)*Math.cos(a),(p.wheelDiameter/2-22)*Math.sin(a),0],.9,steel,this.wheelSpin);}
    const axle=this.part('rear-axle','后轮轴','后轮轴与车架固定，花鼓围绕轴承旋转。示意轴承和锁紧件用于说明轴系装配。','轴线与中轴平行',4);
    this.cylinder(axle,5,110,dark,[rear,0,-43]);for(const z of [-96,10])this.cylinder(axle,10,7,steel,[rear,0,z]);
    const bracket=this.part('bottom-bracket','中轴','中轴支承曲柄与牙盘旋转。曲柄长度改变脚踏轨迹，不直接改变前后齿比。','曲柄长度 '+p.crankLength+' mm',4);
    this.cylinder(bracket,8,112,dark,[front,0,-35]);for(const z of [-58,-7])this.ring(bracket,17,8.3,6,steel).position.set(front,0,z);
    const rearPart=this.part('rear-sprocket','后链轮','链条驱动后链轮。相同踏频下，增加后链轮齿数会降低后轮转速，并提高理想输出转矩。',p.rearTeeth+' 齿 · 同平面单速链线',3);
    this.rearSpin=new THREE.Group();this.rearSpin.position.set(rear,0,0);rearPart.group.add(this.rearSpin);this.sprocket(rearPart,p.rearTeeth,this.g.rearRadius,steel,this.rearSpin,5.3);
    this.ring(rearPart,10,5.3,42,dark,this.rearSpin).position.z=-22;
    const ringPart=this.part('chainring','前牙盘','前牙盘随曲柄旋转，通过滚子链向后链轮传递运动。修改齿数会重建齿形并同步调整链条长度与中心距。',p.frontTeeth+' 齿 · 名义节距 12.7 mm',3);
    this.frontSpin=new THREE.Group();this.frontSpin.position.set(front,0,0);ringPart.group.add(this.frontSpin);this.sprocket(ringPart,p.frontTeeth,this.g.frontRadius,warm,this.frontSpin,8.3);
    const chain=this.part('chain','滚子链','内外链节交替连接。未建快拆链节，拆解时闭链与两个链轮一起沿轴退出并保持啮合，不能把闭链刚体拉过齿顶。',this.g.chainLinks+' 节 · 12.7 mm 名义节距 · 内宽 3.30 mm',2);this.makeChain(chain);
    const crank=this.part('crank','曲柄与脚踏','曲柄把踩踏运动传给前牙盘。左右曲柄相差 180°，脚踏绕自己的轴转动；演示中脚踏保持水平。','两侧曲柄 '+p.crankLength+' mm',1);
    this.crankSpin=new THREE.Group();this.crankSpin.position.set(front,0,0);crank.group.add(this.crankSpin);
    for(const [a,z] of [[0,14],[Math.PI,-84]]){
      this.tube(crank,[10*Math.cos(a),10*Math.sin(a),z],[p.crankLength*Math.cos(a),p.crankLength*Math.sin(a),z],7,steel,this.crankSpin);
      this.ring(crank,12,8.3,9,dark,this.crankSpin).position.z=z;
    }
    this.pedals=[];
    for(const z of [31,-101]){const pedal=new THREE.Group();crank.group.add(pedal);this.mesh(crank,new THREE.BoxGeometry(43,12,28),dark,[0,0,0],pedal);for(const x of [-15,0,15])this.mesh(crank,new THREE.BoxGeometry(2,13,29),steel,[x,0,0],pedal);this.pedals.push({group:pedal,z});}
    const axlePart=this.parts.find(p=>p.id==='rear-axle'),endNut=axlePart.group.children.at(-1);axlePart.group.remove(endNut);endNut.geometry.dispose();endNut.material.dispose();const lock=this.part('rear-locknut','后轴外侧锁紧螺母','先退外侧螺母，才可让后链轮套沿轴退出。','轴孔有间隙；螺纹为教学简化',1);this.ring(lock,10,5.3,7,steel).position.set(rear,0,10);
    const left=this.part('crank-left','左曲柄与脚踏','左右曲柄分别向各自外侧退出；不把两侧曲柄当作贯穿车架的刚体。','左侧沿负Z轴退出',1);this.leftCrankSpin=new THREE.Group();this.leftCrankSpin.position.copy(this.crankSpin.position);left.group.add(this.leftCrankSpin);for(const mesh of [...this.crankSpin.children].slice(2)){this.leftCrankSpin.add(mesh);mesh.userData.partId=left.id;}left.group.add(this.pedals[1].group);
    this.updateMotion();this.scene.updateMatrixWorld(true);
    const boxes=this.parts.map(p=>new THREE.Box3().setFromObject(p.group)),depth=Math.max(...boxes.map(b=>b.max.z))-Math.min(...boxes.map(b=>b.min.z));
    for(const p of this.parts){p.offset.set(0,0,['crank','rear-locknut'].includes(p.id)?3*depth+300:p.id==='crank-left'?-3*depth-300:['chain','chainring','rear-sprocket'].includes(p.id)?depth+100:['wheel','rear-axle'].includes(p.id)?-depth-100:0);p.step=['crank','crank-left','rear-locknut'].includes(p.id)?1:['chain','chainring','rear-sprocket'].includes(p.id)?2:['wheel','rear-axle'].includes(p.id)?3:0;}
    this.pose();this.select(this.parts.some(x=>x.id===this.selected)?this.selected:'chainring');
    if(hadRoot)this.fitModel();else this.home();
  }
  updateMotion(){
    if(!this.root)return;
    this.frontSpin.rotation.z=this.g.tangentAngle+this.rotations.front;
    this.rearSpin.rotation.z=this.g.tangentAngle+this.g.tangentLength/this.g.rearRadius+this.rotations.rear;
    this.wheelSpin.rotation.z=this.rotations.wheel;this.crankSpin.rotation.z=this.rotations.front-.9;if(this.leftCrankSpin)this.leftCrankSpin.rotation.z=this.rotations.front-.9;
    this.pedals.forEach(({group,z},i)=>{const a=this.rotations.front-.9+i*Math.PI;group.position.set(-this.g.effectiveCenterDistance/2+this.p.crankLength*Math.cos(a),this.p.crankLength*Math.sin(a),z);});
    const {plates,rollers,pins}=this.chainMeshes,n=this.g.chainLinks,dummy=this.dummy;
    let min=Infinity,max=0;
    for(let i=0;i<n;i++){
      const a=chainPoint(this.g,this.chainPhase+i*PITCH),b=chainPoint(this.g,this.chainPhase+(i+1)*PITCH);
      const dx=b[0]-a[0],dy=b[1]-a[1],distance=Math.hypot(dx,dy);min=Math.min(min,distance);max=Math.max(max,distance);
      dummy.position.set(a[0],a[1],0);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();rollers.setMatrixAt(i,dummy.matrix);pins.setMatrixAt(i,dummy.matrix);
      dummy.rotation.z=Math.atan2(dy,dx);dummy.scale.x=distance/PITCH;
      for(const [side,z] of [[0,i%2?3.85:2.3],[1,i%2?-3.85:-2.3]]){dummy.position.set((a[0]+b[0])/2,(a[1]+b[1])/2,z);dummy.updateMatrix();plates.setMatrixAt(i*2+side,dummy.matrix);}
    }
    this.minimumLinkDistance=min;this.maximumLinkDistance=max;
    for(const mesh of Object.values(this.chainMeshes)){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();}
  }
  resetMotion(){this.playing=false;this.time=0;this.lastFrame=undefined;this.rotations={front:0,rear:0,wheel:0};this.chainPhase=0;if(this.root)this.updateMotion();}
  setPlaying(value){if(value&&(this.amount>0||this.step>0))this.restore();this.playing=Boolean(value)&&this.p?.cadence>0;this.lastFrame=undefined;this.render();}
  setSpeed(value){if(!Number.isFinite(value))throw new RangeError('无效演示速度');this.speed=THREE.MathUtils.clamp(value,.1,2);}
  setLabels(value){this.labelsOn=Boolean(value);this.render();}
  setHousingMode(mode){if(!['solid','open','transparent','hidden'].includes(mode))throw new RangeError('无效车架显示方式');this.housingMode=mode;this.open=mode==='open';this.pose();this.fitModel();}
  pose(){
    const assembled=this.amount===0&&this.step===0;
    for(const p of this.parts){
      const factor=p.step?phase(this.step||this.amount*(steps.length-1),p.step-1):0;
      p.group.position.copy(p.offset).multiplyScalar(factor);
      const hideForMode=this.housingMode==='open'&&['frame','wheel'].includes(p.id)||this.housingMode==='hidden'&&p.id==='frame';
      p.group.visible=!(assembled&&hideForMode);
      if(p.id==='frame')p.group.traverse(o=>{if(!o.isMesh)return;const transparent=assembled&&this.housingMode==='transparent';o.material.transparent=transparent;o.material.opacity=transparent?.18:1;o.material.depthWrite=!transparent;});
    }
    this.scene.updateMatrixWorld(true);this.render();
  }
  explode(value){this.resetMotion();this.amount=THREE.MathUtils.clamp(value,0,1);this.step=0;this.pose();this.fitModel();}
  assembly(step){this.resetMotion();this.step=THREE.MathUtils.clamp(step,0,steps.length-1);this.amount=0;this.pose();this.fitModel();}
  restore(){this.resetMotion();this.amount=0;this.step=0;this.pose();this.home();}
  select(id){const part=this.parts.find(x=>x.id===id);if(!part)return;this.selected=id;for(const p of this.parts)p.group.traverse(o=>{if(o.isMesh)o.material.emissive.setHex(p.id===id?0x122638:0);});this.onSelect(part);this.render();}
  home(direction=this.amount>0||this.step>0?[.8,.25,1.3]:[.12,.1,1]){
    const up=Math.abs(new THREE.Vector3(...direction).normalize().y)>.999?new THREE.Vector3(0,0,-1):new THREE.Vector3(0,1,0);
    if(!this.camera.up.equals(up)){const previous=this.controls;previous.removeEventListener('change',this.onControlChange);previous.dispose();this.camera.up.copy(up);this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.minDistance=250;this.controls.maxDistance=7000;this.controls.addEventListener('change',this.onControlChange);}
    const damp=this.controls.enableDamping;this.controls.enableDamping=false;this.controls.update();this.controls.target.set(0,0,0);this.camera.position.set(...direction).multiplyScalar(1600);if(this.root)this.fitModel();else this.controls.update();this.controls.enableDamping=damp;
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
      housingMode:this.housingMode,open:this.open,labelsOn:this.labelsOn,time:this.time,rotations:{...this.rotations},chainPhase:this.chainPhase,
      chain:this.g?{links:this.g.chainLinks,pitch:PITCH,length:this.g.chainLength,requestedCenterDistance:this.g.requestedCenterDistance,effectiveCenterDistance:this.g.effectiveCenterDistance,
        centerCorrection:this.g.centerCorrection,closureError:this.g.closureError,minimumLinkDistance:this.minimumLinkDistance,maximumLinkDistance:this.maximumLinkDistance,approximation:'连续节线；忽略多边形效应；链片端距随弯曲作示意修正'}:null,
      parts:this.parts.map(p=>{const b=new THREE.Box3().setFromObject(p.group);return {id:p.id,position:p.group.position.toArray(),visible:this.isVisible(p.group),min:b.min.toArray(),max:b.max.toArray()};}),
      camera:this.camera.position.toArray(),geometries:this.renderer.info.memory.geometries};
  }
  clearGeometry(){if(!this.root)return;const geometries=new Set(),materials=new Set();this.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);if(o.isInstancedMesh)o.dispose();});geometries.forEach(x=>x.dispose());materials.forEach(x=>x.dispose());this.scene.remove(this.root);this.root=null;}
  dispose(){this.disposed=true;cancelAnimationFrame(this.frame);this.events.abort();this.resize.disconnect();this.controls.removeEventListener('change',this.onControlChange);this.controls.dispose();this.clearGeometry();this.renderer.dispose();this.renderer.domElement.remove();this.parts=[];}
}
