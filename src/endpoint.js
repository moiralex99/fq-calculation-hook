/**
 * Endpoint HTTP pour gérer les formules de calcul en temps réel
 * Accessible via /realtime-calc/*
 */

import { createRecalculateHandler } from './recalc-handler.js';
import { FormulaLoader } from './formula-loader.js';
import { DependencyGraph } from './dependency-graph.js';
import { DSLEvaluator } from './dsl-parser.js';

export default (router, { services, database, logger, emitter, getSchema }) => {
  // POST /realtime-calc/reload - Recharger les formules
  router.post('/reload', async (req, res) => {
    try {
      logger.info('[RealTime-Calc Endpoint] Triggering formula reload...');
      
      // Déclencher l'action de reload via le système d'événements
      const result = await emitter.emitAction('realtime-calc.reload-formulas', {});
      
      res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('[RealTime-Calc Endpoint] Error reloading:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: `Failed to reload: ${error.message}`
      });
    }
  });

  // GET /realtime-calc/status - Statut du système
  router.get('/status', async (req, res) => {
    try {
      // Compter les formules dans la DB
      const formulas = await database('quartz_formulas')
        .where({ status: 'published' })
        .select('collection_cible', 'champ_cible', 'formula');
      
      const collections = [...new Set(formulas.map(f => f.collection_cible))];
      
      res.json({
        success: true,
        totalFormulas: formulas.length,
        collections: collections.length,
        collectionNames: collections,
        formulas: formulas,
        message: `Found ${formulas.length} published formula(s) across ${collections.length} collection(s)`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('[RealTime-Calc Endpoint] Error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Mirror /utils actions so Flows/clients peuvent utiliser le même schéma
  router.post('/utils/realtime-calc.reload-formulas', async (req, res) => {
    try {
      const result = await emitter.emitAction('realtime-calc.reload-formulas', {});
      res.json(result);
    } catch (error) {
      logger.error('[RealTime-Calc Endpoint] utils.reload-formulas error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/utils/realtime-calc.get-config', async (req, res) => {
    try {
      const result = await emitter.emitAction('realtime-calc.get-config', {});
      res.json(result);
    } catch (error) {
      logger.error('[RealTime-Calc Endpoint] utils.get-config error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/utils/realtime-calc.recalculate-collection', async (req, res) => {
    try {
      logger.info('[RealTime-Calc Endpoint] Requête recalculate-collection reçue');
      
      const { collection, fields = null, filter = null, batchSize = 100, dryRun = false } = req.body || {};
      logger.info(`[RealTime-Calc Endpoint] Paramètres: collection=${collection}, fields=${JSON.stringify(fields)}, batchSize=${batchSize}, dryRun=${dryRun}`);
      
      // Load formulas and build dependencies
      const formulaLoader = new FormulaLoader(database, logger);
      const dependencyGraph = new DependencyGraph(logger);
      const dslEvaluator = new DSLEvaluator(logger);
      
      logger.info('[RealTime-Calc Endpoint] Loading formulas...');
      const formulaConfigs = await formulaLoader.loadLocalFormulas();
      const dependencyGraphs = {};
      
      for (const [coll, formulas] of Object.entries(formulaConfigs)) {
        const analysis = dependencyGraph.analyze(formulas);
        dependencyGraphs[coll] = analysis;
      }
      
      const totalFormulas = Object.values(formulaConfigs).reduce(
        (sum, cfg) => sum + Object.keys(cfg).length, 
        0
      );
      logger.info(`[RealTime-Calc Endpoint] Loaded ${totalFormulas} formula(s) for ${Object.keys(formulaConfigs).length} collection(s)`);
      
      // Helper to calculate fields
      function calculateFields(collection, data, changedFields = null, options = {}) {
        const config = formulaConfigs[collection];
        if (!config || Object.keys(config).length === 0) {
          return { updates: {}, hasChanges: false };
        }
        
        const analysis = dependencyGraphs[collection];
        let calculationOrder = analysis?.order || Object.keys(config);
        const updates = {};
        let hasChanges = false;
        
        const { targetFields = null } = options;
        const normalizedTargets = Array.isArray(targetFields)
          ? targetFields.map(f => (typeof f === 'string' ? f : String(f))).filter(Boolean)
          : typeof targetFields === 'string' ? [targetFields] : [];
        
        let allowedTargets = null;
        if (normalizedTargets.length > 0) {
          allowedTargets = dependencyGraph.collectDependencyClosure(
            analysis?.graph,
            normalizedTargets
          );
        }
        
        if (changedFields && changedFields.length > 0 && analysis?.graph) {
          calculationOrder = dependencyGraph.optimizeCalculationOrder(
            analysis.graph,
            analysis.order || [],
            changedFields
          );
        }
        
        if (allowedTargets) {
          calculationOrder = calculationOrder.filter(field => allowedTargets.has(field));
        }
        
        for (const fieldName of calculationOrder) {
          const formulaConfig = config[fieldName];
          try {
            const context = { ...data, ...updates };
            const newValue = dslEvaluator.evaluate(formulaConfig.formula, context);
            const oldValue = data[fieldName];
            
            if (newValue !== oldValue) {
              updates[fieldName] = newValue;
              hasChanges = true;
            }
          } catch (error) {
            logger.error(`[RealTime-Calc Endpoint] Error calculating ${collection}.${fieldName}:`, error.message);
          }
        }
        
        return { updates, hasChanges };
      }
      
      // Create handler and execute
      logger.info('[RealTime-Calc Endpoint] Creating recalculation handler...');
      const handler = await createRecalculateHandler({
        services,
        database,
        logger,
        getSchema,
        formulaConfigs,
        dependencyGraphs,
        calculateFields,
        dependencyGraph
      });
      
      const schema = typeof getSchema === 'function' ? await getSchema() : undefined;
      const payload = { collection, fields, filter, batchSize, dryRun };
      const meta = { schema, accountability: req.accountability };
      
      logger.info('[RealTime-Calc Endpoint] Executing handler...');
      const result = await handler(payload, meta);
      
      logger.info(`[RealTime-Calc Endpoint] ✅ Result: ${JSON.stringify(result)}`);
      res.json(result);
    } catch (error) {
      logger.error('[RealTime-Calc Endpoint] ❌ utils.recalculate-collection error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
};
