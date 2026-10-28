import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createChatApi } from './chat-api.mjs';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.env.PORT || 8080);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid PORT');
const allowedHosts = [`localhost:${port}`, `127.0.0.1:${port}`];
const env = { ...process.env, ALLOWED_ORIGINS: allowedHosts.map(h => 'http://' + h).join(',') };
const handleChat = createChatApi({ local: true });
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.pdf': 'application/pdf', '.csv': 'text/csv; charset=utf-8', '.zip': 'application/zip' };

const server = createServer(async (req, res) => {
  const abort = new AbortController();
  res.on('close', () => { if (!res.writableEnded) abort.abort(); });
  try {
    if (!allowedHosts.includes(req.headers.host)) { res.writeHead(403); res.end('Host not allowed'); return; }
    const url = new URL(req.url, 'http://' + req.headers.host);
    if (url.pathname.startsWith('/api/')) {
      const request = new Request(url, { method: req.method, headers: req.headers,
        ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: Readable.toWeb(req), duplex: 'half' }), signal: abort.signal });
      const response = await handleChat(request, env);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.flushHeaders();
      if (response.body) await pipeline(Readable.fromWeb(response.body), res);
      else res.end();
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    if (url.pathname === '/chat-config.json') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ apiBase: '/api' })); return;
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
    res.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(error.code === 'ENOENT' ? 'Not found' : 'Request failed');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`MeshLab preview: http://127.0.0.1:${port} (DeepSeek key ${env.DEEPSEEK_API_KEY ? 'configured' : 'missing'})`));
