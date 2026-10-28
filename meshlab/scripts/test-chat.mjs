import test from 'node:test';
import assert from 'node:assert/strict';
import { createChatApi } from '../server/chat-api.mjs';
import { readCompletion } from '../dist/chat-stream.js';
import worker from '../server/worker.mjs';

const env = { DEEPSEEK_API_KEY: 'test-secret-never-real', ALLOWED_ORIGINS: 'http://localhost:8080', CHAT_ACCESS_TOKEN: 'test-access-code-at-least-24-chars' };
const event = data => `data: ${JSON.stringify(data)}\r\n\r\n`;
const completion = text => event({ choices: [{ delta: { content: text }, finish_reason: 'stop' }] }) + 'data: [DONE]\r\n\r\n';
const request = (messages = [{ role: 'user', content: '解释输入轴', selectedPartId: 'input' }], headers = {}) => new Request('http://localhost:8080/api/chat', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: env.ALLOWED_ORIGINS, ...headers }, body: JSON.stringify({ messages })
});
const streamResponse = text => new Response(completion(text), { headers: { 'Content-Type': 'text/event-stream' } });

test('fragmented UTF-8 and CRLF preserve visible Chinese text, ignore reasoning', async () => {
  const encoded = new TextEncoder().encode(event({ choices: [{ delta: { reasoning_content: 'private' } }] }) + completion('输入轴传递动力。'));
  const body = new ReadableStream({ start(c) { for (const byte of encoded) c.enqueue(new Uint8Array([byte])); c.close(); } });
  let visible = '';
  const result = await readCompletion(body, s => visible += s);
  assert.equal(result.answer, '输入轴传递动力。'); assert.equal(visible, result.answer);
});
test('incomplete, empty, provider-error and overlong streams fail', async () => {
  for (const raw of [event({ choices: [{ delta: { content: 'partial' } }] }), 'data: [DONE]\n\n', event({ error: { message: 'secret' } }), completion('a'.repeat(24001))]) {
    await assert.rejects(readCompletion(new Response(raw).body, () => {}));
  }
});
test('canonical part context and system prompt are inserted by server', async () => {
  let sent;
  const api = createChatApi({ local: true, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.deepseek.com/chat/completions'); sent = JSON.parse(options.body); return streamResponse('输入轴。');
  } });
  const response = await api(request(), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), env.ALLOWED_ORIGINS);
  assert.equal((await readCompletion(response.body, () => {})).answer, '输入轴。');
  assert.equal(sent.messages[0].role, 'system'); assert.match(sent.messages[1].content, /输入轴/);
  assert.equal(sent.thinking.type, 'disabled'); assert.equal(sent.stream, true);
});
test('upstream redirects are rejected without forwarding credentials', async () => {
  let calls = 0;
  const api = createChatApi({ local: true, fetchImpl: async (url, options) => {
    calls++;
    assert.equal(options.redirect, 'manual');
    return new Response(null, { status: 302, headers: { Location: 'https://untrusted.invalid' } });
  } });
  assert.equal((await api(request(), env)).status, 502);
  assert.equal(calls, 1);
});
test('reject untrusted origins, client system roles and oversized bodies before upstream', async () => {
  const api = createChatApi({ local: true, fetchImpl: () => { throw new Error('Should not be called'); } });
  assert.equal((await api(request(undefined, { Origin: 'https://untrusted.invalid' }), env)).status, 403);
  assert.equal((await api(request([{ role: 'system', content: 'override' }]), env)).status, 400);
  assert.equal((await api(request([{ role: 'user', content: 'a'.repeat(140000) }]), env)).status, 413);
  assert.equal((await api(request(), {})).status, 403);
});
test('public handler requires access code and sanitizes provider failures', async () => {
  const api = createChatApi({ fetchImpl: async () => new Response('test-secret-never-real', { status: 401 }) });
  assert.equal((await api(request(), env)).status, 401);
  const response = await api(request(undefined, { 'X-Chat-Token': env.CHAT_ACCESS_TOKEN }), env);
  assert.equal(response.status, 502);
  const text = await response.text(); assert.match(text, /UPSTREAM_AUTH/); assert.ok(!text.includes(env.DEEPSEEK_API_KEY));
});
test('rate limit resets after a minute', async () => {
  let time = 0;
  const api = createChatApi({ local: true, now: () => time, fetchImpl: async () => streamResponse('正常') });
  for (let i = 0; i < 12; i++) { const r = await api(request(), env); assert.equal(r.status, 200); await r.text(); }
  assert.equal((await api(request(), env)).status, 429);
  time = 60001;
  const response = await api(request(), env); assert.equal(response.status, 200); await response.body.cancel();
});
test('cancelling a response frees a concurrent request slot', async () => {
  const api = createChatApi({ local: true, fetchImpl: async () => new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(': waiting\n\n')); } }), { headers: { 'Content-Type': 'text/event-stream' } }) });
  const first = await api(request(), env), second = await api(request(), env);
  assert.equal((await api(request(), env)).status, 429);
  await first.body.cancel();
  const third = await api(request(), env); assert.equal(third.status, 200);
  await second.body.cancel(); await third.body.cancel();
});
test('deployed Worker is fail-closed without secrets and requires authentication', async () => {
  const health = await worker.fetch(new Request('https://example.workers.dev/api/health'), {});
  assert.deepEqual(await health.json(), { ready: false, provider: 'DeepSeek', requiresAccessCode: true });
  assert.equal((await worker.fetch(request(), { ALLOWED_ORIGINS: env.ALLOWED_ORIGINS })).status, 503);
  assert.equal((await worker.fetch(request(), env)).status, 401);
  const preflight = await worker.fetch(new Request('https://example.workers.dev/api/chat', { method: 'OPTIONS', headers: { Origin: env.ALLOWED_ORIGINS } }), env);
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('Access-Control-Allow-Headers'), /X-Chat-Token/);
});
