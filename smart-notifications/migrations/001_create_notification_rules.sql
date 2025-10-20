-- Création de la collection quartz_notification_rules
-- Stocke les règles de notification (comme les automations)

CREATE TABLE IF NOT EXISTS quartz_notification_rules (
  id INT PRIMARY KEY AUTO_INCREMENT,
  status VARCHAR(50) DEFAULT 'draft' COMMENT 'draft, published, archived',
  sort INT DEFAULT NULL,
  
  -- Identification
  name VARCHAR(255) NOT NULL COMMENT 'Nom de la règle',
  description TEXT COMMENT 'Description détaillée',
  
  -- Trigger Configuration
  collection_cible VARCHAR(255) NOT NULL COMMENT 'Collection à surveiller',
  trigger_type VARCHAR(50) NOT NULL COMMENT 'deadline_check, status_change, field_update, manual',
  watched_fields JSON COMMENT 'Champs surveillés pour field_update: ["budget", "status"]',
  
  -- Conditions (JSONLogic comme automations)
  conditions JSON COMMENT 'Conditions JSONLogic: {"<=": [{"var": "jours_restants"}, 3]}',
  
  -- Destinataires
  recipient_type VARCHAR(50) NOT NULL DEFAULT 'dynamic_field' COMMENT 'static, dynamic_field, role, team, custom_query',
  recipient_config JSON COMMENT 'Configuration: {field: "assignee", fallback: ["admin@..."]}',
  
  -- Template & Channels
  template_id INT COMMENT 'FK vers quartz_notification_templates',
  channels JSON DEFAULT '["email"]' COMMENT 'Canaux: ["email", "in_app", "webhook", "sms"]',
  
  -- Fréquence & Déduplication
  frequency_type VARCHAR(50) DEFAULT 'once_per_condition' COMMENT 'once, once_per_condition, daily, on_change, cron',
  frequency_config JSON COMMENT 'Config: {cooldown: "24h", cron: "0 9 * * *"}',
  
  -- Retry Configuration
  retry_enabled BOOLEAN DEFAULT true,
  retry_max_attempts INT DEFAULT 3,
  retry_delay VARCHAR(20) DEFAULT '5m' COMMENT '5m, 1h, etc.',
  
  -- Priority
  priority INT DEFAULT 5 COMMENT '1=low, 5=normal, 10=urgent',
  
  -- Statistics
  total_sent INT DEFAULT 0,
  total_failed INT DEFAULT 0,
  total_success INT DEFAULT 0,
  last_triggered_at TIMESTAMP NULL,
  last_success_at TIMESTAMP NULL,
  last_error TEXT,
  
  -- Metadata Directus
  date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  user_created INT,
  user_updated INT,
  
  INDEX idx_status (status),
  INDEX idx_collection_cible (collection_cible),
  INDEX idx_trigger_type (trigger_type),
  INDEX idx_priority (priority DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Données de test
INSERT INTO quartz_notification_rules (
  name,
  description,
  collection_cible,
  trigger_type,
  conditions,
  recipient_type,
  recipient_config,
  channels,
  frequency_type,
  status
) VALUES (
  'Alerte deadline 3 jours',
  'Notification envoyée 3 jours avant l\'échéance d\'un processus',
  'processus',
  'deadline_check',
  '{"and": [{"===": [{"var": "status"}, "en_cours"]}, {"<=": [{"var": "jours_restants"}, 3]}, {">": [{"var": "jours_restants"}, 0]}]}',
  'dynamic_field',
  '{"field": "assignee", "fallback": ["admin@company.com"]}',
  '["email", "in_app"]',
  'once_per_condition',
  'draft'
);
