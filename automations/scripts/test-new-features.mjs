import { createAutomationEngine } from '../src/lib/automation-engine.js';
import { createJsonLogicEvaluator } from '../src/lib/jsonlogic-evaluator.js';

function assert(cond, msg) { if (!cond) throw new Error('Assertion failed: ' + msg); }

// In-memory DB
const db = {
  items: [ { id: 1, status: 'active', archived_at: null, note: null, note2: null } ],
  processus: [ { id: 10, date_fin: null } ],
  taches: [
    { id: 101, processus_id: 10, date_fin: null },
    { id: 102, processus_id: 10, date_fin: null }
  ]
};

// Mock executors
const executors = {
  async update_item({ collection, id, data }) {
    const rows = db[collection];
    const row = rows.find(r => r.id === id);
    if (row) Object.assign(row, data);
    return row;
  },
  async update_many({ collection, filter = {}, data = {} }) {
    const rows = db[collection];
    const keys = Object.keys(filter);
    let count = 0;
    for (const row of rows) {
      let match = true;
      for (const k of keys) {
        const cond = filter[k];
        if (cond && typeof cond === 'object' && Object.prototype.hasOwnProperty.call(cond, '_eq')) {
          if (row[k] !== cond._eq) { match = false; break; }
        } else if (row[k] !== cond) { match = false; break; }
      }
      if (match) { Object.assign(row, data); count++; }
    }
    return { count };
  },
  async trigger_flow({ key, payload }) {
    console.log('[Mock] trigger_flow', key, payload);
  },
  async send_email({ to, subject }) {
    console.log('[Mock] send_email', to, subject);
  }
};

const evaluator = createJsonLogicEvaluator();
const engine = createAutomationEngine({ evaluator, logger: console, executors });

// Automations under test
const autos = {
  when_tests: [{
    name: 'Action-level when (skip/apply)',
    collection_cible: 'items',
    status: 'active',
    trigger_event: ['update'],
    rule: { '>': [1, 0] },
    actions: [
      { type: 'set_field', field: 'note', value: 'SHOULD_NOT_SET', when: false },
      { type: 'set_field', field: 'note2', value: 'OK', when: true }
    ]
  }],
  update_item_when: [{
    name: 'Archive when status becomes inactive',
    collection_cible: 'items',
    status: 'active',
    trigger_event: ['update'],
    rule: { and: [ { in: ['status', { var: '$CHANGED' }] }, { '==': [ { var: 'status' }, 'inactive' ] } ] },
    actions: [
      { type: 'update_item', collection: 'items', id: { var: 'id' }, data: { archived_at: 'NOW()' } }
    ]
  }],
  update_many_bulk: [{
    name: 'Cascade processus → taches (bulk)',
    collection_cible: 'processus',
    status: 'active',
    trigger_event: ['update'],
    rule: { in: ['date_fin', { var: '$CHANGED' }] },
    actions: [
      { type: 'update_many', collection: 'taches', filter: { processus_id: { _eq: { var: 'id' } } }, data: { date_fin: { var: 'date_fin' } }, assign: 'bulk' }
    ]
  }]
};

async function run() {
  console.log('--- Test 1: action-level when ---');
  const updates1 = await engine.evaluate({
    collection: 'items',
    automations: autos.when_tests,
    newData: db.items[0],
    oldData: db.items[0],
    context: { $USER: { id: 'u1' } }
  });
  console.log('updates1:', updates1);
  assert(!('note' in updates1), 'note should be skipped by when=false');
  assert(updates1.note2 === 'OK', 'note2 should be set by when=true');

  console.log('\n--- Test 2: update_item with status change ---');
  const updates2 = await engine.evaluate({
    collection: 'items',
    automations: autos.update_item_when,
    newData: { ...db.items[0], id: 1, status: 'inactive' },
    oldData: { ...db.items[0], status: 'active' },
    context: { $USER: { id: 'u1' } }
  });
  console.log('updates2:', updates2);
  assert(db.items[0].archived_at !== null, 'archived_at should be set via update_item');

  console.log('\n--- Test 3: update_many bulk ---');
  const updates3 = await engine.evaluate({
    collection: 'processus',
    automations: autos.update_many_bulk,
    newData: { ...db.processus[0], date_fin: '2025-10-10' },
    oldData: { ...db.processus[0], date_fin: null },
    context: { $USER: { id: 'u1' } }
  });
  console.log('updates3:', updates3);
  const t = db.taches;
  assert(t[0].date_fin === '2025-10-10' && t[1].date_fin === '2025-10-10', 'all tasks should receive date_fin');

  console.log('\nAll new-features tests passed.');
}

run().catch(e => { console.error(e); process.exit(1); });
