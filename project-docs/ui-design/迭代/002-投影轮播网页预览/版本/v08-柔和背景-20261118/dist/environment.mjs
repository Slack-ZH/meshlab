import * as THREE from '/shared/assets/three.module.js';

// Sparse, static depth cues. No star textures, NASA imagery or extra moving objects.
export function createOpenEnvironment(scene){
  let seed=6146;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const positions=[],brightness=[];
  for(let i=0;i<210;i++){
    positions.push((random()-.5)*120,3+random()*45,-12-random()*65);
    brightness.push(.18+random()*.38);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('aBrightness',new THREE.Float32BufferAttribute(brightness,1));
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
    vertexShader:'attribute float aBrightness;varying float vBrightness;void main(){vBrightness=aBrightness;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=1.1+aBrightness*1.5;}',
    fragmentShader:'varying float vBrightness;void main(){float a=1.-smoothstep(.05,.5,length(gl_PointCoord-.5));gl_FragColor=vec4(.50,.68,.82,a*vBrightness);}',
  });
  const stars=new THREE.Points(geometry,material);stars.frustumCulled=false;scene.add(stars);
  const horizon=new THREE.Mesh(new THREE.PlaneGeometry(160,160),new THREE.ShaderMaterial({transparent:true,depthWrite:false,
    vertexShader:'varying vec3 vWorld;void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}',
    fragmentShader:'varying vec3 vWorld;void main(){float r=length(vWorld.xz);float a=(1.-smoothstep(3.,36.,r))*.3;gl_FragColor=vec4(.055,.10,.15,a);}',
  }));horizon.rotation.x=-Math.PI/2;horizon.position.y=-.33;scene.add(horizon);
  return {stars,horizon};
}
