import * as THREE from 'three';
import {OrbitControls} from '../assets/OrbitControls.js';
import {geometry} from './physics.mjs';
import {bladeLayout,bladeMeshData} from './blade-geometry.mjs';

const cold=0x247b9a,warm=0xc17c3e;
export const steps=['整机装配','移开上汽缸','移出轴端组件','下移下汽缸','分离静叶隔板'];
export class TurbineViewer {
  constructor(host,onSelect) {
    this.host=host;this.onSelect=onSelect;this.parts=[];this.amount=0;this.step=0;this.open=false;this.selected=null;
    this.playing=false;this.speed=1;this.rotorAngle=0;this.housingMode='solid';this.labelsOn=false;
    this.events=new AbortController();this.label=host.closest('.viewer-panel')?.querySelector('#selection-label');
    this.scene=new THREE.Scene();
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    host.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label','汽轮机三维视图，拖动旋转，滚轮或双指缩放；也可从部件列表选择');
    this.camera=new THREE.PerspectiveCamera(36,1,1,16000);
    this.onControlChange=()=>this.render();
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.enableDamping=true;this.controls.minDistance=300;this.controls.maxDistance=9000;
    this.controls.addEventListener('change',this.onControlChange);
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x6a8195,2.8));
    for(const [x,y,z,intensity] of [[-600,1000,700,3],[700,300,-600,2]]) {const l=new THREE.DirectionalLight(0xffffff,intensity);l.position.set(x,y,z);this.scene.add(l);}
    this.home();
    this.resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;this.renderer.setSize(w,h);if (!w || !h) return;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();if(this.root)this.fitModel();this.render();});
    this.resize.observe(host);
    let down;
    host.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY],{signal:this.events.signal});
    host.addEventListener('pointerup',e=>{
      if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;
      const r=host.getBoundingClientRect(),ray=new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),this.camera);
      const visible=[];this.scene.traverse(o=>{if(o.isMesh&&o.userData.partId&&this.isVisible(o))visible.push(o);});
      const hit=ray.intersectObjects(visible,false)[0];if(hit)this.select(hit.object.userData.partId);
    },{signal:this.events.signal});
    const loop=now=>{
      if(this.disposed)return;
      this.frame=requestAnimationFrame(loop);
      const dt=this.lastFrame===undefined ? 0 : Math.min((now-this.lastFrame)/1000,.05);
      this.lastFrame=now;
      // Deliberate slow-motion demonstration (12 r/min at 1x), not an operating
      // speed or a result of the steam-property / shaft-power calculation.
      if(this.playing&&this.rotor){
        this.rotorAngle=(this.rotorAngle+dt*this.speed*Math.PI*.4)%(2*Math.PI);
        this.rotor.rotation.x=this.rotorAngle;
      }
      this.controls.update();
      if(this.playing)this.render();
    };
    this.frame=requestAnimationFrame(loop);
  }
  isVisible(o){while(o){if(!o.visible)return false;o=o.parent;}return true;}
  render(){if(this.disposed)return;this.updateSelectionLabel();this.renderer.render(this.scene,this.camera);}
  updateSelectionLabel(){
    if(!this.label)return;
    const part=this.parts.find(p=>p.id===this.selected);
    this.label.hidden=!(this.labelsOn&&part&&this.isVisible(part.group));
    if(part&&this.label.textContent!==part.name)this.label.textContent=part.name;
  }
  setLabels(value){this.labelsOn=Boolean(value);this.updateSelectionLabel();}
  setSpeed(value){
    if(!Number.isFinite(value))throw new RangeError('演示速度须为有效数值');
    this.speed=THREE.MathUtils.clamp(value,.1,2);
  }
  setPlaying(value){
    if(value){
      if(this.amount>0||this.step>0)this.restore();
      if(this.housingMode==='solid')this.setHousingMode('open');
    }
    this.playing=Boolean(value);this.lastFrame=undefined;this.render();
  }
  resetMotion(){
    this.playing=false;this.rotorAngle=0;this.lastFrame=undefined;
    if(this.rotor)this.rotor.rotation.x=0;
  }
  setHousingMode(mode){
    if(!['solid','open','transparent','hidden'].includes(mode))throw new RangeError('汽缸显示方式无效');
    this.housingMode=mode;this.open=mode==='open';this.pose();this.fitModel();
  }
  home(direction = this.amount > 0 || this.step > 0 ? [0.38, 0.12, 1] : [0.63, 0.48, 1]) {
    const nextUp=Math.abs(new THREE.Vector3(...direction).normalize().y)>.999
      ? new THREE.Vector3(0,0,-1) : new THREE.Vector3(0,1,0);
    if(!this.camera.up.equals(nextUp)){
      // OrbitControls captures its up-axis when constructed. Recreate it when
      // switching to exact top view, instead of mutating private quaternion data.
      const previous=this.controls;
      previous.removeEventListener('change',this.onControlChange);previous.dispose();
      this.camera.up.copy(nextUp);
      this.controls=new OrbitControls(this.camera,this.renderer.domElement);
      this.controls.target.copy(previous.target);
      this.controls.enableDamping=previous.enableDamping;
      this.controls.minDistance=previous.minDistance;this.controls.maxDistance=previous.maxDistance;
      this.controls.addEventListener('change',this.onControlChange);
    }
    const damping = this.controls.enableDamping;
    this.controls.enableDamping = false;
    this.controls.update();
    this.controls.target.set(0,0,0);
    this.camera.position.set(...direction).multiplyScalar(1600);
    if (this.root) this.fitModel();
    else this.controls.update();
    this.controls.enableDamping = damping;
  }
  fitModel(){
    const bounds = new THREE.Box3();
    const meshBounds=[];
    this.root.traverse(mesh => {
      if (!mesh.isMesh || !this.isVisible(mesh)) return;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const box=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
      bounds.union(box);meshBounds.push(box);
    });
    if (bounds.isEmpty()) return;
    const center = bounds.getCenter(new THREE.Vector3());
    const tanV=Math.tan(this.camera.fov*Math.PI/360),tanH=tanV*this.camera.aspect;
    const direction=this.camera.position.clone().sub(this.controls.target).normalize();
    const right=new THREE.Vector3().crossVectors(this.camera.up,direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right);
    let distance=0;
    for(const box of meshBounds)for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
      const v=new THREE.Vector3(x,y,z).sub(center),depth=v.dot(direction);
      distance=Math.max(distance,depth+Math.abs(v.dot(right))/tanH,depth+Math.abs(v.dot(up))/tanV);
    }
    this.controls.target.copy(center);this.camera.position.copy(center).addScaledVector(direction,distance * 1.14);this.controls.update();
  }
  part(id,name,description,offset=[0,0,0],step=0,parent=this.root) {
    const group=new THREE.Group();group.userData.partId=id;parent.add(group);
    const p={id,name,description,group,offset:new THREE.Vector3(...offset),step};this.parts.push(p);return p;
  }
  mesh(part,geo,color,pos=[0,0,0],outline=false) {
    const mat=new THREE.MeshStandardMaterial({color,metalness:.45,roughness:.36,side:THREE.DoubleSide});
    const m=new THREE.Mesh(geo,mat);m.position.set(...pos);m.userData.partId=part.id;part.group.add(m);
    if(outline){const edge=new THREE.LineSegments(new THREE.EdgesGeometry(geo,28),new THREE.LineBasicMaterial({color}));m.add(edge);}
    return m;
  }
  cylinder(part,r,length,color,x=0,y=0,z=0){const g=new THREE.CylinderGeometry(r,r,length,48);g.rotateZ(Math.PI/2);return this.mesh(part,g,color,[x,y,z]);}
  annulus(outer, inner, length, half = 0) {
    const shape = new THREE.Shape();
    if (half) {
      const start = half > 0 ? 0 : Math.PI;
      const end = start + Math.PI;
      shape.absarc(0, 0, outer, start, end, false);
      shape.lineTo(inner * Math.cos(end), inner * Math.sin(end));
      shape.absarc(0, 0, inner, end, start, true);
      shape.closePath();
    } else {
      shape.absarc(0, 0, outer, 0, 2 * Math.PI, false);
      const hole = new THREE.Path();
      hole.absarc(0, 0, inner, 0, 2 * Math.PI, true);
      shape.holes.push(hole);
    }
    const mesh = new THREE.ExtrudeGeometry(shape, {depth: length, bevelEnabled: false, curveSegments: 48});
    mesh.translate(0, 0, -length / 2);
    return mesh;
  }
  ring(part, outer, inner, length, x, half = 0, color = 0x7f99aa) {
    const geometry = this.annulus(outer, inner, length, half);
    geometry.rotateY(Math.PI / 2);
    return this.mesh(part, geometry, color, [x, 0, 0]);
  }
  casingWall(length, radius, half, port) {
    const sectionStart = half > 0 ? 0 : Math.PI;
    const sectionEnd = sectionStart + Math.PI;
    const stations = [-length / 2];
    for (let i = 0; i <= 24; i++) {
      stations.push(port.x - port.bore * Math.cos(Math.PI * i / 24));
    }
    stations.push(length / 2);
    const vertices = [], indices = [];
    // At each axial station, clip the cylindrical wall to the projected circular bore.
    for (const wallRadius of [radius, radius - 15]) {
      for (const side of [-1, 1]) {
        const base = vertices.length / 3;
        for (const x of stations) {
          const halfWidth = Math.sqrt(Math.max(0, port.bore ** 2 - (x - port.x) ** 2));
          const opening = Math.asin(halfWidth / wallRadius);
          const innerAngle = port.angle + side * opening;
          const edge = side < 0 ? sectionStart : sectionEnd;
          for (let i = 0; i <= 36; i++) {
            const angle = edge + (innerAngle - edge) * i / 36;
            vertices.push(x, wallRadius * Math.sin(angle), -wallRadius * Math.cos(angle));
          }
        }
        const reverse = (wallRadius !== radius) !== (side > 0);
        for (let row = 0; row < stations.length - 1; row++) {
          for (let i = 0; i < 36; i++) {
            const a = base + row * 37 + i, b = a + 37;
            indices.push(...(reverse ? [a,b,a+1,a+1,b,b+1] : [a,a+1,b,a+1,b+1,b]));
          }
        }
      }
    }
    const shell = new THREE.BufferGeometry();
    shell.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    shell.setIndex(indices);
    shell.computeVertexNormals();
    return shell;
  }
  nozzle(part, x, radius, direction, mouth, neck) {
    const axis = new THREE.Vector3(...direction);
    const pipe = this.annulus(mouth, mouth - 8, neck);
    const flange = this.annulus(mouth + 19, mouth - 8, 15);
    const base = this.annulus(mouth + 12, mouth - 8, 19);
    const orient = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), axis);
    for (const [shape, distance, color] of [
      [base, radius, 0x7897aa],
      [pipe, radius + neck / 2, 0x7897aa],
      [flange, radius + neck, 0xb5c7d2],
    ]) {
      shape.applyQuaternion(orient);
      this.mesh(part, shape, color, [x, axis.y * distance, axis.z * distance]);
    }
    const bolt = new THREE.CylinderGeometry(5, 5, 8, 6);
    bolt.rotateX(Math.PI / 2).applyQuaternion(orient);
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      const local = new THREE.Vector3(Math.cos(angle) * (mouth + 9), Math.sin(angle) * (mouth + 9), radius + neck + 10);
      local.applyQuaternion(orient);
      this.mesh(part, bolt, 0x566976, [x + local.x, local.y, local.z]);
    }
  }
  build(p) {
    this.p = {...p};
    if (this.root) {
      const geometries = new Set(), materials = new Set();
      this.root.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) materials.add(o.material); });
      geometries.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
      this.scene.remove(this.root);
    }
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.parts = [];
    const {length} = geometry(p);
    const hub = p.hub / 2, tip = hub + p.height, radius = tip + 26;
    const rowShift = radius + 45;
    const shellShift = 2 * radius + 105;
    const shaftHalf = length / 2 + 140;
    const casingColor = 0x8caabc;
    const portX = (fraction, bore) => Math.sign(fraction) * Math.min(Math.abs(fraction * length), length / 2 - bore - 19);
    const inletPort = { x: portX(-.29, 29), bore: 29, angle: Math.PI / 2 };
    const exhaustMouth = p.exhaust === 'condensing' ? 65 : 50;
    const exhaustPort = { x: portX(.28, exhaustMouth - 8), bore: exhaustMouth - 8, angle: Math.PI + Math.asin(.6) };
    const lower = this.part('lower','下汽缸','水平剖分汽缸的下半部，带设备支脚与排汽接管。',[0,-shellShift,0],3);
    const upper = this.part('upper','上汽缸','水平结合面与下汽缸合拢，进汽口随上汽缸一起移开。',[0,shellShift,0],1);
    for (const [casing, half] of [[upper,1],[lower,-1]]) {
      const port = half > 0 ? inletPort : exhaustPort;
      this.mesh(casing, this.casingWall(length, radius, half, port), casingColor);
      for (const side of [-1,1]) {
        this.ring(casing, radius, 39, 16, side * (length / 2 - 8), half, casingColor);
        this.ring(casing, radius + 11, radius - 8, 18, side * (length / 2 - 10), half, 0xa3bccc);
        this.mesh(casing, new THREE.BoxGeometry(length,16,38), casingColor,
          [0,half * 8,side * (radius + 1)]);
        if (half < 0) this.mesh(casing, new THREE.BoxGeometry(82,38,90), 0x7793a6,
          [side * (length / 2 - 45), -radius * .58, side * (radius * .78)]);
      }
      for (const [fraction, width] of [[-.26,8],[.23,8]]) {
        const ribX = length * fraction;
        if (Math.abs(ribX - port.x) > port.bore + 27)
          this.ring(casing, radius + 9, radius - 2, width, ribX, half, casingColor);
      }
    }
    const inlet = this.part('inlet','进汽口','蒸汽从汽缸顶部的法兰接管进入。',[0,0,0],0,upper.group);
    this.nozzle(inlet, inletPort.x, radius - 7, [0,1,0], 37, 92);

    const exhaust = this.part('exhaust','排汽口',
      p.exhaust === 'condensing' ? '排汽经大口径法兰通往凝汽器。' : '排汽经法兰进入工艺用汽管路。',
      [0,0,0],0,lower.group);
    this.nozzle(exhaust, exhaustPort.x, radius - 8, [0,-.6,.8], exhaustMouth, 106);

    const rotor = this.part('rotor','转子总成','动叶、轮盘和主轴共轴。爆炸视图以此为装配基准。');
    this.rotor=rotor.group;this.rotor.rotation.x=this.rotorAngle;
    this.cylinder(rotor, 35, 2 * shaftHalf, 0xaebac3);
    for (const sign of [-1,1]) {
      const bearing = this.part('bearing'+sign, sign < 0 ? '前轴承座' : '后轴承座',
        '支承轴系。拆解时沿轴线退出。',[sign*300,0,0],2);
      const bearingX = sign * (length / 2 + 99);
      this.ring(bearing, 65, 38, 72, bearingX, 0, 0x7f9eaf);
      this.mesh(bearing, new THREE.BoxGeometry(78,46,143), 0x7793a6,[bearingX,-67,0]);
      const seal = this.part('seal'+sign, sign < 0 ? '前轴封' : '后轴封',
        '轴封围绕主轴，拆解时沿轴线退出。',[sign*155,0,0],2);
      this.ring(seal, 52, 39, 29, sign * (length / 2 + 23), 0, 0xb0bdc7);
    }

    this.bladeDesign = bladeLayout(p);
    const profile = (design, moving) => {
      const data = bladeMeshData(p,design,moving);
      // Triangulate both concave end sections; a fan would fill the bucket's
      // hollow side incorrectly. Keep a closed, indexed surface.
      for (const [end,points] of data.capProfiles.entries()) {
        const faces = THREE.ShapeUtils.triangulateShape(points.map(point=>new THREE.Vector2(...point)),[]);
        const offset=end ? (data.sectionCount-1)*data.width : 0;
        for(const [a,b,c] of faces) data.indices.push(...(end ? [c+offset,b+offset,a+offset] : [a,b,c]));
      }
      const blade = new THREE.BufferGeometry();
      blade.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));
      blade.setIndex(data.indices);
      blade.computeVertexNormals();
      return blade;
    };
    for (let stage = 0; stage < p.stages; stage++) {
      const design = this.bladeDesign.stages[stage];
      const stageTip = hub + design.height;
      const staticBlade = profile(design,false), movingBlade = profile(design,true);
      const x = -length / 2 + 50 + stage * (2*p.chord + 45);
      const stationaryX = x + p.chord / 2;
      const movingX = x + p.chord * 1.5 + 22;
      const dimension = ' 本级叶高 '+design.height.toFixed(1)+' mm，根部弦长 '+p.chord+' mm，每排 '+p.blades+' 片。';
      const description = (p.work === 'impulse' ? '非对称静叶引导并加速蒸汽，与对称冲动动叶成级。'
        : '静叶与动叶采用非对称翼型示意，二者均参与膨胀。')+dimension+' 叶型为教学预设，不是制造标准型线。';
      const stators = [1,-1].map(half => {
        const part = this.part(half > 0 ? 'stator-'+stage : 'stator-lower-'+stage,
          '第 ' + (stage + 1) + ' 级' + (half > 0 ? '上' : '下') + '静叶隔板', description,[0,half*rowShift,0],4);
        this.ring(part, radius - 15, stageTip - 3, 14, stationaryX, half, cold);
        this.ring(part, hub + 1, 39, 10, stationaryX, half, 0x7a9cad);
        return part;
      });
      const moving = this.part('moving-'+stage,'第 ' + (stage + 1) + ' 级动叶',
        (p.work==='impulse' ? '对称冲动叶型，沿叶高保持等截面。' : '非对称反动翼型，叶尖弦长收至根部的 92%，展向扭转预设 4°。')+dimension+' 动叶随主轴旋转并输出转矩；几何参数未参与功率求解。',
        [0,0,0],0,rotor.group);
      this.cylinder(moving, hub + 1, 18, 0xaab7c1, movingX);
      for (let bladeIndex = 0; bladeIndex < p.blades; bladeIndex++) {
        const angle = (bladeIndex + .25) * 2 * Math.PI / p.blades;
        for (const [part, blade, axial, color] of [
          [stators[angle < Math.PI ? 0 : 1], staticBlade, stationaryX, cold],
          [moving, movingBlade, movingX, warm],
        ]) {
          const mesh = this.mesh(part, blade, color, [axial,hub*Math.sin(angle),hub*Math.cos(angle)]);
          mesh.rotation.x = Math.PI / 2 - angle;
          mesh.userData.blade = true;
          mesh.userData.stage = stage + 1;
          mesh.userData.row = part === moving ? 'rotor' : 'stator';
        }
      }
    }
    this.pose();
    if (!this.parts.some(part => part.id === this.selected)) this.selected = 'upper';
    this.select(this.selected);
    this.fitModel();
  }
  pose() {
    // Keep the original open boolean compatible with parameter-driven opening.
    if(this.open)this.housingMode='open';
    else if(this.housingMode==='open')this.housingMode='solid';
    const assembled=this.step===0&&this.amount===0;
    for(const part of this.parts) {
      const progress = this.step || this.amount * (steps.length - 1);
      const factor = part.step ? THREE.MathUtils.clamp(progress - part.step + 1, 0, 1) : 0;
      part.group.position.copy(part.offset).multiplyScalar(factor);
      const casing=['upper','lower','inlet','exhaust'].includes(part.id);
      part.group.visible=!(assembled&&casing&&(this.housingMode==='hidden'||
        this.housingMode==='open'&&['upper','inlet'].includes(part.id)));
      if(['upper','lower'].includes(part.id))part.group.traverse(object=>{
        if(!object.isMesh)return;
        const transparent=assembled&&this.housingMode==='transparent';
        if(object.material.transparent!==transparent)object.material.needsUpdate=true;
        object.material.transparent=transparent;object.material.opacity=transparent?.2:1;
        object.material.depthWrite=!transparent;
      });
    }
    this.scene.updateMatrixWorld(true);this.render();
  }
  explode(value){this.resetMotion();this.amount=value;this.step=0;this.open=false;this.housingMode='solid';this.pose();this.fitModel();}
  assembly(value){this.resetMotion();this.step=value;this.amount=0;this.open=false;this.housingMode='solid';this.pose();this.fitModel();}
  restore(){this.resetMotion();this.amount=0;this.step=0;this.open=false;this.housingMode='solid';this.pose();this.home();}
  select(id){const p=this.parts.find(x=>x.id===id);if(!p)return;this.selected=id;
    for(const part of this.parts)part.group.traverse(o=>{if(o.isMesh&&o.userData.partId===part.id)o.material.emissive.setHex(part.id===id?0x24374a:0);});
    this.onSelect(p);this.render();
  }
  state() {
    const parts = this.parts.map(part => {
      const bounds = new THREE.Box3().setFromObject(part.group);
      return {
        id: part.id, position: part.group.position.toArray(), visible: this.isVisible(part.group),
        blades: part.group.children.filter(mesh => mesh.userData.blade).length,
        min: bounds.min.toArray(), max: bounds.max.toArray(),
      };
    });
    return {selected:this.selected, amount:this.amount, step:this.step, open:this.open,bladeDesign:this.bladeDesign,
      playing:this.playing,speed:this.speed,housingMode:this.housingMode,labelsOn:this.labelsOn,rotorAngle:this.rotorAngle,
      parts, camera:this.camera.position.toArray(), geometries:this.renderer.info.memory.geometries};
  }
  dispose(){
    this.disposed=true;cancelAnimationFrame(this.frame);this.events.abort();this.resize.disconnect();
    this.controls.removeEventListener('change',this.onControlChange);this.controls.dispose();
    if(this.root){
      const geometries=new Set(),materials=new Set();
      this.root.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)materials.add(object.material);});
      geometries.forEach(item=>item.dispose());materials.forEach(item=>item.dispose());this.scene.remove(this.root);
    }
    this.renderer.dispose();this.renderer.domElement.remove();this.parts=[];this.root=null;this.rotor=null;
  }
}
