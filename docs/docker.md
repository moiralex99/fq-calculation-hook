## Déploiement Docker / Coolify

Ce document explique comment installer l'extension « realtime-calc » dans un Directus géré par Coolify.

**Méthode recommandée** : build une image Directus custom qui contient déjà l'extension (pas de volume ni de service builder à gérer).

---

## 🚀 Installation Coolify (RECOMMANDÉ)

### Étape 1 : Push le Dockerfile sur GitHub

Le Dockerfile est déjà dans ce repo (`Dockerfile` à la racine). Il clone l'extension, la build, et l'installe dans `/directus/extensions/hooks/realtime-calc`.

### Étape 2 : Configurer Coolify pour builder l'image

Dans Coolify, pour ton service Directus :

1. **Type de déploiement** : choisir "Docker Compose" ou "Dockerfile"
2. **Si Docker Compose** : édite ton compose et remplace la section `directus` :

**AVANT** :
```yaml
services:
  directus:
    image: directus/directus:11
    volumes:
      - directus-uploads:/directus/uploads
      - directus-extensions:/directus/extensions  # ❌ RETIRE CETTE LIGNE
      - directus-templates:/directus/templates
```

**APRÈS** :
```yaml
services:
  directus:
    build:
      context: .
      dockerfile: Dockerfile
    volumes:
      - directus-uploads:/directus/uploads
      # ⚠️ NE PAS monter directus-extensions
      - directus-templates:/directus/templates
    environment:
      # ... tes variables existantes (DB_*, REDIS_*, KEY, SECRET, etc.)
      - EXTENSIONS_AUTO_RELOAD=true
    depends_on:
      postgresql:
        condition: service_healthy
      redis:
        condition: service_healthy
```

3. **Save** et **Redeploy**

Coolify va :
- Cloner ton repo GitHub
- Builder l'image avec le Dockerfile (ça prend 2-3 minutes la première fois)
- Démarrer Directus avec l'extension déjà installée

### Étape 3 : Vérifier dans les logs

Ouvre les logs du service `directus` dans Coolify et cherche :

```
[RealTime-Calc Extension] Loaded successfully
[FormulaLoader] Loaded X formula(s) from Y collection(s)
[RealTime-Calc] Monitoring X collection(s) with Y formula(s)
```

✅ Si tu vois ces lignes → **C'EST BON, l'extension est chargée !**

⚠️ Note : la ligne `Loaded extensions: ...` ne liste QUE les extensions App (UI), pas les hooks. Cherche bien les logs `[RealTime-Calc ...]`.

### Étape 4 : Tester

Via un Flow Directus → Operation "Run Script" :

```js
// Recharger les formules
const result = await emitter.emitAction('realtime-calc.reload-formulas', {});
logger.info(result);
return result;
```

```js
// Tester une formule
const result = await emitter.emitAction('realtime-calc.test-formula', {
  formula: '{{prix}} * {{quantite}}',
  sampleData: { prix: 10, quantite: 5 }
});
logger.info(result);
return result;
```

```js
// Recalculer une collection
const result = await emitter.emitAction('realtime-calc.recalculate-collection', {
  collection: 'factures',  // adapte le nom
  // filter: { quantite: { _gt: 0 } },  // optionnel
  // dryRun: true  // optionnel: teste sans écrire
});
logger.info(result);
return result;
```

---

## ⚙️ Méthode alternative : Service builder (SI L'IMAGE NE MARCHE PAS)ent Docker / Coolify

Ce document explique comment installer l’extension « realtime-calc » dans un Directus géré par Coolify, en suivant les recommandations officielles « Including Extensions ».

Deux méthodes sont proposées:
- Méthode A (recommandée Coolify): un service « builder » qui clone, build, installe les dépendances, puis copie l’extension dans le volume `directus-extensions` avant le démarrage de Directus.
- Méthode B (propre prod): une image Directus custom qui embarque directement l’extension et ses dépendances (pas de service builder, pas de volume extensions).

---

### Méthode A — Service builder (Coolify)

Ajoutez ce service à votre `docker-compose` géré par Coolify. Il est « bullet‑proof »: il build d’abord en temporaire, puis installe les dépendances RUNTIME dans le volume extensions, et vérifie la présence de `mathjs`.

Placez ce bloc dans votre fichier Compose (menu « Edit Compose File ») et conservez vos services `directus`, `postgresql`, `redis` existants.

```yaml
services:
  extensions-builder:
    image: node:20-alpine
    command:
      - sh
      - -lc
      - |
        set -euo pipefail
        apk add --no-cache git
        echo '--- clone'
        rm -rf /tmp/fq
        git clone --depth=1 https://github.com/moiralex99/fq-calculation-hook.git /tmp/fq
        cd /tmp/fq

        echo '--- install (build deps)'
        if [ -f package-lock.json ]; then
          npm ci --no-audit --no-fund
        else
          npm install --no-audit --no-fund
        fi

        echo '--- build'
        npm run build

        echo '--- prepare dest'
        rm -rf /exts/hooks/realtime-calc
        install -d /exts/hooks/realtime-calc

        echo '--- copy package.json and install runtime deps into volume'
        cp /tmp/fq/package.json /exts/hooks/realtime-calc/
        cd /exts/hooks/realtime-calc
        npm install --omit=dev --no-audit --no-fund

        echo '--- copy dist'
        rm -rf dist
        cp -r /tmp/fq/dist ./dist

        echo '--- verify'
        ls -la /exts/hooks/realtime-calc
        node -e "console.log('mathjs:', !!require.resolve('mathjs'))"
        echo '✅ Extension installed at /exts/hooks/realtime-calc'
    volumes:
      - directus-extensions:/exts
    restart: "no"
```

Ensuite, dans le service `directus`, assurez-vous que:
- le volume `directus-extensions` est monté sur `/directus/extensions`
- `depends_on` attend la fin du builder

Extrait (à adapter à votre service existant):

```yaml
services:
  directus:
    image: directus/directus:11
    volumes:
      - directus-uploads:/directus/uploads
      - directus-extensions:/directus/extensions
      - directus-templates:/directus/templates
    environment:
      - EXTENSIONS_AUTO_RELOAD=true
      # … (autres variables existantes: DB_*, REDIS_*, KEY, SECRET, etc.)
    depends_on:
      extensions-builder:
        condition: service_completed_successfully
      postgresql:
        condition: service_healthy
      redis:
        condition: service_healthy
```

Volumes déclarés (à conserver):

```yaml
volumes:
  directus-uploads:
  directus-extensions:
  directus-templates:
  directus-postgresql-data:
  directus-redis-data:
```

#### Vérifications après déploiement
- Logs du service `extensions-builder`:
  - Doit afficher: `--- verify` puis la liste du dossier et `mathjs: true`, et enfin `✅ Extension installed …`
- Logs de `directus`:
  - Important: la ligne « Loaded extensions: … » liste surtout les extensions App. Pour ce hook, cherchez:
    - `[RealTime-Calc Extension] Loaded successfully`
    - `[RealTime-Calc] Monitoring X collection(s) with Y formula(s)`

#### Tests rapides (côté Directus)
- Modifier une ligne « published » dans `quartz_formulas` → l’auto‑reload (debounce) s’affiche en logs
- Actions internes (via Flow « Run Script ») disponibles:
  - `realtime-calc.reload-formulas`
  - `realtime-calc.recalculate-collection`
  - `realtime-calc.test-formula`

#### Dépannage
- Si l’extension n’apparaît pas:
  - Vérifier dans le conteneur: `/directus/extensions/hooks/realtime-calc` contient `package.json`, `dist/`, `node_modules/`
  - Vérifier que `EXTENSIONS_AUTO_RELOAD=true` est bien présent
  - Redéployer pour relancer Directus après le builder

Astuce: si Coolify/Compose affiche des avertissements du type `The "VAR" variable is not set` ou `invalid command line string`, utilisez la forme tableau de `command` (comme ci‑dessus) et évitez les variables shell (`$VAR`) dans le YAML. Préférez des chemins littéraux (ex: `/exts/hooks/realtime-calc`).

---

### Méthode B — Image Directus custom (alternative prod)

Cette approche fige l’extension et ses dépendances dans l’image. Elle évite le service builder et le volume `directus-extensions`.

Dockerfile minimal (placer à la racine du repo Compose):

```dockerfile
FROM node:20-alpine AS builder
RUN apk add --no-cache git
WORKDIR /app
RUN git clone --depth=1 https://github.com/moiralex99/fq-calculation-hook.git ext
WORKDIR /app/ext
RUN npm install --no-audit --no-fund && npm run build

FROM directus/directus:11
COPY --from=builder /app/ext/package.json /directus/extensions/hooks/realtime-calc/package.json
COPY --from=builder /app/ext/dist /directus/extensions/hooks/realtime-calc/dist
WORKDIR /directus/extensions/hooks/realtime-calc
RUN npm install --omit=dev --no-audit --no-fund
WORKDIR /directus
ENV EXTENSIONS_AUTO_RELOAD=true
```

Compose (extrait):

```yaml
services:
  directus:
    build:
      context: .
      dockerfile: Dockerfile.directus
    volumes:
      - directus-uploads:/directus/uploads
      - directus-templates:/directus/templates
    # ⚠️ Ne pas monter directus-extensions ici, sinon cela masque les fichiers intégrés
```

---

## 🔧 Dépannage

### L'extension ne se charge pas

1. **Vérifie que l'image a bien été buildée** :
   - Dans Coolify, regarde les logs du build → doit montrer "Building Directus extension" et "Done"
   
2. **Vérifie dans le conteneur** :
   ```bash
   docker exec -it <nom-conteneur-directus> ls -la /directus/extensions/hooks/realtime-calc
   ```
   Tu dois voir : `package.json`, `dist/`, `node_modules/`

3. **Cherche les erreurs dans les logs Directus** au démarrage :
   - Si tu vois une erreur avec `mathjs` ou `Cannot find module` → les deps runtime ne sont pas installées
   - Si tu ne vois AUCUN log `[RealTime-Calc ...]` → l'extension n'est pas dans le bon dossier

4. **Rebuild complet** :
   - Dans Coolify : Stop → supprime l'image (Advanced → Delete) → Redeploy
   - Ça force un rebuild from scratch

### Les formules ne se calculent pas

1. **Vérifie que la table `quartz_formulas` existe** et contient des formules avec `status = 'published'`

2. **Teste manuellement** via Flow "Run Script" :
   ```js
   const result = await emitter.emitAction('realtime-calc.reload-formulas', {});
   logger.info(result);
   ```

3. **Regarde les logs Directus** quand tu modifies un item → doit afficher :
   ```
   [RealTime-Calc] calc collection.field: old_value → new_value
   ```

---

## 📝 Notes importantes

- **La ligne `Loaded extensions: ...`** dans les logs Directus liste UNIQUEMENT les extensions App (interface). Les hooks ne s'y affichent PAS. Cherche `[RealTime-Calc Extension] Loaded successfully`.

- **Auto-reload** : si tu modifies une ligne dans `quartz_formulas`, l'extension détecte le changement et recharge automatiquement (debounce 5 secondes).

- **Repos privés** : si ton repo GitHub est privé, ajoute un Personal Access Token dans l'URL du Dockerfile (ligne `git clone`) ou configure les secrets Coolify.

---

## 🎯 Résumé rapide

```yaml
# docker-compose.yml (extrait Coolify)
services:
  directus:
    build:
      context: .
      dockerfile: Dockerfile
    volumes:
      - directus-uploads:/directus/uploads
      - directus-templates:/directus/templates
      # ⚠️ PAS de directus-extensions ici
    environment:
      - EXTENSIONS_AUTO_RELOAD=true
      # ... tes autres variables
```

**C'est tout.** Redeploy et vérifie les logs pour `[RealTime-Calc Extension] Loaded successfully`.
