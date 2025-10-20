#!/usr/bin/env node

const DIRECTUS_URL = 'http://127.0.0.1:8055';
const DIRECTUS_TOKEN = 'OHJ4HEV2RG-WwmdNpC2h3PKa1ujLZO5C';

async function api(path, options = {}) {
  const res = await fetch(`${DIRECTUS_URL}${path}`, {
    ...options,
    headers: { 'Authorization': `Bearer ${DIRECTUS_TOKEN}`, 'Content-Type': 'application/json' }
  });
  return res.ok ? (res.status === 204 ? null : await res.json()) : null;
}

(async () => {
  console.log('🔧 Désactivation temporaire de Test 3 sur items.create...\n');
  
  // Trouver Test 3
  const result = await api('/items/quartz_automations?filter[name][_eq]=Test 3: Compter tâches projet');
  const automation = result.data[0];
  
  // Changer trigger_event pour retirer items.create
  await api(`/items/quartz_automations/${automation.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      trigger_event: 'items.update,items.delete',  // ← Retirer items.create
      rule_jsonb: { '!!': { var: 'projet_id' } }  // Garder la règle
    })
  });
  
  console.log('✅ Test 3 ne se déclenchera plus sur items.create');
  console.log('   (seulement sur items.update et items.delete)');
  console.log('\n🔄 Redémarre Directus si besoin:');
  console.log('   docker restart directus-test-directus-1');
})();
