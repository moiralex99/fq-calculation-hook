import { createAutomationEngine } from '../src/lib/automation-engine.js';
import { createJsonLogicEvaluator } from '../src/lib/jsonlogic-evaluator.js';

const evaluator = createJsonLogicEvaluator();
const engine = createAutomationEngine({ evaluator, logger: console });

const automations = [
  {
    name: 'Fin projet',
    collection_cible: 'projets',
    rule: {
      and: [
        { '===': [ { var: 'status' }, 'termine' ] },
        { in: [ 'status', { var: '$CHANGED' } ] }
      ]
    },
    actions: [
      { type: 'set_field', field: 'date_fin', value: 'NOW()' }
    ]
  }
];

const newData = { status: 'termine' };
const oldData = { status: 'en_cours' };

const result = await engine.evaluate({
  collection: 'projets',
  automations,
  newData,
  oldData,
  context: { $USER: 'user-123' }
});

console.log('Updates →', result);
