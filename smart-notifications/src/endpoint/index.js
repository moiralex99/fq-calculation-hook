/**
 * Smart Notifications Endpoint
 * API REST pour gérer les notifications manuellement
 */

export default (router, { services, database, logger, emitter, getSchema, env }) => {
  let engine, queueManager;

  /**
   * POST /notifications/send
   * Envoie une notification immédiatement
   */
  router.post('/send', async (req, res) => {
    try {
      const { rule_id, collection, item_id, override_recipient, test_mode } = req.body;

      if (!rule_id || !collection || !item_id) {
        return res.status(400).json({
          error: 'Missing required fields: rule_id, collection, item_id'
        });
      }

      // Importer l'engine depuis le hook (hacky mais fonctionne)
      if (!engine) {
        const { NotificationEngine } = await import('../lib/notification-engine.js');
        const { ChannelManager } = await import('../lib/channel-manager.js');
        const { EmailChannel } = await import('../channels/email.js');
        const { InAppChannel } = await import('../channels/in-app.js');
        const { WebhookChannel } = await import('../channels/webhook.js');

        engine = new NotificationEngine({
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
        engine.registerChannel('in-app', new InAppChannel({ services, database, getSchema }, logger));
        engine.registerChannel('webhook', new WebhookChannel({ timeout: 10000 }, logger));
      }

      const result = await engine.processNotification(rule_id, collection, item_id, {
        override_recipient,
        test_mode: test_mode || false
      });

      res.json(result);
    } catch (error) {
      logger.error('[NotificationEndpoint] Error in /send:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /notifications/enqueue
   * Ajoute une notification à la queue
   */
  router.post('/enqueue', async (req, res) => {
    try {
      const { rule_id, collection, item_id, priority, scheduled_at } = req.body;

      if (!rule_id || !collection || !item_id) {
        return res.status(400).json({
          error: 'Missing required fields: rule_id, collection, item_id'
        });
      }

      if (!queueManager) {
        const { QueueManager } = await import('../lib/queue-manager.js');
        queueManager = new QueueManager(database, logger, engine);
      }

      const queueId = await queueManager.enqueue(rule_id, collection, item_id, {
        priority: priority || 'normal',
        scheduled_at: scheduled_at ? new Date(scheduled_at) : null,
        dedup_key: `${rule_id}-${collection}-${item_id}`
      });

      res.json({
        success: true,
        queue_id: queueId,
        message: queueId ? 'Notification queued' : 'Notification already queued (deduplicated)'
      });
    } catch (error) {
      logger.error('[NotificationEndpoint] Error in /enqueue:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /notifications/logs
   * Récupère l'historique des notifications
   */
  router.get('/logs', async (req, res) => {
    try {
      const {
        rule_id,
        collection,
        item_id,
        recipient_email,
        status,
        channel,
        limit = 50,
        offset = 0
      } = req.query;

      let query = database('quartz_notification_logs')
        .select('*')
        .orderBy('sent_at', 'desc')
        .limit(parseInt(limit))
        .offset(parseInt(offset));

      if (rule_id) query = query.where('rule_id', rule_id);
      if (collection) query = query.where('collection', collection);
      if (item_id) query = query.where('item_id', item_id);
      if (recipient_email) query = query.where('recipient_email', recipient_email);
      if (status) query = query.where('status', status);
      if (channel) query = query.where('channel', channel);

      const logs = await query;

      // Compter le total
      let countQuery = database('quartz_notification_logs').count('* as total');
      if (rule_id) countQuery = countQuery.where('rule_id', rule_id);
      if (collection) countQuery = countQuery.where('collection', collection);
      if (item_id) countQuery = countQuery.where('item_id', item_id);
      if (recipient_email) countQuery = countQuery.where('recipient_email', recipient_email);
      if (status) countQuery = countQuery.where('status', status);
      if (channel) countQuery = countQuery.where('channel', channel);

      const [{ total }] = await countQuery;

      res.json({
        data: logs,
        meta: {
          total: parseInt(total),
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      });
    } catch (error) {
      logger.error('[NotificationEndpoint] Error in /logs:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /notifications/stats
   * Statistiques globales
   */
  router.get('/stats', async (req, res) => {
    try {
      const { rule_id, period = '7d' } = req.query;

      // Calculer la date de début selon la période
      const startDate = new Date();
      switch (period) {
        case '24h':
          startDate.setHours(startDate.getHours() - 24);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        default:
          startDate.setDate(startDate.getDate() - 7);
      }

      let query = database('quartz_notification_logs')
        .where('sent_at', '>=', startDate);

      if (rule_id) {
        query = query.where('rule_id', rule_id);
      }

      // Stats par status
      const byStatus = await query.clone()
        .select('status')
        .count('* as count')
        .groupBy('status');

      // Stats par canal
      const byChannel = await query.clone()
        .select('channel')
        .count('* as count')
        .groupBy('channel');

      // Stats par règle
      const byRule = await query.clone()
        .select('rule_id', 'rule_name')
        .count('* as count')
        .groupBy('rule_id', 'rule_name')
        .orderBy('count', 'desc')
        .limit(10);

      // Total
      const [{ total }] = await query.clone().count('* as total');

      // Stats de la queue
      const queueStats = await database('quartz_notification_queue')
        .select('status')
        .count('* as count')
        .groupBy('status');

      res.json({
        period,
        start_date: startDate.toISOString(),
        total: parseInt(total),
        by_status: byStatus.reduce((acc, s) => {
          acc[s.status] = parseInt(s.count);
          return acc;
        }, {}),
        by_channel: byChannel.reduce((acc, c) => {
          acc[c.channel] = parseInt(c.count);
          return acc;
        }, {}),
        top_rules: byRule,
        queue: queueStats.reduce((acc, q) => {
          acc[q.status] = parseInt(q.count);
          return acc;
        }, {})
      });
    } catch (error) {
      logger.error('[NotificationEndpoint] Error in /stats:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /notifications/test
   * Test une règle avec preview (dry run)
   */
  router.post('/test', async (req, res) => {
    try {
      const { rule_id, collection, item_id, recipient_email } = req.body;

      if (!rule_id || !collection || !item_id) {
        return res.status(400).json({
          error: 'Missing required fields: rule_id, collection, item_id'
        });
      }

      if (!engine) {
        const { NotificationEngine } = await import('../lib/notification-engine.js');
        const { EmailChannel } = await import('../channels/email.js');
        const { InAppChannel } = await import('../channels/in-app.js');
        const { WebhookChannel } = await import('../channels/webhook.js');

        engine = new NotificationEngine({
          services,
          database,
          logger,
          emitter,
          getSchema
        });

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
        engine.registerChannel('in-app', new InAppChannel({ services, database, getSchema }, logger));
        engine.registerChannel('webhook', new WebhookChannel({ timeout: 10000 }, logger));
      }

      const result = await engine.processNotification(rule_id, collection, item_id, {
        override_recipient: recipient_email,
        test_mode: true
      });

      res.json({
        ...result,
        preview: true,
        note: 'This is a dry run - no notification was actually sent'
      });
    } catch (error) {
      logger.error('[NotificationEndpoint] Error in /test:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /notifications/queue/stats
   * Stats de la queue
   */
  router.get('/queue/stats', async (req, res) => {
    try {
      if (!queueManager) {
        const { QueueManager } = await import('../lib/queue-manager.js');
        queueManager = new QueueManager(database, logger, engine);
      }

      const stats = await queueManager.getStats();

      res.json(stats);
    } catch (error) {
      logger.error('[NotificationEndpoint] Error in /queue/stats:', error);
      res.status(500).json({ error: error.message });
    }
  });
};
