/**
 * Automations HTTP endpoints
 * - POST /quartz-automations/dry-run : Evaluate a draft automation against a sample item (no side effects)
 * - POST /quartz-automations/lint    : Validate a draft automation (schema + JSONLogic + required fields)
 * - POST /quartz-automations/run     : Trigger an automation by UUID (for CRON/webhooks/manual triggers)
 */

import { createAutomationEngine } from './lib/automation-engine.js';
import { createJsonLogicEvaluator } from './lib/jsonlogic-evaluator.js';

export default (router, { services, database, logger, getSchema }) => {
  const { ItemsService } = services;

  function makeEvaluator() {
    return createJsonLogicEvaluator({
      getItem: async (collection, id, fields = ['*']) => {
        const schema = await getSchema();
        const service = new ItemsService(collection, { database, schema });
        return service.readOne(id, { fields });
      },
      listItems: async (collection, filter = {}, fields = ['*'], limit = 50) => {
        const schema = await getSchema();
        const service = new ItemsService(collection, { database, schema });
        const res = await service.readByQuery({ filter, fields, limit });
        return Array.isArray(res) ? res : (res?.data || []);
      }
    });
  }

  router.post('/dry-run', async (req, res) => {
    try {
      const { draft, sampleItem = {}, oldItem = null, collection = null } = req.body || {};
      if (!draft || typeof draft !== 'object') return res.status(400).json({ ok: false, error: 'Missing draft' });

      const evaluator = makeEvaluator();
      const sideEffects = [];
      const dryExecutors = {
        async create_item({ collection, data }) { sideEffects.push({ type: 'create_item', collection, data }); return { id: 'dry-id' }; },
        async update_item({ collection, id, data }) { sideEffects.push({ type: 'update_item', collection, id, data }); return { id }; },
        async update_many({ collection, filter, data, limit }) { sideEffects.push({ type: 'update_many', collection, filter, data, limit }); return { count: 0 }; },
        async trigger_flow({ key, payload }) { sideEffects.push({ type: 'trigger_flow', key, payload }); },
        async send_email({ to, subject }) { sideEffects.push({ type: 'send_email', to, subject }); },
      };
      const engine = createAutomationEngine({ evaluator, logger, executors: dryExecutors });

      const auto = Array.isArray(draft) ? draft[0] : draft;
      // Normalize a minimal automation rule
      const rule = {
        id: auto.id,
        name: auto.name || 'draft',
        status: auto.status || 'active',
        collection_cible: auto.collection_cible,
        rule: auto.rule || auto.rule_jsonb || auto.trigger || {},
        actions: Array.isArray(auto.actions) ? auto.actions : [],
        throttle_ms: auto.throttle_ms,
        throttle_scope: auto.throttle_scope,
      };

      // Determine a collection for context matching; fallback to first target or required param
      let coll = collection;
      if (!coll) {
        if (typeof rule.collection_cible === 'string') coll = rule.collection_cible;
        else if (Array.isArray(rule.collection_cible) && rule.collection_cible.length > 0) coll = rule.collection_cible[0];
      }
      if (!coll) return res.status(400).json({ ok: false, error: 'Provide collection or collection_cible' });

      const updates = await engine.evaluate({
        collection: coll,
        automations: [rule],
        newData: sampleItem,
        oldData: oldItem,
        context: { $USER: req?.accountability?.user }
      });

      res.json({ ok: true, updates, sideEffects });
    } catch (error) {
      logger.error('[Automations Endpoint] dry-run error:', error?.message || error);
      res.status(500).json({ ok: false, error: error?.message || String(error) });
    }
  });

  router.post('/lint', async (req, res) => {
    try {
      const { draft } = req.body || {};
      const messages = [];
      if (!draft || typeof draft !== 'object') {
        return res.status(400).json({ ok: false, messages: [{ level: 'error', message: 'Missing draft' }] });
      }

      const evaluator = makeEvaluator();
      const auto = Array.isArray(draft) ? draft[0] : draft;

      // Validate rule JSONLogic
      try {
        const ctx = {}; // minimal context
        await evaluator.evaluateRule(auto.rule || auto.rule_jsonb || auto.trigger || {}, ctx);
        messages.push({ level: 'info', message: 'Rule JSON valid' });
      } catch (e) {
        messages.push({ level: 'error', message: 'Rule invalid: ' + (e?.message || e) });
      }

      // Validate actions
      const actions = Array.isArray(auto.actions) ? auto.actions : [];
      const supported = new Set(['set_field','create_item','update_item','update_many','for_each','trigger_flow','send_email']);
      for (let i = 0; i < actions.length; i++) {
        const a = actions[i];
        if (!a || typeof a !== 'object') { messages.push({ level: 'error', message: `Action[${i}] is not an object` }); continue; }
        if (!a.type || !supported.has(a.type)) { messages.push({ level: 'error', message: `Action[${i}] unsupported type: ${a?.type}` }); continue; }
        if ('when' in a) {
          try { await evaluator.evaluateRule(a.when, {}); } catch (e) { messages.push({ level: 'warn', message: `Action[${i}].when invalid: ${e?.message || e}` }); }
        }
        if (a.type === 'set_field') { if (!('field' in a)) messages.push({ level: 'error', message: `Action[${i}] set_field requires 'field'` }); }
        if (a.type === 'create_item' || a.type === 'update_item' || a.type === 'update_many') {
          if (!a.collection) messages.push({ level: 'error', message: `Action[${i}] ${a.type} requires 'collection'` });
        }
        if (a.type === 'update_item') { if (!('id' in a)) messages.push({ level: 'error', message: `Action[${i}] update_item requires 'id'` }); }
        if (a.type === 'for_each') { if (!('list' in a) || !Array.isArray(a.actions)) messages.push({ level: 'error', message: `Action[${i}] for_each requires 'list' and 'actions[]'` }); }
      }

      // Validate collections exist (if schema available)
      try {
        const schema = await getSchema();
        const collections = new Set(Object.keys(schema.collections || {}));
        const target = auto.collection_cible;
        const list = Array.isArray(target) ? target : (target ? [target] : []);
        for (const c of list) if (!collections.has(c)) messages.push({ level: 'warn', message: `Unknown collection_cible: ${c}` });
        for (const a of actions) if ((a?.collection) && !collections.has(a.collection)) messages.push({ level: 'warn', message: `Unknown action collection: ${a.collection}` });
      } catch {}

      const ok = messages.every(m => m.level !== 'error');
      res.json({ ok, messages });
    } catch (error) {
      logger.error('[Automations Endpoint] lint error:', error?.message || error);
      res.status(500).json({ ok: false, messages: [{ level: 'error', message: error?.message || String(error) }] });
    }
  });

  /**
   * POST /automations/run
   * 
   * Trigger an automation manually (useful for CRON via Directus Flows, manual button, external webhook)
   * 
   * Body parameters:
   * - automation_id (uuid, REQUIRED): which automation to run (use UUID only for safety)
   * - collection (string, optional): override collection_cible
   * - item_id (any): run on a specific item (fetches from DB)
   * - filter (object): run on all items matching filter (uses lookup)
   * - context (object): custom variables for rule evaluation (e.g., $TRIGGER: 'cron')
   * - dry_run (boolean): if true, simulate without writing to DB
   * - accountability (object): user context for permissions (null = admin/service account)
   * 
   * Returns:
   * - { ok: true, results: [...], sideEffects: [...] }
   */
  router.post('/run', async (req, res) => {
    try {
      const {
        automation_id,
        collection,
        item_id,
        filter,
        context = {},
        dry_run = false,
        accountability = null
      } = req.body || {};

      // Security: Only accept UUID to avoid name collisions in production
      if (!automation_id) {
        return res.status(400).json({ 
          ok: false, 
          error: 'automation_id (UUID) is required. Do not use automation names to avoid production issues.' 
        });
      }

      // Load automation from database
      const schema = await getSchema();
      const automationsService = new ItemsService('quartz_automations', { database, schema, accountability });
      
      let automation;
      try {
        automation = await automationsService.readOne(automation_id);
      } catch (err) {
        return res.status(404).json({ ok: false, error: `Automation ${automation_id} not found` });
      }

      if (!automation) {
        return res.status(404).json({ ok: false, error: `Automation ${automation_id} not found` });
      }

      // Determine target collection
      const targetCollection = collection || automation.collection_cible;
      if (!targetCollection) {
        return res.status(400).json({ ok: false, error: 'No target collection specified' });
      }

      // Check permissions on target collection
      const collectionService = new ItemsService(targetCollection, { database, schema, accountability });

      const evaluator = makeEvaluator();
      const results = [];
      const sideEffects = [];

      // Build executors (real or dry-run)
      let executors;
      if (dry_run) {
        executors = {
          async create_item({ collection, data }) { sideEffects.push({ type: 'create_item', collection, data }); return { id: 'dry-id' }; },
          async update_item({ collection, id, data }) { sideEffects.push({ type: 'update_item', collection, id, data }); return { id }; },
          async update_many({ collection, filter, data, limit }) { sideEffects.push({ type: 'update_many', collection, filter, data, limit }); return { count: 0 }; },
          async trigger_flow({ key, payload }) { sideEffects.push({ type: 'trigger_flow', key, payload }); },
          async send_email({ to, subject, body }) { sideEffects.push({ type: 'send_email', to, subject }); },
        };
      } else {
        executors = {
          async create_item({ collection, data, context }) {
            const svc = new ItemsService(collection, { database, schema, accountability });
            return await svc.createOne(data, { accountability });
          },
          async update_item({ collection, id, data, context }) {
            const svc = new ItemsService(collection, { database, schema, accountability });
            return await svc.updateOne(id, data, { accountability });
          },
          async update_many({ collection, filter, data, limit, context }) {
            const svc = new ItemsService(collection, { database, schema, accountability });
            if (typeof svc.updateByQuery === 'function') {
              const res = await svc.updateByQuery({ filter, limit }, data, { accountability });
              return { count: Array.isArray(res) ? res.length : (res?.length ?? null) };
            }
            // Fallback
            const collMeta = schema.collections?.[collection] || {};
            const pk = collMeta.primary || 'id';
            const read = await svc.readByQuery({ filter, limit, fields: [pk] });
            const rows = Array.isArray(read) ? read : (read?.data || []);
            const keys = rows.map(r => r?.[pk]).filter(v => v != null);
            if (keys.length === 0) return { count: 0 };
            await svc.updateMany(keys, data, { accountability });
            return { count: keys.length };
          },
          async trigger_flow({ key, payload, context }) {
            // Emit Directus action event
            // (Note: req.context.emitter not available in endpoint; use manual Flow or external webhook)
            logger.info(`[Automations /run] trigger_flow: ${key}`);
          },
          async send_email({ to, subject, body, context }) {
            logger.info(`[Automations /run] send_email: to=${to} subject=${subject}`);
          }
        };
      }

      const engine = createAutomationEngine({ evaluator, logger, executors });

      // Normalize automation
      const rule = {
        id: automation.id,
        name: automation.name,
        status: automation.status,
        collection_cible: targetCollection,
        rule: automation.rule_jsonb || automation.rule || {},
        actions: automation.actions_jsonb || automation.actions || [],
        expand_fields: automation.expand_fields || [],
        throttle_ms: automation.throttle_ms,
        throttle_scope: automation.throttle_scope
      };

      // Execute on item_id or filter
      if (item_id) {
        // Single item
        const item = await collectionService.readOne(item_id, {
          fields: rule.expand_fields?.length ? rule.expand_fields : ['*']
        });

        const updates = await engine.evaluate({
          collection: targetCollection,
          automations: [rule],
          newData: item,
          oldData: null,
          context: { $USER: accountability?.user, $TRIGGER: 'manual', ...context }
        });

        if (!dry_run && updates && Object.keys(updates).length > 0) {
          await collectionService.updateOne(item_id, updates, { accountability });
        }

        results.push({ item_id, updates });
      } else if (filter) {
        // Multiple items
        const items = await collectionService.readByQuery({
          filter,
          fields: rule.expand_fields?.length ? rule.expand_fields : ['*'],
          limit: -1
        });

        const list = Array.isArray(items) ? items : (items?.data || []);
        
        for (const item of list) {
          const collMeta = schema.collections?.[targetCollection] || {};
          const pk = collMeta.primary || 'id';
          const id = item[pk];

          const updates = await engine.evaluate({
            collection: targetCollection,
            automations: [rule],
            newData: item,
            oldData: null,
            context: { $USER: accountability?.user, $TRIGGER: 'manual', ...context }
          });

          if (!dry_run && updates && Object.keys(updates).length > 0) {
            await collectionService.updateOne(id, updates, { accountability });
          }

          results.push({ item_id: id, updates });
        }
      } else {
        // No item_id or filter: execute with empty context (useful for pure side-effect automations like purge)
        const updates = await engine.evaluate({
          collection: targetCollection,
          automations: [rule],
          newData: {},
          oldData: null,
          context: { $USER: accountability?.user, $TRIGGER: 'manual', ...context }
        });

        results.push({ updates });
      }

      res.json({ ok: true, results, sideEffects: dry_run ? sideEffects : undefined });
    } catch (error) {
      logger.error('[Automations /run] error:', error?.message || error);
      res.status(500).json({ ok: false, error: error?.message || String(error) });
    }
  });
};
