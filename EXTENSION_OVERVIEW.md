# 🧮 Formula Engine - Extension Directus

Une extension puissante pour Directus permettant de **définir, gérer et exécuter des formules de calcul** sur vos collections en temps réel. Parfaite pour les SaaS utilisant Directus comme backend.

## 📋 Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Architecture](#architecture)
- [Fonctionnalités](#fonctionnalités)
- [Installation](#installation)
- [Utilisation](#utilisation)
- [Cas d'usage](#cas-dusage)
- [Configuration](#configuration)

---

## 🎯 Vue d'ensemble

**Formula Engine** est une extension Directus qui automatise le calcul de champs dérivés et d'agrégations sur vos collections de données.

### Caractéristiques principales
✅ **Formules dynamiques** : Définissez des formules avec un DSL puissant  
✅ **Recalcul automatique** : Met à jour les formules quand les données changent  
✅ **Recalcul manuel** : Interface admin pour déclencher les calculs  
✅ **Filtrage** : Appliquez des filtres pour cibler des items spécifiques  
✅ **Batch optimisé** : Traitement par lots pour éviter la surcharge  
✅ **Exclusion archivés** : Ignorez automatiquement les items archivés  

---

## 🏗️ Architecture

### Structure globale

```
┌─────────────────────────────────────────────────────────────┐
│                      DIRECTUS BACKEND                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         FORMULA ENGINE EXTENSION                     │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │                                                      │  │
│  │  ┌─────────────────────────────────────────────┐   │  │
│  │  │  Module Admin UI (Formula Engine)           │   │  │
│  │  │  - Sélection collection                     │   │  │
│  │  │  - Sélection champs à recalculer           │   │  │
│  │  │  - Filtres personnalisés                    │   │  │
│  │  │  - Lancement recalcul + suivi              │   │  │
│  │  └─────────────────────────────────────────────┘   │  │
│  │           ⬇️ API Request                            │  │
│  │  ┌─────────────────────────────────────────────┐   │  │
│  │  │  Endpoint: /realtime-calc/recalculate       │   │  │
│  │  │  - Récupère les formules                    │   │  │
│  │  │  - Analyse dépendances                      │   │  │
│  │  │  - Exécute les calculs                      │   │  │
│  │  │  - Retourne les résultats                   │   │  │
│  │  └─────────────────────────────────────────────┘   │  │
│  │           ⬇️ Updates                                │  │
│  │  ┌─────────────────────────────────────────────┐   │  │
│  │  │  Webhook Hook System                        │   │  │
│  │  │  - Détecte les changements                  │   │  │
│  │  │  - Construit graphe de dépendances         │   │  │
│  │  │  - Déclenche recalculs auto                │   │  │
│  │  └─────────────────────────────────────────────┘   │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Base de Données (Collections)               │  │
│  │                                                      │  │
│  │  ┌─────────────────┐  ┌─────────────────┐         │  │
│  │  │ quartz_formulas │  │ Données Métier  │         │  │
│  │  │ (Définition des │  │ (Products, etc) │         │  │
│  │  │  formules)      │  │                 │         │  │
│  │  └─────────────────┘  └─────────────────┘         │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Composants

### 1. **Module Admin (Interface utilisateur)**
Fichier: `module-recalc/src/module.vue`

Interface professionnelle permettant aux administrateurs de :
- 🔍 **Rechercher** collections et champs
- ✅ **Sélectionner** les formules à recalculer
- 🔧 **Configurer** filtres et options
- ⏱️ **Suivre** la progression en temps réel
- 📊 **Visualiser** les résultats

**Caractéristiques UI:**
- Layout ultra-compact (une page, pas de scroll)
- Recherche en temps réel pour collections et champs
- Checkbox "Exclure archivés" visible dans le header du filtre
- Affichage des formules récentes triées par date_updated
- Stats cards pour les totaux
- Progress bar pendant l'exécution

### 2. **Endpoint API**
Fichier: `src/endpoint.js`

Point d'entrée pour les requêtes de recalcul :
```
POST /realtime-calc/utils/realtime-calc.recalculate-collection
```

**Payload:**
```json
{
  "collection": "products",
  "fields": ["price_ttc", "total_stock"],
  "filter": { "status": { "_eq": "published" } },
  "dryRun": false,
  "batchSize": 100
}
```

**Réponse:**
```json
{
  "success": true,
  "message": "Recalcul terminé",
  "processed": 145,
  "updated": 142,
  "total": 150
}
```

### 3. **Moteur de Formules**
Fichier: `src/formula-engine.js`

Exécute les calculs avec support pour :
- **Fonctions d'agrégation** : `SUM()`, `AVG()`, `COUNT()`, `MAX()`, `MIN()`
- **Opérateurs** : `+`, `-`, `*`, `/`, `%`
- **Conditions** : `IF()`, `AND()`, `OR()`
- **Dates** : manipulation et calcul sur les dates
- **Texte** : concaténation, conversion

Exemple de formule:
```javascript
SUM(order_items.price * order_items.quantity) * (1 + tax_rate / 100)
```

### 4. **Analyseur de Dépendances**
Fichier: `src/dependency-graph.js`

Construit un **graphe de dépendances** pour :
- Identifier les formules qui dépendent l'une de l'autre
- Calculer dans le bon ordre (pas de dépendance circulaire)
- Déclencher uniquement les recalculs nécessaires

**Exemple de graphe:**

```
┌─────────────────────────────────────────┐
│   Products (collection)                 │
├─────────────────────────────────────────┤
│                                         │
│   price_ht ─┐                          │
│             ├──> price_ttc             │
│   tax_rate ─┤                          │
│             └──> total_tax             │
│                                         │
│   stock ─┐                             │
│          ├──> is_available             │
│   reserved ──┘                         │
│                                         │
└─────────────────────────────────────────┘
         ⬇️ Recalcul Order
   1. price_ht (aucune dépendance)
   2. tax_rate (aucune dépendance)
   3. price_ttc (dépend de 1,2)
   4. total_tax (dépend de 1,2)
   5. stock, reserved (indépendants)
   6. is_available (dépend de 5)
```

### 5. **Hook System (Recalcul Automatique)**
Fichier: `src/index.js`

Webhooks Directus qui :
- 🔔 **Écoutent** les changements de données
- 📍 **Identifient** les collections affectées
- 🔗 **Retrouvent** toutes les formules dépendantes
- 🔄 **Déclenchent** les recalculs en background

---

## 🚀 Fonctionnalités

### 1. Formules Dynamiques
Stockées dans la collection `quartz_formulas` :

```
┌──────────────────────────────────────┐
│ quartz_formulas                      │
├──────────────────────────────────────┤
│ id              | uuid               │
│ collection_cible| string (products)  │
│ champ_cible     | string (price_ttc) │
│ formula         | text               │
│ scope           | enum (item/global) │
│ status          | enum (active)      │
│ date_created    | datetime           │
│ date_updated    | datetime           │
└──────────────────────────────────────┘
```

### 2. Recalcul Manuel via Module Admin

```
┌─────────────────────────────────────────────────┐
│  Formula Engine Module                          │
├─────────────────────────────────────────────────┤
│                                                 │
│  📊 Résultats précédents                       │
│  ├─ Traités: 150                              │
│  ├─ Mises à jour: 148                         │
│  └─ Total: 150                                │
│                                                 │
│  ⚙️ Configuration                              │
│  ├─ Collection: [products       ▼]            │
│  │   🔍 Chercher une collection...            │
│  │                                            │
│  ├─ Champs à recalculer:                      │
│  │   🔍 Chercher un champ...                 │
│  │   ☑️ Sélectionner tout                    │
│  │   ☑️ price_ttc                            │
│  │   ☑️ total_stock                          │
│  │   ☐ is_available                          │
│  │                                            │
│  ├─ Filtre (optionnel):                       │
│  │   [Exclure archivés] ✓                     │
│  │   {"status": {"_eq": "published"}}         │
│  │                                            │
│  ├─ Taille de batch: [100]                    │
│  ├─ Mode dry-run: [ ]                         │
│  │                                            │
│  └─ [▶ Lancer le recalcul]                   │
│                                                 │
│  📈 Statistiques                              │
│  ├─ Total formules: 12                       │
│  └─ Collections: 5                            │
│                                                 │
│  ⏱️ Formules récentes                         │
│  ├─ products > price_ttc (il y a 2h)         │
│  ├─ orders > total (il y a 1j)               │
│  └─ ...                                       │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 3. Recalcul Automatique

Flux d'exécution automatique :

```
1️⃣  Admin met à jour "tax_rate" dans products/123

2️⃣  Webhook détecte le changement
    Événement: item.update
    Collection: products
    Item ID: 123

3️⃣  Système analyse les dépendances
    "Quels champs dépendent de tax_rate ?"
    → price_ttc, total_tax

4️⃣  Récupère les formules concernées
    price_ttc_formula
    total_tax_formula

5️⃣  Exécute les recalculs (ordre correct)
    ├─ Recalcul price_ttc pour products/123
    └─ Recalcul total_tax pour products/123

6️⃣  Met à jour la base de données
    UPDATE products SET price_ttc=..., total_tax=...
    WHERE id=123

7️⃣  Retour au frontend
    "Mise à jour réussie ✓"
```

### 4. Filtrage Intelligent

```
Filtre "Exclure archivés" (coché par défaut)
  └─ Ajoute automatiquement: { status: { _neq: "archived" } }

Filtre utilisateur:
  {"updated_at": { "_gt": "2025-01-01" }}

Résultat final (fusion intelligente avec _and):
  {
    "_and": [
      { "status": { "_neq": "archived" } },
      { "updated_at": { "_gt": "2025-01-01" } }
    ]
  }
```

---

## 📊 Cas d'usage

### 1. E-commerce SaaS

**Scénario:** Calculer automatiquement le prix TTC et le total de commande

```javascript
// Formule 1: Prix TTC par produit
products.price_ttc = products.price_ht * (1 + products.tax_rate / 100)

// Formule 2: Total commande
orders.total = SUM(order_items.price_ttc * order_items.quantity)

// Formule 3: Total avec remise
orders.total_final = orders.total - (orders.total * orders.discount / 100)
```

**Flux:** Admin crée une commande → Webhook ajoute des items → Recalcul auto du total

### 2. Gestion de Projets

**Scénario:** Calculer la progression et le budget restant

```javascript
// Formule 1: Progression
projects.progress = COUNT(tasks WHERE status = "done") / COUNT(tasks) * 100

// Formule 2: Budget utilisé
projects.budget_used = SUM(expenses.amount)

// Formule 3: Budget restant
projects.budget_remaining = projects.budget_allocated - projects.budget_used
```

### 3. CRM

**Scénario:** Scorer les leads automatiquement

```javascript
// Formule: Lead Score
leads.score = 
  (leads.engagement_count * 5) +
  (IF(leads.company_size > 100, 20, 0)) +
  (IF(leads.budget > 50000, 30, 0)) +
  (IF(DAYS_SINCE(leads.last_contact) < 7, 15, 0))
```

---

## ⚙️ Configuration

### Collection `quartz_formulas`

Structure recommandée :

```sql
CREATE TABLE quartz_formulas (
  id UUID PRIMARY KEY,
  collection_cible VARCHAR(255) NOT NULL,
  champ_cible VARCHAR(255) NOT NULL,
  formula TEXT NOT NULL,
  scope ENUM('item', 'global') DEFAULT 'item',
  status ENUM('active', 'inactive', 'archived') DEFAULT 'active',
  description TEXT,
  date_created TIMESTAMP DEFAULT NOW(),
  date_updated TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);
```

### Variables d'environnement

```env
# (À ajouter selon votre configuration Directus)
FORMULA_ENGINE_BATCH_SIZE=100
FORMULA_ENGINE_TIMEOUT=30000
```

---

## 🔄 Flux de Recalcul Détaillé

```
┌─────────────────────────────────────────────────────────┐
│ UTILISATEUR CLIQUE: "Lancer le recalcul"                │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
        ┌─────────────────────────┐
        │ Validation des données  │
        │ ✓ Collection sélectionnée
        │ ✓ Au moins 1 champ      │
        │ ✓ Filtre JSON valide    │
        └────────┬────────────────┘
                 │
                 ▼
    ┌────────────────────────────────┐
    │ Envoi au backend               │
    │ POST /realtime-calc/utils/... │
    │ Payload: {...}                 │
    └────────┬───────────────────────┘
             │
             ▼
    ┌────────────────────────────────────┐
    │ Backend: Récupère les formules      │
    │ FROM quartz_formulas               │
    │ WHERE collection_cible = "products"│
    └────────┬─────────────────────────────┘
             │
             ▼
    ┌────────────────────────────────────┐
    │ Construit le graphe de dépendances │
    │ (ordre d'exécution)                │
    └────────┬─────────────────────────────┘
             │
             ▼
    ┌────────────────────────────────────┐
    │ Traite par batches (100 items)     │
    │ Pour chaque batch:                 │
    │  1. Récupère les données           │
    │  2. Exécute les formules           │
    │  3. Met à jour DB                  │
    └────────┬─────────────────────────────┘
             │
             ▼
    ┌────────────────────────────────────┐
    │ Retourne les résultats             │
    │ {                                  │
    │   success: true,                   │
    │   processed: 150,                  │
    │   updated: 148,                    │
    │   message: "Recalcul terminé"      │
    │ }                                  │
    └────────┬─────────────────────────────┘
             │
             ▼
        ┌──────────────────────┐
        │ Frontend: Affiche    │
        │ les résultats dans   │
        │ la section "Résultats│
        │ précédents" en haut  │
        └──────────────────────┘
```

---

## 🛠️ Développement

### Structure du code

```
fq-calculation-hook/
├── src/
│   ├── index.js                 # Entry point + hooks
│   ├── endpoint.js              # API endpoint
│   ├── formula-engine.js        # Moteur d'exécution
│   ├── formula-analyzer.js      # Parsing & validation
│   ├── dsl-parser.js            # Parser DSL
│   ├── dependency-graph.js      # Graphe de dépendances
│   ├── update-batcher.js        # Traitement par batch
│   └── formula-loader.js        # Chargement formules
│
├── module-recalc/               # Module Admin
│   └── src/
│       ├── index.js             # Définition module
│       ├── module.vue           # Interface Vue3
│       └── ...
│
├── scripts/                     # Utilitaires
│   ├── recalc-collection.mjs
│   ├── recalc-all.mjs
│   └── ...
│
├── tests/                       # Tests & setup
│   └── ...
│
└── docs/                        # Documentation
    └── ...
```

---

## 📈 Performance

### Optimisations

✅ **Batch processing** : Traite 100 items à la fois (configurable)  
✅ **Lazy evaluation** : N'exécute que les formules nécessaires  
✅ **Dependency tracking** : Évite les recalculs redondants  
✅ **Async operations** : N'interrompt pas Directus  

### Limites recommandées

| Métrique | Recommandation |
|----------|----------------|
| Formules par collection | < 50 |
| Complexité formule | O(n) max |
| Items par batch | 100-500 |
| Timeout exécution | 30s |

---

## 🎯 Avantages pour votre SaaS

| Bénéfice | Description |
|----------|------------|
| **Automatisation** | Plus besoin de code côté backend pour les calculs |
| **Flexibilité** | Modifiez les formules sans redéployer |
| **Performance** | Batch & optimisations réduisent la charge |
| **Debugging** | Interface admin pour monitorer & tester |
| **Scalabilité** | Prêt pour des milliers d'items |
| **UX** | Résultats instantanés pour l'admin |

---

## 📝 Licence

Extension propriétaire pour Flow SaaS

---

**Développé avec ❤️ pour Directus**
