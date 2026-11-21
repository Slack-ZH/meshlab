import * as THREE from 'three';
import { OrbitControls } from '../assets/OrbitControls.js';
import { materialOptions, metalLighting, referenceGround, highlight } from '../mechanical-style.js';
import { bevelGear } from './gears.js';
import { createExplodedView } from '../exploded-view.js';

export function createDifferentialScene(container, onSelect) {
  const scene=new THREE.Scene();scene.background=new THREE.Color('#f0f2f5');
  const camera=new THREE.OrthographicCamera(-280,280,170,-170,1,2500);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
  renderer.domElement.setAttribute('aria-label','汽车开放式差速器三维模型，可旋转缩放并选择零件');
  container.append(renderer.domElement);
  metalLighting(THREE,scene,renderer,.7);const ground=referenceGround(THREE,scene,{size:1800,y:-96});
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.09;controls.minZoom=.5;controls.maxZoom=3;
  const steps = [
    '沿输入轴退出主动锥齿轮，同时从左右两侧拔出半轴',
    '从两个端面退出紧固件',
    '沿左侧轴线卸下从动大锥齿圈',
    '移开两侧端盖，打开差速器壳体',
    '分别向两端取出半轴锥齿轮',
    '将十字销和行星锥齿轮从已经打开的端面成组移出',
    '在壳体外沿十字销两端取下行星锥齿轮'
  ];
  const explosion=createExplodedView({camera,controls,container,steps});
  const paths=new Map();
  const assign=(object,...path)=>{object.traverse(mesh=>{if(mesh.isMesh)paths.set(mesh,path);});};
  const along=(step,x,y=0,z=0)=>({step,offset:[x,y,z]});
  const sideCover=(object,sign)=>assign(object,along(3,sign*180));
  const assembly=new THREE.Group();scene.add(assembly);
  const materials={}, selectable=[];
  const partMaterial=(id,category)=>materials[id] ||= new THREE.MeshStandardMaterial(materialOptions(category));
  function mark(object,id) {
    object.traverse(mesh=>{if(mesh.isMesh){mesh.userData.part=id;mesh.castShadow=true;mesh.receiveShadow=true;selectable.push(mesh);}});return object;
  }
  const group=(parent,id)=>{const g=new THREE.Group();g.name=id;parent.add(g);return g;};
  function cylinder(parent,id,radius,length,x,y=0,z=0,category='shaft',axis='x') {
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,48),partMaterial(id,category));
    if(axis==='x')mesh.rotation.z=-Math.PI/2;if(axis==='z')mesh.rotation.x=Math.PI/2;
    mesh.position.set(x,y,z);parent.add(mark(mesh,id));return mesh;
  }
  function ring(parent,id,radius,tube,x,category='housing') {
    const mesh=new THREE.Mesh(new THREE.TorusGeometry(radius,tube,12,80),partMaterial(id,category));mesh.rotation.y=Math.PI/2;mesh.position.x=x;parent.add(mark(mesh,id));return mesh;
  }
  function sleeve(parent,id,outer,bore,length,x,category) {
    const profile=[[bore,-length/2],[outer,-length/2],[outer,length/2],[bore,length/2],[bore,-length/2]];
    const geometry=new THREE.LatheGeometry(profile.map(([r,h])=>new THREE.Vector2(r,h)),64);
    const m=new THREE.Mesh(geometry,partMaterial(id,category));m.rotation.z=-Math.PI/2;m.position.x=x;
    parent.add(mark(m,id));return m;
  }
  function witness(parent,id,x,radius) {
    const mat=new THREE.MeshStandardMaterial(materialOptions('seal'));
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(1.5,radius-6,3),mat);mesh.position.set(x,(radius+6)/2,0);parent.add(mark(mesh,id));
  }
  const carrier=group(assembly,'carrier-rotation');
  const cage=group(carrier,'cutaway-case');
  for(const x of [-38,38]) {
    sideCover(ring(cage,'carrier',58,5,x),Math.sign(x));sideCover(sleeve(cage,'carrier',16,9,13,x,'housing'),Math.sign(x));
    for(const a of [Math.PI/2,Math.PI*1.5]) {
      const rib=new THREE.Mesh(new THREE.BoxGeometry(8,7,48),partMaterial('carrier','housing'));
      rib.position.set(x,0,35*Math.sin(a));cage.add(mark(rib,'carrier'));sideCover(rib,Math.sign(x));
    }
  }
  for(const a of [Math.PI/2,Math.PI*1.5]) {
    cylinder(cage,'carrier',4.5,76,0,58*Math.cos(a),58*Math.sin(a),'housing');
    for(const x of [-43,43]) assign(cylinder(cage,'carrier',6,4,x,58*Math.cos(a),58*Math.sin(a),'fastener'),along(1,Math.sign(x)*280));
  }
  // Spider cross-pin stays fixed in the carrier. It is not the pinion's spin.
  assign(cylinder(carrier,'carrier',5,117,0,0,0,'shaft','y'),along(5,-92));
  const solid=group(carrier,'complete-case');
  const shell=new THREE.Mesh(new THREE.CylinderGeometry(64,64,78,80,1,true),partMaterial('carrier','housing'));shell.rotation.z=-Math.PI/2;solid.add(mark(shell,'carrier'));
  for(const x of [-40,40]) {
    const profile=[[12,-2],[64,-2],[64,2],[12,2],[12,-2]].map(([r,h])=>new THREE.Vector2(r,h));
    const cover=new THREE.Mesh(new THREE.LatheGeometry(profile,80),partMaterial('carrier','housing'));
    cover.rotation.z=-Math.PI/2;cover.position.x=x;solid.add(mark(cover,'carrier'));sideCover(cover,Math.sign(x));
  }
  solid.visible=false;
  const ringGear=bevelGear({teeth:40,radius:82,mateRadius:20.5,inner:.77,bore:55,depth:1.8},partMaterial('ring','gear'));
  ringGear.rotation.y=Math.PI;ringGear.position.x=-34.5;carrier.add(mark(ringGear,'ring'));assign(ringGear,along(2,-225));
  for(let i=0;i<10;i++) {
    const a=i*Math.PI/5;assign(cylinder(carrier,'ring',3.7,4,-60,68*Math.cos(a),68*Math.sin(a),'fastener'),along(1,-280));
  }
  // Main drive is a simple intersecting-axis bevel pair, fixed ratio 4:1.
  const inputMount=group(assembly,'input-axis');inputMount.position.x=-34.5;inputMount.rotation.y=-Math.PI/2;
  const input=group(inputMount,'input-rotation');
  input.add(mark(bevelGear({teeth:10,radius:20.5,mateRadius:82,inner:.77,bore:5,depth:1.8},partMaterial('input','gear')),'input'));
  cylinder(input,'input',9,52,109);cylinder(input,'input',16,6,135);witness(input,'input',139,15);
  const left=group(assembly,'left-halfshaft'),right=group(assembly,'right-halfshaft');
  for(const [root,sign,id] of [[left,-1,'left'],[right,1,'right']]) {
    const gear=bevelGear({teeth:20,radius:45,mateRadius:22.5,bore:8.4},partMaterial(id,'gear'));
    if(sign<0)gear.rotation.y=Math.PI;root.add(mark(gear,id));
    const hub=sleeve(root,id,12,8.4,12,sign*31,'shaft');
    cylinder(root,id,8,132,sign*86);
    cylinder(root,id,23,7,sign*154);cylinder(root,id,12,8,sign*162);
    witness(root,id,sign*158,22);
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;cylinder(root,id,2.8,4,sign*159,17*Math.cos(a),17*Math.sin(a),'fastener');}
    assign(root,along(0,sign*355));assign(gear,along(4,sign*126));assign(hub,along(4,sign*126));
  }
  assign(input,along(0,0,0,100));
  const pinions=[];
  for(const sign of [1,-1]) {
    const mount=group(carrier,sign>0?'upper-spider-axis':'lower-spider-axis');mount.rotation.z=sign*Math.PI/2;
    const spin=group(mount,'spider-spin');
    spin.add(mark(bevelGear({teeth:10,radius:22.5,mateRadius:45,bore:5.2},partMaterial('spider','gear')),'spider'));
    sleeve(spin,'spider',16,5.2,6,48,'shaft');witness(spin,'spider',52,16);pinions.push(spin);
  }
  for(const pinion of pinions){
    const radial=()=>new THREE.Vector3(1,0,0).applyQuaternion(pinion.getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(76);
    assign(pinion,along(5,-92),{step:6,offset:radial});
  }
  explosion.setParts(selectable.map(object=>({object,path:paths.get(object)||[]})));
  const labelObjects=new Map();
  for(const object of selectable)if(!labelObjects.has(object.userData.part))labelObjects.set(object.userData.part,object);
  labelObjects.set('left',left.children[2]);labelObjects.set('right',right.children[2]);
  const labels=[];
  function label(id,text,anchor) {
    const element=document.createElement('div');element.className='diff-label';element.dataset.part=id;element.innerHTML=text;container.append(element);labels.push({id,element,anchor});
  }
  label('left','左半轴 <b>60 r/min</b>',()=>new THREE.Vector3(-124,23,0));
  label('right','右半轴 <b>60 r/min</b>',()=>new THREE.Vector3(124,23,0));
  label('spider','行星锥齿轮',()=>carrier.localToWorld(new THREE.Vector3(0,72,0)));
  label('input','输入 · 240 r/min',()=>new THREE.Vector3(-34.5,0,155));
  let labelVisible=true, display='cutaway';
  function setView(name='3d') {
    explosion.restoreCamera();
    controls.target.set(0,0,12);camera.up.set(0,1,0);
    if(name==='front')camera.position.set(0,0,600);
    else if(name==='detail')camera.position.set(25,140,500);
    else if(name==='top'){camera.position.set(0,600,12);camera.up.set(0,0,-1);}
    else camera.position.set(125,155,380);
    camera.zoom=name==='detail'?1.2:1;camera.lookAt(controls.target);camera.updateProjectionMatrix();controls.update();
  }
  function resize() {
    const width=container.clientWidth,height=container.clientHeight;
    if(!width||!height)return;
    const aspect=width/height,halfHeight=Math.max(115,215/aspect);
    camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();renderer.setSize(width,height,false);
  }
  new ResizeObserver(resize).observe(container);resize();setView();
  const raycaster=new THREE.Raycaster();let pointerStart=null;
  renderer.domElement.addEventListener('pointerdown',e=>pointerStart={x:e.clientX,y:e.clientY});
  renderer.domElement.addEventListener('pointerup',e=>{
    if(!pointerStart||Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>5)return;
    pointerStart=null;const rect=renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),camera);
    const hit=raycaster.intersectObjects(selectable,false).find(({object})=>{for(let p=object;p;p=p.parent)if(!p.visible)return false;return true;});
    if(hit)onSelect(hit.object.userData.part);
  });
  renderer.domElement.addEventListener('pointercancel',()=>pointerStart=null);
  return {
    explosion,
    setPose(angles){explosion.restore();carrier.rotation.x=angles.carrier;left.rotation.x=angles.left;right.rotation.x=angles.right;input.rotation.x=angles.input;for(const pinion of pinions)pinion.rotation.x=Math.PI/10+angles.spider;},
    setSpeeds(speeds){for(const item of labels){if(item.id==='left'||item.id==='right')item.element.querySelector('b').textContent=`${Number(speeds[item.id].toFixed(1))} r/min`;if(item.id==='input')item.element.textContent=`输入 · ${Number(speeds.input.toFixed(1))} r/min`; }},
    selectPart(id){assembly.traverse(mesh=>{if(mesh.isMesh)highlight(mesh.material,mesh.userData.part===id);});labels.forEach(item=>item.element.dataset.selected=String(item.id===id));},
    setDisplay(value){display=value;cage.visible=value==='cutaway';solid.visible=value==='solid';},
    setLabels(visible){labelVisible=visible;},setView,
    render(dt=.016){controls.update();explosion.update(dt);ground.setY(-96-90*explosion.getState().amount);assembly.updateMatrixWorld(true);camera.updateMatrixWorld();for(const {element,anchor,id} of labels){const point=anchor();explosion.shiftPoint(point,labelObjects.get(id));const p=point.project(camera);element.hidden=!labelVisible||p.z>1||p.z< -1||(id==='spider'&&display==='solid'&&!explosion.active);element.style.left=`${(p.x+1)*container.clientWidth/2}px`;element.style.top=`${(1-p.y)*container.clientHeight/2}px`;}renderer.render(scene,camera);},
  };
}
