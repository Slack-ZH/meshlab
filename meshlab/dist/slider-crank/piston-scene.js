import { materialOptions, highlight, metalLighting, referenceGround } from '../mechanical-style.js';
import * as THREE from 'three';
import { OrbitControls } from '../assets/OrbitControls.js';
import { createExplodedView } from '../exploded-view.js';
import {disassemblySteps,sliderDisassemblyEntries,linkGeometry} from './disassembly.js';

// Vertical, sectioned cylinder. Theta is clockwise from the +Y axis.
export async function createScene({container,onAngle,onSelect,onDragStart}) {
  const scene=new THREE.Scene(),renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setClearColor(0,0);container.append(renderer.domElement);
  renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label','竖直活塞曲柄滑块：拖动曲柄，观察上下止点与行程');
  const camera=new THREE.OrthographicCamera(-200,200,200,-200,1,2500);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.12;controls.enablePan=false;controls.minZoom=.6;controls.maxZoom=3;
  controls.minPolarAngle=.15;controls.maxPolarAngle=Math.PI-.15;
  const explosion=createExplodedView({camera,controls,container,steps:disassemblySteps});
  let dirty=true,radius=40,rodLength=140,dimensionKey='',view='3d',lastPose=null;
  controls.addEventListener('change',()=>dirty=true);
  metalLighting(THREE,scene,renderer);
  const ground=referenceGround(THREE,scene,{size:1400,y:-80});
  const mats=Object.fromEntries(Object.entries({crank:'shaft',rod:'gear',slider:'bearing',frame:'housing',steel:'shaft',dark:'cover',ring:'seal'}).map(([k,v])=>[k,new THREE.MeshStandardMaterial(materialOptions(v))]));
  const boxGeometry=new THREE.BoxGeometry(1,1,1),cylinderGeometry=new THREE.CylinderGeometry(1,1,1,48),pickables=[];
  function mesh(parent,geometry,material,part){const o=new THREE.Mesh(geometry,material);o.userData.part=part;o.castShadow=true;o.receiveShadow=true;parent.add(o);pickables.push(o);return o;}
  function box(parent,w,h,d,material,part,x=0,y=0,z=0){const o=mesh(parent,boxGeometry,material,part);o.scale.set(w,h,d);o.position.set(x,y,z);return o;}
  function cylinder(parent,r,h,material,part,x=0,y=0,z=0,axis='z'){const o=mesh(parent,cylinderGeometry,material,part);o.scale.set(r,h,r);if(axis==='z')o.rotation.x=Math.PI/2;o.position.set(x,y,z);return o;}
  function link(part,width,depth,z){
    const group=new THREE.Group();scene.add(group);group.position.z=z;
    const body=mesh(group,new THREE.BufferGeometry(),mats[part],part);
    return {group,setLength(length){body.geometry.dispose();body.geometry=linkGeometry(THREE,length,part);}};
  }
  function endCap(r,bore,part,x,y,z){const shape=new THREE.Shape();shape.absarc(0,0,r,0,Math.PI*2);const hole=new THREE.Path();hole.absarc(0,0,bore,0,Math.PI*2,true);shape.holes.push(hole);const geo=new THREE.ExtrudeGeometry(shape,{depth:4,bevelEnabled:false,curveSegments:48});geo.translate(0,0,-2);const cap=mesh(scene,geo,mats.dark,part);cap.position.set(x,y,z);return cap;}
  const crank=link('crank',17,10,8),rod=link('rod',11,8,20);
  const crankPin=cylinder(scene,5,28,mats.steel,'crank',0,0,15),crankCap=endCap(7,5.3,'crank',0,0,31);
  const dragRing=mesh(scene,new THREE.TorusGeometry(9,1.2,8,48),mats.crank,'crank');
  const flywheel=cylinder(scene,1,8,mats.dark,'crank',0,0,-50);
  cylinder(scene,13,74,mats.steel,'frame',0,0,-17);const mainCap=endCap(17,13.3,'frame',0,0,17);
  box(scene,34,38,20,mats.frame,'frame',0,0,-35);
  const pedestal=box(scene,28,1,24,mats.frame,'frame',0,0,-35),base=box(scene,1,10,95,mats.frame,'frame',0,0,-25);
  const feet=[-1,1].map(side=>box(scene,24,5,82,mats.dark,'frame',side*58,0,-25));
  const supports=[-1,1].map(side=>box(scene,9,1,10,mats.steel,'frame',side*43,0,-35));
  const piston=new THREE.Group();scene.add(piston);
  cylinder(piston,23,40,mats.slider,'slider',0,2,0,'y');
  for(const y of [12,16,20])cylinder(piston,23.6,1.6,mats.ring,'slider',0,y,0,'y');
  cylinder(piston,5,54,mats.steel,'slider',0,0,0);cylinder(piston,7,4,mats.dark,'slider',0,0,30);
  // A half annulus leaves the front open, so the piston stays visible.
  const section=new THREE.Shape();section.absarc(0,0,31,0,-Math.PI,true);section.lineTo(-27,0);section.absarc(0,0,27,-Math.PI,0,false);section.closePath();
  const casing=mesh(scene,new THREE.ExtrudeGeometry(section,{depth:1,steps:1,bevelEnabled:false,curveSegments:40}),mats.frame,'frame');casing.rotation.x=Math.PI/2;
  const lineMat=new THREE.LineDashedMaterial({color:'#6f859c',dashSize:3,gapSize:3,transparent:true,opacity:.7});
  const guide=(dashed=true)=>{const o=new THREE.Line(new THREE.BufferGeometry(),dashed?lineMat:new THREE.LineBasicMaterial({color:'#6f859c'}));scene.add(o);return o;};
  const orbit=guide(),axis=guide(),upper=guide(),lower=guide(),bracket=guide(false);
  function line(o,points){o.geometry.dispose();o.geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));o.computeLineDistances();}
  const labels={};
  for(const [id,text] of [['tdc','上止点 · 0°'],['bdc','下止点 · 180°'],['stroke','行程 80 mm'],['drag','拖动曲柄']]){
    const el=document.createElement('span');el.id=`piston-${id}-marker`;el.className=`piston-model-label piston-${id}`;el.textContent=text;container.append(el);labels[id]=el;
  }
  function labelAt(id,point){const p=new THREE.Vector3(...point).project(camera);labels[id].style.left=`${(p.x*.5+.5)*container.clientWidth}px`;labels[id].style.top=`${(-p.y*.5+.5)*container.clientHeight}px`;labels[id].hidden=p.z>1||p.z< -1;}
  function updateLabels(){if(!lastPose)return;
    labelAt('tdc',[68,rodLength+radius+22,25]);labelAt('bdc',[68,rodLength-radius+22,25]);labelAt('stroke',[-55,rodLength+22,25]);labelAt('drag',[lastPose.crankX+15,lastPose.crankY-14,34]);
    labels.tdc.classList.toggle('at-stop',lastPose.displacement<.05);labels.bdc.classList.toggle('at-stop',lastPose.stroke-lastPose.displacement<.05);
    // Travel dimensions describe the assembled mechanism, so keep them out of
    // the exploded view. Selection and orbiting remain available on every part.
    if(explosion.active)for(const label of Object.values(labels))label.hidden=true;
  }
  function fitCamera(reset){
    if(reset)explosion.restoreCamera();
    const aspect=Math.max(container.clientWidth,1)/Math.max(container.clientHeight,1),bottom=-radius-37,top=rodLength+radius+39;
    const center=new THREE.Vector3(12,(top+bottom)/2,-5),half=Math.max((top-bottom)/2,(2*radius+190)/(2*aspect))*1.12;
    camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;
    if(reset){camera.zoom=1;camera.position.copy(center).add(view==='front'?new THREE.Vector3(0,0,800):new THREE.Vector3(190,55,800));camera.lookAt(center);}
    else camera.position.add(center.clone().sub(controls.target));
    controls.target.copy(center);camera.updateProjectionMatrix();controls.update();dirty=true;
  }
  function update(pose,params){
    explosion.restore();
    radius=params.radius;rodLength=params.rodLength;lastPose=pose;dirty=true;
    const key=`${radius}/${rodLength}`;
    if(dimensionKey!==key){
      const initial=!dimensionKey;dimensionKey=key;crank.setLength(radius);rod.setLength(rodLength);flywheel.scale.set(radius+10,8,radius+10);
      const floor=-radius-29;base.scale.x=Math.max(140,2*radius+45);base.position.y=floor;feet.forEach(foot=>foot.position.y=floor-7.5);ground.setY(floor-10);
      pedestal.scale.y=-floor;pedestal.position.y=floor/2;
      supports.forEach(post=>{post.scale.y=rodLength-radius-floor;post.position.y=(rodLength-radius+floor)/2;});
      casing.scale.z=2*radius+50;casing.position.y=rodLength+radius+26;
      line(orbit,Array.from({length:97},(_,i)=>[Math.sin(i*Math.PI/48)*radius,Math.cos(i*Math.PI/48)*radius,34]));
      line(axis,[[0,-radius-10,34],[0,rodLength+radius+30,34]]);
      line(upper,[[-34,pose.tdcY+22,26],[63,pose.tdcY+22,26]]);line(lower,[[-34,pose.bdcY+22,26],[63,pose.bdcY+22,26]]);
      line(bracket,[[-40,pose.tdcY+22,26],[-47,pose.tdcY+22,26],[-47,pose.bdcY+22,26],[-40,pose.bdcY+22,26]]);
      labels.stroke.textContent=`行程 ${pose.stroke} mm`;fitCamera(initial);
    }
    crank.group.rotation.z=Math.atan2(pose.crankY,pose.crankX);rod.group.position.set(pose.crankX,pose.crankY,20);rod.group.rotation.z=pose.rodAngle;
    crankPin.position.set(pose.crankX,pose.crankY,15);crankCap.position.set(pose.crankX,pose.crankY,31);dragRing.position.set(pose.crankX,pose.crankY,34);piston.position.y=pose.pistonY;
  }
  // Keep the wrist-pin/piston/rod assembly captured. Lift it through the open
  // cylinder end only after the crank pin has completely left both eyes.
  const roots=[crank.group,rod.group,piston,casing,flywheel,crankPin,crankCap,dragRing,mainCap],movingRoots=new Set(roots);
  const fixedParts=pickables.filter(object=>{for(let current=object;current;current=current.parent)if(movingRoots.has(current))return false;return true;});
  explosion.setParts(sliderDisassemblyEntries({crank:crank.group,rod:rod.group,piston,crankPin,crankCap,dragRing,mainCap,casing,flywheel,fixedParts,getDimensions:()=>({radius,rodLength})}));
  function select(part){for(const key of ['crank','rod','slider','frame'])highlight(mats[key],key===part);dirty=true;}
  function setView(next){view=next;fitCamera(true);}
  function resize(){renderer.setSize(Math.max(container.clientWidth,1),Math.max(container.clientHeight,1),false);fitCamera(false);}
  const pointer=new THREE.Vector2(),raycaster=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,0,1),-34),intersection=new THREE.Vector3();
  let dragPointer=null,clickOrigin=null;
  function aim(event){const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);}
  renderer.domElement.addEventListener('pointerdown',event=>{
    if(event.button!==0||!event.isPrimary)return;aim(event);scene.updateMatrixWorld(true);
    const hit=raycaster.intersectObjects(pickables,false)[0];clickOrigin={x:event.clientX,y:event.clientY,part:hit?.object.userData.part};
    const onOrbit=!explosion.active&&raycaster.ray.intersectPlane(plane,intersection)&&Math.abs(Math.hypot(intersection.x,intersection.y)-radius)<12;
    // The original dragging plane only represents the assembled crank. While
    // separated, a click selects it and dragging orbits the exploded assembly.
    if(!explosion.active&&(clickOrigin.part==='crank'||onOrbit)){dragPointer=event.pointerId;controls.enabled=false;renderer.domElement.setPointerCapture(event.pointerId);onDragStart?.();onSelect('crank');labels.drag.textContent='松手停留';event.stopImmediatePropagation();}
  },{capture:true});
  renderer.domElement.addEventListener('pointermove',event=>{if(event.pointerId!==dragPointer)return;aim(event);if(raycaster.ray.intersectPlane(plane,intersection)&&Math.hypot(intersection.x,intersection.y)>2)onAngle(Math.atan2(intersection.x,intersection.y));event.stopImmediatePropagation();},{capture:true});
  function end(event){
    if(event.pointerId===dragPointer){dragPointer=null;controls.enabled=true;labels.drag.textContent='拖动曲柄';if(renderer.domElement.hasPointerCapture(event.pointerId))renderer.domElement.releasePointerCapture(event.pointerId);event.stopImmediatePropagation();}
    else if(event.type==='pointerup'&&clickOrigin?.part&&Math.hypot(event.clientX-clickOrigin.x,event.clientY-clickOrigin.y)<5)onSelect(clickOrigin.part);
    clickOrigin=null;
  }
  for(const type of ['pointerup','pointercancel','lostpointercapture'])renderer.domElement.addEventListener(type,end,{capture:true});
  resize();fitCamera(true);select('crank');
  return {explosion,update,select,setView,resize,render(dt){
    if(explosion.update(dt))dirty=true;
    const showGuides=!explosion.active;
    if(orbit.visible!==showGuides)dirty=true;
    for(const guide of [orbit,axis,upper,lower,bracket,dragRing])guide.visible=showGuides;
    controls.update();if(dirty){renderer.render(scene,camera);updateLabels();dirty=false;}
  }};
}
