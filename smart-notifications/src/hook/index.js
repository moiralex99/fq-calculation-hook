/**
 * Smart Notifications Hook
 * Point d'entrée principal de l'extension
 */

import { NotificationEngine } from '../lib/notification-engine.js';
import { ChannelManager } from '../lib/channel-manager.js';
import { QueueManager } from '../lib/queue-manager.js';

import { EmailChannel } from '../channels/email.js';
import { InAppChannel } from '../channels/in-app.js';
import { WebhookChannel } from '../channels/webhook.js';

export default ({ filter, action, init, schedule }, { services, database, logger, emitter, getSchema, env }) => {
  let engine, queueManager, channelManager;

  /**
   * Initialisation au démarrage de Directus
   */
  init('app.before', async () => {
    logger.info('[SmartNotifications] Initializing...');

    try {
      // Créer l'engine principal
      engine = new NotificationEngine({
        services,
        database,
        logger,
        emitter,
        getSchema
      });

      // Créer le channel manager
      channelManager = new ChannelManager(logger);

      // Charger la config email depuis .env
      const emailConfig = {
        smtp_host: env.EMAIL_HOST,
        smtp_port: env.EMAIL_PORT,
        smtp_secure: env.EMAIL_SECURE === 'true',
        smtp_auth: env.EMAIL_USER && env.EMAIL_PASSWORD,
        smtp_user: env.EMAIL_USER,
        smtp_pass: env.EMAIL_PASSWORD,
        default_from: env.EMAIL_FROM
      };

      // Enregistrer les canaux
      const emailChannel = new EmailChannel(emailConfig, logger);
      const inAppChannel = new InAppChannel({ services, database, getSchema }, logger);
      const webhookChannel = new WebhookChannel({ timeout: 10000 }, logger);

      engine.registerChannel('email', emailChannel);
      engine.registerChannel('in-app', inAppChannel);
      engine.registerChannel('webhook', webhookChannel);

      // Créer le queue manager
      queueManager = new QueueManager(database, logger, engine);

      // Vérifier la config SMTP (non bloquant)
      emailChannel.verify().catch(err => {
        logger.warn('[SmartNotifications] SMTP verification failed:', err.message);
      });

      logger.info('[SmartNotifications] Initialized successfully');
    } catch (error) {
      logger.error('[SmartNotifications] Initialization error:', error);
    }
  });

  /**
   * Monitoring des échéances (cron toutes les heures)
   */
  schedule('0 * * * *', async () => {
    if (!engine) return;

    logger.info('[SmartNotifications] Running deadline monitoring...');

    try {
      // Charger toutes les règles actives avec trigger_type = 'deadline'
      const deadlineRules = await database('quartz_notification_rules')
        .where('status', 'published')
        .where('trigger_type', 'deadline')
        .where('enabled', true);

      logger.info(`[SmartNotifications] Found ${deadlineRules.length} deadline rules`);

      for (const rule of deadlineRules) {
        await processDeadlineRule(rule);
      }
    } catch (error) {
      logger.error('[SmartNotifications] Error in deadline monitoring:', error);
    }
  });

  /**
   * Process la queue (cron toutes les 5 minutes)
   */
  schedule('*/5 * * * *', async () => {
    if (!queueManager) return;

    logger.info('[SmartNotifications] Processing notification queue...');

    try {
      await queueManager.processQueue(20); // Batch de 20
    } catch (error) {
      logger.error('[SmartNotifications] Error processing queue:', error);
    }
  });

  /**
   * Hook sur les updates d'items (pour rules avec trigger_type = 'field_change')
   */
  action('items.update', async (meta, context) => {
    if (!engine) return;

    const { collection, keys, payload } = meta;

    try {
      // Charger les règles qui surveillent cette collection
      const rules = await database('quartz_notification_rules')
        .where('status', 'published')
        .where('trigger_type', 'field_change')
        .where('enabled', true)
        .whereRaw('JSON_CONTAINS(collections, ?)', [JSON.stringify(collection)]);

      if (rules.length === 0) return;

      logger.info(`[SmartNotifications] Found ${rules.length} field_change rules for ${collection}`);

      // Process chaque item modifié
      for (const itemId of keys) {
        for (const rule of rules) {
          // Vérifier si un champ surveillé a changé
          if (rule.watch_fields) {
            const watchFields = JSON.parse(rule.watch_fields);
            const hasChangedField = watchFields.some(field => payload.hasOwnProperty(field));

            if (!hasChangedField) {
              continue; // Skip cette règle
            }
          }

          // Enqueue la notification
          await queueManager.enqueue(rule.id, collection, itemId, {
            priority: rule.priority,
            dedup_key: `${rule.id}-${collection}-${itemId}`
          });
        }
      }
    } catch (error) {
      logger.error('[SmartNotifications] Error in field_change hook:', error);
    }
  });

  /**
   * Hook sur les créations d'items (pour rules avec trigger_type = 'creation')
   */
  action('items.create', async (meta, context) => {
    if (!engine) return;

    const { collection, keys } = meta;

    try {
      // Charger les règles qui surveillent cette collection
      const rules = await database('quartz_notification_rules')
        .where('status', 'published')
        .where('trigger_type', 'creation')
        .where('enabled', true)
        .whereRaw('JSON_CONTAINS(collections, ?)', [JSON.stringify(collection)]);

      if (rules.length === 0) return;

      logger.info(`[SmartNotifications] Found ${rules.length} creation rules for ${collection}`);

      // Process chaque nouvel item
      for (const itemId of keys) {
        for (const rule of rules) {
          await queueManager.enqueue(rule.id, collection, itemId, {
            priority: rule.priority,
            dedup_key: `${rule.id}-${collection}-${itemId}`
          });
        }
      }
    } catch (error) {
      logger.error('[SmartNotifications] Error in creation hook:', error);
    }
  });

  /**
   * Process une règle de type deadline
   */
  async function processDeadlineRule(rule) {
    try {
      const config = rule.deadline_config;
      
      if (!config || !config.date_field || !config.threshold_days) {
        logger.warn(`[SmartNotifications] Invalid deadline config for rule ${rule.id}`);
        return;
      }

      const collections = JSON.parse(rule.collections || '[]');

      for (const collection of collections) {
        // Chercher les items qui approchent de l'échéance
        const threshold = new Date();
        threshold.setDate(threshold.getDate() + config.threshold_days);

        const items = await database(collection)
          .where(config.date_field, '<=', threshold)
          .where(config.date_field, '>=', new Date());

        logger.info(`[SmartNotifications] Found ${items.length} items approaching deadline in ${collection}`);

        for (const item of items) {
          await queueManager.enqueue(rule.id, collection, item.id, {
            priority: rule.priority,
            dedup_key: `${rule.id}-${collection}-${item.id}-${config.date_field}`
          });
        }
      }
    } catch (error) {
      logger.error(`[SmartNotifications] Error processing deadline rule ${rule.id}:`, error);
    }
  }

  /**
   * Exposer l'engine pour l'endpoint
   */
  return {
    engine,
    queueManager,
    channelManager
  };
};
