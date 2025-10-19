import { createAutomationEngine } from '../src/lib/automation-engine.js';
import { createJsonLogicEvaluator } from '../src/lib/jsonlogic-evaluator.js';

// Mock data: un processus qui passe à inactif
const mockProcessus = {
  id: 'proc-123',
  name: 'Clôture mensuelle Q4',
  status: 'inactif',  // ← changé de 'actif' à 'inactif'
  description: 'Processus de clôture trimestrielle',
  domaine_lie: 'dom-456',
  code: 'CLOS-Q4',
  responsable: 'user-789',
  date_debut: '2025-01-01',
  date_fin: '2025-12-31',
  priorite: 'haute'
};

const oldProcessus = {
  ...mockProcessus,
  status: 'actif'  // ← ancien statut
};

// Mock executor to capture created item
let createdProcessus = null;
const executors = {
  async create_item({ collection, data, context }) {
    createdProcessus = { 
      id: `${collection}-new-${Date.now()}`, 
      ...data 
    };
    console.log(`\n[Mock] Created ${collection}:`, createdProcessus.id);
    console.log('  name:', createdProcessus.name);
    console.log('  status:', createdProcessus.status);
    console.log('  description:', createdProcessus.description);
    return createdProcessus;
  }
};

const evaluator = createJsonLogicEvaluator();
const engine = createAutomationEngine({ evaluator, logger: console, executors });

// Charger l'automation depuis le fichier exemple
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { normalizeAutomationRow } from '../src/lib/normalize.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const automationFile = join(__dirname, '../docs/example-archive-processus.json');
const automationRaw = JSON.parse(readFileSync(automationFile, 'utf-8'));

// Normalize l'automation comme le fait le loader
const automation = normalizeAutomationRow(automationRaw);

const automations = [automation];

async function run() {
  console.log('=== Test: Archive processus et créer version active ===\n');
  
  console.log('Scénario: Processus "Clôture mensuelle Q4" passe de "actif" à "inactif"');
  console.log('Résultat attendu: Création automatique d\'un nouveau processus "Active version of Clôture mensuelle Q4" avec status=actif\n');

  const updates = await engine.evaluate({
    collection: 'processus',
    automations,
    newData: mockProcessus,
    oldData: oldProcessus,
    context: { $USER: { id: 'user-admin' } }
  });

  console.log('\n=== Résultats ===');
  console.log('Updates sur le processus original:', updates);
  
  if (createdProcessus) {
    console.log('\n✅ Nouveau processus créé avec succès:');
    console.log('  ID:', createdProcessus.id);
    console.log('  Titre:', createdProcessus.name);
    console.log('  Status:', createdProcessus.status);
    console.log('  Description:', createdProcessus.description);
    console.log('  Domaine lié:', createdProcessus.domaine_lie);
    console.log('  Code:', createdProcessus.code);
    
    // Validations
    const hasCorrectPrefix = createdProcessus.name.startsWith('Active version of');
    const hasOriginalName = createdProcessus.name.includes(mockProcessus.name);
    const isActive = createdProcessus.status === 'actif';
    
    console.log('\n=== Validations ===');
    console.log('  ✓ Préfixe "Active version of":', hasCorrectPrefix ? '✅' : '❌');
    console.log('  ✓ Contient titre original:', hasOriginalName ? '✅' : '❌');
    console.log('  ✓ Status forcé à "actif":', isActive ? '✅' : '❌');
    console.log('  ✓ Domaine propagé:', createdProcessus.domaine_lie === mockProcessus.domaine_lie ? '✅' : '❌');
    
    if (hasCorrectPrefix && hasOriginalName && isActive) {
      console.log('\n🎉 Test PASSED — Automation fonctionne comme attendu !');
    } else {
      console.log('\n❌ Test FAILED — Vérifier la règle');
    }
  } else {
    console.log('\n❌ Aucun processus créé — Vérifier que la règle matche correctement');
  }
}

run().catch(console.error);
