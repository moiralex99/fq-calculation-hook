# 🎨 Thème Fluent Design Simple pour Directus

## ✨ Version Simplifiée - Recommandée

Cette version **modifie uniquement les couleurs et les polices** de Directus, sans toucher aux alignements, espacements ou structure. Tous les éléments restent parfaitement alignés comme dans Directus natif.

---

## 📦 Ce qui est modifié

### ✅ **Couleurs Fluent Design**
- **Primaire** : #0078D4 (Communication Blue)
- **Succès** : #107C10 (Green)
- **Avertissement** : #FFB900 (Yellow/Orange)
- **Danger** : #D13438 (Red)
- **Arrière-plans** : Fluent Warm Whites (#FAF9F8, #F3F2F1)
- **Textes** : Neutral Grays (#323130, #201F1E, #605E5C)

### ✅ **Typographie Fluent**
- **Police principale** : Segoe UI (fallback: Inter)
- **Titres** : Segoe UI Semi-Bold (600)
- **Monospace** : Cascadia Code (fallback: Fira Code, Consolas)

### ❌ **Ce qui N'EST PAS modifié**
- ❌ Alignements
- ❌ Espacements (margins, paddings)
- ❌ Structure des composants
- ❌ Layout des pages
- ❌ Tailles des éléments

---

## 🚀 Installation (2 minutes)

### **Étape 1 : Ouvrir le fichier CSS**
Ouvrez `fluent-simple.css` dans votre éditeur de code.

### **Étape 2 : Copier le contenu**
- Windows/Linux : `Ctrl+A` puis `Ctrl+C`
- macOS : `Cmd+A` puis `Cmd+C`

### **Étape 3 : Appliquer dans Directus**
1. Connectez-vous à Directus
2. Allez dans **Settings** (⚙️)
3. Cliquez sur **Project Settings**
4. Scrollez jusqu'à **Custom CSS**
5. Collez le CSS copié (`Ctrl+V` ou `Cmd+V`)
6. Cliquez sur **Save** (💾)

### **Étape 4 : Rafraîchir**
- Windows/Linux : `Ctrl+Shift+R` (hard reload)
- macOS : `Cmd+Shift+R`

✅ **C'est fait !** Votre interface Directus utilise maintenant les couleurs et polices Fluent Design.

---

## 🌓 Mode Sombre

Le thème inclut automatiquement un mode sombre avec :
- **Primaire** : #4CC2FF (Light Blue)
- **Arrière-plans** : #1B1A19, #252423 (Fluent Dark)
- **Textes** : #F3F2F1, #FFFFFF (Light Grays)

Le mode sombre s'active automatiquement quand vous basculez Directus en mode sombre.

---

## 🎨 Aperçu Avant Installation

Ouvrez `demo-simple.html` dans votre navigateur pour voir un aperçu :
- Palette de couleurs Fluent
- Typographie Segoe UI
- Boutons et formulaires stylisés
- Toggle mode sombre

---

## 🔧 Personnalisation

### Changer la couleur primaire

Modifiez cette ligne dans `fluent-simple.css` :

```css
--theme--primary: #0078D4; /* Remplacez par votre couleur */
```

**Exemples de couleurs Fluent :**
- Purple : `#8764B8`
- Teal : `#00B7C3`
- Orange : `#FF8C00`
- Magenta : `#E3008C`

### Changer les polices

Remplacez les polices dans les variables :

```css
--theme--fonts--sans--font-family: "Roboto", sans-serif;
--theme--fonts--display--font-family: "Montserrat", sans-serif;
--theme--fonts--monospace--font-family: "JetBrains Mono", monospace;
```

N'oubliez pas d'importer les polices Google Fonts si nécessaire :

```css
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;600&display=swap');
```

---

## 🆚 Différence avec `fluent-custom.css`

| Fichier | Description | Utilisation |
|---------|-------------|-------------|
| **fluent-simple.css** ✅ | Modifie **seulement** couleurs + polices | **Recommandé** - Aucun souci d'alignement |
| `fluent-custom.css` | Modifie couleurs + polices + styles complets | Pour utilisateurs avancés |

---

## 🐛 Dépannage

### Les couleurs ne changent pas
1. Vérifiez que vous avez bien **sauvegardé** dans Project Settings
2. Faites un **hard reload** : `Ctrl+Shift+R` (Windows/Linux) ou `Cmd+Shift+R` (macOS)
3. Videz le cache du navigateur

### Les polices ne s'affichent pas
- Sur Windows : Segoe UI est natif ✅
- Sur macOS/Linux : Le thème utilise automatiquement Inter (Google Fonts)
- Vérifiez votre connexion internet pour charger Google Fonts

### Le mode sombre ne fonctionne pas
1. Dans Directus : Settings → User Preferences
2. Changez **Appearance** à "Dark"
3. Les couleurs sombres Fluent s'appliquent automatiquement

---

## 📝 Support et Contributions

### Fichiers du thème
- `fluent-simple.css` - CSS simple (recommandé)
- `demo-simple.html` - Aperçu interactif
- `INSTALLATION_SIMPLE.md` - Ce guide

### Besoin d'aide ?
- Ouvrez un issue sur GitHub
- Consultez la documentation Directus : https://docs.directus.io

---

## 📄 Licence

MIT - Libre d'utilisation et de modification

---

**Bon thème ! 🎨✨**
