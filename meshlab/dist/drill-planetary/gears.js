import * as THREE from 'three';

// Straight-sided tooth approximation for teaching, not a manufacturing profile.
// Extrusion is centred on X. Tooth phase zero points along +Y.
function toothOutline(count,pitch,internal){
  const root=pitch+(internal?2.5:-2.5),tip=pitch+(internal?-2:2),points=[];
  for(let i=0;i<count;i++)for(const [fraction,r] of [[-.5,root],[-.32,root],[-.22,pitch],[-.13,tip],[.13,tip],[.22,pitch],[.32,root],[.5,root]]){
    const a=(i+fraction)*Math.PI*2/count;points.push(new THREE.Vector2(-Math.sin(a)*r,Math.cos(a)*r));
  }
  return points;
}
export function gearGeometry({count,radius,width=28,internal=false,bore=5,outer=62}){
  let shape;
  if(internal){shape=new THREE.Shape();shape.absarc(0,0,outer,0,Math.PI*2,false);shape.holes.push(new THREE.Path(toothOutline(count,radius,true).reverse()));}
  else {shape=new THREE.Shape(toothOutline(count,radius,false));const hole=new THREE.Path();hole.absarc(0,0,bore,0,Math.PI*2,true);shape.holes.push(hole);}
  const g=new THREE.ExtrudeGeometry(shape,{depth:width,bevelEnabled:true,bevelSize:.22,bevelThickness:.22,bevelSegments:1,steps:1,curveSegments:80});
  g.translate(0,0,-width/2);g.rotateY(Math.PI/2);g.computeVertexNormals();return g;
}
