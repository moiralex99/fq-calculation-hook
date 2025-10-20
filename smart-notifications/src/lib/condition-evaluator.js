/**
 * Condition Evaluator
 * Évalue les conditions JSONLogic (compatible avec quartz_automations)
 */

import jsonLogic from 'json-logic-js';

export class ConditionEvaluator {
  constructor(logger) {
    this.logger = logger;
    this.setupCustomOperations();
  }

  /**
   * Configure les opérations custom JSONLogic
   */
  setupCustomOperations() {
    // Opération date_diff pour calculer jours_restants
    jsonLogic.add_operation('date_diff', (date1, date2, unit = 'days') => {
      const d1 = new Date(date1);
      const d2 = new Date(date2);
      
      if (isNaN(d1) || isNaN(d2)) return null;
      
      const diffMs = d2 - d1;
      
      switch (unit.toLowerCase()) {
        case 'days':
          return Math.floor(diffMs / (1000 * 60 * 60 * 24));
        case 'hours':
          return Math.floor(diffMs / (1000 * 60 * 60));
        case 'minutes':
          return Math.floor(diffMs / (1000 * 60));
        default:
          return diffMs;
      }
    });

    // Opération now() pour date actuelle
    jsonLogic.add_operation('now', () => new Date().toISOString());

    // Opération today() pour date du jour
    jsonLogic.add_operation('today', () => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    });
  }

  /**
   * Évalue une condition JSONLogic avec des données
   * @param {Object} conditions - Conditions JSONLogic
   * @param {Object} data - Données contextuelles
   * @returns {boolean} - Résultat de l'évaluation
   */
  evaluate(conditions, data) {
    if (!conditions) {
      return true; // Pas de conditions = toujours vrai
    }

    try {
      const result = jsonLogic.apply(conditions, data);
      this.logger?.debug(`[ConditionEvaluator] Evaluated: ${JSON.stringify(conditions)} with data: ${JSON.stringify(data)} => ${result}`);
      return Boolean(result);
    } catch (error) {
      this.logger?.error(`[ConditionEvaluator] Error evaluating conditions:`, error);
      return false;
    }
  }

  /**
   * Valide des conditions JSONLogic
   * @param {Object} conditions - Conditions à valider
   * @returns {{valid: boolean, error?: string}}
   */
  validate(conditions) {
    if (!conditions) {
      return { valid: true };
    }

    if (typeof conditions !== 'object') {
      return { valid: false, error: 'Conditions must be an object' };
    }

    try {
      // Test avec des données vides
      jsonLogic.apply(conditions, {});
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Extrait les variables utilisées dans les conditions
   * @param {Object} conditions - Conditions JSONLogic
   * @returns {string[]} - Liste des variables
   */
  extractVariables(conditions) {
    const variables = new Set();

    const traverse = (obj) => {
      if (!obj || typeof obj !== 'object') return;

      if (obj.var) {
        variables.add(obj.var);
      }

      for (const value of Object.values(obj)) {
        if (Array.isArray(value)) {
          value.forEach(traverse);
        } else if (typeof value === 'object') {
          traverse(value);
        }
      }
    };

    traverse(conditions);
    return Array.from(variables);
  }
}
