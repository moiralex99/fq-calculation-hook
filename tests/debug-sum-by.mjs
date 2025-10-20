#!/usr/bin/env node

/**
 * Test pour comprendre pourquoi sum_by retourne 0
 */

const data = [{"total_ligne":7797.4},{"total_ligne":14997}];

console.log('📊 Test sum_by:\n');
console.log('Data:', JSON.stringify(data));

// Test 1: Somme directe si c'était un tableau de nombres
const sum1 = data.reduce((s, it) => s + it.total_ligne, 0);
console.log('\n✅ Test 1 - reduce natif: total =', sum1);

// Test 2: Simuler sum_by avec { var: 'it.total_ligne' }
// JSONLogic cherche la clé 'it.total_ligne' (avec le point) dans le contexte
const sum2 = data.reduce((s, it) => {
  const ctx = { it };
  const value = ctx['it.total_ligne']; // undefined !
  console.log(`  Lookup ctx['it.total_ligne'] avec it=${JSON.stringify(it)} → ${value}`);
  return s + (Number(value) || 0);
}, 0);
console.log('❌ Test 2 - { var: "it.total_ligne" }: total =', sum2);

// Test 3: Simuler avec get
const sum3 = data.reduce((s, it) => {
  const ctx = { it };
  // get(ctx.it, 'total_ligne')
  const obj = ctx.it;
  const value = obj?.total_ligne;
  console.log(`  get(ctx.it, 'total_ligne') avec it=${JSON.stringify(it)} → ${value}`);
  return s + (Number(value) || 0);
}, 0);
console.log('✅ Test 3 - { get: [{ var: "it" }, "total_ligne"] }: total =', sum3);

console.log('\n💡 Solution: Utiliser { "get": [{ "var": "it" }, "total_ligne"] }');
