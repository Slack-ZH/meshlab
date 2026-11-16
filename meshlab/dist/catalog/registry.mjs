import {models as motion} from './models-motion.mjs';
import {models as machines} from './models-machines.mjs';
import {models as systems} from './models-systems.mjs';
export const models=[...motion,...machines,...systems].sort((a,b)=>a.number-b.number);
export const expectedNumbers=[...Array.from({length:11},(_,i)=>24+i),36,37,...Array.from({length:22},(_,i)=>39+i)];
export function modelFields(model){return model.fields.some(f=>f.key==='inputRPM')?model.fields:[{key:'inputRPM',label:'输入转速',unit:'r/min',min:0,max:120,step:1,value:30},...model.fields];}
export function defaultParameters(model){return Object.fromEntries(modelFields(model).map(f=>[f.key,f.value]));}
export function parseParameterValue(field,value){
 return field.options?field.options.find(option=>String(option[0])===value)?.[0]:typeof value==='string'&&value.trim()===''?NaN:Number(value);
}
export function validateParameters(model,p){
 for(const f of modelFields(model)){
  if(f.options){if(!f.options.some(o=>o[0]===p[f.key]))throw new Error(f.label+'选项无效');}
  else if(!Number.isFinite(p[f.key])||p[f.key]<f.min||p[f.key]>f.max)throw new Error(`${f.label}须在 ${f.min}–${f.max} ${f.unit||''} 范围内`);
 }
 model.validate?.(p);return p;
}
