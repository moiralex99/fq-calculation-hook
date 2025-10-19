/**
 * Automations HTTP endpoints
 * - POST /automations/dry-run : Evaluate a draft automation against a sample item (no side effects)
 * - POST /automations/lint    : Validate a draft automation (schema + JSONLogic + required fields)
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
};
