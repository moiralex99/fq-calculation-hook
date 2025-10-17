# Installation Directus + Extension Realtime-Calc (Coolify)

## 🚀 Docker Compose complet (à coller dans Coolify)

Remplace TOUT le contenu de ton docker-compose par ceci :

```yaml
services:
  directus:
    image: 'directus/directus:11'
    volumes:
      - 'directus-uploads:/directus/uploads'
      - 'directus-extensions:/directus/extensions'
      - 'directus-templates:/directus/templates'
    environment:
      - SERVICE_FQDN_DIRECTUS_8055
      - KEY=${SERVICE_BASE64_64_KEY}
      - SECRET=${SERVICE_BASE64_64_SECRET}
      - ADMIN_EMAIL=${ADMIN_EMAIL:-admin@example.com}
      - ADMIN_PASSWORD=${SERVICE_PASSWORD_ADMIN}
      - DB_CLIENT=postgres
      - DB_HOST=postgresql
      - DB_PORT=5432
      - DB_DATABASE=${POSTGRESQL_DATABASE:-directus}
      - DB_USER=${SERVICE_USER_POSTGRESQL}
      - DB_PASSWORD=${SERVICE_PASSWORD_POSTGRESQL}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - WEBSOCKETS_ENABLED=true
      - EXTENSIONS_AUTO_RELOAD=true
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://127.0.0.1:8055/admin/login"]
      interval: 5s
      timeout: 20s
      retries: 10
    depends_on:
      postgresql:
        condition: service_healthy
      redis:
        condition: service_healthy

  postgresql:
    image: 'postgis/postgis:16-3.4-alpine'
    platform: linux/amd64
    volumes:
      - 'directus-postgresql-data:/var/lib/postgresql/data'
    environment:
      - POSTGRES_USER=${SERVICE_USER_POSTGRESQL}
      - POSTGRES_PASSWORD=${SERVICE_PASSWORD_POSTGRESQL}
      - POSTGRES_DB=${POSTGRESQL_DATABASE:-directus}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 20s
      retries: 10

  redis:
    image: 'redis:7-alpine'
    command: 'redis-server --appendonly yes'
    volumes:
      - 'directus-redis-data:/data'
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 20s
      retries: 10

volumes:
  directus-uploads:
  directus-extensions:
  directus-templates:
  directus-postgresql-data:
  directus-redis-data:
```

---

## ✅ Changements clés

**RETIRÉ** :
- ❌ Service `extensions-builder` (plus besoin)
- ❌ Volume `directus-extensions` (l'extension est dans l'image)
- ❌ `depends_on: extensions-builder`

**AJOUTÉ** :
- ✅ `build: context: https://github.com/...` → Coolify clone le repo et build l'image
- ✅ Le Dockerfile du repo installe automatiquement l'extension

---

## 🔍 Vérification après déploiement

1. **Save** et **Redeploy** dans Coolify

2. **Ouvre les logs** du service `directus` et cherche :
   ```
   [RealTime-Calc Extension] Loaded successfully
   [FormulaLoader] Loaded X formula(s) from Y collection(s)
   ```

3. **Si tu ne vois PAS ces logs** → vérifie les logs de build (doit montrer "Building Directus extension" et "Done")

---

## 🧪 Tests rapides

Via Flow → "Run Script" :

```js
// Test 1: Recharger les formules
const result = await emitter.emitAction('realtime-calc.reload-formulas', {});
logger.info(result);
return result;
```

```js
// Test 2: Tester une formule
const result = await emitter.emitAction('realtime-calc.test-formula', {
  formula: '{{prix}} * {{quantite}}',
  sampleData: { prix: 10, quantite: 5 }
});
logger.info(result);
return result;
```

```js
// Test 3: Recalculer une collection
const result = await emitter.emitAction('realtime-calc.recalculate-collection', {
  collection: 'factures',
  dryRun: true  // teste sans écrire
});
logger.info(result);
return result;
```

---

## 🔧 Dépannage

### L'extension ne se charge pas

1. **Vérifie les logs de build** (Coolify → Build logs) :
   - Doit afficher : "Building Directus extension" et "✔ Done"

2. **Vérifie dans le conteneur** :
   ```bash
   docker exec -it <directus-container> ls -la /directus/extensions/hooks/realtime-calc
   ```
   Doit contenir : `package.json`, `dist/`, `node_modules/`

3. **Rebuild from scratch** :
   - Coolify → Advanced → Delete image → Redeploy

### Les formules ne se calculent pas

1. Vérifie que `quartz_formulas` contient des formules avec `status = 'published'`
2. Teste via Flow "Run Script" (voir ci-dessus)
3. Regarde les logs quand tu modifies un item → doit afficher :
   ```
   [RealTime-Calc] calc collection.field: old → new
   ```

---

## 📝 Notes

- **La ligne `Loaded extensions: ...`** ne liste QUE les extensions App (UI). Les hooks ne s'y affichent PAS.
- Cherche `[RealTime-Calc Extension] Loaded successfully` dans les logs.
- L'auto-reload détecte les changements dans `quartz_formulas` (debounce 5 sec)