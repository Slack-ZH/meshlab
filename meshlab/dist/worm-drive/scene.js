import * as THREE from 'three';
import {OrbitControls} from '../assets/OrbitControls.js';
import {materialOptions,metalLighting,referenceGround,highlight} from '../mechanical-style.js';
import {threadGeometry,wheelGeometry} from './geometries.js';
import {geometry,wormResults} from './kinematics.js';
import {createExplodedView} from '../exploded-view.js';

export function createWormScene(container,parameters,onSelect){
  const scene=new THREE.Scene();scene.background=new THREE.Color('#f0f2f5');
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.domElement.setAttribute('aria-label','蜗轮蜗杆三维模型，两轴方向垂直但不相交，可旋转缩放并选择螺纹');container.append(renderer.domElement);
  metalLighting(THREE,scene,renderer,.7);referenceGround(THREE,scene,{size:1600,y:-110});
  const camera=new THREE.OrthographicCamera(-240,240,148,-148,1,2400);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.09;controls.minZoom=.5;controls.maxZoom=3;
  const explosion=createExplodedView({camera,controls,container});
  const labelObjects=new Map();
  const materials=new Map(),labels=[];let model=null,worm=null,wheel=null,supports=null,axes=null,pickable=[],result=wormResults(parameters),selected=null,labelsVisible=true,supportsVisible=true,axesVisible=true;
  const mat=(id,category)=>{const key=id+':'+category;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial(materialOptions(category)));return materials.get(key);};
  function mesh(parent,geo,id,category='gear'){
    const m=new THREE.Mesh(geo,mat(id,category));m.userData.part=id;m.castShadow=true;m.receiveShadow=true;parent.add(m);pickable.push(m);return m;
  }
  function cylinder(parent,id,r,length,pos,axis='x',category='shaft'){
    const m=mesh(parent,new THREE.CylinderGeometry(r,r,length,48),id,category);if(axis==='x')m.rotation.z=-Math.PI/2;if(axis==='z')m.rotation.x=Math.PI/2;m.position.set(...pos);return m;
  }
  function box(parent,id,size,pos,category='housing'){const m=mesh(parent,new THREE.BoxGeometry(...size),id,category);m.position.set(...pos);return m;}
  function ring(parent,id,r,tube,pos,axis='z',category='bearing'){
    const m=mesh(parent,new THREE.TorusGeometry(r,tube,12,64),id,category);if(axis==='x')m.rotation.y=Math.PI/2;m.position.set(...pos);return m;
  }
  const axisMat=new THREE.LineDashedMaterial({color:'#3776aa',transparent:true,opacity:.55,dashSize:4,gapSize:3,depthTest:false});
  function line(parent,points){const g=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));const l=new THREE.Line(g,axisMat);l.computeLineDistances();l.renderOrder=4;parent.add(l);}
  function rebuild(p){
    explosion.restore();
    result=wormResults(p);const r=result.wheelDiameter/2,a=result.centerDistance;
    const next=new THREE.Group();next.name='worm-transmission';pickable=[];
    const nextWorm=new THREE.Group();nextWorm.name='worm-shaft';nextWorm.position.y=a;next.add(nextWorm);
    cylinder(nextWorm,'worm',result.wormDiameter/2-1.25*geometry.module,108,[0,0,0]);
    cylinder(nextWorm,'worm',8,220,[0,0,0]);
    for(const sign of [-1,1]){cylinder(nextWorm,'worm',12,7,[sign*59,0,0]);cylinder(nextWorm,'worm',13,5,[sign*108,0,0],'x','cover');}
    for(let k=0;k<p.starts;k++){const thread=mesh(nextWorm,threadGeometry(p,k),`thread-${k+1}`);thread.name=`worm-thread-${k+1}`;}
    box(nextWorm,'worm',[1.2,7,3],[111,7,0],'seal');
    const nextWheel=new THREE.Group();nextWheel.name='worm-wheel';next.add(nextWheel);
    mesh(nextWheel,wheelGeometry(p),'wheel');
    cylinder(nextWheel,'wheel',16,30,[0,0,0],'z');cylinder(nextWheel,'output',8,148,[0,0,0],'z');
    cylinder(nextWheel,'output',17,6,[0,0,75],'z','cover');
    box(nextWheel,'wheel',[3,r-25,1.2],[0,(r+5)/2,11.5],'seal');
    for(let i=0;i<6;i++){const phi=i*Math.PI/3;cylinder(nextWheel,'wheel',2.4,3,[Math.cos(phi)*21,Math.sin(phi)*21,12],'z','fastener');}
    const nextSupports=new THREE.Group();nextSupports.name='support-frame';next.add(nextSupports);
    box(nextSupports,'frame',[218,6,126],[0,-105,0]);
    for(const sign of [-1,1]){
      box(nextSupports,'frame',[9,a+86,12],[sign*85,(a-114)/2,-18]);
      box(nextSupports,'frame',[26,8,30],[sign*80,a-17,-4]);
      ring(nextSupports,'bearings',12,3,[sign*80,a,0],'x');
      box(nextSupports,'frame',[30,77,18],[0,-62,sign*47]);
      box(nextSupports,'frame',[32,10,25],[0,-18,sign*47]);
      ring(nextSupports,'bearings',12,3,[0,0,sign*47],'z');
      for(const x of [-8,8])cylinder(nextSupports,'frame',2.5,3,[x,-100,sign*47],'y','fastener');
    }
    const nextAxes=new THREE.Group();nextAxes.name='skew-axes';next.add(nextAxes);
    line(nextAxes,[[-126,a,0],[126,a,0]]);line(nextAxes,[[0,0,-90],[0,0,93]]);
    line(nextAxes,[[103,0,0],[103,a,0]]);line(nextAxes,[[98,0,0],[108,0,0]]);line(nextAxes,[[98,a,0],[108,a,0]]);
    nextSupports.visible=supportsVisible;nextAxes.visible=axesVisible;
    // Construct off-scene, then swap atomically. Shared materials survive rebuilds.
    const previous=model;scene.add(next);if(previous){scene.remove(previous);const geometries=new Set();previous.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});for(const g of geometries)g.dispose();}
    model=next;worm=nextWorm;wheel=nextWheel;supports=nextSupports;axes=nextAxes;
    // Register physical meshes only: the axis guides stay at the assembled reference.
    labelObjects.clear();
    explosion.setParts(pickable.map(object=>{
      const id=object.userData.part;
      if(!labelObjects.has(id))labelObjects.set(id,object);
      let offset;
      if(id==='worm'||id.startsWith('thread-'))offset=[-30,80,0];
      else if(id==='wheel')offset=[0,0,48];
      else if(id==='output')offset=[0,0,132];
      else if(id==='bearings')offset=object.position.x!==0?[Math.sign(object.position.x)*55,30,0]:[0,0,Math.sign(object.position.z)*90];
      else offset=[0,0,-70];
      return {object,offset};
    }));
    selectPart(selected);updateLabels(p);
  }
  function addLabel(id,text,point){const el=document.createElement('div');el.className='worm-label';el.dataset.part=id;el.textContent=text;container.append(el);labels.push({id,el,point});}
  addLabel('worm','',()=>new THREE.Vector3(-65,result.centerDistance+30,0));
  addLabel('wheel','',()=>new THREE.Vector3(0,result.wheelDiameter/2+8,16));
  addLabel('axes','',()=>new THREE.Vector3(111,result.centerDistance/2,0));
  function updateLabels(p){labels[0].el.textContent=`蜗杆 · ${p.starts} 头 · ${p.rpm} r/min`;labels[1].el.textContent=`蜗轮 · ${p.wheelTeeth} 齿 · ${Number(result.outputRpm.toFixed(2))} r/min`;labels[2].el.textContent=`交错轴 90° · a ${result.centerDistance} mm`;}
  function selectPart(id){selected=id;for(const m of pickable){const own=m.userData.part;highlight(m.material,own===id||(id==='worm'&&own.startsWith('thread-')));}labels.forEach(l=>l.el.dataset.active=String(l.id===id||(l.id==='worm'&&id?.startsWith('thread-'))));}
  function setView(view='3d'){
    explosion.restoreCamera();
    camera.up.set(0,1,0);controls.target.set(0,view==='detail'?result.centerDistance-18:16,0);
    if(view==='front')camera.position.set(0,16,600);
    else if(view==='top'){camera.position.set(0,600,0);camera.up.set(0,0,-1);}
    else if(view==='detail')camera.position.set(175,result.centerDistance+80,330);
    else camera.position.set(205,170,350);
    camera.zoom=view==='detail'?1.65:1;camera.lookAt(controls.target);camera.updateProjectionMatrix();controls.update();
  }
  function resize(){const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;const aspect=w/h,half=Math.max(148,166/aspect);camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();renderer.setSize(w,h,false);}
  rebuild(parameters);new ResizeObserver(resize).observe(container);resize();setView();
  let pointer=null;const ray=new THREE.Raycaster();
  renderer.domElement.addEventListener('pointerdown',e=>pointer=[e.clientX,e.clientY]);renderer.domElement.addEventListener('pointercancel',()=>pointer=null);
  renderer.domElement.addEventListener('pointerup',e=>{if(!pointer||Math.hypot(e.clientX-pointer[0],e.clientY-pointer[1])>5)return;pointer=null;const rect=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),camera);
    const hit=ray.intersectObjects(pickable,false).find(({object})=>{for(let p=object;p;p=p.parent)if(!p.visible)return false;return true;});if(hit)onSelect(hit.object.userData.part);
  });
  return {explosion,rebuild,selectPart,setView,setPose(p){explosion.restore();worm.rotation.x=p.worm;wheel.rotation.z=p.wheel;},setSpeeds(p){result=wormResults(p);updateLabels(p);},
    setSupports(value){supportsVisible=value;supports.visible=value;},setAxes(value){axesVisible=value;axes.visible=value;},setLabels(value){labelsVisible=value;},
    render(dt=.016){controls.update();explosion.update(dt);model.updateMatrixWorld(true);camera.updateMatrixWorld();for(const {id,el,point} of labels){const anchor=point();if(labelObjects.has(id))explosion.shiftPoint(anchor,labelObjects.get(id));const p=anchor.project(camera);el.hidden=!labelsVisible||(id==='axes'&&!axesVisible)||Math.abs(p.x)>1||Math.abs(p.y)>1||p.z>1||p.z< -1;el.style.left=`${(p.x+1)*container.clientWidth/2}px`;el.style.top=`${(1-p.y)*container.clientHeight/2}px`;}renderer.render(scene,camera);}
  };
}
