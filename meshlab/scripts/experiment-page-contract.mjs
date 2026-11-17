import assert from 'node:assert/strict';

// Static guard against the omissions found in the 2026-11-16 audit.
// Presence is only a first gate; actual behaviour still requires browser checks.
const requiredGroups={
  '公共页面':['explore','performance','calibration','viewport','clarity-toggle','home-view','front-view','top-view','fullscreen'],
  '零件解读':['open-parts','close-parts','parts-panel','part-search','parts-list','part-title','part-description','part-spec','part-material','speak','housing-mode','labels-toggle'],
  'AI 与登录':['chat-tab','details-tab','chat-pane','details-pane','chat-input','chat-form','chat-send','chat-stop','chat-retry','chat-reset','chat-context-part','chat-login','auth-dialog','auth-form'],
  '拆装与运动':['play','speed','explode','explode-all','assemble-all','step-prev','step-next','step-title','step-copy','angle','angle-number','motion-chart','drive-metrics'],
  '参数与资料':['geometry-fields','reset-parameters','invalid-input','current-example','download-parameters','download-data'],
};
function attrs(tag){return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(m=>[m[1],m[2]??m[3]]));}
export function assertExperimentDefinition(kind,definition,steps){
  const prefix=kind+': ';
  assert.match(kind,/^[a-z][a-z0-9-]*$/,prefix+'机构标识必须是安全文件名');
  for(const key of ['title','english','subtitle','task','explanation','formula','prompt','note'])assert.ok(typeof definition?.[key]==='string'&&definition[key].trim(),prefix+'缺少专属教学内容 '+key);
  assert.ok(definition.fields?.length,prefix+'缺少参数定义');
  const keys=new Set();for(const f of definition.fields){assert.match(f.key,/^[a-zA-Z][a-zA-Z0-9]*$/,prefix+'参数标识无效');assert.ok(!keys.has(f.key),prefix+'重复参数 '+f.key);keys.add(f.key);assert.ok(f.label&&typeof f.unit==='string',prefix+'参数缺少名称/单位 '+f.key);assert.ok([f.min,f.max,f.value].every(Number.isFinite)&&f.min<f.max&&f.value>=f.min&&f.value<=f.max,prefix+'参数范围或默认值无效 '+f.key);}
  assert.equal(steps?.length,5,prefix+'需要完整装配及四步拆装');
  assert.equal(new Set(steps.map(s=>s.title)).size,5,prefix+'拆装标题不能重复');
  for(const s of steps){assert.ok(s.title&&s.copy?.length>=12,prefix+'缺少拆装讲解');assert.ok(Array.isArray(s.parts),prefix+'缺少实际部件映射');}
  const parts=steps.slice(1).flatMap(s=>s.parts);assert.ok(parts.length>=2,prefix+'拆装步骤未关联实际部件');assert.equal(new Set(parts).size,parts.length,prefix+'同一部件被分配到多个拆装步骤');
}
export function assertExperimentPage(kind,definition,html){
  const prefix=kind+': ',tags=[...html.matchAll(/<[a-zA-Z][^>]*>/g)].map(m=>({tag:m[0].match(/^<([\w-]+)/)[1].toLowerCase(),...attrs(m[0])}));
  const withIds=tags.filter(t=>t.id),ids=new Map(withIds.map(t=>[t.id,t]));assert.equal(ids.size,withIds.length,prefix+'页面有重复 ID');
  assert.equal(tags.find(t=>t.tag==='body')?.['data-mechanism'],kind,prefix+'页面机构标识不符');
  for(const [group,required]of Object.entries(requiredGroups))for(const id of required)assert.ok(ids.has(id),prefix+group+' 缺少 #'+id);
  for(const src of ['experiments/app.mjs','apple.js','chat.js'])assert.ok(tags.some(t=>t.tag==='script'&&t.src===src),prefix+'未接入公共实现 '+src);
  for(const href of ['apple.css','chat.css','experiments/style.css'])assert.ok(tags.some(t=>t.tag==='link'&&t.href===href),prefix+'未接入公共样式 '+href);
  for(const category of ['all','transmission','housing'])assert.ok(tags.some(t=>t['data-filter']===category),prefix+'缺少目录分类 '+category);
  for(const f of definition.fields)for(const [id,type]of [[f.key,'number'],[f.key+'-slider','range']]){const input=ids.get(id);assert.ok(input?.tag==='input'&&input.type===type,prefix+'参数缺少配套数值框/滑块 '+id);for(const [key,value]of [['min',f.min],['max',f.max],['value',f.value],['step',f.step||1]])assert.equal(Number(input[key]),value,prefix+id+' '+key+' 与参数定义不符');}
  assert.ok(html.includes('20%'),prefix+'缺少统一慢放说明');
  assert.ok(!html.includes('id="parameter-form"'),prefix+'不应退回“应用参数”表单');
}
