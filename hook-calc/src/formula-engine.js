/**
 * Moteur de formules simplifié pour calculs en temps réel
 * Fonctionne uniquement sur les champs de la même fiche (pas d'héritage)
 */

import { create, all } from 'mathjs';

const math = create(all);

export class SimpleFormulaEngine {
  constructor(logger) {
    this.logger = logger;
    
    // Fonctions personnalisées disponibles dans les formulas
    this.customFunctions = {
      // Fonction IF conditionnelle: IF(condition, valeur_si_vrai, valeur_si_faux)
      IF: (condition, trueValue, falseValue) => {
        return condition ? trueValue : falseValue;
      },
      
      // Arrondi à N décimales
      ROUND: (value, decimals = 2) => {
        return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
      },
      
      // Pourcentage: PERCENT(montant, pourcentage)
      PERCENT: (amount, percentage) => {
        return (amount * percentage) / 100;
      },
      
      // Concaténation de texte
      CONCAT: (...args) => {
        return args.filter(v => v != null).join('');
      },
      
      // Valeur par défaut si null/undefined
      COALESCE: (...args) => {
        return args.find(v => v != null) || null;
      },
      
      // Conversion en nombre
      NUMBER: (value) => {
        const num = parseFloat(value);
        return isNaN(num) ? 0 : num;
      },
      
      // Longueur de texte
      LEN: (text) => {
        return text ? String(text).length : 0;
      },
      
      // Texte en majuscules
      UPPER: (text) => {
        return text ? String(text).toUpperCase() : '';
      },
      
      // Texte en minuscules
      LOWER: (text) => {
        return text ? String(text).toLowerCase() : '';
      },
      
      // Extraire une partie de texte
      SUBSTR: (text, start, length) => {
        return text ? String(text).substr(start, length) : '';
      }
    };
    
    // Importer les fonctions personnalisées dans mathjs
    Object.entries(this.customFunctions).forEach(([name, fn]) => {
      math.import({ [name]: fn }, { override: true });
    });
  }

  /**
   * Évalue une formule avec les données de la fiche courante
   * @param {string} formula - La formule à évaluer (ex: "prix * quantite")
   * @param {object} data - Les données de la fiche (ex: {prix: 10, quantite: 5})
   * @returns {any} - Le résultat calculé
   */
  evaluate(formula, data) {
    try {
      if (!formula) {
        return null;
      }

      // Nettoyer les données: remplacer null/undefined par 0 pour les nombres
      const cleanData = this.prepareData(data);
      
      // Parser et évaluer la formule avec mathjs
      const result = math.evaluate(formula, cleanData);
      
      this.logger?.debug(`Formula evaluated: ${formula} = ${result}`);
      return result;
      
    } catch (error) {
      this.logger?.error(`Error evaluating formula "${formula}":`, error.message);
      throw new Error(`Formula error: ${error.message}`);
    }
  }

  /**
   * Prépare les données pour l'évaluation
   * Convertit les valeurs null en 0 pour éviter les erreurs de calcul
   */
  prepareData(data) {
    const prepared = {};
    
    for (const [key, value] of Object.entries(data)) {
      // Si c'est un objet nested, on l'ignore (pas de relations)
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        continue;
      }
      
      // Si c'est null/undefined et qu'on attend un nombre, mettre 0
      if (value == null) {
        prepared[key] = 0;
      } else {
        prepared[key] = value;
      }
    }
    
    return prepared;
  }

  /**
   * Teste si une formule est valide
   * @param {string} formula - La formule à tester
   * @param {object} sampleData - Données d'exemple pour tester
   * @returns {object} - {valid: boolean, error?: string}
   */
  validateFormula(formula, sampleData = {}) {
    try {
      this.evaluate(formula, sampleData);
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: error.message 
      };
    }
  }

  /**
   * Extrait les champs référencés dans une formule
   * @param {string} formula - La formule à analyser
   * @returns {string[]} - Liste des noms de champs
   */
  extractFields(formula) {
    try {
      const node = math.parse(formula);
      const fields = new Set();
      
      node.traverse((node) => {
        if (node.isSymbolNode && !this.customFunctions[node.name]) {
          fields.add(node.name);
        }
      });
      
      return Array.from(fields);
    } catch (error) {
      this.logger?.error(`Error parsing formula "${formula}":`, error.message);
      return [];
    }
  }
}
