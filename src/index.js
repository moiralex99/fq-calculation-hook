/**
 * Extension Directus - Calculs en temps réel
 * Calcule automatiquement les champs avec des formules lors de la création/modification
 * Fonctionne uniquement sur les champs de la même fiche (pas d'héritage ni consolidation)
 * 
 * RÉUTILISE LE SYSTÈME FLOW        } catch (error) {
          logger.error(`[RealTime-Calc] ❌ Error in items.create action for ${collection}.${key}:`);
          logger.error(error);
        }RTZ ENGINE:
 * - Lit les formules depuis quartz_formulas (même table que l'engine Python)
 * - Parse le DSL de l'engine (format {{field}}, IF(), etc.)
 * - Filtre automatiquement les formules locales vs relationnelles
 * - Construit l'arbre de dépendances (tri topologique)
 * - Évalue en JavaScript (au lieu de SQL pour le temps réel)
 * - N'écrit que si la valeur change réellement
 */

import { DSLEvaluator } from './dsl-parser.js';
import { FormulaLoader } from './formula-loader.js';
import { DependencyGraph } from './dependency-graph.js';

export default ({ filter, action }, { services, exceptions, logger, database, getSchema, env }) => {
  const dslEvaluator = new DSLEvaluator(logger);
  const formulaLoader = new FormulaLoader(database, logger);
  const dependencyGraph = new DependencyGraph(logger);
  
  // Cache des configurations de formules et graphes de dépendances
  let formulaConfigs = {};
  let dependencyGraphs = {};
  // Debounce pour éviter de recharger trop souvent
  let pendingReloadTimeout = null;

  // Construit les graphes à partir d'une configuration donnée et met à jour les caches globaux
  async function buildGraphsFromConfigs(configs) {
    formulaConfigs = configs || {};
    dependencyGraphs = {};
    for (const [collection, formulas] of Object.entries(formulaConfigs)) {
      const analysis = dependencyGraph.analyze(formulas);
      dependencyGraphs[collection] = analysis;
      if (analysis.cycles.length > 0) {
        logger.warn(`[RealTime-Calc] Collection ${collection} has circular dependencies!`);
      }
      logger.debug(`[RealTime-Calc] ${collection}: ${analysis.order.length} local formula(s) loaded`);
    }
    return true;
  }

  // Sérialisation stable pour comparaison de signatures (évite l'ordre arbitraire des clés)
  function stableStringify(obj) {
    if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
    const keys = Object.keys(obj).sort();
    const entries = keys.map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`);
    return '{' + entries.join(',') + '}';
  }

  function computeConfigSignature(configs) {
    try {
      return stableStringify(configs);
    } catch (e) {
      logger.warn('[RealTime-Calc] Could not compute config signature:', e?.message || e);
      return '' + Date.now();
    }
  }

  // Reload robuste: recharge plusieurs fois jusqu'à stabilité pour éviter de prendre l'avant-dernière version
  async function stableReloadFormulas({ attempts = 3, settleDelayMs = 700, reason = 'unknown' } = {}) {
    let lastSig = null;
    let chosenConfig = null;
    for (let i = 1; i <= attempts; i++) {
      // Bypass cache to avoid reading stale configs
      const all = await formulaLoader.reloadFormulas();
      const cfg = formulaLoader.filterLocalFormulas(all);
      const sig = computeConfigSignature(cfg);
      logger.debug(`[RealTime-Calc] Reload attempt ${i}/${attempts} (reason: ${reason}) signature: ${sig.substring(0, 32)}…`);
      if (lastSig && sig === lastSig) {
        logger.info(`[RealTime-Calc] 🔒 Reload stabilized on attempt ${i} (reason: ${reason})`);
        chosenConfig = cfg;
        break;
      }
      lastSig = sig;
      chosenConfig = cfg;
      if (i < attempts) {
        await new Promise(r => setTimeout(r, settleDelayMs));
      }
    }
    return await buildGraphsFromConfigs(chosenConfig);
  }

  function scheduleFormulasReload(reason = 'unknown') {
    try {
      if (pendingReloadTimeout) clearTimeout(pendingReloadTimeout);
      // Utiliser un debounce plus long pour laisser Directus finaliser toutes les écritures
      // (Studio peut envoyer plusieurs PATCH successifs: champ, status, etc.)
      pendingReloadTimeout = setTimeout(async () => {
        logger.info(`[RealTime-Calc] 🔁 Auto-reloading formulas (reason: ${reason})...`);
        // Utiliser un rechargement stabilisé pour éviter les états intermédiaires
        const ok = await stableReloadFormulas({ attempts: 3, settleDelayMs: 700, reason });
        if (ok) {
          const total = Object.values(formulaConfigs).reduce((s, cfg) => s + Object.keys(cfg).length, 0);
          const perCollectionCounts = Object.fromEntries(
            Object.entries(formulaConfigs).map(([c, cfg]) => [c, Object.keys(cfg).length])
          );
          const perCollectionFields = Object.fromEntries(
            Object.entries(formulaConfigs).map(([c, cfg]) => [c, Object.keys(cfg)])
          );
          const perCollectionFormulas = Object.fromEntries(
            Object.entries(formulaConfigs).map(([c, cfg]) => [
              c,
              Object.fromEntries(Object.entries(cfg).map(([field, meta]) => [field, meta.formula]))
            ])
          );
          logger.info(`[RealTime-Calc] ✅ Auto-reload complete: ${total} formula(s) active across ${Object.keys(formulaConfigs).length} collection(s)`);
          logger.info(`[RealTime-Calc] 📦 Reload collections: ${JSON.stringify(perCollectionCounts)}`);
          logger.debug(`[RealTime-Calc] 📄 Fields per collection: ${JSON.stringify(perCollectionFields)}`);
          logger.info(`[RealTime-Calc] 🧾 Formulas content: ${JSON.stringify(perCollectionFormulas)}`);
        } else {
          logger.warn('[RealTime-Calc] ⚠️ Auto-reload failed');
        }
        pendingReloadTimeout = null;
  }, 5000);
    } catch (e) {
      logger.error('[RealTime-Calc] Error scheduling formulas reload:', e?.message || e);
    }
  }

  /**
   * Charge les formules depuis Directus et construit les graphes de dépendances
   */
  async function loadFormulasAndBuildGraphs() {
    try {
      // Charger les formules locales uniquement depuis quartz_formulas
      formulaConfigs = await formulaLoader.loadLocalFormulas();
      
      // Construire les graphes de dépendances pour chaque collection
      for (const [collection, formulas] of Object.entries(formulaConfigs)) {
        const analysis = dependencyGraph.analyze(formulas);
        dependencyGraphs[collection] = analysis;
        
        if (analysis.cycles.length > 0) {
          logger.warn(`[RealTime-Calc] Collection ${collection} has circular dependencies!`);
        }
        
        logger.debug(`[RealTime-Calc] ${collection}: ${analysis.order.length} local formula(s) loaded`);
      }
      
      return true;
    } catch (error) {
      logger.error('[RealTime-Calc] Error loading formulas:', error.message);
      return false;
    }
  }

  /**
   * Fonction pour calculer tous les champs d'une collection dans le bon ordre
   * Optimisé pour ne calculer que si nécessaire et ne pas écrire si inchangé
   */
  function calculateFields(collection, data, changedFields = null) {
    const config = formulaConfigs[collection];
    
    if (!config || Object.keys(config).length === 0) {
      return { updates: {}, hasChanges: false }; // Pas de configuration pour cette collection
    }

    const graph = dependencyGraphs[collection];
    const updates = {};
    let hasChanges = false;
    
    // Déterminer l'ordre de calcul
    let calculationOrder = graph?.order || Object.keys(config);
    
    // Optimisation: si on connaît les champs modifiés, ne recalculer que les affectés
    if (changedFields && changedFields.length > 0 && graph) {
      calculationOrder = dependencyGraph.optimizeCalculationOrder(
        graph.graph, 
        graph.order, 
        changedFields
      );
      
      if (calculationOrder.length === 0) {
        logger.debug(`[RealTime-Calc] No fields affected by changes in ${collection}`);
        return { updates: {}, hasChanges: false };
      }
    }
    
    // Calculer chaque champ dans l'ordre
    for (const fieldName of calculationOrder) {
      const formulaConfig = config[fieldName];
      
      try {
        // Créer un contexte avec les données actuelles + les calculs déjà faits
        const context = { ...data, ...updates };
        
        // Évaluer la formule DSL
        const newValue = dslEvaluator.evaluate(formulaConfig.formula, context);
        const oldValue = data[fieldName];
        
        // OPTIMISATION: Ne mettre à jour QUE si la valeur change
        if (!valuesAreEqual(oldValue, newValue)) {
          // Sécurité: ne jamais écrire autre chose que le champ cible (clé du config)
          updates[fieldName] = newValue;
          hasChanges = true;
          logger.debug(`[RealTime-Calc] calc ${collection}.${fieldName}: ${oldValue} → ${newValue}`);
        } else {
          logger.debug(`[RealTime-Calc] calc ${collection}.${fieldName}: unchanged (${oldValue})`);
        }
        
      } catch (error) {
        logger.error(`[RealTime-Calc] Error calculating ${collection}.${fieldName}:`, error.message);
        // Sécurité: en cas d'erreur d'évaluation on n'écrase pas la valeur existante
        // On journalise simplement l'erreur et on continue
      }
    }
    
    return { updates, hasChanges };
  }

  /**
   * Compare deux valeurs pour déterminer si elles sont égales
   * Gère les cas null, undefined, NaN, et arrondis flottants
   */
  function valuesAreEqual(a, b) {
    // Cas identiques
    if (a === b) return true;
    
    // Cas null/undefined
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    
    // Cas NaN
    if (typeof a === 'number' && typeof b === 'number') {
      if (isNaN(a) && isNaN(b)) return true;
      
      // Comparaison avec tolérance pour les flottants
      const epsilon = 0.0000001;
      return Math.abs(a - b) < epsilon;
    }
    
    // Cas booléens
    if (typeof a === 'boolean' && typeof b === 'boolean') {
      return a === b;
    }
    
    // Cas chaînes
    if (typeof a === 'string' || typeof b === 'string') {
      return String(a) === String(b);
    }
    
    return false;
  }

  /**
   * Hook APRÈS la création d'un item (stratégie ACTION qui fonctionne)
   * Fait un UPDATE séparé pour garantir la persistence
   */
  action('items.create', async ({ collection, key, payload }, { schema, accountability }) => {
    logger.info(`[RealTime-Calc] ✨ items.create ACTION for ${collection}.${key}`);
    // Si on modifie la table des formules, recharger à chaud puis sortir
    if (collection === 'quartz_formulas') {
      scheduleFormulasReload('quartz_formulas.create');
      return;
    }
    
    // Charger les formules si pas encore fait
    if (Object.keys(formulaConfigs).length === 0) {
      await loadFormulasAndBuildGraphs();
    }
    
    // Si aucune formule pour cette collection, skip
    if (!formulaConfigs[collection] || Object.keys(formulaConfigs[collection]).length === 0) {
      logger.debug(`[RealTime-Calc] No formulas for ${collection}, skipping`);
      return;
    }

    // Attendre un peu pour que l'item soit bien créé en DB
    setTimeout(async () => {
      try {
        const { ItemsService } = services;
        const itemsService = new ItemsService(collection, {
          database,
          schema: schema || (typeof getSchema === 'function' ? await getSchema() : undefined),
          accountability
        });

        // Récupérer l'item fraîchement créé
        const createdItem = await itemsService.readOne(key);
        logger.debug(`[RealTime-Calc] Created item data:`, createdItem);

        // Calculer les champs
        const { updates: calculatedUpdates, hasChanges } = calculateFields(collection, createdItem);
        
        if (hasChanges && Object.keys(calculatedUpdates).length > 0) {
          // Faire un UPDATE séparé avec les champs calculés
          await itemsService.updateOne(key, calculatedUpdates);
          logger.info(`[RealTime-Calc] ✅ Updated ${collection}.${key} with calculated fields:`, calculatedUpdates);
        } else {
          logger.debug(`[RealTime-Calc] No calculated fields to update for ${collection}.${key}`);
        }

      } catch (error) {
        logger.error(`[RealTime-Calc] ❌ Error in items.create action for ${collection}.${key}:`, error.message);
      }
    }, 100); // Délai de 100ms pour garantir que la création est finalisée
  });

  /**
   * Hook APRÈS la modification d'un item (stratégie ACTION qui fonctionne)
   * Fait un UPDATE séparé pour garantir la persistence
   */
  action('items.update', async ({ collection, keys, payload }, { schema, accountability }) => {
    logger.info(`[RealTime-Calc] ✏️ items.update ACTION for ${collection}, keys:`, keys);
    logger.debug(`[RealTime-Calc] Payload:`, payload);
    // Si on modifie la table des formules, recharger à chaud puis sortir
    if (collection === 'quartz_formulas') {
      scheduleFormulasReload('quartz_formulas.update');
      return;
    }
    
    // Charger les formules si pas encore fait
    if (Object.keys(formulaConfigs).length === 0) {
      await loadFormulasAndBuildGraphs();
    }
    
    // Si aucune formule pour cette collection, skip
    if (!formulaConfigs[collection] || Object.keys(formulaConfigs[collection]).length === 0) {
      logger.debug(`[RealTime-Calc] No formulas for ${collection}, skipping`);
      return;
    }

    // Traiter chaque item modifié
    for (const key of keys) {
      setTimeout(async () => {
        logger.info(`[RealTime-Calc] 🔄 Starting setTimeout for ${collection}.${key}`);
        try {
          const { ItemsService } = services;
          logger.info(`[RealTime-Calc] 📦 Creating ItemsService for ${collection}`);
          const itemsService = new ItemsService(collection, {
            database,
            schema: schema || (typeof getSchema === 'function' ? await getSchema() : undefined),
            accountability
          });

          // Récupérer l'item mis à jour
          logger.info(`[RealTime-Calc] 📖 Reading item ${key} from ${collection}`);
          const updatedItem = await itemsService.readOne(key);
          logger.info(`[RealTime-Calc] ✅ Got item data for ${key}:`, JSON.stringify(updatedItem));
          logger.debug(`[RealTime-Calc] Updated item data for ${key}:`, updatedItem);

          // Calculer les champs avec optimisation des dépendances
          const changedFields = Object.keys(payload);
          logger.info(`[RealTime-Calc] 🧮 Calling calculateFields for ${collection} with changedFields: ${changedFields.join(', ')}`);
          logger.info(`[RealTime-Calc] 📊 formulaConfigs for ${collection}:`, JSON.stringify(formulaConfigs[collection]));
          
          const { updates: calculatedUpdates, hasChanges } = calculateFields(
            collection, 
            updatedItem, 
            changedFields
          );
          
          logger.info(`[RealTime-Calc] 📝 calculateFields returned: hasChanges=${hasChanges}, updates=${JSON.stringify(calculatedUpdates)}`);
          logger.debug(`[RealTime-Calc] changedFields: ${changedFields.join(', ')}`);
          logger.debug(`[RealTime-Calc] calculatedUpdates:`, calculatedUpdates);

          if (hasChanges && Object.keys(calculatedUpdates).length > 0) {
            // Identifier les champs qui ont réellement changé
            const finalUpdates = {};
            Object.keys(calculatedUpdates).forEach(field => {
              if (!valuesAreEqual(calculatedUpdates[field], updatedItem[field])) {
                finalUpdates[field] = calculatedUpdates[field];
                logger.info(`[RealTime-Calc] Calculated field ${field} changed: ${updatedItem[field]} → ${calculatedUpdates[field]}`);
              }
            });

            if (Object.keys(finalUpdates).length > 0) {
              // Faire un UPDATE séparé avec les champs calculés modifiés
              await itemsService.updateOne(key, finalUpdates);
              logger.info(`[RealTime-Calc] ✅ Updated ${collection}.${key} with calculated fields:`, finalUpdates);
            } else {
              logger.debug(`[RealTime-Calc] Calculated fields unchanged for ${collection}.${key}`);
            }
          } else {
            logger.debug(`[RealTime-Calc] No calculated fields to update for ${collection}.${key}`);
          }

        } catch (error) {
          logger.error(`[RealTime-Calc] ❌ Error in items.update action for ${collection}.${key}:`);
          logger.error(error);
        }
      }, 100); // Délai de 100ms pour garantir que l'update est finalisé
    }
  });

  /**
   * Hook APRÈS la suppression d'un item
   * Si suppression dans quartz_formulas => recharger les formules en mémoire
   */
  action('items.delete', async ({ collection, keys }) => {
    logger.info(`[RealTime-Calc] 🗑️ items.delete ACTION for ${collection}, keys:`, keys);
    if (collection === 'quartz_formulas') {
      scheduleFormulasReload('quartz_formulas.delete');
      return;
    }
  });

  /**
   * Action custom pour tester une formule DSL
   * Permet de valider les formules avant de les déployer
   */
  action('realtime-calc.test-formula', async ({ formula, sampleData }) => {
    const validation = dslEvaluator.parser.validate(formula, sampleData || {});
    
    if (validation.valid) {
      const fields = dslEvaluator.extractDependencies(formula);
      const isLocal = dslEvaluator.isLocal(formula);
      
      return {
        valid: true,
        result: validation.result,
        fields: fields,
        isLocal: isLocal,
        message: isLocal 
          ? `Formula is valid (local). Result: ${validation.result}` 
          : `Formula is valid but requires full engine (uses relations/aggregations). Result: ${validation.result}`
      };
    } else {
      return {
        valid: false,
        error: validation.error,
        message: `Formula error: ${validation.error}`
      };
    }
  });

  /**
   * Action pour recharger les formules depuis la base
   * Peut être appelée via emitter.emitAction() ou un endpoint custom
   */
  action('realtime-calc.reload-formulas', async () => {
    try {
      logger.info('[RealTime-Calc] 🔄 Reloading formulas from database (stable)...');
      const success = await stableReloadFormulas({ attempts: 3, settleDelayMs: 700, reason: 'manual' });
      
      const stats = {
        collections: Object.keys(formulaConfigs).length,
        totalFormulas: Object.values(formulaConfigs).reduce(
          (sum, config) => sum + Object.keys(config).length, 
          0
        )
      };
      
      logger.info(`[RealTime-Calc] ✅ Reloaded ${stats.totalFormulas} formula(s) from ${stats.collections} collection(s)`);
      const perCollectionFormulas = Object.fromEntries(
        Object.entries(formulaConfigs).map(([c, cfg]) => [
          c,
          Object.fromEntries(Object.entries(cfg).map(([field, meta]) => [field, meta.formula]))
        ])
      );
      logger.info(`[RealTime-Calc] 🧾 Formulas content: ${JSON.stringify(perCollectionFormulas)}`);
      
      return {
        success: success,
        message: `Reloaded ${stats.totalFormulas} formula(s) from ${stats.collections} collection(s)`,
        stats: stats
      };
    } catch (error) {
      logger.error('[RealTime-Calc] ❌ Failed to reload formulas:', error);
      return {
        success: false,
        error: error.message,
        message: `Failed to reload formulas: ${error.message}`
      };
    }
  });

  /**
   * Action pour recalculer une collection complète à la demande
   * Payload attendu: { collection, filter?, batchSize?, dryRun? }
   */
  action('realtime-calc.recalculate-collection', async ({ collection, filter = null, batchSize = 100, dryRun = false }, { schema, accountability }) => {
    try {
      if (!collection || typeof collection !== 'string') {
        throw new Error('Missing or invalid "collection"');
      }

      // Charger/configurer les formules si besoin
      if (Object.keys(formulaConfigs).length === 0) {
        await loadFormulasAndBuildGraphs();
      }
      if (!formulaConfigs[collection] || Object.keys(formulaConfigs[collection]).length === 0) {
        return { success: true, updated: 0, processed: 0, total: 0, message: `No formulas for collection ${collection}` };
      }

      const { ItemsService } = services;
      const itemsService = new ItemsService(collection, {
        database,
        schema: schema || (typeof getSchema === 'function' ? await getSchema() : undefined),
        accountability
      });

      let offset = 0;
      const limit = Math.max(1, Math.min(500, Number(batchSize) || 100));
      let processed = 0;
      let updated = 0;
      let total = 0;

      // Première requête pour compter (si possible)
      try {
        const meta = await itemsService.readByQuery({ filter: filter || {}, limit: 0, meta: 'total_count' });
        if (meta && meta.meta && typeof meta.meta.total_count === 'number') {
          total = meta.meta.total_count;
        }
      } catch {
        // Certains drivers ne renvoient pas meta, on continue sans
      }

      while (true) {
        const res = await itemsService.readByQuery({
          filter: filter || {},
          limit,
          offset,
        });
        const chunk = Array.isArray(res) ? res : (res?.data || []);
        if (!chunk || chunk.length === 0) break;

        for (const item of chunk) {
          const { updates, hasChanges } = calculateFields(collection, item);
          processed++;
          if (hasChanges && Object.keys(updates).length > 0) {
            if (!dryRun) {
              try {
                await itemsService.updateOne(item.id, updates);
                updated++;
              } catch (e) {
                logger.error(`[RealTime-Calc] Error updating ${collection}.${item.id} during recalc:`, e?.message || e);
              }
            } else {
              updated++; // Compter comme potentiellement updatable
            }
          }
        }

        offset += chunk.length;
        if (chunk.length < limit) break; // dernière page
      }

      return {
        success: true,
        collection,
        processed,
        updated,
        total,
        dryRun,
        message: dryRun
          ? `Dry-run: ${updated} item(s) would be updated on ${processed} processed.`
          : `Updated ${updated} item(s) on ${processed} processed.`
      };

    } catch (error) {
      logger.error('[RealTime-Calc] ❌ Failed recalculate-collection:', error?.message || error);
      return { success: false, error: error?.message || String(error) };
    }
  });

  /**
   * Action pour voir la configuration actuelle
   */
  action('realtime-calc.get-config', async () => {
    const stats = {};
    
    for (const [collection, formulas] of Object.entries(formulaConfigs)) {
      stats[collection] = {
        formulaCount: Object.keys(formulas).length,
        fields: Object.keys(formulas),
        hasCircularDeps: dependencyGraphs[collection]?.cycles.length > 0,
        calculationOrder: dependencyGraphs[collection]?.order || []
      };
    }
    
    return {
      collections: Object.keys(formulaConfigs).length,
      stats: stats
    };
  });

  // Initialisation au démarrage
  (async () => {
    const success = await loadFormulasAndBuildGraphs();
    
    if (success) {
      const totalFormulas = Object.values(formulaConfigs).reduce(
        (sum, config) => sum + Object.keys(config).length, 
        0
      );
      
      logger.info('[RealTime-Calc Extension] Loaded successfully');
      logger.info(`[RealTime-Calc] Monitoring ${Object.keys(formulaConfigs).length} collection(s) with ${totalFormulas} formula(s)`);
    } else {
      logger.warn('[RealTime-Calc Extension] Started but no formulas loaded (table may not exist yet)');
    }
  })();
};
