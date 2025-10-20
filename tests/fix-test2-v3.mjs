#!/usr/bin/env node

const DIRECTUS_URL = 'http://127.0.0.1:8055';
const DIRECTUS_TOKEN = 'OHJ4HEV2RG-WwmdNpC2h3PKa1ujLZO5C';

async function api(path, options = {}) {
  const res = await fetch(`${DIRECTUS_URL}${path}`, {
    ...options,
    headers: { 
      'Authorization': `Bearer ${DIRECTUS_TOKEN}`, 
      'Content-Type': 'application/json' 
    }
  });
  return res.ok ? (res.status === 204 ? null : await res.json()) : null;
}

(async () => {
  console.log('🔧 Correction Test 2 - version 3 (avec string)...\n');
  
  const result = await api('/items/quartz_automations?filter[name][_eq]=Test 2: Agrégation total commande');
  const automation = result.data[0];
  
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
          'total_ligne'  // ← STRING au lieu d'un objet JSONLogic !
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
    body: JSON.stringify({ actions_jsonb: newActions })
  });
  
  console.log('✅ Test 2 mis à jour avec sum_by(..., "total_ligne")');
  console.log('\n🔄 Attends quelques secondes pour le hot-reload, puis teste !');
})().catch(console.error);
