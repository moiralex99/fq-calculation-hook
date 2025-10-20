/**
 * Webhook Channel
 * Envoi de notifications vers webhooks externes (Slack, Teams, Discord, etc.)
 */

import { TemplateRenderer } from '../lib/template-renderer.js';

export class WebhookChannel {
  constructor(config, logger) {
    this.logger = logger;
    this.renderer = new TemplateRenderer(logger);
    this.timeout = config.timeout || 10000; // 10s par défaut
  }

  /**
   * Envoie un webhook
   */
  async send(template, recipient, variables, options = {}) {
    const { testMode = false } = options;

    try {
      // Récupérer le config webhook du template
      const webhookConfig = template.webhook_config || {};
      
      if (!webhookConfig.url && !recipient.webhook_url) {
        throw new Error('No webhook URL configured');
      }

      const url = recipient.webhook_url || webhookConfig.url;

      // Render le payload
      const payload = this.buildPayload(webhookConfig, template, variables);

      // En test mode, on ne fait pas l'appel
      if (testMode) {
        this.logger?.info(`[WebhookChannel] Test mode - would send webhook to ${url}`);
        return {
          success: true,
          testMode: true,
          channel: 'webhook',
          subject: payload.title || template.name,
          body_preview: JSON.stringify(payload).substring(0, 200),
          recipient: url
        };
      }

      // Envoi du webhook
      const response = await fetch(url, {
        method: webhookConfig.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(webhookConfig.headers || {})
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
      }

      this.logger?.info(`[WebhookChannel] Webhook sent to ${url}: ${response.status}`);

      return {
        success: true,
        channel: 'webhook',
        subject: payload.title || template.name,
        body_preview: JSON.stringify(payload).substring(0, 200),
        recipient: url,
        external_id: response.headers.get('x-request-id'),
        provider: this.detectProvider(url)
      };

    } catch (error) {
      this.logger?.error(`[WebhookChannel] Error sending webhook:`, error);
      
      return {
        success: false,
        channel: 'webhook',
        error: error.message,
        recipient: recipient.webhook_url || 'unknown'
      };
    }
  }

  /**
   * Construit le payload selon le type de webhook
   */
  buildPayload(config, template, variables) {
    const provider = config.provider || this.detectProvider(config.url);

    // Render les champs
    const title = this.renderer.render(config.title || template.name, variables);
    const text = this.renderer.render(config.text || template.content, variables);

    switch (provider) {
      case 'slack':
        return this.buildSlackPayload(title, text, variables, config);
      
      case 'teams':
        return this.buildTeamsPayload(title, text, variables, config);
      
      case 'discord':
        return this.buildDiscordPayload(title, text, variables, config);
      
      default:
        // Generic webhook
        return {
          title,
          text,
          timestamp: new Date().toISOString(),
          data: variables,
          ...(config.custom_payload || {})
        };
    }
  }

  /**
   * Payload Slack
   */
  buildSlackPayload(title, text, variables, config) {
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: title
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: text
        }
      }
    ];

    // Ajouter des champs si configuré
    if (config.fields) {
      const fields = config.fields.map(field => ({
        type: 'mrkdwn',
        text: `*${field.label}:*\n${this.renderer.render(field.value, variables)}`
      }));

      blocks.push({
        type: 'section',
        fields
      });
    }

    return {
      blocks,
      username: config.username || 'FlowQuartz',
      icon_emoji: config.icon || ':bell:'
    };
  }

  /**
   * Payload Microsoft Teams
   */
  buildTeamsPayload(title, text, variables, config) {
    return {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: title,
      themeColor: config.color || '0078D4',
      title: title,
      text: text,
      sections: config.sections || []
    };
  }

  /**
   * Payload Discord
   */
  buildDiscordPayload(title, text, variables, config) {
    return {
      embeds: [{
        title: title,
        description: text,
        color: parseInt(config.color || '5865F2', 16),
        timestamp: new Date().toISOString(),
        footer: {
          text: 'FlowQuartz Notifications'
        }
      }]
    };
  }

  /**
   * Détecte le provider depuis l'URL
   */
  detectProvider(url) {
    if (!url) return 'generic';
    
    if (url.includes('slack.com')) return 'slack';
    if (url.includes('office.com') || url.includes('outlook.com')) return 'teams';
    if (url.includes('discord.com')) return 'discord';
    
    return 'generic';
  }
}
