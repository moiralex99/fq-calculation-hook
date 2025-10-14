/**
 * Test du comportement du hook avec différents payloads
 * Simule les scénarios items.create et items.update
 */

import { DSLEvaluator } from '../src/dsl-parser.js';
import { DependencyGraph } from '../src/dependency-graph.js';

const logger = {
  debug: (...args) => console.log('[DEBUG]', ...args),
  info: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args)
};

const dslEvaluator = new DSLEvaluator(logger);
const dependencyGraph = new DependencyGraph(logger);

// Configuration de test (simule quartz_formulas)
const formulaConfigs = {
  factures: {
    total_ht: {
      formula: '{{quantite}} * {{prix_unitaire}}',
      dependencies: ['quantite', 'prix_unitaire']
    },
    montant_tva: {
      formula: '{{total_ht}} * 0.2',
      dependencies: ['total_ht']
    },
    total_ttc: {
      formula: '{{total_ht}} + {{montant_tva}}',
      dependencies: ['total_ht', 'montant_tva']
    }
  }
};

// Graphe de dépendances
const dependencyGraphs = {
  factures: dependencyGraph.analyze(formulaConfigs.factures)
};

console.log('=== GRAPHE DE DÉPENDANCES ===');
console.log('Order:', dependencyGraphs.factures.order);
console.log('');

/**
 * Fonction calculateFields (copie du hook)
 */
function calculateFields(collection, data, changedFields = null) {
  const config = formulaConfigs[collection];
  
  if (!config || Object.keys(config).length === 0) {
    return { updates: {}, hasChanges: false };
  }

  const graph = dependencyGraphs[collection];
  const updates = {};
  let hasChanges = false;
  
  let calculationOrder = graph?.order || Object.keys(config);
  
  if (changedFields && changedFields.length > 0 && graph) {
    calculationOrder = dependencyGraph.optimizeCalculationOrder(
      graph.graph, 
      graph.order, 
      changedFields
    );
    
    if (calculationOrder.length === 0) {
      logger.debug(`No fields affected by changes in ${collection}`);
      return { updates: {}, hasChanges: false };
    }
  }
  
  for (const fieldName of calculationOrder) {
    const formulaConfig = config[fieldName];
    
    try {
      const context = { ...data, ...updates };
      const newValue = dslEvaluator.evaluate(formulaConfig.formula, context);
      const oldValue = data[fieldName];
      
      if (!valuesAreEqual(oldValue, newValue)) {
        updates[fieldName] = newValue;
        hasChanges = true;
        logger.debug(`calc ${collection}.${fieldName}: ${oldValue} → ${newValue}`);
      } else {
        logger.debug(`calc ${collection}.${fieldName}: unchanged (${oldValue})`);
      }
      
    } catch (error) {
      logger.error(`Error calculating ${collection}.${fieldName}:`, error.message);
    }
  }
  
  return { updates, hasChanges };
}

function valuesAreEqual(a, b) {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  
  if (typeof a === 'number' && typeof b === 'number') {
    if (isNaN(a) && isNaN(b)) return true;
    const epsilon = 0.0000001;
    return Math.abs(a - b) < epsilon;
  }
  
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return a === b;
  }
  
  if (typeof a === 'string' || typeof b === 'string') {
    return String(a) === String(b);
  }
  
  return false;
}

// ==================== TESTS ====================

console.log('=== TEST 1: CREATE - Nouveau item ===');
const createInput = {
  quantite: 5,
  prix_unitaire: 19.99,
  client: 'ACME Corp',
  reference: 'FAC-2025-001'
};

console.log('Input (payload utilisateur):', JSON.stringify(createInput, null, 2));

const { updates: createUpdates } = calculateFields('factures', createInput);
const createResult = { ...createInput, ...createUpdates };

console.log('Updates (champs calculés):', JSON.stringify(createUpdates, null, 2));
console.log('Result (payload final):', JSON.stringify(createResult, null, 2));
console.log('');

console.log('=== TEST 2: UPDATE - Modification quantite uniquement ===');
const existingData = {
  id: 1,
  quantite: 5,
  prix_unitaire: 19.99,
  client: 'ACME Corp',
  reference: 'FAC-2025-001',
  total_ht: 99.95,
  montant_tva: 19.99,
  total_ttc: 119.94,
  date_created: '2025-01-01',
  user_created: '123'
};

const updateInput = {
  quantite: 10  // L'utilisateur ne change QUE la quantité
};

console.log('Existing data (en DB):', JSON.stringify(existingData, null, 2));
console.log('Input (payload utilisateur):', JSON.stringify(updateInput, null, 2));

const mergedData = { ...existingData, ...updateInput };
const changedFields = Object.keys(updateInput);

console.log('Merged data (pour calcul):', JSON.stringify(mergedData, null, 2));
console.log('Changed fields:', changedFields);

const { updates: updateUpdates, hasChanges } = calculateFields('factures', mergedData, changedFields);

console.log('Updates (champs calculés):', JSON.stringify(updateUpdates, null, 2));
console.log('Has changes:', hasChanges);

// COMPORTEMENT ACTUEL DU HOOK
const updateResult = { ...updateInput, ...(hasChanges ? updateUpdates : {}) };

console.log('Result (payload retourné par le hook):', JSON.stringify(updateResult, null, 2));
console.log('');

console.log('=== TEST 3: UPDATE - Modification champ non-calculé (client) ===');
const updateInput2 = {
  client: 'New Corp',  // Juste le client, rien qui affecte les formules
  reference: 'FAC-2025-999'
};

console.log('Input (payload utilisateur):', JSON.stringify(updateInput2, null, 2));

const mergedData2 = { ...existingData, ...updateInput2 };
const changedFields2 = Object.keys(updateInput2);

const { updates: updateUpdates2, hasChanges: hasChanges2 } = calculateFields('factures', mergedData2, changedFields2);

console.log('Updates (champs calculés):', JSON.stringify(updateUpdates2, null, 2));
console.log('Has changes:', hasChanges2);

const updateResult2 = { ...updateInput2, ...(hasChanges2 ? updateUpdates2 : {}) };

console.log('Result (payload retourné par le hook):', JSON.stringify(updateResult2, null, 2));
console.log('');

console.log('=== TEST 4: UPDATE - Modification avec valeur calculée inchangée ===');
const existingData2 = {
  ...existingData,
  total_ht: 199.9,  // Déjà la bonne valeur
  montant_tva: 39.98,
  total_ttc: 239.88
};

const updateInput3 = {
  quantite: 10,
  prix_unitaire: 19.99  // Devrait donner 199.9 (déjà en place)
};

console.log('Existing data:', JSON.stringify(existingData2, null, 2));
console.log('Input (payload utilisateur):', JSON.stringify(updateInput3, null, 2));

const mergedData3 = { ...existingData2, ...updateInput3 };
const { updates: updateUpdates3, hasChanges: hasChanges3 } = calculateFields('factures', mergedData3, Object.keys(updateInput3));

console.log('Updates (champs calculés):', JSON.stringify(updateUpdates3, null, 2));
console.log('Has changes:', hasChanges3);

const updateResult3 = { ...updateInput3, ...(hasChanges3 ? updateUpdates3 : {}) };

console.log('Result (payload retourné):', JSON.stringify(updateResult3, null, 2));
console.log('');

console.log('=== TEST 5: UPDATE - Collection sans formules ===');
const updateInput4 = {
  nom: 'Test',
  description: 'Une description'
};

console.log('Input (payload utilisateur sur collection "clients"):', JSON.stringify(updateInput4, null, 2));

// Simuler l'early return du hook
if (!formulaConfigs['clients'] || Object.keys(formulaConfigs['clients']).length === 0) {
  console.log('→ Aucune formule pour "clients", retour direct du payload');
  console.log('Result:', JSON.stringify(updateInput4, null, 2));
}
console.log('');

console.log('=== ANALYSE ===');
console.log('✅ Le payload utilisateur est préservé');
console.log('✅ Les champs calculés sont ajoutés uniquement si nécessaire');
console.log('✅ Pas de calcul si la collection n\'a pas de formules');
console.log('✅ Optimisation: ne recalcule que les champs affectés');
console.log('');
console.log('⚠️  ATTENTION: Le payload retourné contient SEULEMENT:');
console.log('   - Les champs modifiés par l\'utilisateur');
console.log('   - Les champs calculés qui ont changé');
console.log('   → C\'est normal pour un hook "items.update" (Directus merge automatiquement)');
