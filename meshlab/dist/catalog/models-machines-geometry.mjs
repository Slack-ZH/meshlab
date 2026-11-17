// Pure construction/kinematics helpers for catalog items 36–48.
export const TAU=Math.PI*2, rad=d=>d*Math.PI/180, mod=(x,n=TAU)=>(x%n+n)%n;
export const colors={input:0xd39c50,output:0x769fba,steel:0xaab6c2,brass:0xc7b172,dark:0x536777,active:0xe0b55f,case:0x80938e};
export const field=(key,label,unit,min,max,step,value)=>({key,label,unit,min,max,step,value});
export const choice=(key,label,value,options)=>({key,label,value,options});
export const metric=(label,value,unit='')=>({label,value,unit});
export const rot=(x,y,a)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
export const pose=(rotation=[0,0,0],position)=>({...position&&{position},rotation});
export const part=(id,name,shapes,position=[0,0,0],description='',extra={})=>({id,name,description:description||name,category:'transmission',position,shapes,...extra});
export const cylinder=(radius,length,color=colors.steel,position=[0,0,0],extra={})=>({kind:'cylinder',radius,length,color,position,...extra});
export const ring=(outer,inner,length,color=colors.steel,position=[0,0,0],extra={})=>({kind:'ring',outer,inner,length,color,position,...extra});
export const box=(size,color=colors.steel,position=[0,0,0],extra={})=>({kind:'box',size,color,position,...extra});
export const rod=(from,to,radius=3,color=colors.steel)=>({kind:'rod',from,to,radius,color});
export const circle=(r,n=80,c=[0,0])=>Array.from({length:n},(_,i)=>[c[0]+r*Math.cos(TAU*i/n),c[1]+r*Math.sin(TAU*i/n)]);
export const gear=(teeth,module,width,color=colors.steel,extra={})=>({kind:'gear',teeth,module,width,hole:5,color,...extra});
export const shaft=(id,name,radius,length,color=colors.steel,position=[0,0,0])=>part(id,name,[cylinder(radius,length,color),box([radius*1.4,2,8],colors.active,[0,radius,length/2-5])],position);
export function validateFields(fields,p){
 for(const f of fields){const v=p[f.key];if(f.options){if(!f.options.some(o=>o[0]===v))throw Error(`${f.label}选项无效`);}else{if(typeof v!=='number'||!Number.isFinite(v)||v<f.min-1e-9||v>f.max+1e-9)throw Error(`${f.label}须在 ${f.min}–${f.max} ${f.unit||''}之间`);if(f.step>=1&&Number.isInteger(f.step)&&!Number.isInteger(v))throw Error(`${f.label}须为整数`);}}
 if(p.inputRPM!==undefined&&(!Number.isFinite(p.inputRPM)||p.inputRPM<0||p.inputRPM>120))throw Error('输入转速须在 0–120 r/min 之间');
}
export const rpm=p=>p.inputRPM??30;
export const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export const smooth5=x=>{x=Math.max(0,Math.min(1,x));return x*x*x*(10+x*(-15+6*x));};
export const smooth5Derivative=x=>x<=0||x>=1?0:30*x*x*(1-x)*(1-x);
export function flatCam(law,base=42,side=1,n=720){
 // h is the support function; contact in world coordinates is (h',h).
 return Array.from({length:n},(_,i)=>{const a=TAU*i/n,{s,ds}=law(a);return rot(side*ds,side*(base+s),-a);});
}
export function valveLift(theta,lift,exhaust=false){
 const crank=mod(-2*theta,2*TAU),start=exhaust?3*Math.PI:0,u=crank-start;
 return u>=0&&u<=Math.PI?{s:lift*Math.sin(u)**2,ds:-2*lift*Math.sin(2*u)}:{s:0,ds:0};
}
export function conjugateLift(theta,stroke){return {s:stroke*(.65*Math.sin(theta)+.175*Math.sin(2*theta)),ds:stroke*(.65*Math.cos(theta)+.35*Math.cos(2*theta))};}
export function planetaryBuild(zs,zp,m=1.6,highlight='carrier'){
 const zr=zs+2*zp,C=m*(zs+zp)/2,R=m*zr/2,parts=[
  part('sun','太阳轮',[gear(zs,m,12,highlight==='sun'?colors.active:colors.input)]),
  part('ring','内齿圈',[gear(zr,m,12,highlight==='ring'?colors.active:colors.steel,{internal:true,hole:0})]),
  part('carrier','三臂行星架',[ring(C+5,C-1,4,colors.output,[0,0,13]),ring(10,5.3,8,colors.output,[0,0,13]),...Array.from({length:3},(_,k)=>rod([10*Math.cos(TAU*k/3),10*Math.sin(TAU*k/3),13],[C*Math.cos(TAU*k/3),C*Math.sin(TAU*k/3),13],4,highlight==='carrier'?colors.active:colors.output))]),
  shaft('sun-shaft','中心轴',5,76,colors.input,[0,0,-22]),
  part('support','观察支承环',[ring(R+10,R+5,5,colors.case,[0,0,-17])],[0,0,0],'支承环避开齿轮平面',{category:'housing'})
 ];
 for(let k=0;k<3;k++){const a=TAU*k/3;parts.push(part('planet-'+k,`行星轮 ${k+1}`,[gear(zp,m,12,colors.brass),cylinder(3,20,colors.dark)],[C*Math.cos(a),C*Math.sin(a),0]));}
 return {parts};
}
export function planetaryPoses(zs,zp,m,angles){
 const {s,r,c}=angles,C=m*(zs+zp)/2,out={sun:pose([0,0,s]),ring:pose([0,0,r]),carrier:pose([0,0,c]),'sun-shaft':pose([0,0,s])};
 for(let k=0;k<3;k++){const a=TAU*k/3;out['planet-'+k]=pose([0,0,c-zs/zp*(s-c)+(1+zs/zp)*a+Math.PI-Math.PI/zp],[C*Math.cos(a+c),C*Math.sin(a+c),0]);}
 return out;
}
export function openBeltLength(r1,r2,C){const d=r2-r1,a=Math.asin(d/C);return 2*Math.sqrt(C*C-d*d)+Math.PI*(r1+r2)+2*d*a;}
export function cvtGeometry(p){
 const r1=p.driveRadius,C=p.centerDistance,L=2*C+TAU*40;let lo=10,hi=80;
 for(let i=0;i<64;i++){const mid=(lo+hi)/2;if(openBeltLength(r1,mid,C)>L)hi=mid;else lo=mid;}
 const r2=(lo+hi)/2;return {r1,r2,C,L,ratio:r1/r2};
}
export function beltPath(r1,r2,C){
 const a=Math.acos((r1-r2)/C),l=Math.sqrt(C*C-(r1-r2)**2),arc2=2*a*r2,arc1=(TAU-2*a)*r1,L=2*l+arc1+arc2;
 const t1=[r1*Math.cos(a),r1*Math.sin(a)],t2=[C+r2*Math.cos(a),r2*Math.sin(a)];
 return {length:L,at(distance){let s=mod(distance,L);if(s<l){const u=s/l;return {x:t1[0]+(t2[0]-t1[0])*u-C/2,y:t1[1]+(t2[1]-t1[1])*u,angle:Math.atan2(t2[1]-t1[1],t2[0]-t1[0])};}s-=l;if(s<arc2){const t=a-s/r2;return {x:C/2+r2*Math.cos(t),y:r2*Math.sin(t),angle:t-Math.PI/2};}s-=arc2;if(s<l){const u=s/l;return {x:t2[0]+(t1[0]-t2[0])*u-C/2,y:-t2[1]+(-t1[1]+t2[1])*u,angle:Math.atan2(-t1[1]+t2[1],t1[0]-t2[0])};}s-=l;const t=-a-s/r1;return {x:-C/2+r1*Math.cos(t),y:r1*Math.sin(t),angle:t-Math.PI/2};}};
}
export function coneSheave(contactRadius,side,color){
 const vertices=[],indices=[],n=64,tan=Math.tan(rad(11));
 for(let i=0;i<n;i++){const a=TAU*i/n;for(const [r,back] of [[17,0],[65,0],[17,5],[65,5]])vertices.push(r*Math.cos(a),r*Math.sin(a),side*(9+(r-contactRadius)*tan+back));}
 for(let i=0;i<n;i++){const j=(i+1)%n;for(const [a,b] of [[0,1],[2,3],[0,2],[1,3]]){indices.push(i*4+a,j*4+a,j*4+b,i*4+a,j*4+b,i*4+b);}}
 return {kind:'mesh',vertices,indices,color};
}
export function synchronizerState(p,phase){
 const duration=p.shiftTurns*TAU,t=Math.max(0,phase)/duration,q0=p.initialRatio,a=.2,b=.6,u=(t-a)/(b-a),q=q0+(1-q0)*smooth(u);
 const integral=u<=0?0:u>=1?u-.5:u**3-.5*u**4;
 const outputAngle=q0*Math.max(0,phase)+(1-q0)*duration*(b-a)*integral;
 const sleeve=t<.2?-5*smooth(t/.2):t<.65?-5:-5-18*smooth((t-.65)/.2);
 return {t,ratio:q,outputAngle,sleeve,stage:t<.2?'拨叉预推':t<.6?'锥面摩擦同步，锁环阻挡':t<.65?'转速一致，解除锁止':t<.85?'齿套接合':'接合完成，刚性同速'};
}
export function cvBall(angle,phase,k,radius=32){
 const a=phase+TAU*k/6,t=Math.tan(angle/2),r=radius/Math.sqrt(1+t*t*Math.cos(a)**2),x=r*Math.cos(a);
 return [x,r*Math.sin(a),-t*x];
}
export function indexState(stops,moveDegrees,phase){
 const cycles=Math.floor(phase/TAU),t=mod(phase),beta=rad(moveDegrees),delta=TAU/stops,u=t/beta;
 return {angle:(cycles+smooth5(u)-.5)*delta,derivative:delta/beta*smooth5Derivative(u),moving:t<beta,delta,beta};
}
export function indexProfile(stops,moveDegrees,C=92,R=42,roller=5){
 const beta=rad(moveDegrees),delta=TAU/stops,points=[],pitch=[];
 for(let i=0;i<=900;i++){const theta=beta*i/900,d=delta*(smooth5(i/900)-.5),dprime=delta/beta*smooth5Derivative(i/900);
  const P=[C-R*Math.cos(d),-R*Math.sin(d)],V=[R*Math.sin(d)*dprime,-R*Math.cos(d)*dprime],q=rot(...P,-theta),dq=rot(V[0]+P[1],V[1]-P[0],-theta),l=Math.hypot(...dq),normal=[-dq[1]/l,dq[0]/l];
  points.push([q[0]-roller*normal[0],q[1]-roller*normal[1]]);pitch.push(q);
 }
 const start=Math.atan2(pitch[0][1],pitch[0][0]),end=Math.atan2(pitch.at(-1)[1],pitch.at(-1)[0]);let e=end;while(e>start)e-=TAU;const D=Math.hypot(...pitch[0]);
 for(let i=1;i<360;i++){const a=e+(start-TAU-e)*i/360;points.push([(D-roller)*Math.cos(a),(D-roller)*Math.sin(a)]);}
 return {points,pitch,C,R,roller,dwellRadius:D-roller};
}
export function cycloidGeometry(p){
 const N=p.pinCount,R=p.ringRadius,r=p.pinRadius,e=.35*R/N,points=[];
 for(let i=0;i<1800;i++){const t=TAU*i/1800,dx=-R*Math.sin(t)+e*N*Math.sin(N*t),dy=R*Math.cos(t)-e*N*Math.cos(N*t),l=Math.hypot(dx,dy);points.push([R*Math.cos(t)-e*Math.cos(N*t)-r*dy/l,R*Math.sin(t)-e*Math.sin(N*t)+r*dx/l]);}
 return {N,R,r,e,points,reduction:N-1,outputPinRadius:3,outputCircle:R*.5};
}
export const ellipseRadius=(angle,a,b)=>a*b/Math.hypot(b*Math.cos(angle),a*Math.sin(angle));
export function wormTooth(teeth,module,starts,index,width){
 const R=teeth*module/2,wr=5*module,gamma=Math.atan(starts/10),vertices=[],indices=[];
 for(let j=0;j<=6;j++){const z=-width/2+width*j/6,sag=wr-Math.sqrt(wr*wr-z*z);for(const [radius,sign] of [[R-module*1.15,-1],[R+module,-1],[R+module,1],[R-module*1.15,1]]){const a=TAU*index/teeth+z*Math.tan(gamma)/R+sign*Math.PI*.42/teeth;vertices.push((radius+sag)*Math.cos(a),(radius+sag)*Math.sin(a),z);}}
 for(let j=0;j<6;j++)for(let k=0;k<4;k++){const next=(k+1)%4,a=j*4+k,b=j*4+next,c=(j+1)*4+next,d=(j+1)*4+k;indices.push(a,b,c,a,c,d);}
 indices.push(0,2,1,0,3,2,24,25,26,24,26,27);return {kind:'mesh',vertices,indices,color:colors.brass};
}

// Steel elements taper radially to the 11-degree sheave faces; 0.08 mm visual clearance.
export function pushbeltElement(length,color){
 const vertices=[],indices=[],slope=Math.tan(rad(11));
 for(const x of [-length/2,length/2])for(const y of [-1.5,1.5])for(const side of [-1,1])vertices.push(x,y,side*(9+y*slope-.08));
 for(const [a,b,c,d]of [[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]])indices.push(a,b,c,a,c,d);
 return {kind:'mesh',vertices,indices,color};
}

// Teaching strain-wave mesh: matching involute gap in engaged arcs, smooth withdrawal
// before material teeth traverse between zones. Not a manufacturer S-tooth surface.
export function harmonicTooth(z){
 const R=z/2,N=z+2,Rp=N/2,base=Rp*Math.cos(Math.PI/9),iv=a=>Math.tan(a)-a;
 const half=r=>Math.PI/(2*N)-(iv(Math.acos(Math.min(1,base/r)))-iv(Math.PI/9))-.0006;
 const points=[],root=R-1.8,tip=R+1.25;
 for(let i=0;i<=24;i++){const r=root+(tip-root)*i/24,a=half(Math.max(base,r));points.push([r*Math.cos(a)-R,-r*Math.sin(a)]);}
 for(let i=24;i>=0;i--){const r=root+(tip-root)*i/24,a=half(Math.max(base,r));points.push([r*Math.cos(a)-R,r*Math.sin(a)]);}
 return points;
}
export function harmonicToothPose(z,phase,k){
 const R=z/2,a=TAU*k/z-2*phase/z,d=mod(a-phase+Math.PI/2,Math.PI)-Math.PI/2,u=Math.abs(d);
 const weight=1-smooth5((u-rad(45))/rad(30)),withdrawal=3*smooth5((u-rad(15))/rad(30)),angle=a-2/(z+2)*d*weight;
 return {rotation:[0,0,angle],position:[(R-withdrawal)*Math.cos(angle),(R-withdrawal)*Math.sin(angle),0],materialAngle:a,withdrawal};
}

export function hollowFrustum(z0,z1,inner0,inner1,outer0,outer1,color){
 const vertices=[],indices=[],n=96;
 for(let i=0;i<n;i++){const a=TAU*i/n;for(const [z,r]of [[z0,inner0],[z0,outer0],[z1,inner1],[z1,outer1]])vertices.push(r*Math.cos(a),r*Math.sin(a),z);}
 for(let i=0;i<n;i++){const j=(i+1)%n;for(const [a,b]of [[0,1],[1,3],[3,2],[2,0]])indices.push(i*4+a,j*4+a,j*4+b,i*4+a,j*4+b,i*4+b);}
 return {kind:'mesh',vertices,indices,color};
}
