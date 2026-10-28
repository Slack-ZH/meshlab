import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { readCompletion } from '../dist/chat-stream.js';

const { apiBase } = JSON.parse(await readFile(new URL('../dist/chat-config.json', import.meta.url), 'utf8'));
assert.equal(new URL(apiBase).protocol, 'https:');
const origin = 'https://slack-zh.github.io';
const fetchApi = (path, options = {}) => fetch(apiBase + path, { ...options, signal: AbortSignal.timeout(75000) });
const health = await fetchApi('/health', { headers: { Origin: origin } });
assert.equal(health.status, 200);
assert.equal(health.headers.get('access-control-allow-origin'), origin);
const data = await health.json();
assert.equal(data.ready, true);
assert.equal(data.requiresLogin, true);
const body = JSON.stringify({ messages: [{ role: 'user', content: '用一句话说明总传动比和设计输出转速。', selectedPartId: 'output' }] });
const denied = await fetchApi('/chat', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body });
assert.equal(denied.status, 401);
const preflight = await fetchApi('/chat', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,authorization' } });
assert.equal(preflight.status, 204);
const otherOrigin = await fetchApi('/health', { headers: { Origin: 'https://untrusted.invalid' } });
assert.equal(otherOrigin.status, 403);
const result = { apiBase, health: data, unauthenticatedStatus: denied.status, preflight: preflight.status, untrustedOrigin: otherOrigin.status, liveRequests: 0 };
if (process.argv.includes('--live')) {
  const token = process.env.FIREBASE_ID_TOKEN?.trim();
  assert.ok(token, 'Set FIREBASE_ID_TOKEN from a verified test account for a live test');
  const response = await fetchApi('/chat', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body });
  assert.equal(response.status, 200, 'Cloud chat request failed');
  result.answer = (await readCompletion(response.body, () => {})).answer;
  result.liveRequests = 1;
}
await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
await writeFile(new URL('../test-results/cloud-verification.json', import.meta.url), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
