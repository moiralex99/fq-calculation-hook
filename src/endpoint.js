/**
 * Endpoint HTTP pour gérer les formules de calcul en temps réel
 * Accessible via /realtime-calc/*
 */

export default (router, { services, database, logger, emitter }) => {
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
      const { collection, filter = null, batchSize = 100, dryRun = false } = req.body || {};
      const result = await emitter.emitAction('realtime-calc.recalculate-collection', {
        collection,
        filter,
        batchSize,
        dryRun,
      });
      res.json(result);
    } catch (error) {
      logger.error('[RealTime-Calc Endpoint] utils.recalculate-collection error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
};
