import * as THREE from 'three';

const TAU=Math.PI*2,alpha=Math.PI/9,inv=a=>Math.tan(a)-a;
export function gearPoints(teeth,module,internal=false){
  if(!Number.isInteger(teeth)||teeth<6||teeth>400||!(module>0))throw new Error('无效齿轮尺寸');
  const R=teeth*module/2,base=R*Math.cos(alpha),root=internal?R+1.25*module:Math.max(module*.5,R-1.25*module),tip=internal?R-module:R+module;
  const half=r=>Math.PI/(2*teeth)+(internal?1:-1)*(inv(Math.acos(Math.min(1,base/r)))-inv(alpha));
  const points=[],add=(r,a)=>points.push([r*Math.cos(a),r*Math.sin(a)]),pitch=TAU/teeth;
  for(let k=0;k<teeth;k++){
    const a=k*pitch,h0=half(Math.max(base,root)),h1=half(Math.max(base,tip));
    add(root,a-h0);
    for(let j=0;j<=10;j++){const r=root+(tip-root)*j/10;add(r,a-half(Math.max(base,r)));}
    for(let j=1;j<=3;j++)add(tip,a-h1+2*h1*j/3);
    for(let j=9;j>=0;j--){const r=root+(tip-root)*j/10;add(r,a+half(Math.max(base,r)));}
    for(let j=1;j<4;j++)add(root,a+h0+(pitch-2*h0)*j/4);
  }
  return points.filter((p,i)=>!i||Math.hypot(p[0]-points[i-1][0],p[1]-points[i-1][1])>1e-7);
}
function polygon(points,depth,holes=[]){
  const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(...p)));
  for(const h of holes)shape.holes.push(new THREE.Path(h.map(p=>new THREE.Vector2(...p))));
  const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:64});geo.translate(0,0,-depth/2);return geo;
}
const circle=r=>Array.from({length:96},(_,i)=>[r*Math.cos(TAU*i/96),r*Math.sin(TAU*i/96)]);
export function geometryFor(s){
  let g;
  switch(s.kind){
    case 'box':g=new THREE.BoxGeometry(...s.size);break;
    case 'cylinder':g=new THREE.CylinderGeometry(s.radiusTop??s.radius,s.radiusBottom??s.radius,s.length,s.segments||64);g.rotateX(Math.PI/2);break;
    case 'sphere':g=new THREE.SphereGeometry(s.radius,20,12);break;
    case 'torus':g=new THREE.TorusGeometry(s.radius,s.tube,12,96);break;
    case 'ring':g=polygon(circle(s.outer),s.length,[circle(s.inner)]);break;
    case 'polygon':g=polygon(s.points,s.depth,s.holes||[]);break;
    case 'gear':{
      const outline=gearPoints(s.teeth,s.module,!!s.internal);
      g=s.internal?polygon(circle(s.outer??(s.teeth*s.module/2+3*s.module)),s.width,[outline]):polygon(outline,s.width,(s.hole??4)>0?[circle(s.hole??4)]:[]);break;
    }
    case 'rod':{
      const a=new THREE.Vector3(...s.from),b=new THREE.Vector3(...s.to),d=b.clone().sub(a);
      g=new THREE.CylinderGeometry(s.radius,s.radius,d.length(),16);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));g.translate(...a.add(b).multiplyScalar(.5).toArray());break;
    }
    case 'tube':{
      const points=s.points.map(p=>new THREE.Vector3(...p));
      const path=new THREE.CatmullRomCurve3(points,!!s.closed,'centripetal');
      g=new THREE.TubeGeometry(path,Math.min(640,Math.max(24,points.length*4)),s.radius,10,!!s.closed);break;
    }
    case 'mesh':g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(s.vertices,3));g.setIndex(s.indices);g.computeVertexNormals();break;
    default:throw new Error('不支持的模型几何：'+s.kind);
  }
  return g;
}
export function shapeMesh(s){
  const mat=new THREE.MeshStandardMaterial({color:s.color??0xa4b0bd,metalness:.58,roughness:.36,side:THREE.DoubleSide,transparent:s.opacity<1,opacity:s.opacity??1,wireframe:!!s.wireframe});
  const mesh=new THREE.Mesh(geometryFor(s),mat);mesh.position.set(...(s.position||[0,0,0]));mesh.rotation.set(...(s.rotation||[0,0,0]));return mesh;
}
