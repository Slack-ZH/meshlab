import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {definitions} from '../dist/experiments/catalog.mjs';
import {renderPages} from './build-experiments.mjs';
import {assertExperimentPage} from './experiment-page-contract.mjs';

// Read-only: checks actual deliverables, never silently repairs a stale page.
const expected=await renderPages();
for(const [kind,html]of expected){
  const actual=await readFile(new URL('../dist/'+kind+'.html',import.meta.url),'utf8');
  assertExperimentPage(kind,definitions[kind],actual);
  assert.equal(actual.replace(/\r\n/g,'\n'),html.replace(/\r\n/g,'\n'),kind+': 页面与统一模板不同，请检查差异后重新生成');
  console.log('PASS',kind);
}
console.log(`完整标准静态检查通过：${expected.size} 个页面。实际功能仍须通过浏览器逐项检查。`);
