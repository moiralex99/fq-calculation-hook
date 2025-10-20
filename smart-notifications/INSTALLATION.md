# 🚀 Installation Rapide - Smart Notifications

## 1️⃣ Installation de l'extension

```bash
# Copier le dossier compilé vers Directus
cp -r smart-notifications/dist "path/to/directus/extensions/directus-extension-smart-notifications"

# OU builder localement dans Directus
cd path/to/directus/extensions
ln -s /path/to/smart-notifications ./directus-extension-smart-notifications
```

## 2️⃣ Configuration de l'environnement

Ajouter dans `.env` de Directus :

```bash
# Email Configuration (obligatoire pour canal email)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=votre-email@gmail.com
EMAIL_PASSWORD=votre-mot-de-passe-app
EMAIL_FROM=noreply@flowquartz.com
```

## 3️⃣ Créer les tables dans la base de données

Exécuter les migrations SQL dans l'ordre :

```bash
# Depuis MySQL/MariaDB
mysql -u directus_user -p directus_db < smart-notifications/migrations/001_create_notification_rules.sql
mysql -u directus_user -p directus_db < smart-notifications/migrations/002_create_notification_templates.sql
mysql -u directus_user -p directus_db < smart-notifications/migrations/003_create_notification_logs.sql
mysql -u directus_user -p directus_db < smart-notifications/migrations/004_create_notification_queue.sql
```

**OU** depuis l'interface Directus Data Studio, copier/coller le contenu de chaque fichier SQL.

## 4️⃣ Redémarrer Directus

```bash
# Docker
docker-compose restart directus

# Node.js
npm restart
```

## 5️⃣ Vérifier l'installation

### Via les logs
Vérifier que l'extension démarre sans erreur :

```
[SmartNotifications] Initializing...
[SmartNotifications] Registered channel: email
[SmartNotifications] Registered channel: in-app
[SmartNotifications] Registered channel: webhook
[SmartNotifications] Initialized successfully
```

### Via l'API
Tester l'endpoint :

```bash
curl http://localhost:8055/notifications/queue/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Devrait retourner :
```json
{
  "pending": 0,
  "processing": 0,
  "completed": 0,
  "failed": 0,
  "skipped": 0
}
```

## 6️⃣ Premier test

### Créer une règle de test

1. Aller dans Directus → Collections → `quartz_notification_rules`
2. Créer une nouvelle règle :
   - **Nom** : Test Email
   - **Template ID** : 1 (deadline-proche)
   - **Status** : published
   - **Trigger Type** : manual
   - **Channels** : ["email"]
   - **Collections** : ["processus"]
   - **Recipient Config** :
     ```json
     {
       "type": "static",
       "emails": ["votre-email@test.com"]
     }
     ```

### Tester l'envoi

```bash
curl -X POST http://localhost:8055/notifications/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rule_id": 1,
    "collection": "processus",
    "item_id": 1,
    "recipient_email": "votre-email@test.com"
  }'
```

Vous devriez recevoir une preview de la notification sans envoi réel.

## 7️⃣ Utilisation dans Directus Flows

1. Créer un nouveau Flow
2. Ajouter l'opération "Send Smart Notification"
3. Configurer :
   - **Rule ID** : Sélectionner votre règle
   - **Collection** : Laisser vide (utilise $trigger)
   - **Item ID** : Laisser vide (utilise $trigger)
   - **Use Queue** : ✅ Coché (recommandé)

## 8️⃣ Utilisation depuis votre React Admin

### Envoyer une notification

```javascript
const sendNotification = async (ruleId, collection, itemId) => {
  const response = await fetch('/notifications/enqueue', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      rule_id: ruleId,
      collection,
      item_id: itemId,
      priority: 'normal'
    })
  });
  
  return response.json();
};
```

### Récupérer l'historique

```javascript
const getLogs = async (filters = {}) => {
  const params = new URLSearchParams(filters);
  const response = await fetch(`/notifications/logs?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.json();
};
```

### Récupérer les stats

```javascript
const getStats = async (period = '7d') => {
  const response = await fetch(`/notifications/stats?period=${period}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.json();
};
```

## ✅ C'est prêt !

Votre système de notifications est maintenant opérationnel. Les notifications seront traitées automatiquement par :

- **Cron toutes les heures** : Monitoring des échéances
- **Cron toutes les 5 minutes** : Traitement de la queue
- **Hooks temps réel** : Surveillance des changements de champs

## 📚 Prochaines étapes

- Lire `CONFIGURATION.md` pour configurer Slack/Teams/Discord
- Consulter `README.md` pour tous les use cases
- Créer vos propres templates dans `quartz_notification_templates`
- Créer vos règles dans `quartz_notification_rules`
