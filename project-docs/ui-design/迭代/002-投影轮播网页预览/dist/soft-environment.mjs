import * as THREE from '/shared/assets/three.module.js';

// A seamless, matte cyclorama. Its curvature and broad lighting give depth without
// introducing another object, an engineering grid, or a sharp horizon behind the model.
export function createSoftEnvironment(scene){
  const group=new THREE.Group();group.name='soft-studio-environment';scene.add(group);
  const profile=[[75,-.34],[20,-.34],[4,-.34],[-6,-.34],[-12,-.34]];
  const radius=14;
  for(let i=1;i<=56;i++){
    const a=i/56*Math.PI/2;
    profile.push([-12-radius*Math.sin(a),-.34+radius*(1-Math.cos(a))]);
  }
  profile.push([-26,40],[-26,70]);
  const positions=[],uvs=[],indices=[],columns=24;
  for(let row=0;row<profile.length;row++){
    const [z,y]=profile[row];
    for(let column=0;column<=columns;column++){
      positions.push((column/columns-.5)*150,y,z);
      uvs.push(column/columns,row/(profile.length-1));
      if(row<profile.length-1&&column<columns){
        const a=row*(columns+1)+column,b=a+1,c=a+columns+1,d=c+1;
        indices.push(a,b,c,b,d,c);
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({color:0x080e15,metalness:.03,roughness:.93,transparent:true,depthWrite:false});
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vEnvironmentWorld;varying vec4 vEnvironmentClip;');
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
      vEnvironmentWorld=(modelMatrix*vec4(transformed,1.)).xyz;
      vEnvironmentClip=projectionMatrix*viewMatrix*vec4(vEnvironmentWorld,1.);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vEnvironmentWorld;varying vec4 vEnvironmentClip;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 p=vEnvironmentWorld;
      float leftWash=exp(-pow((p.x+13.)/22.,2.)-pow((p.z+17.)/24.,2.)-pow((p.y-4.)/17.,2.));
      float farWash=exp(-pow((p.x-20.)/31.,2.)-pow((p.z+28.)/25.,2.)-pow((p.y-7.)/24.,2.));
      float pool=exp(-pow(p.x/6.8,2.)-pow((p.z+1.)/9.5,2.))*(1.-smoothstep(.2,2.,p.y));
      float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5;
      diffuseColor.rgb+=leftWash*vec3(.0028,.0036,.0045)+farWash*vec3(.0012,.0020,.0032)+pool*vec3(.0014,.0020,.0025);
      diffuseColor.rgb+=grain*.00009;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      vec2 screen=vEnvironmentClip.xy/vEnvironmentClip.w*.5+.5;
      float edge=smoothstep(0.,.16,screen.y)*(1.-smoothstep(.76,1.,screen.y));
      edge*=smoothstep(0.,.10,screen.x)*(1.-smoothstep(.90,1.,screen.x));
      diffuseColor.a*=edge*.76;
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=> 'meshlab-soft-environment-v8';
  const backdrop=new THREE.Mesh(geometry,material);
  backdrop.renderOrder=-10;backdrop.castShadow=false;backdrop.receiveShadow=false;
  group.add(backdrop);
  return group;
}
