import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {definitions,assemblySteps} from '../dist/experiments/catalog.mjs';
import {renderPages} from './build-experiments.mjs';
import {assertExperimentDefinition,assertExperimentPage} from './experiment-page-contract.mjs';
import {assertTeachingCoverage} from './experiment-teaching-checks.mjs';

const pages=await renderPages(),kind='scotch-yoke',definition=definitions[kind],source=pages.get(kind);
for(const [id,html]of pages)test(id+' delivered page matches validated shared template',async()=>{
  assertExperimentPage(id,definitions[id],html);
  assert.equal((await readFile(new URL('../dist/'+id+'.html',import.meta.url),'utf8')).replace(/\r\n/g,'\n'),html.replace(/\r\n/g,'\n'));
});
test('omitting AI, login, search, narration, details or export fails the gate',()=>{
  for(const id of ['chat-input','auth-dialog','part-search','speak','part-spec','step-copy','download-data'])assert.throws(()=>assertExperimentPage(kind,definition,source.replace('id="'+id+'"','id="removed-'+id+'"')),new RegExp(id));
});
test('numeric-only parameters and stale slider ranges fail the gate',()=>{
  assert.throws(()=>assertExperimentPage(kind,definition,source.replace('id="r-slider"','id="removed-slider"')),/配套数值框\/滑块/);
  assert.throws(()=>assertExperimentPage(kind,definition,source.replace('id="r-slider" type="range" min="25"','id="r-slider" type="range" min="26"')),/与参数定义不符/);
});
test('an alternate shell, wrong model identity or duplicate ID cannot pass',()=>{
  assert.throws(()=>assertExperimentPage(kind,definition,source.replace('src="experiments/app.mjs"','src="linkages/app.mjs"')),/公共实现/);
  assert.throws(()=>assertExperimentPage(kind,definition,source.replace('data-mechanism="scotch-yoke"','data-mechanism="bicycle"')),/机构标识不符/);
  assert.throws(()=>assertExperimentPage(kind,definition,source+'<div id="chat-input"></div>'),/重复 ID/);
});
test('generic assembly placeholders or missing per-mechanism behaviour cannot pass',()=>{
  const steps=structuredClone(assemblySteps[kind]);steps[2].title=steps[1].title;assert.throws(()=>assertExperimentDefinition(kind,definition,steps),/不能重复/);
  steps[2].title='第二步';steps[2].copy='待补';assert.throws(()=>assertExperimentDefinition(kind,definition,steps),/缺少拆装讲解/);
  assert.throws(()=>assertTeachingCoverage([...Object.keys(definitions),'unreviewed-mechanism']),/缺少机构专属行为检查/);
});
test('unknown batch members are rejected before generating any output',async()=>{
  await assert.rejects(renderPages([kind,'unreviewed-mechanism']),/缺少机构专属行为检查/);
});
