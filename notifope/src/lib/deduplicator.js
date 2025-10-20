/**
 * Deduplicator
 * Gère la déduplication des notifications pour éviter les envois répétés
 */

import crypto from 'crypto';

export class Deduplicator {
  constructor(database, logger) {
    this.database = database;
    this.logger = logger;
  }

  /**
   * Filtre les destinataires en fonction de la déduplication
   */
  async filterDuplicates(ruleId, collection, itemId, recipients, frequencyConfig = {}) {
    const {
      enable_dedup = true,
      dedup_window_hours = 24,
      max_per_day = null,
      max_per_week = null
    } = frequencyConfig || {};

    if (!enable_dedup) {
      return recipients;
    }

    const filteredRecipients = [];

    for (const recipient of recipients) {
      const dedupKey = this.generateDedupKey(ruleId, collection, itemId, recipient.email);
      
      // Vérifier si déjà envoyé récemment
      const recentSent = await this.checkRecentSent(dedupKey, dedup_window_hours);
      
      if (recentSent) {
        this.logger?.info(`[Deduplicator] Skipping ${recipient.email} - already sent within ${dedup_window_hours}h`);
        continue;
      }

      // Vérifier les limites quotidiennes/hebdomadaires
      if (max_per_day) {
        const dailyCount = await this.getDailyCount(ruleId, recipient.email);
        if (dailyCount >= max_per_day) {
          this.logger?.info(`[Deduplicator] Skipping ${recipient.email} - daily limit reached (${max_per_day})`);
          continue;
        }
      }

      if (max_per_week) {
        const weeklyCount = await this.getWeeklyCount(ruleId, recipient.email);
        if (weeklyCount >= max_per_week) {
          this.logger?.info(`[Deduplicator] Skipping ${recipient.email} - weekly limit reached (${max_per_week})`);
          continue;
        }
      }

      filteredRecipients.push(recipient);
    }

    return filteredRecipients;
  }

  /**
   * Génère une clé de déduplication unique
   */
  generateDedupKey(ruleId, collection, itemId, recipientEmail) {
    const str = `${ruleId}-${collection}-${itemId}-${recipientEmail}`;
    return crypto.createHash('md5').update(str).digest('hex');
  }

  /**
   * Vérifie si une notification a été envoyée récemment
   */
  async checkRecentSent(dedupKey, windowHours) {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - windowHours);

    const count = await this.database('quartz_notification_logs')
      .where('dedup_key', dedupKey)
      .where('sent_at', '>=', cutoff)
      .count('* as count')
      .first();

    return count.count > 0;
  }

  /**
   * Compte les envois quotidiens pour un destinataire
   */
  async getDailyCount(ruleId, recipientEmail) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await this.database('quartz_notification_logs')
      .where('rule_id', ruleId)
      .where('recipient_email', recipientEmail)
      .where('sent_at', '>=', today)
      .count('* as count')
      .first();

    return result.count || 0;
  }

  /**
   * Compte les envois hebdomadaires pour un destinataire
   */
  async getWeeklyCount(ruleId, recipientEmail) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const result = await this.database('quartz_notification_logs')
      .where('rule_id', ruleId)
      .where('recipient_email', recipientEmail)
      .where('sent_at', '>=', weekAgo)
      .count('* as count')
      .first();

    return result.count || 0;
  }
}
