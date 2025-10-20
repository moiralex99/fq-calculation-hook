/**
 * Smart Notifications Operation
 * Opération Directus Flow pour intégration simple
 */

export default {
  id: 'smart-notification-send',
  name: 'Send Smart Notification',
  icon: 'mail',
  description: 'Send a notification using a notification rule',
  overview: ({ rule_id, collection, item_id }) => [
    {
      label: 'Rule ID',
      text: rule_id || 'Not configured'
    },
    {
      label: 'Collection',
      text: collection || 'Current collection'
    },
    {
      label: 'Item ID',
      text: item_id || 'Current item'
    }
  ],
  options: [
    {
      field: 'rule_id',
      name: 'Notification Rule',
      type: 'integer',
      meta: {
        width: 'full',
        interface: 'select-dropdown-m2o',
        options: {
          template: '{{name}}',
          filter: {
            status: {
              _eq: 'published'
            }
          }
        },
        note: 'Select the notification rule to execute'
      },
      schema: {
        collection: 'quartz_notification_rules',
        field: 'id'
      }
    },
    {
      field: 'collection',
      name: 'Collection',
      type: 'string',
      meta: {
        width: 'half',
        interface: 'input',
        note: 'Leave empty to use the trigger collection',
        options: {
          placeholder: '$trigger.collection'
        }
      }
    },
    {
      field: 'item_id',
      name: 'Item ID',
      type: 'string',
      meta: {
        width: 'half',
        interface: 'input',
        note: 'Leave empty to use the trigger item',
        options: {
          placeholder: '$trigger.key'
        }
      }
    },
    {
      field: 'override_recipient',
      name: 'Override Recipient (Optional)',
      type: 'string',
      meta: {
        width: 'half',
        interface: 'input',
        note: 'Override the rule recipients with this email',
        options: {
          placeholder: 'user@example.com'
        }
      }
    },
    {
      field: 'use_queue',
      name: 'Use Queue',
      type: 'boolean',
      meta: {
        width: 'half',
        interface: 'boolean',
        note: 'Queue the notification for async processing (recommended)',
        options: {
          label: 'Queue notification instead of sending immediately'
        }
      },
      schema: {
        default_value: true
      }
    },
    {
      field: 'priority',
      name: 'Priority',
      type: 'string',
      meta: {
        width: 'half',
        interface: 'select-dropdown',
        options: {
          choices: [
            { text: 'High', value: 'high' },
            { text: 'Normal', value: 'normal' },
            { text: 'Low', value: 'low' }
          ]
        }
      },
      schema: {
        default_value: 'normal'
      }
    }
  ],

  async handler({ rule_id, collection, item_id, override_recipient, use_queue, priority }, { data, database, logger, services, emitter, getSchema, env }) {
    try {
      // Résoudre les valeurs dynamiques depuis $trigger
      const resolvedCollection = collection || data.$trigger?.collection;
      const resolvedItemId = item_id || data.$trigger?.key || data.$trigger?.payload?.id;

      if (!rule_id || !resolvedCollection || !resolvedItemId) {
        throw new Error('Missing required parameters: rule_id, collection, and item_id are required');
      }

      logger.info(`[SmartNotificationOp] Sending notification: rule=${rule_id}, collection=${resolvedCollection}, item=${resolvedItemId}`);

      if (use_queue !== false) {
        // Mode queue (défaut)
        const { QueueManager } = await import('../lib/queue-manager.js');
        const { NotificationEngine } = await import('../lib/notification-engine.js');

        // Créer un engine temporaire (à améliorer avec singleton)
        const engine = new NotificationEngine({
          services,
          database,
          logger,
          emitter,
          getSchema
        });

        const queueManager = new QueueManager(database, logger, engine);

        const queueId = await queueManager.enqueue(rule_id, resolvedCollection, resolvedItemId, {
          priority: priority || 'normal',
          dedup_key: `${rule_id}-${resolvedCollection}-${resolvedItemId}`
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
        engine.registerChannel('in-app', new InAppChannel({ services, database, getSchema }, logger));
        engine.registerChannel('webhook', new WebhookChannel({ timeout: 10000 }, logger));

        const result = await engine.processNotification(rule_id, resolvedCollection, resolvedItemId, {
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
