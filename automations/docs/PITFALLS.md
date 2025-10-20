# ⚠️ Pièges et Bonnes Pratiques - Automations

Ce document liste les pièges courants et les bonnes pratiques pour éviter les erreurs dans les automations.

## 🐛 Pièges JSONLogic

### 1. Évaluation prématurée des expressions dans `sum_by`, `filter_by`, etc.

**❌ NE PAS FAIRE:**
```json
{
  "sum_by": [
    { "var": "$lignes" },
    { "get": [{ "var": "it" }, "total_ligne"] }
  ]
}
```

**Problème:** L'expression `{ "get": ... }` est évaluée **AVANT** d'entrer dans `sum_by`, quand `it` n'existe pas encore → retourne `null`.

**✅ SOLUTION:**
```json
{
  "sum_by": [
    { "var": "$lignes" },
    "total_ligne"  ← String, évaluée DANS sum_by avec le bon contexte
  ]
}
```

**Explication:**  
- JSONLogic évalue **tous les arguments d'une opération** avant de l'appeler
- Les opérations custom comme `sum_by` itèrent sur un tableau et créent un contexte `{ it: element_actuel }`
- Si vous passez un objet JSONLogic, il est évalué trop tôt (dans le contexte parent où `it` n'existe pas)
- Si vous passez une **string**, elle est passée telle quelle et évaluée par `evalExprOrPath` DANS le bon contexte

**Opérations concernées:**
- `sum_by(array, expr)` → passer une CHAÎNE (ex.: `"total_ligne"`), pas un objet JSONLogic
- `map_by(array, expr)` → passer une CHAÎNE (ex.: `"prix"`)
- `filter_by(array, predicate)` → le prédicat peut être un JSONLogic qui référence `it.*` (ex.: `{ "===": [{ "var": "it.statut" }, "termine"] }`)
- `reduce_by(array, init, expr)` → peut utiliser `{ "var": "it" }` et `{ "var": "acc" }` dans l’expression

---

### 2. `reduce` n'existe pas - utiliser `sum_by` ou `reduce_by`

**❌ NE PAS FAIRE:**
```json
{
  "reduce": [
    { "var": "$array" },
    { "+": [{ "var": "accumulator" }, { "var": "current.value" }] },
    0
  ]
}
```

**Problème:** L'opération `reduce` standard de JSONLogic n'est pas implémentée.

**✅ SOLUTIONS:**

Pour une **somme**:
```json
{
  "sum_by": [{ "var": "$array" }, "value"]
}
```

Pour un **reduce custom**:
```json
{
  "reduce_by": [
    { "var": "$array" },
    0,  ← Valeur initiale
    { "+": [{ "var": "acc" }, { "var": "it.value" }] }
  ]
}
```

**Variables disponibles dans `reduce_by`:**
- `acc`: accumulateur (valeur courante de la réduction)
- `it`: élément actuel du tableau

---

### 3. `filter` standard vs `filter_by` custom

**❌ Problème avec `filter` standard:**
```json
{
  "filter": [
    { "var": "$taches" },
    { "===": [{ "var": "statut" }, "termine"] }
  ]
}
```

Le filtre cherche `statut` dans le contexte global, pas dans chaque élément du tableau.

**✅ SOLUTION avec `filter_by`:**
```json
{
  "filter_by": [
    { "var": "$taches" },
    { "===": [{ "var": "it.statut" }, "termine"] }
  ]
}
```

Ou encore plus simple:
```json
{
  "filter_by": [
    { "var": "$taches" },
    { "===": [{ "var": "it" }, "termine"] }  ← Si $taches contient des strings directement
  ]
}
```

---

## 🚧 Pièges d'exécution

### 3bis. Dates — `NOW()` vs `{ "now": [] }`

- Dans un `set_field` simple, la valeur littérale `"NOW()"` est supportée par l’engine et sera remplacée par un timestamp ISO.
- À l’intérieur d’une expression JSONLogic (`date_add`, `date_diff`, etc.), utilisez impérativement l’opérateur JSONLogic: `{ "now": [] }`.

Exemples:

```json
{ "type": "set_field", "field": "updated_at", "value": "NOW()" }
```

```json
{ "type": "set_field", "field": "due_at", "value": { "date_add": [ { "now": [] }, 7, "days" ] } }
```

### 4. Automations sur `items.create` et `lookup_many`

**❌ Problème:**
```json
{
  "name": "Compter tâches projet",
  "collection_cible": ["taches"],
  "trigger_event": "items.create,items.update,items.delete",
  "actions": [
    {
      "type": "set_field",
      "field": "$taches",
      "value": {
        "lookup_many": ["taches", { "projet_id": { "_eq": { "var": "$projet_id" } } }, ["id"], 500]
      }
    }
  ]
}
```

**Problème:**  
Sur `items.create`, l'item **n'est pas encore en base** quand `lookup_many` s'exécute.  
Cela peut causer des résultats incohérents ou des crashs.

**✅ SOLUTIONS (mise à jour):**

**Option A (recommandée):** Traiter `items.create` en post-commit via un hook `action` (implémenté dans l’engine). On lit l’item créé puis on applique un `updateOne` avec les champs calculés. Cela évite les incohérences de `lookup_many`.

**Option B:** Ne pas se déclencher sur `items.create`:
```json
{
  "trigger_event": "items.update,items.delete"
}
```

**Option C:** Ajouter une condition pour éviter l'exécution sur create:
```json
{
  "rule": {
    "and": [
      { "!!": { "var": "id" } },  ← id existe uniquement après création
      { "!!": { "var": "projet_id" } }
    ]
  }
}
```

**Option 3:** Utiliser un trigger séparé qui se déclenche sur la collection parent.

---

### 5. Ordre d'exécution et `lookup_many`

**⚠️ Piège:**  
Si plusieurs automations se déclenchent sur le même événement, elles s'exécutent **en parallèle**.  
Les modifications de l'une ne sont **PAS visibles** par `lookup_many` de l'autre (car `lookup_many` lit la DB).

**Exemple:**
```
Automation 1: Calcule total_ligne = quantite × prix
Automation 2: Fait lookup_many pour lire les total_ligne → lit les ANCIENNES valeurs !
```

**✅ SOLUTIONS:**

**Option 1:** Utiliser `priority` pour ordonner (mais `lookup_many` lit toujours la DB):
```json
{
  "name": "Automation 1",
  "priority": 100  ← S'exécute en premier
}
{
  "name": "Automation 2",
  "priority": 200  ← S'exécute après
}
```

**Option 2:** Déclencher Automation 2 sur une autre collection ou événement.

**Option 3:** Fusionner les deux automations en une seule.

---

### 6. L'opérateur `!!` (double négation)

**⚠️ Attention:**  
L'opérateur `!!` convertit en booléen, **MAIS** il peut poser problème dans certains contextes.

**✅ Usage correct:**
```json
{
  "rule": { "!!": { "var": "projet_id" } }
}
```

Équivaut à: `if (projet_id) { ... }` en JavaScript.

**Valeurs falsy:**
- `null`, `undefined` → `false`
- `0`, `""` → `false` ⚠️ **Attention aux IDs = 0 !**
- `false` → `false`

**Alternative plus sûre pour vérifier l'existence:**
```json
{
  "rule": { "!==": [{ "var": "projet_id" }, null] }
}
```

Ou:
```json
{
  "rule": { "_nnull": "projet_id" }  ← Opérateur Directus custom
}
```

---

## ✅ Bonnes pratiques

### 7. Toujours tester avec des logs

Ajouter des actions `log` pour debug:
```json
{
  "actions": [
    {
      "type": "log",
      "message": { "concat": ["Début automation, projet_id=", { "var": "projet_id" }] }
    },
    {
      "type": "set_field",
      "field": "$taches",
      "value": { "lookup_many": [...] }
    },
    {
      "type": "log",
      "message": { "concat": ["Tâches trouvées: ", { "length": { "var": "$taches" } }] }
    }
  ]
}
```

### 8. Gérer les cas `null` et `undefined`

Utiliser `coalesce` pour des valeurs par défaut:
```json
{
  "coalesce": [
    { "var": "field_optionnel" },
    "valeur_par_defaut"
  ]
}
```

Utiliser `if` pour vérifier avant d'agir:
```json
{
  "if": [
    { "!!": { "var": "$lignes" } },
    { "sum_by": [{ "var": "$lignes" }, "total"] },
    0
  ]
}
```

### 9. Limiter les `lookup_many` avec `limit`

Toujours spécifier une limite pour éviter de charger trop de données:
```json
{
  "lookup_many": [
    "collection",
    { "filter": "..." },
    ["field1", "field2"],
    500  ← Limite importante !
  ]
}
```

### 10. Utiliser `assign` pour réutiliser les résultats

Stocker le résultat d'un `create_item` ou `update_item`:
```json
{
  "type": "create_item",
  "collection": "projets",
  "assign": "nouveau_projet",  ← Crée $nouveau_projet
  "data": { "nom": "..." }
},
{
  "type": "log",
  "message": { "concat": ["Projet créé avec ID: ", { "var": "$nouveau_projet.id" }] }
}
```

---

## 🛡️ Robustesse du système

Depuis la dernière mise à jour, le système est plus robuste:

- **Try-catch global**: Si une action échoue, elle est ignorée et les actions suivantes sont **abandonnées** (pour éviter les cascades d'erreurs)
- **Logs d'erreur**: Les erreurs sont loggées avec `[Automations] ❌ action <type> failed: <message>`
- **Pas de crash**: Le serveur Directus ne crashe plus même si une automation a un problème

**Message d'erreur type:**
```
[Automations] ❌ action set_field failed: Cannot read property 'total_ligne' of undefined
[Automations] ⚠️  Skipping remaining actions in this automation to prevent cascade failures
```

---

## 📚 Ressources

- [Documentation JSONLogic](https://jsonlogic.com/)
- [COMMON_USECASES.md](./COMMON_USECASES.md) - Exemples complets
- [FORMULA_FUNCTIONS.md](../../docs/FORMULA_FUNCTIONS.md) - Opérations disponibles
