# 🚀 Scripts de Migration FlowQuartz

Scripts pour créer et migrer des schémas de données vers FlowQuartz/Directus en 5 minutes !

## 📋 Scripts Disponibles

### `setup-automation-collections-api.mjs`

Crée automatiquement toutes les collections de test pour démontrer les capacités de FlowQuartz.

**Collections créées** :
- ✅ Projets & Tâches (gestion projet)
- ✅ Commandes & Lignes (e-commerce)
- ✅ Produits, Tags & Avis (catalogue)
- ✅ Campagnes cascade (5 niveaux de hiérarchie)
- ✅ Notifications & Alertes
- ✅ Documents (workflow)
- ✅ Tickets Support

**Usage** :
```bash
# Avec variables d'environnement
$env:DIRECTUS_URL="http://localhost:8055"
$env:DIRECTUS_TOKEN="votre-token-ici"
node setup-automation-collections-api.mjs

# Ou directement (utilise les valeurs par défaut)
node setup-automation-collections-api.mjs
```

## 🔧 Compatibilité SQLite / PostgreSQL

### Problème des Booleans

**SQLite** et **PostgreSQL** gèrent les booleans différemment :
- **PostgreSQL** : Type `BOOLEAN` natif (`TRUE`, `FALSE`, `NULL`)
- **SQLite** : Pas de boolean natif → stocke comme `INTEGER` (`0` = false, `1` = true)

### Solution Implémentée

Le script normalise automatiquement tous les booleans :

```javascript
// ✅ Valeurs compatibles
{ deleted: false }      // → Converti automatiquement
{ en_retard: true }     // → Fonctionne sur les deux DB

// ❌ Valeurs problématiques (avant fix)
{ deleted: "false" }    // String → erreur SQLite
{ deleted: null }       // NULL non géré → erreur
```

### Définition des Champs

Tous les champs boolean utilisent maintenant :

```javascript
{
  field: 'deleted',
  type: 'boolean',
  meta: { interface: 'boolean' },
  schema: { 
    default_value: false,
    is_nullable: false  // Force une valeur (0 ou 1)
  }
}
```

## 🎯 Fonctionnalités du Script

### 1. Normalisation Automatique

```javascript
function normalizeBooleans(obj)
```

- Parcourt récursivement tous les objets
- Convertit `true`/`false` en format compatible
- Laisse Directus gérer la conversion DB

### 2. Création Intelligente

```javascript
async function createCollectionWithFields(name, fields, meta)
```

- Détecte si la collection existe déjà → skip ou update
- Crée les champs un par un avec délai (évite surcharge API)
- Gère les erreurs gracieusement

### 3. Insertion Sécurisée

```javascript
async function insertData(collection, items)
```

- Normalise les données avant insertion
- Gère les relations entre collections
- Retourne les IDs créés pour chaînage

## 📊 Données de Test Insérées

- **2 projets** avec 3 tâches chacun
- **2 commandes** avec lignes de commande
- **3 produits** avec tags et avis
- **1 campagne** cascade complète (5 niveaux)

## 🚀 Performance

- ⚡ Création complète : **~30 secondes**
- 📦 18 collections créées
- 📝 ~30 items insérés avec relations

## 🐛 Debug

Mode verbose pour voir toutes les requêtes :

```bash
$env:VERBOSE="true"
node setup-automation-collections-api.mjs
```

## 🔐 Sécurité

⚠️ **IMPORTANT** : Ne jamais commiter le token dans le code !

Utilisez toujours les variables d'environnement :
```bash
$env:DIRECTUS_TOKEN="votre-token-secret"
```

## 📚 Prochaines Étapes

1. ✅ Import depuis JSON externe
2. ✅ Import depuis CSV/Excel
3. ✅ Templates pré-configurés (CRM, E-commerce, etc.)
4. ✅ Mode interactif (CLI avec questions)
5. ✅ Génération d'automations automatique

## 💡 Utilisation en Démo Client

**Scénario** : Le client vous donne son ancien schéma

1. **Analyser** le schéma source (SQL, JSON, etc.)
2. **Adapter** le script avec les collections client
3. **Exécuter** le script → 5 minutes max
4. **BOOM** → FlowQuartz opérationnel avec données de test !

**Impact** : Le client voit son système recréé en temps réel = 🤯

---

**Made with 💪 by the FlowQuartz Team**
