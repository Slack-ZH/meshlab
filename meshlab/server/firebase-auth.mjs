import { importX509, jwtVerify } from 'jose';

const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certs = {}, expiresAt = 0, lastRefresh = 0, loading;
async function googleKey(header) {
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || header.kid.length > 128) throw new Error('Invalid key');
  const now = Date.now();
  if (now >= expiresAt || (!certs[header.kid] && now - lastRefresh > 60000)) {
    loading ||= (async () => {
      const response = await fetch(CERTS_URL, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Identity service unavailable');
      certs = await response.json();
      const maxAge = Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] || 300);
      lastRefresh = Date.now(); expiresAt = lastRefresh + Math.min(maxAge, 21600) * 1000;
    })().finally(() => { loading = null; });
    await loading;
  }
  if (typeof certs[header.kid] !== 'string') throw new Error('Unknown key');
  return importX509(certs[header.kid], 'RS256');
}

export async function authenticate(request, projectId, keyResolver = googleKey) {
  const token = request.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
  if (!token || token.length > 8192 || !projectId) return null;
  try {
    const { payload } = await jwtVerify(token, keyResolver, {
      algorithms: ['RS256'], audience: projectId, issuer: 'https://securetoken.google.com/' + projectId,
      requiredClaims: ['exp', 'iat', 'auth_time', 'sub'], clockTolerance: 5
    });
    const now = Date.now() / 1000;
    if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128 ||
        typeof payload.iat !== 'number' || payload.iat > now + 5 ||
        typeof payload.auth_time !== 'number' || payload.auth_time > now + 5 ||
        payload.email_verified !== true || typeof payload.email !== 'string' ||
        payload.firebase?.sign_in_provider !== 'password') return null;
    return { uid: payload.sub };
  } catch { return null; }
}
