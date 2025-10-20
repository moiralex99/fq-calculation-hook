#!/usr/bin/env node
import fs from 'fs';

const data = JSON.parse(fs.readFileSync('auto_creations/automations-test-examples.json', 'utf8'));

const fixed = data.map(auto => {
  const newAuto = { ...auto };
  
  // Renommer les champs
  if (newAuto.nom) {
    newAuto.name = newAuto.nom;
    delete newAuto.nom;
  }
  
  if (newAuto.actif !== undefined) {
    newAuto.status = newAuto.actif ? 'active' : 'inactive';
    delete newAuto.actif;
  }
  
  if (newAuto.collection_source) {
    newAuto.collection_cible = newAuto.collection_source;
    delete newAuto.collection_source;
  }
  
  return newAuto;
});

fs.writeFileSync('auto_creations/automations-test-examples.json', JSON.stringify(fixed, null, 2));
console.log('✅ Fichier corrigé !');
