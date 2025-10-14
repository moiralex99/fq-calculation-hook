-- Création de la table quartz_formulas pour FlowQuartz Engine
-- Compatible avec l'extension realtime-calc et l'engine Python

CREATE TABLE IF NOT EXISTS quartz_formulas (
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
CREATE INDEX IF NOT EXISTS idx_quartz_formulas_collection ON quartz_formulas(collection_cible);
CREATE INDEX IF NOT EXISTS idx_quartz_formulas_status ON quartz_formulas(status);

-- Exemples de formules pour tester l'extension
-- FACTURES : Calcul automatique de TVA et total TTC

INSERT INTO quartz_formulas (collection_cible, champ_cible, formula, status, sort, description)
VALUES
  -- Exemple 1: Facture simple
  ('factures', 'total_ht', '{{quantite}} * {{prix_unitaire}}', 'published', 1, 'Calcul du total HT'),
  ('factures', 'montant_tva', 'ROUND({{total_ht}} * 0.2, 2)', 'published', 2, 'Calcul de la TVA à 20%'),
  ('factures', 'total_ttc', 'ROUND({{total_ht}} + {{montant_tva}}, 2)', 'published', 3, 'Calcul du total TTC'),
  
  -- Exemple 2: Remise conditionnelle
  ('commandes', 'remise_pourcent', 'IF({{montant_brut}} > 1000, 15, IF({{montant_brut}} > 500, 10, 5))', 'published', 1, 'Remise progressive selon montant'),
  ('commandes', 'montant_remise', 'ROUND({{montant_brut}} * {{remise_pourcent}} / 100, 2)', 'published', 2, 'Calcul du montant de remise'),
  ('commandes', 'montant_net', 'ROUND({{montant_brut}} - {{montant_remise}}, 2)', 'published', 3, 'Montant final après remise'),
  
  -- Exemple 3: Gestion de stock
  ('inventaire', 'stock_final', '{{stock_initial}} + {{entrees}} - {{sorties}}', 'published', 1, 'Stock restant'),
  ('inventaire', 'statut', 'IF({{stock_final}} < {{seuil_alerte}}, "🔴 Alerte", IF({{stock_final}} < {{seuil_alerte}} * 2, "🟡 Attention", "🟢 OK"))', 'published', 2, 'Statut du stock'),
  
  -- Exemple 4: Client VIP
  ('clients', 'est_vip', 'IF({{ca_total}} > 10000 AND {{nb_commandes}} > 20, "VIP", "Standard")', 'published', 1, 'Détection client VIP'),
  ('clients', 'taux_remise', 'IF({{est_vip}} = "VIP", 20, 10)', 'published', 2, 'Remise selon statut');

-- Vérifier les formules insérées
SELECT 
  collection_cible,
  champ_cible,
  formula,
  status,
  description
FROM quartz_formulas
ORDER BY collection_cible, sort;
