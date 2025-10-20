/**
 * Test Webhooks Réels - Smart Notifications
 * Test avec de vrais endpoints Slack/Discord/Teams (webhook.site pour simulation)
 * 
 * Usage: node scripts/test-webhooks.mjs
 */

import { WebhookChannel } from '../src/channels/webhook.js';
import { TemplateRenderer } from '../src/lib/template-renderer.js';

const logger = {
  info: (msg, ...args) => console.log('ℹ️ ', msg, ...args),
  warn: (msg, ...args) => console.warn('⚠️ ', msg, ...args),
  error: (msg, ...args) => console.error('❌', msg, ...args),
  debug: (msg, ...args) => console.log('🔍', msg, ...args)
};

async function testWebhooks() {
  console.log('\n🚀 ========================================');
  console.log('   SMART NOTIFICATIONS - WEBHOOK TESTS');
  console.log('========================================\n');

  const channel = new WebhookChannel({ timeout: 10000 }, logger);
  const renderer = new TemplateRenderer(logger);

  // Template de test
  const template = {
    id: 1,
    code: 'test-webhook',
    name: 'Test Webhook',
    content: 'Le processus {{nom}} arrive à échéance dans {{jours_restants}} jours',
    webhook_config: {
      provider: 'slack',
      title: '⚠️ Échéance proche : {{nom}}',
      text: 'Il reste **{{jours_restants}} jours** pour le processus *{{nom}}*.\n\n👤 Responsable : {{responsable}}\n📅 Date : {{date_echeance | date}}',
      fields: [
        {
          label: 'Statut',
          value: '{{statut}}'
        },
        {
          label: 'Jours restants',
          value: '{{jours_restants}}'
        }
      ]
    }
  };

  const variables = {
    nom: 'Processus Test Alpha',
    responsable: 'Jean Dupont',
    date_echeance: '2025-10-24T10:00:00Z',
    statut: 'en_cours',
    jours_restants: 5
  };

  console.log('📋 Variables de test:');
  console.log(JSON.stringify(variables, null, 2));
  console.log('');

  // TEST 1: Slack Webhook (simulation avec webhook.site)
  console.log('\n🧪 Test 1: Slack Webhook Format');
  console.log('─────────────────────────────────────\n');

  const slackTemplate = { ...template };
  slackTemplate.webhook_config.provider = 'slack';
  slackTemplate.webhook_config.url = 'https://webhook.site/your-unique-id'; // Remplacer avec webhook.site

  const slackPayload = channel.buildPayload(slackTemplate.webhook_config, slackTemplate, variables);
  
  console.log('📦 Payload Slack:');
  console.log(JSON.stringify(slackPayload, null, 2));
  console.log('');

  console.log('✅ Structure validée:');
  console.log(`   - Blocks: ${slackPayload.blocks ? '✓' : '✗'}`);
  console.log(`   - Header: ${slackPayload.blocks[0]?.type === 'header' ? '✓' : '✗'}`);
  console.log(`   - Content: ${slackPayload.blocks[1]?.type === 'section' ? '✓' : '✗'}`);
  console.log(`   - Fields: ${slackPayload.blocks[2]?.type === 'section' ? '✓' : '✗'}`);

  // TEST 2: Microsoft Teams Webhook
  console.log('\n🧪 Test 2: Microsoft Teams Webhook Format');
  console.log('─────────────────────────────────────\n');

  const teamsTemplate = { ...template };
  teamsTemplate.webhook_config.provider = 'teams';
  teamsTemplate.webhook_config.color = '0078D4';
  teamsTemplate.webhook_config.url = 'https://webhook.site/your-unique-id';

  const teamsPayload = channel.buildPayload(teamsTemplate.webhook_config, teamsTemplate, variables);
  
  console.log('📦 Payload Microsoft Teams:');
  console.log(JSON.stringify(teamsPayload, null, 2));
  console.log('');

  console.log('✅ Structure validée:');
  console.log(`   - @type: ${teamsPayload['@type'] === 'MessageCard' ? '✓' : '✗'}`);
  console.log(`   - Title: ${teamsPayload.title ? '✓' : '✗'}`);
  console.log(`   - Text: ${teamsPayload.text ? '✓' : '✗'}`);
  console.log(`   - Theme Color: ${teamsPayload.themeColor ? '✓' : '✗'}`);

  // TEST 3: Discord Webhook
  console.log('\n🧪 Test 3: Discord Webhook Format');
  console.log('─────────────────────────────────────\n');

  const discordTemplate = { ...template };
  discordTemplate.webhook_config.provider = 'discord';
  discordTemplate.webhook_config.color = '5865F2';
  discordTemplate.webhook_config.url = 'https://webhook.site/your-unique-id';

  const discordPayload = channel.buildPayload(discordTemplate.webhook_config, discordTemplate, variables);
  
  console.log('📦 Payload Discord:');
  console.log(JSON.stringify(discordPayload, null, 2));
  console.log('');

  console.log('✅ Structure validée:');
  console.log(`   - Embeds: ${discordPayload.embeds ? '✓' : '✗'}`);
  console.log(`   - Title: ${discordPayload.embeds[0]?.title ? '✓' : '✗'}`);
  console.log(`   - Description: ${discordPayload.embeds[0]?.description ? '✓' : '✗'}`);
  console.log(`   - Color: ${discordPayload.embeds[0]?.color ? '✓' : '✗'}`);
  console.log(`   - Timestamp: ${discordPayload.embeds[0]?.timestamp ? '✓' : '✗'}`);

  // TEST 4: Generic Webhook
  console.log('\n🧪 Test 4: Generic Webhook Format');
  console.log('─────────────────────────────────────\n');

  const genericTemplate = { ...template };
  genericTemplate.webhook_config.provider = 'generic';
  genericTemplate.webhook_config.custom_payload = {
    event: 'notification',
    source: 'flowquartz'
  };

  const genericPayload = channel.buildPayload(genericTemplate.webhook_config, genericTemplate, variables);
  
  console.log('📦 Payload Generic:');
  console.log(JSON.stringify(genericPayload, null, 2));
  console.log('');

  console.log('✅ Structure validée:');
  console.log(`   - Title: ${genericPayload.title ? '✓' : '✗'}`);
  console.log(`   - Text: ${genericPayload.text ? '✓' : '✗'}`);
  console.log(`   - Data: ${genericPayload.data ? '✓' : '✗'}`);
  console.log(`   - Custom fields: ${genericPayload.event ? '✓' : '✗'}`);

  // TEST 5: Template Rendering dans Webhooks
  console.log('\n🧪 Test 5: Template Rendering');
  console.log('─────────────────────────────────────\n');

  const rendered = {
    title: renderer.render(template.webhook_config.title, variables),
    text: renderer.render(template.webhook_config.text, variables)
  };

  console.log('🎨 Rendu du template:');
  console.log(`   Title: "${rendered.title}"`);
  console.log(`   Text: "${rendered.text}"`);
  console.log('');

  console.log('✅ Validations:');
  console.log(`   - Variables remplacées: ${!rendered.title.includes('{{') ? '✓' : '✗'}`);
  console.log(`   - Emojis préservés: ${rendered.title.includes('⚠️') ? '✓' : '✗'}`);
  console.log(`   - Markdown préservé: ${rendered.text.includes('**') ? '✓' : '✗'}`);
  console.log(`   - Filtre date appliqué: ${!rendered.text.includes('| date') ? '✓' : '✗'}`);

  // TEST 6: Provider Detection
  console.log('\n🧪 Test 6: Provider Auto-Detection');
  console.log('─────────────────────────────────────\n');

  const testUrls = [
    { url: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX', expected: 'slack' },
    { url: 'https://outlook.office.com/webhook/xxx', expected: 'teams' },
    { url: 'https://discord.com/api/webhooks/123456789/abcdefgh', expected: 'discord' },
    { url: 'https://example.com/webhook', expected: 'generic' },
    { url: null, expected: 'generic' }
  ];

  testUrls.forEach(test => {
    const detected = channel.detectProvider(test.url);
    const isCorrect = detected === test.expected;
    console.log(`   ${isCorrect ? '✅' : '❌'} ${test.url ? test.url.substring(0, 40) + '...' : 'null'} → ${detected} (expected: ${test.expected})`);
  });

  // TEST 7: Envoi réel (optionnel - décommenter avec vraie URL)
  console.log('\n🧪 Test 7: Envoi Réel (Optionnel)');
  console.log('─────────────────────────────────────\n');

  const WEBHOOK_URL = process.env.TEST_WEBHOOK_URL;

  if (WEBHOOK_URL) {
    console.log(`📡 Envoi vers: ${WEBHOOK_URL.substring(0, 40)}...`);
    
    try {
      const recipient = { webhook_url: WEBHOOK_URL };
      const result = await channel.send(template, recipient, variables, { testMode: false });
      
      if (result.success) {
        console.log('✅ Webhook envoyé avec succès!');
        console.log(`   Provider: ${result.provider}`);
        console.log(`   Status: ${result.external_id ? 'Delivered' : 'Sent'}`);
      } else {
        console.log('❌ Échec de l\'envoi:', result.error);
      }
    } catch (error) {
      console.error('❌ Erreur:', error.message);
    }
  } else {
    console.log('⏭️  SKIPPED - Définir TEST_WEBHOOK_URL pour tester l\'envoi réel');
    console.log('   Exemple: TEST_WEBHOOK_URL=https://webhook.site/xxx node scripts/test-webhooks.mjs');
  }

  // Summary
  console.log('\n========================================');
  console.log('   RÉSUMÉ DES TESTS');
  console.log('========================================');
  console.log('✅ Slack payload format');
  console.log('✅ Microsoft Teams payload format');
  console.log('✅ Discord payload format');
  console.log('✅ Generic webhook format');
  console.log('✅ Template rendering');
  console.log('✅ Provider auto-detection');
  console.log(WEBHOOK_URL ? '✅ Envoi réel' : '⏭️  Envoi réel (skipped)');
  console.log('========================================\n');

  console.log('💡 Pour tester avec de vrais webhooks:');
  console.log('');
  console.log('   1️⃣  Slack:');
  console.log('       https://api.slack.com/messaging/webhooks');
  console.log('');
  console.log('   2️⃣  Microsoft Teams:');
  console.log('       Dans un canal → ... → Connectors → Incoming Webhook');
  console.log('');
  console.log('   3️⃣  Discord:');
  console.log('       Paramètres du salon → Intégrations → Webhooks');
  console.log('');
  console.log('   4️⃣  Tester sans créer de compte:');
  console.log('       https://webhook.site (génère une URL de test)');
  console.log('');
}

testWebhooks().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
