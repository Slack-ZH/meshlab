import fs from 'node:fs';
import {models} from '../dist/catalog/models-machines.mjs';
const url=new URL('../dist/assets/three.module.js',import.meta.url).href,THREE=await import(url);
const source=fs.readFileSync(new URL('../dist/catalog/geometry.mjs',import.meta.url),'utf8').replace("from 'three'",`from '${url}'`);
const {gearPoints,geometryFor}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function inside(p,poly){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
const m=models.find(m=>m.number===47);let bad=0,total=0;
for(const z of [40,60,80]){const p={inputRPM:30,flexTeeth:z},b=m.build(p),ring=b.parts.find(p=>p.id==='circular').shapes[0],outline=gearPoints(z+2,1,true),angle=ring.rotation?.[2]||0;for(let j=0;j<72;j++){const s=m.sample(p,j*Math.PI/36);for(let k=0;k<z;k++){const part=b.parts.find(p=>p.id==='flex-tooth-'+k),shape=part.shapes[0],geom=geometryFor(shape),v=geom.attributes.position,t=s.poses[part.id];const mat=new THREE.Matrix4().compose(new THREE.Vector3(...t.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...t.rotation)),new THREE.Vector3(...(t.scale||[1,1,1])));for(let q=0;q<v.count;q++){const a=new THREE.Vector3().fromBufferAttribute(v,q).applyMatrix4(mat),x=a.x*Math.cos(angle)+a.y*Math.sin(angle),y=-a.x*Math.sin(angle)+a.y*Math.cos(angle);total++;if(!inside([x,y],outline))bad++;}geom.dispose();}}}
console.log(JSON.stringify({productionVerticesTested:total,insideRigidGear:bad}));
