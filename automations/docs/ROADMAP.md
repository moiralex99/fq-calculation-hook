# Automations Roadmap

Cette page liste les pistes d'évolution après la V1 (stabilisée avec: when par action, update_item, update_many, throttle, hot-reload, multi-collections).

## État actuel (V1)
- [x] Déclenchement sur `items.create` / `items.update` avec `trigger_event`
- [x] Filtrage `collection_cible` (string|array)
- [x] Évaluateur JSONLogic + opérateurs custom (dates, regex, arrays, lookups)
- [x] Actions: `set_field`, `create_item`, `update_item`, `update_many`, `for_each`, `trigger_flow`, `send_email` (mock)
- [x] `when` au niveau action (garde conditionnelle)
- [x] `expand_fields` et lookups DB optionnels
- [x] Hot reload stabilisé (signature + retry/settle)
- [x] Prévention des boucles via `_automationTriggered`
- [x] Throttle/débounce par règle (`throttle_ms`, `throttle_scope`)

## Prochaines étapes possibles (V1.1)
- [ ] `delete_item` / `delete_many`
- [ ] Action HTTP/Webhook (avec allow‑list et timeouts)
- [ ] Dry‑run / mode simulation par règle
- [ ] Historique d'exécution minimal (table logs + durée + statut + erreurs)
- [ ] Étendre la signature de reload (inclure `trigger_event`, `collection_cible`, `priority`, `expand_fields`, throttle)
- [ ] Validation de schéma (JSON Schema) des règles/actions à l’activation

## V2: Exécution asynchrone par file d’attente
Objectif: découpler l’exécution des automations via une queue pour plus de robustesse, de contrôle (concurrence, retry), et de scalabilité multi‑instances.

### Pourquoi
- Lisser les pics de charge (bursts Studio/API)
- Maîtriser concurrence et ordre d’exécution
- Retry/backoff, DLQ pour résilience
- Observabilité (métriques, logs par job)

### Design
- Backend recommandé: Redis + BullMQ (simple, performant)
- Alternative sans infra: Postgres (table jobs) — plus de code à maintenir

### MVP (BullMQ)
- Enqueue côté filtres `items.create/update` au lieu d’exécuter immédiatement
  - Payload: { collection, oldData, newData, user, automationIds?, timestamp }
  - Déduplication optionnelle (clé: collection+itemId+signature)
- Worker Node séparé
  - Concurrency configurable (global / par collection)
  - Retry + backoff exponentiel, DLQ
  - Idempotence (clé de job + contrôle en base si besoin)
- Observabilité
  - Compteurs (traités/échecs), durée moyenne
  - Bull Board (facultatif) pour inspection

### Détails d’implémentation
- Enqueue API: `enqueueAutomationEvent(meta)`
- Clé de déduplication: `${collection}:${itemId}:${hash(newDataSubset)}`
- Idempotence: garder un cache/record des clés traitées pendant N minutes
- Rate limiting: global + par collection (BullMQ le supporte)
- Priorités: aligner sur `priority` de la règle

### Déploiement & rollout
- Étape 1: PoC (1–2j) – enqueue + worker + retry/backoff + concurrency
- Étape 2: Prod v1 (3–5j) – idempotence, DLQ, métriques, config par collection
- Étape 3: Multi‑instances – worker(s) dédiés (scaling horizontal)

### Risques / mitigations
- Ordonnancement strict par item: utiliser scope item pour la clé de dédup + limiter la concurrence par item
- Jobs orphelins: timeouts + retry + DLQ
- Pannes Redis: fallback temporaire (exec direct) ou file Postgres (option future)

## Idées complémentaires
- [ ] Builder visuel (UI) pour composer règles/actions
- [ ] Permissions fines / garde‑fous (cap de lignes touchées, safeties)
- [ ] Export/Import d’automations (bundles)
- [ ] Tests d’intégration e2e + benchs (datasets synthétiques)

---

Notes:
- Le throttle actuel coalesce déjà au niveau process. La file d’attente viendra compléter pour la résilience et le multi‑node.
- update_many est la voie privilégiée pour les cascades massives; conserver des index adaptés sur les colonnes de filtre.
