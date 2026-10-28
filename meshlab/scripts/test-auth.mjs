import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT } from 'jose';
import { authenticate } from '../server/firebase-auth.mjs';
test('verified email token accepted; forged, expired, wrong-project and unverified tokens rejected', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const claims = { email: 'person@example.com', email_verified: true, auth_time: Math.floor(Date.now()/1000), firebase: { sign_in_provider: 'password' } };
  const token = extra => new SignJWT({ ...claims, ...extra }).setProtectedHeader({ alg: 'RS256', kid: 'test' }).setSubject('account-1').setIssuer('https://securetoken.google.com/project-1').setAudience('project-1').setIssuedAt().setExpirationTime(extra.exp || '1h').sign(privateKey);
  const request = value => new Request('https://example.com/api/chat', { headers: { Authorization: 'Bearer ' + value } });
  const valid = await token({});
  assert.deepEqual(await authenticate(request(valid), 'project-1', () => publicKey), { uid: 'account-1' });
  assert.equal(await authenticate(request(valid), 'other-project', () => publicKey), null);
  assert.equal(await authenticate(request(await token({ email_verified: false })), 'project-1', () => publicKey), null);
  assert.equal(await authenticate(request(await token({ exp: 1 })), 'project-1', () => publicKey), null);
  const [header, body, sig] = valid.split('.');
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url')), sub: 'another-user' })).toString('base64url');
  assert.equal(await authenticate(request([header, forged, sig].join('.')), 'project-1', () => publicKey), null);
});
