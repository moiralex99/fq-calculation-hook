# Extension Directus - Calculs Temps Réel (Version Simplifiée)

## 🎯 Vue d'ensemble

Cette extension **réutilise** les composants de FlowQuartz Engine pour faire des calculs en temps réel sur **une même fiche** uniquement (pas d'héritage ni consolidation).

### Différences avec l'engine complet

| Feature | Engine Complet | Extension Temps Réel |
|---------|---------------|---------------------|
| **Périmètre** | Toutes les collections | Une fiche à la fois |
| **Héritage** | ✅ LOOKUP, PARENT | ❌ Non supporté |
| **Agrégations** | ✅ SUM, AVG sur relations | ❌ Non supporté |
| **Base de calcul** | DuckDB (SQL) | JavaScript (mathjs) |
| **Déclenchement** | Batch / Webhook | Hook create/update |
| **Performance** | Optimisé pour gros volumes | Optimisé pour temps réel |

## 📋 Cahier des charges

✅ **Réutiliser les formules de quartz_formulas**
- Charger depuis la même table que l'engine
- Format identique: `collection_cible`, `champ_cible`, `formula`, `status`

✅ **Tri formules locales vs dépendantes**
- Détecter automatiquement les formules qui ne nécessitent pas de relations
- Pattern matching: `LOOKUP()`, `PARENT()`, `{{Collection.field}}`, etc.
- Ne garder que les formules **locales** (champs de la même fiche)

✅ **Traduction DSL → JavaScript**
- Réutiliser le DSL de l'engine: `{{field}}`, `IF()`, `COALESCE()`, etc.
- Traduire vers JavaScript au lieu de SQL
- Garder la même syntaxe pour l'utilisateur

✅ **Arbre de dépendances local**
- Analyser les dépendances entre champs calculés
- Ordre de calcul optimal (tri topologique)
- Détection des cycles

✅ **Exécution sur create/update**
- Hook Directus avant l'enregistrement
- Recalcul intelligent (seulement si nécessaire)

✅ **Optimisation: ne pas écrire si inchangé**
- Comparer valeur avant/après
- Ne mettre à jour que si différent
- Tolérance pour les flottants

## 🔧 Structure de la table quartz_formulas

```sql
CREATE TABLE quartz_formulas (
  id SERIAL PRIMARY KEY,
  collection_cible VARCHAR,  -- Collection cible (ex: "factures")
  champ_cible VARCHAR,       -- Champ à calculer (ex: "total_ttc")
  formula TEXT,              -- Formule DSL (ex: "{{total_ht}} * 1.2")
  status VARCHAR,            -- published | draft | archived
  sort INT,                  -- Ordre d'exécution suggéré
  description TEXT,          -- Description pour l'utilisateur
  date_created TIMESTAMP,
  date_updated TIMESTAMP,
  user_created UUID,
  user_updated UUID
);
```

## 📚 DSL supporté (subset du DSL complet)

### ✅ Formules locales supportées

```javascript
// Champs de la même fiche
{{field_name}}

// Arithmétique
{{prix}} * {{quantite}}
{{montant}} / 100

// Conditions
IF({{quantite}} > 10, "Gros", "Petit")
IF({{status}} = "actif", 1, 0)

// Fonctions utilitaires
COALESCE({{description}}, "Vide")
NULLIF({{valeur}}, 0)
ROUND({{montant}}, 2)

// Logique
{{a}} AND {{b}}
{{a}} OR {{b}}
NOT {{condition}}

// Comparaisons
{{prix}} > 100
{{status}} = "actif"
{{date}} >= "2024-01-01"

// Fonctions de texte
CONCAT({{prenom}}, " ", {{nom}})
UPPER({{nom}})
LOWER({{email}})
```

### ❌ Formules NON supportées (nécessitent l'engine complet)

```javascript
// Relations/Agrégations
SUM({{Actions.effort_estime}})
AVG({{Taches.heures}})
COUNT({{Phases.*}})

// Lookups/Héritage
LOOKUP({{Phase.budget}})
PARENT({{Projet.nom}})

// Références croisées
{{Collection.field}}  // Si Collection ≠ collection courante
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Directus Extension                      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  1. FormulaLoader (src/formula-loader.js)                │
│     - Lit quartz_formulas depuis Directus               │
│     - Filtre les formules locales                        │
│     - Cache (TTL 1 min)                                  │
│                                                           │
│  2. DSLTranslator (src/dsl-translator.js)                │
│     - Parse le DSL (même syntaxe que l'engine)          │
│     - Traduit DSL → JavaScript (au lieu de SQL)         │
│     - Extrait les dépendances                            │
│                                                           │
│  3. DependencyGraph (src/dependency-graph.js)            │
│     - Construit le graphe de dépendances                 │
│     - Tri topologique (algorithme de Kahn)               │
│     - Détecte les cycles                                 │
│     - Optimise l'ordre de calcul                         │
│                                                           │
│  4. CalculationEngine (src/calculation-engine.js)        │
│     - Évalue les formules en JavaScript                 │
│     - Applique l'ordre de calcul                         │
│     - Compare avant/après                                │
│     - Ne retourne que les changements                    │
│                                                           │
│  5. DirectusHook (src/index.js)                          │
│     - Hook sur items.create                              │
│     - Hook sur items.update                              │
│     - Actions: test-formula, reload-formulas             │
│                                                           │
└─────────────────────────────────────────────────────────┘
         ▲                                    │
         │                                    ▼
┌────────┴─────────┐              ┌──────────────────┐
│  quartz_formulas │              │  Collections     │
│  (Config DB)     │              │  (Data)          │
└──────────────────┘              └──────────────────┘
```

## 🔄 Flow d'exécution

### 1. Chargement initial (au démarrage de Directus)

```javascript
// Extension se charge
loadFormulasAndBuildGraphs()
  ├─> FormulaLoader.loadFormulas()
  │   └─> SELECT * FROM quartz_formulas WHERE status = 'published'
  │
  ├─> FormulaLoader.filterLocalFormulas()
  │   └─> Filtre: pas de LOOKUP, PARENT, {{Coll.field}}, etc.
  │
  └─> DependencyGraph.analyze()
      └─> Pour chaque collection:
          ├─> Extraire dépendances de chaque formule
          ├─> Construire le graphe
          ├─> Tri topologique
          └─> Stocker l'ordre de calcul
```

### 2. Création d'un item (Hook items.create)

```javascript
filter('items.create', async (input, meta) => {
  collection = meta.collection
  
  // 1. Charger config si besoin
  if (!formulaConfigs[collection]) {
    await loadFormulasAndBuildGraphs()
  }
  
  // 2. Calculer les champs dans l'ordre
  calculationOrder = dependencyGraphs[collection].order
  
  for (fieldName of calculationOrder) {
    formula = formulaConfigs[collection][fieldName]
    
    // 3. Traduire DSL → JS
    jsExpression = DSLTranslator.translate(formula)
    
    // 4. Évaluer
    input[fieldName] = evaluate(jsExpression, input)
  }
  
  return input
})
```

### 3. Mise à jour d'un item (Hook items.update)

```javascript
filter('items.update', async (input, meta) => {
  collection = meta.collection
  
  // 1. Récupérer données existantes
  existingData = await ItemsService.readOne(meta.keys[0])
  mergedData = { ...existingData, ...input }
  
  // 2. Optimisation: identifier champs modifiés
  changedFields = Object.keys(input)
  
  // 3. Graphe de dépendances: trouver champs affectés
  affectedFields = DependencyGraph.getAffectedFields(
    graph, 
    changedFields
  )
  
  // 4. Calculer seulement les champs affectés
  updates = {}
  for (fieldName of affectedFields) {
    formula = formulaConfigs[collection][fieldName]
    newValue = evaluate(formula, mergedData)
    oldValue = mergedData[fieldName]
    
    // 5. OPTIMISATION: ne mettre à jour que si changé
    if (!valuesAreEqual(oldValue, newValue)) {
      updates[fieldName] = newValue
    }
  }
  
  return { ...input, ...updates }
})
```

## 📊 Exemples de formules

### Facture simple

```javascript
// Table: quartz_formulas
{
  collection_cible: "factures",
  champ_cible: "total_ht",
  formula: "{{quantite}} * {{prix_unitaire}}",
  status: "published"
}

{
  collection_cible: "factures",
  champ_cible: "montant_tva",
  formula: "{{total_ht}} * {{taux_tva}} / 100",
  status: "published"
}

{
  collection_cible: "factures",
  champ_cible: "total_ttc",
  formula: "{{total_ht}} + {{montant_tva}}",
  status: "published"
}
```

**Ordre de calcul détecté automatiquement:**
1. `total_ht` (dépend de: quantite, prix_unitaire)
2. `montant_tva` (dépend de: total_ht, taux_tva)
3. `total_ttc` (dépend de: total_ht, montant_tva)

### Avec conditions

```javascript
{
  collection_cible: "commandes",
  champ_cible: "remise",
  formula: "IF({{montant}} > 1000, {{montant}} * 0.1, 0)",
  status: "published"
}

{
  collection_cible: "commandes",
  champ_cible: "total_final",
  formula: "{{montant}} - {{remise}}",
  status: "published"
}
```

## 🚀 Installation

### 1. Créer la structure

```bash
cd extensions/hooks
mkdir directus-extension-realtime-calc
cd directus-extension-realtime-calc
```

### 2. Copier les fichiers

```
directus-extension-realtime-calc/
├── package.json
├── src/
│   ├── index.js                # Hook principal
│   ├── formula-loader.js       # Chargement depuis quartz_formulas
│   ├── dsl-translator.js       # DSL → JavaScript
│   ├── dependency-graph.js     # Analyse de dépendances
│   └── calculation-engine.js   # Évaluation des formules
└── README.md
```

### 3. Installer et builder

```bash
npm install
npm run build
```

### 4. Redémarrer Directus

```bash
# Retour à la racine Directus
cd ../../../
npm run start
```

## 🧪 Testing

### Test d'une formule

```bash
POST /utils/realtime-calc.test-formula
{
  "formula": "{{quantite}} * {{prix_unitaire}}",
  "sampleData": {
    "quantite": 5,
    "prix_unitaire": 19.99
  }
}

# Response
{
  "valid": true,
  "result": 99.95,
  "isLocal": true,
  "fields": ["quantite", "prix_unitaire"]
}
```

### Recharger les formules

```bash
POST /utils/realtime-calc.reload-formulas

# Response
{
  "success": true,
  "message": "Reloaded 15 formula(s) from 3 collection(s)",
  "stats": {
    "collections": 3,
    "totalFormulas": 15
  }
}
```

## 📈 Performance

- **Chargement initial:** ~100ms (avec cache de 1 min)
- **Calcul par item:** ~5-10ms pour 3-5 formules
- **Optimisation update:** Seulement les champs affectés
- **Comparaison valeurs:** Évite les écritures inutiles

## 🎓 Limites et recommandations

### ✅ Bon cas d'usage
- Calculs sur la même fiche
- Feedback immédiat à l'utilisateur
- Formules simples (arithmétique, conditions)
- < 10 champs calculés par collection

### ❌ Mauvais cas d'usage
- Agrégations sur relations (utilisez l'engine)
- Héritage de valeurs parentes (utilisez l'engine)
- Calculs très complexes (utilisez l'engine)
- Gros volumes en batch (utilisez l'engine)

## 🔗 Liens

- **Engine complet:** Pour les cas avancés (héritage, agrégations, consolidation)
- **Documentation DSL:** `docs/FORMULA_FUNCTIONS.md`
- **Architecture:** `docs/ARCHITECTURE_FLOW.md`
