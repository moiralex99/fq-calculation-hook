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

  // ============================================================================
  // UTILITY ROUTES
  // ============================================================================

  // POST /realtime-calc/clear-cache - Clear formula cache
  router.post('/clear-cache', async (req, res) => {
    try {
      logger.info('[RealTime-Calc Endpoint] Clearing formula cache...');
      
      // Trigger cache clear via event system
      const result = await emitter.emitAction('realtime-calc.clear-cache', {});
      
      res.json({
        success: true,
        message: 'Formula cache cleared',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('[RealTime-Calc Endpoint] Error clearing cache:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // POST /realtime-calc/test-formula - Test a formula with sample data
  router.post('/test-formula', async (req, res) => {
    try {
      const { formula, sampleData = {} } = req.body;
      
      if (!formula) {
        return res.status(400).json({
          success: false,
          error: 'Formula is required'
        });
      }
      
      logger.info(`[RealTime-Calc Endpoint] Testing formula: ${formula}`);
      
      // Use DSLEvaluator to validate and evaluate
      const dslEvaluator = new DSLEvaluator(logger);
      
      try {
        const result = dslEvaluator.evaluate(formula, sampleData);
        const fields = dslEvaluator.extractFields(formula);
        
        // Check if formula is local (no relational operations)
        const relationalOps = ['LOOKUP', 'PARENT', 'CHILDREN', 'RELATED', 'SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'COUNT_DISTINCT'];
        const isLocal = !relationalOps.some(op => {
          const pattern = new RegExp(`\\b${op}\\s*\\(`, 'i');
          return pattern.test(formula);
        });
        
        res.json({
          valid: true,
          result,
          fields,
          isLocal,
          message: isLocal 
            ? `Formula is valid (local). Result: ${result}`
            : `Formula is valid but uses relational operations. Result: ${result}`
        });
      } catch (evalError) {
        res.json({
          valid: false,
          error: evalError.message,
          message: `Formula error: ${evalError.message}`
        });
      }
    } catch (error) {
      logger.error('[RealTime-Calc Endpoint] Error in test-formula:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // POST /realtime-calc/calculate - Calculate fields without DB write
  router.post('/calculate', async (req, res) => {
    try {
      const { collection, data, fields = null } = req.body;
      
      if (!collection || !data) {
        return res.status(400).json({
          success: false,
          error: 'Collection and data are required'
        });
      }
      
      logger.info(`[RealTime-Calc Endpoint] Calculating fields for collection: ${collection}`);
      
      // Load formulas and build dependencies
      const formulaLoader = new FormulaLoader(database, logger);
      const dependencyGraph = new DependencyGraph(logger);
      const dslEvaluator = new DSLEvaluator(logger);
      
      const formulaConfigs = await formulaLoader.loadLocalFormulas();
      const config = formulaConfigs[collection];
      
      if (!config || Object.keys(config).length === 0) {
        return res.json({
          success: true,
          updates: {},
          message: `No formulas for collection ${collection}`
        });
      }
      
      // Build dependency graph and get calculation order
      const analysis = dependencyGraph.analyze(config);
      let calculationOrder = analysis?.order || Object.keys(config);
      
      // Filter by requested fields if specified
      if (Array.isArray(fields) && fields.length > 0) {
        const targetSet = dependencyGraph.collectDependencyClosure(
          analysis?.graph,
          fields
        );
        calculationOrder = calculationOrder.filter(field => targetSet.has(field));
      }
      
      // Calculate fields with propagation
      const updates = {};
      const workingData = { ...data };
      
      for (const fieldName of calculationOrder) {
        const formulaConfig = config[fieldName];
        try {
          const context = { ...workingData, ...updates };
          const newValue = dslEvaluator.evaluate(formulaConfig.formula, context);
          updates[fieldName] = newValue;
          workingData[fieldName] = newValue;
        } catch (error) {
          logger.error(`[RealTime-Calc Endpoint] Error calculating ${collection}.${fieldName}:`, error.message);
          updates[fieldName] = null;
        }
      }
      
      res.json({
        success: true,
        updates,
        message: `Calculated ${Object.keys(updates).length} field(s)`
      });
    } catch (error) {
      logger.error('[RealTime-Calc Endpoint] Error calculating fields:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // GET /realtime-calc - Documentation endpoint
  router.get('/', (req, res) => {
    res.json({
      success: true,
      message: 'Directus Real-Time Calculator',
      version: '1.0.0',
      endpoints: {
        'GET /': 'This help message',
        'GET /status': 'Get system status and formula count',
        'POST /reload': 'Reload formulas from database',
        'POST /test-formula': 'Test a formula with sample data',
        'POST /calculate': 'Calculate fields without DB write (preview)',
        'POST /clear-cache': 'Clear formula cache',
        'POST /utils/realtime-calc.reload-formulas': 'Reload formulas (Flow-compatible)',
        'POST /utils/realtime-calc.get-config': 'Get configuration (Flow-compatible)',
        'POST /utils/realtime-calc.recalculate-collection': 'Batch recalculate collection'
      },
      examples: {
        testFormula: {
          endpoint: 'POST /realtime-calc/test-formula',
          body: {
            formula: '{{prix_ht}} * (1 + {{tva_rate}})',
            sampleData: { prix_ht: 100, tva_rate: 0.2 }
          },
          description: 'Test a formula before saving it'
        },
        calculate: {
          endpoint: 'POST /realtime-calc/calculate',
          body: {
            collection: 'products',
            data: { prix_ht: 100, tva_rate: 0.2 },
            fields: ['prix_ttc']
          },
          description: 'Preview calculated values without saving'
        },
        recalculate: {
          endpoint: 'POST /realtime-calc/utils/realtime-calc.recalculate-collection',
          body: {
            collection: 'products',
            filter: { status: { _eq: 'published' } },
            batchSize: 100,
            dryRun: true
          },
          description: 'Batch recalculate items in a collection'
        },
        clearCache: {
          endpoint: 'POST /realtime-calc/clear-cache',
          body: {},
          description: 'Clear formula cache manually'
        }
      },
      note: 'Real-time calculation with 60+ DSL functions including math, string, date, and conditional operations'
    });
  });
};
