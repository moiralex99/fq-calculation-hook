#!/usr/bin/env node

/**
 * Script pour corriger l'automation Test 2
 * Remplace reduce par sum_by
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

async function main() {
  console.log('🔧 Correction de l\'automation Test 2...\n');
  
  // 1. Trouver l'automation Test 2
  const result = await api('/items/quartz_automations?filter[name][_eq]=Test 2: Agrégation total commande');
  
  if (!result.data || result.data.length === 0) {
    console.error('❌ Automation Test 2 introuvable');
    return;
  }
  
  const automation = result.data[0];
  console.log(`✅ Automation trouvée: ID=${automation.id}`);
  
  // 2. Mettre à jour avec sum_by au lieu de reduce
  const newActions = [
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
  ];
  
  await api(`/items/quartz_automations/${automation.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      actions_jsonb: newActions
    })
  });
  
  console.log('✅ Automation Test 2 mise à jour avec sum_by !');
  console.log('\n🔄 Redémarre Directus pour recharger les automations:');
  console.log('   docker restart directus-test-directus-1');
  console.log('\nOu attends quelques secondes pour le hot-reload automatique.');
}

main().catch(console.error);
