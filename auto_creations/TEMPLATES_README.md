# 📦 FlowQuartz Template Library

Bibliothèque de **30+ templates** pré-configurés pour démarrer rapidement avec FlowQuartz/Directus.

Source principale : **NocoDB** (templates open-source de qualité)

---

## 🚀 Quick Start

### 1. Télécharger les templates NocoDB

```bash
# Télécharger tous les templates
node nocodb-scraper.mjs

# Ou un template spécifique
node nocodb-scraper.mjs --template crm-complete
```

**Résultat** : Fichiers JSON dans `templates/nocodb/`

### 2. Générer le script d'installation Directus

```bash
# Convertir template → script Directus
node template-setup-generator.mjs \
  --input templates/nocodb/crm-complete.json \
  --output setup-crm.mjs
```

**Résultat** : Script `setup-crm.mjs` prêt à exécuter

### 3. Installer dans Directus

```bash
# Configuration
$env:DIRECTUS_URL="http://127.0.0.1:8055"
$env:DIRECTUS_TOKEN="your-admin-token"

# Installation
node setup-crm.mjs
```

**Résultat** : Collections créées dans Directus ! ✅

---

## 📋 Templates Disponibles

### Business & Operations

| Template | Collections | Description |
|----------|-------------|-------------|
| `crm-complete` | 5 | CRM complet (companies, contacts, deals, activities, tasks) |
| `project-management` | 4 | Gestion projets (projects, tasks, milestones, team_members) |
| `sales-pipeline` | 4 | Pipeline commercial (leads, opportunities, quotes, contracts) |
| `hr-management` | 5 | RH (employees, departments, positions, candidates, leaves) |
| `inventory` | 4 | Inventaire (products, warehouses, orders, suppliers) |

### Vertical Industries

| Template | Collections | Description |
|----------|-------------|-------------|
| `event-planning` | 5 | Événements (events, venues, attendees, tasks, budgets) |
| `real-estate` | 4 | Immobilier (properties, clients, showings, contracts) |
| `restaurant` | 4 | Restaurant (menu_items, orders, reservations, tables) |
| `library-management` | 4 | Bibliothèque (books, members, loans, categories) |

### Internal Tools

| Template | Collections | Description |
|----------|-------------|-------------|
| `issue-tracker` | 4 | Bugs/Tickets (issues, projects, users, comments) |

---

## 🔧 Commandes Utiles

### Lister les templates disponibles

```bash
node nocodb-scraper.mjs --list
```

### Télécharger en batch

```bash
# Télécharger 10 templates les plus utiles
node nocodb-scraper.mjs
```

### Générer tous les setups

```bash
# Bash/PowerShell loop
Get-ChildItem templates/nocodb/*.json | ForEach-Object {
  node template-setup-generator.mjs `
    --input $_.FullName `
    --output "setup-$($_.BaseName).mjs"
}
```

---

## 📚 Structure des Templates

### Format JSON

```json
{
  "name": "CRM Complet",
  "key": "crm-complete",
  "description": "Gestion complète de la relation client",
  "collections": [
    {
      "name": "companies",
      "fields": [
        {
          "field": "name",
          "type": "string",
          "meta": { "interface": "input", "required": true },
          "schema": {}
        }
      ],
      "meta": {
        "icon": "business",
        "note": "Companies collection"
      }
    }
  ],
  "version": "1.0.0",
  "source": "NocoDB",
  "created_at": "2025-01-20T..."
}
```

### Conversion NocoDB → Directus

| NocoDB Type | Directus Type | Interface |
|-------------|----------------|-----------|
| SingleLineText | string | input |
| LongText | text | input-multiline |
| Number | integer | input |
| Decimal | decimal | input |
| Currency | decimal | input |
| Date | date | datetime |
| DateTime | timestamp | datetime |
| Checkbox | boolean | boolean |
| SingleSelect | string | select-dropdown |
| MultiSelect | json | select-multiple-dropdown |
| Email | string | input |
| PhoneNumber | string | input |
| URL | string | input |
| Attachment | uuid | file |
| LinkToAnotherRecord | integer | (relation M2O/O2M) |

---

## 🎯 Roadmap

### Phase 1 : Core Templates (Done ✅)
- ✅ NocoDB scraper
- ✅ Template generator
- ✅ 10 templates de base

### Phase 2 : Enrichment (En cours 🔧)
- 🔧 Ajouter automations pré-configurées
- 🔧 Ajouter formules calculées
- 🔧 Ajouter données de test

### Phase 3 : Plus de Sources
- ⏳ Baserow templates
- ⏳ Airtable Universe
- ⏳ Schema.org templates

### Phase 4 : Template Marketplace
- ⏳ UI de sélection
- ⏳ Preview avant installation
- ⏳ Community templates

---

## 💡 Utilisation Avancée

### Personnaliser avant installation

```javascript
// 1. Charger template
const template = JSON.parse(fs.readFileSync('templates/nocodb/crm-complete.json'));

// 2. Modifier
template.collections[0].fields.push({
  field: 'custom_field',
  type: 'string',
  meta: { interface: 'input' },
  schema: {}
});

// 3. Générer setup
const code = generateDirectusSetup(template);
fs.writeFileSync('setup-custom.mjs', code);
```

### Ajouter des données de test

```javascript
// Dans le setup généré, ajouter après les collections:
const companies = await insertData('companies', [
  { name: 'Acme Corp', industry: 'Tech' },
  { name: 'Globex Inc', industry: 'Manufacturing' }
]);

const contacts = await insertData('contacts', [
  { first_name: 'John', last_name: 'Doe', company_id: companies[0].id }
]);
```

---

## 🐛 Troubleshooting

### Template ne se télécharge pas

**Problème** : URLs GitHub ne répondent pas

**Solution** : Le scraper utilise automatiquement les templates manuels de secours

### Erreur "Collection already exists"

**Problème** : Template déjà installé

**Solution** : C'est normal, le script continue avec les autres collections

### Boolean fields not working on SQLite

**Problème** : SQLite stocke booleans comme INTEGER

**Solution** : Le script utilise `normalizeBooleans()` automatiquement

---

## 📞 Support

Pour les testeurs :
- ✅ 10 templates prêts à l'emploi
- ✅ Installation en 1 commande
- ✅ Compatible PostgreSQL + SQLite
- ✅ Données de test optionnelles

**Questions** ? Ouvre une issue ou ping @Ali 😎

---

**Made with 💪 by FlowQuartz Team**
