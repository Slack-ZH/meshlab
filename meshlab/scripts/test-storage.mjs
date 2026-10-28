export class MemoryStorage {
  constructor() { this.data = new Map(); this.queue = Promise.resolve(); }
  async get(key) { return structuredClone(this.data.get(key)); }
  async put(key, value) { this.data.set(key, structuredClone(value)); }
  transaction(fn) {
    const job = this.queue.then(async () => {
      const before = structuredClone(this.data);
      try { return await fn(this); } catch (error) { this.data = before; throw error; }
    });
    this.queue = job.catch(() => {}); return job;
  }
}
