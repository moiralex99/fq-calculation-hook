export function parseJSON(val) {
  if (val == null) return null;
  if (typeof val === 'object') return val;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return val; // keep raw string
    }
  }
  return val;
}

export function normalizeAutomationRow(row) {
  let rule = row.rule ?? row.rule_jsonb ?? row.trigger ?? null;
  rule = parseJSON(rule);

  let actions = row.actions ?? row.actions_jsonb ?? [];
  actions = parseJSON(actions);
  if (actions && !Array.isArray(actions)) {
    actions = actions.type ? [actions] : [];
  }

  // Parse collection_cible to support both string and array
  let collection_cible = row.collection_cible;
  collection_cible = parseJSON(collection_cible);

  return { ...row, rule, actions, collection_cible };
}

export function normalizeAutomations(rows) {
  return (rows || []).map(normalizeAutomationRow);
}
