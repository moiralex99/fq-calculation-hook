# 🚀 Installation Rapide - Thème Fluent pour Directus

## 📋 Vous avez 2 options :

---

## ✨ **OPTION 1 : CSS DIRECT (Plus simple, aucun build requis)**

### Étapes :

1. **Ouvrir le fichier** `fluent-custom.css`
2. **Copier tout le contenu** (Ctrl+A, Ctrl+C)
3. **Aller dans Directus** :
   - Connectez-vous à votre instance Directus
   - Allez dans **Settings** (⚙️)
   - Cliquez sur **Project Settings**
4. **Coller le CSS** :
   - Scrollez jusqu'à **"Custom CSS"**
   - Collez tout le CSS copié
   - Cliquez sur **Save** (💾)
5. **Rafraîchir la page** (F5)

✅ **Terminé !** Le thème Fluent est appliqué immédiatement.

---

## 🔧 **OPTION 2 : EXTENSION COMPLÈTE (Plus flexible)**

### Prérequis :
- Node.js installé
- npm ou yarn

### Étapes :

#### 1. Build l'extension

```bash
# Depuis le dossier theme-fluent
cd theme-fluent
npm install
npm run build
```

#### 2. Déployer dans Directus

**Windows PowerShell :**
```powershell
# Copie directe
Copy-Item -Recurse -Force theme-fluent "C:\chemin\vers\directus\extensions\directus-extension-theme-fluent"

# OU lien symbolique (pour dev)
New-Item -ItemType SymbolicLink -Path "C:\chemin\vers\directus\extensions\directus-extension-theme-fluent" -Target "C:\Users\ALI CHERFAOUI (O2T)\Desktop\Flow\Flow5\fq-calculation-hook\theme-fluent"
```

**Linux/Mac :**
```bash
# Copie directe
cp -r theme-fluent /chemin/vers/directus/extensions/directus-extension-theme-fluent

# OU lien symbolique (pour dev)
ln -s /chemin/absolu/theme-fluent /chemin/vers/directus/extensions/directus-extension-theme-fluent
```

#### 3. Redémarrer Directus

```bash
# Depuis le dossier Directus
npm run start
# ou
pm2 restart directus
```

#### 4. Activer le thème

1. Connectez-vous à Directus
2. **Settings** → **Project Settings**
3. Section **"Appearance"**
4. **Default Theme (Light)** : Sélectionnez **"Fluent Design"**
5. **Default Theme (Dark)** : Sélectionnez **"Fluent Design Dark"**
6. Cliquez sur **Save**

---

## 🎨 Aperçu des couleurs

### Light Mode
- **Primary** : `#0078D4` (Fluent Blue)
- **Background** : `#FAF9F8` (Warm White)
- **Text** : `#323130` (Dark Gray)

### Dark Mode
- **Primary** : `#4CC2FF` (Light Blue)
- **Background** : `#1B1A19` (Almost Black)
- **Text** : `#F3F2F1` (Light Gray)

---

## 🔍 Vérification

Pour vérifier que le thème est bien chargé :

1. **Pour CSS Custom** :
   - Ouvrez DevTools (F12)
   - Onglet Elements
   - Recherchez `--fluent-blue` dans les styles
   - Devrait être `#0078D4`

2. **Pour Extension** :
   - Allez dans **Settings** → **Extensions**
   - Cherchez **"directus-extension-theme-fluent"**
   - Status devrait être **✓ Enabled**

---

## 💡 Conseils

- **CSS Custom** : Plus rapide, parfait pour tester
- **Extension** : Permet de basculer entre thèmes facilement
- **Combinaison** : Utilisez l'extension + CSS custom pour tweaks supplémentaires

---

## 🐛 Problèmes courants

### Le thème ne s'applique pas
- Videz le cache du navigateur (Ctrl+Shift+Del)
- Rafraîchissez la page (Ctrl+F5)
- Vérifiez que le CSS est bien collé dans Custom CSS

### L'extension n'apparaît pas
- Vérifiez que le dossier est bien dans `extensions/`
- Le nom doit être `directus-extension-theme-fluent`
- Redémarrez Directus complètement

### Polices Segoe UI ne s'affichent pas
- Normal sur Linux/Mac (fallback vers système)
- Windows affichera Segoe UI correctement

---

## 📝 Personnalisation

Pour modifier les couleurs, éditez :
- **CSS** : Changez les valeurs dans `:root { ... }`
- **Extension** : Modifiez `src/index.ts`, puis `npm run build`

Exemple - Changer le bleu :
```css
:root {
  --fluent-blue: #FF6B6B; /* Rouge au lieu de bleu */
}
```

---

Besoin d'aide ? Ouvrez une issue sur GitHub ! 🚀
