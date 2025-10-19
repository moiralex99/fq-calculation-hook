import { createAutomationEngine } from '../src/lib/automation-engine.js';
import { createJsonLogicEvaluator } from '../src/lib/jsonlogic-evaluator.js';

// Mock collections relations
// campagne -> calendriers -> domaines -> processus -> taches

// in-memory data store
const db = {
  campagnes: [ { id: 1, date_fin: '2025-12-31' } ],
  calendriers: [
    { id: 11, campagne_id: 1, date_fin: null },
    { id: 12, campagne_id: 1, date_fin: '2025-11-01' }
  ],
  domaines: [
    { id: 21, calendrier_id: 11, date_fin: null },
    { id: 22, calendrier_id: 12, date_fin: null }
  ],
  processus: [
    { id: 31, domaine_id: 21, date_fin: null },
    { id: 32, domaine_id: 22, date_fin: null }
  ],
  taches: [
    { id: 41, processus_id: 31, date_fin: null },
    { id: 42, processus_id: 31, date_fin: null },
    { id: 43, processus_id: 32, date_fin: null }
  ]
};

// Minimal executors for update_many
const executors = {
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
      if (match) {
        Object.assign(row, data);
        count++;
      }
    }
    return { count };
  },
  async update_item({ collection, id, data }) {
    const rows = db[collection];
    const row = rows.find(r => r.id === id);
    if (row) Object.assign(row, data);
    return row;
  }
};

const evaluator = createJsonLogicEvaluator();
const engine = createAutomationEngine({ evaluator, logger: console, executors });

// Define bulk cascade automations
const automations = [
  {
    name: 'Cascade campagne → calendriers (bulk)',
    collection_cible: 'campagnes',
    status: 'active',
    trigger_event: ['update'],
    rule: { in: ['date_fin', { var: '$CHANGED' }] },
    actions: [
      { type: 'update_many', collection: 'calendriers', filter: { campagne_id: { _eq: { var: 'id' } } }, data: { date_fin: { var: 'date_fin' } }, assign: 'bulk_cal' }
    ]
  },
  {
    name: 'Cascade calendrier → domaines (bulk)',
    collection_cible: 'calendriers',
    status: 'active',
    trigger_event: ['update'],
    rule: { in: ['date_fin', { var: '$CHANGED' }] },
    actions: [
      { type: 'update_many', collection: 'domaines', filter: { calendrier_id: { _eq: { var: 'id' } } }, data: { date_fin: { var: 'date_fin' } }, assign: 'bulk_dom' }
    ]
  },
  {
    name: 'Cascade domaine → processus (bulk)',
    collection_cible: 'domaines',
    status: 'active',
    trigger_event: ['update'],
    rule: { in: ['date_fin', { var: '$CHANGED' }] },
    actions: [
      { type: 'update_many', collection: 'processus', filter: { domaine_id: { _eq: { var: 'id' } } }, data: { date_fin: { var: 'date_fin' } }, assign: 'bulk_proc' }
    ]
  },
  {
    name: 'Cascade processus → tâches (bulk)',
    collection_cible: 'processus',
    status: 'active',
    trigger_event: ['update'],
    rule: { in: ['date_fin', { var: '$CHANGED' }] },
    actions: [
      { type: 'update_many', collection: 'taches', filter: { processus_id: { _eq: { var: 'id' } } }, data: { date_fin: { var: 'date_fin' } }, assign: 'bulk_task' }
    ]
  }
];

async function run() {
  // 1) Update campagne.date_fin → should update calendriers
  const updates1 = await engine.evaluate({
    collection: 'campagnes',
    automations,
    newData: { ...db.campagnes[0], date_fin: '2025-10-10' },
    oldData: db.campagnes[0],
    context: { $USER: { id: 'tester' } }
  });
  console.log('Step1 updates:', updates1);

  // Simulate Directus chain: calendrier update triggers next automation
  const calToUpdate = db.calendriers.filter(c => c.campagne_id === 1);
  for (const cal of calToUpdate) {
    const updates2 = await engine.evaluate({
      collection: 'calendriers',
      automations,
      newData: { ...cal },
      oldData: { ...cal, date_fin: null },
      context: { $USER: { id: 'tester' } }
    });
    console.log('Step2 updates (calendrier):', updates2);
  }

  // Then domaines
  const domToUpdate = db.domaines;
  for (const dom of domToUpdate) {
    const updates3 = await engine.evaluate({
      collection: 'domaines',
      automations,
      newData: { ...dom },
      oldData: { ...dom, date_fin: null },
      context: { $USER: { id: 'tester' } }
    });
    console.log('Step3 updates (domaine):', updates3);
  }

  // Then processus
  const procToUpdate = db.processus;
  for (const proc of procToUpdate) {
    const updates4 = await engine.evaluate({
      collection: 'processus',
      automations,
      newData: { ...proc },
      oldData: { ...proc, date_fin: null },
      context: { $USER: { id: 'tester' } }
    });
    console.log('Step4 updates (processus):', updates4);
  }

  console.log('\n=== Final DB ===');
  console.dir(db, { depth: 5 });
}

run().catch(console.error);
