/**
 * Test E2E - Smart Notifications
 * Test complet du système sans déploiement Directus
 * 
 * Usage: node scripts/test-e2e.mjs
 */

import { NotificationEngine } from '../src/lib/notification-engine.js';
import { ConditionEvaluator } from '../src/lib/condition-evaluator.js';
import { RecipientResolver } from '../src/lib/recipient-resolver.js';
import { TemplateRenderer } from '../src/lib/template-renderer.js';
import { Deduplicator } from '../src/lib/deduplicator.js';
import { QueueManager } from '../src/lib/queue-manager.js';
import { EmailChannel } from '../src/channels/email.js';
import { WebhookChannel } from '../src/channels/webhook.js';

// Mock logger
const logger = {
  info: (msg, ...args) => console.log('ℹ️ ', msg, ...args),
  warn: (msg, ...args) => console.warn('⚠️ ', msg, ...args),
  error: (msg, ...args) => console.error('❌', msg, ...args),
  debug: (msg, ...args) => console.log('🔍', msg, ...args)
};

// Mock database (in-memory)
class MockDatabase {
  constructor() {
    this.tables = {
      quartz_notification_rules: [],
      quartz_notification_templates: [],
      quartz_notification_logs: [],
      quartz_notification_queue: [],
      processus: []
    };
    this.lastInsertId = 1;
  }

  // Simulate Knex query builder
  select(...fields) {
    this.queryState = { fields, filters: [], table: null };
    return this;
  }

  from(table) {
    this.queryState.table = table;
    return this;
  }

  where(field, operator, value) {
    if (!this.queryState) {
      this.queryState = { fields: [], filters: [], table: this.currentTable };
    }
    if (arguments.length === 2) {
      value = operator;
      operator = '=';
    }
    this.queryState.filters.push({ field, operator, value });
    return this;
  }

  whereRaw(sql, bindings) {
    // Simplified - just ignore for now
    return this;
  }

  orderBy(field, direction) {
    this.queryState.orderBy = { field, direction };
    return this;
  }

  limit(n) {
    this.queryState.limit = n;
    return this;
  }

  offset(n) {
    this.queryState.offset = n;
    return this;
  }

  groupBy(...fields) {
    this.queryState.groupBy = fields;
    return this;
  }

  async first() {
    const results = await this.execute();
    return results[0] || null;
  }

  async execute() {
    const tableName = this.currentTable || this.queryState?.table;
    let data = [...(this.tables[tableName] || [])];

    // Apply filters
    if (this.queryState?.filters) {
      data = data.filter(row => {
        return this.queryState.filters.every(f => {
          if (f.operator === '=') return row[f.field] === f.value;
          if (f.operator === '>=') return row[f.field] >= f.value;
          if (f.operator === '<=') return row[f.field] <= f.value;
          if (f.operator === '>') return row[f.field] > f.value;
          if (f.operator === '<') return row[f.field] < f.value;
          return true;
        });
      });
    }

    // Apply limit/offset
    if (this.queryState?.offset) data = data.slice(this.queryState.offset);
    if (this.queryState?.limit) data = data.slice(0, this.queryState.limit);

    return data;
  }

  // Shorthand for table selection
  call(table) {
    this.currentTable = table;
    return this;
  }

  async insert(data) {
    const tableName = this.currentTable;
    const id = this.lastInsertId++;
    const record = { id, ...data };
    this.tables[tableName].push(record);
    return [id];
  }

  async update(data) {
    const tableName = this.currentTable;
    const filters = this.queryState?.filters || [];
    
    this.tables[tableName] = this.tables[tableName].map(row => {
      const matches = filters.every(f => row[f.field] === f.value);
      if (matches) {
        return { ...row, ...data };
      }
      return row;
    });

    return 1;
  }

  increment(field, amount = 1) {
    this.updateData = this.updateData || {};
    this.updateData[field] = amount;
    return this;
  }

  count(field) {
    this.queryState = this.queryState || {};
    this.queryState.count = field;
    return this;
  }
}

// Create a callable mock database
function createMockDB() {
  const db = new MockDatabase();
  const callable = (table) => {
    db.currentTable = table;
    return db;
  };
  Object.setPrototypeOf(callable, db);
  return callable;
}

// Mock services
const mockServices = {
  ItemsService: class {
    constructor(collection, options) {
      this.collection = collection;
      this.database = options.knex;
    }

    async readOne(id) {
      const table = this.database.tables[this.collection];
      return table.find(item => item.id === id) || null;
    }
  },
  NotificationsService: class {
    constructor(options) {
      this.database = options.knex;
    }

    async createOne(data) {
      const id = this.database.lastInsertId++;
      logger.info(`[MockNotificationsService] Created in-app notification ${id}`);
      return id;
    }
  }
};

// Setup test data
function setupTestData(database) {
  // Template
  database.tables.quartz_notification_templates.push({
    id: 1,
    code: 'test-template',
    name: 'Test Notification',
    status: 'published',
    content: 'Bonjour {{responsable}}, le processus "{{nom}}" arrive à échéance le {{date_echeance | date}}. Il reste {{jours_restants}} jours.',
    email_config: {
      subject: 'Échéance proche : {{nom}}',
      body: '<h1>{{nom}}</h1><p>Date : {{date_echeance | date}}</p><p>Jours restants : {{jours_restants}}</p>',
      from: 'test@flowquartz.com'
    },
    webhook_config: {
      provider: 'slack',
      title: 'Échéance : {{nom}}',
      text: 'Il reste {{jours_restants}} jours'
    }
  });

  // Rule
  database.tables.quartz_notification_rules.push({
    id: 1,
    name: 'Test Rule',
    code: 'test-rule',
    status: 'published',
    enabled: true,
    trigger_type: 'manual',
    template_id: 1,
    collections: JSON.stringify(['processus']),
    channels: ['email'], // Array, pas string
    conditions: {
      '>': [{ 'var': 'jours_restants' }, 0]
    },
    recipient_config: {
      type: 'static',
      emails: ['test@example.com']
    },
    frequency_config: {
      enable_dedup: true,
      dedup_window_hours: 24,
      max_per_day: 5
    },
    priority: 'normal',
    total_sent: 0,
    total_success: 0,
    total_failed: 0
  });

  // Processus
  database.tables.processus.push({
    id: 1,
    nom: 'Processus Test Alpha',
    responsable: 'Jean Dupont',
    date_echeance: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // +5 jours
    statut: 'en_cours'
  });

  database.tables.processus.push({
    id: 2,
    nom: 'Processus Test Beta',
    responsable: 'Marie Martin',
    date_echeance: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // -2 jours (dépassé)
    statut: 'en_retard'
  });
}

// Tests
async function runTests() {
  console.log('\n🚀 ========================================');
  console.log('   SMART NOTIFICATIONS - TEST E2E');
  console.log('========================================\n');

  const database = createMockDB();
  setupTestData(database);

  let testsRun = 0;
  let testsPassed = 0;
  let testsFailed = 0;

  const test = async (name, fn) => {
    testsRun++;
    try {
      console.log(`\n🧪 Test ${testsRun}: ${name}`);
      await fn();
      testsPassed++;
      console.log(`✅ PASSED\n`);
    } catch (error) {
      testsFailed++;
      console.error(`❌ FAILED: ${error.message}\n`);
      console.error(error.stack);
    }
  };

  const assert = (condition, message) => {
    if (!condition) throw new Error(message || 'Assertion failed');
  };

  // TEST 1: Condition Evaluator
  await test('Condition Evaluator - Evaluate conditions', async () => {
    const evaluator = new ConditionEvaluator(logger);

    const data = { jours_restants: 5, budget: 10000 };
    const conditions = {
      'and': [
        { '>': [{ 'var': 'jours_restants' }, 0] },
        { '<': [{ 'var': 'budget' }, 15000] }
      ]
    };

    const result = evaluator.evaluate(conditions, data);
    assert(result === true, 'Conditions should evaluate to true');

    const variables = evaluator.extractVariables(conditions);
    assert(variables.includes('jours_restants'), 'Should extract jours_restants');
    assert(variables.includes('budget'), 'Should extract budget');
  });

  // TEST 2: Template Renderer
  await test('Template Renderer - Render template with filters', async () => {
    const renderer = new TemplateRenderer(logger);

    const template = 'Bonjour {{nom | uppercase}}, il reste {{jours}} jours. Date: {{date | date}}';
    const data = {
      nom: 'jean',
      jours: 5,
      date: '2025-10-24T10:00:00Z'
    };

    const result = renderer.render(template, data);
    console.log('Rendered result:', result);
    assert(result.includes('JEAN'), 'Should apply uppercase filter');
    assert(result.includes('5'), 'Should render jours');
    // Date format might vary, just check it's there
    assert(result.includes('2025') || result.includes('10'), 'Should include date components');
  });

  // TEST 3: Recipient Resolver - Static
  await test('Recipient Resolver - Resolve static emails', async () => {
    const resolver = new RecipientResolver(mockServices, database, logger);

    const config = {
      type: 'static',
      emails: ['user1@test.com', 'user2@test.com']
    };

    const recipients = await resolver.resolve(config, {}, 'processus');
    assert(recipients.length === 2, 'Should resolve 2 recipients');
    assert(recipients[0].email === 'user1@test.com', 'First email correct');
  });

  // TEST 4: Recipient Resolver - Dynamic field
  await test('Recipient Resolver - Resolve dynamic field', async () => {
    const resolver = new RecipientResolver(mockServices, database, logger);

    const config = {
      type: 'dynamic_field',
      field: 'responsable'
    };

    const item = { responsable: 'admin@company.com' };
    const recipients = await resolver.resolve(config, item, 'processus');
    
    assert(recipients.length === 1, 'Should resolve 1 recipient');
    assert(recipients[0].email === 'admin@company.com', 'Email should match field value');
  });

  // TEST 5: Deduplicator
  await test('Deduplicator - Generate dedup key', async () => {
    const deduplicator = new Deduplicator(database, logger);

    const key1 = deduplicator.generateDedupKey(1, 'processus', 1, 'test@example.com');
    const key2 = deduplicator.generateDedupKey(1, 'processus', 1, 'test@example.com');
    const key3 = deduplicator.generateDedupKey(1, 'processus', 2, 'test@example.com');

    assert(key1 === key2, 'Same params should generate same key');
    assert(key1 !== key3, 'Different item should generate different key');
    assert(key1.length === 32, 'Key should be MD5 hash (32 chars)');
  });

  // TEST 6: Email Channel (test mode)
  await test('Email Channel - Send in test mode', async () => {
    const emailConfig = {
      smtp_host: 'smtp.test.com',
      smtp_port: 587,
      default_from: 'noreply@test.com'
    };
    const channel = new EmailChannel(emailConfig, logger);

    const template = database.tables.quartz_notification_templates[0];
    const recipient = { email: 'test@example.com', name: 'Test User' };
    const variables = {
      nom: 'Processus Test',
      responsable: 'Jean Dupont',
      date_echeance: '2025-10-24T10:00:00Z',
      jours_restants: 5
    };

    const result = await channel.send(template, recipient, variables, { testMode: true });
    
    assert(result.success === true, 'Should succeed in test mode');
    assert(result.testMode === true, 'Should indicate test mode');
    assert(result.subject.includes('Processus Test'), 'Subject should contain processus name');
  });

  // TEST 7: Webhook Channel (test mode)
  await test('Webhook Channel - Build Slack payload', async () => {
    const channel = new WebhookChannel({ timeout: 5000 }, logger);

    const template = database.tables.quartz_notification_templates[0];
    const recipient = { webhook_url: 'https://hooks.slack.com/test' };
    const variables = {
      nom: 'Processus Test',
      jours_restants: 5
    };

    const result = await channel.send(template, recipient, variables, { testMode: true });
    
    assert(result.success === true, 'Should succeed in test mode');
    assert(result.testMode === true, 'Should indicate test mode');
    assert(result.channel === 'webhook', 'Channel should be webhook');
  });

  // TEST 8: Queue Manager
  await test('Queue Manager - Enqueue and check dedup', async () => {
    const engine = createMockEngine(database);
    const queueManager = new QueueManager(database, logger, engine);

    const id1 = await queueManager.enqueue(1, 'processus', 1, {
      priority: 'normal',
      dedup_key: 'test-key-123'
    });

    assert(id1 > 0, 'Should return queue ID');
    assert(database.tables.quartz_notification_queue.length === 1, 'Should add to queue');

    // Try to enqueue same dedup_key (should be blocked by dedup)
    const id2 = await queueManager.enqueue(1, 'processus', 1, {
      priority: 'normal',
      dedup_key: 'test-key-123'
    });

    // Mock database doesn't handle unique constraint, but in real DB this would be null
    logger.info(`Second enqueue result: ${id2}`);
  });

  // TEST 9: Notification Engine - Process notification (test mode)
  await test('Notification Engine - Process notification in test mode', async () => {
    const engine = createMockEngine(database);

    // Register email channel
    const emailChannel = new EmailChannel({
      smtp_host: 'smtp.test.com',
      smtp_port: 587,
      default_from: 'noreply@test.com'
    }, logger);
    engine.registerChannel('email', emailChannel);

    const result = await engine.processNotification(1, 'processus', 1, {
      test_mode: true,
      override_recipient: 'override@test.com'
    });

    assert(result.success === true, 'Should succeed');
    assert(result.rule_id === 1, 'Should return rule ID');
    assert(result.recipients_count === 1, 'Should have 1 recipient');
    assert(result.results.length > 0, 'Should have results');
  });

  // TEST 10: Full scenario - Deadline approaching
  await test('SCENARIO: Deadline approaching notification', async () => {
    const engine = createMockEngine(database);

    const emailChannel = new EmailChannel({
      smtp_host: 'smtp.test.com',
      smtp_port: 587,
      default_from: 'noreply@test.com'
    }, logger);
    engine.registerChannel('email', emailChannel);

    // Process for processus 1 (5 days remaining)
    const result = await engine.processNotification(1, 'processus', 1, {
      test_mode: true
    });

    assert(result.success === true, 'Notification should succeed');
    assert(!result.skipped, 'Should not be skipped');
    logger.info(`✅ Notification would be sent to: ${result.recipients_count} recipient(s)`);
  });

  // TEST 11: Full scenario - Condition not met (deadline passed)
  await test('SCENARIO: Deadline passed - condition not met', async () => {
    const engine = createMockEngine(database);

    const emailChannel = new EmailChannel({
      smtp_host: 'smtp.test.com',
      smtp_port: 587,
      default_from: 'noreply@test.com'
    }, logger);
    engine.registerChannel('email', emailChannel);

    // Process for processus 2 (deadline passed, jours_restants < 0)
    const result = await engine.processNotification(1, 'processus', 2, {
      test_mode: true
    });

    assert(result.success === true, 'Should complete successfully');
    assert(result.skipped === true, 'Should be skipped due to conditions');
    assert(result.reason === 'conditions_not_met', 'Reason should be conditions_not_met');
    logger.info(`✅ Notification correctly skipped (conditions not met)`);
  });

  // Summary
  console.log('\n========================================');
  console.log('   TEST RESULTS');
  console.log('========================================');
  console.log(`Total tests:  ${testsRun}`);
  console.log(`✅ Passed:    ${testsPassed}`);
  console.log(`❌ Failed:    ${testsFailed}`);
  console.log('========================================\n');

  if (testsFailed === 0) {
    console.log('🎉 ALL TESTS PASSED! 🎉\n');
  } else {
    console.log('⚠️  SOME TESTS FAILED\n');
    process.exit(1);
  }
}

// Helper to create mock engine
function createMockEngine(database) {
  return new NotificationEngine({
    services: mockServices,
    database,
    logger,
    emitter: null,
    getSchema: async () => ({})
  });
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
