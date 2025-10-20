import { createAutomationEngine } from '../src/lib/automation-engine.js';
import { createJsonLogicEvaluator } from '../src/lib/jsonlogic-evaluator.js';

// In-memory dataset: Projet → Phases → Tâches → Actions → SousActions
const db = {
  projets: [ { id: 1, nom: 'Projet Démo', priorite: 'moyenne', statut: 'en_cours' } ],
  phases: [
    { id: 11, projet_id: 1, nom: 'Phase 1', statut: 'planifie' },
    { id: 12, projet_id: 1, nom: 'Phase 2', statut: 'planifie' }
  ],
  taches: [
    { id: 21, projet_id: 1, phase_id: 11, titre: 'Tâche A', urgent: false, completed: false },
    { id: 22, projet_id: 1, phase_id: 12, titre: 'Tâche B', urgent: false, completed: false }
  ],
  actions: [ /* { id, tache_id, titre, statut } */ ],
  sous_actions: [ /* { id, action_id, titre, statut } */ ]
};

// Simple id generator per collection
function nextId(collection) {
  const rows = db[collection];
  const max = rows.reduce((m, r) => Math.max(m, r.id || 0), 0);
  return max + 1;
}

// Minimal executors: mutate the in-memory db
const executors = {
  async create_item({ collection, data }) {
    const id = nextId(collection);
    const row = { id, ...data };
    db[collection].push(row);
    return row; // return full created object
  },
  async update_item({ collection, id, data }) {
    const rows = db[collection];
    const idx = rows.findIndex((r) => r.id === id);
    if (idx >= 0) {
      rows[idx] = { ...rows[idx], ...data };
      return rows[idx];
    }
    return null;
  },
  async update_many({ collection, filter = {}, data = {}, limit = -1 }) {
    const rows = db[collection];
    let count = 0;
    for (const row of rows) {
      // very small filter interpreter: only supports { field: { _eq: value } }
      let match = true;
      for (const [field, cond] of Object.entries(filter || {})) {
        if (cond && typeof cond === 'object' && Object.prototype.hasOwnProperty.call(cond, '_eq')) {
          if (row[field] !== cond._eq) { match = false; break; }
        } else {
          if (row[field] !== cond) { match = false; break; }
        }
      }
      if (!match) continue;
      Object.assign(row, data);
      count++;
      if (Number.isFinite(limit) && limit > 0 && count >= limit) break;
    }
    return { count };
  }
};

const evaluator = createJsonLogicEvaluator();
const engine = createAutomationEngine({ evaluator, logger: console, executors });

// Automations under test
const automations = [
  // 1) Projet → updates phases + tasks (modification multi-niveaux)
  {
    name: 'Projet → Phases & Tâches (update)',
    collection_cible: 'projets',
    status: 'active',
    trigger_event: ['update'],
    rule: {
      and: [
        { in: ['priorite', { var: '$CHANGED' }] },
        { in: [ { var: 'priorite' }, ['haute', 'critique'] ] }
      ]
    },
    actions: [
      { type: 'update_many', collection: 'phases', filter: { projet_id: { _eq: { var: 'id' } } }, data: { statut: 'en_cours' } },
      { type: 'update_many', collection: 'taches', filter: { projet_id: { _eq: { var: 'id' } } }, data: { urgent: true } }
    ]
  },
  // 2) Tâche urgente → créer une Action (création)
  {
    name: 'Tâche urgente → Créer Action',
    collection_cible: 'taches',
    status: 'active',
    trigger_event: ['update'],
    rule: {
      and: [
        { in: ['urgent', { var: '$CHANGED' }] },
        { '===': [ { var: 'urgent' }, true ] }
      ]
    },
    actions: [
      {
        type: 'create_item',
        collection: 'actions',
        data: {
          tache_id: { var: 'id' },
          titre: { concat: ['Kickoff pour tâche ', { var: 'id' }] },
          statut: 'a_faire'
        }
      }
    ]
  },
  // 3) Action créée → créer une SousAction (création suivant niveau)
  {
    name: 'Action créée → Créer SousAction',
    collection_cible: 'actions',
    status: 'active',
    trigger_event: ['create'],
    rule: {
      // old.id === null → création
      '===': [ { get: [ { var: '$OLD' }, 'id' ] }, null ]
    },
    actions: [
      {
        type: 'create_item',
        collection: 'sous_actions',
        data: {
          action_id: { var: 'id' },
          titre: { concat: ['Checklist initiale pour action ', { var: 'id' }] },
          statut: 'a_faire'
        }
      }
    ]
  },
  // 4) Action terminée → marquer la tâche completed (modif parent)
  {
    name: 'Action terminée → Tâche completed',
    collection_cible: 'actions',
    status: 'active',
    trigger_event: ['update'],
    rule: {
      and: [
        { in: ['statut', { var: '$CHANGED' }] },
        { '===': [ { var: 'statut' }, 'termine' ] }
      ]
    },
    actions: [
      { type: 'update_item', collection: 'taches', id: { var: 'tache_id' }, data: { completed: true } }
    ]
  }
];

async function run() {
  console.log('=== Initial DB ===');
  console.dir(db, { depth: 5 });

  // Step A) Project priority change → updates phases + tasks (urgent=true)
  console.log('\n— Step A: Projet priorite moyenne → critique');
  const oldProj = { ...db.projets[0] };
  db.projets[0].priorite = 'critique';
  await engine.evaluate({
    collection: 'projets',
    automations,
    newData: db.projets[0],
    oldData: oldProj,
    context: { $USER: { id: 'tester' } }
  });

  // Trigger task-level automations for each task that became urgent
  const urgentTasks = db.taches.filter(t => t.projet_id === 1 && t.urgent === true);
  console.log('Tasks now urgent:', urgentTasks.map(t => t.id));
  for (const t of urgentTasks) {
    const oldT = { ...t, urgent: false };
    await engine.evaluate({
      collection: 'taches',
      automations,
      newData: t,
      oldData: oldT,
      context: { $USER: { id: 'tester' } }
    });
    // For each created action on this task, trigger action-created rule
    const actionsForTask = db.actions.filter(a => a.tache_id === t.id);
    for (const a of actionsForTask) {
      await engine.evaluate({
        collection: 'actions',
        automations,
        newData: a,
        oldData: null,
        context: { $USER: { id: 'tester' } }
      });
    }
  }

  // Step B) Mark first action as done → should mark its task completed
  const firstAction = db.actions[0];
  if (firstAction) {
    console.log('\n— Step B: Action', firstAction.id, '→ termine');
    const oldA = { ...firstAction };
    firstAction.statut = 'termine';
    await engine.evaluate({
      collection: 'actions',
      automations,
      newData: firstAction,
      oldData: oldA,
      context: { $USER: { id: 'tester' } }
    });
  }

  // Step C) Create new task (urgent=true) → auto-create action → auto-create sous_action
  console.log('\n— Step C: Création d\'une nouvelle tâche urgente');
  const newTask = { id: nextId('taches'), projet_id: 1, phase_id: 12, titre: 'Tâche C', urgent: true, completed: false };
  db.taches.push(newTask);
  await engine.evaluate({
    collection: 'taches',
    automations,
    newData: newTask,
    oldData: null,
    context: { $USER: { id: 'tester' } }
  });
  // trigger action-created for new actions of this task
  const newActions = db.actions.filter(a => a.tache_id === newTask.id);
  for (const a of newActions) {
    await engine.evaluate({
      collection: 'actions',
      automations,
      newData: a,
      oldData: null,
      context: { $USER: { id: 'tester' } }
    });
  }

  console.log('\n=== Final DB ===');
  console.dir(db, { depth: 5 });
}

run().catch((e) => { console.error(e); process.exitCode = 1; });
