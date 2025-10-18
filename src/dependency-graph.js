/**
 * Gestionnaire d'arbre de dépendances pour les formules
 * Détermine l'ordre optimal de calcul des champs
 * Compatible avec le format de quartz_formulas
 */

export class DependencyGraph {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Construit un graphe de dépendances à partir des formules
   * @param {Object} formulas - Formules par champ {fieldName: {formula, dependencies}}
   * @returns {Object} - {graph, order, cycles}
   */
  buildGraph(formulas) {
    const graph = {};
    const allFields = new Set();
    
    // Initialiser le graphe
    for (const [fieldName, config] of Object.entries(formulas)) {
      allFields.add(fieldName);
      graph[fieldName] = {
        formula: config.formula,
        dependencies: config.dependencies || [], // Utilise les deps extraites par le parser
        dependents: []
      };
    }
    
    // Construire les relations de dépendance inversées (qui dépend de moi ?)
    for (const [fieldName, config] of Object.entries(graph)) {
      for (const dep of config.dependencies) {
        // Si la dépendance est un champ calculé (dans le graphe)
        if (graph[dep]) {
          graph[dep].dependents.push(fieldName);
        }
      }
    }
    
    return graph;
  }

  /**
   * Tri topologique pour déterminer l'ordre de calcul
   * @param {Object} graph - Graphe de dépendances
   * @returns {Object} - {order: string[], cycles: string[][]}
   */
  topologicalSort(graph) {
    const visited = new Set();
    const visiting = new Set();
    const order = [];
    const cycles = [];
    
    const visit = (node, path = []) => {
      if (visiting.has(node)) {
        // Cycle détecté !
        const cycleStart = path.indexOf(node);
        const cycle = path.slice(cycleStart).concat(node);
        cycles.push(cycle);
        return false;
      }
      
      if (visited.has(node)) {
        return true;
      }
      
      visiting.add(node);
      path.push(node);
      
      // Visiter les dépendances d'abord
      const deps = graph[node]?.dependencies || [];
      for (const dep of deps) {
        if (graph[dep]) { // Seulement si c'est un champ calculé
          if (!visit(dep, [...path])) {
            return false;
          }
        }
      }
      
      visiting.delete(node);
      visited.add(node);
      order.push(node);
      
      return true;
    };
    
    // Visiter tous les nœuds
    for (const node of Object.keys(graph)) {
      if (!visited.has(node)) {
        visit(node);
      }
    }
    
    return { order, cycles };
  }

  /**
   * Analyse les formules et retourne l'ordre de calcul optimal
   * @param {Object} formulas - Formules par champ
   * @returns {Object} - {order, graph, cycles, levels}
   */
  analyze(formulas) {
    // Construire le graphe
    const graph = this.buildGraph(formulas);
    
    // Tri topologique
    const { order, cycles } = this.topologicalSort(graph);
    
    // Calculer les niveaux (pour le debug)
    const levels = this.calculateLevels(graph, order);
    
    // Logger les résultats
    if (cycles.length > 0) {
      this.logger?.warn(`[DependencyGraph] Detected ${cycles.length} circular dependency(ies):`);
      cycles.forEach(cycle => {
        this.logger?.warn(`  -> ${cycle.join(' → ')}`);
      });
    }
    
    this.logger?.debug(`[DependencyGraph] Calculation order: ${order.join(' → ')}`);
    
    return {
      order,        // Ordre de calcul
      graph,        // Graphe complet
      cycles,       // Cycles détectés
      levels        // Niveaux de dépendance
    };
  }

  /**
   * Calcule les niveaux de dépendance
   * @param {Object} graph - Graphe de dépendances
   * @param {string[]} order - Ordre topologique
   * @returns {Object} - {fieldName: level}
   */
  calculateLevels(graph, order) {
    const levels = {};
    
    for (const field of order) {
      const deps = graph[field]?.dependencies || [];
      
      // Niveau = max(niveaux des dépendances) + 1
      let maxDepLevel = -1;
      for (const dep of deps) {
        if (levels[dep] !== undefined) {
          maxDepLevel = Math.max(maxDepLevel, levels[dep]);
        }
      }
      
      levels[field] = maxDepLevel + 1;
    }
    
    return levels;
  }

  /**
   * Détecte les champs qui déclenchent un recalcul
   * @param {Object} graph - Graphe de dépendances
   * @param {string[]} changedFields - Champs modifiés
   * @returns {string[]} - Champs calculés à recalculer
   */
  getAffectedFields(graph, changedFields) {
    const affected = new Set();
    const queue = [...changedFields];
    const processed = new Set();
    
    while (queue.length > 0) {
      const field = queue.shift();
      
      if (processed.has(field)) {
        continue;
      }
      processed.add(field);
      
      // Trouver les champs calculés qui dépendent de celui-ci
      // On parcourt tout le graphe car le champ modifié peut ne pas être dans le graphe
      // (ex: quantite n'est pas calculé mais total_ht en dépend)
      for (const [calculatedField, config] of Object.entries(graph)) {
        if (config.dependencies.includes(field)) {
          if (!affected.has(calculatedField)) {
            affected.add(calculatedField);
            queue.push(calculatedField);
          }
        }
      }
    }
    
    return Array.from(affected);
  }

  /**
   * Optimise l'ordre de calcul pour ne recalculer que ce qui est nécessaire
   * @param {Object} graph - Graphe de dépendances
   * @param {string[]} order - Ordre complet
   * @param {string[]} changedFields - Champs modifiés (ou calculés affectés initialement)
   * @returns {string[]} - Ordre de calcul optimisé
   */
  optimizeCalculationOrder(graph, order, changedFields) {
    // Trouver les champs affectés (dépendants)
    const affected = this.getAffectedFields(graph, changedFields);
    
    // On doit aussi inclure les champs initialement modifiés s'ils sont dans le graphe
    const allToRecalculate = new Set([...changedFields, ...affected]);
    
    // Filtrer l'ordre pour ne garder que les champs à recalculer
    const optimizedOrder = order.filter(field => allToRecalculate.has(field));
    
    this.logger?.debug(`[DependencyGraph] Changed: ${changedFields.join(', ')}`);
    this.logger?.debug(`[DependencyGraph] Recalculate: ${optimizedOrder.join(' → ')}`);
    
    return optimizedOrder;
  }

  /**
   * Calcule la clôture des dépendances pour un ensemble de champs ciblés
   * @param {Object} graph - Graphe de dépendances (résultat de buildGraph)
   * @param {string[]} targetFields - Champs pour lesquels inclure les dépendances
   * @returns {Set<string>} - Ensemble de champs calculés à traiter (champs cibles + dépendances)
   */
  collectDependencyClosure(graph, targetFields) {
    const closure = new Set();
    if (!Array.isArray(targetFields) || targetFields.length === 0) {
      return closure;
    }

    const visit = (field) => {
      if (!field || closure.has(field)) {
        return;
      }

      if (graph && graph[field]) {
        closure.add(field);
        const deps = graph[field]?.dependencies || [];
        for (const dep of deps) {
          if (graph[dep]) {
            visit(dep);
          }
        }
      } else {
        // Champ n'ayant pas de formule locale (dépendance externe) — on le garde pour info
        closure.add(field);
      }
    };

    for (const field of targetFields) {
      visit(field);
    }

    return closure;
  }

  /**
   * Visualise le graphe (pour debug)
   * @param {Object} graph - Graphe de dépendances
   * @returns {string} - Représentation textuelle
   */
  visualize(graph) {
    let result = '\n=== Dependency Graph ===\n';
    
    for (const [field, config] of Object.entries(graph)) {
      result += `\n${field}:\n`;
      
      if (config.dependencies.length > 0) {
        result += `  depends on: ${config.dependencies.join(', ')}\n`;
      }
      
      if (config.dependents.length > 0) {
        result += `  triggers: ${config.dependents.join(', ')}\n`;
      }
      
      result += `  formula: ${config.formula}\n`;
    }
    
    return result;
  }
}
