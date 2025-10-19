import { normalizeAutomations, normalizeAutomationRow } from '../src/lib/normalize.js';
import { createAutomationEngine } from '../src/lib/automation-engine.js';
import { createJsonLogicEvaluator } from '../src/lib/jsonlogic-evaluator.js';

const evaluator = createJsonLogicEvaluator();
const engine = createAutomationEngine({ evaluator, logger: console });

function print(title, value) {
  console.log(`\n=== ${title} ===`);
  console.dir(value, { depth: 10 });
}

// 1) Parser tests: actions/rule as string, object, array
const rowString = {
  name: 'stringified',
  collection_cible: 'test_conditions',
  status: 'active',
  rule_jsonb: '{"in":["quantite", {"var":"$CHANGED"}]}' ,
  actions_jsonb: '[{"type":"set_field","field":"total","value":{"*":[{"var":"prix"},{"var":"quantite"}]}}]'
};

const rowObject = {
  name: 'object-single',
  collection_cible: 'test_conditions',
  status: 'active',
  rule: { in: [ 'quantite', { var: '$CHANGED' } ] },
  actions: { type: 'set_field', field: 'total', value: { '*': [ { var: 'prix' }, { var: 'quantite' } ] } }
};

const rowArray = {
  name: 'array-actions',
  collection_cible: 'test_conditions',
  status: 'active',
  rule: { in: [ 'quantite', { var: '$CHANGED' } ] },
  actions: [ { type: 'set_field', field: 'total', value: { '*': [ { var: 'prix' }, { var: 'quantite' } ] } } ]
};

const normString = normalizeAutomationRow(rowString);
const normObject = normalizeAutomationRow(rowObject);
const normArray = normalizeAutomationRow(rowArray);

print('Parsed (string)', normString);
print('Parsed (object-single)', normObject);
print('Parsed (array)', normArray);

// 2) Evaluator tests: math, NOW, $USER.id, changed_to
const automations = [
  // total = prix * quantite when either changes
  {
    name: 'compute-total',
    collection_cible: 'test_conditions',
    status: 'active',
    rule: { or: [ { in: [ 'quantite', { var: '$CHANGED' } ] }, { in: [ 'prix', { var: '$CHANGED' } ] } ] },
    actions: [ { type: 'set_field', field: 'total', value: { '*': [ { var: 'prix' }, { var: 'quantite' } ] } } ]
  },
  // set ended_at when status changed to done
  {
    name: 'mark-ended',
    collection_cible: 'test_conditions',
    status: 'active',
    rule: { changed_to: [ 'status', 'done', { var: '$CHANGED' }, { __ctx: [] } ] },
    actions: [ { type: 'set_field', field: 'ended_at', value: 'NOW()' } ]
  },
  // set owner_id to current user
  {
    name: 'set-owner',
    collection_cible: 'test_conditions',
    status: 'active',
    rule: { in: [ 'owner_id', { var: '$CHANGED' } ] },
    actions: [ { type: 'set_field', field: 'owner_id_copy', value: '$USER.id' } ]
  }
];

async function run() {
  const newData = { id: 1, prix: 10, quantite: 4, status: 'done', owner_id: 'u-9' };
  const oldData = { id: 1, prix: 10, quantite: 3, status: 'in-progress', owner_id: 'u-8' };

  const updates = await engine.evaluate({
    collection: 'test_conditions',
    automations,
    newData,
    oldData,
    context: { $USER: { id: 'user-123' } }
  });

  print('Updates', updates);
}

run().catch((e) => console.error(e));
