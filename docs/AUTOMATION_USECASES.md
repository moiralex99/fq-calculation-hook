# 🤖 Cas d'Usage - Automatismes Directus

## 📋 Table des Matières
1. [Cas d'Usage par Catégorie](#cas-dusage-par-catégorie)
2. [Matrice Priorité / Complexité](#matrice-priorité--complexité)
3. [Patterns Identifiés](#patterns-identifiés)
4. [Évaluation Rule Engines](#évaluation-rule-engines)
5. [Recommandation Technique](#recommandation-technique)

---

## 🎯 Cas d'Usage par Catégorie

### **Catégorie 1 : Horodatage Automatique** ⭐ PRIORITAIRE

#### UC1.1 - Date de fin de projet
```yaml
Déclencheur: status passe à "terminé"
Action: Définir date_fin = NOW()
Fréquence: Très fréquent
Complexité: ★☆☆☆☆
```

**Exemple :**
```json
{
  "name": "Horodater fin de projet",
  "collection": "projets",
  "trigger": {
    "field": "status",
    "operator": "changed_to",
    "value": "termine"
  },
  "actions": [
    {
      "type": "set_field",
      "field": "date_fin",
      "value": "NOW()"
    }
  ]
}
```

#### UC1.2 - Date de validation de commande
```yaml
Déclencheur: montant_paye >= montant_total
Action: 
  - date_validation = NOW()
  - validee_par = $USER.id
Fréquence: Fréquent (e-commerce)
Complexité: ★★☆☆☆
```

#### UC1.3 - Suivi des modifications
```yaml
Déclencheur: N'importe quelle modification
Action: 
  - date_modified = NOW()
  - modified_by = $USER.id
Fréquence: Très fréquent
Complexité: ★☆☆☆☆
```

---

### **Catégorie 2 : Workflows de Statut** ⭐ PRIORITAIRE

#### UC2.1 - Progression automatique de statut
```yaml
Cas: Ticket support
Déclencheur: reponse_client IS NOT NULL
Action: status = "en_attente_support"
Fréquence: Fréquent
Complexité: ★☆☆☆☆
```

**Exemple :**
```json
{
  "name": "Ticket en attente support",
  "collection": "tickets",
  "trigger": {
    "field": "reponse_client",
    "operator": "is_not_null"
  },
  "actions": [
    {
      "type": "set_field",
      "field": "status",
      "value": "en_attente_support"
    },
    {
      "type": "set_field",
      "field": "date_derniere_reponse",
      "value": "NOW()"
    }
  ]
}
```

#### UC2.2 - Clôture automatique de commande
```yaml
Déclencheur: date_livraison < NOW() - 30 jours ET status = "livree"
Action: status = "terminee"
Fréquence: Batch quotidien
Complexité: ★★★☆☆
```

#### UC2.3 - Validation multi-étapes
```yaml
Cas: Validation de contenu
Déclencheur: validation_juridique = true ET validation_technique = true
Action: status = "approuve"
Fréquence: Moyen
Complexité: ★★☆☆☆
```

---

### **Catégorie 3 : Champs Calculés Conditionnels** ⭐ PRIORITAIRE

#### UC3.1 - Priorité dynamique
```yaml
Déclencheur: montant_commande > 10000
Action: priorite = "haute"
Fréquence: Fréquent (e-commerce)
Complexité: ★★☆☆☆
```

**Exemple :**
```json
{
  "name": "Priorité haute pour grosses commandes",
  "collection": "commandes",
  "trigger": {
    "type": "condition",
    "expression": "montant_total > 10000"
  },
  "actions": [
    {
      "type": "set_field",
      "field": "priorite",
      "value": "haute"
    },
    {
      "type": "set_field",
      "field": "alerte_commercial",
      "value": true
    }
  ]
}
```

#### UC3.2 - Catégorisation automatique
```yaml
Cas: Segmentation client
Déclencheur: total_achats > 5000
Action: categorie = "VIP"
Fréquence: Moyen
Complexité: ★★☆☆☆
```

#### UC3.3 - Flag de risque
```yaml
Déclencheur: delai_paiement > 60 jours
Action: 
  - flag_risque = true
  - niveau_risque = "eleve"
Fréquence: Moyen
Complexité: ★★☆☆☆
```

---

### **Catégorie 4 : Valeurs par Défaut Intelligentes** ⭐ MOYEN

#### UC4.1 - Remplissage de champs dépendants
```yaml
Déclencheur: pays = "France"
Action: devise = "EUR"
Fréquence: Fréquent
Complexité: ★☆☆☆☆
```

#### UC4.2 - Numérotation automatique
```yaml
Déclencheur: Création d'une facture
Action: numero_facture = "F-" + YEAR() + "-" + NEXT_ID()
Fréquence: Fréquent
Complexité: ★★★☆☆ (nécessite compteur)
```

#### UC4.3 - Copie de données
```yaml
Déclencheur: adresse_facturation_identique = true
Action: Copier adresse_livraison → adresse_facturation
Fréquence: Fréquent
Complexité: ★★☆☆☆
```

---

### **Catégorie 5 : Notifications et Alertes** ⚠️ MOYEN (nécessite webhooks)

#### UC5.1 - Alerte stock bas
```yaml
Déclencheur: stock < seuil_alerte
Action: Envoyer email notification_stock_bas
Fréquence: Moyen
Complexité: ★★★☆☆
```

**Exemple :**
```json
{
  "name": "Alerte stock bas",
  "collection": "produits",
  "trigger": {
    "type": "condition",
    "expression": "stock < seuil_alerte"
  },
  "actions": [
    {
      "type": "set_field",
      "field": "alerte_active",
      "value": true
    },
    {
      "type": "webhook",
      "url": "https://api.notification.com/alert",
      "method": "POST",
      "body": {
        "type": "stock_bas",
        "produit_id": "$ID",
        "stock": "$stock"
      }
    }
  ]
}
```

#### UC5.2 - Notification validation
```yaml
Déclencheur: status = "en_attente_validation"
Action: Webhook vers Slack/Teams
Fréquence: Moyen
Complexité: ★★★☆☆
```

---

### **Catégorie 6 : Relations et Agrégations** ⚠️ COMPLEXE

#### UC6.1 - Mise à jour du parent
```yaml
Cas: Commande complétée
Déclencheur: Tous les line_items.status = "traite"
Action: commande.status = "complete"
Fréquence: Moyen
Complexité: ★★★★☆ (nécessite agrégation)
```

#### UC6.2 - Compteurs automatiques
```yaml
Déclencheur: Ajout d'un item dans collection_enfant
Action: parent.count_enfants += 1
Fréquence: Fréquent
Complexité: ★★★★☆
```

---

### **Catégorie 7 : Archivage et Nettoyage** ⚠️ BATCH

#### UC7.1 - Auto-archivage
```yaml
Déclencheur: date_creation < NOW() - 365 jours
Action: status = "archive"
Fréquence: Batch quotidien
Complexité: ★★★☆☆
```

#### UC7.2 - Suppression soft
```yaml
Déclencheur: deleted_at IS NOT NULL ET deleted_at < NOW() - 30 jours
Action: Supprimer définitivement
Fréquence: Batch hebdomadaire
Complexité: ★★★★☆
```

---

### **Catégorie 8 : Validations et Contraintes** ⚠️ AVANCÉ

#### UC8.1 - Validation métier
```yaml
Déclencheur: date_fin < date_debut
Action: Bloquer + message erreur
Fréquence: Fréquent
Complexité: ★★★☆☆ (nécessite throw error)
```

#### UC8.2 - Cohérence de données
```yaml
Déclencheur: montant_total != SUM(lignes.montant)
Action: Recalculer montant_total
Fréquence: Moyen
Complexité: ★★★★☆
```

---

## 📊 Matrice Priorité / Complexité

```
Priorité HAUTE + Complexité FAIBLE → MVP Phase 1
├─ UC1.1 - Date de fin de projet           ⭐⭐⭐⭐⭐ | ★☆☆☆☆
├─ UC1.3 - Suivi des modifications         ⭐⭐⭐⭐⭐ | ★☆☆☆☆
├─ UC2.1 - Progression de statut           ⭐⭐⭐⭐☆ | ★☆☆☆☆
├─ UC3.1 - Priorité dynamique              ⭐⭐⭐⭐☆ | ★★☆☆☆
└─ UC4.1 - Valeurs par défaut              ⭐⭐⭐☆☆ | ★☆☆☆☆

Priorité HAUTE + Complexité MOYENNE → Phase 2
├─ UC1.2 - Date validation commande        ⭐⭐⭐⭐☆ | ★★☆☆☆
├─ UC2.3 - Validation multi-étapes         ⭐⭐⭐☆☆ | ★★☆☆☆
├─ UC3.2 - Catégorisation client           ⭐⭐⭐☆☆ | ★★☆☆☆
└─ UC4.3 - Copie de données                ⭐⭐⭐☆☆ | ★★☆☆☆

Priorité MOYENNE + Complexité MOYENNE → Phase 3
├─ UC5.1 - Alertes (webhooks)              ⭐⭐⭐☆☆ | ★★★☆☆
├─ UC2.2 - Clôture automatique             ⭐⭐☆☆☆ | ★★★☆☆
└─ UC7.1 - Auto-archivage                  ⭐⭐☆☆☆ | ★★★☆☆

Priorité MOYENNE + Complexité HAUTE → Phase 4+ (Future)
├─ UC6.1 - Relations/Agrégations           ⭐⭐☆☆☆ | ★★★★☆
├─ UC4.2 - Numérotation automatique        ⭐⭐☆☆☆ | ★★★☆☆
└─ UC8.1 - Validations bloquantes          ⭐⭐☆☆☆ | ★★★☆☆
```

---

## 🎨 Patterns Identifiés

### **Pattern 1 : Simple Field Assignment** (80% des cas)
```javascript
WHEN <condition>
THEN SET <field> = <value>

Exemples:
- status = "termine" → date_fin = NOW()
- montant > 1000 → priorite = "haute"
- pays = "France" → devise = "EUR"
```

### **Pattern 2 : Multi-Field Update**
```javascript
WHEN <condition>
THEN 
  SET <field1> = <value1>
  AND SET <field2> = <value2>

Exemple:
- validation_ok = true → 
    status = "approuve"
    date_validation = NOW()
    validee_par = $USER.id
```

### **Pattern 3 : Conditional Value** (ternaire)
```javascript
SET <field> = IF(<condition>, <value_si_vrai>, <value_si_faux>)

Exemple:
- priorite = IF(montant > 5000, "haute", "normale")
```

### **Pattern 4 : Field Change Detection**
```javascript
WHEN <field> CHANGED TO <value>
THEN <action>

Exemple:
- status CHANGED TO "termine" → date_fin = NOW()
```

### **Pattern 5 : Field Copy**
```javascript
WHEN <field> = <value>
THEN COPY <field_source> TO <field_target>

Exemple:
- use_same_address = true → 
    COPY adresse_livraison.* TO adresse_facturation.*
```

---

## 🛠️ Évaluation Rule Engines

### **Option 1 : JSON-Based Rules (Simple)** ✅ RECOMMANDÉ PHASE 1

#### Exemple
```json
{
  "name": "Date fin projet",
  "collection": "projets",
  "when": {
    "field": "status",
    "operator": "equals",
    "value": "termine"
  },
  "then": [
    {
      "action": "set_field",
      "field": "date_fin",
      "value": "NOW()"
    }
  ]
}
```

#### Avantages
- ✅ Simple à parser et exécuter
- ✅ Facile à stocker en DB (JSONB)
- ✅ Interface UI simple (dropdowns)
- ✅ Validation stricte du schema

#### Inconvénients
- ⚠️ Pas de conditions complexes (AND/OR imbriqués)
- ⚠️ Limité aux opérateurs prédéfinis

---

### **Option 2 : Expression DSL (Mathjs)** ✅ RECOMMANDÉ PHASE 2

#### Exemple
```json
{
  "name": "Priorité dynamique",
  "collection": "commandes",
  "when": "montant_total > 5000 && client.type == 'VIP'",
  "then": [
    {
      "action": "set_field",
      "field": "priorite",
      "value": "'haute'"
    }
  ]
}
```

#### Avantages
- ✅ Expressions complexes (AND, OR, parenthèses)
- ✅ Réutilise infrastructure existante (mathjs)
- ✅ Flexible et puissant
- ✅ Facile à tester

#### Inconvénients
- ⚠️ Interface UI plus complexe (editor de code)
- ⚠️ Risque d'erreurs de syntaxe utilisateur

---

### **Option 3 : JSON Rules Engine (npm package)** ⚠️ OVERKILL

Packages: `json-rules-engine`, `nools`

#### Exemple
```json
{
  "conditions": {
    "all": [
      {
        "fact": "montant_total",
        "operator": "greaterThan",
        "value": 5000
      },
      {
        "fact": "client_type",
        "operator": "equal",
        "value": "VIP"
      }
    ]
  },
  "event": {
    "type": "set_priority_high"
  }
}
```

#### Avantages
- ✅ Très puissant (conditions imbriquées, facts dynamiques)
- ✅ Standard industriel
- ✅ Documentation riche

#### Inconvénients
- ❌ Dépendance externe lourde (~100kb)
- ❌ Courbe d'apprentissage importante
- ❌ Overhead pour des cas simples

---

### **Option 4 : Visual Flow Builder** 🎨 FUTURE

Inspiré de n8n, Zapier, Make

#### Exemple UI
```
┌─────────────────────────────────┐
│  TRIGGER                        │
│  ┌───────────────────────────┐  │
│  │ When: status                │
│  │ Changes to: "terminé"       │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
           ↓
┌─────────────────────────────────┐
│  ACTION 1                       │
│  ┌───────────────────────────┐  │
│  │ Set Field: date_fin         │
│  │ Value: NOW()                │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
           ↓
┌─────────────────────────────────┐
│  ACTION 2                       │
│  ┌───────────────────────────┐  │
│  │ Webhook: notify.com         │
│  │ Method: POST                │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

#### Avantages
- ✅ UX exceptionnelle
- ✅ Pas d'erreur de syntaxe
- ✅ Très marketable

#### Inconvénients
- ❌ Développement lourd (2-3 semaines)
- ❌ Nécessite framework UI (Vue Flow, React Flow)

---

## 💡 Recommandation Technique

### **Approche Hybride Progressive** ⭐ OPTIMAL

#### **Phase 1 : MVP Simple JSON** (1-2 semaines)
```json
{
  "trigger": {
    "type": "field_equals",
    "field": "status",
    "value": "termine"
  },
  "actions": [
    {
      "type": "set_field",
      "field": "date_fin",
      "value": "NOW()"
    }
  ]
}
```

**Opérateurs supportés Phase 1 :**
- `field_equals`
- `field_not_equals`
- `field_greater_than`
- `field_less_than`
- `field_is_null`
- `field_is_not_null`
- `field_changed_to`

**Actions supportées Phase 1 :**
- `set_field` (valeurs: NOW(), $USER.id, literal)

---

#### **Phase 2 : Ajout Expressions** (1 semaine)
```json
{
  "trigger": {
    "type": "expression",
    "expression": "montant > 5000 && status == 'active'"
  },
  "actions": [
    {
      "type": "set_field",
      "field": "priorite",
      "value": "IF(montant > 10000, 'tres_haute', 'haute')"
    }
  ]
}
```

**Utilise mathjs existant** → Pas de nouvelle dépendance

---

#### **Phase 3 : Actions Avancées** (2 semaines)
```json
{
  "actions": [
    {
      "type": "webhook",
      "url": "https://api.example.com/notify",
      "method": "POST",
      "headers": {
        "Authorization": "Bearer ${env.API_KEY}"
      },
      "body": {
        "id": "$ID",
        "status": "$status"
      }
    },
    {
      "type": "copy_field",
      "from": "adresse_livraison",
      "to": "adresse_facturation"
    }
  ]
}
```

---

#### **Phase 4 : Visual Builder** (3-4 semaines)
Interface drag & drop pour créer les rules visuellement

---

## 📋 Structure Finale Recommandée

### **Table : `quartz_automations`**
```sql
CREATE TABLE quartz_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Métadonnées
  name VARCHAR(255) NOT NULL,
  description TEXT,
  collection VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',    -- 'active' | 'draft' | 'disabled'
  priority INTEGER DEFAULT 10,            -- Ordre d'exécution (1 = premier)
  
  -- Trigger (JSON)
  trigger JSONB NOT NULL,
  /*
    Exemples:
    { "type": "field_equals", "field": "status", "value": "termine" }
    { "type": "expression", "expression": "montant > 5000" }
    { "type": "field_changed_to", "field": "status", "value": "termine" }
  */
  
  -- Actions (JSON Array)
  actions JSONB NOT NULL,
  /*
    Exemples:
    [
      { "type": "set_field", "field": "date_fin", "value": "NOW()" },
      { "type": "webhook", "url": "...", "method": "POST" }
    ]
  */
  
  -- Conditions supplémentaires (optionnel)
  conditions JSONB,
  /*
    { "only_on_create": true }
    { "only_on_update": true }
    { "only_if_field_changed": ["status", "montant"] }
  */
  
  -- Métriques
  execution_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMP,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  
  -- Audit
  created_by UUID REFERENCES directus_users(id),
  date_created TIMESTAMP DEFAULT NOW(),
  date_updated TIMESTAMP DEFAULT NOW(),
  
  -- Index
  CONSTRAINT unique_automation_name UNIQUE (collection, name)
);

CREATE INDEX idx_automations_collection ON quartz_automations(collection);
CREATE INDEX idx_automations_status ON quartz_automations(status);
CREATE INDEX idx_automations_priority ON quartz_automations(priority);
```

---

## 🎯 Roadmap Exécution

### **Sprint 1 : Fondations** (3-5 jours)
- [ ] Créer table `quartz_automations`
- [ ] Parser JSON triggers (types: field_equals, field_changed_to)
- [ ] Exécuteur actions (type: set_field uniquement)
- [ ] Tests unitaires (10 cas)

### **Sprint 2 : Integration Hook** (2-3 jours)
- [ ] Hook `items.create` / `items.update`
- [ ] Chargement automations au démarrage
- [ ] Cache en mémoire
- [ ] Logs d'exécution

### **Sprint 3 : Interface UI** (3-5 jours)
- [ ] Module Directus "Automatismes"
- [ ] Liste des automatismes
- [ ] Formulaire création simple (dropdowns)
- [ ] Test/Debug d'un automatisme

### **Sprint 4 : Expressions** (2-3 jours)
- [ ] Support `type: expression` dans triggers
- [ ] Intégration mathjs
- [ ] Editor de code dans UI
- [ ] Validation syntaxe

### **Sprint 5 : Actions Avancées** (3-5 jours)
- [ ] Action `webhook`
- [ ] Action `copy_field`
- [ ] Gestion erreurs + retry
- [ ] Métriques (execution_count, error_count)

---

## ✅ Décision à Prendre

**Questions pour vous :**

1. **MVP Phase 1 suffit-il ?** (Simple JSON, 5 opérateurs, set_field uniquement)
2. **Besoin immédiat de webhooks ?** (Sinon on diffère en Phase 3)
3. **Interface admin suffit-elle ?** (Ou besoin interface end-user ?)
4. **Priorité sur quels cas d'usage ?** (UC1.1-1.3 + UC2.1 + UC3.1 ?)

**Ma recommandation :**
> Commencer par **Simple JSON (Phase 1)** couvrant 80% des besoins.  
> Si succès → Ajouter expressions (Phase 2) pour les 15% restants.  
> Webhooks en Phase 3 seulement si demande client forte.

---

**Date :** 2025-10-18  
**Prochaine étape :** Valider les priorités puis scaffolder `fq-automation-hook`
