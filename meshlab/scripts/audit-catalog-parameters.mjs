import fs from 'node:fs';
import crypto from 'node:crypto';
import {models,modelFields,defaultParameters,validateParameters} from '../dist/catalog/registry.mjs';
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const phases=[0,.37,1.3,3.2,7.7,19];
const meshChecks=process.argv.includes('--mesh'),checked=new Set();let geometryFor;
if(meshChecks){const source=fs.readFileSync(new URL('../dist/catalog/geometry.mjs',import.meta.url),'utf8').replace("from 'three'",`from '${new URL('../dist/assets/three.module.js',import.meta.url).href}'`);({geometryFor}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')));}
function checkShape(shape){
 const {color,opacity,position,rotation,wireframe,...spec}=shape,key=hash(spec);if(checked.has(key))return;
 if(spec.kind==='ring'&&!(spec.outer>spec.inner&&spec.inner>0))throw Error('invalid annulus');
 if(spec.kind==='box'&&!spec.size.every(v=>v>0&&Number.isFinite(v)))throw Error('invalid box dimensions');
 const g=geometryFor(spec);try{for(const a of Object.values(g.attributes))if(!a.array.every(Number.isFinite))throw Error('nonfinite mesh buffer');if(!g.attributes.position.count)throw Error('empty mesh');if(g.index&&!g.index.array.every(i=>i<g.attributes.position.count))throw Error('invalid mesh index');g.computeBoundingBox();if(g.boundingBox.isEmpty())throw Error('empty bounds');}finally{g.dispose();}checked.add(key);
}
function snapshot(m,p){
 const parts=m.build(p).parts;
 if(meshChecks)for(const part of parts)for(const shape of part.shapes)checkShape(shape);
 const shapes=parts.map(x=>({id:x.id,position:x.position,rotation:x.rotation,shapes:x.shapes}));
 const samples=phases.map(phase=>m.sample(p,phase));
 const timed=[.1,.6,1.3].map(t=>m.sample(p,t*p.inputRPM*Math.PI/30*.2).poses);
 return {geometry:hash(shapes),motion:hash(samples.map(s=>s.poses)),timed:hash(timed),metrics:hash(samples.map(s=>[s.metrics,s.status])),parts:parts.length};
}
const report={date:'2026-11-17',scope:'All catalog fields: one-at-a-time limits/options and paired extrema; hashes compare production shape descriptors and poses, not manufacturing collision proof',models:[],failures:[]};
for(const m of models){
 const p=defaultParameters(m),base=snapshot(m,p),fields=modelFields(m),entry={number:m.number,id:m.id,title:m.title,parts:base.parts,fields:[],combinations:{accepted:0,rejected:0}};
 for(const f of fields){
  let context=p;
  if(f.enabledWhen&&!f.enabledWhen(p)){
   for(const other of fields){for(const value of other.options?.map(o=>o[0])||[other.min,other.max]){const q={...p,[other.key]:value};try{validateParameters(m,q);if(f.enabledWhen(q)){context=q;break;}}catch{}}if(context!==p)break;}
  }
  const reference=context===p?base:snapshot(m,context);
  const values=f.options?f.options.map(o=>o[0]):[f.min,f.max,f.min+Math.round((f.max-f.min)/(2*(f.step||1)))*(f.step||1)];
  const row={key:f.key,label:f.label,enabledByDefault:!f.enabledWhen||f.enabledWhen(p),activeContext:context===p?null:context,geometry:false,motion:false,timed:false,metrics:false,accepted:[],rejected:[]};
  for(const v of [...new Set(values)]){if(v===context[f.key])continue;const q={...context,[f.key]:v};try{validateParameters(m,q);}catch(e){row.rejected.push({value:v,reason:e.message});continue;}
   try{const s=snapshot(m,q);row.accepted.push(v);for(const key of ['geometry','motion','timed','metrics'])row[key]||=s[key]!==reference[key];}catch(e){report.failures.push({model:m.id,field:f.key,value:v,error:e.message});}
  }
  row.effect=[row.geometry&&'geometry/appearance',row.motion&&'pose',row.timed&&'motion-over-time',row.metrics&&'calculation'].filter(Boolean);entry.fields.push(row);
 }
 for(let i=0;i<fields.length;i++)for(let j=i+1;j<fields.length;j++)for(const upper of [false,true]){
  const a=fields[i],b=fields[j],value=f=>f.options?f.options.at(upper?-1:0)[0]:upper?f.max:f.min,q={...p,[a.key]:value(a),[b.key]:value(b)};
  try{validateParameters(m,q);}catch{entry.combinations.rejected++;continue;}
  try{snapshot(m,q);entry.combinations.accepted++;}catch(e){report.failures.push({model:m.id,parameters:q,error:e.message});}
 }
 report.models.push(entry);
}
report.uniqueProductionMeshes=checked.size;
const dir='test-results/audit-20261117';fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(dir+'/catalog-parameters.json',JSON.stringify(report,null,2));
const fields=report.models.flatMap(m=>m.fields.map(f=>({id:m.id,...f})));console.log(JSON.stringify({models:report.models.length,partsAtDefault:report.models.reduce((n,m)=>n+m.parts,0),fields:fields.length,acceptedVariants:fields.reduce((n,f)=>n+f.accepted.length,0),pairedCases:report.models.reduce((n,m)=>n+m.combinations.accepted,0),failures:report.failures,noEffect:fields.filter(f=>!f.effect.length),calculationOnly:fields.filter(f=>!f.geometry&&!f.motion&&!f.timed)},null,2));
if(report.failures.length)process.exitCode=1;
