/**
 * Email Channel
 * Envoi de notifications par email via Nodemailer
 */

import nodemailer from 'nodemailer';
import { TemplateRenderer } from '../lib/template-renderer.js';

export class EmailChannel {
  constructor(config, logger) {
    this.logger = logger;
    this.renderer = new TemplateRenderer(logger);
    
    // Configuration du transporteur SMTP
    this.transporter = nodemailer.createTransport({
      host: config.smtp_host || process.env.EMAIL_HOST || 'localhost',
      port: config.smtp_port || process.env.EMAIL_PORT || 587,
      secure: config.smtp_secure || false,
      auth: config.smtp_auth ? {
        user: config.smtp_user || process.env.EMAIL_USER,
        pass: config.smtp_pass || process.env.EMAIL_PASSWORD
      } : null
    });

    this.defaultFrom = config.default_from || process.env.EMAIL_FROM || 'noreply@flowquartz.com';
  }

  /**
   * Envoie un email
   */
  async send(template, recipient, variables, options = {}) {
    const { testMode = false, priority = 'normal' } = options;

    try {
      // Récupérer le config email du template
      const emailConfig = template.email_config || {};
      
      // Render subject et body
      const subject = this.renderer.render(emailConfig.subject || template.name, variables);
      const body = this.renderer.render(emailConfig.body || template.content, variables);

      // Préparer le message
      const mailOptions = {
        from: emailConfig.from || this.defaultFrom,
        to: recipient.email,
        subject: subject,
        html: this.wrapHtml(body, emailConfig.style),
        text: this.stripHtml(body),
        priority: priority === 'high' ? 'high' : 'normal',
        headers: {
          'X-Notification-Rule': template.code,
          'X-Test-Mode': testMode ? 'true' : 'false'
        }
      };

      // Si CC/BCC configurés
      if (emailConfig.cc) {
        mailOptions.cc = emailConfig.cc;
      }
      if (emailConfig.bcc) {
        mailOptions.bcc = emailConfig.bcc;
      }

      // En test mode, on ne fait qu'une preview
      if (testMode) {
        this.logger?.info(`[EmailChannel] Test mode - would send email to ${recipient.email}`);
        return {
          success: true,
          testMode: true,
          channel: 'email',
          subject,
          body_preview: body.substring(0, 200),
          recipient: recipient.email
        };
      }

      // Envoi réel
      const info = await this.transporter.sendMail(mailOptions);

      this.logger?.info(`[EmailChannel] Email sent to ${recipient.email}: ${info.messageId}`);

      return {
        success: true,
        channel: 'email',
        subject,
        body_preview: body.substring(0, 200),
        recipient: recipient.email,
        external_id: info.messageId,
        provider: 'smtp'
      };

    } catch (error) {
      this.logger?.error(`[EmailChannel] Error sending email to ${recipient.email}:`, error);
      
      return {
        success: false,
        channel: 'email',
        error: error.message,
        recipient: recipient.email
      };
    }
  }

  /**
   * Wrap le contenu HTML dans un template email
   */
  wrapHtml(content, style = 'default') {
    const styles = {
      default: `
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
        .content { background: white; padding: 20px; }
        .footer { background: #f5f5f5; padding: 10px; text-align: center; font-size: 12px; color: #666; }
        a { color: #4CAF50; }
      `,
      minimal: `
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      `
    };

    const css = styles[style] || styles.default;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${css}</style>
</head>
<body>
  <div class="container">
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>FlowQuartz - Smart Notifications</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Retire les tags HTML pour version texte
   */
  stripHtml(html) {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  /**
   * Vérifie la configuration SMTP
   */
  async verify() {
    try {
      await this.transporter.verify();
      this.logger?.info('[EmailChannel] SMTP configuration verified');
      return true;
    } catch (error) {
      this.logger?.error('[EmailChannel] SMTP verification failed:', error);
      return false;
    }
  }
}
