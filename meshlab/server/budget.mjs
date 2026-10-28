// CNY in integer nano-yuan. Peak rates deliberately overestimate off-peak/cache discounts.
export const DAILY_LIMIT = 2_000_000_000;
export const MAX_OUTPUT_TOKENS = 2048;
export const PRICING = Object.freeze({ model: 'deepseek-flash', input: 2000, output: 8000, checked: '2026-10-28' });
const DAY_MS = 86400000;
export const budgetDay = ms => new Date(ms + 8 * 3600000).toISOString().slice(0, 10);
export const resetAt = day => new Date(Date.parse(day + 'T00:00:00+08:00') + DAY_MS).toISOString();

export function reserveCost(messages, model) {
  if (model !== PRICING.model) throw new Error('PRICING_NOT_CONFIGURED');
  // UTF-8 bytes bound text tokenization conservatively, with additional format overhead.
  const inputBound = 2 * new TextEncoder().encode(JSON.stringify(messages)).length + 512 * messages.length + 4096;
  return inputBound * PRICING.input + MAX_OUTPUT_TOKENS * PRICING.output;
}
export function usageCost(usage) {
  if (!usage || !Number.isSafeInteger(usage.prompt_tokens) || usage.prompt_tokens < 0 ||
      !Number.isSafeInteger(usage.completion_tokens) || usage.completion_tokens < 0 ||
      usage.completion_tokens > MAX_OUTPUT_TOKENS) return null;
  const amount = usage.prompt_tokens * PRICING.input + usage.completion_tokens * PRICING.output;
  return Number.isSafeInteger(amount) ? amount : null;
}
export class BudgetError extends Error {
  constructor(code, message, status = 429) { super(message); this.code = code; this.status = status; }
}
function snapshot(day, state) {
  const occupied = state.charged + Object.values(state.holds).reduce((sum, h) => sum + h.amount, 0);
  return { day, limitCny: 2, usedCny: occupied / 1e9, remainingCny: Math.max(0, DAILY_LIMIT - occupied) / 1e9,
    resetAt: resetAt(day), accounting: 'conservative-peak-rates', blocked: state.blocked || occupied >= DAILY_LIMIT };
}
function emptyState() { return { charged: 0, holds: {}, recent: [], blocked: false }; }

// Cloudflare storage transactions serialize concurrent reservations and survive restarts.
export class BudgetLedger {
  constructor(storage, now = Date.now) { this.storage = storage; this.now = now; }
  async status() {
    const day = budgetDay(this.now());
    return snapshot(day, await this.storage.get('day:' + day) || emptyState());
  }
  async reserve(amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Invalid reservation');
    const time = this.now(), day = budgetDay(time), id = crypto.randomUUID();
    return this.storage.transaction(async tx => {
      const key = 'day:' + day, state = await tx.get(key) || emptyState();
      const occupied = state.charged + Object.values(state.holds).reduce((sum, h) => sum + h.amount, 0);
      if (state.blocked || occupied + amount > DAILY_LIMIT) {
        throw new BudgetError('DAILY_BUDGET_EXCEEDED', '今日剩余额度不足以完成本次回答，请缩短对话或明天再试。北京时间零点重置。');
      }
      state.recent = state.recent.filter(t => time - t < 60000);
      const active = Object.values(state.holds).filter(h => h.expiresAt > time).length;
      if (state.recent.length >= 12 || active >= 2) throw new BudgetError('RATE_LIMITED', '提问较频繁，请稍等片刻再试。');
      // Expired holds still occupy money: missing usage must never refund unknown charges.
      state.holds[id] = { amount, expiresAt: time + 90000 };
      state.recent.push(time);
      await tx.put(key, state);
      return { id, day, amount };
    });
  }
  async settle(ticket, cost = null) {
    await this.storage.transaction(async tx => {
      const key = 'day:' + ticket.day, state = await tx.get(key);
      if (!state?.holds[ticket.id]) return; // Repeated completion/cancel is idempotent.
      const held = state.holds[ticket.id].amount;
      const charge = Number.isSafeInteger(cost) && cost >= 0 ? cost : held;
      state.charged += charge;
      delete state.holds[ticket.id];
      if (charge > held) state.blocked = true; // Fail closed if provider semantics ever change.
      await tx.put(key, state);
    });
  }
}

// Parse usage independently of browser consumption; only terminal provider usage is trusted.
export class UsageTracker {
  constructor() { this.decoder = new TextDecoder(); this.buffer = ''; this.cost = null; this.done = false; }
  push(bytes) {
    this.buffer += this.decoder.decode(bytes, { stream: true });
    this.buffer = this.buffer.replace(/\r\n/g, '\n');
    let boundary;
    while ((boundary = this.buffer.indexOf('\n\n')) >= 0) {
      const block = this.buffer.slice(0, boundary); this.buffer = this.buffer.slice(boundary + 2);
      const data = block.split('\n').filter(s => s.startsWith('data:')).map(s => s.slice(5).trimStart()).join('\n').trim();
      if (!data) continue;
      if (data === '[DONE]') { this.done = true; continue; }
      try {
        const chunk = JSON.parse(data);
        if (chunk.usage && (chunk.choices?.length === 0 || chunk.choices?.some(c => c.finish_reason))) this.cost = usageCost(chunk.usage);
      } catch { /* malformed/interrupted usage retains the conservative reservation */ }
    }
    if (this.buffer.length > 65536) throw new Error('UPSTREAM_STREAM_INVALID');
  }
}
