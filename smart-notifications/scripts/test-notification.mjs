/**
 * Script de test pour Smart Notifications
 * Usage: node scripts/test-notification.mjs
 */

import fetch from 'node-fetch';

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8055';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || 'your-admin-token';

const headers = {
  'Authorization': `Bearer ${DIRECTUS_TOKEN}`,
  'Content-Type': 'application/json'
};

/**
 * Test 1: Envoyer une notification de test
 */
async function testSendNotification() {
  console.log('\n🧪 Test 1: Send notification (test mode)');

  try {
    const response = await fetch(`${DIRECTUS_URL}/notifications/test`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        rule_id: 1, // deadline-proche
        collection: 'processus',
        item_id: 1,
        recipient_email: 'test@example.com'
      })
    });

    const result = await response.json();
    console.log('✅ Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Test 2: Envoyer une notification réelle
 */
async function testSendReal() {
  console.log('\n🧪 Test 2: Send real notification');

  try {
    const response = await fetch(`${DIRECTUS_URL}/notifications/send`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        rule_id: 1,
        collection: 'processus',
        item_id: 1,
        test_mode: false // Envoi réel
      })
    });

    const result = await response.json();
    console.log('✅ Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Test 3: Ajouter à la queue
 */
async function testEnqueue() {
  console.log('\n🧪 Test 3: Enqueue notification');

  try {
    const response = await fetch(`${DIRECTUS_URL}/notifications/enqueue`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        rule_id: 1,
        collection: 'processus',
        item_id: 1,
        priority: 'high'
      })
    });

    const result = await response.json();
    console.log('✅ Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Test 4: Récupérer les logs
 */
async function testGetLogs() {
  console.log('\n🧪 Test 4: Get notification logs');

  try {
    const response = await fetch(`${DIRECTUS_URL}/notifications/logs?limit=5`, {
      headers
    });

    const result = await response.json();
    console.log(`✅ Found ${result.data.length} logs (total: ${result.meta.total})`);
    
    if (result.data.length > 0) {
      console.log('Last log:', result.data[0]);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Test 5: Récupérer les stats
 */
async function testGetStats() {
  console.log('\n🧪 Test 5: Get notification stats');

  try {
    const response = await fetch(`${DIRECTUS_URL}/notifications/stats?period=7d`, {
      headers
    });

    const result = await response.json();
    console.log('✅ Stats:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Test 6: Stats de la queue
 */
async function testQueueStats() {
  console.log('\n🧪 Test 6: Get queue stats');

  try {
    const response = await fetch(`${DIRECTUS_URL}/notifications/queue/stats`, {
      headers
    });

    const result = await response.json();
    console.log('✅ Queue stats:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🚀 Starting Smart Notifications tests...');
  console.log(`📍 Directus URL: ${DIRECTUS_URL}`);

  await testSendNotification();
  await testEnqueue();
  await testGetLogs();
  await testGetStats();
  await testQueueStats();

  // await testSendReal(); // Décommenter pour tester l'envoi réel

  console.log('\n✨ Tests completed!');
}

runTests();
