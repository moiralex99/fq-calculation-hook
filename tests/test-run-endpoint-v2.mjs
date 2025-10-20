/**
 * Test script for /automations/run endpoint (UUID-only version)
 * 
 * Usage:
 * 1. Set DIRECTUS_URL and DIRECTUS_TOKEN in your environment
 * 2. Run: node test-run-endpoint-v2.mjs
 * 
 * This script will:
 * - List all available automations with their UUIDs
 * - Select the first active automation
 * - Run it in dry-run mode first
 * - Execute it for real if dry-run succeeds
 */

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8055';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || 'votre-token-ici';

if (!DIRECTUS_TOKEN || DIRECTUS_TOKEN === 'votre-token-ici') {
  console.error('❌ DIRECTUS_TOKEN environment variable required');
  console.error('   Set it with: $env:DIRECTUS_TOKEN="your-token-here"');
  process.exit(1);
}

// Helper to make authenticated requests
async function directusRequest(endpoint, options = {}) {
  const url = `${DIRECTUS_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${DIRECTUS_TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`Request failed: ${JSON.stringify(data, null, 2)}`);
  }
  
  return data;
}

// Step 1: List all automations
async function listAutomations() {
  console.log('📋 Fetching available automations...\n');
  
  const result = await directusRequest('/items/quartz_automations?fields=id,name,collection_cible,status&limit=50&sort=name');
  
  if (!result.data || result.data.length === 0) {
    console.log('⚠️  No automations found in quartz_automations');
    console.log('   Create an automation first in Directus Studio');
    return [];
  }
  
  console.log(`Found ${result.data.length} automation(s):\n`);
  result.data.forEach((auto, index) => {
    const statusIcon = auto.status === 'active' ? '✅' : '⏸️';
    console.log(`${index + 1}. ${statusIcon} ${auto.name}`);
    console.log(`   UUID: ${auto.id}`);
    console.log(`   Collection: ${auto.collection_cible}`);
    console.log(`   Status: ${auto.status}\n`);
  });
  
  return result.data;
}

// Step 2: Run automation with dry-run
async function runAutomation(automationId, itemId, dryRun = false) {
  const mode = dryRun ? '🧪 DRY-RUN' : '🚀 EXECUTING';
  console.log(`${mode} automation ${automationId}...`);
  
  const payload = {
    automation_id: automationId,
    dry_run: dryRun,
    context: {
      $TRIGGER: 'test_script',
      $TEST_MODE: true
    }
  };
  
  if (itemId) {
    payload.item_id = itemId;
  }
  
  console.log('Request payload:', JSON.stringify(payload, null, 2));
  
  const result = await directusRequest('/quartz-automations/run', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  
  return result;
}

// Main test flow
async function main() {
  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  Test /automations/run endpoint (UUID-only version)');
    console.log('═══════════════════════════════════════════════════════\n');
    
    // List automations
    const automations = await listAutomations();
    
    if (automations.length === 0) {
      return;
    }
    
    // Select first active automation
    const activeAutomations = automations.filter(a => a.status === 'active');
    
    if (activeAutomations.length === 0) {
      console.log('⚠️  No active automations found. Activate one in Directus Studio.');
      return;
    }
    
    const selectedAuto = activeAutomations[0];
    console.log(`📌 Selected automation: "${selectedAuto.name}"`);
    console.log(`   UUID: ${selectedAuto.id}`);
    console.log(`   Collection: ${selectedAuto.collection_cible}\n`);
    
    // Find a test item from the target collection
    console.log(`🔍 Looking for test item in collection "${selectedAuto.collection_cible}"...`);
    
    let testItem = null;
    try {
      const itemsResult = await directusRequest(`/items/${selectedAuto.collection_cible}?limit=1`);
      
      if (itemsResult.data && itemsResult.data.length > 0) {
        testItem = itemsResult.data[0];
        console.log(`✅ Found test item: ${testItem.id}\n`);
      } else {
        console.log(`⚠️  No items found in "${selectedAuto.collection_cible}"`);
        console.log('   Running automation without item_id (context-only mode)\n');
      }
    } catch (err) {
      console.log(`⚠️  Could not read collection "${selectedAuto.collection_cible}": ${err.message}`);
      console.log('   Running automation without item_id (context-only mode)\n');
    }
    
    // Test dry-run first
    console.log('═══════════════════════════════════════════════════════');
    console.log('  DRY-RUN MODE (simulation only)');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const dryResult = await runAutomation(selectedAuto.id, testItem?.id, true);
    console.log('\n📊 Dry-run response:', JSON.stringify(dryResult, null, 2));
    
    if (!dryResult.ok) {
      console.log('\n❌ Dry-run failed, aborting');
      return;
    }
    
    console.log('\n✅ Dry-run succeeded!');
    
    if (dryResult.results && dryResult.results.length > 0) {
      console.log(`   Processed ${dryResult.results.length} item(s)`);
      console.log(`   Example result:`, JSON.stringify(dryResult.results[0], null, 2));
    }
    
    if (dryResult.sideEffects && dryResult.sideEffects.length > 0) {
      console.log(`   Side-effects detected: ${dryResult.sideEffects.length}`);
      console.log(`   Example:`, JSON.stringify(dryResult.sideEffects[0], null, 2));
    }
    
    // Execute for real
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  REAL EXECUTION MODE');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const realResult = await runAutomation(selectedAuto.id, testItem?.id, false);
    console.log('\n📊 Execution response:', JSON.stringify(realResult, null, 2));
    
    if (!realResult.ok) {
      console.log('\n❌ Execution failed');
      return;
    }
    
    console.log('\n✅ Execution succeeded!');
    
    if (realResult.results && realResult.results.length > 0) {
      console.log(`   Processed ${realResult.results.length} item(s)`);
    }
    
    // Verify the changes if we had a test item
    if (testItem) {
      console.log('\n🔍 Verifying changes in database...');
      const updatedItem = await directusRequest(`/items/${selectedAuto.collection_cible}/${testItem.id}`);
      console.log('✅ Updated item:', JSON.stringify(updatedItem.data, null, 2));
    }
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  ✅ All tests passed!');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log('💡 To use this automation in a CRON Flow, use this webhook body:');
    console.log(JSON.stringify({
      automation_id: selectedAuto.id,
      filter: {}, // Add your filter here
      accountability: null, // Admin mode for CRON
      context: {
        $TRIGGER: 'cron_daily'
      }
    }, null, 2));
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

main();
