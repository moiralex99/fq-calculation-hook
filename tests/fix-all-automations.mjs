#!/usr/bin/env node

/**
 * Script pour corriger toutes les automations de test
 * Applique les corrections de syntaxe pour sum_by, filter_by, etc.
 */

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://127.0.0.1:8055';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || 'OHJ4HEV2RG-WwmdNpC2h3PKa1ujLZO5C';
const TIMEOUT_MS = 15000;

async function api(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `${DIRECTUS_URL}${path}`;
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

async function updateAutomation(name, newActions) {
  console.log(`\n🔧 Mise à jour: ${name}`);
  
  try {
    const result = await api(`/items/quartz_automations?filter[name][_eq]=${encodeURIComponent(name)}`);
    
    if (!result.data || result.data.length === 0) {
      console.log(`  ⚠️  Automation introuvable`);
      return false;
    }
    
    const automation = result.data[0];
    
    await api(`/items/quartz_automations/${automation.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ actions_jsonb: newActions })
    });
    
    console.log(`  ✅ Mise à jour réussie`);
    return true;
  } catch (error) {
    console.error(`  ❌ Erreur:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Correction des automations de test...\n');
  console.log('='.repeat(60));
  
  let updated = 0;
  
  // ========================================
  // Test 3: filter → filter_by
  // ========================================
  updated += await updateAutomation('Test 3: Compter tâches projet', [
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
  ]) ? 1 : 0;
  
  // ========================================
  // Test 7: reduce → sum_by
  // ========================================
  updated += await updateAutomation('Test 7: Calcul note moyenne produit', [
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
  ]) ? 1 : 0;
  
  console.log('\n' + '='.repeat(60));
  console.log(`\n✅ ${updated} automations corrigées !`);
  console.log('\n🔄 Attends quelques secondes pour le hot-reload.');
}

main().catch(console.error);
