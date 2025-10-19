# Exemples d'Automatismes

## Total = quantite * prix lorsque l'un des deux change

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

Notes:
- La condition utilise `$CHANGED` (liste des champs modifiés) pour ne déclencher que si `quantite` ou `prix` a changé.
- La valeur de l'action est une expression JSONLogic qui multiplie `quantite` par `prix`.
- Nécessite la version de l'engine qui évalue les valeurs d'action via JSONLogic (inclus dans ce repo).
