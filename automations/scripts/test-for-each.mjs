import { createAutomationEngine } from '../src/lib/automation-engine.js';
import { createJsonLogicEvaluator } from '../src/lib/jsonlogic-evaluator.js';

// Mock data structure: campagne -> calendriers -> domaines -> processus -> taches
const mockData = {
  id: 'camp-1',
  name: 'Campagne 2025',
  annee: 2025,
  periode: 'T1',
  dupliquer: 'oui',
  campagne_dupliquer: {
    id: 'camp-src',
    calendriers_campagne: [
      {
        id: 'cal-1',
        name: 'Calendrier Q1',
        type_calendrier: 'courant',
        liste_domaines: [
          {
            id: 'dom-1',
            name: 'Finance',
            liste_processus: [
              {
                id: 'proc-1',
                name: 'Clôture mensuelle',
                liste_taches: [
                  { id: 'task-1', name: 'Rapprochement bancaire', delai: 5 },
                  { id: 'task-2', name: 'Balance', delai: 10 }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
};

// Mock executors to track created items
const created = { calendriers: [], domaines: [], processus: [], taches: [] };
const executors = {
  async create_item({ collection, data, context }) {
    const item = { id: `${collection}-new-${Date.now()}`, ...data };
    created[collection] = created[collection] || [];
    created[collection].push(item);
    console.log(`[Mock] Created ${collection}:`, item.id, 'name:', item.name);
    return item;
  }
};

const evaluator = createJsonLogicEvaluator();
const engine = createAutomationEngine({ evaluator, logger: console, executors });

const automations = [
  {
    name: 'Dupliquer campagne (nested O2M)',
    collection_cible: 'campagnes',
    status: 'active',
    expand_fields: ['campagne_dupliquer.calendriers_campagne.liste_domaines.liste_processus.liste_taches'],
    rule: { "and": [ { "in": ["dupliquer", { "var": "$CHANGED" }] }, { "===": [ { "var": "dupliquer" }, "oui" ] } ] },
    actions: [
      {
        type: 'for_each',
        list: { var: 'campagne_dupliquer.calendriers_campagne' },
        actions: [
          {
            type: 'create_item',
            collection: 'calendriers',
            assign: 'new_calendrier',
            data: {
              name: { concat: [{ var: '$item.name' }, ' (Copie ', { var: 'annee' }, ')'] },
              campagne_liee: { var: 'id' },
              annee: { var: 'annee' },
              periode: { var: 'periode' }
            }
          },
          {
            type: 'for_each',
            list: { var: '$item.liste_domaines' },
            actions: [
              {
                type: 'create_item',
                collection: 'domaines',
                assign: 'new_domaine',
                data: {
                  name: { concat: [{ var: '$item.name' }, ' (2025)'] },
                  calendrier_lie: { var: '$new_calendrier.id' }
                }
              },
              {
                type: 'for_each',
                list: { var: '$item.liste_processus' },
                actions: [
                  {
                    type: 'create_item',
                    collection: 'processus',
                    assign: 'new_processus',
                    data: {
                      name: { var: '$item.name' },
                      domaine_lie: { var: '$new_domaine.id' }
                    }
                  },
                  {
                    type: 'for_each',
                    list: { var: '$item.liste_taches' },
                    actions: [
                      {
                        type: 'create_item',
                        collection: 'taches',
                        data: {
                          name: { var: '$item.name' },
                          processus_lie: { var: '$new_processus.id' },
                          delai: { var: '$item.delai' }
                        }
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      { type: 'set_field', field: 'dupliquer', value: 'termine' }
    ]
  }
];

async function run() {
  const updates = await engine.evaluate({
    collection: 'campagnes',
    automations,
    newData: mockData,
    oldData: { ...mockData, dupliquer: 'non' },
    context: { $USER: { id: 'user-123' } }
  });

  console.log('\n=== Updates ===');
  console.log(updates);

  console.log('\n=== Created Items ===');
  console.log('Calendriers:', created.calendriers?.length || 0);
  console.log('Domaines:', created.domaines?.length || 0);
  console.log('Processus:', created.processus?.length || 0);
  console.log('Taches:', created.taches?.length || 0);

  console.log('\n=== Details ===');
  console.dir(created, { depth: 5 });
}

run().catch(console.error);
