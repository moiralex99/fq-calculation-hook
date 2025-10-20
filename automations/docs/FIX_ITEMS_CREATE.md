# Solution au problème items.create + lookup_many

## Le problème

Sur `items.create`, les automations se déclenchent **PENDANT** la transaction, avant que l'item soit committé en DB.

Si l'automation fait un `lookup_many`, elle interroge la DB mais l'item n'existe pas encore → comportement imprévisible ou crash.

## Solution immédiate: Utiliser `action` au lieu de `filter` pour `items.create`

Les hooks Directus:
- **`filter`**: Se déclenche PENDANT la transaction (avant commit)
- **`action`**: Se déclenche APRÈS le commit en DB ✅

### Modification à faire

Dans `automations/src/index.js`, déplacer la logique des automations `items.create` du hook `filter` vers le hook `action`.

**Avantage**:
- L'item existe déjà en DB quand l'automation s'exécute
- `lookup_many` fonctionne correctement
- Plus de crash

**Inconvénient**:
- Les modifications calculées par l'automation ne sont PAS écrites dans le même commit que la création
- Il faut faire un UPDATE après la création

### Alternative: Ne pas utiliser lookup_many dans items.create

Pour les automations qui se déclenchent sur `items.create`, éviter les `lookup_many` qui incluent l'item en cours.

**Exemple Test 7** (Calcul note moyenne):
- Déclencher sur `items.create` d'un avis → OK
- Mais faire `lookup_many` pour récupérer TOUS les avis du produit
- L'avis en cours de création n'est pas encore en DB → résultat incomplet

**Solution**: Utiliser `items.update` après la création, ou calculer sans `lookup_many`.

## TODO

Modifier le code pour que les automations `items.create` utilisent le hook `action` au lieu de `filter`.
