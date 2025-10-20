/**
 * Test du endpoint /automations/run
 * Teste plusieurs scénarios:
 * 1. Exécution sur un item spécifique (Test 2: agrégation commande)
 * 2. Exécution avec filtre (toutes les commandes)
 * 3. Dry-run mode
 */

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8055';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || 'votre-token-ici';

async function testRunEndpoint() {
  console.log('🧪 Test du endpoint /automations/run\n');

  // 1. Trouver l'automation "Test 2 - Agrégation commande"
  console.log('📋 1. Récupération de l\'automation...');
  const automationsRes = await fetch(`${DIRECTUS_URL}/items/quartz_automations?filter[name][_contains]=Test 2`, {
    headers: { 'Authorization': `Bearer ${DIRECTUS_TOKEN}` }
  });
  const automations = await automationsRes.json();
  
  if (!automations.data || automations.data.length === 0) {
    console.error('❌ Automation "Test 2" non trouvée');
    return;
  }

  const automation = automations.data[0];
  console.log(`✅ Automation trouvée: "${automation.name}" (${automation.id})`);

  // 2. Trouver une commande de test
  console.log('\n📋 2. Récupération d\'une commande de test...');
  const commandesRes = await fetch(`${DIRECTUS_URL}/items/test_commandes?limit=1`, {
    headers: { 'Authorization': `Bearer ${DIRECTUS_TOKEN}` }
  });
  const commandes = await commandesRes.json();
  
  if (!commandes.data || commandes.data.length === 0) {
    console.error('❌ Aucune commande trouvée');
    return;
  }

  const commande = commandes.data[0];
  console.log(`✅ Commande trouvée: ${commande.id}`);
  console.log(`   Total actuel: ${commande.total_commande || 'null'}`);

  // 3. Test avec dry_run d'abord
  console.log('\n🔍 3. Test en DRY-RUN (simulation)...');
  const dryRunRes = await fetch(`${DIRECTUS_URL}/automations/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DIRECTUS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      automation_id: automation.id,
      item_id: commande.id,
      dry_run: true
    })
  });

  const dryRunResult = await dryRunRes.json();
  console.log('📊 Résultat dry-run:', JSON.stringify(dryRunResult, null, 2));

  if (!dryRunResult.ok) {
    console.error('❌ Dry-run échoué:', dryRunResult.error);
    return;
  }

  // 4. Exécution réelle
  console.log('\n🚀 4. Exécution RÉELLE...');
  const runRes = await fetch(`${DIRECTUS_URL}/automations/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DIRECTUS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      automation_id: automation.id,
      item_id: commande.id,
      accountability: null, // Admin mode
      context: {
        $TRIGGER: 'manual_test',
        $TEST_RUN: true
      }
    })
  });

  const runResult = await runRes.json();
  console.log('📊 Résultat exécution:', JSON.stringify(runResult, null, 2));

  if (!runResult.ok) {
    console.error('❌ Exécution échouée:', runResult.error);
    return;
  }

  // 5. Vérifier le résultat en DB
  console.log('\n🔍 5. Vérification en base...');
  const verifyRes = await fetch(`${DIRECTUS_URL}/items/test_commandes/${commande.id}`, {
    headers: { 'Authorization': `Bearer ${DIRECTUS_TOKEN}` }
  });
  const updatedCommande = await verifyRes.json();
  
  console.log(`✅ Total après exécution: ${updatedCommande.data.total_commande}`);
  
  if (updatedCommande.data.total_commande !== null) {
    console.log('\n✅ SUCCESS! L\'automation a bien été exécutée.');
  } else {
    console.log('\n⚠️  Le total est toujours null, vérifiez les logs Directus.');
  }

  // 6. Test avec filtre (toutes les commandes)
  console.log('\n📋 6. Test avec FILTRE (toutes les commandes)...');
  const filterRes = await fetch(`${DIRECTUS_URL}/automations/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DIRECTUS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      automation_id: automation.id,
      filter: {}, // Toutes les commandes
      dry_run: true
    })
  });

  const filterResult = await filterRes.json();
  console.log(`📊 Résultat filtre: ${filterResult.results?.length || 0} commandes traitées`);
  if (filterResult.results && filterResult.results.length > 0) {
    console.log('   Exemple:', JSON.stringify(filterResult.results[0], null, 2));
  }
}

// Exécution
testRunEndpoint().catch(err => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
