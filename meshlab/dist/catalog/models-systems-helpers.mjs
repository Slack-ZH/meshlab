export const TAU=2*Math.PI,rad=degrees=>degrees*Math.PI/180;
export const colors={input:0xd49a48,output:0x5eb6b2,mid:0x879cd5,steel:0xaab4c0,dark:0x404b5a,red:0xd57467,case:0x8090a0};
export const num=(key,label,unit,min,max,step,value)=>({key,label,unit,min,max,step,value});
export const choice=(key,label,value,options)=>({key,label,value,options});
export const rpm=(value=30,max=120)=>num('inputRPM','输入参考转速','r/min',0,max,1,value);
export const metric=(label,value,unit='')=>({label,value,unit});
export const box=(size,color=colors.steel,position=[0,0,0],rotation=[0,0,0])=>({kind:'box',size,color,position,rotation});
export const cylinder=(radius,length,color=colors.steel,position=[0,0,0],rotation=[0,0,0])=>({kind:'cylinder',radius,length,color,position,rotation});
export const ring=(outer,inner,length,color=colors.steel,position=[0,0,0])=>({kind:'ring',outer,inner,length,color,position});
export const gear=(teeth,module,width,color=colors.steel,position=[0,0,0],internal=false)=>({kind:'gear',teeth,module,width,hole:Math.min(5,(teeth/2-1.4)*module),color,position,internal});
export const rod=(from,to,radius=3,color=colors.steel)=>({kind:'rod',from,to,radius,color});
export const part=(id,name,description,shapes,position=[0,0,0],rotation=[0,0,0],category='transmission')=>({id,name,description,category,shapes,position,rotation});
export const rz=(angle,position)=>({rotation:[0,0,angle],...(position?{position}:{})});
export const xy=(r,a,z=0)=>[r*Math.cos(a),r*Math.sin(a),z];
export const add=(a,b)=>a.map((v,i)=>v+b[i]);
export function define(spec){
  const fields=spec.fields.some(f=>f.key==='inputRPM')?spec.fields:[...spec.fields,rpm()];
  const extra=spec.validate;
  return {...spec,fields,validate(p){for(const f of fields){const v=p[f.key];if(f.options){if(!f.options.some(o=>o[0]===v))throw Error(f.label+'选项无效');}
    else if(!Number.isFinite(v)||v<f.min||v>f.max)throw Error(f.label+'超出范围');}
    if(extra)extra(p);},questions:spec.questions||['改变参数会怎样影响输出？','当前动力经过哪些零件？','这个教学模型省略了什么？']};
}
export function integer(...values){if(values.some(v=>!Number.isInteger(v)))throw Error('齿数必须为整数');}
export function planetary(ns=24,np=18,module=1.4,prefix='pg',origin=[0,0,0]){
  const nr=ns+2*np,c=(ns+np)*module/2;
  const parts=[part(prefix+'-sun','太阳轮','中心外齿轮，转速满足行星排约束。',[gear(ns,module,10,colors.input),cylinder(5,60,colors.input)],origin),
    part(prefix+'-ring','内齿圈','与行星轮内啮合；制动或驱动状态由工况指定。',[gear(nr,module,10,colors.mid,[0,0,0],true)],origin),
    part(prefix+'-carrier','行星架','保持各行星轮中心距，支承行星销。',[ring(10,5,5,colors.output,[0,0,14]),...Array.from({length:3},(_,i)=>rod([0,0,14],xy(c,TAU*i/3,14),3,colors.output)),...Array.from({length:3},(_,i)=>cylinder(3,24,colors.output,xy(c,TAU*i/3,2)))],origin)];
  for(let i=0;i<3;i++)parts.push(part(prefix+'-planet'+i,'行星轮 '+(i+1),'同时与太阳轮和内齿圈啮合。',[gear(np,module,10,colors.steel)],add(origin,xy(c,TAU*i/3))));
  return {parts,ns,np,nr,c,module,prefix,origin};
}
export function planetaryPoses(g,sun,ringAngle,carrier){
  const poses={[g.prefix+'-sun']:rz(sun),[g.prefix+'-ring']:rz(ringAngle),[g.prefix+'-carrier']:rz(carrier)};
  for(let i=0;i<3;i++){
    const a=TAU*i/3,phase=(1+g.ns/g.np)*a+Math.PI-Math.PI/g.np;
    poses[g.prefix+'-planet'+i]=rz(carrier-g.ns/g.np*(sun-carrier)+phase,add(g.origin,xy(g.c,a+carrier)));
  }return poses;
}
export function cage(radius=60,length=70,origin=[0,0,0],id='housing'){
  return part(id,'剖开支承壳','半透明壳与轴承仅用于说明轴系位置。',[
    {...ring(radius+5,radius,length,colors.case),opacity:.13},ring(10,5,6,colors.dark,[0,0,-length/2]),ring(10,5,6,colors.dark,[0,0,length/2])],origin,[0,0,0],'housing');
}
export function clutch(id,name,z,r=24,engaged=true){return part(id,name,'交替摩擦片与压盘；接合状态用于理想刚性约束。',[
  ring(r*.52,5,18,colors.mid),...Array.from({length:5},(_,i)=>ring(r,r*.48,2,i%2?colors.steel:colors.input,[0,0,(i-2)*3])),ring(r+2,r*.45,3,engaged?colors.output:colors.red,[0,0,engaged?10:16])],[0,0,z]);}
export function bevel(teeth=20,radius=24,width=10,color=colors.mid){
  const vertices=[],indices=[],inner=radius*.45;
  for(let i=0;i<teeth;i++){
    const a=i*TAU/teeth,h=TAU/teeth*.28,base=vertices.length/3;
    for(const [z,s] of [[-width/2,1],[width/2,.62]])for(const [r,t] of [[inner,a-h],[radius,a-h],[radius,a+h],[inner,a+h]])vertices.push(r*s*Math.cos(t),r*s*Math.sin(t),z);
    for(const [u,v,w] of [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]])indices.push(base+u,base+v,base+w);
  }return {kind:'mesh',vertices,indices,color};
}
export function cycloidOutline(pins,R,e,roller){
  const points=[],count=(pins-1)*32;
  for(let i=0;i<count;i++){
    const t=i*TAU/count,dx=-R*Math.sin(t)+e*pins*Math.sin(pins*t),dy=R*Math.cos(t)-e*pins*Math.cos(pins*t),n=Math.hypot(dx,dy);
    points.push([R*Math.cos(t)-e*Math.cos(pins*t)-roller*dy/n,R*Math.sin(t)-e*Math.sin(pins*t)+roller*dx/n]);
  }return points;
}
export const circle=(r,c=[0,0],n=32)=>Array.from({length:n},(_,i)=>[c[0]+r*Math.cos(i*TAU/n),c[1]+r*Math.sin(i*TAU/n)]);
export function helix(radius,lead,length,axis='z',color=colors.input){
  const turns=length/lead,n=Math.ceil(turns*24),points=Array.from({length:n+1},(_,i)=>{
    const a=TAU*turns*i/n,z=-length/2+length*i/n,x=radius*Math.cos(a),y=radius*Math.sin(a);return axis==='x'?[z,x,y]:axis==='y'?[x,z,y]:[x,y,z];});
  return {kind:'tube',points,radius:.7,color};
}
export const Rz=a=>[[Math.cos(a),-Math.sin(a),0],[Math.sin(a),Math.cos(a),0],[0,0,1]];
export const Ry=a=>[[Math.cos(a),0,Math.sin(a)],[0,1,0],[-Math.sin(a),0,Math.cos(a)]];
export const matmul=(a,b)=>a.map(row=>b[0].map((_,j)=>row.reduce((s,v,k)=>s+v*b[k][j],0)));
export const transform=(m,v)=>m.map(row=>row.reduce((s,x,i)=>s+x*v[i],0));
export function euler(m){const y=Math.asin(Math.max(-1,Math.min(1,m[0][2])));return Math.abs(m[0][2])<.999999?[Math.atan2(-m[1][2],m[2][2]),y,Math.atan2(-m[0][1],m[0][0])]:[Math.atan2(m[2][1],m[1][1]),y,0];}
