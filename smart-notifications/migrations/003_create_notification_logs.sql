-- Création de la collection quartz_notification_logs
-- Historique complet de toutes les notifications envoyées

CREATE TABLE IF NOT EXISTS quartz_notification_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  
  -- Référence à la règle et template
  rule_id INT COMMENT 'FK vers quartz_notification_rules',
  rule_name VARCHAR(255) COMMENT 'Nom de la règle (dénormalisé pour historique)',
  template_id INT COMMENT 'FK vers quartz_notification_templates',
  template_code VARCHAR(100) COMMENT 'Code du template (dénormalisé)',
  
  -- Context de déclenchement
  collection VARCHAR(255) NOT NULL COMMENT 'Collection source',
  item_id VARCHAR(255) NOT NULL COMMENT 'ID de l''item concerné',
  trigger_type VARCHAR(50) COMMENT 'Type de trigger: deadline_check, field_update, manual',
  
  -- Destinataire
  recipient_email VARCHAR(255) COMMENT 'Email du destinataire',
  recipient_user_id INT COMMENT 'ID utilisateur Directus (si applicable)',
  recipient_name VARCHAR(255) COMMENT 'Nom complet du destinataire',
  
  -- Canal et statut
  channel VARCHAR(50) NOT NULL COMMENT 'email, in_app, webhook, sms',
  status VARCHAR(50) DEFAULT 'pending' COMMENT 'pending, sending, sent, delivered, failed, bounced, opened, clicked',
  
  -- Tracking temporel
  queued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP NULL COMMENT 'Date d''envoi réel',
  delivered_at TIMESTAMP NULL COMMENT 'Date de livraison confirmée',
  opened_at TIMESTAMP NULL COMMENT 'Date d''ouverture (email tracking)',
  clicked_at TIMESTAMP NULL COMMENT 'Date de clic sur lien (email tracking)',
  
  -- Gestion des erreurs
  error_message TEXT COMMENT 'Message d''erreur si échec',
  error_code VARCHAR(50) COMMENT 'Code d''erreur technique',
  retry_count INT DEFAULT 0 COMMENT 'Nombre de tentatives',
  next_retry_at TIMESTAMP NULL COMMENT 'Prochaine tentative programmée',
  
  -- Contenu envoyé (pour debug et audit)
  subject TEXT COMMENT 'Sujet de l''email ou titre',
  body_preview TEXT COMMENT 'Aperçu du contenu (premiers 500 chars)',
  variables_used JSON COMMENT 'Variables et valeurs utilisées dans le template',
  
  -- Métadonnées d'envoi
  priority INT DEFAULT 5,
  external_id VARCHAR(255) COMMENT 'ID externe (ex: message_id email, notification_id in-app)',
  provider VARCHAR(100) COMMENT 'Fournisseur utilisé: smtp, sendgrid, slack, twilio',
  provider_response JSON COMMENT 'Réponse brute du provider',
  
  -- Metadata
  date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_rule_id (rule_id),
  INDEX idx_status (status),
  INDEX idx_collection_item (collection, item_id),
  INDEX idx_recipient (recipient_email, recipient_user_id),
  INDEX idx_sent_at (sent_at),
  INDEX idx_channel (channel),
  INDEX idx_queued_status (queued_at, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Partition par mois pour performance (optionnel, à activer si gros volume)
-- ALTER TABLE quartz_notification_logs PARTITION BY RANGE (TO_DAYS(date_created)) (
--   PARTITION p202501 VALUES LESS THAN (TO_DAYS('2025-02-01')),
--   PARTITION p202502 VALUES LESS THAN (TO_DAYS('2025-03-01')),
--   ...
-- );
