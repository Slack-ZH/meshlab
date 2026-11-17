import * as THREE from '/shared/assets/three.module.js';

// A quiet architectural setting: ground marks nearby, a light pool at the emitter,
// and receding structural ribs. Everything is static and stays behind the mechanism.
export function createDepthEnvironment(scene){
  const group=new THREE.Group();group.name='layered-exhibition-ground';scene.add(group);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.ShaderMaterial({transparent:true,depthWrite:false,
    vertexShader:'varying vec3 vWorld;varying vec4 vClip;void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;vClip=projectionMatrix*viewMatrix*vec4(vWorld,1.);gl_Position=vClip;}',
    fragmentShader:`varying vec3 vWorld;varying vec4 vClip;
      float stroke(float d,float width){return 1.-smoothstep(width,width+max(fwidth(d)*1.3,.003),abs(d));}
      void main(){
        vec2 p=vWorld.xz;float r=length(p);float angle=atan(p.y,p.x);
        float distanceFade=1.-smoothstep(10.,68.,r);
        float seams=min(abs(mod(p.x+3.,6.)-3.),abs(mod(p.y+3.,6.)-3.));
        float grid=stroke(seams,.014)*smoothstep(3.8,6.5,r)*.14;
        float rings=stroke(r-3.5,.016)*.58+stroke(r-7.5,.022)*.33+stroke(r-14.,.03)*.22+stroke(r-25.,.035)*.15;
        rings*=smoothstep(.025,.10,abs(sin(angle*4.)));
        float ticks=stroke(sin(angle*32.),.035)*smoothstep(3.62,3.68,r)*(1.-smoothstep(3.88,3.94,r))*.35;
        float pool=exp(-r*r*.045);
        float center=1.-smoothstep(3.1,3.5,r);
        vec3 color=vec3(.025,.043,.062)+pool*vec3(.025,.042,.054)+center*vec3(.007,.009,.010);
        color+=(grid+rings+ticks)*vec3(.11,.19,.24);
        vec2 screen=vClip.xy/vClip.w*.5+.5;
        float edge=smoothstep(0.,.17,screen.y)*(1.-smoothstep(.90,1.,screen.y));
        edge*=smoothstep(0.,.045,screen.x)*(1.-smoothstep(.955,1.,screen.x));
        gl_FragColor=vec4(color,distanceFade*.86*edge);
      }`,
  }));ground.rotation.x=-Math.PI/2;ground.position.y=-.33;group.add(ground);

  const addBox=(w,h,d,x,y,z,material)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    mesh.position.set(x,y,z);mesh.castShadow=false;mesh.receiveShadow=false;group.add(mesh);return mesh;
  };
  for(let level=0;level<3;level++){
    const finish=new THREE.MeshStandardMaterial({color:new THREE.Color().setRGB(.012-level*.003,.023-level*.004,.034-level*.005),metalness:.38,roughness:.62});
    const light=new THREE.MeshBasicMaterial({color:0x567c94,transparent:true,opacity:.25-level*.06,depthWrite:false});
    const x=13+level*5.0,z=-23-level*12.0,h=3.2+level*.4;
    for(const side of [-1,1]){
      addBox(.14,h,.28,side*x,h/2-.25,z,finish);
      addBox(.025,h*.57,.025,side*(x-.10),h*.49,z+.19,light);
      addBox(5.4,.10,.28,side*(x+2.4),h-.25,z,finish);
      addBox(5.4,.12,.45,side*(x+2.4),-.24,z,finish);
    }
  }
  // Wide, broken rails behind the scene provide a horizon without drawing a box.
  for(const [radius,height,opacity] of [[18,1.1,.18],[29,3.0,.10]]){
    for(const side of [-1,1]){
      const points=[];
      for(let i=0;i<=64;i++){
        const a=.18+(Math.PI/2-.52)*i/64;
        points.push(new THREE.Vector3(side*Math.cos(a)*radius,height,-Math.sin(a)*radius));
      }
      const rail=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x6c98ad,transparent:true,opacity,depthWrite:false}));group.add(rail);
    }
  }
  return group;
}
