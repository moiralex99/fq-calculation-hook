-- Création de la collection quartz_notification_queue
-- File d'attente pour traitement asynchrone et retry

CREATE TABLE IF NOT EXISTS quartz_notification_queue (
  id INT PRIMARY KEY AUTO_INCREMENT,
  
  -- Référence
  rule_id INT NOT NULL COMMENT 'FK vers quartz_notification_rules',
  collection VARCHAR(255) NOT NULL,
  item_id VARCHAR(255) NOT NULL,
  
  -- Planification
  priority INT DEFAULT 5 COMMENT '1=low, 5=normal, 10=urgent',
  scheduled_for TIMESTAMP NOT NULL COMMENT 'Date/heure planifiée',
  
  -- Statut de traitement
  status VARCHAR(50) DEFAULT 'pending' COMMENT 'pending, processing, sent, failed, cancelled',
  locked_by VARCHAR(100) COMMENT 'ID du worker qui traite',
  locked_at TIMESTAMP NULL COMMENT 'Date de verrouillage',
  
  -- Retry
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  last_attempt_at TIMESTAMP NULL,
  last_error TEXT,
  
  -- Payload
  payload JSON NOT NULL COMMENT 'Données complètes pour l''envoi',
  
  -- Déduplication
  dedup_key VARCHAR(255) COMMENT 'Clé unique: rule_id-collection-item_id-recipient',
  
  -- Metadata
  date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  date_completed TIMESTAMP NULL,
  
  INDEX idx_status_scheduled (status, scheduled_for),
  INDEX idx_priority (priority DESC),
  INDEX idx_locked (locked_by, locked_at),
  INDEX idx_dedup (dedup_key),
  UNIQUE KEY uk_dedup_pending (dedup_key, status)  -- Évite les doublons en pending
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Auto-cleanup des messages traités > 7 jours
-- Event scheduler (à activer dans MySQL: SET GLOBAL event_scheduler = ON;)
DELIMITER $$
CREATE EVENT IF NOT EXISTS cleanup_old_queue_items
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO BEGIN
  DELETE FROM quartz_notification_queue 
  WHERE status IN ('sent', 'failed', 'cancelled') 
  AND date_completed < DATE_SUB(NOW(), INTERVAL 7 DAY);
END$$
DELIMITER ;
