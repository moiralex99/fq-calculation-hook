# 🔔 Smart Notifications & Alerts

Extension Directus pour gérer des notifications intelligentes avec monitoring de deadlines, templates réutilisables et multi-canaux.

## ✨ Features

- 🎯 **Monitoring de deadlines** - Détection automatique des échéances proches
- 📧 **Multi-canaux** - Email, In-App, Webhooks (Slack/Teams/Discord)
- 📝 **Templates réutilisables** - Créez une fois, utilisez partout
- 🔍 **Conditions JSONLogic** - Logique flexible comme vos automations
- 👥 **Résolution intelligente** - Destinataires dynamiques (champs, rôles, équipes)
- 📊 **Tracking complet** - Logs d'envoi, taux d'ouverture, statistiques
- 🔄 **Retry automatique** - Réessai en cas d'échec
- 🚫 **Déduplication** - Évite les notifications en double

## 📦 Installation

```bash
npm install
npm run build
```

Copiez le dossier `dist/` dans `extensions/` de votre Directus.

## 🗄️ Collections créées

Cette extension crée automatiquement 4 collections :

1. **`quartz_notification_rules`** - Règles de notification
2. **`quartz_notification_templates`** - Templates réutilisables
3. **`quartz_notification_logs`** - Historique des envois
4. **`quartz_notification_queue`** - File d'attente (optionnelle)

## 🚀 Utilisation rapide

### Créer une règle de notification

```javascript
// Via l'API
POST /smart-notifications/rules

{
  "name": "Alerte 3 jours avant deadline",
  "collection_cible": "processus",
  "trigger_type": "deadline_check",
  "conditions": {
    "and": [
      {"===": [{"var": "status"}, "en_cours"]},
      {"<=": [{"var": "jours_restants"}, 3]}
    ]
  },
  "recipient_config": {
    "type": "dynamic_field",
    "field": "assignee"
  },
  "template_id": 1,
  "channels": ["email", "in_app"],
  "status": "published"
}
```

### Envoyer une notification manuelle

```javascript
POST /smart-notifications/send

{
  "rule_id": 1,
  "collection": "processus",
  "item_id": "123",
  "override_recipient": "test@example.com"
}
```

### Utiliser dans un Flow

```yaml
Trigger: Event Hook (status = "validation_requise")
↓
Operation: Smart Notification Send
  rule_id: 2
  collection: {{$trigger.collection}}
  item_id: {{$trigger.key}}
```

## 📚 Documentation

- [API Reference](docs/API.md)
- [Examples](docs/EXAMPLES.md)
- [Configuration](docs/CONFIGURATION.md)

## 🔧 Configuration

Variables d'environnement :

```env
# Email (Nodemailer)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASSWORD=secret
SMTP_FROM=noreply@example.com

# Webhook (Slack example)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx

# Monitoring
NOTIFICATION_CHECK_INTERVAL=3600000  # 1h en ms
NOTIFICATION_LOG_RETENTION_DAYS=90
```

## 🎯 Cas d'usage

### Deadline proche (3 jours avant)
- Collection : `processus`
- Trigger : `deadline_check`
- Condition : `jours_restants <= 3`
- Destinataire : Champ `assignee`

### Budget dépassé (>90%)
- Collection : `projets`
- Trigger : `field_update` sur `budget_consomme`
- Condition : `budget_consomme > budget_total * 0.9`
- Destinataire : Champs `chef_projet` + `responsable_budget`

### Validation en attente (>48h)
- Collection : `campagnes`
- Trigger : `deadline_check`
- Condition : `status = "en_attente" AND date_creation > 48h`
- Destinataire : Champ `validateur`

## 🤝 Intégration avec d'autres extensions

Compatible avec vos extensions existantes :
- `hook-calc` - Déclencher notifications après calculs
- `automations` - Utiliser les mêmes conditions JSONLogic

## 📝 License

MIT

## 👨‍💻 Author

FlowQuartz Team - 2025
