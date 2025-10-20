#!/usr/bin/env node

// Test pour vérifier si get() fonctionne dans sum_by

import jsonLogic from 'json-logic-js';

// Ajouter l'opération get
jsonLogic.add_operation('get', (obj, path, defVal = null) => {
  console.log('  → get() appelé avec obj=', JSON.stringify(obj), 'path=', path);
  if (obj == null || path == null) return defVal;
  const parts = Array.isArray(path) ? path : String(path).split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return defVal;
    cur = cur[p];
  }
  const result = cur == null ? defVal : cur;
  console.log('  → get() retourne:', result);
  return result;
});

// Ajouter sum_by
jsonLogic.add_operation('sum_by', (arr, expr, ctx) => {
  console.log('\n📊 sum_by appelé:');
  console.log('  arr=', JSON.stringify(arr));
  console.log('  expr=', JSON.stringify(expr));
  console.log('  ctx=', JSON.stringify(ctx || {}));
  
  const result = arr.reduce((s, it, index) => {
    console.log(`\n  [${index}] it=`, JSON.stringify(it));
    const localCtx = { ...(ctx || {}), it };
    console.log(`  [${index}] localCtx=`, JSON.stringify(localCtx));
    
    const value = jsonLogic.apply(expr, localCtx);
    console.log(`  [${index}] expr évalué =`, value);
    
    const sum = s + (Number(value) || 0);
    console.log(`  [${index}] sum = ${s} + ${Number(value) || 0} = ${sum}`);
    return sum;
  }, 0);
  
  console.log('\n  ✅ sum_by retourne:', result);
  return result;
});

// Test
const data = {
  '$lignes': [
    {"total_ligne": 781689.35},
    {"total_ligne": 149970}
  ]
};

const expression = {
  sum_by: [
    { var: '$lignes' },
    { get: [{ var: 'it' }, 'total_ligne'] }
  ]
};

console.log('🧪 Test sum_by avec get:\n');
console.log('Data:', JSON.stringify(data, null, 2));
console.log('\nExpression:', JSON.stringify(expression, null, 2));
console.log('\n' + '='.repeat(60));

const result = jsonLogic.apply(expression, data);

console.log('\n' + '='.repeat(60));
console.log('\n🎯 Résultat final:', result);
console.log('✅ Attendu: 931659.35');
