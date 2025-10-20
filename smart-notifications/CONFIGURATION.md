# Smart Notifications - Configuration

## Variables d'environnement requises

Ajouter ces variables dans votre fichier `.env` :

```bash
# Email Configuration (SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@flowquartz.com

# Optionnel - Webhook configuration
WEBHOOK_TIMEOUT=10000

# Optionnel - Queue processing
QUEUE_BATCH_SIZE=20
QUEUE_PROCESS_INTERVAL=5
```

## Configuration SMTP selon le fournisseur

### Gmail
```bash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password  # Créer un mot de passe d'application
```

### Office 365 / Outlook
```bash
EMAIL_HOST=smtp.office365.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@outlook.com
EMAIL_PASSWORD=your-password
```

### Amazon SES
```bash
EMAIL_HOST=email-smtp.eu-west-1.amazonaws.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-ses-smtp-username
EMAIL_PASSWORD=your-ses-smtp-password
```

### SendGrid
```bash
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=apikey
EMAIL_PASSWORD=your-sendgrid-api-key
```

### Mailgun
```bash
EMAIL_HOST=smtp.mailgun.org
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=postmaster@your-domain.mailgun.org
EMAIL_PASSWORD=your-mailgun-password
```

## Configuration des webhooks

### Slack
1. Créer une Slack App : https://api.slack.com/apps
2. Activer "Incoming Webhooks"
3. Copier l'URL du webhook

Dans le template, ajouter :
```json
{
  "webhook_config": {
    "url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
    "provider": "slack",
    "title": "{{nom_processus}}",
    "text": "Échéance dans {{jours_restants}} jours"
  }
}
```

### Microsoft Teams
1. Dans Teams, aller dans le canal désiré
2. "..." → "Connectors" → "Incoming Webhook"
3. Copier l'URL du webhook

Dans le template :
```json
{
  "webhook_config": {
    "url": "https://outlook.office.com/webhook/YOUR-WEBHOOK-URL",
    "provider": "teams",
    "title": "{{nom_processus}}",
    "text": "Échéance dans {{jours_restants}} jours",
    "color": "FF0000"
  }
}
```

### Discord
1. Dans le serveur Discord → "Paramètres du salon"
2. "Intégrations" → "Webhooks" → "Nouveau webhook"
3. Copier l'URL du webhook

Dans le template :
```json
{
  "webhook_config": {
    "url": "https://discord.com/api/webhooks/YOUR/WEBHOOK",
    "provider": "discord",
    "title": "{{nom_processus}}",
    "text": "Échéance dans {{jours_restants}} jours",
    "color": "5865F2"
  }
}
```

## Permissions requises

L'extension a besoin d'accès à ces collections :
- `quartz_notification_rules` (lecture/écriture)
- `quartz_notification_templates` (lecture)
- `quartz_notification_logs` (écriture)
- `quartz_notification_queue` (lecture/écriture)
- `directus_notifications` (écriture pour canal in-app)
- Toutes les collections surveillées (lecture)

## Cron jobs

L'extension configure automatiquement ces crons :
- **Toutes les heures** : Monitoring des échéances
- **Toutes les 5 minutes** : Traitement de la queue

Pas de configuration manuelle nécessaire.

## Limites par défaut

```javascript
{
  frequency_config: {
    enable_dedup: true,
    dedup_window_hours: 24,  // Ne pas renvoyer avant 24h
    max_per_day: 10,         // Max 10 notifications par jour par règle
    max_per_week: 30         // Max 30 par semaine
  }
}
```

## Performance

- **Queue batch size** : 20 notifications par cycle
- **SMTP timeout** : 10 secondes
- **Webhook timeout** : 10 secondes
- **Retry** : 3 tentatives avec backoff exponentiel (2min, 4min, 8min)
- **Cleanup** : Les logs de queue > 7 jours sont supprimés automatiquement
