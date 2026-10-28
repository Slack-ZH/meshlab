import { createChatApi } from './chat-api.mjs';
import { authenticate } from './firebase-auth.mjs';
import { BudgetLedger } from './budget.mjs';

export class AccountBudget {
  constructor(ctx, env) {
    this.env = env;
    this.handle = createChatApi({ budget: new BudgetLedger(ctx.storage) });
  }
  fetch(request) { return this.handle(request, this.env); }
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
    const headers = { 'Cache-Control': 'no-store', Vary: 'Origin', 'X-Content-Type-Options': 'nosniff' };
    if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const json = (body, status = 200) => Response.json(body, { status, headers });
    if (origin && !allowed.includes(origin)) return json({ code: 'ORIGIN_DENIED', message: '当前网站未获准连接聊天服务。' }, 403);
    const path = new URL(request.url).pathname.replace(/\/$/, '');
    if (!['/api/health', '/api/account', '/api/chat'].includes(path)) return json({ code: 'NOT_FOUND' }, 404);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
    const ready = Boolean(env.DEEPSEEK_API_KEY && env.FIREBASE_PROJECT_ID && env.ACCOUNT_BUDGET);
    if (path === '/api/health' && request.method === 'GET') return json({ ready, provider: 'DeepSeek', requiresLogin: true, dailyLimitCny: 2 });
    if (!ready) return json({ code: 'NOT_CONFIGURED', message: '邮箱登录服务正在配置，请稍后再试。' }, 503);
    if ((path === '/api/chat' && request.method !== 'POST') || (path === '/api/account' && request.method !== 'GET')) return json({ code: 'METHOD_NOT_ALLOWED' }, 405);
    const user = await authenticate(request, env.FIREBASE_PROJECT_ID);
    if (!user) return json({ code: 'AUTH_REQUIRED', message: '请先登录并完成邮箱验证。' }, 401);
    // Identity comes exclusively from Google's verified token, never a caller-supplied ID.
    const account = env.ACCOUNT_BUDGET.getByName(env.FIREBASE_PROJECT_ID + ':' + user.uid);
    return account.fetch(request);
  }
};
