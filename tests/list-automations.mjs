/**
 * List all automations with their UUIDs
 * 
 * Usage:
 * 1. Set DIRECTUS_TOKEN: $env:DIRECTUS_TOKEN="your-token-here"
 * 2. Run: node list-automations.mjs
 * 
 * This script helps you find the UUID of an automation for use in CRON Flows.
 */

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8055';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || 'votre-token-ici';

if (!DIRECTUS_TOKEN || DIRECTUS_TOKEN === 'votre-token-ici') {
  console.error('❌ DIRECTUS_TOKEN environment variable required');
  console.error('   Set it with: $env:DIRECTUS_TOKEN="your-token-here"');
  process.exit(1);
}

async function listAutomations() {
  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  Available Automations');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const response = await fetch(
      `${DIRECTUS_URL}/items/quartz_automations?fields=id,name,collection_cible,status&limit=100&sort=name`,
      {
        headers: {
          'Authorization': `Bearer ${DIRECTUS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Request failed: ${JSON.stringify(errorData, null, 2)}`);
    }
    
    const result = await response.json();
    
    if (!result.data || result.data.length === 0) {
      console.log('⚠️  No automations found in quartz_automations');
      console.log('   Create an automation first in Directus Studio\n');
      return;
    }
    
    console.log(`Found ${result.data.length} automation(s):\n`);
    
    const activeAutomations = [];
    const inactiveAutomations = [];
    
    result.data.forEach(auto => {
      if (auto.status === 'active') {
        activeAutomations.push(auto);
      } else {
        inactiveAutomations.push(auto);
      }
    });
    
    if (activeAutomations.length > 0) {
      console.log('✅ ACTIVE Automations:\n');
      activeAutomations.forEach((auto, index) => {
        console.log(`${index + 1}. ${auto.name}`);
        console.log(`   UUID: ${auto.id}`);
        console.log(`   Collection: ${auto.collection_cible}\n`);
      });
    }
    
    if (inactiveAutomations.length > 0) {
      console.log('⏸️  INACTIVE Automations:\n');
      inactiveAutomations.forEach((auto, index) => {
        console.log(`${index + 1}. ${auto.name}`);
        console.log(`   UUID: ${auto.id}`);
        console.log(`   Collection: ${auto.collection_cible}`);
        console.log(`   Status: ${auto.status}\n`);
      });
    }
    
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('💡 To use an automation in a CRON Flow:');
    console.log('   1. Copy the UUID of the automation you want to use');
    console.log('   2. In Directus Studio, create a Flow with Schedule trigger');
    console.log('   3. Add a Webhook operation with this body:\n');
    console.log('   {');
    console.log('     "automation_id": "paste-uuid-here",');
    console.log('     "filter": { /* your filter */ },');
    console.log('     "accountability": null,');
    console.log('     "context": {');
    console.log('       "$TRIGGER": "cron_daily"');
    console.log('     }');
    console.log('   }\n');
    
    console.log('📚 See CRON_USAGE.md for complete examples\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

listAutomations();
