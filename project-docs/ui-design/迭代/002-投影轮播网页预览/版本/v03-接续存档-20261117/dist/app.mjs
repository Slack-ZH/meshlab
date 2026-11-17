import * as THREE from '/shared/assets/three.module.js';
import {createReferenceStage} from '/shared/assets/reference-stage.mjs';
import {OrbitControls} from '/shared/assets/OrbitControls.js';
import {createProjector} from './projector.mjs';
import {createModel, catalogue} from './models.mjs';
import {sequence, wrap, clamp} from './motion.mjs';

const $ = id => document.getElementById(id);
const MODEL_BASE = 1.12;
const reducedMedia = matchMedia('(prefers-reduced-motion: reduce)');
const state = {index:0, turn:0, time:0, paused:reducedMedia.matches, reduced:reducedMedia.matches, light:.45, speed:1, deviceScale:.62, expanded:false, ready:false, phase:'loading',view:'projection'};
let renderer, camera, scene, stage, frame, transition, models, bases, pivot, beam, point, orbit;
let lastTime = 0, lastPhase = '', disposed = false;
const pointer = new THREE.Vector2(), smoothedPointer = new THREE.Vector2();
const projection = {reveal:{value:0}, bottom:{value:MODEL_BASE}, top:{value:3.7}, power:{value:0}, reduced:{value:state.reduced ? 1 : 0}};
const controls = ['previous','next','quick-next','replay','structure'];
const phaseNames = {loading:'准备投影',closing:'旧投影关闭',moving:'展位切换',igniting:'盘面启动',forming:'机构形成',settling:'投影稳定',ready:'投影已就绪'};

function showError(error) {
  state.ready = false;
  $('loading').hidden = true;
  $('error').hidden = false;
  $('error-detail').textContent = '请确认浏览器支持 WebGL，然后重新载入。';
  $('status').lastElementChild.textContent = '预览未就绪';
  document.body.dataset.ready = 'false';
  console.error(error);
  for (const id of [...controls,'pause']) $(id).disabled = true;
  document.querySelectorAll('[data-index]').forEach(button => button.disabled = true);
}

function attachProjectionMaterial(material) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uReveal = projection.reveal;
    shader.uniforms.uBottom = projection.bottom;
    shader.uniforms.uTop = projection.top;
    shader.uniforms.uPower = projection.power;
    shader.uniforms.uReduced = projection.reduced;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vProjectionWorld;');
    shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvProjectionWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vProjectionWorld;\nuniform float uReveal;\nuniform float uBottom;\nuniform float uTop;\nuniform float uPower;\nuniform float uReduced;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      float scanY = mix(uBottom - 0.06, uTop + 0.12, uReveal);
      if (uReduced < 0.5 && vProjectionWorld.y > scanY) discard;
      if (uReveal < 0.001) discard;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      float band = (1.0 - smoothstep(0.0, 0.13, abs(vProjectionWorld.y - scanY)));
      float scanning = step(0.002, uReveal) * (1.0 - step(0.998, uReveal)) * (1.0 - uReduced);
      outgoingLight += vec3(0.22, 0.63, 0.95) * band * scanning * 1.4;
      if (uReduced > 0.5) diffuseColor.a *= uReveal;
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => 'meshlab-projection-v1';
  material.transparent = state.reduced;
  material.needsUpdate = true;
}

function setPhase(phase) {
  state.phase = phase;
  document.body.dataset.phase = phase;
  if (lastPhase === phase) return;
  lastPhase = phase;
  $('status').lastElementChild.textContent = state.view==='device' ? '设备近景' : state.paused ? '动画已暂停' : phaseNames[phase];
  document.querySelectorAll('[data-phase]').forEach(node => node.classList.toggle('active',node.dataset.phase === phase));
  $('phase-caption').textContent = phase === 'ready' ? '中央发光盘 · 简洁底座 · 机构优先' : phase === 'settling' ? '收敛光效，让结构清楚呈现' : phaseNames[phase];
}

function setBusy(busy) {
  for (const id of controls) $(id).disabled = busy;
  document.querySelectorAll('[data-index]').forEach(button => button.disabled = busy);
  $('pause').disabled = false;
  document.body.dataset.busy = String(busy);
}

function clearSelection() {
  models?.[state.index].select(null);
  $('selection').hidden = true;
  document.body.dataset.selected = '';
}

function updateInfo() {
  const item = catalogue[state.index];
  const device=state.view==='device';
  $('mechanism-title').textContent=device?'中央投影器':item.title;
  $('mechanism-english').textContent=device?'PROJECTION UNIT / P—01':item.english;
  $('mechanism-description').textContent=device?'内凹光学腔，收进一体式机身。':item.description;
  $('parameter').textContent=device?'P—01':item.parameter;
  $('parameter-note').textContent=device?'单机 · 固定展位':item.note;
  $('structure').hidden=device;
  $('scene-index').textContent=device?'P—01':item.index+' / 02';
  $('item-counter').textContent=item.index+' / 02';
  $('viewport').setAttribute('aria-label',device?'投影仪本体三维近景：可拖动旋转，双击恢复视角。':item.title+'三维投影。'+item.detail+' 使用下方控件切换、重播或拆开观察。');
  document.querySelectorAll('[data-index]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.index)===state.index)));
  document.body.dataset.mechanism=item.id;
}

function applyModel(index) {
  clearSelection();
  if (models[state.index].holder.parent) pivot.remove(models[state.index].holder);
  state.index=index;
  state.expanded=false;
  models[index].explode(false);
  pivot.add(models[index].holder);
  projection.top.value=MODEL_BASE+models[index].height;
  $('structure').setAttribute('aria-pressed','false');
  $('structure').firstElementChild.textContent='拆开观察';
  document.body.dataset.expanded='false';
  updateInfo();
}

function setPaused(value) {
  state.paused=value;
  $('pause').setAttribute('aria-pressed',String(value));
  $('pause').lastElementChild.textContent=value?'继续动画':'暂停动画';
  $('pause').querySelector('path').setAttribute('d',value?'m8 5 11 7-11 7V5Z':'M8 5v14M16 5v14');
  $('status').lastElementChild.textContent=state.view==='device'?'设备近景':value?'动画已暂停':phaseNames[state.phase];
  document.body.dataset.paused=String(value);
}

function startTransition(target,direction,{initial=false,replay=false}={}) {
  if (!state.ready || transition) return;
  clearSelection();
  if (!initial) setPaused(false);
  transition={from:0,to:0,target,elapsed:state.reduced&&initial?1:0,initial,replay:true,swapped:false};
  setBusy(true);
}

function layoutBases(turn) {
  bases[0].root.position.set(0,0,0);
  bases[0].root.scale.setScalar(state.view==='device'?1:state.deviceScale);
  bases[0].body.material.color.setHex(state.view==='device'?0x384652:0x222c35);
  bases[0].rim.material.color.setHex(state.view==='device'?0x91a5b2:0x627783);
}

function resize() {
  if (!renderer) return;
  const width=$('viewport').clientWidth,height=$('viewport').clientHeight;
  if (!width||!height) return;
  renderer.setSize(width,height);
  camera.aspect=width/height;
  const fov=Math.tan(camera.fov*Math.PI/360);
  const device=state.view==='device';
  const distance=device?Math.max(3.05/(2*fov),4.4/(2*fov*camera.aspect)):Math.max(4.7/(2*fov),5.0/(2*fov*camera.aspect));
  const target=new THREE.Vector3(0,device?.25:1.80,0);
  camera.position.copy(target).addScaledVector(new THREE.Vector3(...(device?[.65,.70,1]:[.24,.27,1])).normalize(),distance);
  camera.lookAt(target);camera.updateProjectionMatrix();
  if(orbit){orbit.target.copy(target);orbit.update();}
}

function setView(view) {
  state.view=view;document.body.dataset.view=view;
  if(view==='device')toggleCatalogue(false);
  orbit.enabled=view==='device';
  $('view-device').setAttribute('aria-pressed',String(view==='device'));
  $('view-projection').setAttribute('aria-pressed',String(view==='projection'));
  $('scene-hint-text').textContent=view==='device'?'拖动查看设备 · 双击恢复视角':'轻移鼠标，感受空间 · 点击机构，查看零件';
  transition=null;state.turn=0;setBusy(false);clearSelection();updateInfo();resize();
  lastPhase='';setPhase('ready');
  scene.traverse(object=>{if(object.type==='GridHelper')object.visible=view==='projection';});
  if(view==='projection'){if(!state.reduced)setPaused(false);startTransition(state.index,0,{initial:true});}
}

function toggleCatalogue(open) {
  $('catalogue').hidden=!open;
  $('exhibit-layout').classList.toggle('catalogue-open',open);
  $('catalogue-toggle').setAttribute('aria-expanded',String(open));
}

function animate(now) {
  if (disposed) return;
  frame=requestAnimationFrame(animate);
  const dt=lastTime ? Math.min((now-lastTime)/1000,.05) : 0;lastTime=now;
  if (!state.ready || document.hidden) return;
  try {
    let sample={reveal:1,power:.32,phase:'ready'};
    if (transition) {
      if (!state.paused) transition.elapsed+=dt*state.speed;
      sample=sequence(transition.elapsed,{...transition,reduced:state.reduced});
      if (sample.newModel&&!transition.swapped) {applyModel(transition.target);transition.swapped=true;}
      const travel=state.reduced?(sample.newModel?1:0):sample.travel;
      layoutBases(THREE.MathUtils.lerp(transition.from,transition.to,travel));
      const active=sample.newModel?transition.to:transition.from;
      const base=bases[0];
      pivot.position.set(base.root.position.x,MODEL_BASE,base.root.position.z);
      beam.position.set(base.root.position.x,1.55+.25*state.deviceScale,base.root.position.z);
      point.position.set(base.root.position.x,.55*state.deviceScale,base.root.position.z);
      bases.forEach(b=>{b.discUniforms.uPower.value=b===base?sample.power:0;});
      if (sample.done) {state.turn=transition.to;transition=null;setBusy(false);}
    } else {
      if (!state.paused&&!state.reduced) state.time+=dt;
      models[state.index].update(state.time);
      layoutBases(state.turn);
      const base=bases[0];
      pivot.position.set(base.root.position.x,MODEL_BASE,base.root.position.z);
      beam.position.set(base.root.position.x,1.55+.25*state.deviceScale,base.root.position.z);
      bases.forEach(b=>{b.discUniforms.uPower.value=b===base ? .32 : 0;});
    }
    projection.reveal.value=sample.reveal;
    projection.power.value=sample.power;
    projection.bottom.value=MODEL_BASE;
    projection.top.value=MODEL_BASE+models[state.index].height;
    pivot.visible=state.view==='projection'&&sample.reveal>.0001;
    const alpha=1-Math.exp(-dt*4);
    smoothedPointer.lerp(state.reduced?new THREE.Vector2():pointer,alpha);
    pivot.rotation.y=smoothedPointer.x*.035;
    pivot.rotation.x=smoothedPointer.y*.015;
    beam.material.uniforms.uPower.value=sample.power;
    beam.material.uniforms.uLight.value=state.light;
    beam.material.uniforms.uBaseScale.value=state.deviceScale;
    beam.visible=state.view==='projection'&&sample.power>.001&&state.light>0&&!state.reduced;
    point.intensity=sample.power*state.light*.55;
    for(const base of bases){base.discUniforms.uLight.value=state.light;if(state.view==='device')base.discUniforms.uPower.value=.55;base.glow.emissiveIntensity=.1+base.discUniforms.uPower.value*.3;}
    orbit.update();
    setPhase(sample.phase);
    renderer.render(scene,camera);
  } catch(error) {showError(error);cancelAnimationFrame(frame);}
}

function bindUI() {
  $('view-device').onclick=()=>setView('device');
  $('view-projection').onclick=()=>setView('projection');
  $('catalogue-toggle').onclick=()=>toggleCatalogue($('catalogue').hidden);
  $('catalogue-close').onclick=()=>{toggleCatalogue(false);$('catalogue-toggle').focus();};
  $('tune-toggle').onclick=()=>{
    const open=$('tuning').hidden;
    $('tuning').hidden=!open;
    $('tune-toggle').setAttribute('aria-expanded',String(open));
    if(open)$('tuning').scrollIntoView({block:'nearest',behavior:state.reduced?'instant':'smooth'});
  };
  $('light').oninput=e=>{state.light=Number(e.target.value)/100;$('light-value').value=e.target.value+'%';};
  $('speed').oninput=e=>{state.speed=Number(e.target.value)/100;$('speed-value').value=state.speed.toFixed(1)+'×';};
  $('device-scale').oninput=e=>{state.deviceScale=Number(e.target.value)/100;$('device-scale-value').value=e.target.value+'%';};
  const setReduced=value=>{
    state.reduced=value;$('reduced').checked=value;projection.reduced.value=value?1:0;
    pointer.set(0,0);
    models?.forEach(model=>model.holder.traverse(mesh=>{if(mesh.isMesh){mesh.material.transparent=value;mesh.material.needsUpdate=true;}}));
    if(value&&!transition)setPaused(true);
    document.body.dataset.reduced=String(value);
  };
  $('reduced').onchange=e=>setReduced(e.target.checked);
  reducedMedia.addEventListener('change',e=>setReduced(e.matches));
  $('reset-tuning').onclick=()=>{
    state.light=.45;state.speed=1;state.deviceScale=.62;$('light').value='45';$('speed').value='100';$('device-scale').value='62';$('device-scale-value').value='62%';
    $('light-value').value='45%';$('speed-value').value='1.0×';setReduced(reducedMedia.matches);
  };
  $('previous').onclick=()=>startTransition(wrap(state.index-1,catalogue.length),-1);
  $('next').onclick=()=>startTransition(wrap(state.index+1,catalogue.length),1);
  $('quick-next').onclick=$('next').onclick;
  $('replay').onclick=()=>startTransition(state.index,0,{replay:true});
  $('pause').onclick=()=>setPaused(!state.paused);
  document.querySelectorAll('[data-index]').forEach(button=>button.onclick=()=>{
    const next=Number(button.dataset.index);if(next!==state.index)startTransition(next,next>state.index?1:-1);
    if(matchMedia('(max-width: 700px)').matches){toggleCatalogue(false);$('viewport').scrollIntoView({block:'center',behavior:state.reduced?'instant':'smooth'});}
  });
  $('structure').onclick=()=>{
    state.expanded=!state.expanded;models[state.index].explode(state.expanded);
    $('structure').setAttribute('aria-pressed',String(state.expanded));
    $('structure').firstElementChild.textContent=state.expanded?'恢复装配':'拆开观察';
    document.body.dataset.expanded=String(state.expanded);
    $('mechanism-description').textContent=state.expanded?'沿装配轴线分开，观察零件之间的关系。':catalogue[state.index].description;
  };
  $('clear-selection').onclick=clearSelection;
  $('retry').onclick=()=>location.reload();
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){clearSelection();toggleCatalogue(false);$('tuning').hidden=true;$('tune-toggle').setAttribute('aria-expanded','false');return;}
    if(state.view==='device'||e.target.matches('input,select,textarea')||e.altKey||e.ctrlKey||e.metaKey)return;
    if(e.key==='ArrowRight'){e.preventDefault();if(!transition)$('next').click();}
    if(e.key==='ArrowLeft'){e.preventDefault();if(!transition)$('previous').click();}
  });
  let down;
  $('viewport').addEventListener('pointermove',e=>{
    if(e.pointerType!=='mouse')return;const rect=$('viewport').getBoundingClientRect();
    pointer.set(clamp((e.clientX-rect.left)/rect.width*2-1,-1,1),clamp((e.clientY-rect.top)/rect.height*2-1,-1,1));
  });
  $('viewport').addEventListener('pointerleave',()=>pointer.set(0,0));
  $('viewport').addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
  $('viewport').addEventListener('pointercancel',()=>{down=null;});
  $('viewport').addEventListener('pointerup',e=>{
    if(state.view==='device'||!down||transition||!state.ready||Math.hypot(e.clientX-down.x,e.clientY-down.y)>6){down=null;return;}down=null;
    const rect=$('viewport').getBoundingClientRect(),ray=new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
    const hits=ray.intersectObject(models[state.index].holder,true);
    const hit=hits.find(hit=>hit.object.userData.partId);
    if(!hit){clearSelection();return;}
    const part=models[state.index].select(hit.object.userData.partId);
    if(part){$('selection').hidden=false;$('part-name').textContent=part.name;document.body.dataset.selected=part.id;}
  });
  $('viewport').addEventListener('dblclick',()=>{if(state.view==='device')resize();});
  document.addEventListener('visibilitychange',()=>{lastTime=0;});
  new ResizeObserver(resize).observe($('viewport'));
  setReduced(state.reduced);
}

try {
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(34,1,.1,100);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
  renderer.setClearColor(0x10151b,0);
  renderer.domElement.setAttribute('aria-hidden','true');
  $('viewport').append(renderer.domElement);
  orbit=new OrbitControls(camera,renderer.domElement);
  orbit.enableDamping=true;orbit.dampingFactor=.09;orbit.enablePan=false;orbit.enableZoom=false;orbit.rotateSpeed=.6;
  orbit.minPolarAngle=.12;orbit.maxPolarAngle=Math.PI*.47;
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();showError(new Error('WebGL context lost'));});
  renderer.debug.onShaderError=(gl,program,vertex,fragment)=>showError(new Error(gl.getShaderInfoLog(vertex)+' '+gl.getShaderInfoLog(fragment)));
  stage=createReferenceStage(scene,renderer);
  stage.fit(new THREE.Box3(new THREE.Vector3(-5.9,-.04,-5.6),new THREE.Vector3(5.9,3.6,1.7)),new THREE.Vector3(0,1,0));
  stage.setDark(true);
  scene.traverse(object=>{if(object.type==='GridHelper')object.material.opacity=.018;});
  bases=[createProjector()];scene.add(bases[0].root);
  pivot=new THREE.Group();pivot.position.y=MODEL_BASE;scene.add(pivot);
  models=catalogue.map((_,i)=>createModel(i));
  models.forEach(model=>model.holder.traverse(mesh=>{if(mesh.isMesh)attachProjectionMaterial(mesh.material);}));
  const beamGeometry=new THREE.CylinderGeometry(1.6,.68,3.1,64,1,true);
  beam=new THREE.Mesh(beamGeometry,new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
    uniforms:{uPower:{value:0},uLight:{value:.45},uBaseScale:{value:.62}},
    vertexShader:'varying vec2 vUv; uniform float uBaseScale; void main(){vUv=uv;vec3 p=position;float radius=mix(.68,1.6,uv.y);p.xz*=mix(.68*uBaseScale,1.6,uv.y)/radius;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
    fragmentShader:`varying vec2 vUv; uniform float uPower; uniform float uLight;
      void main(){float fade=pow(1.-vUv.y,2.2)*smoothstep(0.,.12,vUv.y);float ribs=.8+.2*pow(.5+.5*cos(vUv.x*100.),12.);
      gl_FragColor=vec4(.28,.65,.9,fade*ribs*uPower*uLight*.21);}`,
  }));scene.add(beam);
  point=new THREE.PointLight(0x89d1f2,0,5,2);scene.add(point);
  bindUI();applyModel(0);resize();
  $('loading').hidden=true;state.ready=true;document.body.dataset.ready='true';
  setPaused(state.paused);setView('projection');
  frame=requestAnimationFrame(animate);
  window.addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(frame);orbit.dispose();renderer.dispose();},{once:true});
}catch(error){showError(error);}
