import { createJsonLogicEvaluator } from '../src/lib/jsonlogic-evaluator.js';

const { evaluateRule, evaluateValue } = createJsonLogicEvaluator();

function print(title, v) {
  console.log(`\n=== ${title} ===`);
  console.dir(v, { depth: 10 });
}

// Context with arrays and strings
const ctx = {
  name: 'Alice Wonderland',
  tags: ['vip', 'beta', 'fr'],
  orders: [
    { id: 1, amount: 20 },
    { id: 2, amount: 35 },
    { id: 3, amount: 10 }
  ]
};

// matches
const r1 = await evaluateRule({ matches: [ { var: 'name' }, 'alice', 'i' ] }, ctx);
// iif/case
const v2 = await evaluateValue({ case: [ { matches: [ { var: 'name' }, 'vip', 'i' ] }, 'VIP', true, 'STD', 'DEFAULT' ] }, ctx);
// map/filter/sum_by
const v3 = await evaluateValue({ sum_by: [ { var: 'orders' }, 'amount', {} ] }, ctx);
// any_by/all_by
const r4 = await evaluateRule({ and: [ { any_by: [ { var: 'orders' }, { '>': [ { var: 'it.amount' }, 30 ] }, {} ] }, { all_by: [ { var: 'orders' }, { '>': [ { var: 'it.amount' }, 5 ] }, {} ] } ] }, ctx);
// get/coalesce/length
const v5 = await evaluateValue({ coalesce: [ { get: [ { var: 'profile' }, 'address.city' ] }, 'Paris' ] }, ctx);
const v6 = await evaluateValue({ length: [ { var: 'tags' } ] }, ctx);

print('matches(name, alice, i)', r1);
print('case VIP', v2);
print('sum_by orders', v3);
print('any_by/all_by', r4);
print('coalesce/get', v5);
print('length(tags)', v6);
