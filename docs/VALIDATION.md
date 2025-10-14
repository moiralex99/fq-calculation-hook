# ✅ Cahier des charges - VALIDÉ

## 📋 Objectif

Créer une extension Directus **indépendante** qui fait des calculs en temps réel sur une même fiche, en **réutilisant la logique** de FlowQuartz Engine mais sans dépendance Python.

## ✅ Requirements - Status

### 1. ✅ Chercher les formules depuis quartz_formulas

**Implémenté dans :** `src/formula-loader.js`

```javascript
// Lecture depuis la vraie table quartz_formulas
const formulas = await this.database('quartz_formulas')
  .select('*')
  .where('status', 'published')
  .orderBy('collection_cible', 'asc')  // ✅ Champ réel de l'engine
  .orderBy('champ_cible', 'asc');      // ✅ Champ réel de l'engine
```

**Format supporté :**
- `collection_cible` : nom de la collection
- `champ_cible` : nom du champ à calculer
- `formula` : formule DSL (format engine Python)
- `status` : published/draft/archived
- `sort` : ordre d'exécution suggéré

### 2. ✅ Tri automatique : formules locales vs dépendantes

**Implémenté dans :** `src/dsl-parser.js` + `src/formula-loader.js`

```javascript
isLocalFormula(formula) {
  // Détecte les patterns NON locaux :
  // - {{Collection.field}}
  // - LOOKUP(), PARENT(), CHILDREN()
  // - SUM(), AVG(), COUNT() (agrégations)
  // - MIN(), MAX(), COUNT_DISTINCT()
  
  return !hasNonLocalPatterns(formula);
}
```

**Résultat :**
```
[FormulaLoader] Loaded 20 formula(s)
[FormulaLoader] Filtered out 5 non-local formula(s) (require full engine)
[FormulaLoader] 15 local formula(s) ready for real-time calc
```

### 3. ✅ Traduction DSL → JavaScript (au lieu de SQL)

**Implémenté dans :** `src/dsl-parser.js`

**Transformation :**
```javascript
// DSL Input (format engine Python)
"{{prix}} * {{quantite}}"
"IF({{stock}} < 10, 'Alerte', 'OK')"
"COALESCE({{description}}, 'Vide')"

// ↓ Traduit en JavaScript

// JavaScript Output
"(data.prix ?? 0) * (data.quantite ?? 0)"
"IF((data.stock ?? 0) < 10, 'Alerte', 'OK')"
"COALESCE(data.description, 'Vide')"

// ↓ Évalué avec helpers

function(data, helpers) {
  return (data.prix ?? 0) * (data.quantite ?? 0);
}
```

**DSL Supporté :**
- ✅ Champs : `{{field}}` (locaux uniquement)
- ✅ Arithmétique : `+`, `-`, `*`, `/`, `%`
- ✅ Comparaisons : `=`, `<>`, `!=`, `<`, `<=`, `>`, `>=`
- ✅ Logique : `AND`, `OR`, `NOT`
- ✅ Fonctions : `IF()`, `COALESCE()`, `ROUND()`, `NULLIF()`
- ✅ Texte : `UPPER()`, `LOWER()`, `CONCAT()`

### 4. ✅ Construction des arbres de dépendances locaux

**Implémenté dans :** `src/dependency-graph.js`

**Process :**
```javascript
// 1. Parser extrait les dépendances
formula: "{{total_ht}} + {{montant_tva}}"
dependencies: ["total_ht", "montant_tva"]

// 2. Graphe construit
graph = {
  total_ht: { dependencies: ["quantite", "prix_unitaire"], dependents: ["total_ttc"] },
  montant_tva: { dependencies: ["total_ht", "taux_tva"], dependents: ["total_ttc"] },
  total_ttc: { dependencies: ["total_ht", "montant_tva"], dependents: [] }
}

// 3. Tri topologique (Algorithme de Kahn)
order = ["total_ht", "montant_tva", "total_ttc"]

// 4. Détection des cycles
cycles = [] // Aucun cycle détecté ✅
```

**Optimisation :**
```javascript
// Si on modifie seulement "quantite"
changedFields = ["quantite"]

// L'arbre identifie les champs affectés
affectedFields = ["total_ht", "total_ttc"] // montant_tva pas affecté

// Ordre optimisé
calculationOrder = ["total_ht", "total_ttc"] // Skip montant_tva
```

### 5. ✅ Exécution à chaque Création/Modification

**Implémenté dans :** `src/index.js`

**Hooks Directus :**
```javascript
// Hook AVANT création
filter('items.create', async (input, meta) => {
  // Charge formules si besoin
  await loadFormulasAndBuildGraphs();
  
  // Calcule tous les champs dans l'ordre
  const { updates } = calculateFields(collection, input);
  
  // Merge et retourne
  return { ...input, ...updates };
});

// Hook AVANT modification
filter('items.update', async (input, meta) => {
  // Récupère données existantes
  const existingData = await ItemsService.readOne(key);
  
  // Identifie champs modifiés
  const changedFields = Object.keys(input);
  
  // Calcule seulement les champs affectés (optimisation)
  const { updates, hasChanges } = calculateFields(
    collection,
    { ...existingData, ...input },
    changedFields
  );
  
  // Retourne seulement si changements
  return hasChanges ? { ...input, ...updates } : input;
});
```

### 6. ✅ Ne pas écrire si la valeur ne change pas

**Implémenté dans :** `src/index.js`

```javascript
function valuesAreEqual(a, b) {
  // Cas identiques
  if (a === b) return true;
  
  // Cas null/undefined
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  
  // Cas NaN
  if (isNaN(a) && isNaN(b)) return true;
  
  // Comparaison flottants avec tolérance
  if (typeof a === 'number' && typeof b === 'number') {
    const epsilon = 0.0000001;
    return Math.abs(a - b) < epsilon;
  }
  
  // Autres types
  return String(a) === String(b);
}

// Utilisation
const newValue = evaluate(formula, data);
const oldValue = data[fieldName];

if (!valuesAreEqual(oldValue, newValue)) {
  updates[fieldName] = newValue; // ✅ Write seulement si changé
  hasChanges = true;
} else {
  // Skip l'écriture ✅
}
```

## 📊 Architecture Finale

```
┌─────────────────────────────────────────────┐
│          Extension Directus                  │
│           (100% JavaScript)                  │
├─────────────────────────────────────────────┤
│                                               │
│  1. FormulaLoader                            │
│     ✅ Lit quartz_formulas                   │
│     ✅ Filtre locales vs relations          │
│     ✅ Cache 1 min                           │
│                                               │
│  2. DSLParser                                │
│     ✅ Parse DSL engine ({{field}}, IF...) │
│     ✅ Traduit → JavaScript                 │
│     ✅ Extrait dépendances                  │
│                                               │
│  3. DependencyGraph                          │
│     ✅ Construit graphe                     │
│     ✅ Tri topologique                       │
│     ✅ Détecte cycles                        │
│     ✅ Optimise ordre de calcul             │
│                                               │
│  4. DSLEvaluator                             │
│     ✅ Évalue formules en JS                │
│     ✅ Cache compiled functions             │
│                                               │
│  5. DirectusHooks                            │
│     ✅ items.create                          │
│     ✅ items.update                          │
│     ✅ Actions: test-formula, reload        │
│                                               │
└─────────────────────────────────────────────┘
         ▲                          │
         │                          ▼
┌────────┴────────┐       ┌─────────────────┐
│ quartz_formulas │       │  Collections    │
│  (Config DB)    │       │  (User Data)    │
└─────────────────┘       └─────────────────┘
```

## ✅ Validation Complète

| Requirement | Status | Implementation |
|------------|--------|----------------|
| Lire formules depuis quartz_formulas | ✅ | FormulaLoader.loadFormulas() |
| Même format que l'engine Python | ✅ | collection_cible, champ_cible, formula |
| Tri local vs dépendant | ✅ | DSLParser.isLocalFormula() |
| Traduction DSL → JS | ✅ | DSLParser.dslToJavaScript() |
| Arbre de dépendances | ✅ | DependencyGraph.analyze() |
| Tri topologique | ✅ | DependencyGraph.topologicalSort() |
| Détection triggers | ✅ | DependencyGraph.getAffectedFields() |
| Exécution create | ✅ | filter('items.create') |
| Exécution update | ✅ | filter('items.update') |
| Ne pas écrire si inchangé | ✅ | valuesAreEqual() |
| Optimisation calculs | ✅ | optimizeCalculationOrder() |
| Cache formules | ✅ | 1 min TTL |
| Compatible DSL engine | ✅ | Subset du DSL complet |
| Indépendant (pas Python) | ✅ | 100% JavaScript |

## 🎯 Résultat

**Extension qui :**
- ✅ Lit la même config que l'engine Python (`quartz_formulas`)
- ✅ Parse le même DSL (format compatible)
- ✅ Filtre automatiquement local vs relationnel
- ✅ Construit l'arbre de dépendances
- ✅ Calcule dans le bon ordre
- ✅ Optimise (ne recalcule que si nécessaire, ne write que si changé)
- ✅ Est complètement autonome (pas de dépendance Python)
- ✅ Fonctionne en temps réel (hook Directus)

## 📦 Livrables

### Code
- ✅ `src/dsl-parser.js` - Parser DSL compatible engine
- ✅ `src/formula-loader.js` - Chargement depuis quartz_formulas
- ✅ `src/dependency-graph.js` - Arbre de dépendances
- ✅ `src/index.js` - Hook Directus principal
- ✅ `package.json` - Configuration extension

### Documentation
- ✅ `README.md` - Guide utilisateur complet
- ✅ `ARCHITECTURE.md` - Architecture technique détaillée
- ✅ `EXAMPLES.md` - Exemples de formules
- ✅ `VALIDATION.md` - Ce document (validation cahier des charges)

## 🚀 Stratégie Commerciale

| Offre | Features | Prix |
|-------|----------|------|
| **Standard** | Extension Temps Réel (ce projet) | Inclus |
| | - Calculs locaux | |
| | - DSL simplifié | |
| | - Temps réel | |
| **Premium** | + Engine Python Complet | Add-on |
| | - Relations/Agrégations | |
| | - Héritage | |
| | - Consolidation | |
| | - Batch optimisé | |

**Différenciation claire :**
- Standard = Besoin immédiat, simple, inclus
- Premium = Besoin avancé, puissant, payant

## ✅ Cahier des charges VALIDÉ ✅

Tous les points du cahier des charges initial sont **implémentés et fonctionnels** ! 🎉
