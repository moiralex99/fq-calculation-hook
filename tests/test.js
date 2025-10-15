/**
 * Tests unitaires pour l'extension Calculs Temps Réel
 * 
 * Usage:
 *   node test.js
 */

import { DSLParser, DSLEvaluator } from '../src/dsl-parser.js';
import { DependencyGraph } from '../src/dependency-graph.js';

// Helpers pour les tests
let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  testsRun++;
  try {
    fn();
    testsPassed++;
    console.log(`✅ ${name}`);
  } catch (error) {
    testsFailed++;
    console.error(`❌ ${name}`);
    console.error(`   ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertDeepEqual(actual, expected, message) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(message || `Expected ${expectedStr}, got ${actualStr}`);
  }
}

// Mock logger
const logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
};

console.log('\n🧪 Tests Extension Directus - Calculs Temps Réel\n');
console.log('='.repeat(60));

// ==========================================
// Tests DSLParser
// ==========================================
console.log('\n📝 Tests DSLParser');
console.log('-'.repeat(60));

const parser = new DSLParser();

test('DSLParser: Extraction de champs simples', () => {
  const fields = parser.extractFields('{{prix}} * {{quantite}}');
  assertDeepEqual(fields.sort(), ['prix', 'quantite']);
});

test('DSLParser: Extraction de champs avec collection', () => {
  const fields = parser.extractFields('{{Phase.budget}} + {{montant}}');
  assertDeepEqual(fields.sort(), ['Phase.budget', 'montant']);
});

test('DSLParser: Extraction de dépendances locales uniquement', () => {
  const deps = parser.extractLocalDependencies('{{Phase.budget}} + {{montant}} + {{total}}');
  assertDeepEqual(deps.sort(), ['montant', 'total']);
});

test('DSLParser: Détection formule locale (simple)', () => {
  assert(parser.isLocalFormula('{{prix}} * {{quantite}}'), 'Should be local');
});

test('DSLParser: Détection formule locale (avec IF)', () => {
  assert(parser.isLocalFormula('IF({{stock}} < 10, "Alerte", "OK")'), 'Should be local');
});

test('DSLParser: Détection formule NON locale (collection)', () => {
  assert(!parser.isLocalFormula('{{Phase.budget}}'), 'Should not be local');
});

test('DSLParser: Détection formule NON locale (SUM)', () => {
  assert(!parser.isLocalFormula('SUM({{Actions.effort}})'), 'Should not be local');
});

test('DSLParser: Détection formule NON locale (LOOKUP)', () => {
  assert(!parser.isLocalFormula('LOOKUP({{parent_id}}, "phases", "budget")'), 'Should not be local');
});

test('DSLParser: Traduction DSL → JavaScript (simple)', () => {
  const js = parser.dslToJavaScript('{{prix}} * {{quantite}}');
  assert(js.includes('data.prix'), 'Should contain data.prix');
  assert(js.includes('data.quantite'), 'Should contain data.quantite');
  assert(js.includes('*'), 'Should contain multiplication');
});

test('DSLParser: Traduction DSL → JavaScript (opérateurs SQL)', () => {
  const js1 = parser.dslToJavaScript('{{a}} AND {{b}}');
  assert(js1.includes('&&'), 'AND should become &&');
  
  const js2 = parser.dslToJavaScript('{{a}} OR {{b}}');
  assert(js2.includes('||'), 'OR should become ||');
  
  const js3 = parser.dslToJavaScript('{{a}} <> {{b}}');
  assert(js3.includes('!=='), '<> should become !==');
});

test('DSLParser: Compilation et évaluation (arithmétique)', () => {
  const fn = parser.compile('{{prix}} * {{quantite}}');
  const result = fn({ prix: 10, quantite: 5 });
  assertEqual(result, 50, 'Should calculate 10 * 5 = 50');
});

test('DSLParser: Compilation et évaluation (IF)', () => {
  const fn = parser.compile('IF({{stock}} < 10, "Alerte", "OK")');
  const result1 = fn({ stock: 5 });
  assertEqual(result1, 'Alerte', 'Stock < 10 should return Alerte');
  
  const result2 = fn({ stock: 15 });
  assertEqual(result2, 'OK', 'Stock >= 10 should return OK');
});

test('DSLParser: Compilation et évaluation (COALESCE)', () => {
  const fn = parser.compile('COALESCE({{description}}, "Vide")');
  const result1 = fn({ description: null });
  assertEqual(result1, 'Vide', 'null should return default');
  
  const result2 = fn({ description: 'Test' });
  assertEqual(result2, 'Test', 'Should return description');
});

test('DSLParser: Compilation et évaluation (ROUND)', () => {
  const fn = parser.compile('ROUND({{montant}}, 2)');
  const result = fn({ montant: 10.556 });
  assertEqual(result, 10.56, 'Should round to 2 decimals');
});

test('DSLParser: Validation formule valide', () => {
  const validation = parser.validate('{{a}} + {{b}}', { a: 10, b: 20 });
  assert(validation.valid, 'Should be valid');
  assertEqual(validation.result, 30, 'Should calculate correctly');
});

test('DSLParser: Validation formule invalide', () => {
  // Une formule qui cause vraiment une erreur de syntaxe
  const validation = parser.validate('{{a}} + (', { a: 10 });
  assert(!validation.valid, 'Should be invalid');
  assert(validation.error, 'Should have error message');
});

// ==========================================
// Tests DSLEvaluator
// ==========================================
console.log('\n📝 Tests DSLEvaluator');
console.log('-'.repeat(60));

const evaluator = new DSLEvaluator(logger);

test('DSLEvaluator: Évaluation simple', () => {
  const result = evaluator.evaluate('{{prix}} * {{quantite}}', { prix: 10, quantite: 5 });
  assertEqual(result, 50);
});

test('DSLEvaluator: Cache des formules', () => {
  evaluator.clearCache();
  
  // Premier appel (compile)
  evaluator.evaluate('{{a}} + {{b}}', { a: 1, b: 2 });
  assert(evaluator.parser.compiledCache || evaluator.compiledCache, 'Should have cache');
  
  // Second appel (depuis cache)
  const result = evaluator.evaluate('{{a}} + {{b}}', { a: 10, b: 20 });
  assertEqual(result, 30, 'Should work from cache');
});

test('DSLEvaluator: Extraction de dépendances', () => {
  const deps = evaluator.extractDependencies('{{total_ht}} + {{montant_tva}}');
  assertDeepEqual(deps.sort(), ['montant_tva', 'total_ht']);
});

test('DSLEvaluator: Test local vs non-local', () => {
  assert(evaluator.isLocal('{{prix}} * {{quantite}}'), 'Should be local');
  assert(!evaluator.isLocal('SUM({{Actions.effort}})'), 'Should not be local');
});

// ==========================================
// Tests DependencyGraph
// ==========================================
console.log('\n📝 Tests DependencyGraph');
console.log('-'.repeat(60));

const depGraph = new DependencyGraph(logger);

test('DependencyGraph: Construction graphe simple', () => {
  const formulas = {
    total_ht: {
      formula: '{{prix}} * {{quantite}}',
      dependencies: ['prix', 'quantite']
    },
    total_ttc: {
      formula: '{{total_ht}} * 1.2',
      dependencies: ['total_ht']
    }
  };
  
  const graph = depGraph.buildGraph(formulas);
  
  assert(graph.total_ht, 'Should have total_ht');
  assert(graph.total_ttc, 'Should have total_ttc');
  assertDeepEqual(graph.total_ht.dependents, ['total_ttc'], 'total_ht should have total_ttc as dependent');
});

test('DependencyGraph: Tri topologique simple', () => {
  const graph = {
    a: { dependencies: [], dependents: ['b'] },
    b: { dependencies: ['a'], dependents: ['c'] },
    c: { dependencies: ['b'], dependents: [] }
  };
  
  const { order, cycles } = depGraph.topologicalSort(graph);
  
  assertDeepEqual(order, ['a', 'b', 'c'], 'Should sort in correct order');
  assertEqual(cycles.length, 0, 'Should have no cycles');
});

test('DependencyGraph: Tri topologique avec dépendances multiples', () => {
  const graph = {
    total_ht: { dependencies: ['prix', 'quantite'], dependents: ['montant_tva', 'total_ttc'] },
    montant_tva: { dependencies: ['total_ht', 'taux_tva'], dependents: ['total_ttc'] },
    total_ttc: { dependencies: ['total_ht', 'montant_tva'], dependents: [] }
  };
  
  const { order, cycles } = depGraph.topologicalSort(graph);
  
  // total_ht doit être avant montant_tva et total_ttc
  const indexHT = order.indexOf('total_ht');
  const indexTVA = order.indexOf('montant_tva');
  const indexTTC = order.indexOf('total_ttc');
  
  assert(indexHT < indexTVA, 'total_ht should be before montant_tva');
  assert(indexHT < indexTTC, 'total_ht should be before total_ttc');
  assert(indexTVA < indexTTC, 'montant_tva should be before total_ttc');
  assertEqual(cycles.length, 0, 'Should have no cycles');
});

test('DependencyGraph: Détection de cycle', () => {
  const graph = {
    a: { dependencies: ['b'], dependents: [] },
    b: { dependencies: ['a'], dependents: [] }
  };
  
  const { cycles } = depGraph.topologicalSort(graph);
  
  assert(cycles.length > 0, 'Should detect cycle');
});

test('DependencyGraph: Analyse complète', () => {
  const formulas = {
    total_ht: {
      formula: '{{prix}} * {{quantite}}',
      dependencies: ['prix', 'quantite']
    },
    montant_tva: {
      formula: '{{total_ht}} * 0.2',
      dependencies: ['total_ht']
    },
    total_ttc: {
      formula: '{{total_ht}} + {{montant_tva}}',
      dependencies: ['total_ht', 'montant_tva']
    }
  };
  
  const analysis = depGraph.analyze(formulas);
  
  assert(analysis.order, 'Should have order');
  assert(analysis.graph, 'Should have graph');
  assert(analysis.cycles, 'Should have cycles');
  assert(analysis.levels, 'Should have levels');
  
  assertEqual(analysis.cycles.length, 0, 'Should have no cycles');
  assertEqual(analysis.order.length, 3, 'Should have 3 fields in order');
});

test('DependencyGraph: Champs affectés', () => {
  const graph = {
    total_ht: { dependencies: ['prix', 'quantite'], dependents: ['montant_tva', 'total_ttc'] },
    montant_tva: { dependencies: ['total_ht'], dependents: ['total_ttc'] },
    total_ttc: { dependencies: ['total_ht', 'montant_tva'], dependents: [] }
  };
  
  // Trouver les champs calculés qui dépendent de 'prix'
  // On doit d'abord identifier les champs calculés dont les dependencies incluent 'prix'
  const initiallyAffected = Object.keys(graph).filter(field => 
    graph[field].dependencies.includes('prix')
  );
  
  // Puis propager aux dépendants
  const affected = depGraph.getAffectedFields(graph, initiallyAffected);
  
  // Modifier prix affecte indirectement montant_tva et total_ttc via total_ht
  assert(affected.includes('montant_tva'), 'Should affect montant_tva');
  assert(affected.includes('total_ttc'), 'Should affect total_ttc');
});

test('DependencyGraph: Ordre de calcul optimisé', () => {
  const graph = {
    total_ht: { dependencies: ['prix', 'quantite'], dependents: ['montant_tva', 'total_ttc'] },
    montant_tva: { dependencies: ['total_ht', 'taux_tva'], dependents: ['total_ttc'] },
    total_ttc: { dependencies: ['total_ht', 'montant_tva'], dependents: [] }
  };
  
  const order = ['total_ht', 'montant_tva', 'total_ttc'];
  
  // Trouver les champs calculés qui dépendent de 'prix'
  const initiallyAffected = Object.keys(graph).filter(field => 
    graph[field].dependencies.includes('prix')
  );
  
  // Si on modifie seulement prix, on doit recalculer total_ht et ses dépendants
  const optimized = depGraph.optimizeCalculationOrder(graph, order, initiallyAffected);
  
  assert(optimized.includes('total_ht'), 'Should recalculate total_ht');
  assert(optimized.includes('montant_tva'), 'Should recalculate montant_tva');
  assert(optimized.includes('total_ttc'), 'Should recalculate total_ttc');
});

// ==========================================
// Tests avancés DSLParser
// ==========================================
console.log('\n📝 Tests Avancés DSLParser');
console.log('-'.repeat(60));

test('DSLParser: Formule avec plusieurs IF imbriqués', () => {
  const fn = parser.compile('IF({{statut}} = "actif", IF({{age}} >= 18, "adulte", "mineur"), "inactif")');
  assertEqual(fn({ statut: 'actif', age: 25 }), 'adulte');
  assertEqual(fn({ statut: 'actif', age: 15 }), 'mineur');
  assertEqual(fn({ statut: 'inactif', age: 25 }), 'inactif');
});

test('DSLParser: COALESCE avec plusieurs valeurs', () => {
  const fn = parser.compile('COALESCE({{a}}, {{b}}, {{c}}, "default")');
  assertEqual(fn({ a: null, b: null, c: 10 }), 10);
  assertEqual(fn({ a: null, b: 5, c: 10 }), 5);
  assertEqual(fn({ a: null, b: null, c: null }), 'default');
});

test('DSLParser: Opérateurs de comparaison multiples', () => {
  const fn1 = parser.compile('{{a}} <= {{b}}');
  assert(fn1({ a: 5, b: 10 }) === true);
  assert(fn1({ a: 10, b: 10 }) === true);
  assert(fn1({ a: 15, b: 10 }) === false);
  
  const fn2 = parser.compile('{{a}} >= {{b}}');
  assert(fn2({ a: 15, b: 10 }) === true);
  
  const fn3 = parser.compile('{{a}} <> {{b}}');
  assert(fn3({ a: 5, b: 10 }) === true);
  assert(fn3({ a: 10, b: 10 }) === false);
});

test('DSLParser: Opérateurs logiques complexes', () => {
  const fn = parser.compile('({{a}} > 10 AND {{b}} < 20) OR {{c}} = "ok"');
  assert(fn({ a: 15, b: 15, c: 'no' }) === true);
  assert(fn({ a: 5, b: 15, c: 'ok' }) === true);
  assert(fn({ a: 5, b: 25, c: 'no' }) === false);
});

test('DSLParser: NOT avec parenthèses', () => {
  const fn = parser.compile('NOT ({{a}} > 10 AND {{b}} < 20)');
  assert(fn({ a: 15, b: 15 }) === false);
  assert(fn({ a: 5, b: 15 }) === true);
});

test('DSLParser: NULLIF avec égalité', () => {
  const fn = parser.compile('NULLIF({{valeur}}, 0)');
  assertEqual(fn({ valeur: 10 }), 10);
  assertEqual(fn({ valeur: 0 }), null);
});

test('DSLParser: ROUND avec nombres négatifs', () => {
  const fn = parser.compile('ROUND({{montant}}, 2)');
  assertEqual(fn({ montant: -10.556 }), -10.56);
  assertEqual(fn({ montant: -10.554 }), -10.55);
});

test('DSLParser: UPPER et LOWER', () => {
  const fn1 = parser.compile('UPPER({{nom}})');
  assertEqual(fn1({ nom: 'dupont' }), 'DUPONT');
  
  const fn2 = parser.compile('LOWER({{nom}})');
  assertEqual(fn2({ nom: 'MARTIN' }), 'martin');
});

test('DSLParser: CONCAT avec plusieurs champs', () => {
  const fn = parser.compile('CONCAT({{prenom}}, " ", {{nom}}, " (", {{ville}}, ")")');
  assertEqual(fn({ prenom: 'Jean', nom: 'Dupont', ville: 'Paris' }), 'Jean Dupont (Paris)');
});

test('DSLParser: Division par zéro', () => {
  const fn = parser.compile('{{a}} / {{b}}');
  const result = fn({ a: 10, b: 0 });
  assert(result === Infinity || isNaN(result), 'Division by zero should return Infinity or NaN');
});

test('DSLParser: Formule avec nombres décimaux', () => {
  const fn = parser.compile('{{prix}} * {{quantite}} * {{taux}}');
  const result = fn({ prix: 10.5, quantite: 2.5, taux: 1.196 });
  assert(Math.abs(result - 31.395) < 0.001, 'Should handle decimal calculations');
});

test('DSLParser: Extraction champs avec underscores', () => {
  const fields = parser.extractFields('{{total_ht}} + {{montant_tva}}');
  assertDeepEqual(fields, ['total_ht', 'montant_tva']);
});

test('DSLParser: Extraction champs avec nombres', () => {
  const fields = parser.extractFields('{{champ1}} + {{champ2}} + {{field_3}}');
  assertDeepEqual(fields, ['champ1', 'champ2', 'field_3']);
});

test('DSLParser: Formule avec seulement des constantes', () => {
  const fn = parser.compile('10 + 20 * 2');
  assertEqual(fn({}), 50);
});

test('DSLParser: Champ undefined retourne valeur falsy', () => {
  const fn = parser.compile('{{inexistant}} + 10');
  const result = fn({});
  assert(result === 10 || isNaN(result), 'Undefined field should be handled');
});

test('DSLParser: Fonctions logiques alias (and/or/not)', () => {
  const fn = parser.compile('and({{a}} > 0, or({{b}} = "ok", not({{c}})))');
  assert(fn({ a: 5, b: 'ko', c: false }) === true, 'Should evaluate nested logical aliases');
  assert(fn({ a: -1, b: 'ok', c: true }) === false, 'Should return false when first condition fails');
});

test('DSLParser: BETWEEN et IN', () => {
  const betweenFn = parser.compile('between({{score}}, 10, 20)');
  assert(betweenFn({ score: 15 }) === true, '15 should be between 10 and 20');
  assert(betweenFn({ score: 25 }) === false, '25 should not be between 10 and 20');

  const inFn = parser.compile('in({{statut}}, "nouveau", "actif", "clos")');
  assert(inFn({ statut: 'actif' }) === true, 'Value should be found in list');
  assert(inFn({ statut: 'archivé' }) === false, 'Value should not be found');
});

test('DSLParser: CASE_WHEN', () => {
  const fn = parser.compile('case_when({{score}} >= 90, "A", {{score}} >= 80, "B", "C")');
  assertEqual(fn({ score: 95 }), 'A');
  assertEqual(fn({ score: 82 }), 'B');
  assertEqual(fn({ score: 60 }), 'C');
});

test('DSLParser: Fonctions date (today, date_diff, date_add, date_trunc, end_of)', () => {
  const todayFn = parser.compile('today()');
  const todayResult = todayFn({});
  const now = new Date();
  const expectedToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  assertEqual(todayResult, expectedToday, 'today() should return current date (YYYY-MM-DD)');

  const diffFn = parser.compile('date_diff("day", {{start}}, {{end}})');
  assertEqual(diffFn({ start: '2025-10-01', end: '2025-10-15' }), 14, 'date_diff day should compute difference');

  const addFn = parser.compile('date_add("day", 5, {{start}})');
  assertEqual(addFn({ start: '2025-10-10' }), '2025-10-15', 'date_add day should add days');

  const truncFn = parser.compile('date_trunc("month", {{start}})');
  assertEqual(truncFn({ start: '2025-10-18' }), '2025-10-01', 'date_trunc month should return first day of month');

  const endFn = parser.compile('end_of("month", {{start}})');
  assertEqual(endFn({ start: '2025-02-10' }), '2025-02-28', 'end_of month should return last day of month');
});

test('DSLParser: Fonctions EXTRACT et START_OF/END_OF semaine', () => {
  const extractFn = parser.compile('extract("quarter", {{date_ref}})');
  assertEqual(extractFn({ date_ref: '2025-10-05' }), 4, 'Quarter should be 4');

  const startWeekFn = parser.compile('start_of("week", {{date_ref}})');
  assertEqual(startWeekFn({ date_ref: '2025-10-15' }), '2025-10-13', 'start_of week should return Monday');

  const endWeekFn = parser.compile('end_of("week", {{date_ref}})');
  assertEqual(endWeekFn({ date_ref: '2025-10-15' }), '2025-10-19', 'end_of week should return Sunday');
});

test('DSLParser: Fonctions texte (length, left, right, replace, regex)', () => {
  const lengthFn = parser.compile('length({{texte}})');
  assertEqual(lengthFn({ texte: 'Bonjour' }), 7);

  const leftFn = parser.compile('left({{code}}, 3)');
  assertEqual(leftFn({ code: 'ABC123' }), 'ABC');

  const rightFn = parser.compile('right({{code}}, 2)');
  assertEqual(rightFn({ code: 'ABC123' }), '23');

  const replaceFn = parser.compile('replace({{code}}, "-", "_")');
  assertEqual(replaceFn({ code: 'PH-001' }), 'PH_001');

  const regexMatchFn = parser.compile('regex_match({{code}}, "^[A-Z]+$")');
  assert(regexMatchFn({ code: 'TASK' }) === true, 'Regex should match uppercase string');
  assert(regexMatchFn({ code: 'Task1' }) === false, 'Regex should fail on lowercase/number');

  const regexExtractFn = parser.compile('regex_extract({{code}}, "([A-Z]+)-(\\\\d+)", 2)');
  assertEqual(regexExtractFn({ code: 'TASK-42' }), '42', 'Should extract numeric suffix');

  const regexReplaceFn = parser.compile('regex_replace({{code}}, "-\\\\d+$", "")');
  assertEqual(regexReplaceFn({ code: 'TASK-42' }), 'TASK', 'Regex replace should strip suffix');
});

test('DSLParser: Fonctions de conversion CAST / TRY_CAST', () => {
  const castIntFn = parser.compile('CAST({{valeur}}, "int")');
  assertEqual(castIntFn({ valeur: '12' }), 12);

  const castDateFn = parser.compile('CAST({{valeur}}, "date")');
  assertEqual(castDateFn({ valeur: '2025-10-15T12:00:00Z' }), '2025-10-15');

  const tryCastFn = parser.compile('TRY_CAST({{valeur}}, "int")');
  assertEqual(tryCastFn({ valeur: 'abc' }), null, 'TRY_CAST should return null on invalid cast');
});

test('DSLParser: Fonctions mathématiques ADD/SUB/MUL/DIV/MOD/NEGATE/ABS', () => {
  const addFn = parser.compile('add({{a}}, {{b}}, 5)');
  assertEqual(addFn({ a: 3, b: 2 }), 10);

  const subFn = parser.compile('sub({{a}}, {{b}}, 2)');
  assertEqual(subFn({ a: 10, b: 3 }), 5);

  const mulFn = parser.compile('mul({{a}}, {{b}})');
  assertEqual(mulFn({ a: 4, b: 5 }), 20);

  const divFn = parser.compile('div({{a}}, {{b}})');
  assertEqual(divFn({ a: 10, b: 2 }), 5);
  assertEqual(divFn({ a: 10, b: 0 }), null, 'div should return null when denominator is zero');

  const modFn = parser.compile('mod({{a}}, {{b}})');
  assertEqual(modFn({ a: 10, b: 3 }), 1);

  const negateFn = parser.compile('negate({{a}})');
  assertEqual(negateFn({ a: 5 }), -5);

  const absFn = parser.compile('abs({{a}})');
  assertEqual(absFn({ a: -7 }), 7);

  const ceilFn = parser.compile('ceil({{a}})');
  assertEqual(ceilFn({ a: 3.2 }), 4);

  const floorFn = parser.compile('floor({{a}})');
  assertEqual(floorFn({ a: 3.8 }), 3);
});

test('DSLParser: Fonctions IS_NULL et NOW', () => {
  const isNullFn = parser.compile('is_null({{valeur}})');
  assert(isNullFn({ valeur: null }) === true, 'is_null should detect null');
  assert(isNullFn({ valeur: 0 }) === false, 'is_null should be false for zero');

  const nowFn = parser.compile('now()');
  const nowResult = nowFn({});
  assert(typeof nowResult === 'string' && nowResult.includes('T'), 'now() should return ISO datetime string');
});

test('DSLParser: Alias de comparaison (eq, ne, lt, lte, gt, gte)', () => {
  const eqFn = parser.compile('eq({{a}}, {{b}})');
  assert(eqFn({ a: 5, b: 5 }) === true);
  assert(eqFn({ a: 5, b: 3 }) === false);

  const neFn = parser.compile('ne({{a}}, {{b}})');
  assert(neFn({ a: 5, b: 3 }) === true);
  assert(neFn({ a: 5, b: 5 }) === false);

  const ltFn = parser.compile('lt({{a}}, {{b}})');
  assert(ltFn({ a: 3, b: 5 }) === true);
  assert(ltFn({ a: 5, b: 3 }) === false);

  const lteFn = parser.compile('lte({{a}}, {{b}})');
  assert(lteFn({ a: 3, b: 5 }) === true);
  assert(lteFn({ a: 5, b: 5 }) === true);

  const gtFn = parser.compile('gt({{a}}, {{b}})');
  assert(gtFn({ a: 5, b: 3 }) === true);

  const gteFn = parser.compile('gte({{a}}, {{b}})');
  assert(gteFn({ a: 5, b: 3 }) === true);
  assert(gteFn({ a: 5, b: 5 }) === true);
});

test('DSLParser: Fonctions chaînes avancées (substr, trim, concat_ws)', () => {
  const substrFn = parser.compile('substr({{texte}}, 0, 5)');
  assertEqual(substrFn({ texte: 'Bonjour le monde' }), 'Bonjo');

  const substrNoLengthFn = parser.compile('substr({{texte}}, 8)');
  assertEqual(substrNoLengthFn({ texte: 'Bonjour le monde' }), 'le monde');

  const substringFn = parser.compile('substring({{texte}}, 0, 3)');
  assertEqual(substringFn({ texte: 'Hello' }), 'Hel');

  const trimFn = parser.compile('trim({{texte}})');
  assertEqual(trimFn({ texte: '  test  ' }), 'test');

  const ltrimFn = parser.compile('ltrim({{texte}})');
  assertEqual(ltrimFn({ texte: '  test  ' }), 'test  ');

  const rtrimFn = parser.compile('rtrim({{texte}})');
  assertEqual(rtrimFn({ texte: '  test  ' }), '  test');

  const concatWsFn = parser.compile('concat_ws(", ", {{prenom}}, {{nom}}, {{ville}})');
  assertEqual(concatWsFn({ prenom: 'Jean', nom: 'Dupont', ville: 'Paris' }), 'Jean, Dupont, Paris');
});

test('DSLParser: Fonctions mathématiques avancées (power, sqrt, sign, greatest, least)', () => {
  const powerFn = parser.compile('power({{base}}, {{exp}})');
  assertEqual(powerFn({ base: 2, exp: 3 }), 8);
  assertEqual(powerFn({ base: 10, exp: 2 }), 100);

  const sqrtFn = parser.compile('sqrt({{valeur}})');
  assertEqual(sqrtFn({ valeur: 16 }), 4);
  assertEqual(sqrtFn({ valeur: 25 }), 5);
  assertEqual(sqrtFn({ valeur: -1 }), null, 'sqrt should return null for negative numbers');

  const signFn = parser.compile('sign({{valeur}})');
  assertEqual(signFn({ valeur: 10 }), 1);
  assertEqual(signFn({ valeur: -5 }), -1);
  assertEqual(signFn({ valeur: 0 }), 0);

  const greatestFn = parser.compile('greatest({{a}}, {{b}}, {{c}})');
  assertEqual(greatestFn({ a: 5, b: 10, c: 3 }), 10);

  const leastFn = parser.compile('least({{a}}, {{b}}, {{c}})');
  assertEqual(leastFn({ a: 5, b: 10, c: 3 }), 3);
});

// ==========================================
// Tests avancés DSLEvaluator
// ==========================================
console.log('\n📝 Tests Avancés DSLEvaluator');
console.log('-'.repeat(60));

test('DSLEvaluator: Formules avec mêmes dépendances', () => {
  const f1 = '{{a}} + {{b}}';
  const f2 = '{{a}} * {{b}}';
  const data = { a: 5, b: 3 };
  
  assertEqual(evaluator.evaluate(f1, data), 8);
  assertEqual(evaluator.evaluate(f2, data), 15);
  
  const deps1 = evaluator.extractDependencies(f1);
  const deps2 = evaluator.extractDependencies(f2);
  assertDeepEqual(deps1, deps2);
});

test('DSLEvaluator: Cache invalidation', () => {
  evaluator.clearCache();
  const formula = '{{x}} * 2';
  
  assertEqual(evaluator.evaluate(formula, { x: 5 }), 10);
  assertEqual(evaluator.getCacheSize(), 1);
  
  evaluator.clearCache();
  assertEqual(evaluator.getCacheSize(), 0);
});

test('DSLEvaluator: Formule complexe avec toutes les fonctions', () => {
  const formula = 'ROUND(COALESCE({{montant}}, 0) * IF({{premium}} = "oui", 1.5, 1), 2)';
  assertEqual(evaluator.evaluate(formula, { montant: 100, premium: 'oui' }), 150);
  assertEqual(evaluator.evaluate(formula, { montant: null, premium: 'non' }), 0);
});

test('DSLEvaluator: isLocalFormula avec formule locale complexe', () => {
  assert(evaluator.isLocalFormula('ROUND({{a}} + {{b}}, 2)'));
  assert(evaluator.isLocalFormula('IF({{x}} > 0, {{y}}, {{z}})'));
  assert(evaluator.isLocalFormula('CONCAT({{prenom}}, " ", {{nom}})'));
});

test('DSLEvaluator: isLocalFormula avec formule relationnelle', () => {
  assert(!evaluator.isLocalFormula('SUM({{Items.prix}})'));
  assert(!evaluator.isLocalFormula('LOOKUP({{Client.nom}})'));
  assert(!evaluator.isLocalFormula('{{Factures.montant_total}}'));
});

// ==========================================
// Tests avancés DependencyGraph
// ==========================================
console.log('\n📝 Tests Avancés DependencyGraph');
console.log('-'.repeat(60));

test('DependencyGraph: Graphe avec 5 niveaux de dépendances', () => {
  const formulas = {
    a: { formula: '10', dependencies: [] },
    b: { formula: '{{a}} * 2', dependencies: ['a'] },
    c: { formula: '{{b}} + 5', dependencies: ['b'] },
    d: { formula: '{{c}} - 3', dependencies: ['c'] },
    e: { formula: '{{d}} / 2', dependencies: ['d'] }
  };
  
  const { order, levels } = depGraph.analyze(formulas);
  
  assertEqual(levels.a, 0);
  assertEqual(levels.b, 1);
  assertEqual(levels.c, 2);
  assertEqual(levels.d, 3);
  assertEqual(levels.e, 4);
  assertDeepEqual(order, ['a', 'b', 'c', 'd', 'e']);
});

test('DependencyGraph: Graphe avec dépendances multiples', () => {
  const formulas = {
    total: { formula: '{{a}} + {{b}} + {{c}}', dependencies: ['a', 'b', 'c'] },
    moyenne: { formula: '{{total}} / 3', dependencies: ['total'] }
  };
  
  const graph = depGraph.buildGraph(formulas);
  
  assertDeepEqual(graph.total.dependents, ['moyenne']);
  assertEqual(graph.total.dependencies.length, 3);
});

test('DependencyGraph: Cycle à 3 nœuds', () => {
  const graph = {
    a: { dependencies: ['c'], dependents: ['b'] },
    b: { dependencies: ['a'], dependents: ['c'] },
    c: { dependencies: ['b'], dependents: ['a'] }
  };
  
  const { cycles } = depGraph.topologicalSort(graph);
  assert(cycles.length > 0, 'Should detect 3-node cycle');
});

test('DependencyGraph: Graphe sans dépendances', () => {
  const formulas = {
    a: { formula: '10', dependencies: [] },
    b: { formula: '20', dependencies: [] },
    c: { formula: '30', dependencies: [] }
  };
  
  const { order, cycles } = depGraph.analyze(formulas);
  
  assertEqual(cycles.length, 0);
  assertEqual(order.length, 3);
});

test('DependencyGraph: Graphe diamant (A->B,C ; B,C->D)', () => {
  const formulas = {
    a: { formula: '10', dependencies: [] },
    b: { formula: '{{a}} * 2', dependencies: ['a'] },
    c: { formula: '{{a}} + 5', dependencies: ['a'] },
    d: { formula: '{{b}} + {{c}}', dependencies: ['b', 'c'] }
  };
  
  const { order } = depGraph.analyze(formulas);
  
  const indexA = order.indexOf('a');
  const indexB = order.indexOf('b');
  const indexC = order.indexOf('c');
  const indexD = order.indexOf('d');
  
  assert(indexA < indexB && indexA < indexC, 'a should be before b and c');
  assert(indexB < indexD && indexC < indexD, 'b and c should be before d');
});

test('DependencyGraph: Optimisation sans changement', () => {
  const graph = {
    a: { dependencies: [], dependents: ['b'] },
    b: { dependencies: ['a'], dependents: [] }
  };
  
  const order = ['a', 'b'];
  const optimized = depGraph.optimizeCalculationOrder(graph, order, []);
  
  assertEqual(optimized.length, 0, 'No fields should be recalculated');
});

test('DependencyGraph: Visualisation du graphe', () => {
  const graph = {
    total: { 
      formula: '{{prix}} * {{qte}}',
      dependencies: ['prix', 'qte'],
      dependents: ['ttc']
    },
    ttc: {
      formula: '{{total}} * 1.2',
      dependencies: ['total'],
      dependents: []
    }
  };
  
  const viz = depGraph.visualize(graph);
  assert(viz.includes('total'), 'Should contain field name');
  assert(viz.includes('depends on'), 'Should show dependencies');
  assert(viz.includes('triggers'), 'Should show dependents');
});

test('DependencyGraph: Affected fields en cascade', () => {
  const graph = {
    a: { dependencies: [], dependents: ['b', 'c'] },
    b: { dependencies: ['a'], dependents: ['d'] },
    c: { dependencies: ['a'], dependents: ['d'] },
    d: { dependencies: ['b', 'c'], dependents: ['e'] },
    e: { dependencies: ['d'], dependents: [] }
  };
  
  const affected = depGraph.getAffectedFields(graph, ['a']);
  
  assert(affected.includes('b'), 'Should affect b');
  assert(affected.includes('c'), 'Should affect c');
  assert(affected.includes('d'), 'Should affect d');
  assert(affected.includes('e'), 'Should affect e');
  assertEqual(affected.length, 4);
});

// ==========================================
// Tests d'intégration avancés
// ==========================================
console.log('\n📝 Tests d\'Intégration Avancés');
console.log('-'.repeat(60));

test('Intégration: Calcul de remise progressive', () => {
  const formulas = {
    remise_pct: {
      formula: 'IF({{montant_ht}} > 1000, 15, IF({{montant_ht}} > 500, 10, IF({{montant_ht}} > 100, 5, 0)))',
      dependencies: ['montant_ht']
    },
    montant_remise: {
      formula: '{{montant_ht}} * {{remise_pct}} / 100',
      dependencies: ['montant_ht', 'remise_pct']
    },
    montant_net: {
      formula: '{{montant_ht}} - {{montant_remise}}',
      dependencies: ['montant_ht', 'montant_remise']
    }
  };
  
  const { order } = depGraph.analyze(formulas);
  
  const data = { montant_ht: 1500 };
  
  // Calculer dans l'ordre
  for (const field of order) {
    data[field] = evaluator.evaluate(formulas[field].formula, data);
  }
  
  assertEqual(data.remise_pct, 15);
  assertEqual(data.montant_remise, 225);
  assertEqual(data.montant_net, 1275);
});

test('Intégration: Calcul d\'âge et catégorie', () => {
  const formulas = {
    age: {
      formula: '2025 - {{annee_naissance}}',
      dependencies: ['annee_naissance']
    },
    categorie: {
      formula: 'IF({{age}} < 18, "Mineur", IF({{age}} < 65, "Adulte", "Senior"))',
      dependencies: ['age']
    },
    tarif: {
      formula: 'IF({{categorie}} = "Mineur", 10, IF({{categorie}} = "Senior", 12, 15))',
      dependencies: ['categorie']
    }
  };
  
  const { order } = depGraph.analyze(formulas);
  const data = { annee_naissance: 1960 };
  
  for (const field of order) {
    data[field] = evaluator.evaluate(formulas[field].formula, data);
  }
  
  assertEqual(data.age, 65);
  assertEqual(data.categorie, 'Senior');
  assertEqual(data.tarif, 12);
});

test('Intégration: Calcul de TVA multiple taux', () => {
  const formulas = {
    taux_applicable: {
      formula: 'IF({{type}} = "alimentaire", 5.5, IF({{type}} = "normal", 20, 10))',
      dependencies: ['type']
    },
    montant_tva: {
      formula: 'ROUND({{prix_ht}} * {{taux_applicable}} / 100, 2)',
      dependencies: ['prix_ht', 'taux_applicable']
    },
    prix_ttc: {
      formula: 'ROUND({{prix_ht}} + {{montant_tva}}, 2)',
      dependencies: ['prix_ht', 'montant_tva']
    }
  };
  
  const { order } = depGraph.analyze(formulas);
  const data = { prix_ht: 100, type: 'alimentaire' };
  
  for (const field of order) {
    data[field] = evaluator.evaluate(formulas[field].formula, data);
  }
  
  assertEqual(data.taux_applicable, 5.5);
  assertEqual(data.montant_tva, 5.5);
  assertEqual(data.prix_ttc, 105.5);
});

// ==========================================
// Tests d'intégration
// ==========================================
console.log('\n📝 Tests d\'Intégration');
console.log('-'.repeat(60));

test('Intégration: Scénario facture complète', () => {
  // Configuration des formules
  const formulas = {
    total_ht: {
      formula: '{{quantite}} * {{prix_unitaire}}',
      dependencies: ['quantite', 'prix_unitaire']
    },
    montant_tva: {
      formula: '{{total_ht}} * {{taux_tva}} / 100',
      dependencies: ['total_ht', 'taux_tva']
    },
    total_ttc: {
      formula: '{{total_ht}} + {{montant_tva}}',
      dependencies: ['total_ht', 'montant_tva']
    }
  };
  
  // Analyser les dépendances
  const analysis = depGraph.analyze(formulas);
  assertEqual(analysis.cycles.length, 0, 'Should have no cycles');
  
  // Données initiales
  const data = {
    quantite: 10,
    prix_unitaire: 50,
    taux_tva: 20
  };
  
  // Calculer dans l'ordre
  const results = {};
  for (const fieldName of analysis.order) {
    const context = { ...data, ...results };
    results[fieldName] = evaluator.evaluate(formulas[fieldName].formula, context);
  }
  
  // Vérifications
  assertEqual(results.total_ht, 500, 'total_ht should be 500');
  assertEqual(results.montant_tva, 100, 'montant_tva should be 100');
  assertEqual(results.total_ttc, 600, 'total_ttc should be 600');
});

test('Intégration: Scénario avec conditions', () => {
  const formulas = {
    remise: {
      formula: 'IF({{montant}} > 1000, {{montant}} * 0.1, 0)',
      dependencies: ['montant']
    },
    total_final: {
      formula: '{{montant}} - {{remise}}',
      dependencies: ['montant', 'remise']
    }
  };
  
  const analysis = depGraph.analyze(formulas);
  
  // Cas 1: montant > 1000
  const data1 = { montant: 1500 };
  const results1 = {};
  for (const fieldName of analysis.order) {
    const context = { ...data1, ...results1 };
    results1[fieldName] = evaluator.evaluate(formulas[fieldName].formula, context);
  }
  
  assertEqual(results1.remise, 150, 'remise should be 150');
  assertEqual(results1.total_final, 1350, 'total_final should be 1350');
  
  // Cas 2: montant <= 1000
  const data2 = { montant: 800 };
  const results2 = {};
  for (const fieldName of analysis.order) {
    const context = { ...data2, ...results2 };
    results2[fieldName] = evaluator.evaluate(formulas[fieldName].formula, context);
  }
  
  assertEqual(results2.remise, 0, 'remise should be 0');
  assertEqual(results2.total_final, 800, 'total_final should be 800');
});

// ==========================================
// Résultats
// ==========================================
console.log('\n' + '='.repeat(60));
console.log(`\n📊 Résultats: ${testsPassed}/${testsRun} tests passés`);

if (testsFailed > 0) {
  console.log(`❌ ${testsFailed} test(s) échoué(s)\n`);
  process.exit(1);
} else {
  console.log('✅ Tous les tests passent !\n');
  process.exit(0);
}
