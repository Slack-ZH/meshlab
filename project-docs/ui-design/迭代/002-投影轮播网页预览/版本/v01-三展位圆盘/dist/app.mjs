import * as THREE from '/shared/assets/three.module.js';
import {createReferenceStage, machinedRing} from '/shared/assets/reference-stage.mjs';
import {createModel, catalogue} from './models.mjs';
import {sequence, wrap, clamp} from './motion.mjs';

const $ = id => document.getElementById(id);
const reducedMedia = matchMedia('(prefers-reduced-motion: reduce)');
const state = {index:0, turn:0, time:0, paused:reducedMedia.matches, reduced:reducedMedia.matches, light:.45, speed:1, expanded:false, ready:false, phase:'loading'};
let renderer, camera, scene, stage, frame, transition, models, bases, pivot, beam, point;
let lastTime = 0, lastPhase = '', disposed = false;
const pointer = new THREE.Vector2(), smoothedPointer = new THREE.Vector2();
const projection = {reveal:{value:0}, bottom:{value:.95}, top:{value:3.5}, power:{value:0}, reduced:{value:state.reduced ? 1 : 0}};
const controls = ['previous','next','replay','structure'];
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

function makeBase() {
  const root = new THREE.Group();
  const bodyProfile = [[0,0],[1.37,0],[1.46,.04],[1.46,.14],[1.40,.20],[0,.20]].map(([r,y]) => new THREE.Vector2(r,y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(bodyProfile,96),new THREE.MeshStandardMaterial({color:0x29333f,metalness:.6,roughness:.42}));
  body.castShadow = body.receiveShadow = true; root.add(body);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(1.35,1.35,.04,96),new THREE.MeshStandardMaterial({color:0x0b1015,roughness:.9}));
  foot.position.y = -.015; root.add(foot);
  const rim = new THREE.Mesh(machinedRing(1.28,1.23,.022),new THREE.MeshStandardMaterial({color:0x647381,metalness:.65,roughness:.38}));
  rim.rotation.x = -Math.PI/2; rim.position.y = .202; root.add(rim);
  const discUniforms = {uPower:{value:0},uLight:{value:.45}};
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.23,96),new THREE.ShaderMaterial({uniforms:discUniforms,
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 vUv; uniform float uPower; uniform float uLight;
      void main(){float r=length(vUv-.5)*2.;
      vec3 base=vec3(.009,.014,.02); float edge=smoothstep(.94,.98,r)*(1.-smoothstep(.985,1.,r));
      float energy=(.05+.42*pow(1.-r,1.5)+.65*edge)*uPower*uLight;
      gl_FragColor=vec4(base+vec3(.28,.65,.83)*energy,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  }));
  disc.rotation.x=-Math.PI/2;disc.position.y=.217;root.add(disc);
  return {root,discUniforms,body,rim};
}

function setPhase(phase) {
  state.phase = phase;
  document.body.dataset.phase = phase;
  if (lastPhase === phase) return;
  lastPhase = phase;
  $('status').lastElementChild.textContent = state.paused ? '动画已暂停' : phaseNames[phase];
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
  $('mechanism-title').textContent=item.title;
  $('mechanism-english').textContent=item.english;
  $('mechanism-description').textContent=item.description;
  $('parameter').textContent=item.parameter;
  $('parameter-note').textContent=item.note;
  $('scene-index').textContent=item.index+' / 02';
  $('viewport').setAttribute('aria-label',item.title+'三维投影。'+item.detail+' 使用下方控件切换、重播或拆开观察。');
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
  projection.top.value=.95+models[index].height;
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
  $('status').lastElementChild.textContent=value?'动画已暂停':phaseNames[state.phase];
  document.body.dataset.paused=String(value);
}

function startTransition(target,direction,{initial=false,replay=false}={}) {
  if (!state.ready || transition) return;
  clearSelection();
  if (!initial) setPaused(false);
  transition={from:state.turn,to:state.turn+(replay||initial?0:direction),target,elapsed:state.reduced&&initial?1:0,initial,replay,swapped:false};
  setBusy(true);
}

function layoutBases(turn) {
  bases.forEach((base,i)=>{
    const a=(i-turn)*Math.PI*2/3;
    base.root.position.set(Math.sin(a)*4.6,0,(Math.cos(a)-1)*2.6);
    base.root.rotation.y=a*.12;
    const focus=Math.pow((1+Math.cos(a))/2,4);
    base.root.scale.setScalar(.76+.24*focus);
    base.body.material.color.setHex(0x111920).lerp(new THREE.Color(0x29333f),focus);
    base.rim.material.color.setHex(0x22303c).lerp(new THREE.Color(0x647381),focus);
  });
}

function resize() {
  if (!renderer) return;
  const width=$('viewport').clientWidth,height=$('viewport').clientHeight;
  if (!width||!height) return;
  renderer.setSize(width,height);
  camera.aspect=width/height;
  const fov=Math.tan(camera.fov*Math.PI/360);
  const distance=Math.max(4.7/(2*fov),5.0/(2*fov*camera.aspect));
  const target=new THREE.Vector3(0,1.65,0);
  camera.position.copy(target).addScaledVector(new THREE.Vector3(.24,.27,1).normalize(),distance);
  camera.lookAt(target);camera.updateProjectionMatrix();
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
      const base=bases[wrap(Math.round(active),3)];
      pivot.position.set(base.root.position.x,.95,base.root.position.z);
      beam.position.set(base.root.position.x,1.77,base.root.position.z);
      point.position.set(base.root.position.x,.55,base.root.position.z);
      bases.forEach(b=>{b.discUniforms.uPower.value=b===base?sample.power:0;});
      if (sample.done) {state.turn=transition.to;transition=null;setBusy(false);}
    } else {
      if (!state.paused&&!state.reduced) state.time+=dt;
      models[state.index].update(state.time);
      layoutBases(state.turn);
      const base=bases[wrap(state.turn,3)];
      pivot.position.set(base.root.position.x,.95,base.root.position.z);
      beam.position.set(base.root.position.x,1.77,base.root.position.z);
      bases.forEach(b=>{b.discUniforms.uPower.value=b===base ? .32 : 0;});
    }
    projection.reveal.value=sample.reveal;
    projection.power.value=sample.power;
    projection.bottom.value=.95;
    projection.top.value=.95+models[state.index].height;
    pivot.visible=sample.reveal>.0001;
    const alpha=1-Math.exp(-dt*4);
    smoothedPointer.lerp(state.reduced?new THREE.Vector2():pointer,alpha);
    pivot.rotation.y=smoothedPointer.x*.035;
    pivot.rotation.x=smoothedPointer.y*.015;
    beam.material.uniforms.uPower.value=sample.power;
    beam.material.uniforms.uLight.value=state.light;
    beam.visible=sample.power>.001&&state.light>0&&!state.reduced;
    point.intensity=sample.power*state.light*.55;
    for(const base of bases)base.discUniforms.uLight.value=state.light;
    setPhase(sample.phase);
    renderer.render(scene,camera);
  } catch(error) {showError(error);cancelAnimationFrame(frame);}
}

function bindUI() {
  $('tune-toggle').onclick=()=>{
    const open=$('tuning').hidden;
    $('tuning').hidden=!open;
    $('tune-toggle').setAttribute('aria-expanded',String(open));
    if(open)$('tuning').scrollIntoView({block:'nearest',behavior:state.reduced?'instant':'smooth'});
  };
  $('light').oninput=e=>{state.light=Number(e.target.value)/100;$('light-value').value=e.target.value+'%';};
  $('speed').oninput=e=>{state.speed=Number(e.target.value)/100;$('speed-value').value=state.speed.toFixed(1)+'×';};
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
    state.light=.45;state.speed=1;$('light').value='45';$('speed').value='100';
    $('light-value').value='45%';$('speed-value').value='1.0×';setReduced(reducedMedia.matches);
  };
  $('previous').onclick=()=>startTransition(wrap(state.index-1,catalogue.length),-1);
  $('next').onclick=()=>startTransition(wrap(state.index+1,catalogue.length),1);
  $('replay').onclick=()=>startTransition(state.index,0,{replay:true});
  $('pause').onclick=()=>setPaused(!state.paused);
  document.querySelectorAll('[data-index]').forEach(button=>button.onclick=()=>{
    const next=Number(button.dataset.index);if(next!==state.index)startTransition(next,next>state.index?1:-1);
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
    if(e.key==='Escape'){clearSelection();$('tuning').hidden=true;$('tune-toggle').setAttribute('aria-expanded','false');return;}
    if(e.target.matches('input,select,textarea')||e.altKey||e.ctrlKey||e.metaKey)return;
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
    if(!down||transition||!state.ready||Math.hypot(e.clientX-down.x,e.clientY-down.y)>6){down=null;return;}down=null;
    const rect=$('viewport').getBoundingClientRect(),ray=new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
    const hits=ray.intersectObject(models[state.index].holder,true);
    const hit=hits.find(hit=>hit.object.userData.partId);
    if(!hit){clearSelection();return;}
    const part=models[state.index].select(hit.object.userData.partId);
    if(part){$('selection').hidden=false;$('part-name').textContent=part.name;document.body.dataset.selected=part.id;}
  });
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
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();showError(new Error('WebGL context lost'));});
  renderer.debug.onShaderError=(gl,program,vertex,fragment)=>showError(new Error(gl.getShaderInfoLog(vertex)+' '+gl.getShaderInfoLog(fragment)));
  stage=createReferenceStage(scene,renderer);
  stage.fit(new THREE.Box3(new THREE.Vector3(-5.9,-.04,-5.6),new THREE.Vector3(5.9,3.6,1.7)),new THREE.Vector3(0,1,0));
  stage.setDark(true);
  scene.traverse(object=>{if(object.type==='GridHelper')object.material.opacity=.018;});
  bases=Array.from({length:3},()=>{const base=makeBase();scene.add(base.root);return base;});
  pivot=new THREE.Group();pivot.position.y=.95;scene.add(pivot);
  models=catalogue.map((_,i)=>createModel(i));
  models.forEach(model=>model.holder.traverse(mesh=>{if(mesh.isMesh)attachProjectionMaterial(mesh.material);}));
  const beamGeometry=new THREE.CylinderGeometry(1.6,1.06,3.1,64,1,true);
  beam=new THREE.Mesh(beamGeometry,new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
    uniforms:{uPower:{value:0},uLight:{value:.45}},
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 vUv; uniform float uPower; uniform float uLight;
      void main(){float fade=pow(1.-vUv.y,2.2)*smoothstep(0.,.12,vUv.y);float ribs=.8+.2*pow(.5+.5*cos(vUv.x*100.),12.);
      gl_FragColor=vec4(.28,.65,.9,fade*ribs*uPower*uLight*.21);}`,
  }));scene.add(beam);
  point=new THREE.PointLight(0x89d1f2,0,5,2);scene.add(point);
  bindUI();applyModel(0);resize();
  $('loading').hidden=true;state.ready=true;document.body.dataset.ready='true';
  setPaused(state.paused);startTransition(0,0,{initial:true});
  frame=requestAnimationFrame(animate);
  window.addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(frame);renderer.dispose();},{once:true});
}catch(error){showError(error);}
