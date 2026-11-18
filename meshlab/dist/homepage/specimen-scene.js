import * as THREE from '../assets/three.module.js';
import {createSpecimen} from './specimen-models.js';

const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const hero=document.querySelector('.hero');
const modes=document.querySelector('.view-control');
const cache=new Map();
let renderer,scene,camera,group,activeCard,observer,frameId=0,visible=true,requestId=0,available=true;
let mode='solid',px=0,py=0,rx=0,ry=0;
let halfWidth,halfHeight;
const viewMatrix=new THREE.Matrix4(), vertex=new THREE.Vector3(), silhouette=new THREE.Box3();
function centerProjection() {
  group.updateMatrixWorld(true);
  silhouette.makeEmpty();
  group.traverseVisible(part=>{
    if(!part.isMesh)return;
    const positions=part.geometry.getAttribute('position');
    viewMatrix.multiplyMatrices(camera.matrixWorldInverse,part.matrixWorld);
    for(let i=0;i<positions.count;i++) {
      vertex.fromBufferAttribute(positions,i).applyMatrix4(viewMatrix);
      silhouette.expandByPoint(vertex);
    }
  });
  const center=silhouette.getCenter(vertex);
  camera.left=center.x-halfWidth;camera.right=center.x+halfWidth;
  camera.bottom=center.y-halfHeight;camera.top=center.y+halfHeight;
  camera.updateProjectionMatrix();
}
function render() {
  frameId=0;
  if(!available||!group||!visible||document.hidden)return;
  rx+=(px-rx)*.14;ry+=(py-ry)*.14;
  if(reducedMotion.matches){rx=0;ry=0;}
  group.rotation.y=rx;group.rotation.x=ry;
  centerProjection();
  renderer.render(scene,camera);
  if(Math.abs(px-rx)+Math.abs(py-ry)>.0005&&!reducedMotion.matches)frameId=requestAnimationFrame(render);
}
function invalidate(){if(!frameId)frameId=requestAnimationFrame(render);}
function resize(){
  if(!renderer||!activeCard||!group)return;
  const slot=activeCard.querySelector('.card-visual');
  const width=slot.clientWidth,height=slot.clientHeight;
  renderer.setSize(width,height,false);
  // Fit the actual model's projected bounds to the canvas before pointer tilt.
  group.rotation.set(0,0,0);group.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(group),points=[];
  camera.updateMatrixWorld();
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse));
  const size=new THREE.Box3().setFromPoints(points).getSize(new THREE.Vector3());
  halfHeight=Math.max(size.y/2,size.x/2/(width/height))*1.12;
  halfWidth=halfHeight*width/height;
  invalidate();
}
function applyMode(){
  if(!group)return;
  group.traverse(item=>{
    if(item.isMesh){item.material.opacity=mode==='xray'?.035:1;item.material.transparent=mode==='xray';item.material.depthWrite=mode!=='xray';item.material.needsUpdate=true;}
    if(item.userData.outline)item.visible=mode==='xray';
  });
  hero.dataset.view=mode;invalidate();
}
async function select({index,card}){
  if(!available)return;
  const request=++requestId;
  if(activeCard) {
    activeCard.classList.remove('live-model');
    document.getElementById(activeCard.dataset.surface).classList.remove('is-live');
  }
  if(!cache.has(index))cache.set(index,createSpecimen(index).then(model=>{
    const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    const wrapper=new THREE.Group();wrapper.add(model);
    const meshes=[];model.traverse(item=>{if(item.isMesh)meshes.push(item);});
    meshes.forEach(item=>{
      item.material=item.material.clone();
      const outline=new THREE.LineSegments(new THREE.EdgesGeometry(item.geometry,25),new THREE.LineBasicMaterial({color:'#bcf3f3',transparent:true,opacity:.65}));
      outline.userData.outline=true;outline.visible=false;item.add(outline);
    });
    return wrapper;
  }));
  const selected=await cache.get(index);
  if(!available||request!==requestId||!card.isConnected)return;
  if(group)scene.remove(group);
  group=selected;scene.add(group);activeCard=card;px=py=rx=ry=0;
  camera.position.set(...(index===0?[430,300,660]:[170,155,650]));camera.lookAt(0,0,0);
  const surface=document.getElementById(card.dataset.surface);
  surface.append(renderer.domElement);
  resize();applyMode();render();card.classList.add('live-model');
  surface.classList.add('is-live');
  modes.hidden=false;hero.dataset.scene='ready';hero.dataset.specimen=String(index);
}
function fallback(error){
  available=false;
  hero.dataset.scene='fallback';modes.hidden=true;
  document.querySelectorAll('.live-model').forEach(card=>card.classList.remove('live-model'));
  document.querySelector('.model-surface.is-live')?.classList.remove('is-live');
  if(renderer)renderer.domElement.remove();
  cancelAnimationFrame(frameId);frameId=0;
  console.warn('Model preview uses its image fallback:',error.message);
}
try {
  if (document.documentElement.classList.contains('show-opening')) {
    // Leave the opening's frames free of GPU startup work. The poster is already visible behind it.
    await new Promise(resolve => {
      function resume() {
        clearTimeout(deadline);
        window.removeEventListener('openingfinished', resume);
        resolve();
      }
      const deadline = setTimeout(resume, 1900);
      window.addEventListener('openingfinished', resume, { once: true });
    });
  }
  renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
  renderer.setClearColor(0x000000,0);renderer.domElement.setAttribute('aria-hidden','true');
  scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-300,300,200,-200,1,4000);
  scene.add(new THREE.HemisphereLight('#d4f1ff','#27455c',.9));
  for(const [pos,color,intensity] of [[[350,400,500],'#ffffff',2.8],[[-300,60,120],'#8fb7ff',1.2],[[80,0,-500],'#96f4f0',3.6]]){
    const light=new THREE.DirectionalLight(color,intensity);light.position.fromArray(pos);scene.add(light);
  }
  // Broad studio reflection gives metal a visible shape even when the object is still.
  const studio=new THREE.Scene();studio.background=new THREE.Color('#60778e');
  for(const [pos,size,power] of [[[0,200,0],[280,10,260],4],[[180,0,120],[20,280,180],6],[[-170,40,0],[20,220,220],3]]){
    const panel=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshBasicMaterial({color:new THREE.Color(1,1,1).multiplyScalar(power)}));panel.position.fromArray(pos);studio.add(panel);
  }
  const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(studio,.08).texture;pmrem.dispose();
  document.addEventListener('specimenchange',event=>select(event.detail).catch(fallback));
  const first=document.querySelector('.card.active');
  if(first)await select({index:[...document.querySelectorAll('.card')].indexOf(first)%5,card:first});
  observer=new ResizeObserver(resize);observer.observe(document.querySelector('.shelf'));
  document.querySelector('.shelf').addEventListener('pointermove',event=>{
    if(reducedMotion.matches||event.pointerType!=='mouse'||event.buttons||!activeCard)return;
    const rect=activeCard.getBoundingClientRect();
    px=Math.max(-.16,Math.min(.16,(event.clientX-rect.x-rect.width/2)/rect.width*.32));
    py=Math.max(-.10,Math.min(.10,(event.clientY-rect.y-rect.height/2)/rect.height*.20));invalidate();
  });
  document.querySelector('.shelf').addEventListener('pointerleave',()=>{px=py=0;invalidate();});
  modes.addEventListener('click',event=>{
    const button=event.target.closest('[data-mode]');if(!button)return;
    mode=button.dataset.mode;modes.querySelectorAll('button').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));applyMode();
  });
  const visibleRegions=new Set();
  const visibility=new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(entry.isIntersecting)visibleRegions.add(entry.target);
      else visibleRegions.delete(entry.target);
    }
    visible=visibleRegions.size>0;
    if(visible)invalidate();
    else{cancelAnimationFrame(frameId);frameId=0;}
  });
  visibility.observe(hero);
  const dock=document.querySelector('.catalog-dock');
  if(dock)visibility.observe(dock);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frameId);frameId=0;}else invalidate();});
  reducedMotion.addEventListener('change',()=>{px=py=rx=ry=0;invalidate();});
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();fallback(new Error('WebGL context lost'));});
} catch(error){fallback(error);}
