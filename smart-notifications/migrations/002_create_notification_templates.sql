-- Création de la collection quartz_notification_templates
-- Stocke les templates réutilisables pour les notifications

CREATE TABLE IF NOT EXISTS quartz_notification_templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  status VARCHAR(50) DEFAULT 'draft' COMMENT 'draft, published, archived',
  sort INT DEFAULT NULL,
  
  -- Identification
  name VARCHAR(255) NOT NULL COMMENT 'Nom du template',
  code VARCHAR(100) UNIQUE COMMENT 'Code unique: deadline-proche, validation-requise',
  description TEXT COMMENT 'Description',
  category VARCHAR(100) COMMENT 'Catégorie: deadline, validation, alert, report',
  
  -- Email Template
  email_subject TEXT COMMENT 'Sujet avec variables: ⏰ {{nom_processus}} - Échéance dans {{jours_restants}} jours',
  email_body_html TEXT COMMENT 'Corps HTML avec variables Mustache',
  email_body_text TEXT COMMENT 'Corps texte brut',
  email_from VARCHAR(255) COMMENT 'From override (optionnel)',
  email_reply_to VARCHAR(255) COMMENT 'Reply-To (optionnel)',
  
  -- In-App Notification
  inapp_title TEXT COMMENT 'Titre court',
  inapp_message TEXT COMMENT 'Message avec variables',
  inapp_icon VARCHAR(50) DEFAULT 'notifications' COMMENT 'Icône Material: notifications, warning, info',
  inapp_color VARCHAR(20) DEFAULT '#6644FF' COMMENT 'Couleur hex',
  inapp_action_url TEXT COMMENT 'URL action: /admin/content/processus/{{id}}',
  
  -- Webhook Template
  webhook_payload JSON COMMENT 'Payload JSON avec variables pour Slack/Teams/Discord',
  webhook_method VARCHAR(10) DEFAULT 'POST' COMMENT 'GET, POST, PUT',
  webhook_headers JSON COMMENT 'Headers custom',
  
  -- SMS Template (optionnel)
  sms_message TEXT COMMENT 'Message SMS (160 chars max)',
  
  -- Variables & Metadata
  variables JSON COMMENT 'Variables disponibles: ["nom_processus", "date_echeance", "assignee"]',
  preview_data JSON COMMENT 'Données exemple pour prévisualisation',
  
  -- Metadata Directus
  date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  user_created INT,
  user_updated INT,
  
  INDEX idx_status (status),
  INDEX idx_code (code),
  INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Templates par défaut
INSERT INTO quartz_notification_templates (
  name,
  code,
  category,
  email_subject,
  email_body_html,
  email_body_text,
  inapp_title,
  inapp_message,
  inapp_icon,
  inapp_color,
  variables,
  status
) VALUES 
(
  'Deadline proche',
  'deadline-proche',
  'deadline',
  '⏰ {{nom_processus}} - Échéance dans {{jours_restants}} jours',
  '<h2>Bonjour {{assignee.first_name}},</h2>
<p>Le processus <strong>{{nom_processus}}</strong> arrive à échéance.</p>
<p><strong>Date limite :</strong> {{date_echeance}}</p>
<p><strong>Temps restant :</strong> {{jours_restants}} jours</p>
<p><a href="{{directus_url}}/admin/content/processus/{{id}}" style="background:#6644FF;color:white;padding:10px 20px;text-decoration:none;border-radius:4px;">Voir le processus</a></p>',
  'Bonjour {{assignee.first_name}},\n\nLe processus {{nom_processus}} arrive à échéance.\nDate limite : {{date_echeance}}\nTemps restant : {{jours_restants}} jours\n\nVoir : {{directus_url}}/admin/content/processus/{{id}}',
  '⏰ Deadline proche',
  '{{nom_processus}} - Échéance dans {{jours_restants}} jours',
  'schedule',
  '#FF9800',
  '["nom_processus", "date_echeance", "jours_restants", "assignee", "id"]',
  'published'
),
(
  'Validation requise',
  'validation-requise',
  'validation',
  '✅ Validation requise : {{nom_item}}',
  '<h2>Bonjour {{validateur.first_name}},</h2>
<p>L''item <strong>{{nom_item}}</strong> nécessite votre validation.</p>
<p><strong>Soumis par :</strong> {{soumis_par.first_name}} {{soumis_par.last_name}}</p>
<p><strong>Date de soumission :</strong> {{date_soumission}}</p>
<p><a href="{{directus_url}}/admin/content/{{collection}}/{{id}}" style="background:#4CAF50;color:white;padding:10px 20px;text-decoration:none;border-radius:4px;">Valider maintenant</a></p>',
  'Bonjour {{validateur.first_name}},\n\nL''item {{nom_item}} nécessite votre validation.\nSoumis par : {{soumis_par.first_name}} {{soumis_par.last_name}}\n\nValider : {{directus_url}}/admin/content/{{collection}}/{{id}}',
  '✅ Validation requise',
  '{{nom_item}} attend votre validation',
  'check_circle',
  '#4CAF50',
  '["nom_item", "validateur", "soumis_par", "date_soumission", "collection", "id"]',
  'published'
),
(
  'Alerte budget',
  'alerte-budget',
  'alert',
  '🔴 Alerte budget : {{nom_projet}}',
  '<h2>⚠️ Alerte Budget</h2>
<p>Le projet <strong>{{nom_projet}}</strong> a dépassé 90% de son budget.</p>
<p><strong>Budget total :</strong> {{budget_total}}€</p>
<p><strong>Budget consommé :</strong> {{budget_consomme}}€ ({{pourcentage}}%)</p>
<p><strong>Budget restant :</strong> {{budget_restant}}€</p>
<p><a href="{{directus_url}}/admin/content/projets/{{id}}" style="background:#F44336;color:white;padding:10px 20px;text-decoration:none;border-radius:4px;">Voir le projet</a></p>',
  'Alerte Budget\n\nLe projet {{nom_projet}} a dépassé 90% de son budget.\nBudget total : {{budget_total}}€\nBudget consommé : {{budget_consomme}}€ ({{pourcentage}}%)\nBudget restant : {{budget_restant}}€',
  '🔴 Alerte budget',
  '{{nom_projet}} : {{pourcentage}}% du budget consommé',
  'warning',
  '#F44336',
  '["nom_projet", "budget_total", "budget_consomme", "budget_restant", "pourcentage", "id"]',
  'published'
);
