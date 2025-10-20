#!/usr/bin/env node
import fs from 'fs';

// Charger le fichier console.log('✅ Fichier corrigé sauvegardé: automations-test-examples-FIXED.json');
console.log('\n📋 Corrections appliquées:');
console.log('   - condition → rule_jsonb (+ rule en description)');
console.log('   - actions → actions_jsonb (+ actions en description)');
console.log('   - champs → data');
console.log('   - filtres → filter');
console.log('   - collection_cible → collection (dans actions)');
console.log('   - trigger_event: "items.update" → ["update"]');
const automations = JSON.parse(fs.readFileSync('auto_creations/automations-test-examples.json', 'utf8'));

// Fonction pour corriger récursivement les actions
function fixAction(action) {
  const fixed = { ...action };
  
  // Renommer champs → data (pour update_current, update_item, update_many, create_item)
  if (fixed.champs) {
    fixed.data = fixed.champs;
    delete fixed.champs;
  }
  
  // Renommer filtres → filter
  if (fixed.filtres) {
    fixed.filter = fixed.filtres;
    delete fixed.filtres;
  }
  
  // Renommer collection_cible → collection dans les actions (pas au niveau root!)
  if (fixed.collection_cible && fixed.type) {
    fixed.collection = fixed.collection_cible;
    delete fixed.collection_cible;
  }
  
  // Gérer les actions imbriquées (for_each)
  if (fixed.actions && Array.isArray(fixed.actions)) {
    fixed.actions = fixed.actions.map(fixAction);
  }
  
  return fixed;
}

// Corriger toutes les automations
const fixed = automations.map(auto => {
  const newAuto = { ...auto };
  
  // condition → rule_jsonb (la vraie règle JSON)
  if (newAuto.condition) {
    newAuto.rule_jsonb = newAuto.condition;
    newAuto.rule = newAuto.description || 'Auto-generated rule'; // description textuelle
    delete newAuto.condition;
  }
  
  // Corriger trigger_event (doit être un array)
  if (newAuto.trigger_event && typeof newAuto.trigger_event === 'string') {
    // Extraire le type: items.update → ["update"]
    const match = newAuto.trigger_event.match(/items\.(create|update|delete)/);
    if (match) {
      newAuto.trigger_event = [match[1]];
    }
  }
  
  // Corriger toutes les actions et mettre dans actions_jsonb
  if (newAuto.actions && Array.isArray(newAuto.actions)) {
    newAuto.actions_jsonb = newAuto.actions.map(fixAction);
    newAuto.actions = `${newAuto.actions_jsonb.length} action(s)`; // description textuelle
  }
  
  return newAuto;
});

// Sauvegarder
fs.writeFileSync('auto_creations/automations-test-examples-FIXED.json', JSON.stringify(fixed, null, 2));
console.log('✅ Fichier corrigé sauvegardé: automations-test-examples-FIXED.json');
console.log('\n📋 Corrections appliquées:');
console.log('   - condition → rule');
console.log('   - champs → data');
console.log('   - filtres → filter');
console.log('   - collection_cible → collection (dans actions)');
console.log('   - trigger_event: "items.update" → ["update"]');
