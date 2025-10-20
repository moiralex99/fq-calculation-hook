/**
 * Notification Engine
 * Moteur principal qui orchestre tout le système
 */

import { ConditionEvaluator } from './condition-evaluator.js';
import { RecipientResolver } from './recipient-resolver.js';
import { TemplateRenderer } from './template-renderer.js';
import { Deduplicator } from './deduplicator.js';

export class NotificationEngine {
  constructor({ services, database, logger, emitter, getSchema }) {
    this.services = services;
    this.database = database;
    this.logger = logger;
    this.emitter = emitter;
    this.getSchema = getSchema;

    // Initialize components
    this.conditionEvaluator = new ConditionEvaluator(logger);
    this.recipientResolver = new RecipientResolver(services, database, logger);
    this.templateRenderer = new TemplateRenderer(logger);
    this.deduplicator = new Deduplicator(database, logger);
    
    // Channel registry
    this.channels = {};
  }

  /**
   * Enregistre un canal de notification
   */
  registerChannel(name, channelInstance) {
    this.channels[name] = channelInstance;
    this.logger?.info(`[NotificationEngine] Registered channel: ${name}`);
  }

  /**
   * Traite une notification selon une règle
   * @param {number} ruleId - ID de la règle
   * @param {string} collection - Collection source
   * @param {string|number} itemId - ID de l'item
   * @param {Object} options - Options: { override_recipient, test_mode }
   * @returns {Promise<Object>} - Résultat de l'envoi
   */
  async processNotification(ruleId, collection, itemId, options = {}) {
    const startTime = Date.now();
    this.logger?.info(`[NotificationEngine] Processing notification: rule=${ruleId}, collection=${collection}, item=${itemId}`);

    try {
      // 1. Charger la règle
      const rule = await this.loadRule(ruleId);
      if (!rule) {
        throw new Error(`Rule ${ruleId} not found`);
      }

      if (rule.status !== 'published') {
        throw new Error(`Rule ${ruleId} is not published (status: ${rule.status})`);
      }

      // 2. Charger l'item source
      const item = await this.loadItem(collection, itemId);
      if (!item) {
        throw new Error(`Item ${itemId} not found in ${collection}`);
      }

      // 2.5 Préparer les variables AVANT d'évaluer les conditions
      const variables = this.prepareVariables(item, collection);

      // 3. Évaluer les conditions
      if (rule.conditions) {
        const conditionsMet = this.conditionEvaluator.evaluate(rule.conditions, variables);
        if (!conditionsMet) {
          this.logger?.info(`[NotificationEngine] Conditions not met for rule ${ruleId}`);
          return {
            success: true,
            skipped: true,
            reason: 'conditions_not_met',
            rule_id: ruleId
          };
        }
      }

      // 4. Résoudre les destinataires
      let recipients = [];
      
      if (options.override_recipient) {
        recipients = [{ email: options.override_recipient, user_id: null, name: options.override_recipient }];
      } else {
        recipients = await this.recipientResolver.resolve(
          rule.recipient_config,
          item,
          collection
        );
      }

      if (recipients.length === 0) {
        this.logger?.warn(`[NotificationEngine] No recipients found for rule ${ruleId}`);
        return {
          success: false,
          error: 'no_recipients',
          rule_id: ruleId
        };
      }

      // 5. Vérifier la déduplication
      if (!options.test_mode && !options.skip_dedup) {
        recipients = await this.deduplicator.filterDuplicates(
          ruleId,
          collection,
          itemId,
          recipients,
          rule.frequency_config
        );

        if (recipients.length === 0) {
          this.logger?.info(`[NotificationEngine] All recipients filtered by deduplication`);
          return {
            success: true,
            skipped: true,
            reason: 'deduplicated',
            rule_id: ruleId
          };
        }
      }

      // 6. Charger le template
      const template = await this.loadTemplate(rule.template_id);
      if (!template) {
        throw new Error(`Template ${rule.template_id} not found`);
      }

      // 7. Les variables sont déjà préparées plus haut

      // 8. Envoyer via chaque canal
      const channels = rule.channels || ['email'];
      const results = [];

      for (const channelName of channels) {
        for (const recipient of recipients) {
          try {
            const result = await this.sendViaChannel(
              channelName,
              rule,
              template,
              recipient,
              variables,
              options.test_mode
            );

            results.push({
              channel: channelName,
              recipient: recipient.email,
              status: result.success ? 'sent' : 'failed',
              ...result
            });

            // Log dans la DB (sauf en test mode)
            if (!options.test_mode) {
              await this.logNotification({
                rule_id: ruleId,
                rule_name: rule.name,
                template_id: template.id,
                template_code: template.code,
                collection,
                item_id: itemId,
                recipient_email: recipient.email,
                recipient_user_id: recipient.user_id,
                recipient_name: recipient.name,
                channel: channelName,
                status: result.success ? 'sent' : 'failed',
                subject: result.subject,
                body_preview: result.body_preview,
                variables_used: variables,
                error_message: result.error,
                external_id: result.external_id,
                provider: result.provider
              });
            }
          } catch (error) {
            this.logger?.error(`[NotificationEngine] Error sending via ${channelName}:`, error);
            results.push({
              channel: channelName,
              recipient: recipient.email,
              status: 'failed',
              error: error.message
            });
          }
        }
      }

      // 9. Mettre à jour les stats de la règle
      if (!options.test_mode) {
        await this.updateRuleStats(ruleId, results);
      }

      const duration = Date.now() - startTime;
      this.logger?.info(`[NotificationEngine] Notification processed in ${duration}ms: ${results.length} sent`);

      return {
        success: true,
        rule_id: ruleId,
        rule_name: rule.name,
        recipients_count: recipients.length,
        results,
        duration_ms: duration
      };

    } catch (error) {
      this.logger?.error(`[NotificationEngine] Error processing notification:`, error);
      return {
        success: false,
        rule_id: ruleId,
        error: error.message
      };
    }
  }

  /**
   * Envoie une notification via un canal spécifique
   */
  async sendViaChannel(channelName, rule, template, recipient, variables, testMode = false) {
    const channel = this.channels[channelName];
    
    if (!channel) {
      throw new Error(`Channel ${channelName} not registered`);
    }

    // Enrichir les variables avec le destinataire
    const enrichedVariables = {
      ...variables,
      recipient: recipient,
      recipient_name: recipient.name,
      recipient_email: recipient.email
    };

    return await channel.send(template, recipient, enrichedVariables, {
      testMode,
      priority: rule.priority
    });
  }

  /**
   * Charge une règle depuis la DB
   */
  async loadRule(ruleId) {
    return await this.database('quartz_notification_rules')
      .where('id', ruleId)
      .first();
  }

  /**
   * Charge un template depuis la DB
   */
  async loadTemplate(templateId) {
    return await this.database('quartz_notification_templates')
      .where('id', templateId)
      .where('status', 'published')
      .first();
  }

  /**
   * Charge un item depuis une collection
   */
  async loadItem(collection, itemId) {
    try {
      const ItemsService = this.services.ItemsService;
      const service = new ItemsService(collection, {
        schema: await this.getSchema(),
        knex: this.database
      });

      return await service.readOne(itemId);
    } catch (error) {
      this.logger?.error(`[NotificationEngine] Error loading item:`, error);
      return null;
    }
  }

  /**
   * Prépare les variables pour le template
   */
  prepareVariables(item, collection) {
    // Calculer des variables dérivées
    const variables = { ...item };

    // Ajouter des helpers
    variables.collection = collection;

    // Calculer jours_restants si date_echeance existe
    if (item.date_echeance) {
      const deadline = new Date(item.date_echeance);
      const now = new Date();
      const diffDays = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
      variables.jours_restants = diffDays;
    }

    return variables;
  }

  /**
   * Log une notification dans la DB
   */
  async logNotification(logData) {
    try {
      await this.database('quartz_notification_logs').insert({
        ...logData,
        sent_at: logData.status === 'sent' ? new Date() : null,
        body_preview: logData.body_preview?.substring(0, 500)
      });
    } catch (error) {
      this.logger?.error(`[NotificationEngine] Error logging notification:`, error);
    }
  }

  /**
   * Met à jour les statistiques de la règle
   */
  async updateRuleStats(ruleId, results) {
    try {
      const success = results.filter(r => r.status === 'sent').length;
      const failed = results.filter(r => r.status === 'failed').length;

      await this.database('quartz_notification_rules')
        .where('id', ruleId)
        .increment('total_sent', results.length)
        .increment('total_success', success)
        .increment('total_failed', failed)
        .update({
          last_triggered_at: new Date(),
          last_success_at: success > 0 ? new Date() : undefined
        });
    } catch (error) {
      this.logger?.error(`[NotificationEngine] Error updating rule stats:`, error);
    }
  }
}
