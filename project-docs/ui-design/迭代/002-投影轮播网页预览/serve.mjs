import http from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const preview = path.join(here, 'dist');
// Freeze preview dependencies for reproducible branch-only archives.
const shared = path.join(here, 'shared');
const allowed = new Set(['assets/three.module.js', 'assets/OrbitControls.js', 'assets/reference-stage.mjs', 'friction/viewer.mjs', 'friction/mechanics.mjs', 'rack/viewer.mjs', 'rack/mechanics.mjs']);
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8'};
const port = Number(process.env.MESHLAB_PROJECTION_PORT || 8092);
const server = http.createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const url = new URL(req.url, 'http://127.0.0.1');
    const pathname = decodeURIComponent(url.pathname);
    if (pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    let file;
    if (pathname.startsWith('/shared/')) {
      const key = pathname.slice(8);
      if (!allowed.has(key)) { res.writeHead(404); res.end('Not found'); return; }
      file = path.join(shared, key);
    } else {
      file = path.resolve(preview, '.' + pathname);
      const relative = path.relative(preview, file);
      if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403); res.end(); return; }
      if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    }
    const data = await readFile(file);
    res.writeHead(200, {'content-type':mime[path.extname(file)] || 'application/octet-stream','cache-control':'no-store','x-content-type-options':'nosniff'});
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}/`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
