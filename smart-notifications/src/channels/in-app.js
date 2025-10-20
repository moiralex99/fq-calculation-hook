/**
 * In-App Channel
 * Notifications internes via la collection directus_notifications
 */

import { TemplateRenderer } from '../lib/template-renderer.js';

export class InAppChannel {
  constructor({ services, database, getSchema }, logger) {
    this.services = services;
    this.database = database;
    this.getSchema = getSchema;
    this.logger = logger;
    this.renderer = new TemplateRenderer(logger);
  }

  /**
   * Envoie une notification in-app
   */
  async send(template, recipient, variables, options = {}) {
    const { testMode = false } = options;

    try {
      // Récupérer le config in-app du template
      const inAppConfig = template.in_app_config || {};
      
      // Render subject et message
      const subject = this.renderer.render(inAppConfig.subject || template.name, variables);
      const message = this.renderer.render(inAppConfig.message || template.content, variables);

      // En test mode, on ne crée pas la notification
      if (testMode) {
        this.logger?.info(`[InAppChannel] Test mode - would send in-app to user ${recipient.user_id}`);
        return {
          success: true,
          testMode: true,
          channel: 'in-app',
          subject,
          body_preview: message.substring(0, 200),
          recipient: recipient.email
        };
      }

      // Créer la notification dans directus_notifications
      const NotificationsService = this.services.NotificationsService;
      const service = new NotificationsService({
        schema: await this.getSchema(),
        knex: this.database
      });

      // Déterminer le recipient (user_id requis)
      if (!recipient.user_id) {
        throw new Error('user_id required for in-app notifications');
      }

      const notificationId = await service.createOne({
        recipient: recipient.user_id,
        sender: null, // Système
        subject: subject,
        message: message,
        status: 'inbox',
        collection: inAppConfig.collection || null,
        item: inAppConfig.item_id || null
      });

      this.logger?.info(`[InAppChannel] In-app notification created: ${notificationId} for user ${recipient.user_id}`);

      return {
        success: true,
        channel: 'in-app',
        subject,
        body_preview: message.substring(0, 200),
        recipient: recipient.email,
        external_id: notificationId,
        provider: 'directus'
      };

    } catch (error) {
      this.logger?.error(`[InAppChannel] Error sending in-app to user ${recipient.user_id}:`, error);
      
      return {
        success: false,
        channel: 'in-app',
        error: error.message,
        recipient: recipient.email
      };
    }
  }

  /**
   * Marque une notification comme lue
   */
  async markAsRead(notificationId, userId) {
    try {
      const NotificationsService = this.services.NotificationsService;
      const service = new NotificationsService({
        schema: await this.getSchema(),
        knex: this.database
      });

      await service.updateOne(notificationId, {
        status: 'archived'
      });

      this.logger?.info(`[InAppChannel] Notification ${notificationId} marked as read`);
      return true;
    } catch (error) {
      this.logger?.error(`[InAppChannel] Error marking notification as read:`, error);
      return false;
    }
  }
}
