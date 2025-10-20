# CRON / Scheduled Automations

## Overview

L'extension Automations supporte l'exécution planifiée (CRON) via l'endpoint `/quartz-automations/run` combiné avec les Directus Flows Schedule triggers.

**Avantages**:
- Utilise le système de CRON natif de Directus (UI incluse, logs intégrés)
- Support des permissions via `accountability`
- Dry-run pour tester sans écrire
- Flexibilité: item unique, filtre, ou collection entière

---

## Endpoint `/quartz-automations/run`

### URL
```
POST http://your-directus-url/quartz-automations/run
```

### Paramètres

| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `automation_id` | uuid | **Oui** | UUID de l'automation à déclencher ⚠️ **Toujours utiliser l'UUID, jamais le nom** |
| `collection` | string | Non | Override collection_cible si besoin |
| `item_id` | any | Non | Exécuter sur un item spécifique |
| `filter` | object | Non | Exécuter sur tous les items matchant le filtre |
| `context` | object | Non | Variables custom pour la règle (ex: `{ "$TRIGGER": "cron" }`) |
| `dry_run` | boolean | Non | Si `true`, simule sans écrire en DB |
| `accountability` | object\|null | Non | Contexte utilisateur pour permissions (`null` = admin) |

⚠️ **IMPORTANT - Sécurité Production**:
- L'endpoint **n'accepte QUE les UUID** (`automation_id`)
- Ne pas utiliser de noms d'automation pour éviter:
  - Collisions si deux automations ont le même nom
  - Modifications silencieuses (renommage cassant les CRON)
  - Ambiguïté dans les logs
- Toujours récupérer l'UUID depuis Directus Studio ou via API

### Réponse

```json
{
  "ok": true,
  "results": [
    {
      "item_id": "uuid-123",
      "updates": { "field": "value" }
    }
  ],
  "sideEffects": [] // Uniquement si dry_run=true
}
```

---

## Use Case 1: Alerte retard quotidien

**Besoin**: Chaque soir à 20h, vérifier toutes les tâches en retard et envoyer un email.

### 1. Créer l'automation

```json
{
  "name": "Alertes tâches en retard",
  "collection_cible": "taches",
  "status": "active",
  "rule": {
    "and": [
      { "!==": [{ "var": "date_echeance" }, null] },
      { "!==": [{ "var": "statut" }, "termine"] },
      { ">": [ { "date_diff": [ { "now": [] }, { "var": "date_echeance" }, "days" ] }, 0 ] }
    ]
  },
  "actions": [
    {
      "type": "set_field",
      "field": "$jours_retard",
      "value": { "date_diff": [ { "now": [] }, { "var": "date_echeance" }, "days" ] }
    },
    {
      "type": "create_item",
      "collection": "notifications",
      "data": {
        "user_id": { "var": "responsable_id" },
        "titre": "⏰ Tâche en retard",
        "message": {
          "concat": [
            "La tâche '",
            { "var": "titre" },
            "' est en retard de ",
            { "var": "$jours_retard" },
            " jour(s)"
          ]
        },
        "date_creation": { "now": [] }
      }
    }
  ]
}
```

### 2. Créer le Flow Directus

**Dans Directus Studio**:
1. **Flows** → **Create Flow**
2. **Name**: "CRON - Alertes retard"
3. **Trigger**: Schedule (CRON)
   - Expression: `0 20 * * *` (tous les jours à 20h)
4. **Operation**: Webhook
   - Method: POST
   - URL: `http://localhost:8055/quartz-automations/run`
   - Headers:
     ```json
     {
       "Content-Type": "application/json"
     }
     ```
   - Body:
     ```json
     {
       "automation_id": "uuid-de-votre-automation",
       "filter": {
         "date_echeance": { "_lte": "$NOW" },
         "statut": { "_neq": "termine" }
       },
       "context": {
         "$TRIGGER": "cron_daily"
       }
     }
     ```
     
     > **Comment obtenir l'UUID**: Dans Directus Studio, ouvrir `quartz_automations`, copier l'ID de l'automation "Alertes tâches en retard".

---

## Use Case 2: Purge hebdomadaire logs

**Besoin**: Chaque dimanche à 3h du matin, archiver les logs de plus de 90 jours.

### 1. Créer l'automation

```json
{
  "name": "Purge logs anciens",
  "collection_cible": "audit_log",
  "status": "active",
  "rule": true,
  "actions": [
    {
      "type": "set_field",
      "field": "$date_limite",
      "value": { "date_add": [ { "now": [] }, -90, "days" ] }
    },
    {
      "type": "update_many",
      "collection": "audit_log",
      "filter": {
        "date_creation": { "_lt": { "var": "$date_limite" } }
      },
      "data": {
        "archived": true,
        "archived_at": { "now": [] }
      },
      "limit": 10000
    }
  ]
}
```

### 2. Créer le Flow

**Dans Directus Studio**:
1. **Trigger**: Schedule (CRON)
   - Expression: `0 3 * * 0` (dimanche 3h)
2. **Operation**: Webhook
   - Body:
     ```json
     {
       "automation_id": "uuid-de-votre-automation",
       "context": {
         "$TRIGGER": "cron_weekly"
       }
     }
     ```

**Note**: Pas besoin de `filter` ou `item_id`, l'automation calcule elle-même le filtre dynamique.

---

## Use Case 3: Rapport mensuel

**Besoin**: Le 1er de chaque mois, générer un rapport agrégé.

### 1. Créer l'automation

```json
{
  "name": "Générer rapport mensuel",
  "collection_cible": "rapports",
  "status": "active",
  "rule": true,
  "actions": [
    {
      "type": "set_field",
      "field": "$debut_mois",
      "value": { "date_add": [ { "now": [] }, -30, "days" ] }
    },
    {
      "type": "set_field",
      "field": "$commandes",
      "value": {
        "lookup_many": [
          "commandes",
          {
            "date_creation": { "_gte": { "var": "$debut_mois" } },
            "statut": { "_eq": "payee" }
          },
          ["id", "total"],
          -1
        ]
      }
    },
    {
      "type": "set_field",
      "field": "$total_mois",
      "value": { "sum_by": [ { "var": "$commandes" }, "total" ] }
    },
    {
      "type": "create_item",
      "collection": "rapports",
      "data": {
        "titre": {
          "concat": [
            "Rapport mensuel - ",
            { "date_add": [ { "now": [] }, 0, "days" ] }
          ]
        },
        "nb_commandes": { "length": { "var": "$commandes" } },
        "total": { "var": "$total_mois" },
        "date_creation": { "now": [] }
      }
    }
  ]
}
```

### 2. Créer le Flow

**Trigger**: Schedule (CRON)
- Expression: `0 6 1 * *` (1er du mois à 6h)
- Webhook body:
  ```json
  {
    "automation_id": "uuid-de-votre-automation",
    "context": {
      "$TRIGGER": "cron_monthly"
    }
  }
  ```

---

## Permissions & Accountability

### Mode Admin (service account)
Pour les tâches système (purge, rapports), utiliser `accountability: null`:

```json
{
  "automation_id": "uuid-de-votre-automation",
  "accountability": null
}
```

**Effet**: Bypass toutes les permissions (comme un admin Directus).

### Mode User
Pour exécuter au nom d'un utilisateur spécifique:

```json
{
  "automation_id": "uuid-de-votre-automation",
  "filter": { "responsable_id": { "_eq": "user-uuid" } },
  "accountability": {
    "user": "user-uuid",
    "role": "role-uuid"
  }
}
```

**Effet**: Les permissions de cet utilisateur sont appliquées.

### Recommandation
- **Flows CRON**: Utiliser `accountability: null` (défaut Directus pour les schedules)
- **Boutons manuels**: Utiliser `accountability` de l'utilisateur courant

---

## Dry-run (test sans écriture)

Pour tester une automation avant de la déployer:

```json
{
  "automation_id": "uuid-de-votre-automation",
  "filter": { "id": { "_eq": "test-item-id" } },
  "dry_run": true
}
```

**Réponse**:
```json
{
  "ok": true,
  "results": [
    { "item_id": "test-item-id", "updates": { "field": "value" } }
  ],
  "sideEffects": [
    { "type": "create_item", "collection": "notifications", "data": {...} }
  ]
}
```

**Note**: Aucune écriture en DB, uniquement une simulation.

---

## Exemples avancés

### Exécuter sur un item spécifique
```json
{
  "automation_id": "uuid-automation",
  "collection": "taches",
  "item_id": "uuid-tache-123"
}
```

### Exécuter sur plusieurs collections
Créer plusieurs webhooks dans le Flow, un par collection:

**Webhook 1**:
```json
{
  "automation_id": "uuid-automation-purge-audit",
  "collection": "audit_log",
  "filter": { "date_creation": { "_lt": "$NOW(-90d)" } }
}
```

**Webhook 2**:
```json
{
  "automation_id": "uuid-automation-purge-error",
  "collection": "error_log",
  "filter": { "date_creation": { "_lt": "$NOW(-30d)" } }
}
```

### Contexte custom
Passer des variables pour la règle:

```json
{
  "automation_id": "uuid-de-votre-automation",
  "context": {
    "$FORCE_SEND": true,
    "$RECIPIENT_OVERRIDE": "admin@example.com"
  }
}
```

Dans la règle:
```json
{
  "rule": {
    "or": [
      { "var": "$FORCE_SEND" },
      { ">": [ { "var": "priority" }, 5 ] }
    ]
  }
}
```

---

## Monitoring & Logs

### Logs Directus Flow
Directus enregistre automatiquement:
- Statut d'exécution (success/error)
- Timestamp
- Durée
- Payload

**Voir**: Directus Studio → Flows → Logs

### Logs Extension
Les logs de l'automation apparaissent dans les logs Directus:

```
[Automations /run] Automation: Alertes retard
[Automations] rule Alertes retard match=true
[Automations] action create_item in notifications
[Automations /run] Processed 12 items
```

### Erreurs
Si une automation échoue:

```json
{
  "ok": false,
  "error": "Collection 'invalid_collection' not found"
}
```

Le Flow Directus:
- Marque l'exécution comme "Failed"
- Enregistre l'erreur dans les logs
- Peut déclencher un webhook de notification d'erreur

---

## Best Practices

### 1. Utiliser des identifiants stables
```json
{
  "automation_id": "uuid-stable-ne-change-jamais"
}
```

> **Important**: Toujours utiliser l'UUID de l'automation. Récupérez-le dans Directus Studio (`quartz_automations` → copier l'ID).

### 2. Ajouter le contexte du trigger
```json
{
  "context": {
    "$TRIGGER": "cron_daily",
    "$EXECUTION_TIME": "20:00"
  }
}
```

### 3. Limiter le scope
Pour éviter de traiter trop d'items:
```json
{
  "filter": {
    "date_echeance": { "_between": ["$NOW(-7d)", "$NOW"] }
  }
}
```

### 4. Dry-run en staging
Avant de déployer en production, tester avec `dry_run: true`.

### 5. Monitorer les performances
Ajouter une action `log` au début et à la fin:
```json
{
  "actions": [
    { "type": "log", "message": "Début purge logs" },
    { "type": "update_many", "..." },
    { "type": "log", "message": { "concat": ["Fin purge: ", { "var": "$count" }, " items"] } }
  ]
}
```

---

## Roadmap

### Prévu V2
- Champ `cron_schedule` directement dans `quartz_automations` (pas besoin de Flow)
- UI pour éditer les expressions CRON
- Historique d'exécution par automation
- Retry automatique en cas d'erreur

### Prévu V3
- Rate limiting par automation
- Priorité d'exécution si plusieurs CRON simultanés
- Queue distribuée (BullMQ/pg-boss)

---

## Support

Pour toute question ou suggestion, voir:
- [COMMON_USECASES.md](./COMMON_USECASES.md) - Exemples d'automations
- [PITFALLS.md](./PITFALLS.md) - Pièges courants
- [FEATURE_OVERVIEW.md](./FEATURE_OVERVIEW.md) - Vue d'ensemble

---

## Résumé

✅ **CRON supporté** via endpoint `/quartz-automations/run` + Directus Flows  
✅ **Permissions** via `accountability`  
✅ **Dry-run** pour tester sans écrire  
✅ **Flexible**: item unique, filtre, ou collection entière  
✅ **Production-ready**: logs, monitoring, retry via Flows  

**Temps de setup**: 5-10 minutes par automation CRON.
