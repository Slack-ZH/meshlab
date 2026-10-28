import model from '../dist/assets/model.json' with { type: 'json' };
import { BudgetError, MAX_OUTPUT_TOKENS, reserveCost, UsageTracker } from './budget.mjs';

const MAX_BODY_BYTES = 131072;
const parts = new Map(model.parts.map(part => [part.id, part]));
const SYSTEM = `你是“啮合实验室 meshlab”的机械教学助手。用清楚、简洁的中文回答，公式写明单位，按需分步解释。
当前项目是 GL16 两级斜齿减速器的课程设计。设计参数为：${JSON.stringify(model.parameters)}。
零件目录：${model.parts.map(p => `${p.id}：${p.name}；${p.spec}`).join('\n')}。
你现在只提供文字问答，没有调用网页或仿真工具的权限。用户要求动作时可以解释操作步骤，但不得声称已旋转、修改或运行模型。
区分设计工况（输入1440 r/min）与网页慢放动画（输入约12 r/min）；传动动画不是动力学、应力或碰撞仿真。
引用当前项目数据时以这些参数和零件资料为准；未知尺寸、载荷与结果需明确说明。不要编造已完成的计算或仿真结果。
优先用短段落和编号步骤；公式用纯文本表达，不输出 HTML。`;

class ChatError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

export function createChatApi({ budget, fetchImpl = fetch } = {}) {
  return async function handle(request, env = {}) {
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const originAllowed = origin && allowed.includes(origin);
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin' };
    if (originAllowed) headers['Access-Control-Allow-Origin'] = origin;
    const json = (body, status = 200) => Response.json(body, { status, headers });
    const configured = Boolean(env.DEEPSEEK_API_KEY?.trim()) && Boolean(budget);
    const path = new URL(request.url).pathname.replace(/\/$/, '');
    try {
      if (!['/api/health', '/api/account', '/api/chat'].includes(path)) throw new ChatError(404, 'NOT_FOUND', '接口不存在。');
      if (origin && !originAllowed) throw new ChatError(403, 'ORIGIN_DENIED', '当前网站未获准连接聊天服务。');
      if (request.method === 'OPTIONS') {
        if (!originAllowed) throw new ChatError(403, 'ORIGIN_DENIED', '来源未获准。');
        return new Response(null, { status: 204, headers: { ...headers,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '600' } });
      }
      if (path === '/api/health' && request.method === 'GET') {
        return json({ ready: configured, provider: 'DeepSeek', requiresLogin: true, dailyLimitCny: 2 });
      }
      if (path === '/api/account' && request.method === 'GET' && configured) return json(await budget.status());
      if (path !== '/api/chat' || request.method !== 'POST') throw new ChatError(405, 'METHOD_NOT_ALLOWED', '请求方式不支持。');
      if (!configured) throw new ChatError(503, 'NOT_CONFIGURED', 'DeepSeek 服务尚未配置完成。');
      if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
        throw new ChatError(415, 'INVALID_TYPE', '请使用 JSON 格式发送问题。');
      }
      const payload = await readJson(request);
      const messages = validateMessages(payload);
      const modelName = env.DEEPSEEK_MODEL || 'deepseek-flash';
      const prompt = [{ role: 'system', content: SYSTEM }, ...messages];
      const ticket = await budget.reserve(reserveCost(prompt, modelName));
      const usage = new UsageTracker();
      let settlement;
      const settle = (amount = null) => settlement ||= budget.settle(ticket, amount);
      try {
        const signal = AbortSignal.any([request.signal, AbortSignal.timeout(65000)]);
        const upstream = await fetchImpl('https://api.deepseek.com/chat/completions', {
          // Workers supports manual/follow, not the Node redirect:error option.
          // Reject 3xx below so credentials never follow an upstream redirect.
          method: 'POST', signal, redirect: 'manual',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.DEEPSEEK_API_KEY.trim()}` },
          body: JSON.stringify({ model: modelName, messages: prompt,
            thinking: { type: 'disabled' }, stream: true, stream_options: { include_usage: true },
            max_tokens: MAX_OUTPUT_TOKENS, temperature: 0.5 })
        });
        if (!upstream.ok) {
          await upstream.body?.cancel();
          if ([400, 401, 402, 429].includes(upstream.status)) await settle(0);
          const errors = {
            401: ['UPSTREAM_AUTH', 'DeepSeek 密钥验证失败，请联系网站维护者。'],
            402: ['UPSTREAM_BALANCE', 'DeepSeek 账户余额不足，请联系网站维护者。'],
            429: ['UPSTREAM_LIMIT', 'DeepSeek 请求繁忙，请稍后重试。']
          };
          const [code, message] = errors[upstream.status] || ['UPSTREAM_ERROR', 'DeepSeek 暂时无法回复，请稍后重试。'];
          throw new ChatError(upstream.status === 429 ? 429 : 502, code, message);
        }
        if (!upstream.body || !upstream.headers.get('Content-Type')?.includes('text/event-stream')) {
          await upstream.body?.cancel();
          throw new ChatError(502, 'UPSTREAM_FORMAT', 'AI 回复格式异常，请稍后重试。');
        }
        const reader = upstream.body.getReader();
        const stream = new ReadableStream({
          async pull(controller) {
            try {
              const { done, value } = await reader.read();
              if (done) { await settle(usage.done ? usage.cost : null); controller.close(); }
              else {
                usage.push(value);
                if (usage.done) await settle(usage.cost);
                controller.enqueue(value);
              }
            } catch (error) { await settle(); controller.error(error); }
          },
          async cancel(reason) { try { await reader.cancel(reason); } finally { await settle(usage.done ? usage.cost : null); } }
        });
        return new Response(stream, { headers: { ...headers, 'Content-Type': 'text/event-stream; charset=utf-8' } });
      } catch (error) { await settle(); throw error; }
    } catch (error) {
      if (error instanceof ChatError || error instanceof BudgetError) return json({ code: error.code, message: error.message }, error.status);
      if (['TimeoutError', 'AbortError'].includes(error.name)) return json({ code: 'TIMEOUT', message: '等待 AI 回复超时，请重试。' }, 504);
      // Record a short, redacted runtime diagnostic; never return it to clients.
      let diagnostic = String(error.message || error.name || 'unknown');
      for (const secret of [env.DEEPSEEK_API_KEY, request.headers.get('Authorization')]) {
        if (secret) diagnostic = diagnostic.split(secret).join('[redacted]');
      }
      console.error('CHAT_RUNTIME_ERROR', error.name, diagnostic.slice(0, 200));
      return json({ code: 'SERVICE_ERROR', message: '暂时无法连接 AI，请稍后重试。' }, 502);
    }
  };
}

async function readJson(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) throw new ChatError(413, 'TOO_LARGE', '对话过长，请开始新对话。');
  if (!request.body) throw new ChatError(400, 'INVALID_BODY', '问题不能为空。');
  const reader = request.body.getReader();
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new ChatError(413, 'TOO_LARGE', '对话过长，请开始新对话。'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new ChatError(400, 'INVALID_JSON', '请求格式不正确。'); }
}

function validateMessages(payload) {
  const input = payload?.messages;
  if (!Array.isArray(input) || !input.length || input.length > 21 || input.length % 2 !== 1) {
    throw new ChatError(400, 'INVALID_MESSAGES', '对话格式不正确，请开始新对话。');
  }
  let total = 0;
  return input.map((m, index) => {
    const role = index % 2 === 0 ? 'user' : 'assistant';
    const max = role === 'user' ? 2000 : 24000;
    if (m?.role !== role || typeof m.content !== 'string' || !m.content.trim() || m.content.length > max) {
      throw new ChatError(400, 'INVALID_MESSAGE', '消息格式不正确或内容过长。');
    }
    total += m.content.length;
    if (total > 32000) throw new ChatError(413, 'TOO_LARGE', '对话过长，请开始新对话。');
    const part = role === 'user' && parts.get(m.selectedPartId);
    const context = part ? `【本次提问时选中：${part.name}（${part.id}）；规格：${part.spec}；材料：${part.material}；作用：${part.description}】\n` : '';
    return { role, content: context + m.content.trim() };
  });
}
