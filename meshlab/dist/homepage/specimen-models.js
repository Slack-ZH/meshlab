import * as THREE from '../assets/three.module.js';
const blue = new THREE.MeshStandardMaterial({color:'#5597ca', metalness:.62, roughness:.27});
const steel = new THREE.MeshStandardMaterial({color:'#b3c6d7', metalness:.64, roughness:.27});
const silver = new THREE.MeshStandardMaterial({color:'#a9bed2', metalness:.56, roughness:.3});
const dark = new THREE.MeshStandardMaterial({color:'#253b51', metalness:.25, roughness:.42});

function mesh(group, geometry, material, x=0, y=0, z=0) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(x,y,z);
  group.add(item);
  return item;
}
function disc(group, radius, depth, x, y, z, material=steel) {
  const item = mesh(group, new THREE.CylinderGeometry(radius,radius,depth,96),material,x,y,z);
  item.rotation.x = Math.PI/2;
  return item;
}
function ring(group, outer, inner, depth, x, y, z, material) {
  const outline = new THREE.Shape(); outline.absarc(0,0,outer,0,Math.PI*2,false);
  const hole = new THREE.Path(); hole.absarc(0,0,inner,0,Math.PI*2,true); outline.holes.push(hole);
  return mesh(group,new THREE.ExtrudeGeometry(outline,{depth,bevelEnabled:true,bevelSize:.6,bevelThickness:.6,bevelSegments:2,steps:1,curveSegments:96}),material,x,y,z-depth/2);
}
function gear(group, radius, teeth, depth, x, y, z, material=blue) {
  const outline = new THREE.Shape();
  for(let i=0;i<teeth*4;i++) {
    const angle = i/(teeth*4)*Math.PI*2;
    const r = (i%4===1||i%4===2) ? radius : radius-3;
    const px=Math.cos(angle)*r, py=Math.sin(angle)*r;
    if(i===0) outline.moveTo(px,py); else outline.lineTo(px,py);
  }
  outline.closePath();
  const hole=new THREE.Path(); hole.absarc(0,0,radius*.19,0,Math.PI*2,true); outline.holes.push(hole);
  mesh(group,new THREE.ExtrudeGeometry(outline,{depth,bevelEnabled:true,bevelSize:.6,bevelThickness:.6,bevelSegments:2,steps:1}),material,x,y,z-depth/2);
  ring(group,radius*.38,radius*.2,depth+3,x,y,z,silver);
}
function roundedPath(width,height,radius) {
  const shape=new THREE.Shape(), x=-width/2, y=-height/2;
  shape.moveTo(x+radius,y); shape.lineTo(x+width-radius,y);
  shape.absarc(x+width-radius,y+radius,radius,-Math.PI/2,0,false);
  shape.lineTo(x+width,y+height-radius);
  shape.absarc(x+width-radius,y+height-radius,radius,0,Math.PI/2,false);
  shape.lineTo(x+radius,y+height);
  shape.absarc(x+radius,y+height-radius,radius,Math.PI/2,Math.PI,false);
  shape.lineTo(x,y+radius); shape.absarc(x+radius,y+radius,radius,Math.PI,Math.PI*1.5,false);
  return shape;
}
function makeBelt() {
  const group=new THREE.Group();
  for(const x of [-62,62]) {
    disc(group,34,17,x,0,0,dark);
    disc(group,36,3,x,0,-10,silver); disc(group,36,3,x,0,10,blue);
    disc(group,19,8,x,0,16,steel); disc(group,7,48,x,0,0,silver);
    for(let n=0;n<6;n++) {const a=n*Math.PI/3;disc(group,3,2,x+Math.cos(a)*26,Math.sin(a)*26,12,dark);}
  }
  const shape=roundedPath(194,70,35),hole=roundedPath(188,64,32);
  shape.holes.push(hole);
  mesh(group,new THREE.ExtrudeGeometry(shape,{depth:12,bevelEnabled:false,curveSegments:64}),dark,0,0,-6);
  return group;
}
function makeCrank() {
  const group=new THREE.Group();
  disc(group,33,15,-57,12,0,blue); disc(group,9,32,-57,12,0,steel);
  disc(group,5,12,-43,35,15,silver);
  const start=new THREE.Vector3(-43,35,16),end=new THREE.Vector3(74,5,16),delta=end.clone().sub(start);
  const rod=mesh(group,new THREE.BoxGeometry(delta.length(),9,8),steel,...start.clone().add(end).multiplyScalar(.5).toArray());
  rod.rotation.z=Math.atan2(delta.y,delta.x);
  mesh(group,new THREE.BoxGeometry(35,31,28),blue,74,5,5);
  for(const y of [-17,27]) mesh(group,new THREE.BoxGeometry(180,4,5),silver,26,y,-3);
  disc(group,5,3,74,5,21,silver);
  mesh(group,new THREE.BoxGeometry(205,9,12),dark,10,-29,-8);
  return group;
}
function makePlanetary() {
  const group=new THREE.Group();
  ring(group,75,64,16,0,0,0,steel);
  for(let n=0;n<48;n++) {
    const a=n*Math.PI/24;
    const tooth=mesh(group,new THREE.BoxGeometry(5,4,14),steel,Math.cos(a)*63,Math.sin(a)*63,0); tooth.rotation.z=a;
  }
  gear(group,24,18,15,0,0,0,blue);
  for(let n=0;n<3;n++) {const a=n*Math.PI*2/3;gear(group,21,15,15,Math.cos(a)*43,Math.sin(a)*43,0,silver);}
  return group;
}
function makeRack() {
  const group=new THREE.Group();
  gear(group,36,22,17,0,26,0,blue);
  mesh(group,new THREE.BoxGeometry(180,15,20),steel,0,-19,0);
  for(let i=0;i<18;i++) mesh(group,new THREE.BoxGeometry(5,8,20),silver,-85+i*10,-8,0);
  disc(group,7,40,0,26,0,dark);
  mesh(group,new THREE.BoxGeometry(190,5,30),dark,0,-31,-5);
  return group;
}
const model=await (await fetch('assets/model.json')).json();
const geometries=new Map();
async function realModel(mode) {
  const group=new THREE.Group();
  const parts=mode==='gear' ? model.parts.filter(p=>['input','middle','gear1','output','gear2'].includes(p.id)) : model.parts.filter(p=>!p.id.startsWith('bolt')&&!p.id.startsWith('nut')&&!['inspection','breather'].includes(p.id));
  await Promise.all(parts.map(async part=>{
    if(mode==='assembly'&&part.id==='housing_top')return;
    let geometry=geometries.get(part.id);
    if(!geometry) {
      const buffer=await (await fetch('assets/'+part.id+'.mesh')).arrayBuffer();
      const header=new DataView(buffer),vertices=header.getUint32(0,true),indices=header.getUint32(4,true);
      geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(buffer,8,vertices*3),3));
      geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer,8+vertices*12,indices),1));
      geometry.computeVertexNormals(); geometries.set(part.id,geometry);
    }
    const material=part.category==='gear'?blue:part.category==='housing'?silver:steel;
    const item=mesh(group,geometry,material,...part.position);
    if(mode==='exploded')item.position.addScaledVector(new THREE.Vector3(...part.explode),.48);
  }));
  return group;
}

export async function createSpecimen(index) {return index===0?realModel("gear"):[null,makeBelt,makeCrank,makePlanetary,makeRack][index]();}
