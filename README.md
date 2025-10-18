# Calculated Fields Hook (Directus v11)# Extension Directus - Calculs en Temps Réel



MVP d'extension Directus pour champs calculés post-commit avec rechargement à chaud et recalcul batch.Extension Directus légère qui calcule automatiquement des champs basés sur des formules **en temps réel**, uniquement sur la même fiche.



- Docs principales:## 🚀 Guide rapide opérateur (ajouté)

  - `docs/FEATURE_MATRIX.md` — Extension vs Engine complet (positionnement et limites)

  - `docs/FORMULA_FUNCTIONS.md` — Inventaire des fonctions (DSL)Ce hook recharge désormais les formules automatiquement et de façon fiable, sans redémarrer Directus.

- Endpoints (base `/directus-endpoint-realtime-calc-utils`):

  - GET  `/realtime-calc/status`- Auto‑reload sur modifications de `quartz_formulas`

  - POST `/realtime-calc/reload`  - Déclenché sur `items.create/update/delete` de la collection `quartz_formulas`

  - POST `/realtime-calc/recalculate`  - Debounce: 5 secondes (absorbe les rafales de PATCH du Studio)

- Scripts de recalc et exemples: `../realtime-calc-endpoint/scripts/README.md`  - Reload stabilisé: plusieurs lectures sans cache avec comparaison de signature pour éviter de charger l’avant‑dernière version



Note: Cette extension vise la simplicité et la stabilité. Pour des cas avancés (héritage, multi-sauts, M2M, fenêtre, regex multi-SGBD), se référer à l'engine complet.- Logs utiles (après reload)

  - Comptes par collection, liste des champs, et contenu exact des formules rechargées
  - Exemple:
    - `[RealTime-Calc] ✅ Auto-reload complete: 20 formula(s) active across 5 collection(s)`
    - `[RealTime-Calc] 📦 Reload collections: {"test_calculs":2,...}`
    - `[RealTime-Calc] 📄 Fields per collection: {"test_calculs":["total","total_2"],...}` (debug)
    - `[RealTime-Calc] 🧾 Formulas content: {"test_calculs":{"total":"{{prix}} * {{quantite}}", ...}}`

- Action manuelle (si besoin)
  - Action: `realtime-calc.reload-formulas`
  - Elle utilise le même rechargement stabilisé que l’auto‑reload
  - Utile si vous avez un doute; sinon, l’auto‑reload suffit

- Caveat sur les réponses immédiates
  - Les calculs sont faits post‑commit via un `update` séparé; la réponse immédiate d’un PATCH peut encore montrer l’ancienne valeur
  - Faites un GET juste après (ou rafraîchissez dans le Studio) pour voir les champs calculés à jour

- Paramétrage (fichier `src/index.js`)
  - Debounce reload: `scheduleFormulasReload` (5_000 ms)
  - Stabilisation: `stableReloadFormulas({ attempts: 3, settleDelayMs: 700 })`
  - Vous pouvez augmenter `attempts` à 4–5 et/ou `settleDelayMs` si votre environnement a encore des retards de propagation

Astuce: utilisez `check-formulas.ps1` pour lister rapidement les formules publiées et tester un PATCH de validation.

## 🔁 Forcer un recalcul d'une collection (batch)

L'extension expose une action interne pour recalculer tous les items d'une collection, utile après l'ajout/modification de formules ou pour "réparer" un lot existant.

- Nom de l'action: `realtime-calc.recalculate-collection`
- Paramètres:
  - `collection` (string, requis): nom de la collection
  - `fields` (array<string> | string, optionnel): liste des champs calculés à recalculer (les dépendances locales sont ajoutées automatiquement). Si omis ou vide, tous les champs locaux de la collection sont recalculés.
  - `filter` (objet Directus, optionnel): filtre pour cibler un sous-ensemble d'items
  - `batchSize` (number, optionnel, 1–500, défaut 100): pagination
  - `dryRun` (boolean, optionnel): si `true`, ne fait pas d'UPDATE mais compte ce qui serait modifié

### Exemple d'appel depuis un Flow Directus (Operation: Run Script)

Insérez une opération "Run Script" dans un Flow (manuel ou planifié) avec ce code:

```js
// Disponible dans l'opération: { services, database, getSchema, logger, emitter, payload }
const params = {
  collection: 'test_calculs',
  // filter: { quantite: { _gt: 0 } },
  batchSize: 200,
  dryRun: false,
};

const result = await emitter.emitAction('realtime-calc.recalculate-collection', params);
logger.info(`[Recalc] ${result.message}`);

return result; // pour l'utiliser dans les étapes suivantes du Flow
```

### Payloads types

- Recalcule toute la collection

```json
{ "collection": "test_calculs" }
```

- Dry-run filtré (ne fait pas d'UPDATE)

```json
{ "collection": "test_calculs", "filter": { "quantite": { "_gt": 0 } }, "dryRun": true }
```

- Cibler quelques champs (et leurs dépendances locales)

```json
{ "collection": "test_calculs", "fields": ["total_ttc", "montant_tva"] }
```

- Lot plus gros

```json
{ "collection": "test_produits_avance", "batchSize": 300 }
```

Résultat renvoyé:

```json
{
  "success": true,
  "collection": "test_calculs",
  "processed": 123,
  "updated": 87,
  "total": 200,
  "dryRun": false,
  "fields": ["total_ht", "montant_tva", "total_ttc"],
  "message": "Updated 87 item(s) on 123 processed."
}
```

Note: cette action utilise le même moteur de calcul que les updates en temps réel et n'écrit que lorsque la valeur change réellement.

## 🎯 Positionnement

Cette extension fait partie de l'écosystème **FlowQuartz Engine** :

| Feature | Extension Temps Réel | Engine Python Complet |
|---------|---------------------|----------------------|
| **Offre** | ✅ Inclus dans l'offre normale | 💎 Feature premium |
| **Déploiement** | ✅ Hook Directus (léger) | ⚙️ Serveur dédié |
| **Périmètre** | Une fiche à la fois | Toutes collections + héritage |
| **Formules** | Locales uniquement | Complètes (relations, agrégations) |
| **Base** | JavaScript (temps réel) | DuckDB + SQL (batch optimisé) |
| **Config** | Même table `quartz_formulas` | Même table `quartz_formulas` |
| **DSL** | Subset compatible | DSL complet |

## ✅ Ce qui est supporté

### Formules locales
- ✅ Champs de la même fiche : `{{field_name}}`
- ✅ Arithmétique : `{{prix}} * {{quantite}}`
- ✅ Conditions : `IF({{stock}} < 10, "Alerte", "OK")`
- ✅ Fonctions : `COALESCE()`, `ROUND()`, `NULLIF()`, etc.
- ✅ Logique : `AND`, `OR`, `NOT`
- ✅ Comparaisons : `=`, `<>`, `<`, `<=`, `>`, `>=`
- ✅ Texte : `UPPER()`, `LOWER()`, `CONCAT()`

### Features avancées
- ✅ Lit depuis `quartz_formulas` (même table que l'engine)
- ✅ Détecte automatiquement les formules locales vs relationnelles
- ✅ Construit l'arbre de dépendances (tri topologique)
- ✅ Calcule dans le bon ordre
- ✅ Optimisation : ne recalcule que les champs affectés
- ✅ Ne write que si la valeur change

## ❌ Ce qui nécessite l'engine complet

- ❌ Relations : `{{Collection.field}}`
- ❌ Agrégations : `SUM()`, `AVG()`, `COUNT()`
- ❌ Lookups : `LOOKUP()`
- ❌ Héritage : `PARENT()`
- ❌ Consolidation multi-fiches

## 📦 Installation

### 1. Copier l'extension dans Directus

```bash
cd extensions/hooks
cp -r /chemin/vers/calculated-fields-hook ./realtime-calc
cd realtime-calc
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Build l'extension

```bash
npm run build
```

### 4. Redémarrer Directus

```bash
cd ../../..
npm run start
```

L'extension charge automatiquement les formules depuis `quartz_formulas` ! 🎉

### 📊 Interface d'administration "Recalc Formules"

Une fois l'extension buildée et installée, un module personnalisé apparaît dans le menu Directus : **Recalc Formules**. Il permet de :

- Sélectionner une collection et ses champs calculés (avec auto-complétion des dépendances)
- Appliquer un filtre JSON (facultatif)
- Lancer un recalcul immédiat ou en mode dry-run
- Visualiser la réponse détaillée de l'API

### 🛠️ Endpoint & CLI

- Endpoint HTTP : `POST /realtime-calc/utils/realtime-calc.recalculate-collection` — accepte désormais `fields`, `filter`, `batchSize`, `dryRun`
- Script CLI (PowerShell / Node) :

```powershell
node scripts/recalc-collection.mjs collection=test_calculs fields=total_ttc,montant_tva dryRun=true
```

Le script appelle directement l'endpoint et renvoie la réponse JSON (code de sortie ≠ 0 en cas d'échec).

## ⚙️ Configuration

### Structure de la table `quartz_formulas`

```sql
CREATE TABLE quartz_formulas (
  id SERIAL PRIMARY KEY,
  collection_cible VARCHAR,  -- Ex: "factures"
  champ_cible VARCHAR,       -- Ex: "total_ttc"
  formula TEXT,              -- Ex: "{{total_ht}} * 1.2"
  status VARCHAR,            -- published | draft | archived
  sort INT,                  -- Ordre suggéré
  description TEXT,
  date_created TIMESTAMP,
  date_updated TIMESTAMP
);
```

### Ajouter des formules

Via l'interface Directus ou directement en SQL :

```sql
INSERT INTO quartz_formulas 
  (collection_cible, champ_cible, formula, status, sort)
VALUES
  ('factures', 'total_ht', '{{quantite}} * {{prix_unitaire}}', 'published', 1),
  ('factures', 'montant_tva', '{{total_ht}} * {{taux_tva}} / 100', 'published', 2),
  ('factures', 'total_ttc', '{{total_ht}} + {{montant_tva}}', 'published', 3);
```

**L'extension détecte automatiquement :**
- ✅ Les 3 formules sont locales → chargées
- ✅ Dépendances : `total_ttc` dépend de `total_ht` et `montant_tva`
- ✅ Ordre de calcul : `total_ht` → `montant_tva` → `total_ttc`

## 📚 Syntaxe DSL (compatible avec l'engine Python)

### Champs

```javascript
{{field_name}}        // Champ de la même fiche
{{Collection.field}}  // ❌ Non supporté (nécessite l'engine)
```

### Arithmétique

```javascript
{{a}} + {{b}}
{{a}} - {{b}}
{{a}} * {{b}}
{{a}} / {{b}}
{{a}} % {{b}}
```

### Comparaisons

```javascript
{{a}} = {{b}}      // Égalité
{{a}} <> {{b}}     // Différent
{{a}} != {{b}}     // Différent (alias)
{{a}} < {{b}}
{{a}} <= {{b}}
{{a}} > {{b}}
{{a}} >= {{b}}
```

### Logique

```javascript
{{a}} AND {{b}}
{{a}} OR {{b}}
NOT {{condition}}
```

### Fonctions

```javascript
// Condition
IF(condition, valeur_si_vrai, valeur_si_faux)
IF({{stock}} < 10, "Alerte", "OK")

// Coalescence
COALESCE({{a}}, {{b}}, valeur_defaut)
COALESCE({{description}}, "Aucune description")

// Arrondi
ROUND({{valeur}}, decimales)
ROUND({{prix}}, 2)

// Null if
NULLIF({{valeur}}, valeur_a_comparer)
NULLIF({{montant}}, 0)

// Texte
UPPER({{nom}})
LOWER({{email}})
CONCAT({{prenom}}, " ", {{nom}})
```

## 💡 Exemples Complets

### Exemple 1: Facture avec TVA

**Collections Directus :**
```
factures:
  - quantite (integer)
  - prix_unitaire (decimal)
  - taux_tva (decimal, valeur: 20)
  - total_ht (decimal) ← calculé
  - montant_tva (decimal) ← calculé
  - total_ttc (decimal) ← calculé
```

**Formules dans `quartz_formulas` :**
```sql
collection_cible | champ_cible  | formula
-----------------|--------------|----------------------------------
factures         | total_ht     | {{quantite}} * {{prix_unitaire}}
factures         | montant_tva  | {{total_ht}} * {{taux_tva}} / 100
factures         | total_ttc    | {{total_ht}} + {{montant_tva}}
```

**Résultat :**
Lors de la création/modification d'une facture, les 3 champs sont calculés automatiquement dans le bon ordre !

### Exemple 2: Conditions et remises

**Collections Directus :**
```
commandes:
  - montant (decimal)
  - est_client_vip (boolean)
  - remise_pourcent (decimal) ← calculé
  - montant_final (decimal) ← calculé
```

**Formules :**
```sql
collection_cible | champ_cible      | formula
-----------------|------------------|-------------------------------------
commandes        | remise_pourcent  | IF({{est_client_vip}} AND {{montant}} > 1000, 15, IF({{montant}} > 1000, 10, 5))
commandes        | montant_final    | {{montant}} * (100 - {{remise_pourcent}}) / 100
```

### Exemple 3: Gestion de stock

**Collections Directus :**
```
inventaire:
  - stock_initial (integer)
  - entrees (integer)
  - sorties (integer)
  - seuil_alerte (integer, valeur: 10)
  - stock_final (integer) ← calculé
  - statut (string) ← calculé
```

**Formules :**
```sql
collection_cible | champ_cible | formula
-----------------|-------------|-------------------------------------------
inventaire       | stock_final | {{stock_initial}} + {{entrees}} - {{sorties}}
inventaire       | statut      | IF({{stock_final}} < {{seuil_alerte}}, "🔴 Alerte", IF({{stock_final}} < {{seuil_alerte}} * 2, "🟡 Attention", "🟢 OK"))
```

## 🧪 Tester une Formule

L'extension fournit une action pour tester vos formules avant de les déployer :

```bash
POST /utils/realtime-calc.test-formula
Content-Type: application/json

{
  "formula": "{{quantite}} * {{prix_unitaire}}",
  "sampleData": {
    "quantite": 5,
    "prix_unitaire": 19.99
  }
}
```

**Réponse :**
```json
{
  "valid": true,
  "result": 99.95,
  "fields": ["quantite", "prix_unitaire"],
  "isLocal": true,
  "message": "Formula is valid (local). Result: 99.95"
}
```

**Si la formule nécessite l'engine :**
```json
{
  "valid": true,
  "result": null,
  "isLocal": false,
  "message": "Formula is valid but requires full engine (uses relations/aggregations)"
}
```

## 🔄 Recharger les Formules

```bash
POST /utils/realtime-calc.reload-formulas
```

**Réponse :**
```json
{
  "success": true,
  "message": "Reloaded 15 formula(s) from 3 collection(s)",
  "stats": {
    "collections": 3,
    "totalFormulas": 15
  }
}
```

## 📊 Performance

- **Chargement initial :** ~100ms (avec cache de 1 min)
- **Calcul par item :** ~5-10ms pour 3-5 formules
- **Optimisation update :** Seulement les champs affectés sont recalculés
- **Comparaison valeurs :** Évite les écritures inutiles en DB

## 🎓 Bonnes Pratiques

### 1. Créer les champs dans Directus d'abord

Créez tous les champs (y compris calculés) dans l'interface Directus avec les bons types.

### 2. Tester les formules avant déploiement

Utilisez l'action `test-formula` pour valider vos formules.

### 3. Ordre des calculs

L'extension détecte automatiquement l'ordre, mais logiquement :
```
Champs sources → Calculs intermédiaires → Résultat final
```

### 4. Formules complexes → Engine complet

Si vous avez besoin de :
- Relations entre collections
- Agrégations (SUM, AVG, COUNT)
- Héritage de valeurs
- Consolidation

→ Utilisez l'engine Python complet (feature premium)

## 🔧 Dépannage

### L'extension ne se charge pas

```bash
# Vérifier les logs Directus
docker logs directus
# ou
npm run start
```

### Les formules ne sont pas chargées

1. Vérifier que `quartz_formulas` existe
2. Vérifier que `status = 'published'`
3. Vérifier les logs : `[FormulaLoader]`

### Une formule est ignorée

Si vous voyez :
```
[FormulaLoader] Skipping non-local formula: collection.field
```

→ La formule utilise des relations/agrégations et nécessite l'engine complet.

### Formule invalide

Utilisez l'action `test-formula` pour identifier l'erreur exacte.

## � Notes de Sécurité

Exécuter des formules utilisateur implique des risques. Cette extension:

- n'exécute que des formules locales (pas d'accès aux relations/agrégations)
- traduit un DSL restreint vers du JavaScript et n'expose que des helpers sûrs (IF, COALESCE, ROUND, ...)
- n'écrit jamais en base en cas d'erreur d'évaluation (la valeur existante est préservée)
- journalise les erreurs et ignore la mise à jour sur le champ concerné

Conseils:

- Activez le niveau de logs approprié en production
- Utilisez l'action `realtime-calc.test-formula` pour valider une formule et vérifier si elle est locale
- En cas d'évolution du DSL, étendez les helpers dans `dsl-parser.js#createHelpers`

## 📜 Scripts NPM

- `npm run build`: build l'extension
- `npm run dev`: build en watch
- `npm run link`: link local dans un projet Directus
- `npm test`: exécute la suite de tests rapide (JS pur)

## �📄 Licence

MIT

## 🤝 Écosystème FlowQuartz

- **Extension Temps Réel** (ce repo) : Calculs locaux en temps réel
- **Engine Python Complet** : Calculs avancés avec relations, agrégations, consolidation
- **Table commune** : `quartz_formulas` partagée entre les deux

---

**Made with ❤️ for Directus**

## 🎯 Fonctionnalités

## 🔒 Comportement de fusion du payload

Depuis la dernière mise à jour, le hook garantit que:

- Les champs modifiés par l'utilisateur sont toujours conservés tels quels.
- Les champs calculés sont simplement ajoutés au payload (merge) par-dessus le payload utilisateur.
- S'il n'y a aucune formule pour la collection ciblée, le hook ne modifie rien et laisse passer le payload original.
- En cas d'erreur lors de la récupération de l'item existant (mise à jour par filtre, etc.), le calcul se fait au mieux avec les données fournies, sans bloquer la mise à jour.

Cela évite que des mises à jour « normales » soient bloquées ou écrasées par l'extension.

- ✅ **Calculs automatiques** lors de la création/modification d'items
- ✅ **Temps réel** - Les champs sont calculés avant l'enregistrement en base
- ✅ **Formules simples** - Arithmétique, conditions, fonctions de texte
- ✅ **Sans dépendances externes** - Fonctionne uniquement sur les champs de la même fiche
- ✅ **Léger et performant** - Pas de requêtes supplémentaires
- ✅ **Facile à configurer** - Configuration directement dans le code

## 📦 Installation

### 1. Copier l'extension dans Directus

```bash
# Dans votre projet Directus
cd extensions/hooks

# Cloner ou copier ce dossier
cp -r /chemin/vers/calculated-fields-hook ./realtime-calc
```

### 2. Installer les dépendances

```bash
cd realtime-calc
npm install
```

### 3. Build l'extension

```bash
npm run build
```

### 4. Redémarrer Directus

```bash
# Retour à la racine du projet Directus
cd ../..
npm run start
```

L'extension est maintenant active ! 🎉

## ⚙️ Configuration

Éditez le fichier `src/index.js` pour définir vos champs calculés :

```javascript
const CALCULATED_FIELDS_CONFIG = {
  // Collection "factures"
  factures: {
    total_ht: 'quantite * prix_unitaire',
    tva: 'PERCENT(total_ht, taux_tva)',
    total_ttc: 'total_ht + tva',
    remise_montant: 'PERCENT(total_ht, remise_pourcent)',
    total_net: 'total_ht - remise_montant'
  },
  
  // Collection "produits"
  produits: {
    prix_ttc: 'prix_ht * (1 + taux_tva / 100)',
    marge: 'prix_vente - prix_achat',
    marge_pourcent: 'ROUND((marge / prix_achat) * 100, 2)'
  }
};
```

Après modification, rebuild :
```bash
npm run build
# Redémarrer Directus
```

## 📚 Fonctions Disponibles

### Arithmétique
- `+`, `-`, `*`, `/` - Opérations de base
- `^` ou `pow(x, y)` - Puissance
- `sqrt(x)` - Racine carrée
- `abs(x)` - Valeur absolue

### Arrondis
- `ROUND(valeur, decimales)` - Arrondi à N décimales
- `ceil(x)` - Arrondi supérieur
- `floor(x)` - Arrondi inférieur

### Pourcentages
- `PERCENT(montant, pourcentage)` - Calcul de pourcentage

### Conditions
- `IF(condition, siVrai, siFaux)` - Condition
- `condition ? siVrai : siFaux` - Opérateur ternaire
- `==`, `!=`, `>`, `<`, `>=`, `<=` - Comparaisons
- `and`, `or`, `not` - Logique booléenne

### Texte
- `CONCAT(texte1, texte2, ...)` - Concaténation
- `UPPER(texte)` - Majuscules
- `LOWER(texte)` - Minuscules
- `LEN(texte)` - Longueur
- `SUBSTR(texte, debut, longueur)` - Extraction

### Utilitaires
- `COALESCE(val1, val2, ...)` - Première valeur non-nulle
- `NUMBER(valeur)` - Conversion en nombre

## 💡 Exemples d'Utilisation

### Exemple 1: Facture simple

**Collections Directus:**
```
Collection: commandes
- quantite (integer)
- prix_unitaire (decimal)
- taux_tva (decimal, ex: 20)
- total_ht (decimal) ← calculé
- montant_tva (decimal) ← calculé
- total_ttc (decimal) ← calculé
```

**Configuration:**
```javascript
commandes: {
  total_ht: 'quantite * prix_unitaire',
  montant_tva: 'PERCENT(total_ht, taux_tva)',
  total_ttc: 'total_ht + montant_tva'
}
```

### Exemple 2: Remise et prix final

**Collections Directus:**
```
Collection: ventes
- prix_base (decimal)
- remise_pourcent (decimal, ex: 10)
- remise_montant (decimal) ← calculé
- prix_final (decimal) ← calculé
```

**Configuration:**
```javascript
ventes: {
  remise_montant: 'PERCENT(prix_base, remise_pourcent)',
  prix_final: 'ROUND(prix_base - remise_montant, 2)'
}
```

### Exemple 3: Calculs conditionnels

**Collections Directus:**
```
Collection: employes
- salaire_base (decimal)
- anciennete_annees (integer)
- prime (decimal) ← calculé
- salaire_total (decimal) ← calculé
```

**Configuration:**
```javascript
employes: {
  prime: 'IF(anciennete_annees > 5, PERCENT(salaire_base, 10), PERCENT(salaire_base, 5))',
  salaire_total: 'salaire_base + prime'
}
```

### Exemple 4: Calculs de stock

**Collections Directus:**
```
Collection: inventaire
- stock_initial (integer)
- entrees (integer)
- sorties (integer)
- stock_final (integer) ← calculé
- alerte (boolean) ← calculé
```

**Configuration:**
```javascript
inventaire: {
  stock_final: 'stock_initial + entrees - sorties',
  alerte: 'stock_final < 10'
}
```

## 🧪 Tester une Formule

L'extension fournit une action custom pour tester vos formules :

```bash
# Via l'API Directus
POST /utils/realtime-calc.test-formula
{
  "formula": "quantite * prix_unitaire",
  "sampleData": {
    "quantite": 5,
    "prix_unitaire": 19.99
  }
}

# Réponse
{
  "valid": true,
  "result": 99.95,
  "fields": ["quantite", "prix_unitaire"],
  "message": "Formula is valid. Result: 99.95"
}
```

## 📝 Bonnes Pratiques

### 1. Créer les champs dans Directus

Avant de configurer les formules, créez les champs dans l'interface Directus :
- Type: `Decimal` pour les montants
- Type: `Integer` pour les quantités
- Type: `Boolean` pour les conditions
- Type: `String` pour les textes calculés

### 2. Ordre des calculs

Les formules peuvent référencer d'autres champs calculés si définis avant :
```javascript
produits: {
  prix_ht: 'prix_base - remise',           // Calculé en premier
  tva: 'PERCENT(prix_ht, 20)',             // Utilise prix_ht
  prix_ttc: 'prix_ht + tva'                // Utilise prix_ht et tva
}
```

### 3. Valeurs par défaut

Les champs `null` sont automatiquement convertis en `0` pour les calculs numériques.

### 4. Gestion des erreurs

Si une formule échoue, le champ sera mis à `null` et l'erreur sera loggée, mais l'opération ne sera pas bloquée.

## 🚀 Développement

### Mode développement avec hot-reload

```bash
npm run dev
```

### Tester localement

```bash
npm run link
```

## 📊 Limitations

- ⚠️ **Pas de relations** - Fonctionne uniquement sur les champs de la même fiche
- ⚠️ **Pas d'héritage** - Pas de calculs basés sur des fiches parentes
- ⚠️ **Pas de consolidation** - Pas d'agrégation de plusieurs fiches
- ⚠️ **Synchrone uniquement** - Pas d'appels API externes

Pour ces besoins avancés, utilisez le moteur complet FlowQuartz Engine.

## 🔧 Dépannage

### L'extension ne se charge pas

Vérifiez les logs Directus :
```bash
docker logs directus
# ou
npm run start
```

### Les champs ne sont pas calculés

1. Vérifiez que les noms de champs correspondent exactement à ceux dans Directus
2. Testez la formule avec l'action `test-formula`
3. Vérifiez les logs pour les erreurs

### Erreur de syntaxe dans la formule

Utilisez l'action de test pour valider vos formules avant de les déployer.

## 📄 Licence

MIT

## 🤝 Support

Pour des besoins plus avancés (héritage, consolidation, calculs complexes), contactez-nous pour FlowQuartz Engine.
