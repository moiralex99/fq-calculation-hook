import { createAutomationEngine } from '../src/lib/automation-engine.js';
import { createJsonLogicEvaluator } from '../src/lib/jsonlogic-evaluator.js';

// Mock executors for side effects
const sentEmails = [];
const createdItems = [];
const executors = {
  async send_email({ to, subject, body, context }) {
    sentEmails.push({ to, subject, body });
  },
  async create_item({ collection, data, context }) {
    createdItems.push({ collection, data });
  }
};

const evaluator = createJsonLogicEvaluator();
const engine = createAutomationEngine({ evaluator, logger: console, executors });

const automations = [
  // Scenario 1: Création d'une nouvelle tâche à l'arrivée d'un ticket urgent
  {
    name: 'create-task-on-urgent-ticket',
    collection_cible: 'tickets',
    status: 'active',
    rule: { and: [ { '===': [ { var: 'priority' }, 'urgent' ] }, { '===': [ { var: 'status' }, 'new' ] } ] },
    actions: [
      {
        type: 'create_item',
        collection: 'tasks',
        data: {
          title: { concat: [ 'Follow-up: ', { var: 'title' } ] },
          ticket_id: { var: 'id' },
          due_at: { date_add: [ { now: [] }, 1, 'days' ] },
          assigned_to: '$USER.id'
        }
      },
      {
        type: 'send_email',
        to: 'support@company.test',
        subject: { concat: [ '[URGENT] Ticket #', { var: 'id' } ] },
        body: { concat: [ 'New urgent ticket from ', { var: 'requester_email' }, ' — ', { var: 'title' } ] }
      }
    ]
  },
  // Scenario 2: Règle complexe — si statut passe à done et total > seuil -> email + set closed_at
  {
    name: 'close-and-notify',
    collection_cible: 'orders',
    status: 'active',
    rule: { and: [ { changed_to: [ 'status', 'done', { var: '$CHANGED' }, { __ctx: [] } ] }, { '>': [ { var: 'total' }, { var: 'threshold' } ] } ] },
    actions: [
      { type: 'set_field', field: 'closed_at', value: 'NOW()' },
      { type: 'send_email', to: { var: 'customer_email' }, subject: 'Order completed', body: 'Your order is completed.' }
    ]
  },
  // Scenario 3: Maj d'un champ calculé multi-champs
  {
    name: 'compute-order-total',
    collection_cible: 'orders',
    status: 'active',
    rule: { or: [ { in: [ 'unit_price', { var: '$CHANGED' } ] }, { in: [ 'quantity', { var: '$CHANGED' } ] }, { in: [ 'discount', { var: '$CHANGED' } ] } ] },
    actions: [
      { type: 'set_field', field: 'total', value: { '-': [ { '*': [ { var: 'unit_price' }, { var: 'quantity' } ] }, { var: 'discount' } ] } }
    ]
  }
];

async function run() {
  console.log('\n=== Scenario 1: ticket urgent ===');
  await engine.evaluate({
    collection: 'tickets',
    automations,
    newData: { id: 101, title: 'DB outage', status: 'new', priority: 'urgent', requester_email: 'ops@company.test' },
    oldData: null,
    context: { $USER: { id: 'u-100' } }
  });
  console.log('createdItems:', createdItems);
  console.log('sentEmails:', sentEmails);

  console.log('\n=== Scenario 2: order done and threshold ===');
  const updates2 = await engine.evaluate({
    collection: 'orders',
    automations,
    newData: { id: 5, status: 'done', total: 120, threshold: 100, customer_email: 'c@x.test' },
    oldData: { id: 5, status: 'processing', total: 120, threshold: 100, customer_email: 'c@x.test' },
    context: { $USER: { id: 'u-200' } }
  });
  console.log('updates2:', updates2);
  console.log('sentEmails:', sentEmails);

  console.log('\n=== Scenario 3: recompute order total ===');
  const updates3 = await engine.evaluate({
    collection: 'orders',
    automations,
    newData: { id: 6, unit_price: 20, quantity: 3, discount: 5 },
    oldData: { id: 6, unit_price: 20, quantity: 2, discount: 5 },
    context: { $USER: { id: 'u-300' } }
  });
  console.log('updates3:', updates3);
}

run().catch(console.error);
