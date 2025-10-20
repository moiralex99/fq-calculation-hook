import { createJsonLogicEvaluator } from '../src/lib/jsonlogic-evaluator.js';

// Capture calls
const calls = { listItems: [] };

const fetchers = {
  getItem: async () => null,
  listItems: async (collection, filter = {}, fields = ['*'], limit = 50) => {
    calls.listItems.push({ collection, filter, fields, limit });
    // Return stub data
    return [
      { id: 101, a: 1, b: 2, process: filter?.process?._eq ?? null },
      { id: 102, a: 3, b: 4, process: filter?.process?._eq ?? null }
    ];
  }
};

const evaluator = createJsonLogicEvaluator(fetchers);

const expr = {
  lookup_many: [
    'calc_tests',
    { process: { _eq: { var: '$old_process_id' } } },
    ['id','a','b','process'],
    500
  ]
};

const context = { $old_process_id: 1, id: 999 };

try {
  const result = await evaluator.evaluateValue(expr, context);
  console.log('RESULT:', JSON.stringify(result));
  console.log('CALLS:', JSON.stringify(calls, null, 2));
} catch (e) {
  console.error('ERROR:', e?.stack || e?.message || String(e));
}