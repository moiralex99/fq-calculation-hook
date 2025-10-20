#!/usr/bin/env node

/**
 * Script de création des collections de test via l'API Directus
 * Pour tester tous les scénarios d'automations
 * 
 * Usage:
 *   node setup-automation-collections-api.mjs
 */

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://127.0.0.1:8055';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || 'OHJ4HEV2RG-WwmdNpC2h3PKa1ujLZO5C';
const VERBOSE = process.env.VERBOSE === 'true';
const TIMEOUT_MS = 15000;

/**
 * Wrapper around fetch with timeout
 */
async function api(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `${DIRECTUS_URL}${path}`;
    if (VERBOSE) {
      console.log(`→ ${options.method || 'GET'} ${url}`);
    }

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

    if (res.status === 204 || res.headers.get('content-length') === '0') {
      return null;
    }

    return await res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Request timeout after ${TIMEOUT_MS}ms: ${path}`);
    }
    throw err;
  }
}

/**
 * Helper pour créer une collection avec ses champs
 */
async function createCollectionWithFields(collectionName, fields, meta = {}) {
  console.log(`\n📦 Création de la collection: ${collectionName}`);
  
  try {
    // Créer la collection
    await api('/collections', {
      method: 'POST',
      body: JSON.stringify({
        collection: collectionName,
        meta: {
          icon: 'box',
          ...meta
        },
        schema: {
          name: collectionName
        }
      })
    });
    
    // Créer les champs
    for (const field of fields) {
      console.log(`  ↳ Champ: ${field.field} (${field.type})`);
      await api(`/fields/${collectionName}`, {
        method: 'POST',
        body: JSON.stringify(field)
      });
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`✅ Collection ${collectionName} créée avec ${fields.length} champs`);
  } catch (error) {
    if (error.message?.includes('already exists') || error.message?.includes('DUPLICATE')) {
      console.log(`⚠️  Collection ${collectionName} existe déjà`);
    } else {
      console.error(`❌ Erreur pour ${collectionName}:`, error.message);
      throw error;
    }
  }
}

/**
 * Normalise les valeurs boolean pour compatibilité SQLite/PostgreSQL
 * SQLite stocke les booleans comme INTEGER (0/1)
 * PostgreSQL supporte le type BOOLEAN natif
 * Directus gère la conversion automatique si on lui donne des valeurs cohérentes
 */
function normalizeBoolean(value) {
  if (value === null || value === undefined) return null;
  // Convertir en boolean strict puis laisser Directus gérer
  return Boolean(value);
}

/**
 * Normalise récursivement tous les booleans dans un objet
 */
function normalizeBooleans(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => normalizeBooleans(item));
  }
  if (typeof obj === 'object') {
    const normalized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'boolean') {
        normalized[key] = normalizeBoolean(value);
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

/**
 * Helper pour insérer des données
 */
async function insertData(collection, items) {
  console.log(`\n📝 Insertion de ${items.length} items dans ${collection}`);
  try {
    // Normaliser les booleans avant l'insertion
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

/**
 * Script principal
 */
async function main() {
  console.log('🚀 Démarrage de la création des collections de test...\n');
  console.log(`📍 URL: ${DIRECTUS_URL}`);
  console.log(`🔑 Token: ${DIRECTUS_TOKEN.substring(0, 10)}...\n`);
  
  try {
    // ========================================
    // 1. PROJETS (collection principale)
    // ========================================
    await createCollectionWithFields('projets', [
      { field: 'nom', type: 'string', meta: { required: true, interface: 'input' }, schema: {} },
      { field: 'description', type: 'text', meta: { interface: 'input-multiline' }, schema: {} },
      { field: 'statut', type: 'string', meta: { interface: 'select-dropdown' }, schema: { default_value: 'planifie' }},
      { field: 'type', type: 'string', meta: { interface: 'input' }, schema: {} },
      { field: 'priorite', type: 'string', meta: { interface: 'input' }, schema: {} },
      { field: 'date_debut', type: 'date', meta: { interface: 'datetime' }, schema: {} },
      { field: 'date_fin', type: 'date', meta: { interface: 'datetime' }, schema: {} },
      { field: 'date_echeance', type: 'date', meta: { interface: 'datetime' }, schema: {} },
      { field: 'budget_total', type: 'decimal', meta: { interface: 'input' }, schema: {} },
      { field: 'budget_utilise', type: 'decimal', meta: { interface: 'input' }, schema: { default_value: 0 } },
      { field: 'nb_taches_total', type: 'integer', meta: { interface: 'input', readonly: true }, schema: { default_value: 0 } },
      { field: 'nb_taches_terminees', type: 'integer', meta: { interface: 'input', readonly: true }, schema: { default_value: 0 } },
      { field: 'pourcentage_completion', type: 'decimal', meta: { interface: 'input', readonly: true }, schema: { default_value: 0 } },
      { field: 'duree_estimee', type: 'integer', meta: { interface: 'input' }, schema: {} },
      { field: 'duree_reelle', type: 'integer', meta: { interface: 'input' }, schema: {} },
      { field: 'dupliquer', type: 'boolean', meta: { interface: 'boolean' }, schema: { default_value: false, is_nullable: false } },
      { field: 'action_export', type: 'boolean', meta: { interface: 'boolean' }, schema: { default_value: false, is_nullable: false } },
      { field: 'action_supprimer', type: 'boolean', meta: { interface: 'boolean' }, schema: { default_value: false, is_nullable: false } },
      { field: 'deleted', type: 'boolean', meta: { interface: 'boolean' }, schema: { default_value: false, is_nullable: false } },
      { field: 'deleted_at', type: 'timestamp', meta: { interface: 'datetime' }, schema: {} },
      { field: 'template_id', type: 'integer', meta: { interface: 'input' }, schema: {} },
      { field: 'copie_id', type: 'integer', meta: { interface: 'input' }, schema: {} }
    ], { note: 'Tests automations' });
    
    // ========================================
    // 2. TACHES
    // ========================================
    await createCollectionWithFields('taches', [
      { field: 'projet_id', type: 'integer', meta: { required: true, interface: 'input' }, schema: {} },
      { field: 'titre', type: 'string', meta: { required: true, interface: 'input' }, schema: {} },
      { field: 'description', type: 'text', meta: { interface: 'input-multiline' }, schema: {} },
      { field: 'statut', type: 'string', meta: { interface: 'input' }, schema: { default_value: 'a_faire' } },
      { field: 'priorite', type: 'string', meta: { interface: 'input' }, schema: {} },
      { field: 'date_debut', type: 'timestamp', meta: { interface: 'datetime' }, schema: {} },
      { field: 'date_fin', type: 'timestamp', meta: { interface: 'datetime' }, schema: {} },
      { field: 'date_echeance', type: 'timestamp', meta: { interface: 'datetime' }, schema: {} },
      { field: 'duree_estimee', type: 'integer', meta: { interface: 'input' }, schema: {} },
      { field: 'duree_reelle', type: 'integer', meta: { interface: 'input' }, schema: {} },
      { field: 'budget_estime', type: 'decimal', meta: { interface: 'input' }, schema: {} },
      { field: 'en_retard', type: 'boolean', meta: { interface: 'boolean', readonly: true }, schema: { default_value: false, is_nullable: false } },
      { field: 'jours_retard', type: 'integer', meta: { interface: 'input', readonly: true }, schema: { default_value: 0 } },
      { field: 'ordre', type: 'integer', meta: { interface: 'input' }, schema: {} },
      { field: 'deleted', type: 'boolean', meta: { interface: 'boolean' }, schema: { default_value: false, is_nullable: false } }
    ]);
    
    // ========================================
    // 3. COMMANDES
    // ========================================
    await createCollectionWithFields('commandes', [
      { field: 'numero', type: 'string', meta: { interface: 'input' }, schema: {} },
      { field: 'client_nom', type: 'string', meta: { interface: 'input' }, schema: {} },
      { field: 'client_email', type: 'string', meta: { interface: 'input' }, schema: {} },
      { field: 'statut', type: 'string', meta: { interface: 'input' }, schema: { default_value: 'brouillon' } },
      { field: 'total', type: 'decimal', meta: { interface: 'input', readonly: true }, schema: { default_value: 0 } },
      { field: 'nb_lignes', type: 'integer', meta: { interface: 'input', readonly: true }, schema: { default_value: 0 } }
    ]);
    
    await createCollectionWithFields('lignes_commande', [
      { field: 'commande_id', type: 'integer', meta: { required: true, interface: 'input' }, schema: {} },
      { field: 'designation', type: 'string', meta: { interface: 'input' }, schema: {} },
      { field: 'quantite', type: 'integer', meta: { interface: 'input' }, schema: { default_value: 1 } },
      { field: 'prix_unitaire', type: 'decimal', meta: { interface: 'input' }, schema: {} },
      { field: 'total_ligne', type: 'decimal', meta: { interface: 'input', readonly: true }, schema: {} }
    ]);
    
    // ========================================
    // 4. PRODUITS & TAGS
    // ========================================
    await createCollectionWithFields('produits', [
      { field: 'nom', type: 'string', meta: { required: true, interface: 'input' }, schema: {} },
      { field: 'description', type: 'text', meta: { interface: 'input-multiline' }, schema: {} },
      { field: 'prix', type: 'decimal', meta: { interface: 'input' }, schema: {} },
      { field: 'note_moyenne', type: 'decimal', meta: { interface: 'input', readonly: true }, schema: { default_value: 0 } },
      { field: 'nb_avis', type: 'integer', meta: { interface: 'input', readonly: true }, schema: { default_value: 0 } }
    ]);
    
    await createCollectionWithFields('tags', [
      { field: 'nom', type: 'string', meta: { required: true, interface: 'input' }, schema: {} },
      { field: 'couleur', type: 'string', meta: { interface: 'select-color' }, schema: {} },
      { field: 'nb_produits', type: 'integer', meta: { interface: 'input', readonly: true }, schema: { default_value: 0 } }
    ]);
    
    await createCollectionWithFields('produit_tags', [
      { field: 'produit_id', type: 'integer', meta: { required: true, interface: 'input' }, schema: {} },
      { field: 'tag_id', type: 'integer', meta: { required: true, interface: 'input' }, schema: {} }
    ]);
    
    await createCollectionWithFields('avis_produit', [
      { field: 'produit_id', type: 'integer', meta: { required: true, interface: 'input' }, schema: {} },
      { field: 'note', type: 'integer', meta: { interface: 'input' }, schema: {} },
      { field: 'commentaire', type: 'text', meta: { interface: 'input-multiline' }, schema: {} }
    ]);
    
    // ========================================
    // 5. CAMPAGNES CASCADE (5 niveaux)
    // ========================================
    await createCollectionWithFields('campagnes', [
      { field: 'nom', type: 'string', meta: { required: true, interface: 'input' }, schema: {} },
      { field: 'annee', type: 'integer', meta: { interface: 'input' }, schema: {} },
      { field: 'periode', type: 'string', meta: { interface: 'input' }, schema: {} },
      { field: 'dupliquer', type: 'boolean', meta: { interface: 'boolean' }, schema: { default_value: false, is_nullable: false } }
    ]);
    
    await createCollectionWithFields('calendriers', [
      { field: 'campagne_id', type: 'integer', meta: { required: true, interface: 'input' }, schema: {} },
      { field: 'nom', type: 'string', meta: { required: true, interface: 'input' }, schema: {} },
      { field: 'annee', type: 'integer', meta: { interface: 'input' }, schema: {} }
    ]);
    
    await createCollectionWithFields('domaines', [
      { field: 'calendrier_id', type: 'integer', meta: { required: true, interface: 'input' }, schema: {} },
      { field: 'nom', type: 'string', meta: { required: true, interface: 'input' }, schema: {} },
      { field: 'description', type: 'text', meta: { interface: 'input-multiline' }, schema: {} }
    ]);
    
    await createCollectionWithFields('processus_campagne', [
      { field: 'domaine_id', type: 'integer', meta: { required: true, interface: 'input' }, schema: {} },
      { field: 'nom', type: 'string', meta: { required: true, interface: 'input' }, schema: {} },
      { field: 'description', type: 'text', meta: { interface: 'input-multiline' }, schema: {} }
    ]);
    
    await createCollectionWithFields('taches_campagne', [
      { field: 'processus_id', type: 'integer', meta: { required: true, interface: 'input' }, schema: {} },
      { field: 'nom', type: 'string', meta: { required: true, interface: 'input' }, schema: {} },
      { field: 'delai', type: 'integer', meta: { interface: 'input' }, schema: {} }
    ]);
    
    // ========================================
    // 6. NOTIFICATIONS & ALERTES
    // ========================================
    await createCollectionWithFields('notifications', [
      { field: 'type', type: 'string', meta: { interface: 'input' }, schema: {} },
      { field: 'titre', type: 'string', meta: { interface: 'input' }, schema: {} },
      { field: 'message', type: 'text', meta: { interface: 'input-multiline' }, schema: {} },
      { field: 'lu', type: 'boolean', meta: { interface: 'boolean' }, schema: { default_value: false, is_nullable: false } }
    ]);
    
    await createCollectionWithFields('alertes', [
      { field: 'type', type: 'string', meta: { interface: 'input' }, schema: {} },
      { field: 'priorite', type: 'string', meta: { interface: 'input' }, schema: {} },
      { field: 'message', type: 'text', meta: { interface: 'input-multiline' }, schema: {} },
      { field: 'resolu', type: 'boolean', meta: { interface: 'boolean' }, schema: { default_value: false, is_nullable: false } }
    ]);
    
    // ========================================
    // 7. DOCUMENTS (workflow)
    // ========================================
    await createCollectionWithFields('documents', [
      { field: 'titre', type: 'string', meta: { required: true, interface: 'input' }, schema: {} },
      { field: 'contenu', type: 'text', meta: { interface: 'input-rich-text-md' }, schema: {} },
      { field: 'statut', type: 'string', meta: { interface: 'input' }, schema: { default_value: 'brouillon' } },
      { field: 'action_valider', type: 'boolean', meta: { interface: 'boolean' }, schema: { default_value: false, is_nullable: false } }
    ]);
    
    // ========================================
    // 8. TICKETS SUPPORT
    // ========================================
    await createCollectionWithFields('tickets_support', [
      { field: 'titre', type: 'string', meta: { required: true, interface: 'input' }, schema: {} },
      { field: 'description', type: 'text', meta: { interface: 'input-multiline' }, schema: {} },
      { field: 'statut', type: 'string', meta: { interface: 'input' }, schema: { default_value: 'nouveau' } },
      { field: 'priorite', type: 'string', meta: { interface: 'input' }, schema: { default_value: 'normale' } },
      { field: 'sla_depasse', type: 'boolean', meta: { interface: 'boolean', readonly: true }, schema: { default_value: false, is_nullable: false } }
    ]);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ TOUTES LES COLLECTIONS ONT ÉTÉ CRÉÉES !');
    console.log('='.repeat(60));
    
    // ========================================
    // INSERTION DES DONNÉES DE TEST
    // ========================================
    console.log('\n📝 Insertion des données de test...\n');
    
    // Projets
    const projets = await insertData('projets', [
      { nom: 'Projet Alpha', description: 'Refonte site web', statut: 'en_cours', type: 'web', priorite: 'haute', budget_total: 50000 },
      { nom: 'Projet Beta', description: 'App mobile', statut: 'planifie', type: 'mobile', priorite: 'moyenne', budget_total: 30000 }
    ]);
    
    // Tâches
    if (projets && projets.length > 0) {
      await insertData('taches', [
        { projet_id: projets[0].id, titre: 'Analyse besoins', statut: 'termine', priorite: 'haute', duree_estimee: 40, ordre: 1 },
        { projet_id: projets[0].id, titre: 'Maquettage UI', statut: 'en_cours', priorite: 'haute', duree_estimee: 60, ordre: 2 },
        { projet_id: projets[0].id, titre: 'Dev Frontend', statut: 'a_faire', priorite: 'haute', duree_estimee: 120, ordre: 3 }
      ]);
    }
    
    // Produits
    await insertData('produits', [
      { nom: 'Produit A', prix: 29.99 },
      { nom: 'Produit B', prix: 49.99 },
      { nom: 'Produit C', prix: 19.99 }
    ]);
    
    // Commandes
    const commandes = await insertData('commandes', [
      { numero: 'CMD-2025-001', client_nom: 'Jean Dupont', statut: 'confirmee' },
      { numero: 'CMD-2025-002', client_nom: 'Marie Martin', statut: 'brouillon' }
    ]);
    
    // Lignes commande
    if (commandes && commandes.length > 0) {
      await insertData('lignes_commande', [
        { commande_id: commandes[0].id, designation: 'Produit A', quantite: 2, prix_unitaire: 29.99 },
        { commande_id: commandes[0].id, designation: 'Produit B', quantite: 1, prix_unitaire: 49.99 }
      ]);
    }
    
    // Campagne cascade
    const campagnes = await insertData('campagnes', [
      { nom: 'Campagne 2025 Q1', annee: 2025, periode: 'Q1' }
    ]);
    
    if (campagnes && campagnes.length > 0) {
      const calendriers = await insertData('calendriers', [
        { campagne_id: campagnes[0].id, nom: 'Calendrier Principal', annee: 2025 }
      ]);
      
      if (calendriers && calendriers.length > 0) {
        const domaines = await insertData('domaines', [
          { calendrier_id: calendriers[0].id, nom: 'Finance' },
          { calendrier_id: calendriers[0].id, nom: 'RH' }
        ]);
        
        if (domaines && domaines.length > 0) {
          const processus = await insertData('processus_campagne', [
            { domaine_id: domaines[0].id, nom: 'Clôture mensuelle' },
            { domaine_id: domaines[1].id, nom: 'Recrutement' }
          ]);
          
          if (processus && processus.length > 0) {
            await insertData('taches_campagne', [
              { processus_id: processus[0].id, nom: 'Rapprochement bancaire', delai: 5 },
              { processus_id: processus[1].id, nom: 'Publication offre', delai: 7 }
            ]);
          }
        }
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 SETUP COMPLET TERMINÉ !');
    console.log('='.repeat(60));
    console.log('\n📊 Collections créées : 18');
    console.log('📝 Données insérées : ~30 items');
    console.log('\n🚀 Prêt pour les tests d\'automations !');
    
  } catch (error) {
    console.error('\n❌ ERREUR FATALE:', error.message);
    if (VERBOSE) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Exécuter
main().catch(console.error);
