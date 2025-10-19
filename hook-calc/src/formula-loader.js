/**
 * Service pour charger les formules depuis Directus
 * Compatible avec le format quartz_formulas de FlowQuartz Engine
 * 
 * Format de la table quartz_formulas:
 * - id: identifiant
 * - collection_cible: nom de la collection (ex: "factures")
 * - champ_cible: nom du champ à calculer (ex: "total_ttc")
 * - formula: formule DSL (ex: "{{total_ht}} * 1.2")
 * - status: published | draft | archived
 * - sort: ordre d'exécution suggéré
 * - description: description de la formule
 * - date_created, date_updated, user_created, user_updated
 */

import { DSLParser } from './dsl-parser.js';

export class FormulaLoader {
  constructor(database, logger) {
    this.database = database;
    this.logger = logger;
    this.parser = new DSLParser();
    this.cachedFormulas = null;
    this.lastLoadTime = null;
    this.CACHE_TTL = 60000; // 1 minute
  }

  /**
   * Charge les formules depuis la collection quartz_formulas
   * @returns {Object} - Formules groupées par collection
   */
  async loadFormulas() {
    try {
      // Vérifier le cache
      if (this.cachedFormulas && this.lastLoadTime && 
          (Date.now() - this.lastLoadTime < this.CACHE_TTL)) {
        return this.cachedFormulas;
      }

      // Charger depuis la table quartz_formulas
      // Format réel de la table: collection_cible, champ_cible, formula, status
      const formulas = await this.database('quartz_formulas')
        .select('*')
        .where('status', 'published')
        .orderBy('collection_cible', 'asc')
        .orderBy('sort', 'asc')
        .orderBy('champ_cible', 'asc');

      // Grouper par collection
      const formulasByCollection = {};
      
      for (const formula of formulas) {
        const collection = formula.collection_cible; // ⚠️ Format engine Python
        
        if (!collection) {
          this.logger?.warn('[FormulaLoader] Missing collection_cible on row id=' + formula.id);
          continue;
        }
        
        if (!formulasByCollection[collection]) {
          formulasByCollection[collection] = {};
        }
        
        const fieldName = formula.champ_cible; // ⚠️ Format engine Python
        const formulaText = formula.formula;
        
        if (!fieldName || !formulaText) {
          this.logger?.warn(`[FormulaLoader] Missing champ_cible or formula for ${collection} (id=${formula.id})`);
          continue;
        }
        
        // Extraire les dépendances en parsant le DSL
        const dependencies = this.parser.extractLocalDependencies(formulaText);
        
        formulasByCollection[collection][fieldName] = {
          formula: formulaText,
          dependencies: dependencies,
          isLocal: this.parser.isLocalFormula(formulaText),
          metadata: {
            id: formula.id,
            description: formula.description,
            sort: formula.sort,
            updated_at: formula.date_updated
          }
        };
      }

      // Mettre en cache
      this.cachedFormulas = formulasByCollection;
      this.lastLoadTime = Date.now();
      
  this.logger?.info(`[FormulaLoader] Loaded ${formulas.length} formula(s) from ${Object.keys(formulasByCollection).length} collection(s)`);
      
      return formulasByCollection;
      
    } catch (error) {
      this.logger?.error('[FormulaLoader] Error loading formulas:', error.message);
      
      // Si la table n'existe pas encore, retourner config vide
      if (error.message.includes('does not exist')) {
        this.logger?.warn('[FormulaLoader] Table quartz_formulas not found. Using empty config.');
        return {};
      }
      
      throw error;
    }
  }



  /**
   * Filtre les formules pour ne garder que les locales
   * @param {Object} allFormulas - Toutes les formulas chargées
   * @returns {Object} - Seulement les formules locales
   */
  filterLocalFormulas(allFormulas) {
    const localFormulas = {};
    let skipped = 0;
    
    for (const [collection, fields] of Object.entries(allFormulas)) {
      localFormulas[collection] = {};
      
      for (const [fieldName, config] of Object.entries(fields)) {
        if (config.isLocal) {
          localFormulas[collection][fieldName] = config;
        } else {
          this.logger?.info(`[FormulaLoader] Skipping non-local formula: ${collection}.${fieldName}`);
          skipped++;
        }
      }
      
      // Supprimer la collection si aucune formule locale
      if (Object.keys(localFormulas[collection]).length === 0) {
        delete localFormulas[collection];
      }
    }
    
    if (skipped > 0) {
      this.logger?.info(`[FormulaLoader] Filtered out ${skipped} non-local formula(s) (require full engine)`);
    }
    
    return localFormulas;
  }

  /**
   * Recharge les formules (bypass du cache)
   */
  async reloadFormulas() {
    this.cachedFormulas = null;
    this.lastLoadTime = null;
    return await this.loadFormulas();
  }

  /**
   * Charge uniquement les formules locales
   * @returns {Object} - Formules locales groupées par collection
   */
  async loadLocalFormulas() {
    const allFormulas = await this.loadFormulas();
    return this.filterLocalFormulas(allFormulas);
  }
}
