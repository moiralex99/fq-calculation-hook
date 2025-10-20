#!/usr/bin/env node

/**
 * Script de création des automations de test
 * Génère toutes les automations pour tester les scénarios
 * 
 * Usage:
 *   node setup-test-automations.mjs
 */

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://127.0.0.1:8055';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || 'OHJ4HEV2RG-WwmdNpC2h3PKa1ujLZO5C';
const VERBOSE = process.env.VERBOSE === 'true';
const TIMEOUT_MS = 15000;

/**
 * Wrapper around fetch with timeout
 */
async function api(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `${DIRECTUS_URL}${path}`;
    if (VERBOSE) {
      console.log(`→ ${options.method || 'GET'} ${url}`);
    }

    const res = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${DIRECTUS_TOKEN}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    if (res.status === 204 || res.headers.get('content-length') === '0') {
      return null;
    }

    return await res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Request timeout after ${TIMEOUT_MS}ms: ${path}`);
    }
    throw err;
  }
}

/**
 * Helper pour créer une automation
 */
async function createAutomation(automation) {
  console.log(`\n📋 Création automation: ${automation.name}`);
  
  try {
    // Préparer le payload avec les bons noms de champs
    const payload = {
      name: automation.name,
      status: automation.status || 'active',
      collection_cible: JSON.stringify(automation.collection_cible), // Doit être JSON string
      trigger_event: automation.trigger_event || 'items.update',
      rule_jsonb: automation.rule, // Utiliser rule_jsonb pour JSONB
      actions_jsonb: automation.actions, // Utiliser actions_jsonb pour JSONB
      priority: automation.priority || 100
    };
    
    const result = await api('/items/quartz_automations', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    console.log(`✅ Automation créée: ${automation.name}`);
    return result.data;
  } catch (error) {
    if (error.message?.includes('already exists') || error.message?.includes('DUPLICATE')) {
      console.log(`⚠️  Automation ${automation.name} existe déjà`);
    } else {
      console.error(`❌ Erreur pour ${automation.name}:`, error.message);
    }
    return null;
  }
}

/**
 * Script principal
 */
async function main() {
  console.log('🚀 Démarrage de la création des automations de test...\n');
  console.log(`📍 URL: ${DIRECTUS_URL}\n`);
  
  const automations = [];
  
  // ========================================
  // 1. CALCUL AUTOMATIQUE DU TOTAL DE LIGNE DE COMMANDE
  // ========================================
  automations.push({
    name: 'Test 1: Calcul total ligne commande',
    collection_cible: ['lignes_commande'],
    trigger_event: 'items.create,items.update',
    status: 'active',
    rule: {
      or: [
        { in: ['quantite', { var: '$CHANGED' }] },
        { in: ['prix_unitaire', { var: '$CHANGED' }] }
      ]
    },
    actions: [
      {
        type: 'set_field',
        field: 'total_ligne',
        value: {
          '*': [
            { var: 'quantite' },
            { var: 'prix_unitaire' }
          ]
        }
      }
    ]
  });
  
  // ========================================
  // 2. AGRÉGATION: CALCUL TOTAL COMMANDE
  // ========================================
  automations.push({
    name: 'Test 2: Agrégation total commande',
    collection_cible: ['lignes_commande'],
    trigger_event: 'items.create,items.update,items.delete',
    status: 'active',
    rule: { '!!': { var: 'commande_id' } },
    actions: [
      {
        type: 'set_field',
        field: '$commande_id',
        value: { var: 'commande_id' }
      },
      {
        type: 'set_field',
        field: '$lignes',
        value: {
          lookup_many: [
            'lignes_commande',
            { commande_id: { _eq: { var: '$commande_id' } } },
            ['total_ligne'],
            500
          ]
        }
      },
      {
        type: 'set_field',
        field: '$total',
        value: {
          sum_by: [
            { var: '$lignes' },
            { var: 'it.total_ligne' }
          ]
        }
      },
      {
        type: 'update_item',
        collection: 'commandes',
        id: { var: '$commande_id' },
        data: {
          total: { var: '$total' },
          nb_lignes: { length: { var: '$lignes' } }
        }
      }
    ]
  });
  
  // ========================================
  // 3. CASCADE PARENT: COMPTER TÂCHES DU PROJET
  // ========================================
  automations.push({
    name: 'Test 3: Compter tâches projet',
    collection_cible: ['taches'],
    trigger_event: 'items.create,items.update,items.delete',
    status: 'active',
    rule: { '!!': { var: 'projet_id' } },
    actions: [
      {
        type: 'set_field',
        field: '$projet_id',
        value: { var: 'projet_id' }
      },
      {
        type: 'set_field',
        field: '$taches',
        value: {
          lookup_many: [
            'taches',
            { projet_id: { _eq: { var: '$projet_id' } } },
            ['id', 'statut'],
            500
          ]
        }
      },
      {
        type: 'set_field',
        field: '$nb_terminees',
        value: {
          length: {
            filter_by: [
              { var: '$taches' },
              { '===': [{ var: 'it.statut' }, 'termine'] }
            ]
          }
        }
      },
      {
        type: 'update_item',
        collection: 'projets',
        id: { var: '$projet_id' },
        data: {
          nb_taches_total: { length: { var: '$taches' } },
          nb_taches_terminees: { var: '$nb_terminees' },
          pourcentage_completion: {
            if: [
              { '>': [{ length: { var: '$taches' } }, 0] },
              { '*': [{ '/': [{ var: '$nb_terminees' }, { length: { var: '$taches' } }] }, 100] },
              0
            ]
          }
        }
      }
    ]
  });
  
  // ========================================
  // 4. SOFT DELETE EN CASCADE
  // ========================================
  automations.push({
    name: 'Test 4: Soft delete cascade projet → taches',
    collection_cible: ['projets'],
    trigger_event: 'items.update',
    status: 'active',
    rule: {
      and: [
        { in: ['deleted', { var: '$CHANGED' }] },
        { '===': [{ var: 'deleted' }, true] }
      ]
    },
    actions: [
      {
        type: 'log',
        message: {
          concat: ['Soft delete projet ', { var: 'id' }, ' - cascade vers tâches']
        }
      },
      {
        type: 'update_many',
        collection: 'taches',
        filter: { projet_id: { _eq: { var: 'id' } } },
        data: {
          deleted: true,
          deleted_at: { now: [] }
        }
      }
    ]
  });
  
  // ========================================
  // 5. DUPLICATION SIMPLE AVEC ASSIGN
  // ========================================
  automations.push({
    name: 'Test 5: Duplication projet (simple)',
    collection_cible: ['projets'],
    trigger_event: 'items.update',
    status: 'active',
    rule: {
      and: [
        { in: ['dupliquer', { var: '$CHANGED' }] },
        { '===': [{ var: 'dupliquer' }, true] }
      ]
    },
    actions: [
      {
        type: 'log',
        message: {
          concat: ['Duplication projet ', { var: 'nom' }]
        }
      },
      {
        type: 'create_item',
        collection: 'projets',
        assign: 'nouveau_projet',
        data: {
          nom: { concat: ['COPIE - ', { var: 'nom' }] },
          description: { var: 'description' },
          statut: 'planifie',
          type: { var: 'type' },
          priorite: { var: 'priorite' },
          budget_total: { var: 'budget_total' },
          template_id: { var: 'id' }
        }
      },
      {
        type: 'log',
        message: {
          concat: [
            'Projet dupliqué avec succès. ID original: ',
            { var: 'id' },
            ', ID copie: ',
            { var: '$nouveau_projet.id' }
          ]
        }
      },
      {
        type: 'set_field',
        field: 'dupliquer',
        value: false
      },
      {
        type: 'set_field',
        field: 'copie_id',
        value: { var: '$nouveau_projet.id' }
      }
    ]
  });
  
  // ========================================
  // 6. DUPLICATION EN CASCADE (2 NIVEAUX)
  // ========================================
  automations.push({
    name: 'Test 6: Duplication campagne CASCADE (5 niveaux)',
    collection_cible: ['campagnes'],
    trigger_event: 'items.update',
    status: 'active',
    rule: {
      and: [
        { in: ['dupliquer', { var: '$CHANGED' }] },
        { '===': [{ var: 'dupliquer' }, true] }
      ]
    },
    actions: [
      // Étape 1: Sauvegarder ID original
      {
        type: 'set_field',
        field: '$old_campagne_id',
        value: { var: 'id' }
      },
      {
        type: 'log',
        message: {
          concat: ['🚀 Duplication cascade campagne ', { var: 'nom' }]
        }
      },
      // Étape 2: Dupliquer la campagne
      {
        type: 'create_item',
        collection: 'campagnes',
        assign: 'new_campagne',
        data: {
          nom: { concat: [{ var: 'nom' }, ' - COPIE'] },
          annee: { var: 'annee' },
          periode: { var: 'periode' },
          campagne_source_id: { var: '$old_campagne_id' },
          date_duplication: { now: [] }
        }
      },
      {
        type: 'log',
        message: {
          concat: ['✅ Niveau 1: Campagne créée ID=', { var: '$new_campagne.id' }]
        }
      },
      // Étape 3: Dupliquer les calendriers (niveau 2)
      {
        type: 'for_each',
        list: {
          lookup_many: [
            'calendriers',
            { campagne_id: { _eq: { var: '$old_campagne_id' } } },
            ['id', 'nom', 'annee'],
            500
          ]
        },
        actions: [
          {
            type: 'set_field',
            field: '$old_calendrier_id',
            value: { var: '$item.id' }
          },
          {
            type: 'create_item',
            collection: 'calendriers',
            assign: 'new_calendrier',
            data: {
              campagne_id: { var: '$new_campagne.id' },
              nom: { var: '$item.nom' },
              annee: { var: '$item.annee' }
            }
          },
          {
            type: 'log',
            message: {
              concat: ['  ✅ Niveau 2: Calendrier créé ID=', { var: '$new_calendrier.id' }]
            }
          },
          // Étape 4: Dupliquer les domaines (niveau 3)
          {
            type: 'for_each',
            list: {
              lookup_many: [
                'domaines',
                { calendrier_id: { _eq: { var: '$old_calendrier_id' } } },
                ['id', 'nom', 'description'],
                500
              ]
            },
            actions: [
              {
                type: 'set_field',
                field: '$old_domaine_id',
                value: { var: '$item.id' }
              },
              {
                type: 'create_item',
                collection: 'domaines',
                assign: 'new_domaine',
                data: {
                  calendrier_id: { var: '$new_calendrier.id' },
                  nom: { var: '$item.nom' },
                  description: { var: '$item.description' }
                }
              },
              {
                type: 'log',
                message: {
                  concat: ['    ✅ Niveau 3: Domaine créé ID=', { var: '$new_domaine.id' }]
                }
              },
              // Étape 5: Dupliquer les processus (niveau 4)
              {
                type: 'for_each',
                list: {
                  lookup_many: [
                    'processus_campagne',
                    { domaine_id: { _eq: { var: '$old_domaine_id' } } },
                    ['id', 'nom', 'description'],
                    500
                  ]
                },
                actions: [
                  {
                    type: 'set_field',
                    field: '$old_processus_id',
                    value: { var: '$item.id' }
                  },
                  {
                    type: 'create_item',
                    collection: 'processus_campagne',
                    assign: 'new_processus',
                    data: {
                      domaine_id: { var: '$new_domaine.id' },
                      nom: { var: '$item.nom' },
                      description: { var: '$item.description' }
                    }
                  },
                  {
                    type: 'log',
                    message: {
                      concat: ['      ✅ Niveau 4: Processus créé ID=', { var: '$new_processus.id' }]
                    }
                  },
                  // Étape 6: Dupliquer les tâches (niveau 5)
                  {
                    type: 'for_each',
                    list: {
                      lookup_many: [
                        'taches_campagne',
                        { processus_id: { _eq: { var: '$old_processus_id' } } },
                        ['nom', 'delai'],
                        500
                      ]
                    },
                    actions: [
                      {
                        type: 'create_item',
                        collection: 'taches_campagne',
                        data: {
                          processus_id: { var: '$new_processus.id' },
                          nom: { var: '$item.nom' },
                          delai: { var: '$item.delai' }
                        }
                      },
                      {
                        type: 'log',
                        message: {
                          concat: ['        ✅ Niveau 5: Tâche créée: ', { var: '$item.nom' }]
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
      {
        type: 'log',
        message: '🎉 Duplication cascade 5 niveaux terminée !'
      },
      // Réinitialiser le flag
      {
        type: 'set_field',
        field: 'dupliquer',
        value: false
      }
    ]
  });
  
  // ========================================
  // 7. CALCUL NOTE MOYENNE PRODUIT
  // ========================================
  automations.push({
    name: 'Test 7: Calcul note moyenne produit',
    collection_cible: ['avis_produit'],
    trigger_event: 'items.create,items.update,items.delete',
    status: 'active',
    rule: { '!!': { var: 'produit_id' } },
    actions: [
      {
        type: 'set_field',
        field: '$produit_id',
        value: { var: 'produit_id' }
      },
      {
        type: 'set_field',
        field: '$avis',
        value: {
          lookup_many: [
            'avis_produit',
            { produit_id: { _eq: { var: '$produit_id' } } },
            ['note'],
            500
          ]
        }
      },
      {
        type: 'set_field',
        field: '$note_moyenne',
        value: {
          if: [
            { '>': [{ length: { var: '$avis' } }, 0] },
            {
              '/': [
                { sum_by: [{ var: '$avis' }, 'note'] },
                { length: { var: '$avis' } }
              ]
            },
            0
          ]
        }
      },
      {
        type: 'update_item',
        collection: 'produits',
        id: { var: '$produit_id' },
        data: {
          note_moyenne: { var: '$note_moyenne' },
          nb_avis: { length: { var: '$avis' } }
        }
      }
    ]
  });
  
  // ========================================
  // 8. DÉTECTION RETARD TÂCHE
  // ========================================
  automations.push({
    name: 'Test 8: Détection retard tâche',
    collection_cible: ['taches'],
    trigger_event: 'items.update',
    status: 'active',
    rule: {
      and: [
        { '!!': { var: 'date_echeance' } },
        { '!==': [{ var: 'statut' }, 'termine'] }
      ]
    },
    actions: [
      {
        type: 'set_field',
        field: '$now',
        value: { now: [] }
      },
      {
        type: 'set_field',
        field: '$echeance',
        value: { var: 'date_echeance' }
      },
      {
        type: 'set_field',
        field: '$en_retard',
        value: { '>': [{ var: '$now' }, { var: '$echeance' }] }
      },
      {
        type: 'set_field',
        field: 'en_retard',
        value: { var: '$en_retard' }
      },
      {
        type: 'set_field',
        field: 'jours_retard',
        value: {
          if: [
            { var: '$en_retard' },
            {
              '/': [
                { '-': [{ var: '$now' }, { var: '$echeance' }] },
                86400000
              ]
            },
            0
          ]
        }
      },
      {
        type: 'if',
        condition: { var: '$en_retard' },
        then: [
          {
            type: 'create_item',
            collection: 'alertes',
            data: {
              type: 'echeance_proche',
              priorite: { var: 'priorite' },
              message: {
                concat: [
                  'Tâche en retard: ',
                  { var: 'titre' },
                  ' (Projet ID: ',
                  { var: 'projet_id' },
                  ')'
                ]
              }
            }
          }
        ]
      }
    ]
  });
  
  // ========================================
  // 9. WORKFLOW VALIDATION DOCUMENT
  // ========================================
  automations.push({
    name: 'Test 9: Workflow validation document',
    collection_cible: ['documents'],
    trigger_event: 'items.update',
    status: 'active',
    rule: {
      and: [
        { in: ['action_valider', { var: '$CHANGED' }] },
        { '===': [{ var: 'action_valider' }, true] },
        { '===': [{ var: 'statut' }, 'brouillon'] }
      ]
    },
    actions: [
      {
        type: 'log',
        message: {
          concat: ['Validation document: ', { var: 'titre' }]
        }
      },
      {
        type: 'set_field',
        field: 'statut',
        value: 'en_validation'
      },
      {
        type: 'set_field',
        field: 'action_valider',
        value: false
      },
      {
        type: 'create_item',
        collection: 'notifications',
        data: {
          type: 'validation_requise',
          titre: 'Document à valider',
          message: {
            concat: ['Le document "', { var: 'titre' }, '" est en attente de validation']
          },
          lu: false
        }
      }
    ]
  });
  
  // ========================================
  // 10. COMPTEUR M2M: NB PRODUITS PAR TAG
  // ========================================
  automations.push({
    name: 'Test 10: Compter produits par tag (M2M)',
    collection_cible: ['produit_tags'],
    trigger_event: 'items.create,items.delete',
    status: 'active',
    rule: { '!!': { var: 'tag_id' } },
    actions: [
      {
        type: 'set_field',
        field: '$tag_id',
        value: { var: 'tag_id' }
      },
      {
        type: 'set_field',
        field: '$nb_produits',
        value: {
          length: {
            lookup_many: [
              'produit_tags',
              { tag_id: { _eq: { var: '$tag_id' } } },
              ['id'],
              500
            ]
          }
        }
      },
      {
        type: 'update_item',
        collection: 'tags',
        id: { var: '$tag_id' },
        data: {
          nb_produits: { var: '$nb_produits' }
        }
      }
    ]
  });
  
  // ========================================
  // CRÉER TOUTES LES AUTOMATIONS
  // ========================================
  console.log('\n' + '='.repeat(60));
  console.log('📝 Création des automations...');
  console.log('='.repeat(60));
  
  let created = 0;
  for (const automation of automations) {
    const result = await createAutomation(automation);
    if (result) created++;
    await new Promise(resolve => setTimeout(resolve, 200)); // Pause entre chaque création
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 SETUP DES AUTOMATIONS TERMINÉ !');
  console.log('='.repeat(60));
  console.log(`\n📊 Automations créées : ${created}/${automations.length}`);
  console.log('\n🧪 Scénarios de test couverts:');
  console.log('   1. ✅ Calcul simple (total ligne)');
  console.log('   2. ✅ Agrégation (total commande)');
  console.log('   3. ✅ Cascade parent (compteur tâches)');
  console.log('   4. ✅ Soft delete cascade');
  console.log('   5. ✅ Duplication simple avec assign');
  console.log('   6. ✅ Duplication cascade 5 niveaux');
  console.log('   7. ✅ Moyenne (note produit)');
  console.log('   8. ✅ Détection retard + alerte');
  console.log('   9. ✅ Workflow validation');
  console.log('  10. ✅ Compteur M2M');
  console.log('\n🚀 Prêt à tester ! Modifiez les données dans Directus.');
  
}

// Exécuter
main().catch(console.error);
