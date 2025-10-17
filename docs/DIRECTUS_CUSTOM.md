# 🚀 Créer ton Directus Custom avec l'extension pré-installée

## Stratégie

Au lieu de modifier une instance Directus existante, on crée **notre propre image Docker Directus** avec l'extension déjà installée.

## 📦 Étapes de création

### 1. Créer un nouveau repo GitHub `directus-custom`

Sur GitHub, crée un nouveau repo **public** : `moiralex99/directus-custom`

### 2. Structure du repo

```
directus-custom/
├── Dockerfile
├── README.md
└── extensions/
    └── hooks/
        └── realtime-calc/
            ├── package.json
            ├── dist/
            │   └── index.js
            └── (pas de node_modules, installés au build)
```

### 3. Créer le Dockerfile

```dockerfile
FROM directus/directus:11

# Passer en root pour installer l'extension
USER root

# Copier l'extension dans le conteneur
COPY extensions/hooks/realtime-calc/package.json /directus/extensions/hooks/realtime-calc/
COPY extensions/hooks/realtime-calc/dist /directus/extensions/hooks/realtime-calc/dist

# Installer les dépendances runtime
WORKDIR /directus/extensions/hooks/realtime-calc
RUN corepack enable && pnpm install --prod --no-optional

# Fix permissions
RUN chown -R node:node /directus/extensions

# Retour au workdir Directus
WORKDIR /directus

# Revenir à l'utilisateur node
USER node

ENV EXTENSIONS_AUTO_RELOAD=true
```

### 4. Copier l'extension buildée

Depuis `fq-calculation-hook` :

```powershell
# Assure-toi que l'extension est buildée
cd C:\Users\ALI CHERFAOUI (O2T)\Desktop\Flow\Flow5\fq-calculation-hook
npm run build

# Crée le repo directus-custom
cd C:\Users\ALI CHERFAOUI (O2T)\Desktop\Flow\Flow5
mkdir directus-custom
cd directus-custom

# Initialise Git
git init
git remote add origin https://github.com/moiralex99/directus-custom.git

# Crée la structure
mkdir -p extensions\hooks\realtime-calc\dist

# Copie l'extension
copy ..\fq-calculation-hook\package.json extensions\hooks\realtime-calc\
xcopy ..\fq-calculation-hook\dist extensions\hooks\realtime-calc\dist\ /E /I

# Copie le Dockerfile
copy ..\fq-calculation-hook\Dockerfile.directus-custom Dockerfile

# Crée un README
echo "# Directus Custom - O2T" > README.md
echo "Directus 11 with realtime-calc extension pre-installed" >> README.md

# .gitignore
echo "node_modules/" > .gitignore
echo ".DS_Store" >> .gitignore

# Commit et push
git add .
git commit -m "Initial commit - Directus with realtime-calc extension"
git branch -M main
git push -u origin main
```

### 5. Configurer Coolify

Dans ton docker-compose Coolify, remplace :

```yaml
services:
  directus:
    build:
      context: https://github.com/moiralex99/directus-custom.git
      dockerfile: Dockerfile
    volumes:
      - 'directus-uploads:/directus/uploads'
      - 'directus-templates:/directus/templates'
      # ⚠️ PAS de directus-extensions (l'extension est dans l'image)
    environment:
      # ... tes variables habituelles
```

**OU** utilise l'image directement (si tu push sur Docker Hub) :

```yaml
services:
  directus:
    image: 'moiralex99/directus-custom:latest'
    # ... reste identique
```

### 6. Vérification

Après déploiement, vérifie les logs :

```
[RealTime-Calc Extension] Loaded successfully
[FormulaLoader] Loaded X formula(s) from Y collection(s)
```

## 🔄 Mettre à jour l'extension

Quand tu modifies `fq-calculation-hook` :

```powershell
# 1. Build la nouvelle version
cd C:\Users\ALI CHERFAOUI (O2T)\Desktop\Flow\Flow5\fq-calculation-hook
npm run build

# 2. Copie dans directus-custom
cd ..\directus-custom
Remove-Item extensions\hooks\realtime-calc\dist -Recurse -Force
xcopy ..\fq-calculation-hook\dist extensions\hooks\realtime-calc\dist\ /E /I
copy ..\fq-calculation-hook\package.json extensions\hooks\realtime-calc\

# 3. Commit et push
git add extensions/
git commit -m "Update realtime-calc extension"
git push

# 4. Redeploy dans Coolify
```

## ✅ Avantages

- ✅ Extension **toujours présente** (pas de volume à gérer)
- ✅ Versionnage Git de ton Directus custom
- ✅ Facile à redéployer ou cloner
- ✅ Pas de conflit avec d'autres extensions
- ✅ Fonctionne parfaitement avec Coolify

## 📝 Maintenance

**Pour ajouter d'autres extensions :**

```
directus-custom/
└── extensions/
    ├── hooks/
    │   ├── realtime-calc/
    │   └── autre-hook/
    ├── endpoints/
    │   └── custom-api/
    └── interfaces/
        └── custom-field/
```

Copie-les dans le repo, rebuild, redeploy. Simple et propre ! 🎯
