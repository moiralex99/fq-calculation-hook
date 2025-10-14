# Extension vs Engine complet

Cette extension est un MVP utile pour démarrer et valider des cas simples. L'engine complet apporte des fonctionnalités avancées et des optimisations.

## Ce que couvre l'extension (MVP)

- Recalcul post-commit (create/update) avec ordre des dépendances
- Hot-reload des formules (endpoint /reload)
- Recalcul batch par collection (endpoint /recalculate) avec filter et pagination
- DSL de base: logique, comparaisons, arithmétique, dates (core), chaînes simples, cast/try_cast
- Agrégations parent→enfant classiques (sum/avg/min/max/count)

## Limitations volontaires du MVP

- Pas d'héritage N→1 clé-en-main (pas d'alias `inherit(...)`, pas de cascade auto parent→enfants)
- Pas de multi-sauts ni M2M
- Fonctions avancées non garanties multi-SGBD (regex, fenêtre, greatest/least, array_agg, ...)

## Ce que l'engine complet apporte

- Héritage natif (alias `inherit(...)`) + recalculs cross-collection automatiques et robustes
- Jeu complet de fonctions (regex compatibles, agrégats avancés, fenêtres)
- Optimisations DB (indexations, requêtes dédiées), profils de performance, logs détaillés
- Outils de migration/tests, matrice de compatibilité par SGBD

## Endpoints utiles (extension)

Base: `/directus-endpoint-realtime-calc-utils`
- GET  `/realtime-calc/status`
- POST `/realtime-calc/reload`
- POST `/realtime-calc/recalculate` `{ collection, filter, batchSize, dryRun }`

## Docs

- Inventaire des fonctions: `docs/FORMULA_FUNCTIONS.md`
- Scripts CLI (recalc): voir `../realtime-calc-endpoint/scripts/README.md`
