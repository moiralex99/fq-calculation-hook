/**
 * Smart Notifications Operation - API Entrypoint
 * Backend logic for sending notifications
 */

export default {
  id: 'smart-notification-send',
  
  async handler({ rule_id, collection, item_id, override_recipient, use_queue, priority }, { data, database, logger, services, emitter, getSchema, env }) {
    try {
      // Résoudre les valeurs dynamiques depuis $trigger
      const resolvedCollection = collection || data.$trigger?.collection;
      const resolvedItemId = item_id || data.$trigger?.key || data.$trigger?.payload?.id;

      if (!rule_id || !resolvedCollection || !resolvedItemId) {
        throw new Error('Missing required parameters: rule_id, collection, and item_id are required');
      }

      logger.info(`[SmartNotificationOp] Sending notification: rule=${rule_id}, collection=${resolvedCollection}, item=${resolvedItemId}`);

      // Mode queue (par défaut)
      if (use_queue !== false) {
        const { QueueManager } = await import('../lib/queue-manager.js');
        const queueManager = new QueueManager({ database, logger });

        const queueId = await queueManager.enqueue({
          rule_id,
          collection: resolvedCollection,
          item_id: resolvedItemId,
          override_recipient,
          priority: priority || 'normal'
        });

        return {
          success: true,
          queued: true,
          queue_id: queueId,
          rule_id,
          collection: resolvedCollection,
          item_id: resolvedItemId
        };

      } else {
        // Mode immédiat
        const { NotificationEngine } = await import('../lib/notification-engine.js');
        const { EmailChannel } = await import('../channels/email.js');
        const { InAppChannel } = await import('../channels/in-app.js');
        const { WebhookChannel } = await import('../channels/webhook.js');

        const engine = new NotificationEngine({
          services,
          database,
          logger,
          emitter,
          getSchema
        });

        // Enregistrer les canaux
        const emailConfig = {
          smtp_host: env.EMAIL_HOST,
          smtp_port: env.EMAIL_PORT,
          smtp_secure: env.EMAIL_SECURE === 'true',
          smtp_auth: env.EMAIL_USER && env.EMAIL_PASSWORD,
          smtp_user: env.EMAIL_USER,
          smtp_pass: env.EMAIL_PASSWORD,
          default_from: env.EMAIL_FROM
        };

        engine.registerChannel('email', new EmailChannel(emailConfig, logger));
        engine.registerChannel('in-app', new InAppChannel(services, logger));
        engine.registerChannel('webhook', new WebhookChannel(logger));

        const result = await engine.processNotification({
          rule_id,
          collection: resolvedCollection,
          item_id: resolvedItemId,
          override_recipient
        });

        return result;
      }

    } catch (error) {
      logger.error('[SmartNotificationOp] Error:', error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }
};
