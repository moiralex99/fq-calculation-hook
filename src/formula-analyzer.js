/**
 * Analyseur de formules - Version JavaScript (portée depuis Python)
 * Filtre uniquement les formules LOCAL pour l'extension Directus
 */

export class FormulaAnalyzer {
    constructor() {
        // Patterns pour détecter les formules GLOBAL (à exclure)
        this.globalPatterns = {
            fromPattern: /\bFROM\s+\w+/i,
            nestedFieldPattern: /\w+\.\w+\.\w+/,
            sqlAdvancedPattern: /(SELECT|INSERT|UPDATE|DELETE|JOIN|GROUP BY|ORDER BY|HAVING|UNION)/i,
            aggregatePattern: /(SUM|COUNT|AVG|MIN|MAX|DISTINCT)\s*\(/i
        };
    }

    /**
     * Analyse une formule et détermine si elle est LOCAL ou GLOBAL
     * @param {string} formula - La formule à analyser
     * @returns {object} - {scope: 'LOCAL'|'GLOBAL', reasons: string[]}
     */
    analyzeFormulaScope(formula) {
        if (!formula || typeof formula !== 'string') {
            return { scope: 'LOCAL', reasons: ['Formula vide ou invalide'] };
        }

        const reasons = [];
        
        // Test 1: Présence de FROM (GLOBAL)
        if (this.globalPatterns.fromPattern.test(formula)) {
            reasons.push('Contient FROM - requête cross-collection');
            return { scope: 'GLOBAL', reasons };
        }

        // Test 2: Champs imbriqués (3+ niveaux) (GLOBAL)
        if (this.globalPatterns.nestedFieldPattern.test(formula)) {
            reasons.push('Champs imbriqués détectés (3+ niveaux)');
            return { scope: 'GLOBAL', reasons };
        }

        // Test 3: SQL avancé (GLOBAL)
        if (this.globalPatterns.sqlAdvancedPattern.test(formula)) {
            reasons.push('SQL avancé détecté');
            return { scope: 'GLOBAL', reasons };
        }

        // Test 4: Fonctions d'agrégation (GLOBAL)
        if (this.globalPatterns.aggregatePattern.test(formula)) {
            reasons.push('Fonctions d\'agrégation détectées');
            return { scope: 'GLOBAL', reasons };
        }

        // Par défaut: LOCAL
        reasons.push('Formule simple sans cross-collection');
        return { scope: 'LOCAL', reasons };
    }

    /**
     * Filtre une liste de formules pour ne garder que les LOCAL
     * @param {Array} formulas - Array d'objets {id, formula, collection, field}
     * @returns {Array} - Formules LOCAL uniquement
     */
    filterLocalFormulas(formulas) {
        return formulas
            .map(formula => ({
                ...formula,
                analysis: this.analyzeFormulaScope(formula.formula)
            }))
            .filter(formula => formula.analysis.scope === 'LOCAL');
    }

    /**
     * Extrait les dépendances d'une formule LOCAL
     * @param {string} formula - La formule à analyser
     * @returns {Array} - Liste des champs référencés
     */
    extractDependencies(formula) {
        if (!formula) return [];

        const dependencies = new Set();
        
        // Pattern pour les références de champs simples
        // Exemples: prix_ht, quantite, item['field'], item.field
        const fieldPatterns = [
            /\b(\w+)\s*[\+\-\*\/\%]/g,  // Variables dans opérations
            /\b(\w+)\s*[\=\!\<\>]/g,    // Variables dans comparaisons
            /(\w+)\['([^']+)'\]/g,      // item['field']
            /(\w+)\.(\w+)(?!\.\w+)/g,   // item.field (mais pas item.rel.field)
            /\b(\w+)\b(?=\s*[,\)])/g    // Variables dans fonctions
        ];

        fieldPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(formula)) !== null) {
                if (match[1] && !this.isReservedWord(match[1])) {
                    dependencies.add(match[1]);
                }
                if (match[2]) {
                    dependencies.add(match[2]);
                }
            }
        });

        return Array.from(dependencies);
    }

    /**
     * Vérifie si un mot est réservé (fonction, opérateur, etc.)
     * @param {string} word - Le mot à vérifier
     * @returns {boolean}
     */
    isReservedWord(word) {
        const reserved = [
            'if', 'else', 'then', 'and', 'or', 'not', 'true', 'false',
            'null', 'undefined', 'return', 'function', 'var', 'let', 'const',
            'sum', 'count', 'avg', 'min', 'max', 'abs', 'round', 'floor', 'ceil'
        ];
        return reserved.includes(word.toLowerCase());
    }
}
