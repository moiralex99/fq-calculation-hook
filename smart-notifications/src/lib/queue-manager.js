/**
 * Queue Manager
 * Gère la file d'attente des notifications (pour traitement asynchrone)
 */

export class QueueManager {
  constructor(database, logger, notificationEngine) {
    this.database = database;
    this.logger = logger;
    this.engine = notificationEngine;
    this.processing = false;
  }

  /**
   * Ajoute une notification à la queue
   */
  async enqueue(ruleId, collection, itemId, options = {}) {
    const {
      priority = 'normal',
      scheduled_at = null,
      dedup_key = null
    } = options;

    try {
      const [id] = await this.database('quartz_notification_queue').insert({
        rule_id: ruleId,
        collection,
        item_id: itemId,
        priority,
        scheduled_at: scheduled_at || new Date(),
        dedup_key,
        status: 'pending',
        attempts: 0,
        created_at: new Date()
      });

      this.logger?.info(`[QueueManager] Enqueued notification: id=${id}, rule=${ruleId}`);
      
      return id;
    } catch (error) {
      // Si c'est une erreur de duplicate key, c'est OK (déduplication)
      if (error.code === 'ER_DUP_ENTRY') {
        this.logger?.info(`[QueueManager] Notification already queued (dedup_key: ${dedup_key})`);
        return null;
      }
      
      throw error;
    }
  }

  /**
   * Process la queue (à appeler via cron ou worker)
   */
  async processQueue(batchSize = 10) {
    if (this.processing) {
      this.logger?.debug('[QueueManager] Already processing queue');
      return;
    }

    this.processing = true;
    this.logger?.info('[QueueManager] Starting queue processing');

    try {
      // Récupérer les notifications pending + prêtes
      const items = await this.database('quartz_notification_queue')
        .where('status', 'pending')
        .where('scheduled_at', '<=', new Date())
        .where('attempts', '<', 3) // Max 3 tentatives
        .orderByRaw('FIELD(priority, "high", "normal", "low")')
        .orderBy('scheduled_at', 'asc')
        .limit(batchSize);

      this.logger?.info(`[QueueManager] Found ${items.length} items to process`);

      for (const item of items) {
        await this.processItem(item);
      }

      // Nettoyer les vieux items (> 7 jours)
      await this.cleanup();

    } catch (error) {
      this.logger?.error('[QueueManager] Error processing queue:', error);
    } finally {
      this.processing = false;
    }
  }

  /**
   * Process un item de la queue
   */
  async processItem(item) {
    this.logger?.info(`[QueueManager] Processing queue item ${item.id}`);

    try {
      // Marquer comme processing
      await this.database('quartz_notification_queue')
        .where('id', item.id)
        .update({
          status: 'processing',
          started_at: new Date()
        });

      // Envoyer la notification
      const result = await this.engine.processNotification(
        item.rule_id,
        item.collection,
        item.item_id
      );

      if (result.success && !result.skipped) {
        // Succès
        await this.database('quartz_notification_queue')
          .where('id', item.id)
          .update({
            status: 'completed',
            completed_at: new Date()
          });

        this.logger?.info(`[QueueManager] Item ${item.id} completed successfully`);
      } else if (result.skipped) {
        // Skipped (conditions, dedup, etc.)
        await this.database('quartz_notification_queue')
          .where('id', item.id)
          .update({
            status: 'skipped',
            error_message: result.reason,
            completed_at: new Date()
          });
      } else {
        // Échec - retry
        await this.handleFailure(item, result.error);
      }

    } catch (error) {
      this.logger?.error(`[QueueManager] Error processing item ${item.id}:`, error);
      await this.handleFailure(item, error.message);
    }
  }

  /**
   * Gère l'échec d'un item
   */
  async handleFailure(item, errorMessage) {
    const newAttempts = item.attempts + 1;
    const maxAttempts = 3;

    if (newAttempts >= maxAttempts) {
      // Max attempts atteint -> failed
      await this.database('quartz_notification_queue')
        .where('id', item.id)
        .update({
          status: 'failed',
          attempts: newAttempts,
          error_message: errorMessage,
          completed_at: new Date()
        });

      this.logger?.error(`[QueueManager] Item ${item.id} failed after ${maxAttempts} attempts`);
    } else {
      // Retry avec backoff exponentiel
      const retryDelay = Math.pow(2, newAttempts) * 60 * 1000; // 2min, 4min, 8min...
      const nextSchedule = new Date(Date.now() + retryDelay);

      await this.database('quartz_notification_queue')
        .where('id', item.id)
        .update({
          status: 'pending',
          attempts: newAttempts,
          error_message: errorMessage,
          scheduled_at: nextSchedule
        });

      this.logger?.info(`[QueueManager] Item ${item.id} retry scheduled at ${nextSchedule.toISOString()}`);
    }
  }

  /**
   * Nettoie les vieux items
   */
  async cleanup() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);

    const deleted = await this.database('quartz_notification_queue')
      .whereIn('status', ['completed', 'failed', 'skipped'])
      .where('completed_at', '<', cutoff)
      .delete();

    if (deleted > 0) {
      this.logger?.info(`[QueueManager] Cleaned up ${deleted} old queue items`);
    }
  }

  /**
   * Récupère les stats de la queue
   */
  async getStats() {
    const stats = await this.database('quartz_notification_queue')
      .select('status')
      .count('* as count')
      .groupBy('status');

    const result = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      skipped: 0
    };

    stats.forEach(s => {
      result[s.status] = parseInt(s.count);
    });

    return result;
  }
}
