/**
 * Shared recalculation handler
 * Can be used by both hook actions and endpoint directly
 */

export async function createRecalculateHandler({ 
  services, 
  database, 
  logger, 
  getSchema,
  formulaConfigs,
  dependencyGraphs,
  calculateFields,
  dependencyGraph
}) {
  return async function handleRecalculateCollection(
    { collection, fields = null, filter: queryFilter = null, batchSize = 100, dryRun = false }, 
    { schema, accountability }
  ) {
    logger.info('[RealTime-Calc] recalculate-collection → start');
    logger.info(`[RealTime-Calc] Params: collection=${collection}, fields=${JSON.stringify(fields)}, batchSize=${batchSize}, dryRun=${dryRun}`);

    if (!collection || typeof collection !== 'string') {
      throw new Error('Missing or invalid "collection"');
    }

    logger.info(`[RealTime-Calc] formulaConfigs has ${Object.keys(formulaConfigs).length} collection(s)`);
    if (!formulaConfigs[collection] || Object.keys(formulaConfigs[collection]).length === 0) {
      logger.warn(`[RealTime-Calc] No local formulas for ${collection}`);
      return { success: true, updated: 0, processed: 0, total: 0, message: `No formulas for collection ${collection}` };
    }
    logger.info(`[RealTime-Calc] ${collection} has ${Object.keys(formulaConfigs[collection]).length} local formula(s)`);

    const normalizedFields = Array.isArray(fields)
      ? fields.map(f => (typeof f === 'string' ? f : String(f))).filter(Boolean)
      : typeof fields === 'string'
        ? [fields]
        : [];

    const availableCalculatedFields = Object.keys(formulaConfigs[collection]);
    let effectiveFieldsSet = null;
    if (normalizedFields.length > 0) {
      const analysis = dependencyGraphs[collection];
      effectiveFieldsSet = dependencyGraph.collectDependencyClosure(
        analysis?.graph,
        normalizedFields
      );

      if (!effectiveFieldsSet || effectiveFieldsSet.size === 0) {
        return {
          success: false,
          error: 'no_matching_fields',
          message: `None of the requested fields (${normalizedFields.join(', ')}) match local formulas for collection ${collection}.`
        };
      }

      const missing = normalizedFields.filter(f => !availableCalculatedFields.includes(f));
      if (missing.length > 0) {
        logger.warn(`[RealTime-Calc] Some requested fields are not local formulas for ${collection}: ${missing.join(', ')}`);
      }
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
      const meta = await itemsService.readByQuery({ filter: queryFilter || {}, limit: 0, meta: 'total_count' });
      if (meta && meta.meta && typeof meta.meta.total_count === 'number') {
        total = meta.meta.total_count;
      }
    } catch {
      // Certains drivers ne renvoient pas meta, on continue sans
    }

    logger.info(`[RealTime-Calc] Starting batch processing: total=${total}, limit=${limit}`);

    while (true) {
      const res = await itemsService.readByQuery({
        filter: queryFilter || {},
        limit,
        offset,
      });
      const chunk = Array.isArray(res) ? res : (res?.data || []);
      if (!chunk || chunk.length === 0) break;

      logger.info(`[RealTime-Calc] Processing batch: offset=${offset}, size=${chunk.length}`);

      for (const item of chunk) {
        const { updates, hasChanges } = calculateFields(collection, item, null, {
          targetFields: normalizedFields
        });
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

    const result = {
      success: true,
      collection,
      processed,
      updated,
      total,
      dryRun,
      fields: normalizedFields.length > 0
        ? Array.from(effectiveFieldsSet || new Set(normalizedFields))
        : availableCalculatedFields,
      message: dryRun
        ? `Dry-run: ${updated} item(s) would be updated on ${processed} processed.`
        : `Updated ${updated} item(s) on ${processed} processed.`
    };
    logger.info(`[RealTime-Calc] Recalculate → success: ${JSON.stringify(result)}`);
    return result;
  };
}
