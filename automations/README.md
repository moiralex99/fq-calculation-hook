# Directus Automations

Automatisations basées sur JSONLogic pour Directus, avec support des listes, lookups, et actions CRUD.

## Fonctionnalités
- Déclencheurs JSONLogic (colonne `rule` ou `rule_jsonb`)
- Déclenchement sur événements Directus: `items.create` et `items.update` (configurable via `trigger_event`)
- Filtrage par collection via `collection_cible` (string ou tableau)
- Actions:
  - `set_field` (valeur: littéral, `NOW()`, `$USER.id`, JSONLogic)
  - `create_item` (crée un enregistrement; `assign` pour stocker l'item créé)
  - `update_item` (met à jour un enregistrement par `id`; `assign` pour stocker l'item mis à jour)
  - `update_many` (mise à jour en masse par `filter`; renvoie `{ count }`, peut être stocké via `assign`)
  - `for_each` (itère sur une liste et exécute des actions imbriquées; contexte enrichi)
  - `send_email` (mock par défaut)
  - `trigger_flow` (déclenche un Flow Directus via un événement personnalisé)
- Condition par action avec `when` (JSONLogic): exécuter/skip une action même si la règle globale a matché
- Préchargement relationnel avec `expand_fields`
- Hot reload stable des règles (détection de signature + retry)
- Prévention des boucles infinies via `_automationTriggered`
- Throttle/débounce par automatisation (`throttle_ms`, `throttle_scope`)
- Action `automations.reload` pour recharger les règles

## Contexte d'évaluation

Lors de l'évaluation d'une règle et des valeurs d'actions, le contexte disponible est:

- Les champs de l'item (fusion de l'ancien et du nouveau): `{ ...$OLD, ...newData }` — les valeurs du payload en cours (newData) priment.
- `$OLD`: les anciennes valeurs de l'item avant l'update (objet vide pour create)
- `$CHANGED`: la liste des clés modifiées (`["prix", "quantite", ...]`)
- `$USER`: l'utilisateur courant (si disponible), ex `{ id: "user-123", ... }`
- `$AUTOMATION`: métadonnées de la règle en cours `{ id, name, throttle_ms, throttle_scope }`

Cela permet par exemple de lire un champ inchangé tout en recalculant un autre.

## Table `quartz_automations` (schéma recommandé)

```sql
CREATE TABLE quartz_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  description text,
  status varchar(50) DEFAULT 'active',
  collection_cible jsonb NOT NULL, -- string OU array de strings
  rule_jsonb jsonb NOT NULL,
  actions_jsonb jsonb NOT NULL,
  priority integer DEFAULT 10,
  trigger_event jsonb, -- ex ["update"] ou ["create","update"] ou ["*"]
  expand_fields jsonb, -- ex ["project.name","client.email"]
  throttle_ms integer, -- ex 300 (ms)
  throttle_scope varchar(50), -- 'rule' | 'collection' | 'item' | 'user'
  date_created timestamp DEFAULT NOW(),
  date_updated timestamp DEFAULT NOW()
);

-- Remarque: le code du hook tolère aussi les noms "rule"/"actions" (sans suffixe)
-- pour rétrocompatibilité, mais la recommandation est d'utiliser *_jsonb.
```

## Déclenchement et filtrage

- `trigger_event`: array d'événements à écouter. Par défaut: `["update"]`. Wildcard supporté: `[*]`.
- `collection_cible`: peut être une string ("taches") ou un tableau (["taches","actions"]).

## Exemple de règle

```json
{
  "name": "Fin projet",
  "collection_cible": "projets",
  "rule": {
    "and": [
      { "===": [ { "var": "status" }, "termine" ] },
      { "in": [ "status", { "var": "$CHANGED" } ] }
    ]
  },
  "actions": [
    { "type": "set_field", "field": "date_fin", "value": "NOW()" }
  ]
}
```

## Nested fields (relations)

Vous pouvez accéder à des champs imbriqués de 3 façons complémentaires:

1) Chemins dans `var`

```json
{ "var": "project.name" }
```

2) Préchargement via `expand_fields`

Dans la règle, ajoutez une propriété `expand_fields` (array) pour indiquer quelles relations charger au moment du readOne:

```json
{
  "collection_cible": "tasks",
  "status": "active",
  "expand_fields": ["project.name", "project.client.email"],
  "rule": { "===": [ { "var": "project.priority" }, "urgent" ] },
  "actions": [
    {
      "type": "trigger_flow",
      "key": "notify_project_urgent",
      "payload": {
        "task_id": { "var": "id" },
        "project_name": { "var": "project.name" },
        "client_email": { "var": "project.client.email" }
      }
    }
  ]
}
```

3) Lookups DB dans JSONLogic

Quand vous avez besoin d'aller chercher dynamiquement d'autres données:

```json
{
  "and": [
    { "in": ["status", { "var": "$CHANGED" }] },
    {
      "matches": [
        { "get": [
          { "lookup": ["projects", { "var": "project_id" }, ["name"], { "__ctx": [] }] },
          "name"
        ] },
        "Apollo",
        "i"
      ]
    }
  ]
}
```

Pour des relations M2M, vous pouvez utiliser `lookup_many` puis agréger:

```json
{
  "type": "set_field",
  "field": "total_amount",
  "value": {
    "sum_by": [
      { "lookup_many": [
        "order_lines",
        { "order": { "_eq": { "var": "id" } } },
        ["id", "amount"],
        500,
        { "__ctx": [] }
      ] },
      "amount",
      {}
    ]
  }
}
```

## Opérateurs personnalisés

En plus de JSONLogic standard, les opérateurs suivants sont disponibles:

- Dates/chaînes
  - `now()`: renvoie l'ISO courant
  - `date_diff(a, b, unit)`: days/hours/minutes
  - `date_add(a, amount, unit)`: ajoute un décalage (days/hours/minutes)
  - `concat(...args)`: concatène des strings

- Contrôle/Utilitaires
  - `iif(cond, then, else)`
  - `case(c1, v1, c2, v2, ..., default)`
  - `get(obj, 'a.b.c', def?)`
  - `coalesce(a, b, c, ...)`
  - `length(x)`

- Regex
  - `matches(text, pattern, flags)`
  - `imatches(text, pattern)`

- Tableaux (avec expr JSONLogic ou chemin type 'amount')
  - `map_by(arr, exprOrPath, ctx?)`
  - `filter_by(arr, predExprOrPath, ctx?)`
  - `reduce_by(arr, accInit, exprOrPath, ctx?)`
  - `sum_by(arr, exprOrPath, ctx?)`
  - `any_by(arr, predExprOrPath, ctx?)`
  - `all_by(arr, predExprOrPath, ctx?)`

- Accès DB (optionnels)
  - `lookup(collection, id, fields?, ctx?)`
  - `lookup_many(collection, filter?, fields?, limit?, ctx?)`

Astuce: dans les helpers d'array, `it` (élément courant) et `acc` (pour reduce) sont dispo dans l'expression JSONLogic.

## Actions avancées

### for_each — Boucles sur listes O2M/M2M

L'action `for_each` permet d'itérer sur une liste (O2M, M2M, ou tableau) et d'exécuter des actions imbriquées pour chaque élément.

**Contexte enrichi par boucle**:
- `$item`: l'élément courant de la liste
- `$index`: position dans la liste (0-based)
- `$parent`: l'élément parent si boucles imbriquées

**assign dans create_item**:
Utilisez `assign: "new_calendrier"` pour stocker l'item créé dans le contexte et le référencer dans les actions suivantes via `$new_calendrier`.

**Exemple: Duplication de calendriers avec O2M imbriqués**

```json
{
  "name": "Dupliquer campagne",
  "collection_cible": "campagnes",
  "status": "active",
  "expand_fields": ["campagne_dupliquer.calendriers_campagne.liste_domaines.liste_processus.liste_taches"],
  "rule": { "and": [ { "in": ["dupliquer", { "var": "$CHANGED" }] }, { "===": [ { "var": "dupliquer" }, "oui" ] } ] },
  "actions": [
    {
      "type": "for_each",
      "list": { "var": "campagne_dupliquer.calendriers_campagne" },
      "actions": [
        {
          "type": "create_item",
          "collection": "calendriers",
          "assign": "new_calendrier",
          "data": {
            "name": { "concat": [{ "var": "$item.name" }, " (Copie ", { "var": "annee" }, ")"] },
            "campagne_liee": { "var": "id" },
            "annee": { "var": "annee" }
          }
        },
        {
          "type": "for_each",
          "list": { "var": "$item.liste_domaines" },
          "actions": [
            {
              "type": "create_item",
              "collection": "domaines",
              "assign": "new_domaine",
              "data": {
                "name": { "var": "$item.name" },
                "calendrier_lie": { "var": "$new_calendrier.id" }
              }
            },
            {
              "type": "for_each",
              "list": { "var": "$item.liste_processus" },
              "actions": [
                {
                  "type": "create_item",
                  "collection": "processus",
                  "assign": "new_processus",
                  "data": {
                    "name": { "var": "$item.name" },
                    "domaine_lie": { "var": "$new_domaine.id" }
                  }
                },
                {
                  "type": "for_each",
                  "list": { "var": "$item.liste_taches" },
                  "actions": [
                    {
                      "type": "create_item",
                      "collection": "taches",
                      "data": {
                        "name": { "var": "$item.name" },
                        "processus_lie": { "var": "$new_processus.id" },
                        "delai": { "var": "$item.delai" }
                      }
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    { "type": "set_field", "field": "dupliquer", "value": "termine" }
  ]
}
```

Ce pattern reproduit exactement les "spawners" de duplication complexe (campagne → calendriers → domaines → processus → tâches).

### Déclencher un Flow Directus

Ajoutez un Flow dans Directus avec un déclencheur "Custom Event" (événement personnalisé) nommé `automations.trigger.flow`.
Dans le Flow, vous pouvez filtrer sur `payload.key` et utiliser `payload.payload` comme données.

Exemple d'action `trigger_flow` côté Automations:

```json
{
  "type": "trigger_flow",
  "key": "notify_ticket",
  "payload": {
    "ticket_id": { "var": "id" },
    "title": { "var": "title" },
    "requested_by": { "var": "requester_email" }
  }
}
```

### Recalcul du total quand `quantite` ou `prix` change

```json
{
  "name": "Recalculer total",
  "collection_cible": "commandes",
  "status": "active",
  "rule": {
    "or": [
      { "in": ["quantite", { "var": "$CHANGED" }] },
      { "in": ["prix", { "var": "$CHANGED" }] }
    ]
  },
  "actions": [
    {
      "type": "set_field",
      "field": "total",
      "value": {
        "*": [ { "var": "quantite" }, { "var": "prix" } ]
      }
    }
  ]
}
```

### update_item — Mise à jour d'un enregistrement

Mettre à jour un enregistrement ciblé par `id` et payload `data` (valeurs résolues avec JSONLogic et tokens: `NOW()`, `$USER.id`, etc.).

```json
{
  "type": "update_item",
  "collection": "processus",
  "id": { "var": "id" },
  "data": {
    "date_fin": { "var": "date_fin" }
  },
  "assign": "proc"
}
```

### update_many — Mise à jour en masse

Mettre à jour plusieurs enregistrements selon un `filter`. Si disponible côté Directus, l'extension utilise `updateByQuery`; sinon fallback en deux étapes (read ids + updateMany).

```json
{
  "type": "update_many",
  "collection": "taches",
  "filter": { "processus_id": { "_eq": { "var": "id" } } },
  "data": { "date_fin": { "var": "date_fin" } },
  "assign": "bulk"
}
```

Le résultat peut être stocké via `assign` (ex: `$bulk = { "count": 42 }`).

### when — Condition par action

Chaque action peut définir un `when` (expression JSONLogic). Si `when` n'est pas truthy, l'action est sautée.

Contexte disponible: identique aux règles (`$OLD`, `$CHANGED`, `$USER`, variables de l'item…) et dans une boucle `for_each`: `$item`, `$index`, `$parent`.

Exemples:

1) Exécuter une action seulement si `date_fin` a changé

```json
{
  "type": "update_item",
  "collection": "processus",
  "id": { "var": "id" },
  "data": { "date_fin": { "var": "date_fin" } },
  "when": { "in": ["date_fin", { "var": "$CHANGED" }] }
}
```

2) Dans un `for_each`, ne modifier que les éléments dont la valeur diffère

```json
{
  "type": "update_item",
  "collection": "taches",
  "id": { "var": "$item.id" },
  "data": { "date_fin": { "var": "date_fin" } },
  "when": { "!==": [ { "var": "$item.date_fin" }, { "var": "date_fin" } ] }
}
```

### Throttle/Debounce par automatisation

Pour éviter des tempêtes de recalculs lors d'une série de mises à jour rapides, configurez:

- `throttle_ms`: fenêtre en millisecondes pour coalescer les événements d'une même règle
- `throttle_scope`: clé de regroupement:
  - `rule` (par défaut): une file par règle
  - `collection`: par règle + collection
  - `item`: par règle + id de l'item
  - `user`: par règle + id utilisateur

La dernière mise à jour reçue dans la fenêtre est utilisée pour l'évaluation. Implémentation en mémoire (par processus Node). Pour des déploiements multi-instances, privilégier un mécanisme centralisé (Redis) si nécessaire.

## Développement

```bash
npm install
npm run dev
```

## Exemples prêts à l'emploi

Des exemples de règles prêtes à copier-coller sont disponibles dans `docs/examples.json`:

- Recalcul total commande
- Notification Flow sur ticket urgent
- Clôture + notification client
- Agrégation M2M (sum_by via lookup_many)
- Segmentation via case

Importez-les dans `quartz_automations` (copiez la règle et adaptez `collection_cible`, les noms de champs, et les relations).

## Limitations connues
- Pas d'actions webhook (phase ultérieure)
- Pas de gestion d'ordre d'exécution avancée (utiliser `priority` côté requêtes si besoin)
- Valeurs calculées avancées non supportées (préférer les formules)
 - Les lookups DB dans JSONLogic reposent sur des appels supplémentaires: privilégiez `expand_fields` quand c'est possible pour la performance.

## Notes de sécurité & robustesse
- Les actions `create_item`, `update_item`, `update_many` portent `accountability._automationTriggered = true` pour éviter les boucles infinies avec les filtres Directus.
- Les expressions JSONLogic sont évaluées dans un contexte contrôlé; les opérateurs Regex nettoient les flags.
- `set_field` ignore les résultats `undefined` pour éviter d'écraser des champs involontairement.







Dans toutes les expressions JSONLogic (rule, valeurs d’action), tu peux utiliser var avec un chemin pointé:
{ "var": "project.name" }, { "var": "task.project.client.email" }
Les opérateurs d’array ajoutés acceptent aussi des chemins simplifiés:
sum_by(lines, "amount"), filter_by(lines, { ">": [ { "var": "it.amount" }, 0 ] })
Lookups DB embarqués pour relations
Nouveaux opérateurs JSONLogic qui s’appuient sur Directus:
lookup(collection, id, fields?, ctx?)
Ex: { "lookup": ["projects", { "var": "project_id" }, ["id","name","client.email"], { "__ctx": [] }] }
lookup_many(collection, filter?, fields?, limit?, ctx?)
Ex: { "lookup_many": ["users", { "status": { "_eq": "active" } }, ["id","email"], 50, { "__ctx": [] }] }
Ces opérateurs sont optionnels et fonctionnent parce qu’on injecte ItemsService au sein de l’évaluateur (côté extension). Ils résolvent les values JSONLogic dans leurs paramètres (filter, fields) avant de faire la requête.
Pour faciliter la vie:

Per-rule expand_fields
Tu peux ajouter expand_fields à une règle:
["project.*", "client.email"]
Lors d’un items.update, on lit l’original avec ces fields, donc ton contexte a déjà les relations utiles au moment de l’évaluation. Ça évite un appel DB additionnel dans certaines règles.
Ce que j’ai livré

Évaluateur renforcé
Opérateurs: lookup, lookup_many, get, coalesce, length, iif, case, matches/imatches, concat, date_add, date_diff, now
Helpers arrays: map_by, filter_by, reduce_by, sum_by, any_by, all_by (supportent expr JSONLogic ou chemin 'amount')
Contexte combiné: { ...$OLD, ...newData } pour lire les champs non modifiés
Chargement original avec expand_fields
collectExpandFields scanne les règles pour meta.collection et ajoute fields au readOne
Tests
test-nested-lookups.mjs: montre un lookup de project depuis une task et récupère project.name
test-operators.mjs et test-business-scenarios.mjs restent verts
Exemples concrets

Règle sur tâche dépendant du projet M2O
Si priorité du projet est "urgent", alors notifier:
{ "collection_cible": "tasks", "status": "active", "expand_fields": ["project.priority", "project.client.email"], "rule": { "===": [ { "var": "project.priority" }, "urgent" ] }, "actions": [ { "type": "trigger_flow", "key": "notify_project_urgent", "payload": { "task_id": { "var": "id" }, "task_title": { "var": "title" }, "project_name": { "var": "project.name" }, "client_email": { "var": "project.client.email" } } } ] }

Règle sur tâche avec lookup explicite du projet
Utile si expand_fields ne suffit pas ou si tu veux des champs dynamiques:
"rule": { "and": [ { "in": ["status", { "var": "$CHANGED" }] }, { "matches": [ { "get": [ { "lookup": ["projects", { "var": "project_id" }, ["name"], { "__ctx": [] }] }, "name" ] }, "Apollo", "i" ] } ] }

M2M: somme d’un champ sur des lignes liées
Suppose qu’on stocke les ids des lignes liées ou qu’on filtre par une clé étrangère:
"actions": [ { "type": "set_field", "field": "total_amount", "value": { "sum_by": [ { "lookup_many": ["order_lines", { "order": { "_eq": { "var": "id" } } }, ["id","amount"], 500, { "__ctx": [] }] }, "amount", {} ] } } ]

Bonnes pratiques

Préférer expand_fields pour les données relationnelles dont tu as souvent besoin dans la règle
Utiliser lookup/lookup_many pour des requêtes conditionnelles dynamiques ou des M2M complexes
Sur des gros volumes, limiter fields et filter pour éviter de charger trop
Si tu veux, je peux ajouter un exemple de règle M2M complet sur ta structure (avec le nom réel de tes relations) et un test dédié.
