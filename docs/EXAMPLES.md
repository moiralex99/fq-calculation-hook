# Exemples de Configuration - Calculs Temps Réel

Ce fichier contient des exemples concrets prêts à l'emploi pour différents cas d'usage.

## 📦 Comment utiliser ces exemples

1. Copiez la configuration souhaitée
2. Collez-la dans `src/index.js` dans l'objet `CALCULATED_FIELDS_CONFIG`
3. Créez les champs correspondants dans Directus
4. Rebuild l'extension: `npm run build`
5. Redémarrez Directus

---

## 💰 Exemple 1: Facturation Complète

### Modèle de données Directus

Collection: `factures`

| Champ | Type | Description | Calculé |
|-------|------|-------------|---------|
| quantite | Integer | Quantité commandée | ❌ |
| prix_unitaire | Decimal | Prix unitaire HT | ❌ |
| taux_tva | Decimal | Taux de TVA (ex: 20) | ❌ |
| remise_pourcent | Decimal | % de remise (ex: 10) | ❌ |
| total_ht | Decimal | Total HT | ✅ |
| remise_montant | Decimal | Montant de la remise | ✅ |
| total_ht_apres_remise | Decimal | Total HT après remise | ✅ |
| montant_tva | Decimal | Montant de la TVA | ✅ |
| total_ttc | Decimal | Total TTC final | ✅ |

### Configuration

```javascript
factures: {
  // 1. Calcul du total HT
  total_ht: 'quantite * prix_unitaire',
  
  // 2. Calcul de la remise
  remise_montant: 'PERCENT(total_ht, COALESCE(remise_pourcent, 0))',
  
  // 3. Total HT après remise
  total_ht_apres_remise: 'total_ht - remise_montant',
  
  // 4. Calcul de la TVA sur le montant après remise
  montant_tva: 'PERCENT(total_ht_apres_remise, taux_tva)',
  
  // 5. Total TTC final
  total_ttc: 'ROUND(total_ht_apres_remise + montant_tva, 2)'
}
```

### Exemple de données

**Input:**
```json
{
  "quantite": 10,
  "prix_unitaire": 50.00,
  "taux_tva": 20,
  "remise_pourcent": 10
}
```

**Output (auto-calculé):**
```json
{
  "total_ht": 500.00,
  "remise_montant": 50.00,
  "total_ht_apres_remise": 450.00,
  "montant_tva": 90.00,
  "total_ttc": 540.00
}
```

---

## 🏪 Exemple 2: Gestion de Produits avec Marges

### Modèle de données Directus

Collection: `produits`

| Champ | Type | Description | Calculé |
|-------|------|-------------|---------|
| prix_achat | Decimal | Prix d'achat HT | ❌ |
| marge_souhaitee | Decimal | Marge en % (ex: 30) | ❌ |
| taux_tva | Decimal | TVA (ex: 20) | ❌ |
| prix_vente_ht | Decimal | Prix de vente HT | ✅ |
| prix_vente_ttc | Decimal | Prix de vente TTC | ✅ |
| marge_montant | Decimal | Marge en euros | ✅ |
| marge_reelle | Decimal | Marge réelle en % | ✅ |

### Configuration

```javascript
produits: {
  // Prix de vente HT basé sur la marge souhaitée
  prix_vente_ht: 'ROUND(prix_achat * (1 + marge_souhaitee / 100), 2)',
  
  // Prix de vente TTC
  prix_vente_ttc: 'ROUND(prix_vente_ht * (1 + taux_tva / 100), 2)',
  
  // Marge en montant
  marge_montant: 'prix_vente_ht - prix_achat',
  
  // Marge réelle (vérification)
  marge_reelle: 'ROUND((marge_montant / prix_achat) * 100, 2)'
}
```

---

## 👥 Exemple 3: Gestion RH - Salaires et Primes

### Modèle de données Directus

Collection: `employes`

| Champ | Type | Description | Calculé |
|-------|------|-------------|---------|
| salaire_base | Decimal | Salaire de base | ❌ |
| anciennete_annees | Integer | Années d'ancienneté | ❌ |
| performance | Decimal | Note 0-100 | ❌ |
| heures_supplementaires | Integer | Heures sup du mois | ❌ |
| taux_horaire_sup | Decimal | Taux horaire des heures sup | ❌ |
| prime_anciennete | Decimal | Prime d'ancienneté | ✅ |
| prime_performance | Decimal | Prime de performance | ✅ |
| montant_heures_sup | Decimal | Montant heures sup | ✅ |
| salaire_brut | Decimal | Salaire brut total | ✅ |

### Configuration

```javascript
employes: {
  // Prime d'ancienneté: 2% par an, max 20%
  prime_anciennete: 'PERCENT(salaire_base, IF(anciennete_annees > 10, 20, anciennete_annees * 2))',
  
  // Prime de performance: 0-15% selon la note
  prime_performance: 'IF(performance >= 80, PERCENT(salaire_base, 15), IF(performance >= 60, PERCENT(salaire_base, 10), IF(performance >= 40, PERCENT(salaire_base, 5), 0)))',
  
  // Heures supplémentaires
  montant_heures_sup: 'heures_supplementaires * taux_horaire_sup',
  
  // Salaire brut total
  salaire_brut: 'ROUND(salaire_base + prime_anciennete + prime_performance + montant_heures_sup, 2)'
}
```

---

## 📦 Exemple 4: Gestion de Stock avec Alertes

### Modèle de données Directus

Collection: `stocks`

| Champ | Type | Description | Calculé |
|-------|------|-------------|---------|
| stock_initial | Integer | Stock de départ | ❌ |
| entrees | Integer | Entrées du mois | ❌ |
| sorties | Integer | Sorties du mois | ❌ |
| seuil_alerte | Integer | Seuil d'alerte | ❌ |
| prix_unitaire | Decimal | Prix unitaire | ❌ |
| stock_final | Integer | Stock actuel | ✅ |
| alerte_stock | Boolean | Alerte stock faible | ✅ |
| valeur_stock | Decimal | Valeur totale du stock | ✅ |
| taux_rotation | Decimal | Taux de rotation | ✅ |

### Configuration

```javascript
stocks: {
  // Stock final
  stock_final: 'stock_initial + entrees - sorties',
  
  // Alerte si stock < seuil
  alerte_stock: 'stock_final < seuil_alerte',
  
  // Valeur du stock
  valeur_stock: 'ROUND(stock_final * prix_unitaire, 2)',
  
  // Taux de rotation (sorties / stock moyen)
  taux_rotation: 'IF(stock_initial > 0, ROUND((sorties / ((stock_initial + stock_final) / 2)) * 100, 2), 0)'
}
```

---

## 🎓 Exemple 5: Gestion d'Étudiants - Moyennes

### Modèle de données Directus

Collection: `evaluations`

| Champ | Type | Description | Calculé |
|-------|------|-------------|---------|
| note_controle_1 | Decimal | Note 1 (coeff 1) | ❌ |
| note_controle_2 | Decimal | Note 2 (coeff 1) | ❌ |
| note_examen | Decimal | Note examen (coeff 2) | ❌ |
| bonus | Decimal | Points bonus | ❌ |
| moyenne | Decimal | Moyenne finale | ✅ |
| mention | String | Mention obtenue | ✅ |
| admis | Boolean | Admis ou non | ✅ |

### Configuration

```javascript
evaluations: {
  // Moyenne pondérée avec bonus
  moyenne: 'ROUND(((note_controle_1 + note_controle_2 + (note_examen * 2)) / 4) + COALESCE(bonus, 0), 2)',
  
  // Mention basée sur la moyenne
  mention: 'IF(moyenne >= 16, "Très Bien", IF(moyenne >= 14, "Bien", IF(moyenne >= 12, "Assez Bien", IF(moyenne >= 10, "Passable", "Insuffisant"))))',
  
  // Admis si moyenne >= 10
  admis: 'moyenne >= 10'
}
```

---

## 🏗️ Exemple 6: Devis BTP avec Calculs Complexes

### Modèle de données Directus

Collection: `lignes_devis`

| Champ | Type | Description | Calculé |
|-------|------|-------------|---------|
| surface | Decimal | Surface en m² | ❌ |
| prix_m2 | Decimal | Prix au m² | ❌ |
| coefficient_difficulte | Decimal | Coeff 1.0-2.0 | ❌ |
| fournitures_pourcent | Decimal | % fournitures (ex: 40) | ❌ |
| main_oeuvre_horaire | Decimal | Taux horaire MO | ❌ |
| temps_estime_heures | Decimal | Temps estimé | ❌ |
| total_base | Decimal | Total de base | ✅ |
| total_ajuste | Decimal | Total avec difficulté | ✅ |
| cout_fournitures | Decimal | Coût fournitures | ✅ |
| cout_main_oeuvre | Decimal | Coût main d'œuvre | ✅ |
| prix_final_ht | Decimal | Prix final HT | ✅ |

### Configuration

```javascript
lignes_devis: {
  // Total de base
  total_base: 'surface * prix_m2',
  
  // Total ajusté avec coefficient de difficulté
  total_ajuste: 'ROUND(total_base * coefficient_difficulte, 2)',
  
  // Répartition fournitures
  cout_fournitures: 'PERCENT(total_ajuste, fournitures_pourcent)',
  
  // Coût main d'œuvre
  cout_main_oeuvre: 'temps_estime_heures * main_oeuvre_horaire',
  
  // Prix final (max entre répartition et réel)
  prix_final_ht: 'ROUND(IF(cout_main_oeuvre > (total_ajuste - cout_fournitures), cout_fournitures + cout_main_oeuvre, total_ajuste), 2)'
}
```

---

## 🎫 Exemple 7: Billetterie avec Tarifs Dynamiques

### Modèle de données Directus

Collection: `reservations`

| Champ | Type | Description | Calculé |
|-------|------|-------------|---------|
| nombre_adultes | Integer | Nb adultes | ❌ |
| nombre_enfants | Integer | Nb enfants | ❌ |
| prix_adulte | Decimal | Prix adulte | ❌ |
| prix_enfant | Decimal | Prix enfant | ❌ |
| code_promo | String | Code promo | ❌ |
| jour_semaine | Integer | 1-7 (1=lundi) | ❌ |
| sous_total | Decimal | Sous-total | ✅ |
| remise_famille | Decimal | Remise famille nombreuse | ✅ |
| remise_code | Decimal | Remise code promo | ✅ |
| supplement_weekend | Decimal | Supplément weekend | ✅ |
| total_final | Decimal | Total final | ✅ |

### Configuration

```javascript
reservations: {
  // Sous-total de base
  sous_total: '(nombre_adultes * prix_adulte) + (nombre_enfants * prix_enfant)',
  
  // Remise famille nombreuse (10% si 3+ enfants)
  remise_famille: 'IF(nombre_enfants >= 3, PERCENT(sous_total, 10), 0)',
  
  // Remise code promo (15% si code = "SUMMER")
  remise_code: 'IF(code_promo == "SUMMER", PERCENT(sous_total, 15), IF(code_promo == "WINTER", PERCENT(sous_total, 10), 0))',
  
  // Supplément weekend (20% samedi/dimanche)
  supplement_weekend: 'IF(jour_semaine >= 6, PERCENT(sous_total, 20), 0)',
  
  // Total final
  total_final: 'ROUND(sous_total - remise_famille - remise_code + supplement_weekend, 2)'
}
```

---

## 🚗 Exemple 8: Location de Véhicules

### Modèle de données Directus

Collection: `locations`

| Champ | Type | Description | Calculé |
|-------|------|-------------|---------|
| nombre_jours | Integer | Durée location | ❌ |
| tarif_journalier | Decimal | Tarif/jour | ❌ |
| km_parcourus | Integer | Km parcourus | ❌ |
| km_inclus | Integer | Km inclus | ❌ |
| tarif_km_sup | Decimal | Prix/km sup | ❌ |
| assurance_jour | Decimal | Assurance/jour | ❌ |
| avec_assurance | Boolean | Assurance souscrite | ❌ |
| total_location | Decimal | Total location | ✅ |
| km_supplementaires | Integer | Km en supplément | ✅ |
| cout_km_sup | Decimal | Coût km sup | ✅ |
| cout_assurance | Decimal | Coût assurance | ✅ |
| total_ttc | Decimal | Total TTC | ✅ |

### Configuration

```javascript
locations: {
  // Total location de base
  total_location: 'nombre_jours * tarif_journalier',
  
  // Km supplémentaires
  km_supplementaires: 'IF(km_parcourus > km_inclus, km_parcourus - km_inclus, 0)',
  
  // Coût des km supplémentaires
  cout_km_sup: 'km_supplementaires * tarif_km_sup',
  
  // Coût assurance
  cout_assurance: 'IF(avec_assurance, nombre_jours * assurance_jour, 0)',
  
  // Total TTC
  total_ttc: 'ROUND(total_location + cout_km_sup + cout_assurance, 2)'
}
```

---

## 💡 Conseils pour créer vos propres formules

1. **Commencez simple** - Testez d'abord les calculs de base
2. **Utilisez COALESCE** - Pour gérer les valeurs nulles
3. **Arrondissez les montants** - Utilisez ROUND(valeur, 2) pour les prix
4. **Testez avec l'API** - Utilisez l'action `test-formula` avant de déployer
5. **Documentez** - Ajoutez des commentaires pour expliquer la logique

## 🔄 Template vide à personnaliser

```javascript
ma_collection: {
  // Calcul 1: Description
  champ_calcule_1: 'formule1',
  
  // Calcul 2: Description
  champ_calcule_2: 'formule2',
  
  // Calcul final: Description
  champ_final: 'formule_finale'
}
```

---

**Besoin de plus d'exemples ?** Consultez la documentation complète dans `README.md` ! 🚀
