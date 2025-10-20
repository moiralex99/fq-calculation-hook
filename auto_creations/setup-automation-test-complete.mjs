#!/usr/bin/env node

/**
 * 🧪 Template de Test pour Automations FlowQuartz
 * 
 * 5 Collections hiérarchiques :
 * - 1_projets (racine)
 * - 1_phases (enfant de projets)
 * - 1_taches (enfant de phases)
 * - 1_actions (enfant de tâches)
 * - 1_departements (référence pour users)
 * 
 * Champs variés pour tester :
 * - Booleans (urgent, completed, archived, actif)
 * - Dates (date_debut, date_fin, deadline, date_livraison)
 * - Enums (statut, priorite, type_projet, type_tache)
 * - Decimals (budget, cout, progression)
 * - Relations (M2O)
 * 
 * Données de test incluses !
 * 
 * Usage:
 *   $env:DIRECTUS_URL="http://127.0.0.1:8055"
 *   $env:DIRECTUS_TOKEN="your-token"
 *   node setup-automation-test-complete.mjs
 */

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://127.0.0.1:8055';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || 'OHJ4HEV2RG-WwmdNpC2h3PKa1ujLZO5C';
const VERBOSE = process.env.VERBOSE === 'true';
const TIMEOUT_MS = 15000;

async function api(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `${DIRECTUS_URL}${path}`;
    if (VERBOSE) console.log(`→ ${options.method || 'GET'} ${url}`);

    const res = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${DIRECTUS_TOKEN}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    if (res.status === 204 || res.headers.get('content-length') === '0') return null;
    return await res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error(`Timeout: ${path}`);
    throw err;
  }
}

function normalizeBooleans(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(item => normalizeBooleans(item));
  if (typeof obj === 'object') {
    const normalized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'boolean') {
        normalized[key] = Boolean(value);
      } else if (typeof value === 'object') {
        normalized[key] = normalizeBooleans(value);
      } else {
        normalized[key] = value;
      }
    }
    return normalized;
  }
  return obj;
}

async function createCollectionWithFields(collectionName, fields, meta = {}) {
  console.log(`\n📦 Création: ${collectionName}`);
  
  try {
    await api('/collections', {
      method: 'POST',
      body: JSON.stringify({
        collection: collectionName,
        meta: { icon: 'box', ...meta },
        schema: { name: collectionName }
      })
    });
    
    for (const field of fields) {
      console.log(`  ↳ ${field.field} (${field.type})`);
      await api(`/fields/${collectionName}`, {
        method: 'POST',
        body: JSON.stringify(field)
      });
      await new Promise(r => setTimeout(r, 100));
    }
    
    console.log(`✅ ${collectionName} créée avec ${fields.length} champs`);
  } catch (error) {
    if (error.message?.includes('already exists')) {
      console.log(`⚠️  ${collectionName} existe déjà`);
    } else {
      throw error;
    }
  }
}

async function insertData(collection, items) {
  console.log(`\n📝 Insertion de ${items.length} items dans ${collection}`);
  try {
    const normalizedItems = normalizeBooleans(items);
    const result = await api(`/items/${collection}`, {
      method: 'POST',
      body: JSON.stringify(normalizedItems)
    });
    console.log(`✅ ${items.length} items insérés dans ${collection}`);
    return result.data;
  } catch (error) {
    console.error(`❌ Erreur insertion ${collection}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🧪 Template de Test - Automations FlowQuartz\n');
  console.log(`📍 URL: ${DIRECTUS_URL}\n`);
  
  try {
    // =============================================
    // 1. DÉPARTEMENTS (référence pour users)
    // =============================================
    await createCollectionWithFields('1_departements', [
      { field: 'nom', type: 'string', meta: { required: true, interface: 'input' }, schema: {} },
      { field: 'code', type: 'string', meta: { interface: 'input' }, schema: {} },
      { field: 'description', type: 'text', meta: { interface: 'input-multiline' }, schema: {} },
      { field: 'budget_annuel', type: 'decimal', meta: { interface: 'input' }, schema: { default_value: 0 } },
      { field: 'actif', type: 'boolean', meta: { interface: 'boolean' }, schema: { default_value: true, is_nullable: false } },
      { field: 'date_creation', type: 'date', meta: { interface: 'datetime' }, schema: {} }
    ], { icon: 'business', note: 'Départements de l\'organisation' });

    // =============================================
    // 2. PROJETS (niveau racine)
    // =============================================
    await createCollectionWithFields('1_projets', [
      { field: 'nom', type: 'string', meta: { required: true, interface: 'input' }, schema: {} },
      { field: 'description', type: 'text', meta: { interface: 'input-multiline' }, schema: {} },
      { field: 'code_projet', type: 'string', meta: { interface: 'input' }, schema: {} },
      
      // Enums
      { field: 'statut', type: 'string', meta: { 
        interface: 'select-dropdown',
        options: { choices: [
          { text: 'Planifié', value: 'planifie' },
          { text: 'En cours', value: 'en_cours' },
          { text: 'En pause', value: 'en_pause' },
          { text: 'Terminé', value: 'termine' },
          { text: 'Annulé', value: 'annule' }
        ]}
      }, schema: { default_value: 'planifie' } },
      
      { field: 'priorite', type: 'string', meta: { 
        interface: 'select-dropdown',
        options: { choices: [
          { text: 'Basse', value: 'basse' },
          { text: 'Moyenne', value: 'moyenne' },
          { text: 'Haute', value: 'haute' },
          { text: 'Critique', value: 'critique' }
        ]}
      }, schema: { default_value: 'moyenne' } },
      
      { field: 'type_projet', type: 'string', meta: { 
        interface: 'select-dropdown',
        options: { choices: [
          { text: 'Interne', value: 'interne' },
          { text: 'Client', value: 'client' },
          { text: 'R&D', value: 'rd' },
          { text: 'Maintenance', value: 'maintenance' }
        ]}
      }, schema: { default_value: 'interne' } },
      
      // Dates
      { field: 'date_debut', type: 'date', meta: { interface: 'datetime' }, schema: {} },
      { field: 'date_fin', type: 'date', meta: { interface: 'datetime' }, schema: {} },
      { field: 'deadline', type: 'date', meta: { interface: 'datetime' }, schema: {} },
      
      // Booleans
      { field: 'urgent', type: 'boolean', meta: { interface: 'boolean' }, schema: { default_value: false, is_nullable: false } },
      { field: 'archived', type: 'boolean', meta: { interface: 'boolean' }, schema: { default_value: false, is_nullable: false } },
      
      // Financier
      { field: 'budget_prevu', type: 'decimal', meta: { interface: 'input' }, schema: { default_value: 0 } },
      { field: 'budget_utilise', type: 'decimal', meta: { interface: 'input' }, schema: { default_value: 0 } },
      { field: 'progression', type: 'decimal', meta: { interface: 'input', readonly: true }, schema: { default_value: 0 } },
      
      // Relation
      { field: 'departement_id', type: 'integer', meta: { interface: 'select-dropdown-m2o', display: 'related-values' }, schema: {} }
    ], { icon: 'folder', note: 'Projets principaux' });

    // =============================================
    // 3. PHASES (enfant de projets)
    // =============================================
    await createCollectionWithFields('1_phases', [
      { field: 'nom', type: 'string', meta: { required: true, interface: 'input' }, schema: {} },
      { field: 'description', type: 'text', meta: { interface: 'input-multiline' }, schema: {} },
      { field: 'ordre', type: 'integer', meta: { interface: 'input' }, schema: { default_value: 1 } },
      
      // Relation parent
      { field: 'projet_id', type: 'integer', meta: { required: true, interface: 'select-dropdown-m2o' }, schema: {} },
      
      // Enum
      { field: 'statut', type: 'string', meta: { 
        interface: 'select-dropdown',
        options: { choices: [
          { text: 'Pas commencé', value: 'pas_commence' },
          { text: 'En cours', value: 'en_cours' },
          { text: 'Terminé', value: 'termine' },
          { text: 'Bloqué', value: 'bloque' }
        ]}
      }, schema: { default_value: 'pas_commence' } },
      
      // Dates
      { field: 'date_debut', type: 'date', meta: { interface: 'datetime' }, schema: {} },
      { field: 'date_fin', type: 'date', meta: { interface: 'datetime' }, schema: {} },
      
      // Booleans
      { field: 'completed', type: 'boolean', meta: { interface: 'boolean' }, schema: { default_value: false, is_nullable: false } },
      { field: 'bloquee', type: 'boolean', meta: { interface: 'boolean' }, schema: { default_value: false, is_nullable: false } },
      
      // Metrics
      { field: 'duree_estimee_jours', type: 'integer', meta: { interface: 'input' }, schema: { default_value: 0 } },
      { field: 'duree_reelle_jours', type: 'integer', meta: { interface: 'input' }, schema: { default_value: 0 } },
      { field: 'progression', type: 'decimal', meta: { interface: 'input', readonly: true }, schema: { default_value: 0 } }
    ], { icon: 'view_timeline', note: 'Phases des projets' });

    // =============================================
    // 4. TÂCHES (enfant de phases)
    // =============================================
    await createCollectionWithFields('1_taches', [
      { field: 'titre', type: 'string', meta: { required: true, interface: 'input' }, schema: {} },
      { field: 'description', type: 'text', meta: { interface: 'input-multiline' }, schema: {} },
      
      // Relations
      { field: 'phase_id', type: 'integer', meta: { required: true, interface: 'select-dropdown-m2o' }, schema: {} },
      { field: 'projet_id', type: 'integer', meta: { interface: 'select-dropdown-m2o', readonly: true }, schema: {} },
      
      // Enums
      { field: 'statut', type: 'string', meta: { 
        interface: 'select-dropdown',
        options: { choices: [
          { text: 'À faire', value: 'a_faire' },
          { text: 'En cours', value: 'en_cours' },
          { text: 'En révision', value: 'en_revision' },
          { text: 'Terminé', value: 'termine' },
          { text: 'Annulé', value: 'annule' }
        ]}
      }, schema: { default_value: 'a_faire' } },
      
      { field: 'priorite', type: 'string', meta: { 
        interface: 'select-dropdown',
        options: { choices: [
          { text: 'Basse', value: 'basse' },
          { text: 'Moyenne', value: 'moyenne' },
          { text: 'Haute', value: 'haute' },
          { text: 'Urgente', value: 'urgente' }
        ]}
      }, schema: { default_value: 'moyenne' } },
      
      { field: 'type_tache', type: 'string', meta: { 
        interface: 'select-dropdown',
        options: { choices: [
          { text: 'Développement', value: 'dev' },
          { text: 'Design', value: 'design' },
          { text: 'Test', value: 'test' },
          { text: 'Documentation', value: 'doc' },
          { text: 'Autre', value: 'autre' }
        ]}
      }, schema: { default_value: 'dev' } },
      
      // Dates
      { field: 'date_debut', type: 'date', meta: { interface: 'datetime' }, schema: {} },
      { field: 'date_fin', type: 'date', meta: { interface: 'datetime' }, schema: {} },
      { field: 'deadline', type: 'timestamp', meta: { interface: 'datetime' }, schema: {} },
      
      // Booleans
      { field: 'urgent', type: 'boolean', meta: { interface: 'boolean' }, schema: { default_value: false, is_nullable: false } },
      { field: 'completed', type: 'boolean', meta: { interface: 'boolean' }, schema: { default_value: false, is_nullable: false } },
      { field: 'en_retard', type: 'boolean', meta: { interface: 'boolean', readonly: true }, schema: { default_value: false, is_nullable: false } },
      
      // Metrics
      { field: 'estimation_heures', type: 'decimal', meta: { interface: 'input' }, schema: { default_value: 0 } },
      { field: 'temps_passe_heures', type: 'decimal', meta: { interface: 'input' }, schema: { default_value: 0 } },
      { field: 'cout_estime', type: 'decimal', meta: { interface: 'input' }, schema: { default_value: 0 } },
      { field: 'cout_reel', type: 'decimal', meta: { interface: 'input' }, schema: { default_value: 0 } }
    ], { icon: 'check_box', note: 'Tâches des phases' });

    // =============================================
    // 5. ACTIONS (enfant de tâches)
    // =============================================
    await createCollectionWithFields('1_actions', [
      { field: 'titre', type: 'string', meta: { required: true, interface: 'input' }, schema: {} },
      { field: 'description', type: 'text', meta: { interface: 'input-multiline' }, schema: {} },
      
      // Relations
      { field: 'tache_id', type: 'integer', meta: { required: true, interface: 'select-dropdown-m2o' }, schema: {} },
      { field: 'phase_id', type: 'integer', meta: { interface: 'select-dropdown-m2o', readonly: true }, schema: {} },
      
      // Enum
      { field: 'type_action', type: 'string', meta: { 
        interface: 'select-dropdown',
        options: { choices: [
          { text: 'Développement', value: 'dev' },
          { text: 'Review', value: 'review' },
          { text: 'Test', value: 'test' },
          { text: 'Deploy', value: 'deploy' },
          { text: 'Autre', value: 'autre' }
        ]}
      }, schema: { default_value: 'dev' } },
      
      { field: 'statut', type: 'string', meta: { 
        interface: 'select-dropdown',
        options: { choices: [
          { text: 'À faire', value: 'a_faire' },
          { text: 'En cours', value: 'en_cours' },
          { text: 'Fait', value: 'fait' }
        ]}
      }, schema: { default_value: 'a_faire' } },
      
      // Date
      { field: 'date_livraison', type: 'timestamp', meta: { interface: 'datetime' }, schema: {} },
      
      // Booleans
      { field: 'completed', type: 'boolean', meta: { interface: 'boolean' }, schema: { default_value: false, is_nullable: false } },
      { field: 'validated', type: 'boolean', meta: { interface: 'boolean' }, schema: { default_value: false, is_nullable: false } },
      
      // Metrics
      { field: 'duree_minutes', type: 'integer', meta: { interface: 'input' }, schema: { default_value: 0 } },
      { field: 'ordre', type: 'integer', meta: { interface: 'input' }, schema: { default_value: 1 } }
    ], { icon: 'task', note: 'Actions atomiques' });

    console.log('\n' + '='.repeat(60));
    console.log('✅ TOUTES LES COLLECTIONS CRÉÉES !');
    console.log('='.repeat(60));

    // =============================================
    // INSERTION DES DONNÉES DE TEST
    // =============================================
    console.log('\n📝 Insertion des données de test...\n');

    // Départements
    const departements = await insertData('1_departements', [
      { nom: 'IT & Développement', code: 'IT', budget_annuel: 500000, actif: true, date_creation: '2024-01-01' },
      { nom: 'Marketing', code: 'MKT', budget_annuel: 300000, actif: true, date_creation: '2024-01-01' },
      { nom: 'RH', code: 'RH', budget_annuel: 200000, actif: true, date_creation: '2024-01-01' },
      { nom: 'Finance', code: 'FIN', budget_annuel: 150000, actif: true, date_creation: '2024-01-01' }
    ]);

    // Projets
    const projets = await insertData('1_projets', [
      {
        nom: 'Refonte Site Web',
        code_projet: 'WEB-2025-001',
        description: 'Refonte complète du site corporate',
        statut: 'en_cours',
        priorite: 'haute',
        type_projet: 'client',
        date_debut: '2025-01-15',
        date_fin: '2025-06-30',
        deadline: '2025-07-15',
        urgent: true,
        archived: false,
        budget_prevu: 150000,
        budget_utilise: 45000,
        departement_id: departements?.[0]?.id
      },
      {
        nom: 'Migration Cloud',
        code_projet: 'CLOUD-2025-002',
        description: 'Migration infrastructure vers AWS',
        statut: 'planifie',
        priorite: 'critique',
        type_projet: 'interne',
        date_debut: '2025-03-01',
        date_fin: '2025-09-30',
        deadline: '2025-10-31',
        urgent: false,
        archived: false,
        budget_prevu: 250000,
        budget_utilise: 0,
        departement_id: departements?.[0]?.id
      },
      {
        nom: 'Campagne Marketing Q2',
        code_projet: 'MKT-2025-003',
        description: 'Campagne digitale Q2 2025',
        statut: 'en_cours',
        priorite: 'moyenne',
        type_projet: 'client',
        date_debut: '2025-04-01',
        date_fin: '2025-06-30',
        deadline: '2025-07-01',
        urgent: false,
        archived: false,
        budget_prevu: 80000,
        budget_utilise: 25000,
        departement_id: departements?.[1]?.id
      }
    ]);

    // Phases
    if (projets && projets.length > 0) {
      const phases = await insertData('1_phases', [
        // Projet 1 : Refonte Site
        {
          nom: 'Analyse & Conception',
          projet_id: projets[0].id,
          ordre: 1,
          statut: 'termine',
          date_debut: '2025-01-15',
          date_fin: '2025-02-15',
          completed: true,
          bloquee: false,
          duree_estimee_jours: 30,
          duree_reelle_jours: 28
        },
        {
          nom: 'Design UI/UX',
          projet_id: projets[0].id,
          ordre: 2,
          statut: 'en_cours',
          date_debut: '2025-02-16',
          date_fin: '2025-03-31',
          completed: false,
          bloquee: false,
          duree_estimee_jours: 45,
          duree_reelle_jours: 30
        },
        {
          nom: 'Développement',
          projet_id: projets[0].id,
          ordre: 3,
          statut: 'pas_commence',
          date_debut: '2025-04-01',
          date_fin: '2025-06-15',
          completed: false,
          bloquee: false,
          duree_estimee_jours: 75,
          duree_reelle_jours: 0
        },
        // Projet 2 : Migration Cloud
        {
          nom: 'Audit Infrastructure',
          projet_id: projets[1].id,
          ordre: 1,
          statut: 'pas_commence',
          date_debut: '2025-03-01',
          date_fin: '2025-04-01',
          completed: false,
          bloquee: false,
          duree_estimee_jours: 30,
          duree_reelle_jours: 0
        },
        {
          nom: 'Setup AWS',
          projet_id: projets[1].id,
          ordre: 2,
          statut: 'pas_commence',
          date_debut: '2025-04-01',
          date_fin: '2025-05-31',
          completed: false,
          bloquee: false,
          duree_estimee_jours: 60,
          duree_reelle_jours: 0
        }
      ]);

      // Tâches
      if (phases && phases.length > 0) {
        const taches = await insertData('1_taches', [
          // Phase 1 (Analyse)
          {
            titre: 'Collecte des besoins',
            phase_id: phases[0].id,
            projet_id: projets[0].id,
            statut: 'termine',
            priorite: 'haute',
            type_tache: 'doc',
            date_debut: '2025-01-15',
            date_fin: '2025-01-25',
            deadline: '2025-01-26T17:00:00Z',
            urgent: false,
            completed: true,
            en_retard: false,
            estimation_heures: 40,
            temps_passe_heures: 38,
            cout_estime: 3200,
            cout_reel: 3040
          },
          {
            titre: 'Rédaction specs techniques',
            phase_id: phases[0].id,
            projet_id: projets[0].id,
            statut: 'termine',
            priorite: 'haute',
            type_tache: 'doc',
            date_debut: '2025-01-26',
            date_fin: '2025-02-10',
            deadline: '2025-02-11T17:00:00Z',
            urgent: false,
            completed: true,
            en_retard: false,
            estimation_heures: 60,
            temps_passe_heures: 55,
            cout_estime: 4800,
            cout_reel: 4400
          },
          // Phase 2 (Design)
          {
            titre: 'Maquettes desktop',
            phase_id: phases[1].id,
            projet_id: projets[0].id,
            statut: 'en_cours',
            priorite: 'haute',
            type_tache: 'design',
            date_debut: '2025-02-16',
            date_fin: '2025-03-05',
            deadline: '2025-03-06T17:00:00Z',
            urgent: true,
            completed: false,
            en_retard: false,
            estimation_heures: 80,
            temps_passe_heures: 45,
            cout_estime: 6400,
            cout_reel: 3600
          },
          {
            titre: 'Maquettes mobile',
            phase_id: phases[1].id,
            projet_id: projets[0].id,
            statut: 'a_faire',
            priorite: 'moyenne',
            type_tache: 'design',
            date_debut: '2025-03-06',
            date_fin: '2025-03-20',
            deadline: '2025-03-21T17:00:00Z',
            urgent: false,
            completed: false,
            en_retard: false,
            estimation_heures: 60,
            temps_passe_heures: 0,
            cout_estime: 4800,
            cout_reel: 0
          },
          {
            titre: 'Prototypage interactif',
            phase_id: phases[1].id,
            projet_id: projets[0].id,
            statut: 'a_faire',
            priorite: 'basse',
            type_tache: 'design',
            date_debut: '2025-03-21',
            date_fin: '2025-03-31',
            deadline: '2025-04-01T17:00:00Z',
            urgent: false,
            completed: false,
            en_retard: false,
            estimation_heures: 40,
            temps_passe_heures: 0,
            cout_estime: 3200,
            cout_reel: 0
          }
        ]);

        // Actions
        if (taches && taches.length > 0) {
          await insertData('1_actions', [
            // Tâche 1
            {
              titre: 'Interview stakeholders',
              tache_id: taches[0].id,
              phase_id: phases[0].id,
              type_action: 'autre',
              statut: 'fait',
              date_livraison: '2025-01-20T14:00:00Z',
              completed: true,
              validated: true,
              duree_minutes: 180,
              ordre: 1
            },
            {
              titre: 'Synthèse besoins',
              tache_id: taches[0].id,
              phase_id: phases[0].id,
              type_action: 'autre',
              statut: 'fait',
              date_livraison: '2025-01-25T17:00:00Z',
              completed: true,
              validated: true,
              duree_minutes: 240,
              ordre: 2
            },
            // Tâche 3
            {
              titre: 'Wireframes page accueil',
              tache_id: taches[2].id,
              phase_id: phases[1].id,
              type_action: 'dev',
              statut: 'fait',
              date_livraison: '2025-02-20T17:00:00Z',
              completed: true,
              validated: true,
              duree_minutes: 300,
              ordre: 1
            },
            {
              titre: 'Mockup haute fidélité',
              tache_id: taches[2].id,
              phase_id: phases[1].id,
              type_action: 'dev',
              statut: 'en_cours',
              date_livraison: '2025-03-05T17:00:00Z',
              completed: false,
              validated: false,
              duree_minutes: 420,
              ordre: 2
            },
            {
              titre: 'Review client',
              tache_id: taches[2].id,
              phase_id: phases[1].id,
              type_action: 'review',
              statut: 'a_faire',
              date_livraison: '2025-03-06T10:00:00Z',
              completed: false,
              validated: false,
              duree_minutes: 0,
              ordre: 3
            }
          ]);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 SETUP COMPLET TERMINÉ !');
    console.log('='.repeat(60));
    console.log('\n📊 Résumé :');
    console.log('   ✅ 5 collections créées');
    console.log('   ✅ 4 départements');
    console.log('   ✅ 3 projets');
    console.log('   ✅ 5 phases');
    console.log('   ✅ 5 tâches');
    console.log('   ✅ 5 actions');
    console.log('\n🧪 Prêt pour tester les automations !');
    console.log('\n💡 Champs disponibles pour automations :');
    console.log('   - Booleans : urgent, completed, archived, actif, bloquee, en_retard, validated');
    console.log('   - Dates : date_debut, date_fin, deadline, date_livraison, date_creation');
    console.log('   - Enums : statut, priorite, type_projet, type_tache, type_action');
    console.log('   - Decimals : budget_*, cout_*, progression, estimation_heures, temps_passe_heures');
    console.log('   - Relations : departement_id, projet_id, phase_id, tache_id');

  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    if (VERBOSE) console.error(error.stack);
    process.exit(1);
  }
}

main().catch(console.error);
