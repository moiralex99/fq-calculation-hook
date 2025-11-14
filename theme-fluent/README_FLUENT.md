# 🎨 Fluent Design Theme pour Directus

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Directus](https://img.shields.io/badge/Directus-v11%2B-6644ff.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

**Un thème moderne inspiré du Microsoft Fluent Design System pour Directus**

[Installation](#-installation) • [Aperçu](#-aperçu) • [Personnalisation](#-personnalisation) • [Documentation](#-documentation)

</div>

---

## ✨ Caractéristiques

### 🎯 Design Fluent Authentique
- ✅ Palette de couleurs Microsoft Fluent
- ✅ Typographie Segoe UI (avec fallbacks)
- ✅ Ombres et élévations subtiles
- ✅ Coins arrondis cohérents (6-12px)
- ✅ Effet "Acrylic" sur la navigation

### 🎨 Deux Modes Complets
- 🌞 **Light Mode** : Fond chaleureux (#FAF9F8) avec bleu #0078D4
- 🌙 **Dark Mode** : Fond sombre (#1B1A19) avec bleu clair #4CC2FF

### 🚀 Performance
- ⚡ CSS optimisé
- 🎯 Variables CSS modernes
- 🔄 Transitions fluides (cubic-bezier)
- 📦 Build minifié (extension)

### ♿ Accessibilité
- ✅ Contraste WCAG AA compliant
- ✅ Focus indicators visibles
- ✅ Support navigation clavier
- ✅ Texte lisible sur tous backgrounds

---

## 📦 Installation

### Option 1 : CSS Direct (Recommandé pour tester)

1. Ouvrez [`fluent-custom.css`](fluent-custom.css)
2. Copiez tout le contenu
3. Dans Directus : **Settings** → **Project Settings** → **Custom CSS**
4. Collez et sauvegardez
5. Rafraîchissez la page (F5)

✅ **Fait !** Le thème est appliqué immédiatement.

### Option 2 : Extension (Recommandé pour production)

```bash
# 1. Build
cd theme-fluent
npm install
npm run build

# 2. Déployer (choisissez une méthode)

# Windows - Copie
Copy-Item -Recurse -Force . "C:\directus\extensions\directus-extension-theme-fluent"

# Linux/Mac - Lien symbolique
ln -s $(pwd) /path/to/directus/extensions/directus-extension-theme-fluent

# 3. Redémarrer Directus
npm run start

# 4. Activer dans Settings > Appearance
```

📖 [**Guide d'installation détaillé**](INSTALLATION.md)

---

## 🎨 Aperçu

### Palette de Couleurs

#### Light Mode
| Couleur | Hex | Usage |
|---------|-----|-------|
| 🔵 Communication Blue | `#0078D4` | Primary, Links, Active states |
| ⚪ Warm White | `#FAF9F8` | Page background |
| ⬜ Light Gray | `#F3F2F1` | Cards, navigation |
| ⬛ Dark Gray | `#323130` | Text principal |
| 🟢 Success | `#107C10` | Confirmations |
| 🟠 Warning | `#F7630C` | Alertes |
| 🔴 Danger | `#D13438` | Erreurs |

#### Dark Mode
| Couleur | Hex | Usage |
|---------|-----|-------|
| 🔵 Light Blue | `#4CC2FF` | Primary (adjusted) |
| ⬛ Almost Black | `#1B1A19` | Page background |
| ◼️ Dark Surface | `#252423` | Cards, navigation |
| ⬜ Light Text | `#F3F2F1` | Text principal |

### Typography

```css
Sans-Serif : "Segoe UI", -apple-system, BlinkMacSystemFont, "Roboto", sans-serif
Monospace  : "Cascadia Code", "Consolas", "Courier New", monospace

Weights:
- Normal  : 400
- Medium  : 500
- Semibold: 600
```

📸 [**Voir l'aperçu visuel complet**](PREVIEW.md)

---

## 🔧 Personnalisation

### Changer la couleur primaire

**Dans CSS Custom :**
```css
:root {
  --fluent-blue: #FF6B6B; /* Votre couleur */
}
```

**Dans l'extension :**
```typescript
// src/index.ts
export default defineTheme({
  // ...
  rules: {
    primary: '#FF6B6B', // Votre couleur
    // ...
  }
});
```

### Ajuster les border-radius

```css
:root {
  --theme--border-radius: 12px; /* Default: 8px */
}
```

### Modifier les ombres

```css
.header-bar {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15) !important;
}
```

---

## 📚 Documentation

- [📖 README](README.md) - Vue d'ensemble technique
- [🚀 INSTALLATION](INSTALLATION.md) - Guide d'installation étape par étape
- [🎨 PREVIEW](PREVIEW.md) - Aperçu visuel détaillé
- [💻 fluent-custom.css](fluent-custom.css) - CSS standalone prêt à copier

---

## 🏗️ Structure du Projet

```
theme-fluent/
├── src/
│   ├── index.ts          # Thème Light (extension)
│   └── dark.ts           # Thème Dark (extension)
├── dist/                 # Fichiers buildés
├── fluent-custom.css     # CSS standalone (copier-coller)
├── package.json
├── tsconfig.json
├── README.md
├── INSTALLATION.md
└── PREVIEW.md
```

---

## 🎯 Fonctionnalités Fluent Appliquées

### 1. **Light** (Lumière)
- Ombres subtiles multi-couches
- Élévation cohérente des composants
- Profondeur sans surcharge visuelle

### 2. **Depth** (Profondeur)
- Navigation avec effet acrylic
- Cards en couches avec ombres
- Z-index logique et cohérent

### 3. **Motion** (Mouvement)
- Transitions cubic-bezier fluides
- Animations de 150-300ms
- Hover states réactifs

### 4. **Material** (Matériau)
- Backgrounds semi-transparents
- Blur effects (navigation)
- Surfaces distinctes

### 5. **Scale** (Échelle)
- Border-radius proportionnés
- Spacing cohérent (4px grid)
- Typography responsive

---

## 🛠️ Développement

### Mode Watch (auto-rebuild)

```bash
npm run dev
```

### Build manuel

```bash
npm run build
```

### Tester localement

```bash
# 1. Build
npm run build

# 2. Copier dans Directus local
cp -r . /path/to/directus/extensions/directus-extension-theme-fluent

# 3. Restart Directus et tester
```

---

## 🐛 Troubleshooting

### Le thème ne s'applique pas (CSS Custom)
1. Videz le cache navigateur (Ctrl+Shift+Delete)
2. Hard refresh (Ctrl+F5)
3. Vérifiez que le CSS est bien dans "Custom CSS"

### L'extension n'apparaît pas
1. Vérifiez le nom du dossier : `directus-extension-theme-fluent`
2. Vérifiez que `dist/index.js` existe
3. Redémarrez Directus complètement
4. Vérifiez les logs : `Settings > Extensions`

### Segoe UI ne s'affiche pas
- Normal sur Linux/Mac (utilise le fallback système)
- Windows affichera correctement Segoe UI

---

## 📊 Compatibilité

- ✅ Directus **v11.0+**
- ✅ Chrome, Edge, Firefox, Safari (dernières versions)
- ✅ Windows, macOS, Linux
- ✅ Mobile responsive

---

## 🤝 Contribution

Les contributions sont bienvenues ! Pour proposer des améliorations :

1. Fork le projet
2. Créez une branche (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

---

## 📝 License

MIT License - Voir le fichier LICENSE pour plus de détails.

---

## 🙏 Crédits

- Inspiré par [Microsoft Fluent Design System](https://www.microsoft.com/design/fluent/)
- Construit pour [Directus](https://directus.io/)
- Police Segoe UI © Microsoft Corporation

---

## 📞 Support

Besoin d'aide ?
- 📖 Lisez la [documentation](INSTALLATION.md)
- 🐛 Ouvrez une [issue](https://github.com/votre-repo/issues)
- 💬 Rejoignez la [communauté Directus](https://discord.com/invite/directus)

---

<div align="center">

**Fait avec ❤️ pour la communauté Directus**

[⬆ Retour en haut](#)

</div>
