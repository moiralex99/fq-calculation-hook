# Installation dans Directus

## Option 1 : Symlink (RECOMMANDÉ pour dev)

**Avantages :**
- Modifications instantanées
- Pas besoin de copier à chaque fois
- Le mode `npm run dev` rebuild auto

**Étapes :**

1. **Ouvrir PowerShell en Administrateur** (clic droit > "Exécuter en tant qu'administrateur")

2. **Créer le dossier extensions/hooks si nécessaire :**
```powershell
New-Item -ItemType Directory -Force -Path "C:\directus-test\extensions\hooks"
```

3. **Créer le symlink :**
```powershell
New-Item -ItemType SymbolicLink -Path "C:\directus-test\extensions\hooks\realtime-calc" -Target "c:\Users\ALI CHERFAOUI (O2T)\Desktop\Flow\Flow2\flowquartz_engine\calculated-fields-hook"
```

4. **Vérifier que ça a marché :**
```powershell
Get-Item "C:\directus-test\extensions\hooks\realtime-calc"
# Devrait afficher : Mode = l----- (le 'l' = symbolic link)
```

5. **Activer le hot-reload dans Directus** (optionnel mais utile)

Éditer `C:\directus-test\.env` et ajouter :
```env
EXTENSIONS_AUTO_RELOAD=true
```

6. **Redémarrer Directus**
```powershell
cd C:\directus-test
npm run start
# ou si Docker :
docker-compose restart
```

---

## Option 2 : Copie simple (si symlink ne marche pas)

**Étapes :**

1. **Créer le dossier cible :**
```powershell
New-Item -ItemType Directory -Force -Path "C:\directus-test\extensions\hooks\realtime-calc"
```

2. **Copier l'extension :**
```powershell
Copy-Item -Recurse -Force "c:\Users\ALI CHERFAOUI (O2T)\Desktop\Flow\Flow2\flowquartz_engine\calculated-fields-hook\*" "C:\directus-test\extensions\hooks\realtime-calc\"
```

3. **Redémarrer Directus**

⚠️ **Avec cette option, tu devras recopier à chaque modification !**

---

## Vérification après installation

### 1. Vérifier dans les logs Directus

Au démarrage, tu devrais voir :
```
[RealTime-Calc Extension] Loaded successfully
[FormulaLoader] Loaded X formula(s) from Y collection(s)
```

Si la table `quartz_formulas` n'existe pas encore :
```
[FormulaLoader] Table quartz_formulas not found. Using empty config.
```
→ Normal, tu peux créer la table après.

### 2. Tester les actions

Depuis Postman, curl ou ton navigateur :

**Obtenir la config :**
```bash
POST http://localhost:8055/utils/realtime-calc.get-config
```

**Tester une formule :**
```bash
POST http://localhost:8055/utils/realtime-calc.test-formula
Content-Type: application/json

{
  "formula": "{{prix}} * {{quantite}}",
  "sampleData": {
    "prix": 10,
    "quantite": 5
  }
}
```

Réponse attendue :
```json
{
  "valid": true,
  "result": 50,
  "fields": ["prix", "quantite"],
  "isLocal": true,
  "message": "Formula is valid (local). Result: 50"
}
```

---

## Mode développement actif

Si tu utilises le symlink + `npm run dev` dans l'extension :

1. **Terminal 1** (dans l'extension) :
```powershell
cd "c:\Users\ALI CHERFAOUI (O2T)\Desktop\Flow\Flow2\flowquartz_engine\calculated-fields-hook"
npm run dev
```
→ Laisse tourner en arrière-plan

2. **Terminal 2** (Directus) :
```powershell
cd C:\directus-test
npm run start
```

3. **Édite les fichiers** dans `src/` et sauvegarde
4. Le build se fait **auto** → `dist/index.js` mis à jour
5. Si `EXTENSIONS_AUTO_RELOAD=true`, Directus recharge tout seul
6. Sinon, restart Directus manuellement

---

## Créer la table quartz_formulas

Si tu n'as pas encore la table, voici le SQL :

```sql
CREATE TABLE quartz_formulas (
  id SERIAL PRIMARY KEY,
  collection_cible VARCHAR(255) NOT NULL,
  champ_cible VARCHAR(255) NOT NULL,
  formula TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
  sort INTEGER DEFAULT 0,
  description TEXT,
  date_created TIMESTAMP DEFAULT NOW(),
  date_updated TIMESTAMP DEFAULT NOW(),
  user_created VARCHAR(36),
  user_updated VARCHAR(36)
);

-- Index pour les performances
CREATE INDEX idx_quartz_formulas_collection ON quartz_formulas(collection_cible);
CREATE INDEX idx_quartz_formulas_status ON quartz_formulas(status);
```

### Exemple de formules

```sql
INSERT INTO quartz_formulas (collection_cible, champ_cible, formula, status, sort)
VALUES
  ('factures', 'total_ht', '{{quantite}} * {{prix_unitaire}}', 'published', 1),
  ('factures', 'montant_tva', '{{total_ht}} * 0.2', 'published', 2),
  ('factures', 'total_ttc', '{{total_ht}} + {{montant_tva}}', 'published', 3);
```

---

## Troubleshooting

### L'extension ne se charge pas

1. Vérifier les logs Directus
2. Vérifier que `dist/index.js` existe
3. Vérifier les permissions du dossier

### "Permission denied" sur symlink

→ Il faut PowerShell en **mode Administrateur**

Ou activer le Developer Mode dans Windows :
- Paramètres → Mise à jour et sécurité → Pour les développeurs → Activer "Mode développeur"

### Les formules ne se chargent pas

1. Vérifier que la table `quartz_formulas` existe
2. Vérifier que `status = 'published'`
3. Appeler `/utils/realtime-calc.reload-formulas` pour forcer le reload

### Extension se charge mais ne calcule rien

1. Vérifier les logs : `[RealTime-Calc]`
2. Tester une formule avec l'action `test-formula`
3. Vérifier que les champs existent dans ta collection Directus

---

## Prochaines étapes

1. **Créer la table `quartz_formulas`** (SQL ci-dessus)
2. **Ajouter quelques formules de test**
3. **Créer/modifier un item** dans une collection configurée
4. **Vérifier dans les logs** que les calculs se font
5. **Vérifier en DB** que les champs calculés sont bien remplis

Bon dev ! 🚀
