import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Match the user's configured network route. Node fetch does not automatically
// inherit the Windows proxy used by the browser; this changes this process only.
if (typeof http.setGlobalProxyFromEnv === 'function') {
  let proxyEnv = process.env;
  if (process.platform === 'win32' && !['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy'].some(key => process.env[key])) {
    try {
      const settings = execFileSync('reg.exe', ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'],
        { encoding:'utf8', windowsHide:true, timeout:2000, stdio:['ignore','pipe','ignore'] });
      const enabled = /ProxyEnable\s+REG_DWORD\s+0x1\b/.test(settings);
      const configured = settings.match(/ProxyServer\s+REG_SZ\s+([^\r\n]+)/)?.[1].trim();
      if (enabled && configured) {
        const byProtocol = Object.fromEntries(configured.split(';').filter(value => value.includes('=')).map(value => value.split('=')));
        const address = byProtocol.https || byProtocol.http || (!configured.includes('=') ? configured : '');
        if (address) {
          const proxy = new URL(address.includes('://') ? address : 'http://' + address);
          if (['http:','https:'].includes(proxy.protocol)) proxyEnv = { ...process.env, HTTPS_PROXY:proxy.href, HTTP_PROXY:proxy.href,
            NO_PROXY:process.env.NO_PROXY || process.env.no_proxy || 'localhost,127.0.0.1,[::1]' };
        }
      }
    } catch { /* A machine without a static Windows proxy uses its environment. */ }
  }
  const noProxy = [proxyEnv.no_proxy || proxyEnv.NO_PROXY, 'localhost', '127.0.0.1', '[::1]'].filter(Boolean).join(',');
  http.setGlobalProxyFromEnv({ ...proxyEnv, NO_PROXY:noProxy, no_proxy:noProxy });
}

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.env.PORT || 8080);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid PORT');
const allowedHosts = [`localhost:${port}`, `127.0.0.1:${port}`];
const config = JSON.parse(await readFile(resolve(root, 'chat-config.json'), 'utf8'));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.pdf': 'application/pdf', '.csv': 'text/csv; charset=utf-8', '.zip': 'application/zip' };

const server = http.createServer(async (req, res) => {
  const abort = new AbortController();
  res.on('close', () => { if (!res.writableEnded) abort.abort(); });
  try {
    if (!allowedHosts.includes(req.headers.host)) { res.writeHead(403); res.end('Host not allowed'); return; }
    const url = new URL(req.url, 'http://' + req.headers.host);
    if (url.pathname.startsWith('/api/')) {
      const headers = new Headers(req.headers);
      headers.delete('host'); headers.set('Origin', 'https://slack-zh.github.io');
      const request = new Request(config.apiBase + url.pathname.slice(4), { method: req.method, headers,
        ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: Readable.toWeb(req), duplex: 'half' }), signal: abort.signal });
      const response = await fetch(request, { redirect: 'manual', signal:AbortSignal.any([abort.signal,AbortSignal.timeout(70000)]) });
      const responseHeaders = new Headers(response.headers);
      // fetch has already decoded compressed responses before forwarding bytes.
      responseHeaders.delete('content-encoding'); responseHeaders.delete('content-length');
      res.writeHead(response.status, Object.fromEntries(responseHeaders));
      res.flushHeaders();
      if (response.body) await pipeline(Readable.fromWeb(response.body), res);
      else res.end();
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    if (url.pathname === '/chat-config.json') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ ...config, apiBase: '/api' })); return;
    }
    const path = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (path !== root.replace(/[\\/]$/, '') && !path.startsWith(root.endsWith(sep) ? root : root + sep)) { res.writeHead(403); res.end(); return; }
    const file = (await stat(path)).isDirectory() ? resolve(path, 'index.html') : path;
    const content = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Content-Length': content.length,
      'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch (error) {
    if (res.headersSent) { res.destroy(); return; }
    if (req.url.startsWith('/api/')) {
      res.writeHead(502, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' });
      res.end(JSON.stringify({code:'LOCAL_UPSTREAM_UNAVAILABLE',message:'本地预览未能连接 AI 服务，请检查网络和系统代理后重试。'})); return;
    }
    res.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(error.code === 'ENOENT' ? 'Not found' : 'Request failed');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`MeshLab preview: http://127.0.0.1:${port} (shared cloud account budget)`));
