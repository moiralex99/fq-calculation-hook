# Conditional Visibility - Guide Complet

**Module :** `src/components/forms/utils/conditionalVisibility.js`

## Vue d'ensemble

Système de visibilité conditionnelle pour sections/groupes/champs de formulaires avec **support complet des opérateurs Directus** incluant `_and`/`_or` logiques.

### ✅ Fonctionnalités

- **Opérateurs Directus natifs** : `_eq`, `_neq`, `_gt`, `_lt`, `_contains`, `_in`, `_null`, etc.
- **Opérateurs logiques** : `_and`, `_or` (imbriqués à l'infini via `DirectusFilterOperators.js`)
- **Variables contextuelles** : `$CURRENT_USER`, `$CURRENT_ROLE`, `$NOW`
- **Actions** : `hidden` (masquer) ou `readonly` (lecture seule)
- **Évaluation front-end** : Aucun appel API, performance optimale
- **Intégration** : Compatible avec Form Builder V3 et FilterBuilder

### ⚠️ FORMAT JSON REQUIS

**IMPORTANT :** Toutes les conditions doivent être en **JSON valide** avec guillemets autour des clés et valeurs string !

```json
✅ CORRECT (JSON valide - sauvegardable dans Directus)
{
  "_and": [
    { "critique": { "_true": null } },
    { "responsable": { "name": { "_contains": "Ali" } } }
  ]
}

❌ INCORRECT (JavaScript object - refusé par parser JSON)
{
  _and: [
    { critique: { _true: null } },
    { responsable: { name: { _contains: 'Ali' } } }
  ]
}
```

---

## 🔥 Exemple Réel Testé

**Condition demandée :** Masquer le champ si **critique = true** ET **responsable.name contient "Ali"**

```json
{
  "conditionHidden": {
    "_and": [
      { "critique": { "_true": null } },
      { "responsable": { "name": { "_contains": "Ali" } } }
    ]
  }
}
```

**Résultats :**
- ✅ `critique=true` + `responsable.name='Ali CHERFAOUI'` → **HIDDEN**
- ✅ `critique=true` + `responsable.name='Mohamed'` → **NORMAL** (pas Ali)
- ✅ `critique=false` + `responsable.name='Ali CHERFAOUI'` → **NORMAL** (pas critique)
- ✅ `critique=1` + `responsable.name='ali'` → **HIDDEN** (conversion auto + case insensitive)

---

## 1. Syntaxe de Base

### Format Simplifié (JSON valide)

```json
{
  "conditionHidden": {
    "field": "status",
    "operator": "_eq",
    "value": "archived"
  }
}
```

### Format Directus Natif (JSON valide)

```json
{
  "conditionHidden": {
    "status": { "_eq": "archived" }
  }
}
```

Les deux formats sont équivalents et supportés.

---

## 2. Exemples Simples

### Masquer si statut = archived

```json
{
  "conditionHidden": {
    "status": { "_eq": "archived" }
  }
}
```

### Readonly si validé

```json
{
  "conditionReadOnly": {
    "status": { "_eq": "validated" }
  }
}
```

### Masquer si budget < 1000

```json
{
  "conditionHidden": {
    "budget": { "_lt": 1000 }
  }
}
```

### Readonly si non propriétaire

```json
{
  "conditionReadOnly": {
    "owner": { "_neq": "$CURRENT_USER" }
  }
}
```

---

## 3. Opérateurs Logiques (_and/_or)

### ✅ NOUVEAU : Support complet via DirectusFilterOperators.js

Depuis la dernière mise à jour, **tous les opérateurs logiques imbriqués sont supportés** grâce à la délégation à `evaluateDirectusFilter()`.

### Masquer si (archived OU cancelled)

```json
{
  "conditionHidden": {
    "_or": [
      { "status": { "_eq": "archived" } },
      { "status": { "_eq": "cancelled" } }
    ]
  }
}
```

**Équivalent simplifié :**
```json
{
  "conditionHidden": {
    "status": { "_in": ["archived", "cancelled"] }
  }
}
```

### Readonly si (validated ET non-admin)

```json
{
  "conditionReadOnly": {
    "_and": [
      { "status": { "_eq": "validated" } },
      { "current_user": { "role": { "_neq": "admin" } } }
    ]
  }
}
```

### Condition imbriquée complexe

**Masquer si :**
- (owner ≠ current_user) **ET**
- (status = published **OU** status = validated)

```json
{
  "conditionHidden": {
    "_and": [
      { "owner": { "_neq": "$CURRENT_USER" } },
      {
        "_or": [
          { "status": { "_eq": "published" } },
          { "status": { "_eq": "validated" } }
        ]
      }
    ]
  }
}
```

---

## 4. Conditions Multi-Champs

### Readonly si deadline dépassée OU priorité basse

```json
{
  "conditionReadOnly": {
    "_or": [
      { "deadline": { "_lt": "$NOW" } },
      { "priority": { "_eq": "low" } }
    ]
  }
}
```

### Masquer si (urgent ET overdue) OU (frozen)

```json
{
  "conditionHidden": {
    "_or": [
      {
        "_and": [
          { "priority": { "_eq": "high" } },
          { "deadline": { "_lt": "$NOW" } }
        ]
      },
      { "status": { "_eq": "frozen" } }
    ]
  }
}
```

---

## 5. Variables Contextuelles

### Variables Disponibles

| Variable | Type | Description | Exemple |
|----------|------|-------------|---------|
| `$CURRENT_USER` | uuid | ID de l'utilisateur connecté | `owner: { _eq: "$CURRENT_USER" }` |
| `$CURRENT_ROLE` | uuid | ID du rôle utilisateur | `required_role: { _eq: "$CURRENT_ROLE" }` |
| `$NOW` | datetime | Timestamp actuel (ISO 8601) | `expires_at: { _gt: "$NOW" }` |
| `current_user.*` | object | Objet utilisateur complet | `current_user: { department: { _eq: 'IT' } }` |
| `today` | string | Date du jour (YYYY-MM-DD) | Calculé automatiquement |
| `now` | string | Timestamp actuel | Calculé automatiquement |

### Exemples avec Variables

#### Readonly si non-propriétaire

```json
{
  "conditionReadOnly": {
    "owner": { "_neq": "$CURRENT_USER" }
  }
}
```

#### Masquer si deadline passée

```json
{
  "conditionHidden": {
    "deadline": { "_lt": "$NOW" }
  }
}
```

#### Masquer si non-manager

```json
{
  "conditionHidden": {
    "current_user": { 
      "role": { "_neq": "manager" } 
    }
  }
}
```

---

## 6. Workflow Complexes

### Gestion de Budget - Contrôle Multi-Niveaux

**Règle métier :** Le champ `budget` est en readonly sauf si :
- (Propriétaire **ET** statut = draft) **OU**
- Rôle = finance_admin

```json
{
  "conditionReadOnly": {
    "_and": [
      {
        "_or": [
          { "owner": { "_neq": "$CURRENT_USER" } },
          { "status": { "_neq": "draft" } }
        ]
      },
      { "current_user": { "role": { "_neq": "finance_admin" } } }
    ]
  }
}
```

**Explication :** Readonly si (PAS owner OU PAS draft) ET (PAS finance_admin)

### Validation de Timesheet

**Masquer le bouton "Valider" si :**
- (Semaine future) **OU**
- (Déjà validé) **OU**
- (Pas manager **ET** pas propriétaire)

```json
{
  "conditionHidden": {
    "_or": [
      { "week_end": { "_gt": "$NOW" } },
      { "statut": { "_eq": "validated" } },
      {
        "_and": [
          { "current_user": { "role": { "_neq": "manager" } } },
          { "responsable": { "_neq": "$CURRENT_USER" } }
        ]
      }
    ]
  }
}
```

### Facture - Workflow Approbation

**Champ `montant` readonly si :**
- (Statut ≠ draft) **OU**
- (Montant > 5000 **ET** rôle ≠ finance_manager)

```json
{
  "conditionReadOnly": {
    "_or": [
      { "statut": { "_neq": "draft" } },
      {
        "_and": [
          { "montant": { "_gt": 5000 } },
          { "current_user": { "role": { "_neq": "finance_manager" } } }
        ]
      }
    ]
  }
}
```

---

## 7. Opérateurs Supportés

### Comparaison
- `_eq` : Égal à
- `_neq` : Différent de
- `_lt` : Inférieur à
- `_lte` : Inférieur ou égal
- `_gt` : Supérieur à
- `_gte` : Supérieur ou égal

### Listes
- `_in` : Dans la liste
- `_nin` : Pas dans la liste
- `_between` : Entre deux valeurs
- `_nbetween` : Hors intervalle

### Texte
- `_contains` : Contient
- `_ncontains` : Ne contient pas
- `_starts_with` : Commence par
- `_ends_with` : Termine par
- `_icontains`, `_istarts_with`, `_iends_with` : Variantes insensibles à la casse

### Null/Empty
- `_null` : Est null
- `_nnull` : N'est pas null
- `_empty` : Est vide (null, "", [], {})
- `_nempty` : N'est pas vide

### Logiques
- `_and` : ET logique (toutes les conditions)
- `_or` : OU logique (au moins une condition)

**⚠️ Imbrication illimitée supportée !**

---

## 8. Intégration dans les Composants

### Hook React

```javascript
import { useConditionalVisibility } from '@/components/forms/utils/conditionalVisibility';

const MyField = ({ field, formData, currentUser }) => {
  const { isHidden, isReadOnly } = useConditionalVisibility(
    field.visibility,
    formData,
    currentUser
  );

  if (isHidden) return null;

  return (
    <TextInput
      {...field}
      readOnly={isReadOnly}
    />
  );
};
```

### Application à un Layout Complet

```javascript
import { applyConditionalVisibilityToLayout } from '@/components/forms/utils/conditionalVisibility';

const enrichedLayout = applyConditionalVisibilityToLayout(
  formLayout,
  formData,
  currentUser
);

// enrichedLayout contient maintenant les flags _isHidden/_isReadOnly sur tous les éléments
```

---

## 9. Form Builder V3 - Configuration UI

Dans le Form Builder, chaque champ/section/groupe peut définir :

```javascript
{
  name: 'budget',
  type: 'number',
  visibility: {
    conditionHidden: { ... },
    conditionReadOnly: { ... }
  }
}
```

**Interface recommandée :**
- Utiliser `FilterBuilder` pour construire visuellement les conditions
- Support autocomplete des variables contextuelles (`$CURRENT_USER`, etc.)
- Prévisualisation temps-réel avec mock data

---

## 10. Performance et Bonnes Pratiques

### ✅ Optimisations

1. **Évaluation front-end** : Aucun appel API, calcul instantané
2. **Memoization recommandée** : Cache les résultats si formData ne change pas
3. **Délégation intelligente** : 
   - Conditions simples → Évaluation locale rapide
   - Conditions `_and`/`_or` → Délégation à `evaluateDirectusFilter()`

### ⚠️ Pièges à Éviter

1. **Variables non résolues** : Toujours passer `currentUser` au contexte
2. **Champs inexistants** : Console warn si champ référencé n'existe pas dans formData
3. **Priorité hidden > readonly** : Si les deux conditions sont vraies, `hidden` prévaut
4. **⚠️ LIMITATION CONNUE : Nested fields et réactivité**
   - Les champs imbriqués (ex: `responsable.name`) ne déclenchent PAS automatiquement la réévaluation si l'objet parent change
   - **Workaround actuel :** Passer le formData complet à chaque onChange du formulaire
   - **Solution V2 :** Deep watch sur les objets imbriqués (à implémenter)
   - **Exemple du problème :**
     ```javascript
     // Condition : { "responsable": { "name": { "_contains": "Ali" } } }
     
     // ❌ Ne déclenche PAS la réévaluation automatique :
     formData.responsable = { id: 123, name: 'Ali' }
     
     // ✅ Workaround : Forcer réévaluation manuelle
     setFormData({ ...formData, responsable: { id: 123, name: 'Ali' } })
     ```

### 📊 Complexité

- **Simple condition** : O(1) - Instant
- **_and avec N conditions** : O(N) - Linéaire
- **_or avec N conditions** : O(N) worst-case (évaluation court-circuit si match)
- **Nested complexe** : O(depth × conditions) - Reste très performant

---

## 11. Migration depuis l'Ancien Système

### Avant (Legacy)

```javascript
// Ancien système (syntax limitée)
{
  visibilityCondition: "status == 'archived' || status == 'cancelled'"
}
```

### Après (Directus Native)

```javascript
// Nouveau système (Directus natif)
{
  conditionHidden: {
    _or: [
      { status: { _eq: 'archived' } },
      { status: { _eq: 'cancelled' } }
    ]
  }
}
```

**Ou version simplifiée :**

```javascript
{
  conditionHidden: {
    status: { _in: ['archived', 'cancelled'] }
  }
}
```

---

## 12. Debugging

### Logs Console

Le module log automatiquement dans la console (mode dev) :

```
[ConditionalVisibility] Détection _and/_or - délégation à evaluateDirectusFilter
[ConditionalVisibility] Structure Directus complexe détectée - délégation
[ConditionalVisibility] FIELD_NOT_FOUND (native) { field: 'status', ... }
```

### Test Manual

```javascript
import { evaluateVisibility } from '@/components/forms/utils/conditionalVisibility';

const result = evaluateVisibility(
  {
    conditionHidden: {
      _or: [
        { status: { _eq: 'archived' } },
        { owner: { _neq: 'user-123' } }
      ]
    }
  },
  { status: 'published', owner: 'user-456' },
  { id: 'user-123', role: 'admin' }
);

console.log(result); // 'hidden', 'readonly', ou null
```

---

## 13. Exemples Complets par Cas d'Usage

### Gestion de Projet

```javascript
const projectFieldsVisibility = {
  // Budget visible seulement pour finance/managers
  budget: {
    conditionHidden: {
      _and: [
        { current_user: { role: { _nin: ['finance', 'manager'] } } },
        { owner: { _neq: "$CURRENT_USER" } }
      ]
    }
  },

  // Deadline readonly si projet démarré
  deadline: {
    conditionReadOnly: {
      start_date: { _nnull: true }
    }
  },

  // Notes internes hidden si external user
  internal_notes: {
    conditionHidden: {
      current_user: { 
        type: { _eq: 'external' } 
      }
    }
  }
};
```

### Validation Hiérarchique

```javascript
const approvalFlow = {
  // Approbation L1 : Manager uniquement
  approve_l1: {
    conditionHidden: {
      _or: [
        { current_user: { role: { _neq: 'manager' } } },
        { approval_l1: { _nnull: true } } // Déjà approuvé
      ]
    }
  },

  // Approbation L2 : Director + L1 validé
  approve_l2: {
    conditionHidden: {
      _or: [
        { current_user: { role: { _neq: 'director' } } },
        { approval_l1: { _null: true } }, // L1 pas encore fait
        { approval_l2: { _nnull: true } }  // Déjà approuvé
      ]
    }
  }
};
```

---

## Résumé

✅ **Opérateurs Directus natifs** (30+ opérateurs)  
✅ **Logique complexe** (`_and`/`_or` imbriqués)  
✅ **Variables contextuelles** (`$CURRENT_USER`, `$NOW`)  
✅ **Performance optimale** (évaluation front-end)  
✅ **Compatible FilterBuilder** (construction visuelle)  
✅ **Production-ready** (utilisé dans Form Builder V3)

⚠️ **Limitations connues (V1) :**
- **Nested fields réactivité** : Champs imbriqués (ex: `responsable.name`) ne déclenchent pas automatiquement la réévaluation en runtime
  - **Workaround :** Forcer la réévaluation en passant un nouveau formData (`setFormData({ ...formData })`)
  - **Solution V2 :** Deep watch sur objets imbriqués (roadmap)

Pour plus de détails sur les opérateurs : `src/core/DirectusFilterOperators.js`
