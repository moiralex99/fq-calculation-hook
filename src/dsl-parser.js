/**
 * Parser et évaluateur DSL → JavaScript
 * Compatible avec le format DSL de FlowQuartz Engine
 * Supporte un subset du DSL pour les formules locales uniquement
 * 
 * Format DSL:
 * - Champs: {{field_name}} ou {{Collection.field_name}}
 * - Fonctions: IF(cond, then, else), COALESCE(a, b, ...), ROUND(x, decimals)
 * - Opérateurs: +, -, *, /, %, =, <>, !=, <, <=, >, >=, AND, OR, NOT
 * - Littéraux: nombres, "chaînes", true, false, null
 */

export class DSLParser {
  constructor() {
    // Regex pour extraire les tokens du DSL
    this.tokenRegex = /(\{\{[a-zA-Z0-9_\.]+\}\}|"(?:[^"\\]|\\.)*"|[0-9]+(?:\.[0-9]+)?|\b(?:IF|COALESCE|ROUND|NULLIF|UPPER|LOWER|CONCAT|AND|OR|NOT|true|false|null)\b|[+\-*\/%()=<>!,]|<=|>=|<>|!=)/gi;
  }

  /**
   * Parse une formule DSL et retourne une fonction JavaScript évaluable
   * @param {string} formula - Formule DSL (ex: "{{prix}} * {{quantite}}")
   * @returns {Function} - Fonction qui prend (data) et retourne le résultat
   */
  compile(formula) {
    if (!formula) {
      return () => null;
    }

    try {
      // 1. Convertir DSL → JavaScript
      const jsCode = this.dslToJavaScript(formula);
      const helpers = this.createHelpers();
      
      // 2. Créer une fonction évaluable (sans 'use strict' et 'with')
      // eslint-disable-next-line no-new-func
      const fn = new Function('data', 'IF', 'COALESCE', 'ROUND', 'NULLIF', 'UPPER', 'LOWER', 'CONCAT', `
        return (${jsCode});
      `);
      
      return (data) => {
        return fn(
          data,
          helpers.IF,
          helpers.COALESCE,
          helpers.ROUND,
          helpers.NULLIF,
          helpers.UPPER,
          helpers.LOWER,
          helpers.CONCAT
        );
      };
      
    } catch (error) {
      throw new Error(`Failed to compile formula: ${error.message}`);
    }
  }

  /**
   * Traduit une formule DSL en expression JavaScript
   * @param {string} formula - Formule DSL
   * @returns {string} - Expression JavaScript
   */
  dslToJavaScript(formula) {
    let js = formula;

    // 1. Remplacer les champs {{field}} par data.field
    // Ne pas utiliser ?? 0 car ça empêche COALESCE de fonctionner
    js = js.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, field) => {
      return `(data.${field})`;
    });

    // 2. Remplacer les champs avec collection {{Collection.field}} par null (non supporté)
    js = js.replace(/\{\{([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\}\}/g, () => {
      return 'null /* cross-collection reference not supported */';
    });

    // 3. Remplacer les opérateurs SQL par JavaScript (dans le bon ordre!)
    js = js.replace(/\s+AND\s+/gi, ' && ');
    js = js.replace(/\s+OR\s+/gi, ' || ');
    js = js.replace(/\bNOT\s+/gi, '!');
    
    // Remplacer les opérateurs de comparaison
    // IMPORTANT: Utiliser des marqueurs temporaires pour éviter les conflits
    js = js.replace(/\s*<=\s*/g, ' __LTE__ ');
    js = js.replace(/\s*>=\s*/g, ' __GTE__ ');
    js = js.replace(/\s*<>\s*/g, ' __NEQ__ ');
    js = js.replace(/\s*!=\s*/g, ' __NEQ__ ');
    js = js.replace(/\s*<\s*/g, ' __LT__ ');
    js = js.replace(/\s*>\s*/g, ' __GT__ ');
    
    // = pour égalité (mais pas == ou === ou <= ou >=)
    // Ne pas remplacer = dans les chaînes entre guillemets
    js = js.replace(/(?<![=<>!])\s*=\s*(?![=])/g, (match, offset) => {
      // Vérifier si on est dans une chaîne
      const before = js.substring(0, offset);
      const doubleQuotes = (before.match(/"/g) || []).length;
      const singleQuotes = (before.match(/'/g) || []).length;
      
      // Si nombre impair de guillemets, on est dans une chaîne
      if (doubleQuotes % 2 === 1 || singleQuotes % 2 === 1) {
        return match;
      }
      return ' __EQ__ ';
    });
    
    // Remplacer les marqueurs par les vrais opérateurs JavaScript
    js = js.replace(/__LTE__/g, '<=');
    js = js.replace(/__GTE__/g, '>=');
    js = js.replace(/__NEQ__/g, '!==');
    js = js.replace(/__LT__/g, '<');
    js = js.replace(/__GT__/g, '>');
    js = js.replace(/__EQ__/g, '===');

    // 4. Remplacer les fonctions DSL par des appels aux helpers
    js = js.replace(/\bIF\s*\(/gi, 'IF(');
    js = js.replace(/\bCOALESCE\s*\(/gi, 'COALESCE(');
    js = js.replace(/\bROUND\s*\(/gi, 'ROUND(');
    js = js.replace(/\bNULLIF\s*\(/gi, 'NULLIF(');
    js = js.replace(/\bUPPER\s*\(/gi, 'UPPER(');
    js = js.replace(/\bLOWER\s*\(/gi, 'LOWER(');
    js = js.replace(/\bCONCAT\s*\(/gi, 'CONCAT(');

    return js;
  }

  /**
   * Crée les fonctions helpers disponibles dans les formules
   * @returns {Object} - Map de fonctions
   */
  createHelpers() {
    return {
      // IF(condition, valeur_si_vrai, valeur_si_faux)
      IF: (condition, trueValue, falseValue) => {
        return condition ? trueValue : falseValue;
      },

      // COALESCE(a, b, c, ...) - Retourne la première valeur non-null
      COALESCE: (...args) => {
        for (const arg of args) {
          if (arg != null) {
            return arg;
          }
        }
        return null;
      },

      // ROUND(valeur, decimales)
      ROUND: (value, decimals = 2) => {
        if (value == null || isNaN(value)) return null;
        const factor = Math.pow(10, decimals);
        return Math.round(value * factor) / factor;
      },

      // NULLIF(a, b) - Retourne null si a == b, sinon a
      NULLIF: (a, b) => {
        return a === b ? null : a;
      },

      // UPPER(text)
      UPPER: (text) => {
        return text ? String(text).toUpperCase() : '';
      },

      // LOWER(text)
      LOWER: (text) => {
        return text ? String(text).toLowerCase() : '';
      },

      // CONCAT(...args)
      CONCAT: (...args) => {
        return args.filter(v => v != null).map(v => String(v)).join('');
      }
    };
  }

  /**
   * Extrait les champs référencés dans une formule
   * @param {string} formula - Formule DSL
   * @returns {string[]} - Liste des champs (format: "field" ou "Collection.field")
   */
  extractFields(formula) {
    if (!formula) return [];

    const fields = [];
    const regex = /\{\{([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)?)\}\}/g;
    let match;

    while ((match = regex.exec(formula)) !== null) {
      fields.push(match[1]);
    }

    return [...new Set(fields)]; // Unique
  }

  /**
   * Extrait les dépendances locales (sans collection)
   * @param {string} formula - Formule DSL
   * @returns {string[]} - Liste des champs locaux
   */
  extractLocalDependencies(formula) {
    const allFields = this.extractFields(formula);
    return allFields.filter(field => !field.includes('.'));
  }

  /**
   * Teste si une formule est locale (pas de références croisées)
   * @param {string} formula - Formule DSL
   * @returns {boolean} - true si locale
   */
  isLocalFormula(formula) {
    if (!formula) return true;

    // Patterns qui indiquent une formule NON locale
    const nonLocalPatterns = [
      /\{\{[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+\}\}/,  // {{Collection.field}}
      /\bLOOKUP\s*\(/i,                         // LOOKUP()
      /\bPARENT\s*\(/i,                         // PARENT()
      /\bCHILDREN\s*\(/i,                       // CHILDREN()
      /\bRELATED\s*\(/i,                        // RELATED()
      /\bSUM\s*\(/i,                            // SUM() - agrégation
      /\bAVG\s*\(/i,                            // AVG() - agrégation
      /\bCOUNT\s*\(/i,                          // COUNT() - agrégation
      /\bMIN\s*\(/i,                            // MIN() - agrégation
      /\bMAX\s*\(/i,                            // MAX() - agrégation
      /\bCOUNT_DISTINCT\s*\(/i,                 // COUNT_DISTINCT() - agrégation
    ];

    for (const pattern of nonLocalPatterns) {
      if (pattern.test(formula)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Valide une formule et retourne les erreurs éventuelles
   * @param {string} formula - Formule DSL
   * @param {Object} sampleData - Données d'exemple pour tester
   * @returns {Object} - {valid: boolean, error?: string, result?: any}
   */
  validate(formula, sampleData = {}) {
    try {
      const fn = this.compile(formula);
      const result = fn(sampleData);
      
      return {
        valid: true,
        result: result
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }
}

/**
 * Évaluateur de formules DSL simplifié
 * Utilise le parser pour compiler et évaluer des formules
 */
export class DSLEvaluator {
  constructor(logger) {
    this.parser = new DSLParser();
    this.logger = logger;
    this.compiledCache = new Map(); // Cache des formules compilées
  }

  /**
   * Évalue une formule avec des données
   * @param {string} formula - Formule DSL
   * @param {Object} data - Données de contexte
   * @returns {any} - Résultat calculé
   */
  evaluate(formula, data) {
    try {
      // Utiliser le cache si disponible
      let compiledFn = this.compiledCache.get(formula);
      
      if (!compiledFn) {
        compiledFn = this.parser.compile(formula);
        this.compiledCache.set(formula, compiledFn);
      }

      const result = compiledFn(data);
      this.logger?.debug(`Evaluated: ${formula} = ${result}`);
      return result;
      
    } catch (error) {
      this.logger?.error(`Error evaluating formula "${formula}":`, error.message);
      throw error;
    }
  }

  /**
   * Efface le cache des formules compilées
   */
  clearCache() {
    this.compiledCache.clear();
  }

  /**
   * Retourne la taille du cache
   * @returns {number} - Nombre de formules en cache
   */
  getCacheSize() {
    return this.compiledCache.size;
  }

  /**
   * Extrait les dépendances d'une formule
   * @param {string} formula - Formule DSL
   * @returns {string[]} - Liste des champs dépendants
   */
  extractDependencies(formula) {
    return this.parser.extractLocalDependencies(formula);
  }

  /**
   * Teste si une formule est locale
   * @param {string} formula - Formule DSL
   * @returns {boolean} - true si locale
   */
  isLocal(formula) {
    return this.parser.isLocalFormula(formula);
  }

  /**
   * Alias pour isLocal (pour compatibilité avec les tests)
   * @param {string} formula - Formule DSL
   * @returns {boolean} - true si locale
   */
  isLocalFormula(formula) {
    return this.isLocal(formula);
  }
}
