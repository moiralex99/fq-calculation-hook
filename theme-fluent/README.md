# Thème Fluent Design pour Directus

Thème personnalisé inspiré du **Microsoft Fluent Design System** pour Directus v11+.

## 🎨 Caractéristiques

### Thème Light (`fluent`)
- **Couleur principale** : #0078D4 (Communication Blue)
- **Palette** : Neutral Grays avec tons chauds
- **Typographie** : Segoe UI (police système Fluent)
- **Bordures** : Coins arrondis à 8px
- **Ombres** : Élévations subtiles inspirées de Fluent
- **Accentuation** : Effet "acrylic" sur les fonds de navigation

### Thème Dark (`fluent-dark`)
- **Couleur principale** : #4CC2FF (Communication Blue Light)
- **Palette** : Neutral Grays sombres
- **Contraste** : Optimisé pour la lecture en mode sombre
- **Cohérence** : Même design language que le mode light

## 📦 Installation

### 1. Build l'extension

```bash
cd theme-fluent
npm install
npm run build
```

### 2. Déployer dans Directus

**Option A - Copie directe :**
```bash
# Copier dans le dossier extensions de Directus
cp -r theme-fluent /chemin/vers/directus/extensions/
```

**Option B - Lien symbolique (dev) :**
```bash
# Windows PowerShell
New-Item -ItemType SymbolicLink -Path "C:\chemin\vers\directus\extensions\directus-extension-theme-fluent" -Target "C:\Users\ALI CHERFAOUI (O2T)\Desktop\Flow\Flow5\fq-calculation-hook\theme-fluent"

# Linux/Mac
ln -s /chemin/absolu/theme-fluent /chemin/vers/directus/extensions/directus-extension-theme-fluent
```

### 3. Redémarrer Directus

```bash
# Redémarrer le serveur Directus
npm run start
```

### 4. Activer le thème

1. Connectez-vous à Directus
2. Allez dans **Settings** → **Project Settings**
3. Section **Appearance**
4. Sélectionnez **"Fluent Design"** ou **"Fluent Design Dark"**

## 🎯 Usage avec Custom CSS (Alternative)

Si vous voulez appliquer des styles Fluent sans extension, ajoutez ce CSS dans **Settings** → **Project Settings** → **Custom CSS** :

```css
/* Fluent Design Variables Override */
:root {
  --theme--primary: #0078D4;
  --theme--border-radius: 8px;
  --theme--fonts--sans--font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, "Roboto", "Helvetica Neue", sans-serif;
  
  /* Neutral Grays */
  --theme--foreground: #323130;
  --theme--background: #FAF9F8;
  --theme--background-normal: #F3F2F1;
  
  /* Soft shadows (Fluent depth) */
  --theme--header--box-shadow: 0 0.3px 0.9px rgba(0, 0, 0, 0.07), 0 1.6px 3.6px rgba(0, 0, 0, 0.11);
}

/* Acrylic-like navigation */
.navigation .modules {
  backdrop-filter: blur(10px);
  background: rgba(243, 242, 241, 0.95) !important;
}

/* Smooth transitions */
* {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Focus states (Fluent style) */
*:focus-visible {
  outline: 2px solid #0078D4;
  outline-offset: 2px;
}
```

## 🎨 Palette de couleurs

### Light Mode
| Nom | Hex | Usage |
|-----|-----|-------|
| Communication Blue | `#0078D4` | Primary |
| Neutral Gray 10 | `#FAF9F8` | Background |
| Neutral Gray 190 | `#323130` | Foreground |
| Success Green | `#107C10` | Success states |
| Warning Orange | `#F7630C` | Warnings |
| Danger Red | `#D13438` | Errors |

### Dark Mode
| Nom | Hex | Usage |
|-----|-----|-------|
| Communication Blue Light | `#4CC2FF` | Primary |
| Neutral Gray 190 | `#1B1A19` | Background |
| Neutral Gray 20 | `#F3F2F1` | Foreground |

## 🔧 Personnalisation

Modifiez les fichiers dans `src/` :
- **`index.ts`** - Thème light
- **`dark.ts`** - Thème dark

Puis rebuild :
```bash
npm run build
```

## 📝 Notes

- Compatible Directus v11+
- Police **Segoe UI** utilisée (native sur Windows, fallback sur autres OS)
- Police monospace **Cascadia Code** pour le code (fallback Consolas)
- Suit les guidelines Fluent Design 2.0

## 🚀 Développement

Mode watch pour auto-rebuild :
```bash
npm run dev
```

## 📄 License

MIT
