import * as THREE from '/shared/assets/three.module.js';

const declarations=`
varying vec3 vProjectionWorld;
uniform float uReveal,uBottom,uTop,uReduced,uContour,uDischarge;
float cellNoise(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float fieldAt(vec3 p){
  float h=clamp((p.y-uBottom)/max(.1,uTop-uBottom),0.,1.);
  return .12+.70*h+.18*cellNoise(floor(p*25.));
}
float coverageAt(vec3 p){
  if(uReveal>=.9999)return 1.;
  if(uReveal<=.0001)return 0.;
  return smoothstep(fieldAt(p)-.14,fieldAt(p)+.14,uReveal*1.23);
}`;

export function createProjection(uniforms) {
  const shared={uReveal:uniforms.reveal,uBottom:uniforms.bottom,uTop:uniforms.top,uReduced:uniforms.reduced,uContour:uniforms.contour,uDischarge:uniforms.discharge};
  const inject=(shader,depth=false)=>{
    Object.assign(shader.uniforms,shared);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vProjectionWorld;');
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvProjectionWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+declarations);
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
      float coverage=uReduced>.5?uReveal:coverageAt(vProjectionWorld);
      if(coverage<.0001)discard;
      ${depth?'if(cellNoise(floor(vProjectionWorld*620.))>coverage)discard;':'if(uReduced<.5 && cellNoise(floor(vProjectionWorld*620.))>coverage)discard;'}
    `);
    if(!depth)shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      float energy=(1.-coverage)*uContour*(1.-uReduced);
      outgoingLight=mix(outgoingLight,vec3(.22,.65,.86),energy*.74);
      outgoingLight+=vec3(.12,.46,.68)*energy*.6;
      if(uReduced>.5)diffuseColor.a*=uReveal;
      #include <opaque_fragment>`);
  };
  const edgeMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:shared,
    vertexShader:'varying vec3 vProjectionWorld;void main(){vProjectionWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vProjectionWorld,1.);}',
    fragmentShader:declarations+`void main(){
      float field=fieldAt(vProjectionWorld);
      float lead=smoothstep(field-.28,field-.08,uReveal*1.23);
      float solid=coverageAt(vProjectionWorld);
      float alpha=lead*(1.-solid)*uContour*(1.-uReduced)*.62;
      gl_FragColor=vec4(.26,.67,.87,alpha);
    }`,
  });
  const edgeCache=new Map(),edges=[];
  return {
    attach(mesh){
      const material=mesh.material;
      material.onBeforeCompile=shader=>inject(shader);
      material.customProgramCacheKey=()=> 'meshlab-projection-v4';
      material.transparent=uniforms.reduced.value>.5;
      material.needsUpdate=true;
      const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});
      depth.onBeforeCompile=shader=>inject(shader,true);
      depth.customProgramCacheKey=()=> 'meshlab-projection-depth-v4';
      mesh.customDepthMaterial=depth;
      let geometry=edgeCache.get(mesh.geometry);
      if(!geometry){geometry=new THREE.EdgesGeometry(mesh.geometry,32);edgeCache.set(mesh.geometry,geometry);}
      const edge=new THREE.LineSegments(geometry,edgeMaterial);
      edge.raycast=()=>{};
      edge.visible=false;
      mesh.add(edge);edges.push(edge);
    },
    update(){for(const edge of edges)edge.visible=uniforms.contour.value>.001&&uniforms.reduced.value<.5;},
  };
}

export function createBeam() {
  const uniforms={uPower:{value:0},uLight:{value:.45},uLift:{value:0},uActivity:{value:0},uTime:{value:0},uBaseRadius:{value:.43},uTopRadius:{value:1.5},uHeight:{value:3}};
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms,
    vertexShader:`varying vec2 vUv;uniform float uBaseRadius,uTopRadius,uHeight;
      void main(){vUv=uv;vec3 p=position;p.xz*=mix(uBaseRadius,uTopRadius,uv.y);p.y=uv.y*uHeight;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:`varying vec2 vUv;uniform float uPower,uLight,uLift,uActivity,uTime;
      void main(){
        float reach=1.-smoothstep(uLift-.05,uLift+.06,vUv.y);
        float fade=pow(1.-vUv.y,1.65)*smoothstep(0.,.035,vUv.y);
        float rays=pow(.5+.5*cos(vUv.x*75.398),24.);
        float front=exp(-pow((vUv.y-uLift)/.075,2.))*uActivity*(1.-smoothstep(.84,1.,uLift));
        float flow=pow(.5+.5*cos(vUv.y*26.-uTime*7.),12.)*uActivity;
        float alpha=(fade*(.055+rays*.085+flow*.05)*reach+front*.13)*uPower*uLight;
        gl_FragColor=vec4(.22,.62,.86,alpha);
      }`,
  });
  return new THREE.Mesh(new THREE.CylinderGeometry(1,1,1,64,32,true),material);
}
