import { createAutomationEngine } from './lib/automation-engine.js';
import { createJsonLogicEvaluator } from './lib/jsonlogic-evaluator.js';
import { normalizeAutomations } from './lib/normalize.js';

export default ({ action, filter }, { services, database, logger, getSchema }) => {
  const { ItemsService } = services;
  // Provide DB-backed fetchers for nested lookups inside JSONLogic
  const evaluator = createJsonLogicEvaluator({
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
  let automations = [];
  let pendingReloadTimeout = null;
  // Throttle registry: { key: Timeout }
  const throttleTimers = new Map();

  function makeThrottleKey({ rule, collection, meta, scope }) {
    // scope: 'rule' (default), 'collection', 'item', 'user'
    const parts = ['auto', String(rule.id ?? rule.name ?? 'unknown')];
    if (scope === 'collection') parts.push(String(collection));
    else if (scope === 'item') parts.push(String(meta?.keys?.[0] ?? 'unknown'));
    else if (scope === 'user') parts.push(String(meta?.accountability?.user ?? 'anon'));
    return parts.join('::');
  }

  async function loadAutomations() {
    try {
      const service = new ItemsService('quartz_automations', { database, schema: await getSchema() });
      const res = await service.readByQuery({
        limit: -1,
        sort: ['priority'],
        fields: ['id','name','status','collection_cible','rule','rule_jsonb','actions','actions_jsonb','priority','expand_fields','trigger_event','throttle_ms','throttle_scope'],
        filter: { status: { _eq: 'active' } }
      });
      const rows = Array.isArray(res) ? res : (res?.data || []);
      // Normaliser champs rule/actions, parser si nécessaire
      automations = normalizeAutomations(rows);

      logger.info(`[Automations] 📋 Loaded ${automations.length} active rules (normalized)`);
      for (const a of automations) {
        const count = Array.isArray(a.actions) ? a.actions.length : 0;
        const collections = Array.isArray(a.collection_cible) 
          ? a.collection_cible.join(',') 
          : (a.collection_cible || 'any');
        logger.info(`[Automations]   - "${a.name || a.id}" on ${collections} with ${count} actions`);
        if (count === 0) {
          logger.warn(`[Automations] ⚠️ Rule '${a.name || a.id}' has no actions after normalization`);
        }
      }
      return true;
    } catch (err) {
      logger.warn(`[Automations] Can't load rules (table missing yet?) → ${err?.message || err}`);
      automations = [];
      return false;
    }
  }

  // Compute a signature of current automations config to detect stability
  function computeAutomationsSignature() {
    const stable = automations.map(a => `${a.id}:${a.name}:${JSON.stringify(a.rule)}:${JSON.stringify(a.actions)}`).join('|');
    // Simple hash
    let hash = 0;
    for (let i = 0; i < stable.length; i++) {
      const char = stable.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  // Stable reload: retry until config stabilizes (avoid reading intermediate states)
  async function stableReloadAutomations({ attempts = 3, settleDelayMs = 700, reason = 'unknown' } = {}) {
    let lastSig = null;
    for (let i = 1; i <= attempts; i++) {
      await loadAutomations();
      const sig = computeAutomationsSignature();
      logger.debug(`[Automations] Reload attempt ${i}/${attempts} (reason: ${reason}) signature: ${sig}`);
      if (lastSig && sig === lastSig) {
        logger.info(`[Automations] 🔒 Reload stabilized on attempt ${i} (reason: ${reason})`);
        return true;
      }
      lastSig = sig;
      if (i < attempts) {
        await new Promise(r => setTimeout(r, settleDelayMs));
      }
    }
    logger.info(`[Automations] ✅ Reload completed after ${attempts} attempts (reason: ${reason})`);
    return true;
  }

  // Real executors: use Directus services; trigger_flow will call Directus Flows via directus events
  const engine = createAutomationEngine({
    evaluator,
    logger,
    executors: {
      // Create an item using ItemsService
      async create_item({ collection, data, context }) {
        if (!collection) throw new Error('create_item requires collection');
        const schema = await getSchema();
        const service = new ItemsService(collection, { database, schema });
        // Mark this create as triggered by automation to prevent infinite loops
        const accountability = { 
          user: context?.$USER?.id,
          _automationTriggered: true 
        };
        const created = await service.createOne(data, { accountability });
        return created;
      },
      // Update an item using ItemsService
      async update_item({ collection, id, data, context }) {
        if (!collection) throw new Error('update_item requires collection');
        if (!id) throw new Error('update_item requires id');
        const schema = await getSchema();
        const service = new ItemsService(collection, { database, schema });
        // Mark this update as triggered by automation to prevent infinite loops
        const accountability = { 
          user: context?.$USER?.id,
          _automationTriggered: true 
        };
        const updated = await service.updateOne(id, data, { accountability });
        return updated;
      },
      // Update many items by filter. If updateByQuery isn't available, fallback to read ids + updateMany.
      async update_many({ collection, filter = {}, data = {}, limit = -1, context }) {
        if (!collection) throw new Error('update_many requires collection');
        const schema = await getSchema();
        const service = new ItemsService(collection, { database, schema });
        const accountability = {
          user: context?.$USER?.id,
          _automationTriggered: true
        };
        // Preferred: updateByQuery if available
        try {
          if (typeof service.updateByQuery === 'function') {
            const query = { filter, limit };
            const res = await service.updateByQuery(query, data, { accountability });
            // Not all implementations return a count; best-effort
            return { count: Array.isArray(res) ? res.length : (res?.length ?? null) };
          }
        } catch (e) {
          logger.warn(`[Automations] updateByQuery failed on ${collection}: ${e?.message || e}`);
        }
        // Fallback: list ids then updateMany
        const collectionMeta = schema.collections?.[collection] || {};
        const pk = collectionMeta.primary || 'id';
        const read = await service.readByQuery({ filter, limit, fields: [pk] });
        const rows = Array.isArray(read) ? read : (read?.data || []);
        const keys = rows.map(r => r?.[pk]).filter(v => v != null);
        if (keys.length === 0) return { count: 0 };
        await service.updateMany(keys, data, { accountability });
        return { count: keys.length };
      },
      // Trigger a Directus Flow by emitting a custom action
      async trigger_flow({ key, payload, context }) {
        // In Directus Flows, create a trigger listening for the custom action name below
        // and optionally filter by key in the payload.
        await action('automations.trigger.flow', { key, payload, user: context?.$USER?.id });
      },
      // Placeholder; wire to your mailer or a webhook if needed
      async send_email({ to, subject, body, context }) {
        logger.info(`[Automations] (stub) send_email to=${to} subject=${subject}`);
      }
    }
  });

  // Initial load
  loadAutomations();

  // Debounced reload helper (coalesce bursts of changes)
  function scheduleReload(reason = '') {
    if (pendingReloadTimeout) clearTimeout(pendingReloadTimeout);
    // Use longer debounce to let Directus finalize all writes
    // (Studio can send multiple PATCH in a row: field, status, etc.)
    pendingReloadTimeout = setTimeout(async () => {
  logger.info(`[Automations] 🔄 Auto-reloading automations (reason: ${reason})...`);
      // Use stable reload to avoid intermediate states
      const ok = await stableReloadAutomations({ attempts: 3, settleDelayMs: 700, reason });
      if (ok) {
        const triggerSummary = automations.map(a => {
          const trigger = Array.isArray(a.trigger_event) ? a.trigger_event.join(',') : (a.trigger_event || 'update');
          return `${a.name}[${trigger}]`;
        }).join(', ');
        logger.info(`[Automations] 🎯 Active automations: ${triggerSummary}`);
      } else {
        logger.warn(`[Automations] ⚠️ Reload had issues`);
      }
      pendingReloadTimeout = null;
    }, 300); // Initial debounce
  }

  // Expose a manual reload action
  // Note: In a pure hook extension, this is not exposed as HTTP.
  // Keep it to allow programmatic invocation by other extensions.
  action('automations.reload', async () => {
    await loadAutomations();
    return { success: true, count: automations.length };
  });

  // Auto-reload when the automations collection is modified
  action('items.create', async (_metaInput, meta) => {
    if (meta?.collection === 'quartz_automations') {
      logger.info(`[Automations] 🆕 Detected create on quartz_automations`);
      scheduleReload('create');
    }
  });
  action('items.update', async (_metaInput, meta) => {
    if (meta?.collection === 'quartz_automations') {
      logger.info(`[Automations] ✏️ Detected update on quartz_automations`);
      scheduleReload('update');
    }
  });
  action('items.delete', async (_metaInput, meta) => {
    if (meta?.collection === 'quartz_automations') {
      logger.info(`[Automations] 🗑️ Detected delete on quartz_automations`);
      scheduleReload('delete');
    }
  });

  // Core hook: before write
  filter('items.update', async (payload, meta) => {
    try {
      // If updating automations table, schedule reload and skip processing
      if (meta?.collection === 'quartz_automations') {
        logger.info(`[Automations] ✏️ Detected update on quartz_automations (via filter), scheduling reload`);
        scheduleReload('items.update on quartz_automations');
        return payload;
      }

      // Filter automations that should trigger on 'update' event AND match this collection
      const updateAutomations = filterAutomationsByEvent(automations, 'update')
        .filter(a => matchesCollection(a, meta.collection));
      
      if (updateAutomations.length === 0) return payload;
      
      const schema = await getSchema();
  const service = new ItemsService(meta.collection, { database, schema });
  // Optionally expand related fields if rule requests it (expand_fields: ['project.*','client.email'])
  const expandFields = collectExpandFields(updateAutomations, meta.collection);
  const original = await service.readOne(meta.keys?.[0], expandFields.length ? { fields: expandFields } : undefined);
      const changedKeys = Object.keys(payload || {}).filter((k) => !original || payload[k] !== original[k]);
      logger.info(`[Automations] items.update on ${meta.collection} id=${meta.keys?.[0]} changed=[${changedKeys.join(', ')}] rules=${updateAutomations.length}`);
      // Throttle per automation if configured
      const results = {};
      const promises = [];
      for (const rule of updateAutomations) {
        const throttleMs = Number(rule.throttle_ms) || 0;
        const scope = rule.throttle_scope || 'rule';
        if (throttleMs > 0) {
          const key = makeThrottleKey({ rule, collection: meta.collection, meta, scope });
          if (throttleTimers.has(key)) clearTimeout(throttleTimers.get(key).timer);
          // store latest payload for this key
          const record = throttleTimers.get(key) || { lastPayload: null, lastOriginal: null };
          record.lastPayload = payload;
          record.lastOriginal = original;
          const timer = setTimeout(async () => {
            try {
              const updates = await engine.evaluate({
                collection: meta.collection,
                automations: [rule],
                newData: record.lastPayload,
                oldData: record.lastOriginal,
                context: { $USER: meta?.accountability?.user }
              });
              Object.assign(results, updates);
            } catch (e) { logger.error('[Automations] throttled evaluate failed', e?.message || e); }
            throttleTimers.delete(key);
          }, throttleMs);
          throttleTimers.set(key, { ...record, timer });
        } else {
          promises.push(engine.evaluate({
            collection: meta.collection,
            automations: [rule],
            newData: payload,
            oldData: original,
            context: { $USER: meta?.accountability?.user }
          }).then(updates => Object.assign(results, updates)).catch(e => logger.error('[Automations] evaluate failed', e?.message || e)));
        }
      }
      await Promise.all(promises);
      if (Object.keys(results).length > 0) {
        logger.info(`[Automations] updates computed → ${JSON.stringify(results)}`);
      } else {
        logger.info('[Automations] no updates computed');
      }
      return { ...payload, ...results };
    } catch (err) {
      logger.error('[Automations] Error in items.update:', err?.message || err);
      return payload;
    }
  });

  filter('items.create', async (payload, meta) => {
    try {
      // If creating automation, schedule reload and skip processing
      if (meta?.collection === 'quartz_automations') {
        logger.info(`[Automations] 🆕 Detected create on quartz_automations (via filter), scheduling reload`);
        scheduleReload('items.create on quartz_automations');
        return payload;
      }

      // Filter automations that should trigger on 'create' event AND match this collection
      const createAutomations = filterAutomationsByEvent(automations, 'create')
        .filter(a => matchesCollection(a, meta.collection));
      
      if (createAutomations.length === 0) return payload;
      
      // Skip if this create was triggered by an automation (prevent infinite loops)
      if (meta?.accountability?._automationTriggered) {
        logger.info(`[Automations] items.create on ${meta.collection} SKIPPED (automation-triggered)`);
        return payload;
      }
      
  logger.info(`[Automations] items.create on ${meta.collection} rules=${createAutomations.length}`);
      const results = {};
      const promises = [];
      for (const rule of createAutomations) {
        const throttleMs = Number(rule.throttle_ms) || 0;
        const scope = rule.throttle_scope || 'rule';
        if (throttleMs > 0) {
          const key = makeThrottleKey({ rule, collection: meta.collection, meta, scope });
          if (throttleTimers.has(key)) clearTimeout(throttleTimers.get(key).timer);
          const record = throttleTimers.get(key) || { lastPayload: null, lastOriginal: null };
          record.lastPayload = payload;
          record.lastOriginal = null;
          const timer = setTimeout(async () => {
            try {
              const updates = await engine.evaluate({
                collection: meta.collection,
                automations: [rule],
                newData: record.lastPayload,
                oldData: record.lastOriginal,
                context: { $USER: meta?.accountability?.user }
              });
              Object.assign(results, updates);
            } catch (e) { logger.error('[Automations] throttled evaluate failed', e?.message || e); }
            throttleTimers.delete(key);
          }, throttleMs);
          throttleTimers.set(key, { ...record, timer });
        } else {
          promises.push(engine.evaluate({
            collection: meta.collection,
            automations: [rule],
            newData: payload,
            oldData: null,
            context: { $USER: meta?.accountability?.user }
          }).then(updates => Object.assign(results, updates)).catch(e => logger.error('[Automations] evaluate failed', e?.message || e)));
        }
      }
      await Promise.all(promises);
      if (Object.keys(results).length > 0) {
        logger.info(`[Automations] updates computed → ${JSON.stringify(results)}`);
      } else {
        logger.info('[Automations] no updates computed');
      }
      return { ...payload, ...results };
    } catch (err) {
      logger.error('[Automations] Error in items.create:', err?.message || err);
      return payload;
    }
  });
};

// Helper: check if automation matches a collection
function matchesCollection(automation, collection) {
  const target = automation.collection_cible;
  
  // No target = match all collections
  if (!target) return true;
  
  // Support both string and array
  if (Array.isArray(target)) {
    return target.includes(collection);
  }
  
  return target === collection;
}

function collectExpandFields(automations, collection) {
  const set = new Set();
  for (const a of automations) {
    if (!matchesCollection(a, collection)) continue;
    const list = Array.isArray(a.expand_fields) ? a.expand_fields : [];
    for (const f of list) if (typeof f === 'string') set.add(f);
  }
  return Array.from(set);
}

function filterAutomationsByEvent(automations, event) {
  return automations.filter(a => {
    let trigger = a.trigger_event;
    
    // Default to ['update'] if not set
    if (!trigger) trigger = ['update'];
    
    // Support both array and string formats for backward compatibility
    let events;
    if (Array.isArray(trigger)) {
      events = trigger;
    } else if (typeof trigger === 'string') {
      // Legacy format: "create,update" or "*"
      if (trigger === '*') return true;
      events = trigger.split(',').map(e => e.trim());
    } else {
      events = ['update']; // fallback
    }
    
    // Check if wildcard or event matches
    return events.includes('*') || events.includes(event);
  });
}
