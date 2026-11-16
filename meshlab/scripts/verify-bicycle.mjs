import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

// Attach to an existing headless CDP session. Never launch a browser, sign in,
// send an AI question, or change the app through its read-only diagnostics.
const base = new URL(process.env.MESHLAB_BASE_URL || 'http://127.0.0.1:8088/');
if (!base.pathname.endsWith('/')) base.pathname += '/';
const cdp = process.env.MESHLAB_CDP_URL || 'http://127.0.0.1:9337';
const destination = new URL('../test-results/bicycle/', import.meta.url);
const stateExpression = 'window.__bicycleLab.getState()';
const report = { testedAt: new Date().toISOString(), baseUrl: base.href,
  checks: [], runtimeErrors: [], consoleErrors: [], snapshots: {} };
let socket, sequence = 0, activeCheck = 'startup';
const pending = new Map();

function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('CDP timeout: ' + method));
    }, 30000);
    pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); },
      reject: error => { clearTimeout(timer); reject(error); } });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, returnByValue: true,
    awaitPromise: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression, label, timeout = 20000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    try { if (await evaluate(expression)) return; }
    catch (error) { if (!/context|Cannot find|navigation|destroyed/i.test(error.message)) throw error; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for ' + label);
}
async function settle() {
  await evaluate(`(async()=>{await document.fonts.ready;await new Promise(r=>setTimeout(r,220));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));})()`);
}
async function click(selector) {
  await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing control: '+${JSON.stringify(selector)});e.click();})()`);
  await settle();
}
async function change(id, value) {
  await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});if(!e)throw Error('Missing input: '+${JSON.stringify(id)});e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await settle();
}
const state = () => evaluate(stateExpression);
const inputValue = id => evaluate(`document.getElementById(${JSON.stringify(id)}).value`);
const reset = () => click('#reset-parameters');
function close(actual, expected, label, relative = 1e-7, absolute = 1e-7) {
  assert.ok(Number.isFinite(actual), `${label} is not finite: ${actual}`);
  assert.ok(Math.abs(actual - expected) <= Math.max(absolute, Math.abs(expected) * relative),
    `${label}: expected ${expected}, received ${actual}`);
}
function verifyKinematics(s) {
  const p = s.params, r = s.result;
  assert.ok(s.geometryValid, 'Current geometry is invalid');
  assert.ok(r, 'No calculated result');
  close(r.ratio, p.frontTeeth / p.rearTeeth, 'ratio');
  close(r.rearRPM, p.cadence * r.ratio, 'rear RPM');
  close(r.speedKmh, r.rearRPM * Math.PI * (p.wheelDiameter / 1000) * 60 / 1000, 'road speed');
  close(r.chainPitch, 12.7, 'chain pitch / mm');
  close(r.chainSpeed, p.cadence * p.frontTeeth * r.chainPitch / 60000, 'chain speed / m/s');
  assert.ok(Number.isInteger(r.chainLinks) && r.chainLinks > 0 && r.chainLinks % 2 === 0, 'Chain must have a positive even link count');
  assert.ok(Number.isFinite(r.effectiveCenterDistance) && r.effectiveCenterDistance > 0, 'Invalid effective center distance');
  // The viewer uses continuous pitch circles, joined by two tangents and arcs.
  // Check that exact path rather than the textbook approximate link formula.
  const frontRadius = r.chainPitch * p.frontTeeth / (2 * Math.PI);
  const rearRadius = r.chainPitch * p.rearTeeth / (2 * Math.PI);
  const center = r.effectiveCenterDistance, difference = frontRadius - rearRadius;
  const length = 2 * Math.sqrt(center ** 2 - difference ** 2)
    + Math.PI * (frontRadius + rearRadius) + 2 * difference * Math.asin(difference / center);
  close(length, r.chainLinks * r.chainPitch, 'chain length / effective center closure', 1e-6, 1e-5);
  if (p.cadence > 0) {
    close(r.inputPower, p.inputPower, 'input power');
    const efficiency = p.efficiency > 1 ? p.efficiency / 100 : p.efficiency;
    close(r.outputPower, r.inputPower * efficiency, 'output power');
    close(r.inputTorque, r.inputPower / (p.cadence * Math.PI * 2 / 60), 'input torque');
    close(r.outputTorque, r.outputPower / (r.rearRPM * Math.PI * 2 / 60), 'output torque');
  }
}
async function check(name, action) {
  activeCheck = name;
  try {
    const evidence = await action();
    report.checks.push({ name, status: 'PASS', ...(evidence === undefined ? {} : { evidence }) });
    console.log('PASS ' + name);
  } catch (error) {
    report.checks.push({ name, status: 'FAIL', error: error.stack });
    console.log('FAIL ' + name + ': ' + error.message);
  }
}
async function screenshot(name) {
  const clip = await evaluate(`(()=>{const r=document.querySelector('.viewer-panel').getBoundingClientRect();return{x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1};})()`);
  const image = await command('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true });
  await writeFile(new URL(name, destination), Buffer.from(image.data, 'base64'));
}
async function frames(count = 4) {
  return evaluate(`new Promise(resolve=>{const samples=[];const sample=t=>{samples.push({time:t,view:${stateExpression}.view});if(samples.length>=${count})resolve(samples);else requestAnimationFrame(sample);};requestAnimationFrame(sample);})`);
}

await mkdir(destination, { recursive: true });
try {
  const response = await fetch(cdp + '/json/list', { signal: AbortSignal.timeout(10000) });
  assert.ok(response.ok, 'CDP inventory unavailable');
  const target = (await response.json()).find(item => item.type === 'page');
  assert.ok(target, 'No headless page available');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const request = pending.get(message.id); if (!request) return;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') {
      report.runtimeErrors.push({ check: activeCheck, detail: message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text });
    } else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      report.consoleErrors.push({ check: activeCheck, detail: message.params.args.map(arg => arg.description || arg.value).join(' ') });
    }
  };
  await command('Runtime.enable'); await command('Page.enable');
  await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1080, deviceScaleFactor: 1, mobile: false });
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await command('Page.navigate', { url: new URL('bicycle.html', base).href });
  await waitFor('window.__bicycleLab?.getState().ready', 'bicycle model ready');
  await settle();

  await check('default parameters and physical relationships', async () => {
    await reset(); const s = await state();
    for (const [key, expected] of Object.entries({ frontTeeth: 42, rearTeeth: 18, cadence: 80,
      centerDistance: 430, wheelDiameter: 700, crankLength: 170 })) close(s.params[key], expected, key);
    verifyKinematics(s); report.snapshots.default = s;
    await screenshot('default.png');
  });
  await check('front teeth input rebuilds the model and synchronizes slider', async () => {
    await change('frontTeeth', 48); const s = await state();
    close(s.params.frontTeeth, 48, 'front teeth'); close(s.modelParameters.frontTeeth, 48, 'model front teeth');
    assert.equal(await inputValue('frontTeeth-slider'), '48'); verifyKinematics(s);
  });
  await check('rear teeth slider rebuilds the model and synchronizes input', async () => {
    await change('rearTeeth-slider', 24); const s = await state();
    close(s.params.rearTeeth, 24, 'rear teeth'); close(s.modelParameters.rearTeeth, 24, 'model rear teeth');
    assert.equal(await inputValue('rearTeeth'), '24'); verifyKinematics(s);
  });
  await check('cadence and wheel diameter update speed', async () => {
    await change('cadence', 110); await change('wheelDiameter', 650);
    const s = await state(); verifyKinematics(s);
    close(s.params.cadence, 110, 'cadence'); close(s.params.wheelDiameter, 650, 'wheel diameter');
  });
  await check('chain center adjustment and even links remain consistent', async () => {
    await change('centerDistance', 460); const s = await state(); verifyKinematics(s);
    close(s.modelParameters.centerDistance, 460, 'model requested center distance');
    assert.ok(Math.abs(s.result.effectiveCenterDistance - 460) <= 13, 'Even-link rounding moves centers more than one pitch');
    report.snapshots.changedGeometry = s;
  });
  await check('crank length, power and percent efficiency update independently', async () => {
    await change('crankLength', 175); await change('inputPower', 250); await change('efficiency', 96);
    const s = await state(); close(s.modelParameters.crankLength, 175, 'model crank length');
    verifyKinematics(s); close(s.result.outputPower, 240, '96 percent output power');
  });
  await check('zero cadence has zero delivered power and undefined torque', async () => {
    await change('cadence', 0); const s = await state(); verifyKinematics(s);
    close(s.params.inputPower, 250, 'requested input power retained');
    close(s.result.inputPower, s.params.inputPower, 'input power setting retained');
    for (const key of ['rearRPM', 'speedKmh', 'chainSpeed', 'outputPower']) close(s.result[key], 0, key);
    assert.equal(s.result.inputTorque, null); assert.equal(s.result.outputTorque, null);
    assert.match(s.result.warning, /踏频.*0/, 'Zero-cadence warning is missing');
    await change('cadence', 80);
  });
  for (const [id, value] of [['frontTeeth', 0], ['frontTeeth', 42.5], ['frontTeeth', ''], ['cadence', -1], ['efficiency', 101]]) {
    await check(`invalid ${id}=${JSON.stringify(value)} keeps last valid geometry`, async () => {
      await reset(); const before = await state();
      await change(id, value); const invalid = await state();
      assert.equal(invalid.geometryValid, false, 'Invalid input was accepted');
      assert.deepEqual(invalid.modelParameters, before.modelParameters, 'Invalid input rebuilt the model');
      assert.equal(await inputValue(id), String(value), 'Invalid input was silently replaced');
      await reset(); assert.equal((await state()).geometryValid, true, 'Reset did not recover valid inputs');
    });
  }
  await check('presets select commute, climb and cruise gearing', async () => {
    for (const [preset, front, rear] of [['commute', 42, 18], ['climb', 32, 24], ['cruise', 50, 14]]) {
      await change('drive-preset', preset); const s = await state();
      close(s.params.frontTeeth, front, preset + ' front teeth'); close(s.params.rearTeeth, rear, preset + ' rear teeth');
      close(s.modelParameters.frontTeeth, front, preset + ' model front teeth'); verifyKinematics(s);
    }
    await reset(); close((await state()).params.frontTeeth, 42, 'reset front teeth');
  });
  await check('viewer chain diagnostic agrees with engineering results', async () => {
    const s = await state(), chain = s.view.chain;
    assert.ok(chain, 'Viewer chain diagnostics missing');
    close(chain.links, s.result.chainLinks, 'viewer link count'); close(chain.pitch, 12.7, 'viewer pitch');
    close(chain.length, chain.links * chain.pitch, 'viewer chain length');
    close(chain.effectiveCenterDistance, s.result.effectiveCenterDistance, 'viewer effective centers', 1e-6);
    close(chain.closureError, 0, 'chain closure error', 0, 1e-5);
    assert.ok(chain.minimumLinkDistance > 0 && chain.maximumLinkDistance <= chain.pitch + 1e-5, 'Invalid continuous-path link distances');
    report.snapshots.chain = chain;
  });
  await check('parts directory selects a component and updates context', async () => {
    await click('#open-parts');
    const count = await evaluate(`document.querySelectorAll('#parts-list .part-item').length`);
    assert.ok(count >= 4, 'Too few modeled components');
    await evaluate(`document.querySelectorAll('#parts-list .part-item')[1].click()`); await settle();
    const s = await state(); assert.ok(s.selectedPart?.id && s.selectedPart?.name, 'Selected part missing');
    const text = await evaluate(`document.querySelector('.chat-context').textContent`);
    assert.ok(text.includes(s.selectedPart.name), 'AI context did not follow selected part');
    await click('#close-parts');
    return { parts: count, selectedPart: s.selectedPart };
  });
  await check('exploded top-level components do not intersect', async () => {
    await click('#assemble-all'); await click('#explode-all'); const s = await state();
    close(s.view.amount, 1, 'exploded amount'); assert.equal(s.view.playing, false);
    const parts = s.view.parts; assert.ok(parts.length >= 4, 'Part bounds missing');
    for (const part of parts) {
      assert.ok(part.min?.length === 3 && part.max?.length === 3 && [...part.min,...part.max].every(Number.isFinite), 'Invalid bounds: ' + part.id);
      assert.ok(part.min.every((value, i) => part.max[i] >= value), 'Reversed bounds: ' + part.id);
    }
    const intersections = [];
    for (let i = 0; i < parts.length; i++) for (const b of parts.slice(i + 1)) {
      const a = parts[i];
      if (a.min.every((value, axis) => Math.min(a.max[axis], b.max[axis]) - Math.max(value, b.min[axis]) > 0.1)) intersections.push([a.id, b.id]);
    }
    assert.deepEqual(intersections, [], 'Exploded components intersect');
    report.snapshots.exploded = s.view; await screenshot('exploded.png');
    await click('#assemble-all'); const restored = await state();
    close(restored.view.amount, 0, 'restored amount'); close(restored.view.step, 0, 'restored step');
  });
  await check('playback advances three frames at the tooth-count ratio and pauses', async () => {
    await reset(); await click('#assemble-all'); await change('speed', 1.5); await click('#play');
    const samples = await frames(); const a = samples[0].view, b = samples.at(-1).view;
    assert.equal(b.playing, true); close(b.speed, 1.5, 'playback speed');
    const front = b.rotations.front - a.rotations.front, rear = b.rotations.rear - a.rotations.rear;
    assert.ok(Math.abs(front) > 1e-6, 'Crank did not rotate across three frames');
    close(rear / front, 42 / 18, 'rotor angular velocity ratio', 1e-6);
    close(b.rotations.wheel - a.rotations.wheel, rear, 'rear wheel angular motion', 1e-6);
    assert.notEqual(b.chainPhase, a.chainPhase, 'Chain did not advance');
    await click('#play'); const paused = await frames();
    assert.equal(paused.at(-1).view.playing, false);
    assert.deepEqual(paused.at(-1).view.rotations, paused[0].view.rotations, 'Paused parts keep moving');
    close(paused.at(-1).view.chainPhase, paused[0].view.chainPhase, 'paused chain phase');
    report.snapshots.motion = samples;
  });
  await check('changing cadence to zero pauses active playback', async () => {
    await reset(); await click('#play');
    assert.equal((await state()).view.playing, true, 'Playback did not start');
    await change('cadence', 0); const stopped = await state();
    assert.equal(stopped.view.playing, false, 'Zero cadence left playback active');
    close(stopped.result.rearRPM, 0, 'stopped rear RPM');
    close(stopped.result.outputPower, 0, 'stopped output power');
    const samples = await frames();
    assert.deepEqual(samples.at(-1).view.rotations, samples[0].view.rotations, 'Zero cadence keeps parts moving');
    close(samples.at(-1).view.chainPhase, samples[0].view.chainPhase, 'zero-cadence chain phase');
    await click('#play'); assert.equal((await state()).view.playing, false, 'Play bypassed zero-cadence guard');
    await reset();
  });
  await check('step controls reach both endpoints and return to free mode', async () => {
    await click('[data-mode="steps"]'); await click('#step-next');
    assert.ok((await state()).view.step > 0, 'Next step did not advance');
    for (let i = 0; i < 20 && !await evaluate(`document.getElementById('step-next').disabled`); i++) await click('#step-next');
    assert.equal(await evaluate(`document.getElementById('step-next').disabled`), true, 'No final step boundary');
    for (let i = 0; i < 20 && !await evaluate(`document.getElementById('step-prev').disabled`); i++) await click('#step-prev');
    close((await state()).view.step, 0, 'first step');
    assert.equal(await evaluate(`document.getElementById('step-prev').disabled`), true);
    await click('[data-mode="free"]');
  });
  await check('display dropdown and label control update viewer state', async () => {
    await click('#details-tab');
    for (const mode of ['transparent', 'hidden', 'open', 'solid']) {
      await change('housing-mode', mode); const view = (await state()).view;
      assert.equal(view.housingMode, mode);
      const parts = new Map(view.parts.map(part => [part.id, part]));
      assert.equal(parts.get('frame')?.visible, !['hidden','open'].includes(mode), mode + ' frame visibility');
      assert.equal(parts.get('wheel')?.visible, mode !== 'open', mode + ' wheel visibility');
      for (const id of ['chainring', 'rear-sprocket', 'chain', 'crank'])
        assert.equal(parts.get(id)?.visible, true, mode + ' hides drive part ' + id);
    }
    await click('#labels-toggle'); assert.equal((await state()).view.labelsOn, true);
    await click('#labels-toggle'); assert.equal((await state()).view.labelsOn, false);
    await click('#chat-tab');
  });
  await check('AI connection and login remain available without sending a message', async () => {
    await waitFor(`document.getElementById('chat-connection')&&!document.getElementById('chat-connection').textContent.includes('正在')`, 'AI connection status', 18000);
    const connection = await evaluate(`(()=>{const e=document.getElementById('chat-connection');return{state:e.dataset.state,text:e.textContent};})()`);
    assert.equal(connection.state, 'ready', 'AI endpoint is not connected: ' + connection.text);
    assert.equal(await evaluate(`document.getElementById('chat-login').disabled`), false);
    await click('#chat-login'); assert.equal(await evaluate(`document.getElementById('auth-dialog').open`), true, 'Login dialog did not open');
    await click('#auth-close');
    return connection;
  });
  await reset(); await click('[data-mode="free"]'); await click('#chat-tab');
  report.status = report.checks.every(item => item.status === 'PASS') && !report.runtimeErrors.length ? 'PASS' : 'FAIL';
} catch (error) {
  report.status = 'ERROR'; report.fatal = error.stack;
} finally {
  report.passed = report.checks.filter(item => item.status === 'PASS').length;
  report.failed = report.checks.filter(item => item.status === 'FAIL').length;
  await writeFile(new URL('browser.json', destination), JSON.stringify(report, null, 2) + '\n');
  for (const request of pending.values()) request.reject(new Error('Bicycle verification ended'));
  pending.clear(); if (socket?.readyState === WebSocket.OPEN) socket.close();
}
console.log(JSON.stringify({ status: report.status, passed: report.passed, failed: report.failed,
  errors: report.runtimeErrors.length, fatal: report.fatal, report: destination.href + 'browser.json' }));
if (report.status !== 'PASS') process.exitCode = 1;
