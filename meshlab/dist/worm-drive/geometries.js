import * as THREE from 'three';
import {geometry,wormResults,TAU} from './kinematics.js';

// Continuous right-hand helical rib, with a trapezoidal axial section.
// This is teaching geometry, not a tool-generated manufacturing tooth surface.
export function threadGeometry(parameters,index){
  const {lead,axialPitch,wormDiameter}=wormResults(parameters),length=geometry.threadLength;
  const root=wormDiameter/2-1.25*geometry.module,tip=wormDiameter/2+geometry.module;
  const steps=Math.ceil(length/lead*80),positions=[],indices=[];
  for(let j=0;j<=steps;j++){
    const x=-length/2+j/steps*length,a=TAU*x/lead+Math.PI+TAU*index/parameters.starts;
    for(const [offset,r] of [[-.29*axialPitch,root],[-.12*axialPitch,tip],[.12*axialPitch,tip],[.29*axialPitch,root]])positions.push(x+offset,r*Math.cos(a),r*Math.sin(a));
  }
  for(let j=0;j<steps;j++)for(let k=0;k<4;k++){
    const a=j*4+k,b=j*4+(k+1)%4,c=a+4,d=b+4;indices.push(a,c,b,b,c,d);
  }
  indices.push(0,1,2,0,2,3);const end=steps*4;indices.push(end,end+2,end+1,end,end+3,end+2);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

// A throated wheel, with axial tooth skew matching the worm's lead at the pitch
// point. Both the concave face and skew change with the selected geometry.
export function wheelGeometry(parameters){
  const {wheelDiameter,wormDiameter}=wormResults(parameters),radius=wheelDiameter/2,wr=wormDiameter/2;
  const m=geometry.module,width=geometry.faceWidth,rows=17,N=parameters.wheelTeeth*7,bore=9;
  const positions=[],indices=[];
  const fractions=[[-.5,-1.25],[-.31,-1.25],[-.23,0],[-.12,1],[.12,1],[.23,0],[.31,-1.25]];
  for(let row=0;row<rows;row++){
    const z=-width/2+width*row/(rows-1),throat=wr-Math.sqrt(wr*wr-z*z),twist=parameters.starts/parameters.wheelTeeth*Math.asin(z/wr);
    for(let t=0;t<parameters.wheelTeeth;t++)for(const [f,h] of fractions){
      const a=TAU*(t+f+.5)/parameters.wheelTeeth+twist,r=radius+throat+h*m;
      positions.push(-r*Math.sin(a),r*Math.cos(a),z);
    }
  }
  for(let j=0;j<rows-1;j++)for(let i=0;i<N;i++){
    const a=j*N+i,b=j*N+(i+1)%N;indices.push(a,b,a+N,b,b+N,a+N);
  }
  for(const [row,sign] of [[0,-1],[rows-1,1]]){
    const base=positions.length/3,z=sign*width/2,twist=parameters.starts/parameters.wheelTeeth*Math.asin(z/wr);
    for(let t=0;t<parameters.wheelTeeth;t++)for(const [f] of fractions){const a=TAU*(t+f+.5)/parameters.wheelTeeth+twist;positions.push(-bore*Math.sin(a),bore*Math.cos(a),z);}
    for(let i=0;i<N;i++){
      const next=(i+1)%N,a=row*N+i,b=row*N+next,c=base+i,d=base+next;
      if(sign>0)indices.push(a,b,c,b,d,c);else indices.push(a,c,b,b,c,d);
    }
  }
  const inner0=rows*N,inner1=(rows+1)*N;
  for(let i=0;i<N;i++){const j=(i+1)%N;indices.push(inner0+i,inner1+i,inner0+j,inner0+j,inner1+i,inner1+j);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
