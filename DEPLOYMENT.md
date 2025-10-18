# Déploiement de l'extension Directus Realtime-Calc

Cette extension est divisée en **deux packages** pour compatibilité avec Directus 11 :

## 1. Bundle Principal (Hook + Endpoint)

**Package** : `directus-extension-realtime-calc-bundle`  
**Contient** :
- Hook de calcul des formules (`realtime-calc-hook`)
- Endpoint API de recalcul (`realtime-calc-endpoint`)

### Build
```bash
npm run build
```

**Fichier généré** : `dist/index.js`

## 2. Module UI Standalone

**Package** : `directus-extension-realtime-recalc-module`  
**Contient** :
- Interface admin pour lancer les recalculs manuels

### Build
```bash
cd module-recalc
npm install
npm run build
```

**Fichier généré** : `module-recalc/dist/index.js`

---

## Installation dans Directus

### Option 1 : Extensions locales (Développement)

Copie les **deux fichiers** dans le dossier `extensions` de Directus :

```bash
# Bundle hook + endpoint
cp dist/index.js /path/to/directus/extensions/directus-extension-realtime-calc-bundle/

# Module UI
cp module-recalc/dist/index.js /path/to/directus/extensions/directus-extension-realtime-recalc-module/
```

### Option 2 : NPM Packages (Production)

Après publication sur npm :

```bash
cd /path/to/directus
npm install directus-extension-realtime-calc-bundle
npm install directus-extension-realtime-recalc-module
```

---

## Vérification dans Directus

1. **Extensions page** (`/admin/settings/extensions`) :
   - ✅ `realtime-calc-hook` (Hook)
   - ✅ `realtime-calc-endpoint` (Endpoint)
   - ✅ `realtime-recalc-dashboard` (Module)

2. **Module UI** :
   - Visible dans le menu de navigation latéral
   - Icône : 📈 (auto_graph)
   - Nom : **Recalc Formules**

3. **Endpoint API** :
   - Route : `POST /realtime-calc/utils/realtime-calc.recalculate-collection`
   - Accessible via module UI ou CLI script

---

## Pourquoi deux packages séparés ?

**Problème rencontré** : Les modules bundlés (type "bundle" avec entrée module) ne s'affichent pas correctement dans Directus 11 et peuvent casser d'autres extensions.

**Solution** : 
- **Bundle** pour les extensions API (hook, endpoint) → fonctionne parfaitement
- **Module standalone** pour l'interface UI → suit le pattern des modules officiels Directus

Cette architecture est conforme aux extensions de référence comme `directus-extension-schema-management-module`.

---

## Structure finale

```
directus/extensions/
├── directus-extension-realtime-calc-bundle/
│   └── index.js          # Hook + Endpoint
└── directus-extension-realtime-recalc-module/
    └── index.js          # Module UI
```

Les deux extensions communiquent via l'API Directus :
- Le module UI appelle l'endpoint fourni par le bundle
- Le hook surveille les changements en temps réel
- L'endpoint orchestre les recalculs manuels
