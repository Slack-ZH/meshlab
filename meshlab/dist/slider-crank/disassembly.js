export const disassemblySteps=['退出曲柄销与端帽','沿缸轴提出活塞连杆总成','退出主轴端帽','沿主轴取出曲柄'];
export function sliderDisassemblyEntries({crank,rod,piston,crankPin,crankCap,dragRing,mainCap,casing,flywheel,fixedParts,getDimensions}){
  const lift=()=>{const {radius,rodLength}=getDimensions();return [0,rodLength+2*radius+90,0];};
  return [
    {object:crank,path:[{step:3,offset:[0,0,120]}]},
    ...[rod,piston].map(object=>({object,path:[{step:1,offset:lift}]})),
    {object:crankPin,path:[{step:0,offset:[0,0,240]}]},
    ...[crankCap,dragRing].map(object=>({object,path:[{step:0,offset:[0,0,300]}]})),
    {object:mainCap,path:[{step:2,offset:[0,0,200]}]},
    ...[casing,flywheel,...fixedParts].map(object=>({object,offset:[0,0,0]})),
  ];
}
// Actual axial holes are required before a transverse pin can be withdrawn.
export function linkGeometry(THREE,length,part){
  const root=part==='crank'?18:8,tip=part==='crank'?8.5:8,shape=new THREE.Shape();
  shape.moveTo(0,root);shape.lineTo(length,tip);shape.absarc(length,0,tip,Math.PI/2,-Math.PI/2,true);shape.lineTo(0,-root);shape.absarc(0,0,root,-Math.PI/2,-3*Math.PI/2,true);shape.closePath();
  for(const [x,r] of [[0,part==='crank'?13.3:5.3],[length,5.3]]){const hole=new THREE.Path();hole.absarc(x,0,r,0,2*Math.PI,true);shape.holes.push(hole);}
  const depth=part==='crank'?10:8,g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:48});g.translate(0,0,-depth/2);return g;
}
