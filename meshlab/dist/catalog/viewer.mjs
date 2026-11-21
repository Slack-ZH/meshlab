import * as THREE from 'three';
import {OrbitControls} from '../assets/OrbitControls.js';
import {shapeMesh} from './geometry.mjs';
import {disassemblyParts,prepareDisassembly,applyDisassembly} from './disassembly.mjs';
import {validateParameters} from './registry.mjs';

export class CatalogViewer {
 constructor(host,onSelect,onMotion){
  this.host=host;this.onSelect=onSelect;this.onMotion=onMotion;this.parts=[];this.amount=0;this.phase=0;this.playing=false;this.speed=1;this.selected=null;this.housingMode='solid';
  this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(35,1,.1,50000);this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;host.append(this.renderer.domElement);
  this.renderer.domElement.setAttribute('aria-label','参数化机械机构三维模型');this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.addEventListener('change',()=>this.render());
  this.scene.add(new THREE.HemisphereLight(0xffffff,0x75869c,3));for(const [x,y,z,n] of [[-500,800,1000,3],[800,200,-400,2],[-800,-200,300,1]]){const l=new THREE.DirectionalLight(0xffffff,n);l.position.set(x,y,z);this.scene.add(l);}
  this.direction=new THREE.Vector3(.4,.28,1).normalize();this.resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(w&&h){this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();if(this.root)this.fit();}});this.resize.observe(host);
  let down;host.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});host.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const r=host.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),this.camera);const meshes=[];this.root?.traverse(o=>{if(o.isMesh&&this.visible(o))meshes.push(o);});const hit=ray.intersectObjects(meshes,false)[0];if(hit)this.select(hit.object.userData.partId);});
  const loop=now=>{this.frame=requestAnimationFrame(loop);const dt=this.last==null?0:Math.min((now-this.last)/1000,.05);this.last=now;if(this.playing&&this.model){this.phase+=dt*this.params.inputRPM*Math.PI/30*this.speed*.2;this.applyPose();this.notice=(this.notice||0)+dt;if(this.notice>=.1){this.notice=0;this.onMotion?.(this.state());}}this.controls.update();if(this.playing)this.render();};this.frame=requestAnimationFrame(loop);
 }
 visible(o){while(o){if(!o.visible)return false;o=o.parent;}return true;}
 render(){if(this.root)this.renderer.render(this.scene,this.camera);const label=this.host.closest('.viewer-panel')?.querySelector('#selection-label'),p=this.parts.find(p=>p.id===this.selected);if(label){label.textContent=p?.name||'';label.hidden=!(this.labelsOn&&p);}}
 clear(){if(this.root){this.scene.remove(this.root);this.root.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});}this.parts=[];}
 build(model,params){
  validateParameters(model,params);
  const spec=model.build(params);if(!spec?.parts?.length)throw new Error('模型没有生成零件');
  const prepared=disassemblyParts(model,spec.parts).map(p=>{const group=new THREE.Group();group.position.set(...(p.position||[0,0,0]));group.rotation.set(...(p.rotation||[0,0,0]));for(const s of p.shapes||[]){const mesh=shapeMesh(s);mesh.userData.partId=p.id;mesh.userData.originalOpacity=mesh.material.opacity;group.add(mesh);}return {...p,group,offset:new THREE.Vector3()};});
  this.clear();this.model=model;this.params={...params};this.phase=0;this.playing=false;this.amount=0;this.root=new THREE.Group();this.scene.add(this.root);this.parts=prepared;this.partsById=new Map(prepared.map(part=>[part.id,part]));this.stages=[];for(const p of prepared)this.root.add(p.group);this.prepareExplosion();this.setHousing(this.housingMode);this.selected=prepared.find(p=>!p.hiddenInList)?.id||prepared[0].id;this.home();this.onSelect?.(this.parts.find(p=>p.id===this.selected));this.onMotion?.(this.state());
 }
 applyPose(){
  applyDisassembly(this.stages,this.partsById,this.amount);this.result=this.model.sample(this.params,this.phase);for(const p of this.parts){const s=this.result?.poses?.[p.poseSource||p.id]||{};p.group.position.set(...(s.position||p.position||[0,0,0]));p.group.position.add(p.offset);p.group.rotation.set(...(s.rotation||p.rotation||[0,0,0]));p.group.scale.set(...(s.scale||[1,1,1]));if(s.visible!==undefined)p.group.visible=!!s.visible;}
 }
 setPlaying(value){this.playing=!!value&&this.amount===0&&this.params?.inputRPM>0;this.last=undefined;this.onMotion?.(this.state());this.render();}
 setParameters(params){validateParameters(this.model,params);this.params={...params};if(!params.inputRPM)this.playing=false;this.applyPose();this.onMotion?.(this.state());this.render();}
 prepareExplosion(){
  this.amount=0;this.phase=0;this.applyPose();this.root.updateMatrixWorld(true);
  this.stages=prepareDisassembly(this.model,this.parts,this.params);
 }
 setExplode(value){const amount=Math.max(0,Math.min(1,value));if(amount>0&&!this.amount){this.playing=false;this.prepareExplosion();this.modelUp();this.direction.set(...(Math.abs(this.camera.up.z)>.9?[.68,-1,.32]:[.68,.42,1])).normalize();}if(this.amount>0&&this.controls)this.direction.copy(this.camera.position).sub(this.controls.target).normalize();this.amount=amount;this.applyPose();this.fit();this.onMotion?.(this.state());this.render();}
 select(id){const part=this.parts.find(p=>p.id===id);if(!part)return;const group=part.assemblyGroup;const shown=part.hiddenInList?this.parts.find(p=>p.assemblyGroup===group&&!p.hiddenInList)||part:part;this.selected=shown.id;this.onSelect?.(shown);this.render();}
 setHousing(mode){this.housingMode=mode;for(const p of this.parts){if(p.category!=='housing')continue;p.group.visible=mode!=='hidden'&&mode!=='open';p.group.traverse(o=>{if(o.material){o.material.opacity=mode==='transparent'?.22:o.userData.originalOpacity??1;o.material.transparent=o.material.opacity<1;o.material.depthWrite=o.material.opacity>=1;}});}this.render();}
 fit(){if(!this.root)return;const box=new THREE.Box3().setFromObject(this.root);if(box.isEmpty())return;const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());if(![...size,...center].every(Number.isFinite))return;const toward=this.direction.clone().normalize();
  const horizontal=new THREE.Vector3().crossVectors(this.camera.up,toward).normalize(),vertical=new THREE.Vector3().crossVectors(toward,horizontal);
  const tangent=Math.tan(this.camera.fov*Math.PI/360)/this.camera.zoom;let distance=20;
  for (const x of [box.min.x,box.max.x]) for (const y of [box.min.y,box.max.y]) for (const z of [box.min.z,box.max.z]) {
    const corner=new THREE.Vector3(x,y,z).sub(center);
    distance=Math.max(distance,corner.dot(toward)+1.12*Math.max(Math.abs(corner.dot(horizontal))/(this.camera.aspect*tangent),Math.abs(corner.dot(vertical))/tangent));
  }
  this.controls.target.copy(center);this.camera.position.copy(center).addScaledVector(this.direction,Math.max(distance,20));this.camera.near=Math.max(.01,distance/1000);this.camera.far=Math.max(10000,distance*20);this.camera.updateProjectionMatrix();this.controls.minDistance=Math.max(1,distance*.05);this.controls.maxDistance=Math.max(5000,distance*8);this.controls.update();this.render();}
 modelUp(){const up=this.model?.cameraUp;this.camera.up.set(...(Array.isArray(up)&&up.length===3&&up.every(Number.isFinite)&&Math.hypot(...up)>0?up:[0,1,0])).normalize();}
 home(){this.modelUp();const d=this.model?.cameraDirection;this.direction.set(...(Array.isArray(d)&&d.length===3&&d.every(Number.isFinite)&&Math.hypot(...d)>0?d:[.4,.28,1])).normalize();this.fit();}
 view(which){this.modelUp();const zUp=Math.abs(this.camera.up.z)>.9;if(zUp&&which==='top'){this.camera.up.set(0,1,0);this.direction.set(.001,0,1);}else this.direction.set(...(which==='top'?[0,1,.001]:zUp?[0,-1,0]:[0,0,1]));this.fit();}
 restore(){this.playing=false;this.phase=0;this.amount=0;if(!this.model)return;for(const p of this.parts)p.offset.set(0,0,0);this.applyPose();this.home();this.onMotion?.(this.state());}
 state(){return {phase:this.phase,playing:this.playing,amount:this.amount,selected:this.selected,speed:this.speed,result:this.result};}
}
