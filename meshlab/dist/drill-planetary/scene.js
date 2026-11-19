import * as THREE from 'three';
import { OrbitControls } from '../assets/OrbitControls.js';
import { materialOptions, metalLighting, referenceGround, highlight } from '../mechanical-style.js';
import { gearGeometry } from './gears.js';
import { createExplodedView } from '../exploded-view.js';

export function createDrillScene(container,onSelect){
  const scene=new THREE.Scene();scene.background=new THREE.Color('#f0f2f5');
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.localClippingEnabled=true;
  renderer.domElement.setAttribute('aria-label','电钻两挡行星减速器三维模型，可旋转、缩放、选择零件');container.append(renderer.domElement);
  metalLighting(THREE,scene,renderer,.7);const ground=referenceGround(THREE,scene,{size:1800,y:-74});
  const camera=new THREE.OrthographicCamera(-280,280,120,-120,1,2500);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.09;controls.minZoom=.5;controls.maxZoom=3;
  const explosion=createExplodedView({camera,controls,container});
  const root=new THREE.Group();scene.add(root);const materials=new Map(),pickable=[],labels=[];
  const clipPlane=new THREE.Plane(new THREE.Vector3(0,0,-1),10);
  const mat=(part,category='gear')=>{const key=part+':'+category;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial(materialOptions(category)));return materials.get(key);};
  const group=(parent,name)=>{const g=new THREE.Group();g.name=name;parent.add(g);return g;};
  const mesh=(parent,geo,part,category='gear')=>{const m=new THREE.Mesh(geo,mat(part,category));m.userData.part=part;m.castShadow=true;m.receiveShadow=true;parent.add(m);pickable.push(m);return m;};
  function cylinder(parent,part,r,length,x,y=0,z=0,category='shaft'){
    const m=mesh(parent,new THREE.CylinderGeometry(r,r,length,40),part,category);m.rotation.z=-Math.PI/2;m.position.set(x,y,z);return m;
  }
  function hoop(parent,part,r,tube,x,category='housing'){
    const m=mesh(parent,new THREE.TorusGeometry(r,tube,10,80),part,category);m.rotation.y=Math.PI/2;m.position.x=x;return m;
  }
  function box(parent,part,size,pos,category='housing'){
    const m=mesh(parent,new THREE.BoxGeometry(...size),part,category);m.position.set(...pos);return m;
  }
  function marker(parent,part,x,r){box(parent,part,[1.1,r-6,2.5],[x,(r+6)/2,0],'seal');}
  function dogs(parent,part,x,phase=0){
    for(let i=0;i<12;i++){const a=i*Math.PI/6+phase;const m=box(parent,part,[6,5,10],[x,60.5*Math.cos(a),60.5*Math.sin(a)],'cover');m.rotation.x=a;}
  }
  // Stationary motor casing and bearing cap; its shaft belongs to the first sun.
  cylinder(root,'motor',32,55,-146,0,0,'housing');cylinder(root,'motor',29,6,-176,0,0,'cover');
  cylinder(root,'motor',21,6,-116,0,0,'cover');
  for(let i=0;i<8;i++){const a=i*Math.PI/4;const m=box(root,'motor',[28,1.5,3],[-149,32*Math.cos(a),32*Math.sin(a)],'cover');m.rotation.x=a;}
  const geoSun=gearGeometry({count:18,radius:18,width:28,bore:6});
  const geoPlanet=gearGeometry({count:18,radius:18,width:28,bore:5});
  const geoRing=gearGeometry({count:54,radius:54,width:34,internal:true,outer:62});
  const stages=[];
  for(const [index,x] of [[1,-65],[2,58]]){
    const stage=group(root,`stage-${index}`);stage.position.x=x;
    const sun=group(stage,`sun-${index}`);mesh(sun,geoSun,`sun${index}`);marker(sun,`sun${index}`,15,16);
    const carrier=group(stage,`carrier-${index}`);cylinder(carrier,`carrier${index}`,12,9,22);
    const planets=[];
    for(let j=0;j<3;j++){
      const a=j*Math.PI*2/3;
      const arm=box(carrier,`carrier${index}`,[6,38,7],[22,18*Math.cos(a),18*Math.sin(a)],'shaft');arm.rotation.x=a;
      cylinder(carrier,`carrier${index}`,5,43,8,36*Math.cos(a),36*Math.sin(a));
      const planet=group(carrier,`planet-${index}-${j}`);planet.position.set(0,36*Math.cos(a),36*Math.sin(a));mesh(planet,geoPlanet,`planet${index}`);marker(planet,`planet${index}`,15,16);planets.push(planet);
      cylinder(carrier,`carrier${index}`,7,3,31,36*Math.cos(a),36*Math.sin(a),'fastener');
    }
    const ring=group(stage,`ring-${index}`);mesh(ring,geoRing,`ring${index}`);marker(ring,`ring${index}`,18,61);
    stages.push({sun,carrier,planets,ring});
  }
  cylinder(stages[0].sun,'sun1',7,53,-41); // Motor -> stage I sun.
  cylinder(stages[0].carrier,'carrier1',8,91,72); // Rigid carrier I -> sun II.
  cylinder(stages[1].carrier,'carrier2',9,71,63);
  // The fixed reaction ring and rotating carrier coupling flank the sliding ring.
  hoop(root,'housing',61,3,29,'cover');dogs(root,'housing',30,Math.PI/12);
  hoop(stages[1].carrier,'carrier2',61,3,35,'shaft');dogs(stages[1].carrier,'carrier2',34,Math.PI/12);
  for(let j=0;j<3;j++){const a=j*Math.PI*2/3;const arm=box(stages[1].carrier,'carrier2',[5,59,5],[35,30*Math.cos(a),30*Math.sin(a)],'shaft');arm.rotation.x=a;}
  dogs(stages[1].ring,'ring2',-19);dogs(stages[1].ring,'ring2',19);
  // Fixed supports indicate the non-rotating housing without hiding the gears.
  for(const x of [-85,29]){
    hoop(root,'housing',65,2,x);
    box(root,'housing',[8,14,24],[x,-67,0]);
  }
  box(root,'housing',[170,6,46],[-28,-72,0]);
  const fork=group(root,'shift-fork');
  hoop(fork,'selector',65,2.3,0,'cover');box(fork,'selector',[5,22,8],[0,76,0],'cover');box(fork,'selector',[22,8,24],[0,90,0],'cover');
  box(root,'housing',[68,4,12],[58,84,0],'shaft');
  // Output spindle and three-jaw chuck. No cutting/drilling process is simulated.
  const output=group(root,'chuck');
  cylinder(output,'output',25,30,164,0,0,'cover');cylinder(output,'output',22,18,187,0,0,'shaft');
  for(let i=0;i<24;i++){const a=i*Math.PI/12;const m=box(output,'output',[25,1.1,1.8],[164,25*Math.cos(a),25*Math.sin(a)],'seal');m.rotation.x=a;}
  for(let j=0;j<3;j++){const a=j*Math.PI*2/3;const jaw=box(output,'output',[18,7,7],[201,7*Math.cos(a),7*Math.sin(a)],'fastener');jaw.rotation.x=a;}
  // Offset physical leaves while retaining the carrier/planet rotation hierarchy.
  const offsets={motor:[-175,0,0],sun1:[-120,0,0],ring1:[-85,0,0],carrier1:[-45,0,0],sun2:[55,0,0],ring2:[20,0,0],carrier2:[125,0,0],selector:[20,95,0],output:[185,0,0],housing:[0,0,-105]};
  const radialOffsets=new Map();
  stages.forEach((stage,index)=>stage.planets.forEach(planet=>{
    const offset=()=>{
      const radial=new THREE.Vector3(0,planet.position.y,planet.position.z).applyQuaternion(stage.carrier.getWorldQuaternion(new THREE.Quaternion())).normalize().multiplyScalar(52);
      radial.x=index===0?-80:90;return radial.toArray();
    };
    planet.traverse(object=>{if(object.isMesh)radialOffsets.set(object,offset);});
  }));
  explosion.setParts(pickable.map(object=>({object,offset:radialOffsets.get(object)||offsets[object.userData.part]})));
  const labelObjects=new Map();
  for(const object of pickable)if(!labelObjects.has(object.userData.part))labelObjects.set(object.userData.part,object);
  // The input speed label is attached to the stationary motor casing.
  labelObjects.set('sun1',labelObjects.get('motor'));
  let shift=-12,targetShift=-12,mode='low',showLabels=true,display='cutaway',currentView='3d';
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function label(id,text,point){const element=document.createElement('div');element.className='drill-label';element.dataset.part=id;element.textContent=text;container.append(element);labels.push({id,element,point});}
  label('sun1','电机 · 6000 r/min',()=>new THREE.Vector3(-148,44,0));
  label('carrier1','一级 · 4 : 1',()=>new THREE.Vector3(-65,77,0));
  label('ring2','低挡 · 齿圈接机壳',()=>new THREE.Vector3(58+shift,106,0));
  label('output','夹头 · 375 r/min',()=>new THREE.Vector3(173,41,0));
  label('planet2','二级 · 低挡减速 4 : 1',()=>new THREE.Vector3(58,-78,0));
  function setDisplay(value){
    display=value;for(const s of stages)s.ring.visible=value!=='hidden';
    for(const [key,material] of materials){if(key.startsWith('ring1:')||key.startsWith('ring2:')){material.clippingPlanes=value==='cutaway'?[clipPlane]:[];material.clipShadows=true;material.needsUpdate=true;}}
  }
  function setView(name='3d'){
    explosion.restoreCamera();
    currentView=name;
    camera.up.set(0,1,0);controls.target.set(name==='detail'?58:10,10,0);
    if(name==='front')camera.position.set(10,0,600);
    else if(name==='top'){camera.position.set(10,600,0);camera.up.set(0,0,-1);}
    else if(name==='axial'){controls.target.set(58,0,0);camera.position.set(140,0,0);}
    else if(name==='detail')camera.position.set(195,130,410);
    else camera.position.set(270,170,440);
    camera.zoom=name==='detail'?1.25:name==='axial'?1.4:1;camera.lookAt(controls.target);camera.updateProjectionMatrix();controls.update();
  }
  function resize(){const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;const a=w/h,hh=Math.max(114,226/a);camera.left=-hh*a;camera.right=hh*a;camera.top=hh;camera.bottom=-hh;camera.updateProjectionMatrix();renderer.setSize(w,h,false);}
  new ResizeObserver(resize).observe(container);resize();setView();setDisplay('cutaway');
  let start=null;const raycaster=new THREE.Raycaster();
  renderer.domElement.addEventListener('pointerdown',e=>start=[e.clientX,e.clientY]);
  renderer.domElement.addEventListener('pointercancel',()=>start=null);
  renderer.domElement.addEventListener('pointerup',e=>{
    if(!start||Math.hypot(e.clientX-start[0],e.clientY-start[1])>5)return;start=null;
    const r=renderer.domElement.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);
    const hit=raycaster.intersectObjects(pickable,false).find(({object,point})=>{for(let p=object;p;p=p.parent)if(!p.visible)return false;return !object.material.clippingPlanes?.some(p=>p.distanceToPoint(point)<0);});if(hit)onSelect(hit.object.userData.part);
  });
  return {
    explosion,
    setPose(a){explosion.restore();for(let i=0;i<2;i++){const n=i+1,s=stages[i];s.sun.rotation.x=a[`sun${n}`];s.carrier.rotation.x=a[`carrier${n}`];s.ring.rotation.x=a[`ring${n}`];for(const p of s.planets)p.rotation.x=Math.PI/18+a[`planet${n}`];}output.rotation.x=a.output;},
    setMode(value){mode=value;targetShift=value==='low'?-12:12;if(reducedMotion)shift=targetShift;labels.find(l=>l.id==='ring2').element.textContent=value==='low'?'低挡 · 齿圈接机壳':'高挡 · 齿圈接行星架';labels.find(l=>l.id==='planet2').element.textContent=value==='low'?'二级 · 低挡减速 4 : 1':'二级 · 高挡直联 1 : 1';},
    setSpeeds(n){labels.find(l=>l.id==='sun1').element.textContent=`电机 · ${Number(n.sun1.toFixed(1))} r/min`;labels.find(l=>l.id==='output').element.textContent=`夹头 · ${Number(n.output.toFixed(1))} r/min`;},
    selectPart(part){const ids=Array.isArray(part)?part:[part];for(const m of pickable)highlight(m.material,ids.includes(m.userData.part));labels.forEach(l=>l.element.dataset.active=String(ids.includes(l.id)));},
    setDisplay,setView,setLabels(value){showLabels=value;},
    isShifting(){return Math.abs(targetShift-shift)>.05;},
    render(dt=.016){explosion.restore();shift+= (targetShift-shift)*Math.min(1,dt*18);if(Math.abs(targetShift-shift)<.05)shift=targetShift;stages[1].ring.position.x=shift;fork.position.x=58+shift;controls.update();explosion.update(dt);ground.setY(-74-100*explosion.getState().amount);root.updateMatrixWorld(true);camera.updateMatrixWorld();
      for(const {element,point,id} of labels){const anchor=point();explosion.shiftPoint(anchor,labelObjects.get(id));const p=anchor.project(camera);element.hidden=!showLabels||(currentView==='axial'?id!=='planet2':id==='planet2')||Math.abs(p.x)>1||Math.abs(p.y)>1||p.z>1||p.z< -1;element.style.left=`${(p.x+1)*container.clientWidth/2}px`;element.style.top=`${(1-p.y)*container.clientHeight/2}px`;}
      renderer.render(scene,camera);
    }
  };
}
