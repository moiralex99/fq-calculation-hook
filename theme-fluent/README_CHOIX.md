# 🎨 Thème Fluent Design pour Directus - Choix de Version

Deux versions du thème disponibles pour s'adapter à vos besoins.

---

## ⭐ Version Simple (Recommandée)

### 📁 Fichiers
- `fluent-simple.css` - CSS minimaliste
- `demo-simple.html` - Aperçu interactif
- `INSTALLATION_SIMPLE.md` - Guide complet

### ✅ Avantages
- **Aucun problème d'alignement** - Respecte 100% la structure Directus
- **Installation en 2 minutes** - Copier-coller dans Custom CSS
- **Léger et rapide** - Seulement les variables CSS modifiées
- **Facile à maintenir** - Compatible avec les mises à jour Directus

### 🎯 Modifications
- ✅ Couleurs Fluent Design (bleu #0078D4, etc.)
- ✅ Polices Segoe UI / Cascadia Code
- ✅ Mode sombre automatique
- ❌ Pas de modification des espacements/alignements

### 🚀 Installation Rapide
```bash
1. Ouvrir fluent-simple.css
2. Copier tout (Ctrl+A, Ctrl+C)
3. Directus → Settings → Project Settings → Custom CSS
4. Coller et Sauvegarder
5. Rafraîchir (Ctrl+Shift+R)
```

---

## 🔧 Version Complète (Avancée)

### 📁 Fichiers
- `fluent-custom.css` - CSS complet avec styles personnalisés
- `demo.html` - Aperçu détaillé
- Extension TypeScript (`src/index.ts`, `src/dark.ts`)

### ✅ Avantages
- **Personnalisation complète** - Boutons, cartes, animations, etc.
- **Extension professionnelle** - Peut être déployée comme extension Directus
- **Plus de contrôle** - Styles Fluent complets

### ⚠️ Inconvénients
- Peut nécessiter des ajustements pour les alignements
- Plus complexe à maintenir
- Risque de conflits avec les mises à jour Directus

### 🚀 Installation
Voir `INSTALLATION.md` pour les détails complets.

---

## 📊 Comparaison

| Critère | Version Simple ⭐ | Version Complète 🔧 |
|---------|-------------------|---------------------|
| **Facilité** | Très facile | Avancée |
| **Alignements** | ✅ Parfaits | ⚠️ Peut nécessiter ajustements |
| **Installation** | 2 minutes | 10-15 minutes |
| **Maintenance** | Facile | Plus complexe |
| **Personnalisation** | Couleurs + Polices | Complète |
| **Recommandé pour** | Tous les utilisateurs | Utilisateurs avancés |

---

## 🎨 Palette Fluent Design (Commune aux 2 versions)

### Mode Clair
- **Primaire** : #0078D4 (Communication Blue)
- **Succès** : #107C10 (Green)
- **Avertissement** : #FFB900 (Yellow)
- **Danger** : #D13438 (Red)
- **Arrière-plan** : #FAF9F8 (Warm White)
- **Texte** : #323130 (Neutral Gray)

### Mode Sombre
- **Primaire** : #4CC2FF (Light Blue)
- **Arrière-plan** : #1B1A19 (Almost Black)
- **Texte** : #F3F2F1 (Light Gray)

---

## 🔤 Typographie (Commune aux 2 versions)

- **Display** : Segoe UI Semi-Bold 600
- **Sans-Serif** : Segoe UI Regular 400
- **Monospace** : Cascadia Code / Fira Code 400

Fallback automatique vers Inter et Fira Code sur Linux/macOS.

---

## 📖 Documentation

- **Version Simple** : Lisez `INSTALLATION_SIMPLE.md`
- **Version Complète** : Lisez `INSTALLATION.md`
- **Aperçus** :
  - Simple : Ouvrez `demo-simple.html` dans un navigateur
  - Complète : Ouvrez `demo.html` dans un navigateur

---

## 💡 Quelle version choisir ?

### Choisissez la **Version Simple** si :
- ✅ Vous voulez juste changer les couleurs et polices
- ✅ Vous ne voulez **aucun problème d'alignement**
- ✅ Vous préférez une solution rapide et fiable
- ✅ Vous êtes débutant avec Directus

### Choisissez la **Version Complète** si :
- ✅ Vous voulez personnaliser **tous** les aspects visuels
- ✅ Vous êtes à l'aise avec le CSS avancé
- ✅ Vous pouvez ajuster les alignements si nécessaire
- ✅ Vous voulez déployer comme extension TypeScript

---

## 🚀 Démarrage Rapide (Recommandé)

```bash
# 1. Ouvrir demo-simple.html pour voir l'aperçu
open demo-simple.html  # macOS
start demo-simple.html # Windows
xdg-open demo-simple.html # Linux

# 2. Si vous aimez, copier fluent-simple.css dans Directus
# (Voir INSTALLATION_SIMPLE.md pour les étapes détaillées)
```

---

## 🛠️ Structure du Projet

```
theme-fluent/
├── fluent-simple.css          ⭐ CSS Simple (RECOMMANDÉ)
├── demo-simple.html           ⭐ Aperçu Simple
├── INSTALLATION_SIMPLE.md     ⭐ Guide Simple
│
├── fluent-custom.css          🔧 CSS Complet
├── demo.html                  🔧 Aperçu Complet
├── INSTALLATION.md            🔧 Guide Complet
│
├── src/
│   ├── index.ts               🔧 Extension TypeScript (Light)
│   └── dark.ts                🔧 Extension TypeScript (Dark)
│
├── package.json               🔧 npm config
├── tsconfig.json              🔧 TypeScript config
└── README.md                  📖 Ce fichier
```

---

## 🤝 Contribution

Les contributions sont bienvenues ! N'hésitez pas à :
- Signaler des bugs
- Proposer des améliorations
- Partager vos retours d'expérience

---

## 📄 Licence

MIT - Libre d'utilisation et de modification

---

## ✨ Crédits

- **Fluent Design System** : Microsoft
- **Directus** : https://directus.io
- **Polices** : Segoe UI (Microsoft), Inter (Google Fonts), Cascadia Code (Microsoft)

---

**Profitez de votre nouveau thème Fluent Design ! 🎨**
