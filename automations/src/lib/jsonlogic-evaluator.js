import jsonLogic from 'json-logic-js';

export function createJsonLogicEvaluator(fetchers = {}) {
  // Custom ops
  jsonLogic.add_operation('now', () => new Date().toISOString());
  jsonLogic.add_operation('date_diff', (a, b, unit = 'days') => {
    const d1 = new Date(a);
    const d2 = new Date(b);
    const ms = d1 - d2;
    if (!Number.isFinite(ms)) return 0;
    const div = unit === 'hours' ? 36e5 : unit === 'minutes' ? 6e4 : 864e5; // default days
    return Math.floor(ms / div);
  });
  jsonLogic.add_operation('date_add', (a, amount, unit = 'days') => {
    const d = new Date(a);
    if (Number.isFinite(amount)) {
      if (unit === 'minutes') d.setMinutes(d.getMinutes() + amount);
      else if (unit === 'hours') d.setHours(d.getHours() + amount);
      else d.setDate(d.getDate() + amount);
    }
    return d.toISOString();
  });
  jsonLogic.add_operation('concat', (...args) => args.filter((x) => x != null).join(''));

  // Regex matching
  jsonLogic.add_operation('matches', (text, pattern, flags = '') => {
    try {
      const safeFlags = String(flags ?? '').replace(/[^gimsuy]/g, '');
      const re = new RegExp(pattern ?? '', safeFlags);
      return re.test(String(text ?? ''));
    } catch {
      return false;
    }
  });
  jsonLogic.add_operation('imatches', (text, pattern) => {
    try {
      const re = new RegExp(pattern ?? '', 'i');
      return re.test(String(text ?? ''));
    } catch {
      return false;
    }
  });

  // Case / iif helpers (JSONLogic a déjà "if", mais on propose des alias)
  jsonLogic.add_operation('iif', (cond, thenVal, elseVal) => (cond ? thenVal : elseVal));
  jsonLogic.add_operation('case', (...args) => {
    // args: [cond1, val1, cond2, val2, ..., default]
    for (let i = 0; i < args.length - 1; i += 2) {
      if (args[i]) return args[i + 1];
    }
    return args.length % 2 === 1 ? args[args.length - 1] : null;
  });

  // Utilities
  jsonLogic.add_operation('get', (obj, path, defVal = null) => {
    if (obj == null || path == null) return defVal;
    const parts = Array.isArray(path) ? path : String(path).split('.');
    let cur = obj;
    for (const p of parts) {
      if (cur == null) return defVal;
      cur = cur[p];
    }
    return cur == null ? defVal : cur;
  });
  jsonLogic.add_operation('coalesce', (...args) => {
    for (const a of args) if (a !== undefined && a !== null) return a;
    return null;
  });
  jsonLogic.add_operation('length', (v) => (v == null ? 0 : Array.isArray(v) ? v.length : typeof v === 'object' ? Object.keys(v).length : String(v).length));

  // Array helpers executing JSONLogic expressions with item/acc in context
  function ensureArray(a) { return Array.isArray(a) ? a : []; }
  function evalExprOrPath(expr, localCtx) {
    try {
      if (expr && typeof expr === 'object' && !Array.isArray(expr)) return jsonLogic.apply(expr, localCtx);
      if (typeof expr === 'string') {
        // dot-path against localCtx.it
        const parts = expr.split('.');
        let cur = localCtx.it;
        for (const p of parts) cur = cur?.[p];
        return cur;
      }
      return expr;
    } catch { return undefined; }
  }
  jsonLogic.add_operation('map_by', (arr, expr, ctx) => {
    try { return ensureArray(arr).map((it) => evalExprOrPath(expr, { ...(ctx || {}), it })); } catch { return []; }
  });
  jsonLogic.add_operation('filter_by', (arr, pred, ctx) => {
    try { return ensureArray(arr).filter((it) => !!evalExprOrPath(pred, { ...(ctx || {}), it })); } catch { return []; }
  });
  jsonLogic.add_operation('reduce_by', (arr, accInit, expr, ctx) => {
    try { return ensureArray(arr).reduce((acc, it) => evalExprOrPath(expr, { ...(ctx || {}), acc, it }), accInit); } catch { return accInit; }
  });
  jsonLogic.add_operation('sum_by', (arr, expr, ctx) => {
    try { return ensureArray(arr).reduce((s, it) => s + Number(evalExprOrPath(expr, { ...(ctx || {}), it }) || 0), 0); } catch { return 0; }
  });
  jsonLogic.add_operation('any_by', (arr, pred, ctx) => {
    try { return ensureArray(arr).some((it) => !!evalExprOrPath(pred, { ...(ctx || {}), it })); } catch { return false; }
  });
  jsonLogic.add_operation('all_by', (arr, pred, ctx) => {
    try { return ensureArray(arr).every((it) => !!evalExprOrPath(pred, { ...(ctx || {}), it })); } catch { return false; }
  });

  // DB lookups (optional)
  const getItem = fetchers.getItem;
  const listItems = fetchers.listItems;
  function resolveTemplate(node, ctx) {
    if (node && typeof node === 'object') {
      // JSONLogic var shortcut
      if (Object.keys(node).length === 1 && Object.prototype.hasOwnProperty.call(node, 'var')) {
        try { return jsonLogic.apply(node, ctx); } catch { return null; }
      }
      if (Array.isArray(node)) return node.map((v) => resolveTemplate(v, ctx));
      const out = {};
      for (const [k, v] of Object.entries(node)) out[k] = resolveTemplate(v, ctx);
      return out;
    }
    return node;
  }
  jsonLogic.add_operation('lookup', async (collection, id, fields = ['*'], ctx) => {
    try { if (!getItem) return null; return await getItem(collection, id, resolveTemplate(fields, ctx)); } catch { return null; }
  });
  jsonLogic.add_operation('lookup_many', async (collection, filter = {}, fields = ['*'], limit = 50, ctx) => {
    try {
      if (!listItems) return [];
      const f = resolveTemplate(filter, ctx) || {};
      const fld = resolveTemplate(fields, ctx) || ['*'];
      const lim = Number.isFinite(limit) ? limit : 50;
      return await listItems(collection, f, fld, lim);
    } catch { return []; }
  });
  jsonLogic.add_operation('changed_to', (field, value, changed, context) => {
    try {
      const isChanged = Array.isArray(changed) && changed.includes(field);
      if (!isChanged) return false;
      // Compare using current context values
      return jsonLogic.apply({ '===': [{ var: field }, value] }, context);
    } catch {
      return false;
    }
  });

  async function evaluateRule(rule, context) {
    try {
      jsonLogic.add_operation('__ctx', () => context);
      const out = await jsonLogic.apply(rule, context);
      return out ? true : false;
    } catch {
      return false;
    }
  }

  async function evaluateValue(expr, context) {
    try {
      jsonLogic.add_operation('__ctx', () => context);
      return await jsonLogic.apply(expr, context);
    } catch {
      return null;
    }
  }

  return { evaluateRule, evaluateValue };
}
