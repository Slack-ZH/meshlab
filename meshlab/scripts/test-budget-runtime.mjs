import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { build } from 'esbuild';
const requireWrangler = createRequire(realpathSync('node_modules/wrangler/package.json'));
const { Miniflare, convertV4MiniflareOptions } = requireWrangler('miniflare');
const built = await build({ stdin: { contents: `
  import {BudgetLedger} from './server/budget.mjs';
  export class LedgerTest {
    constructor(ctx) {this.ledger=new BudgetLedger(ctx.storage);}
    async fetch(request) {
      try {const x=await request.json();const value=x.op==='reserve'?await this.ledger.reserve(x.amount):x.op==='settle'?await this.ledger.settle(x.ticket,x.cost):await this.ledger.status();return Response.json(value||{});}
      catch(error){return Response.json({code:error.code},{status:error.status||500});}
    }
  }
  export default {fetch(){return new Response('test-only');}};
`, resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'browser' });
const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: 'budget-test', modules: true, script: built.outputFiles[0].text, compatibilityDate: '2026-10-28',
  durableObjects: { BUDGET: { className: 'LedgerTest', useSQLite: true } } }] }));
try {
  const ns = await mf.getDurableObjectNamespace('BUDGET', 'budget-test');
  const account = ns.get(ns.idFromName('account-a'));
  const send = body => account.fetch('https://internal/', { method: 'POST', body: JSON.stringify(body) });
  const responses = await Promise.all([send({ op: 'reserve', amount: 1200000000 }), send({ op: 'reserve', amount: 1200000000 })]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 429]);
  const ticket = await responses.find(r => r.status === 200).json();
  await send({ op: 'settle', ticket, cost: 100000000 });
  assert.equal((await (await send({ op: 'status' })).json()).usedCny, 0.1);
  const second = ns.get(ns.idFromName('account-b'));
  assert.equal((await (await second.fetch('https://internal/', { method: 'POST', body: '{"op":"status"}' })).json()).remainingCny, 2);
  console.log('Workerd SQLite: atomic concurrent cap, settlement and account isolation passed.');
} finally { await mf.dispose(); }
