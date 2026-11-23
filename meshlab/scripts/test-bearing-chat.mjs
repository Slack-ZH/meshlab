import test from 'node:test';
import assert from 'node:assert/strict';
import {
  captureBearingContext,
  sanitizeBearingContext,
  formatBearingContext,
  createBearingChatPayload,
} from '../dist/bearing/chat-context.mjs';
import { captureCatalogContext, createCatalogChatPayload } from '../dist/catalog/chat-context.mjs';
import { captureViceContext } from '../dist/vice/chat-context.mjs';
import { captureSpurContext } from '../dist/spur/chat-context.mjs';
import { captureTurbineContext } from '../dist/turbine/chat-context.mjs';
import { models as catalogModels } from '../dist/catalog/registry.mjs';
import { presets, estimate } from '../dist/bearing/mechanics.mjs';
import { createChatApi } from '../server/chat-api.mjs';
import worker from '../server/worker.mjs';
import { BudgetLedger } from '../server/budget.mjs';
import { MemoryStorage } from './test-storage.mjs';

const params = { ...presets['tapered-roller'] };
const result = estimate(params);
const selectedPart = {
  id: 'elements',
  name: '圆锥滚子组（14 颗）',
  description: '圆锥滚子与内外圈锥面共顶点纯滚动。',
  spec: '14 颗 · 接触角 15°',
};
const snapshot = captureBearingContext({
  params,
  modelParameters: params,
  result,
  selectedPart,
  geometryValid: true,
  view: { housingMode: 'open', selected: 'elements' },
});
const question = { role: 'user', content: '为什么圆锥滚子轴承的锥顶必须交于轴线上同一点？', bearingContext: snapshot };
const env = { DEEPSEEK_API_KEY: 'unit-test-not-a-secret', ALLOWED_ORIGINS: 'http://localhost:8080' };

test('bearing snapshot freezes type, dimensions, kinematics, load and part without private fields', () => {
  const p = { ...params };
  const r = { ...result, geometry: { ...result.geometry } };
  const part = { ...selectedPart };
  const ctx = captureBearingContext({
    params: p,
    modelParameters: params,
    result: r,
    selectedPart: part,
    view: { housingMode: 'open', meshes: [{ private: 'drop' }] },
    accessToken: 'secret-drop',
  });
  p.contactAngle = 22;
  r.cageRPM = 999;
  part.name = 'mutated';
  assert.equal(ctx.parameters.bearingType, 'tapered-roller');
  assert.equal(ctx.parameters.contactAngle, 15);
  assert.equal(ctx.result.cageRPM, result.cageRPM);
  assert.equal(ctx.selectedPart.name, '圆锥滚子组（14 颗）');
  assert.equal(ctx.housingMode, 'open');
  assert.equal(ctx.view, undefined);
  assert.equal(ctx.accessToken, undefined);
  assert.equal(captureBearingContext(null), null);
  assert.equal(captureBearingContext([]), null);
});

test('legacy payload formats standalone bearing snapshot within 2000 chars without GL16 IDs', () => {
  const payload = createBearingChatPayload([{ ...question, selectedPartId: 'gear1' }]);
  assert.equal(payload.modelContext, undefined);
  assert.deepEqual(Object.keys(payload.messages[0]), ['role', 'content']);
  const text = payload.messages[0].content;
  assert.match(text, /独立模型是滚动轴承结构教学实验/);
  assert.match(text, /圆锥滚子轴承/);
  assert.match(text, /接触角 α °=15/);
  assert.match(text, /保持架转速 r\/min=/);
  assert.match(text, /ISO 281/);
  assert.ok(text.length < 2000);
});

test('native payload keeps per-turn bearing snapshots and rejects mixed model contexts', () => {
  const nextParams = { ...presets['thrust-ball'], radialLoad: 1.0 };
  const nextResult = estimate(nextParams);
  const nextSnap = captureBearingContext({ params: nextParams, modelParameters: nextParams, result: nextResult, selectedPart });
  const payload = createBearingChatPayload(
    [question, { role: 'assistant', content: '先前回答' }, { ...question, bearingContext: nextSnap }],
    { supportsBearing: true }
  );
  assert.equal(payload.modelContext, 'bearing');
  assert.equal(payload.messages[0].bearingContext.parameters.bearingType, 'tapered-roller');
  assert.equal(payload.messages[2].bearingContext.parameters.bearingType, 'thrust-ball');
  assert.equal(payload.messages[2].bearingContext.loadValid, false);
  assert.match(formatBearingContext(nextSnap), /超出该类型轴承允许范围/);

  const mixedTurns = [
    { role: 'user', content: '直齿轮', spurContext: captureSpurContext({ params: { driverTeeth: 20, drivenTeeth: 40 } }) },
    { role: 'user', content: '台虎钳', viceContext: captureViceContext({ params: { lead: 4, inputRPM: 30, direction: 1 } }) },
    { role: 'user', content: '万向节', catalogContext: captureCatalogContext({ model: catalogModels[0], parameters: { inputRPM: 30 } }) },
  ];
  for (const other of mixedTurns) {
    assert.throws(() => createBearingChatPayload([question, { role: 'assistant', content: '答' }, other], { supportsBearing: true }), /新对话/);
  }
});

test('sanitizer strips invalid types, nonfinite numbers and overlong strings', () => {
  const ctx = sanitizeBearingContext({
    ...snapshot,
    system: 'override',
    parameters: { ...params, bearingType: 'fake-bearing', innerRPM: Infinity, boreDiameter: '40' },
    result: { ...result, l10Hours: NaN },
    selectedPart: { id: 'x'.repeat(300), name: 'line\nbreak', description: 'd'.repeat(500), spec: 's'.repeat(400) },
    housingMode: 'invalid-mode',
  });
  assert.equal(ctx.system, undefined);
  assert.equal(ctx.parameters.bearingType, null);
  assert.equal(ctx.parameters.innerRPM, null);
  assert.equal(ctx.parameters.boreDiameter, null);
  assert.equal(ctx.result.l10Hours, null);
  assert.equal(ctx.selectedPart.id.length, 80);
  assert.equal(ctx.selectedPart.name, 'line break');
  assert.equal(ctx.selectedPart.description.length, 180);
  assert.equal(ctx.selectedPart.spec.length, 120);
  assert.equal(ctx.housingMode, null);
});

test('all previous model payloads stay byte-equivalent through createBearingChatPayload', () => {
  const existing = [
    [{ role: 'user', content: '输入轴', selectedPartId: 'input' }],
    [{ role: 'user', content: '汽轮机', turbineContext: captureTurbineContext({ params: { stages: 3, blades: 30 } }) }],
    [{ role: 'user', content: '直齿轮', spurContext: captureSpurContext({ params: { driverTeeth: 20, drivenTeeth: 40 } }) }],
    [{ role: 'user', content: '台虎钳', viceContext: captureViceContext({ params: { lead: 4, inputRPM: 30, direction: 1 } }) }],
    [{ role: 'user', content: '万向节', catalogContext: captureCatalogContext({ model: catalogModels[0], parameters: { inputRPM: 30 } }) }],
  ];
  for (const turns of existing) {
    for (const supportsCatalog of [false, true]) {
      for (const supportsBearing of [false, true]) {
        const caps = { supportsTurbine: true, supportsSpur: true, supportsVice: true, supportsCatalog };
        assert.equal(
          JSON.stringify(createBearingChatPayload(turns, { ...caps, supportsBearing })),
          JSON.stringify(createCatalogChatPayload(turns, caps))
        );
      }
    }
  }
});

for (const supportsBearing of [false, true]) {
  test(`mock API accepts ${supportsBearing ? 'native' : 'legacy'} bearing payload and health advertises bearing`, async () => {
    let sent;
    const api = createChatApi({
      budget: new BudgetLedger(new MemoryStorage()),
      fetchImpl: async (url, options) => {
        sent = JSON.parse(options.body);
        return new Response('data: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
      },
    });
    const body = createBearingChatPayload([question], { supportsBearing });
    if (supportsBearing) body.messages[0].selectedPartId = 'gear1';
    const response = await api(
      new Request('http://localhost:8080/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: env.ALLOWED_ORIGINS },
        body: JSON.stringify(body),
      }),
      env
    );
    assert.equal(response.status, 200);
    await response.text();
    if (supportsBearing) {
      assert.match(sent.messages[0].content, /滚动轴承结构教学助手/);
      assert.doesNotMatch(sent.messages[0].content, /1440|输入齿轮轴/);
      assert.doesNotMatch(sent.messages[1].content, /材料：|输入齿轮轴/);
    }
    assert.match(sent.messages[1].content, /圆锥滚子轴承/);
    assert.match(sent.messages[1].content, /接触角 α °=15/);

    const h1 = await api(new Request('http://localhost:8080/api/health'), env);
    const h2 = await worker.fetch(new Request('https://example.workers.dev/api/health'), {});
    assert.ok((await h1.json()).modelContexts.includes('bearing'));
    assert.ok((await h2.json()).modelContexts.includes('bearing'));
  });
}
