export const fields={lead:['导程 / 单线螺距','mm',2,8,.5],screwDiameter:['丝杠外径','mm',20,36,1],jawWidth:['钳口宽度','mm',40,120,1],maxOpening:['最大开口','mm',20,140,1],inputRPM:['输入转速','r/min',0,90,1],inputTorque:['输入转矩','N·m',0,20,.1],efficiency:['运行效率','—',.1,.6,.01]};
export const defaults=Object.freeze({lead:4,screwDiameter:24,jawWidth:80,maxOpening:100,inputRPM:30,inputTorque:5,efficiency:.35,direction:1});
export const ANIMATION_SCALE=.2,THREAD_ANGLE=30,ANGULAR_SEGMENTS=96;
export const assumptions='单线右旋30°梯形丝杠台虎钳教学模型，导程等于螺距。固定螺母限制丝杠旋转与轴向移动的关系，丝杠被活动钳口轴向捕获，活动钳口由导轨限制转动。内外螺纹采用共享螺旋相位及教学径向间隙，不是制造认证螺纹；不给出自锁、强度或实际夹紧力判断。';
export function validate(p){for(const [key,[name,unit,min,max]] of Object.entries(fields))if(!Number.isFinite(p[key])||p[key]<min||p[key]>max)throw new RangeError(`${name}须在 ${min}–${max} ${unit} 范围内`);if(p.direction!==1&&p.direction!==-1)throw new RangeError('方向须为 +1 张开或 -1 闭合');return p;}
export function geometry(p){
  validate(p);const lead=p.lead,screwRadius=p.screwDiameter/2,threadHeight=.45*lead,rootRadius=screwRadius-threadHeight,clearance=.04*lead+.06;
  const nutLength=Math.max(4*lead,1.2*p.screwDiameter),nutStart=-nutLength-lead-6,nutEnd=-lead-6,threadStart=-p.maxOpening-nutLength-2*lead-6,threadEnd=-1;
  const jawDepth=16+.25*p.screwDiameter,padThickness=3,padHeight=Math.max(16,p.jawWidth*.28),jawBase=-screwRadius*.75,padCenter=screwRadius+14+padHeight/2,jawTop=padCenter+padHeight/2;
  const guideClearRadius=Math.hypot(Math.abs(jawBase-13)-4,p.jawWidth*.25-4.5),handleLength=2*Math.min(Math.max(45,p.jawWidth*.85)/2,guideClearRadius-6);
  return {lead,pitch:lead,starts:1,screwRadius,rootRadius,threadHeight,clearance,threadStart,threadEnd,threadedLength:threadEnd-threadStart,nutLength,nutStart,nutEnd,nutOuterRadius:screwRadius+Math.max(5,.25*p.screwDiameter),handleLength,guideClearRadius,
    jawWidth:p.jawWidth,maxOpening:p.maxOpening,midOpening:p.maxOpening/2,jawDepth,padThickness,padHeight,padCenter,jawBase,jawTop,
    journalRadius:rootRadius*.72,journalEnd:padThickness+jawDepth+22,bodyBack:nutStart-10,guideY:jawBase-8,guideLength:p.maxOpening+jawDepth-nutStart+20,
    crestHalf:(lead/2-threadHeight*Math.tan(Math.PI/12))/2,rootHalf:(lead/2+threadHeight*Math.tan(Math.PI/12))/2};
}
const mod=(x,n)=>(x%n+n)%n;
export function threadRadius(g,x,theta,phaseOffset=0){const u=Math.abs(mod(x-g.lead*theta/(2*Math.PI)+phaseOffset+g.lead/2,g.lead)-g.lead/2);return u<=g.crestHalf?g.screwRadius:u>=g.rootHalf?g.rootRadius:g.screwRadius-(u-g.crestHalf)/Math.tan(Math.PI/12);}
function clipX(poly,value,greater){
  const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ia=greater?a[0]>=value-1e-9:a[0]<=value+1e-9,ib=greater?b[0]>=value-1e-9:b[0]<=value+1e-9;if(ia)out.push(a);if(ia!==ib){const t=(value-a[0])/(b[0]-a[0]);out.push(a.map((v,j)=>v+t*(b[j]-v)));}}return out;
}
// A closed helical solid (screw), or an annular solid with a real helical bore
// (nut). Every trapezoid break follows the helix; no uniform-grid tooth aliasing.
export function threadMeshData(g,{kind='screw',half=false}={}){
  const nut=kind==='nut',start=nut?g.nutStart:g.threadStart,end=nut?g.nutEnd:g.threadEnd,phase=nut?0:g.midOpening,extra=nut?g.clearance:0,outer=g.nutOuterRadius;
  const minTheta=half?Math.PI:0,maxTheta=2*Math.PI,segments=half?ANGULAR_SEGMENTS/2:ANGULAR_SEGMENTS,vertices=[],indices=[],endPoints=[[],[]];
  const add=(a,b,c)=>{const ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]),area=Math.hypot(ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]);if(area<1e-9)return;const n=vertices.length/3;vertices.push(...a,...b,...c);indices.push(n,n+1,n+2);};
  const point=(x,r,t)=>[x,r*Math.cos(t),r*Math.sin(t)];
  const offsets=[-g.lead/2,-g.rootHalf,-g.crestHalf,g.crestHalf,g.rootHalf,g.lead/2],radii=[g.rootRadius,g.rootRadius,g.screwRadius,g.screwRadius,g.rootRadius,g.rootRadius].map(r=>r+extra);
  const nMin=Math.floor((start+phase)/g.lead)-2,nMax=Math.ceil((end+phase)/g.lead)+1;
  for(let n=nMin;n<=nMax;n++)for(let j=0;j<segments;j++){
    const a=minTheta+(maxTheta-minTheta)*j/segments,b=minTheta+(maxTheta-minTheta)*(j+1)/segments;
    for(let k=0;k<offsets.length-1;k++){
      const quad=[point(n*g.lead+g.lead*a/(2*Math.PI)+offsets[k]-phase,radii[k],a),point(n*g.lead+g.lead*b/(2*Math.PI)+offsets[k]-phase,radii[k],b),point(n*g.lead+g.lead*b/(2*Math.PI)+offsets[k+1]-phase,radii[k+1],b),point(n*g.lead+g.lead*a/(2*Math.PI)+offsets[k+1]-phase,radii[k+1],a)];
      const poly=clipX(clipX(quad,start,true),end,false);if(poly.length<3)continue;
      for(const v of poly){if(Math.abs(v[0]-start)<1e-7)endPoints[0].push(v);if(Math.abs(v[0]-end)<1e-7)endPoints[1].push(v);}
      for(let k=1;k<poly.length-1;k++)nut?add(poly[0],poly[k+1],poly[k]):add(poly[0],poly[k],poly[k+1]);
    }
  }
  for(const [side,x] of [start,end].entries()){
    const angle=v=>{let a=Math.atan2(v[2],v[1]);if(a<minTheta-1e-8)a+=2*Math.PI;return a;};
    const unique=new Map();for(const v of endPoints[side])unique.set(angle(v).toFixed(9),v);const ring=[...unique.values()].sort((a,b)=>angle(a)-angle(b));
    const count=half?ring.length-1:ring.length;
    for(let j=0;j<count;j++){const a=ring[j],b=ring[(j+1)%ring.length];if(nut){const ao=point(x,outer,angle(a)),bo=point(x,outer,angle(b));if(side){add(a,bo,b);add(a,ao,bo);}else{add(a,b,bo);add(a,bo,ao);}}else side?add([x,0,0],a,b):add([x,0,0],b,a);}
  }
  if(nut){
    for(let j=0;j<segments;j++){const a=minTheta+(maxTheta-minTheta)*j/segments,b=minTheta+(maxTheta-minTheta)*(j+1)/segments,A=point(start,outer,a),B=point(start,outer,b),C=point(end,outer,b),D=point(end,outer,a);add(A,B,C);add(A,C,D);}
    if(half)for(const theta of [minTheta,maxTheta]){
      const xs=[start,end];for(let n=nMin;n<=nMax;n++)for(const off of offsets){const x=n*g.lead+g.lead*theta/(2*Math.PI)+off;if(x>start&&x<end)xs.push(x);}xs.sort((a,b)=>a-b);
      for(let j=0;j<xs.length-1;j++){const x=xs[j],y=xs[j+1],A=point(x,threadRadius(g,x,theta)+extra,theta),B=point(y,threadRadius(g,y,theta)+extra,theta),C=point(y,outer,theta),D=point(x,outer,theta);if(theta===minTheta){add(A,C,B);add(A,D,C);}else{add(A,B,C);add(A,C,D);}}
    }
  }
  return {vertices,indices,kind,half,start,end};
}
export function estimate(p){const g=geometry(p),inputPower=p.inputTorque*p.inputRPM*Math.PI/30,linearSpeed=p.direction*p.lead*p.inputRPM/60;return {lead:p.lead,pitch:p.lead,starts:1,direction:p.direction,inputRPM:p.inputRPM,inputTorque:p.inputTorque,advancePerTurn:p.direction*p.lead,linearSpeed:linearSpeed===0?0:linearSpeed,thrust:p.inputRPM>0?2*Math.PI*p.efficiency*p.inputTorque/(p.lead/1000):null,inputPower,outputPower:p.efficiency*inputPower,efficiency:p.efficiency,geometry:g,warning:p.inputRPM===0?'输入转速为0，运行推力不求解；不能据此判断静态夹紧力。':''};}
export function motion(p,elapsedSeconds,speed=1,initialOpening=p.maxOpening/2){validate(p);if(!Number.isFinite(elapsedSeconds)||elapsedSeconds<0||!Number.isFinite(speed)||speed<0||!Number.isFinite(initialOpening))throw new RangeError('无效演示状态');const opening=Math.max(0,Math.min(p.maxOpening,initialOpening+p.direction*p.lead*p.inputRPM/60*elapsedSeconds*speed*ANIMATION_SCALE)),displacement=opening-p.maxOpening/2,screwTurns=displacement/p.lead,limit=opening<=1e-9?'closed':opening>=p.maxOpening-1e-9?'open':null;return {jawOpening:opening,displacement,screwTurns,screwAngle:screwTurns*2*Math.PI,direction:p.direction,atLimit:limit!==null,limit};}
