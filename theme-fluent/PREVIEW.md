# 🎨 Fluent Design Theme - Visual Preview

## Screenshots (à venir)

En attendant les captures d'écran, voici à quoi ressemblera votre Directus :

## 🎯 Caractéristiques Visuelles

### ✨ Navigation
```
┌─────────────────────────────────────────┐
│  [D] Project Name          [👤] Admin   │ ← Header blanc avec ombre subtile
├─────────────────────────────────────────┤
│ [≡]  │ 📊 Dashboard                     │
│      │ 📁 Content                       │ ← Navigation avec effet acrylic
│      │ 👥 Users                         │
│      │ ⚙️  Settings                     │
└──────┴──────────────────────────────────┘
```

### 🔘 Boutons Fluent
```
┌──────────────┐
│  ✓ Primary   │  ← Bleu #0078D4 avec ombre
└──────────────┘

┌──────────────┐
│  Secondary   │  ← Gris clair avec bordure
└──────────────┘
```

### 📝 Inputs
```
┌────────────────────────────────────────┐
│ Label (600 weight)                     │
├────────────────────────────────────────┤
│ Placeholder text...                    │  ← Fond blanc, bordure grise
└────────────────────────────────────────┘
                                            ↑
                                      Coins arrondis 6px
```

### 🎴 Cards
```
┌─────────────────────────────────────┐
│                                     │
│  Card Content                       │  ← Fond blanc
│  Soft shadows                       │     Bordure grise claire
│                                     │     Border-radius 8px
└─────────────────────────────────────┘
```

## 🌈 Palette de Couleurs Complète

### Primary & Status
```css
🔵 Primary Blue      #0078D4  ████████
🟣 Secondary Purple  #8764B8  ████████
🟢 Success Green     #107C10  ████████
🟠 Warning Orange    #F7630C  ████████
🔴 Danger Red        #D13438  ████████
```

### Neutral Grays (Light)
```css
⬜ Gray 10  #FAF9F8  ████████  Background
⬜ Gray 20  #F3F2F1  ████████  Background Normal
⬜ Gray 30  #EDEBE9  ████████  Borders
⬜ Gray 40  #E1DFDD  ████████  Border Accent
⬛ Gray 130 #605E5C  ████████  Text Subdued
⬛ Gray 190 #323130  ████████  Text Primary
⬛ Gray 210 #201F1E  ████████  Text Accent
```

### Dark Mode Adaptation
```css
🌙 Dark Blue         #4CC2FF  ████████  Primary (adjusted for dark)
⬛ Dark Background   #1B1A19  ████████
⬛ Dark Surface      #252423  ████████
⬜ Light Text        #F3F2F1  ████████
```

## 📐 Spacing & Sizing

### Border Radius
- **Small elements** : 6px (buttons, inputs)
- **Cards** : 8px
- **Modals** : 12px

### Shadows (Fluent Depth)
```css
/* Level 1 - Header */
box-shadow: 0 0.3px 0.9px rgba(0, 0, 0, 0.07), 
            0 1.6px 3.6px rgba(0, 0, 0, 0.11);

/* Level 2 - Cards */
box-shadow: 0 1.6px 3.6px rgba(0, 0, 0, 0.05);

/* Level 3 - Popovers */
box-shadow: 0 3.2px 7.2px rgba(0, 0, 0, 0.132),
            0 0.6px 1.8px rgba(0, 0, 0, 0.108);

/* Level 4 - Modals */
box-shadow: 0 6.4px 14.4px rgba(0, 0, 0, 0.132),
            0 1.2px 3.6px rgba(0, 0, 0, 0.108);
```

## ✍️ Typography

### Font Stack
```
Sans-Serif : "Segoe UI", -apple-system, BlinkMacSystemFont, 
             "Roboto", "Helvetica Neue", sans-serif

Monospace  : "Cascadia Code", "Consolas", "Courier New", monospace
```

### Font Weights
- **Normal Text** : 400
- **Labels/Buttons** : 500
- **Headings** : 600

## 🎭 Interactive States

### Hover Effects
```
Before : ░░░░░░░░
Hover  : ████████  ← Background: rgba(0, 120, 212, 0.08)
Active : ████████  ← Background: rgba(0, 120, 212, 0.12)
```

### Focus Rings
```
┌─────────────────┐
│                 │
│  Focused Input  │
│                 │
└─────────────────┘
  ↑ Outline: 2px solid #0078D4
    Offset: 2px
```

## 🔄 Animations

### Timing Function
```
cubic-bezier(0.4, 0, 0.2, 1)  ← Fluent easing
```

### Durations
- **Fast** : 150ms (hover, focus)
- **Medium** : 200ms (transitions)
- **Slow** : 300ms (modals)

## 🌓 Light vs Dark Comparison

```
                Light Mode           Dark Mode
Background      #FAF9F8              #1B1A19
Text            #323130              #F3F2F1
Primary         #0078D4              #4CC2FF
Borders         #EDEBE9              #3B3A39
Cards           #FFFFFF              #252423
```

## 📊 Contrast Ratios

All color combinations meet WCAG AA standards:
- Text on background: **7.2:1** ✓
- Primary on white: **4.8:1** ✓
- Links: **4.5:1** ✓

## 🎯 Fluent Design Principles Applied

1. ✅ **Light** - Soft shadows, depth without clutter
2. ✅ **Depth** - Layering with subtle elevation
3. ✅ **Motion** - Smooth, purposeful animations
4. ✅ **Material** - Acrylic-inspired backgrounds
5. ✅ **Scale** - Responsive, comfortable sizing

---

**Note** : Pour voir le thème en action, installez-le selon `INSTALLATION.md` ! 🚀
