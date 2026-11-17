import * as THREE from '/shared/assets/three.module.js';
import {machinedRing} from '/shared/assets/reference-stage.mjs';

// One compact instrument: a chamfered housing around a recessed optical assembly.
export function createProjector() {
  const root=new THREE.Group();
  const material=(color,metalness=.55,roughness=.4)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
  const shell=material(0x384652), lower=material(0x18232e,.38,.55), machined=material(0x91a5b2,.76,.28), recess=material(0x172733,.6,.34);
  const add=(geometry,finish,position=[0,0,0])=>{
    const mesh=new THREE.Mesh(geometry,finish);mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;
  };
  const outline=[[-1.14,-1.19],[1.14,-1.19],[1.51,-.82],[1.51,.82],[1.14,1.19],[-1.14,1.19],[-1.51,.82],[-1.51,-.82]];
  const plate=(points,depth,bevel,bore=0)=>{
    const shape=new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(x,z)));
    if(bore){const hole=new THREE.Path();hole.absarc(0,0,bore,0,Math.PI*2,true);shape.holes.push(hole);}
    const geometry=new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:3,curveSegments:64});
    geometry.rotateX(-Math.PI/2);return geometry;
  };
  add(plate(outline.map(([x,z])=>[x*.96,z*.96]),.12,.035),lower,[0,.055,0]);
  const body=add(plate(outline,.32,.055,.96),shell,[0,.22,0]);
  // The opening has real depth: its wall descends from the top panel to the lens.
  const wallProfile=[[.70,.22],[.74,.26],[.88,.49],[.92,.55],[.96,.55],[.93,.47],[.80,.22],[.70,.22]];
  add(new THREE.LatheGeometry(wallProfile.map(p=>new THREE.Vector2(...p)),96),recess);
  const ring=(outer,inner,depth,y,finish)=>{
    const mesh=add(machinedRing(outer,inner,depth),finish,[0,y,0]);mesh.rotation.x=-Math.PI/2;return mesh;
  };
  const rim=ring(.975,.925,.025,.554,machined);
  ring(.754,.711,.023,.248,material(0x43596a,.72,.26));
  const discUniforms={uPower:{value:0},uLight:{value:.45},uActivity:{value:0},uTime:{value:0}};
  const opticalFace=add(new THREE.CircleGeometry(.708,96),new THREE.ShaderMaterial({uniforms:discUniforms,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 vUv;uniform float uPower,uLight,uActivity,uTime;
      void main(){vec2 p=vUv-.5;float r=length(p)*2.;
      float aperture=1.-smoothstep(.1,.94,r);float edge=smoothstep(.91,.96,r)*(1.-smoothstep(.98,1.,r));
      float gather=exp(-pow((r-(.84-.62*uActivity))/.075,2.))*uActivity;
      float core=exp(-r*r*22.)*uActivity;
      float fine=.5+.5*cos(r*42.-uTime*5.);
      vec3 color=vec3(.006,.025,.04)+vec3(.12,.46,.66)*(aperture*.30+edge*.65+gather*1.6+core*2.1+fine*aperture*uActivity*.1)*uPower*uLight;
      gl_FragColor=vec4(color,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  }),[0,.253,0]);opticalFace.rotation.x=-Math.PI/2;opticalFace.castShadow=false;
  // A shallow convex optical cover catches the key light; not a flat luminous platter.
  const lens=add(new THREE.SphereGeometry(2.5,72,18,0,Math.PI*2,.002,.285),new THREE.MeshPhysicalMaterial({
    color:0x34728a,metalness:.08,roughness:.16,clearcoat:1,clearcoatRoughness:.1,transparent:true,opacity:.28,depthWrite:false,
  }),[0,-2.195,0]);lens.castShadow=false;
  // Three small optical heads sit inside the cavity, with purpose rather than exterior armour.
  const glow=new THREE.MeshStandardMaterial({color:0x99d9e8,emissive:0x64cbe7,emissiveIntensity:.18,metalness:.25,roughness:.25});
  for(let i=0;i<3;i++){
    const a=i*Math.PI*2/3+Math.PI/2;
    const head=new THREE.Group();head.position.set(Math.sin(a)*.837,.415,Math.cos(a)*.837);head.rotation.y=a;root.add(head);
    const mount=new THREE.Mesh(new THREE.BoxGeometry(.19,.08,.11),material(0x607582,.7,.3));mount.castShadow=true;head.add(mount);
    const emitter=new THREE.Mesh(new THREE.BoxGeometry(.12,.035,.014),glow);emitter.position.set(0,0,-.062);head.add(emitter);
  }
  // Flush fixings and a few calibration ticks keep the top surface quiet.
  for(const x of [-1.22,1.22])for(const z of [-.89,.89]){
    add(new THREE.CylinderGeometry(.031,.031,.008,6),material(0x192731,.65,.42),[x,.602,z]);
  }
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4;
    const tick=add(new THREE.BoxGeometry(.008,.003,i%2===0?.065:.027),material(0x8095a2,.25,.7),[Math.sin(a)*1.041,.599,Math.cos(a)*1.041]);tick.rotation.y=a;tick.castShadow=false;
  }
  // Fine side vents, kept to one functional strip on each side.
  for(const x of [-1.569,1.569])for(let i=0;i<7;i++){
    add(new THREE.BoxGeometry(.006,.105,.025),material(0x080e14,.1,.85),[x,.352,(i-3)*.105]);
  }
  for(const x of [-1.10,1.10])for(const z of [-.79,.79])add(new THREE.CylinderGeometry(.13,.145,.055,32),material(0x080d12,.02,.9),[x,.009,z]);
  // A legible, restrained front maker's mark and a single operating light.
  const labelCanvas=document.createElement('canvas');labelCanvas.width=512;labelCanvas.height=96;
  const ctx=labelCanvas.getContext('2d');ctx.fillStyle='#b3c4cf';ctx.font='500 40px Segoe UI, sans-serif';ctx.fillText('meshlab',10,58);
  ctx.fillStyle='#8094a2';ctx.font='22px Consolas, monospace';ctx.fillText('P—01',338,56);
  const labelTexture=new THREE.CanvasTexture(labelCanvas);labelTexture.colorSpace=THREE.SRGBColorSpace;
  const label=add(new THREE.PlaneGeometry(1.35,.253),new THREE.MeshBasicMaterial({map:labelTexture,transparent:true,depthWrite:false}),[-.22,.373,1.248]);label.castShadow=false;
  const status=add(new THREE.CircleGeometry(.022,24),glow,[.88,.36,1.249]);status.castShadow=false;
  return {root,discUniforms,body,rim,glow};
}
