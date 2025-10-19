export function createAutomationEngine({ evaluator, logger, executors = {} }) {
  return {
    async evaluate({ collection, automations, newData, oldData, context }) {
      const updates = {};
      const changed = Object.keys(newData || {}).filter((k) => !oldData || newData[k] !== oldData[k]);

      for (const rule of automations) {
        try {
          // Respect collection filtering (supports string or array). Normally handled upstream,
          // but keep here as a safety net.
          if (rule.collection_cible) {
            const tgt = rule.collection_cible;
            const matches = Array.isArray(tgt) ? tgt.includes(collection) : tgt === collection;
            if (!matches) continue;
          }
          if (rule.status && rule.status !== 'active') continue;

          const logic = rule.rule || rule.rule_jsonb || rule.trigger;
          if (!logic) continue;

          // Provide both old and new data at top-level for convenient access,
          // with newData taking precedence on conflicts.
          const combined = { ...(oldData || {}), ...(newData || {}) };
          const evalContext = {
            ...combined,
            $OLD: oldData || {},
            $CHANGED: changed,
            $USER: context?.$USER || null,
            $AUTOMATION: {
              id: rule.id,
              name: rule.name,
              throttle_ms: rule.throttle_ms,
              throttle_scope: rule.throttle_scope
            }
          };

          const shouldRun = await evaluator.evaluateRule(logic, evalContext);
          logger?.info(`[Automations] rule ${rule.name || rule.id || ''} match=${shouldRun} changed=[${changed.join(', ')}]`);

          if (!shouldRun) continue;

          const actions = Array.isArray(rule.actions) ? rule.actions : [];
          await executeActions(actions, { newData, oldData, context: evalContext, updates, evaluator, logger, executors });
        } catch (err) {
          logger?.error('[Automations] Rule failed:', rule?.name || rule?.id, err?.message || err);
        }
      }

      return updates;
    }
  };
}

async function executeActions(actions, { newData, oldData, context, updates, evaluator, logger, executors }) {
  for (const action of actions) {
    // Optional per-action guard: action.when (evaluate whenever the key exists)
    if (Object.prototype.hasOwnProperty.call(action, 'when')) {
      try {
        const ok = await evaluator.evaluateRule(action.when, context);
        if (!ok) {
          logger?.info(`[Automations] action ${action.type} skipped by when`);
          continue;
        }
      } catch {
        logger?.info(`[Automations] action ${action.type} skipped (when evaluation error)`);
        continue;
      }
    }
    if (action.type === 'set_field' && action.field) {
      const computed = await computeValue(action.value, { newData, oldData, context }, evaluator);
      // Skip undefined results to avoid writing unintentionally
      if (computed !== undefined) {
        logger?.info(`[Automations] action set_field ${action.field} = ${JSON.stringify(computed)}`);
        updates[action.field] = computed;
      } else {
        logger?.info(`[Automations] action set_field ${action.field} skipped (undefined)`);
      }
    } else if (action.type === 'for_each') {
      const list = await computeValue(action.list, { newData, oldData, context }, evaluator);
      const arr = Array.isArray(list) ? list : [];
      logger?.info(`[Automations] action for_each iterating over ${arr.length} items`);
      for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        const nestedContext = { ...context, $item: item, $index: i, $parent: context.$item || null };
        const nestedActions = Array.isArray(action.actions) ? action.actions : [];
        await executeActions(nestedActions, { newData, oldData, context: nestedContext, updates, evaluator, logger, executors });
      }
    } else if (action.type === 'trigger_flow' && executors.trigger_flow) {
      const key = action.key || action.flow_key || action.flow;
      const payload = await resolveDeepValues(action.payload || {}, { newData, oldData, context }, evaluator);
      logger?.info(`[Automations] action trigger_flow key=${key} payload=${JSON.stringify(payload)}`);
      try { await executors.trigger_flow({ key, payload, context }); } catch (e) { logger?.error('[Automations] trigger_flow failed', e?.message || e); }
    } else if (action.type === 'create_item' && executors.create_item) {
      const data = await resolveDeepValues(action.data || {}, { newData, oldData, context }, evaluator);
      const collection = action.collection;
      logger?.info(`[Automations] action create_item in ${collection} data=${JSON.stringify(data)}`);
      try {
        const created = await executors.create_item({ collection, data, context });
        if (action.assign && created) {
          context[`$${action.assign}`] = created;
          logger?.info(`[Automations] assigned $${action.assign} = ${created.id || created}`);
        }
      } catch (e) { logger?.error('[Automations] create_item failed', e?.message || e); }
    } else if (action.type === 'update_item' && executors.update_item) {
      const data = await resolveDeepValues(action.data || {}, { newData, oldData, context }, evaluator);
      const id = await computeValue(action.id, { newData, oldData, context }, evaluator);
      const collection = action.collection;
      logger?.info(`[Automations] action update_item in ${collection} id=${id} data=${JSON.stringify(data)}`);
      try {
        const updated = await executors.update_item({ collection, id, data, context });
        if (action.assign && updated) {
          context[`$${action.assign}`] = updated;
          logger?.info(`[Automations] assigned $${action.assign} = ${updated.id || updated}`);
        }
      } catch (e) { logger?.error('[Automations] update_item failed', e?.message || e); }
    } else if (action.type === 'send_email' && executors.send_email) {
      const to = await computeValue(action.to, { newData, oldData, context }, evaluator);
      const subject = await computeValue(action.subject, { newData, oldData, context }, evaluator);
      const body = await computeValue(action.body, { newData, oldData, context }, evaluator);
      logger?.info(`[Automations] action send_email to=${JSON.stringify(to)} subject=${JSON.stringify(subject)}`);
      try { await executors.send_email({ to, subject, body, context }); } catch (e) { logger?.error('[Automations] send_email failed', e?.message || e); }
    } else if (action.type === 'update_many' && executors.update_many) {
      const data = await resolveDeepValues(action.data || {}, { newData, oldData, context }, evaluator);
      const filter = await resolveDeepValues(action.filter || {}, { newData, oldData, context }, evaluator);
      const limit = await computeValue(action.limit, { newData, oldData, context }, evaluator);
      const collection = action.collection;
      logger?.info(`[Automations] action update_many in ${collection} filter=${JSON.stringify(filter)} data=${JSON.stringify(data)} limit=${JSON.stringify(limit)}`);
      try {
        const result = await executors.update_many({ collection, filter, data, limit, context });
        if (action.assign && result) {
          context[`$${action.assign}`] = result;
          logger?.info(`[Automations] assigned $${action.assign} = ${JSON.stringify(result)}`);
        }
      } catch (e) { logger?.error('[Automations] update_many failed', e?.message || e); }
    }
  }
}

async function computeValue(expr, { newData, oldData, context }, evaluator) {
  if (expr === 'NOW()') return new Date().toISOString();
  if (expr === '$USER.id') return context?.$USER?.id ?? null;

  // If expr is a JSONLogic object, evaluate it in the same context
  if (isJsonLogicExpr(expr)) {
    try {
      return await evaluator.evaluateValue(expr, context);
    } catch {
      // Failed to evaluate a JSONLogic expression
      return undefined;
    }
  }

  // Primitives and literals
  if (typeof expr === 'string' || typeof expr === 'number' || typeof expr === 'boolean' || expr == null) return expr;
  return null;
}

async function resolveDeepValues(node, { newData, oldData, context }, evaluator) {
  if (Array.isArray(node)) {
    const out = [];
    for (const el of node) out.push(await resolveDeepValues(el, { newData, oldData, context }, evaluator));
    return out;
  }
  if (node && typeof node === 'object') {
    // Only treat as JSONLogic if the object looks like a JSONLogic expression
    if (isJsonLogicExpr(node)) {
      const evaluated = await computeValue(node, { newData, oldData, context }, evaluator);
      const isConcrete = (v) => v !== undefined && (v === null || ['string','number','boolean'].includes(typeof v) || Array.isArray(v));
      if (isConcrete(evaluated)) return evaluated;
    }
    // Otherwise, recursively resolve fields (template object)
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = await resolveDeepValues(v, { newData, oldData, context }, evaluator);
    }
    return out;
  }
  // primitive => allow special tokens like NOW() or $USER.id
  return await computeValue(node, { newData, oldData, context }, evaluator);
}

// Heuristic: a JSONLogic expression is typically an object with a single top-level operator key
// Include both core and our custom operators
const JSONLOGIC_TOP_OPS = new Set([
  // Core
  'var','if','and','or','!','!!','===','==','!=','>','>=','<','<=','+','-','*','/','%','in','cat',
  // Custom
  'now','date_diff','date_add','concat','matches','imatches','iif','case','get','coalesce','length',
  'map_by','filter_by','reduce_by','sum_by','any_by','all_by','lookup','lookup_many','changed_to','__ctx'
]);

function isJsonLogicExpr(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const keys = Object.keys(obj);
  if (keys.length !== 1) return false;
  return JSONLOGIC_TOP_OPS.has(keys[0]);
}
