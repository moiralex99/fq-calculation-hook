import { createAutomationEngine } from '../src/lib/automation-engine.js';
import { createJsonLogicEvaluator } from '../src/lib/jsonlogic-evaluator.js';

function assert(cond, msg) { if (!cond) throw new Error('Assertion failed: ' + msg); }
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Simple automation that sets note from payload, always matches
const automation = {
  id: 'auto-1',
  name: 'Throttle test',
  collection_cible: 'items',
  status: 'active',
  priority: 1,
  trigger_event: ['update'],
  throttle_ms: 200,
  throttle_scope: 'item',
  rule: { '>': [1, 0] },
  actions: [ { type: 'set_field', field: 'note', value: { var: 'note' } } ]
};

const evaluator = createJsonLogicEvaluator();
const engine = createAutomationEngine({ evaluator, logger: console, executors: {} });

// Throttle registry (mirrors index.js behavior)
const throttleTimers = new Map();
let evaluateCount = 0;

function makeThrottleKey({ rule, collection, meta, scope }) {
  const parts = ['auto', String(rule.id ?? rule.name ?? 'unknown')];
  if (scope === 'collection') parts.push(String(collection));
  else if (scope === 'item') parts.push(String(meta?.keys?.[0] ?? 'unknown'));
  else if (scope === 'user') parts.push(String(meta?.accountability?.user ?? 'anon'));
  return parts.join('::');
}

async function throttledEvaluate({ rule, collection, payload, oldData, meta, user }) {
  const throttleMs = Number(rule.throttle_ms) || 0;
  const scope = rule.throttle_scope || 'rule';
  if (throttleMs <= 0) {
    evaluateCount++;
    return engine.evaluate({ collection, automations: [rule], newData: payload, oldData, context: { $USER: user } });
  }
  const key = makeThrottleKey({ rule, collection, meta, scope });
  if (throttleTimers.has(key)) clearTimeout(throttleTimers.get(key).timer);
  const record = throttleTimers.get(key) || { lastPayload: null, lastOld: null, promise: null, resolve: null };
  record.lastPayload = payload;
  record.lastOld = oldData;
  const promise = new Promise((resolve) => { record.resolve = resolve; });
  const timer = setTimeout(async () => {
    try {
      evaluateCount++;
      const updates = await engine.evaluate({ collection, automations: [rule], newData: record.lastPayload, oldData: record.lastOld, context: { $USER: user } });
      record.resolve(updates);
    } catch (e) { record.resolve({ __error: e?.message || String(e) }); }
    throttleTimers.delete(key);
  }, throttleMs);
  throttleTimers.set(key, { ...record, timer });
  return promise;
}

async function run() {
  const collection = 'items';
  const user = { id: 'u-1' };

  // Simulate bursts on 2 different items (scope = item)
  const meta1 = { keys: [1], accountability: { user: user.id } };
  const meta2 = { keys: [2], accountability: { user: user.id } };

  // Burst 1 (item 1)
  throttledEvaluate({ rule: automation, collection, payload: { id: 1, note: 'A' }, oldData: { id: 1, note: null }, meta: meta1, user });
  await delay(50);
  throttledEvaluate({ rule: automation, collection, payload: { id: 1, note: 'B' }, oldData: { id: 1, note: null }, meta: meta1, user });
  await delay(50);
  const p1c = throttledEvaluate({ rule: automation, collection, payload: { id: 1, note: 'C' }, oldData: { id: 1, note: null }, meta: meta1, user });
  const r1 = await p1c; // resolves after throttle

  // Wait past throttle window to isolate bursts
  await delay(250);

  // Burst 2 (item 2)
  throttledEvaluate({ rule: automation, collection, payload: { id: 2, note: 'D' }, oldData: { id: 2, note: null }, meta: meta2, user });
  await delay(20);
  const p2b = throttledEvaluate({ rule: automation, collection, payload: { id: 2, note: 'E' }, oldData: { id: 2, note: null }, meta: meta2, user });
  const r2 = await p2b;

  console.log('r1 (item 1):', r1);
  console.log('r2 (item 2):', r2);

  assert(r1.note === 'C', 'Item 1 should use last payload C');
  assert(r2.note === 'E', 'Item 2 should use last payload E');

  // Ensure only 2 evaluations happened (one per item)
  assert(evaluateCount === 2, `Expected 2 evaluations, got ${evaluateCount}`);
  console.log('Throttle test passed. Evaluations:', evaluateCount);
}

run().catch((e) => { console.error(e); process.exit(1); });
