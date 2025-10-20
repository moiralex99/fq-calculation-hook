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
  jsonLogic.add_operation('typeof', (x) => {
    if (x === null) return 'null';
    if (Array.isArray(x)) return 'array';
    return typeof x;
  });

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

  // Pass-through literal wrapper to protect plain objects from JSONLogic pre-evaluation
  jsonLogic.add_operation('literal', (x) => x);

  // Directus-style filter operators: treat as literals so they can appear inside JSONLogic args
  // Example: { lookup_many: [ 'tasks', { project: { _eq: { var: 'project_id' } } }, ['id'] ] }
  // Without these, json-logic-js would throw "Unrecognized operation _eq" while pre-evaluating arguments
  const DIRECTUS_FILTER_OPS = [
    '_eq', '_neq', '_lt', '_lte', '_gt', '_gte',
    '_in', '_nin', '_between',
    '_null', '_nnull',
    '_contains', '_ncontains', '_contains_all',
    '_starts_with', '_ends_with'
  ];
  for (const opName of DIRECTUS_FILTER_OPS) {
    jsonLogic.add_operation(opName, (...args) => {
      // Normalize by operator semantics
      switch (opName) {
        case '_null':
        case '_nnull':
          return { [opName]: true };
        case '_between':
          // Expect two args: min, max
          return { [opName]: args };
        case '_in':
        case '_nin':
        case '_contains_all':
          // Accept either array or spread args
          return { [opName]: Array.isArray(args[0]) ? args[0] : args };
        default:
          // Unary operators: _eq, _neq, _lt, _lte, _gt, _gte, _contains, _ncontains, _starts_with, _ends_with
          return { [opName]: args[0] };
      }
    });
  }

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
  
  // Store global context for lookup operations
  let globalContext = null;
  // Store for passing raw, non-JSONLogic objects through evaluation safely
  let rawStore = new Map();
  let rawCounter = 0;

  // Operators list to detect JSONLogic vs literal
  const JSONLOGIC_TOP_OPS = new Set([
    'var','if','and','or','!','!!','===','==','!=','>','>=','<','<=','+','-','*','/','%','in','cat',
    'now','date_diff','date_add','concat','matches','imatches','iif','case','get','coalesce','length',
    'map_by','filter_by','reduce_by','sum_by','any_by','all_by','lookup','lookup_many','changed_to','__ctx','literal',
    // directus-style filter ops registered above
    '_eq','_neq','_lt','_lte','_gt','_gte','_in','_nin','_between','_null','_nnull','_contains','_ncontains','_contains_all','_starts_with','_ends_with'
  ]);

  function preprocessJsonLogic(node) {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(preprocessJsonLogic);
    const keys = Object.keys(node);
    if (keys.length === 1 && (keys[0] === 'lookup_many' || keys[0] === 'lookup')) {
      const op = keys[0];
      const args = Array.isArray(node[op]) ? node[op].slice() : [];
      if (op === 'lookup_many' && args.length >= 2) {
        const filterArg = args[1];
        if (filterArg && typeof filterArg === 'object' && !Array.isArray(filterArg)) {
          const fk = Object.keys(filterArg);
          if (fk.length === 1 && !JSONLOGIC_TOP_OPS.has(fk[0])) {
            const token = `__RAW__${rawCounter++}`;
            rawStore.set(token, filterArg);
            args[1] = token; // plain string token, will not be pre-evaluated
          }
        }
      } else if (op === 'lookup' && args.length >= 3) {
        const fieldsArg = args[2];
        if (fieldsArg && typeof fieldsArg === 'object' && !Array.isArray(fieldsArg)) {
          const fk = Object.keys(fieldsArg);
          if (fk.length === 1 && !JSONLOGIC_TOP_OPS.has(fk[0])) {
            const token = `__RAW__${rawCounter++}`;
            rawStore.set(token, fieldsArg);
            args[2] = token;
          }
        }
      }
      const out = {};
      out[op] = args.map(preprocessJsonLogic);
      return out;
    }
    // default recurse
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = preprocessJsonLogic(v);
    return out;
  }
  
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
    try {
      if (!getItem) return null;
      let resolvedFields = fields;
      if (typeof fields === 'string' && rawStore.has(fields)) {
        resolvedFields = rawStore.get(fields);
      }
      return await getItem(collection, id, resolveTemplate(resolvedFields, ctx), ctx);
    } catch { return null; }
  });
  jsonLogic.add_operation('lookup_many', async (collection, filter = {}, fields = ['*'], limit = 50, ctx) => {
    try {
      if (!listItems) return [];
      // Utiliser le contexte fourni ou le contexte global
      const contextToUse = ctx || globalContext || {};
      let rawFilter = filter;
      let rawFields = fields;
      if (typeof filter === 'string' && rawStore.has(filter)) rawFilter = rawStore.get(filter);
      if (typeof fields === 'string' && rawStore.has(fields)) rawFields = rawStore.get(fields);
      const f = resolveTemplate(rawFilter, contextToUse) || {};
      const fld = resolveTemplate(rawFields, contextToUse) || ['*'];
      // Debug logs for local testing (kept lightweight)
      if (process?.env?.AUTOMATIONS_DEBUG === '1') {
        try {
          // eslint-disable-next-line no-console
          console.log('[jsonlogic] lookup_many ctx keys=', Object.keys(contextToUse || {}));
          // eslint-disable-next-line no-console
          console.log('[jsonlogic] lookup_many resolved filter=', JSON.stringify(f));
          // eslint-disable-next-line no-console
          console.log('[jsonlogic] lookup_many resolved fields=', JSON.stringify(fld));
        } catch {}
      }
      const lim = Number.isFinite(limit) ? limit : 50;
      return await listItems(collection, f, fld, lim, contextToUse);
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
      globalContext = context; // Store context globally
      rawStore = new Map();
      rawCounter = 0;
      jsonLogic.add_operation('__ctx', () => context);
      const safeExpr = preprocessJsonLogic(expr);
      return await jsonLogic.apply(safeExpr, context);
    } catch (e) {
      if (process?.env?.AUTOMATIONS_DEBUG === '1') {
        try {
          // eslint-disable-next-line no-console
          console.error('[jsonlogic] evaluateValue error:', e?.message || e);
          // eslint-disable-next-line no-console
          console.error('[jsonlogic] expr:', JSON.stringify(expr));
          // eslint-disable-next-line no-console
          console.error('[jsonlogic] context keys:', Object.keys(context || {}));
        } catch {}
      }
      return null;
    }
  }

  return { evaluateRule, evaluateValue };
}
