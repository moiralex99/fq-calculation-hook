-- ============================================
-- SETUP COMPLET POUR DEMO EXTENSION REALTIME-CALC
-- ============================================

-- 1. Créer la table quartz_formulas (configuration des formules)
-- ============================================

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

CREATE INDEX IF NOT EXISTS idx_quartz_formulas_collection ON quartz_formulas(collection_cible);
CREATE INDEX IF NOT EXISTS idx_quartz_formulas_status ON quartz_formulas(status);

-- 2. Créer la collection de test : produits
-- ============================================

CREATE TABLE IF NOT EXISTS produits (
  id SERIAL PRIMARY KEY,
  nom VARCHAR(255) NOT NULL,
  prix_unitaire DECIMAL(10,2) DEFAULT 0,
  quantite_stock INTEGER DEFAULT 0,
  seuil_alerte INTEGER DEFAULT 10,
  taux_tva DECIMAL(5,2) DEFAULT 20,
  
  -- Champs calculés par l'extension
  valeur_stock DECIMAL(10,2),
  statut_stock VARCHAR(50),
  prix_ttc DECIMAL(10,2),
  
  date_created TIMESTAMP DEFAULT NOW(),
  date_updated TIMESTAMP DEFAULT NOW(),
  user_created VARCHAR(36),
  user_updated VARCHAR(36)
);

-- 3. Créer la collection de test : commandes
-- ============================================

CREATE TABLE IF NOT EXISTS commandes (
  id SERIAL PRIMARY KEY,
  client_nom VARCHAR(255),
  quantite INTEGER DEFAULT 1,
  prix_unitaire DECIMAL(10,2) DEFAULT 0,
  code_promo VARCHAR(50),
  
  -- Champs calculés par l'extension
  montant_brut DECIMAL(10,2),
  remise_pourcent DECIMAL(5,2),
  montant_remise DECIMAL(10,2),
  montant_net DECIMAL(10,2),
  montant_tva DECIMAL(10,2),
  total_ttc DECIMAL(10,2),
  
  date_created TIMESTAMP DEFAULT NOW(),
  date_updated TIMESTAMP DEFAULT NOW(),
  user_created VARCHAR(36),
  user_updated VARCHAR(36)
);

-- 4. Insérer les formules de test
-- ============================================

INSERT INTO quartz_formulas (collection_cible, champ_cible, formula, status, sort, description) VALUES

-- PRODUITS : Gestion de stock et prix TTC
('produits', 'valeur_stock', 'ROUND({{prix_unitaire}} * {{quantite_stock}}, 2)', 'published', 1, 'Valeur totale du stock'),
('produits', 'statut_stock', 'IF({{quantite_stock}} < {{seuil_alerte}}, "🔴 Rupture", IF({{quantite_stock}} < {{seuil_alerte}} * 2, "🟡 Faible", "🟢 OK"))', 'published', 2, 'Statut visuel du stock'),
('produits', 'prix_ttc', 'ROUND({{prix_unitaire}} * (1 + {{taux_tva}} / 100), 2)', 'published', 3, 'Prix TTC avec TVA'),

-- COMMANDES : Calcul complet avec remise progressive
('commandes', 'montant_brut', 'ROUND({{quantite}} * {{prix_unitaire}}, 2)', 'published', 1, 'Montant avant remise'),
('commandes', 'remise_pourcent', 'IF({{code_promo}} = "VIP20", 20, IF({{montant_brut}} > 1000, 15, IF({{montant_brut}} > 500, 10, 5)))', 'published', 2, 'Remise selon code promo et montant'),
('commandes', 'montant_remise', 'ROUND({{montant_brut}} * {{remise_pourcent}} / 100, 2)', 'published', 3, 'Montant de la remise'),
('commandes', 'montant_net', 'ROUND({{montant_brut}} - {{montant_remise}}, 2)', 'published', 4, 'Montant après remise'),
('commandes', 'montant_tva', 'ROUND({{montant_net}} * 0.2, 2)', 'published', 5, 'TVA à 20%'),
('commandes', 'total_ttc', 'ROUND({{montant_net}} + {{montant_tva}}, 2)', 'published', 6, 'Total TTC final');

-- 5. Insérer des données de test dans produits
-- ============================================

INSERT INTO produits (nom, prix_unitaire, quantite_stock, seuil_alerte, taux_tva) VALUES
('Laptop Dell XPS', 999.99, 15, 5, 20),
('Souris Logitech', 29.99, 3, 10, 20),
('Clavier Mécanique', 89.99, 25, 8, 20),
('Écran 27" 4K', 449.99, 8, 5, 20),
('Webcam HD', 59.99, 2, 10, 20);

-- 6. Insérer des données de test dans commandes
-- ============================================

INSERT INTO commandes (client_nom, quantite, prix_unitaire, code_promo) VALUES
('Jean Dupont', 2, 999.99, NULL),           -- Montant: 1999.98 → remise 15%
('Marie Martin', 1, 449.99, 'VIP20'),        -- Code promo VIP → remise 20%
('Paul Durant', 5, 89.99, NULL),             -- Montant: 449.95 → remise 5%
('Sophie Bernard', 3, 29.99, NULL),          -- Montant: 89.97 → remise 5%
('Luc Thomas', 10, 59.99, 'VIP20');          -- Montant: 599.90 + VIP20 → remise 20%

-- 7. Vérification
-- ============================================

-- Voir les formules configurées
SELECT 
  collection_cible,
  champ_cible,
  LEFT(formula, 50) as formula_preview,
  status,
  sort
FROM quartz_formulas
ORDER BY collection_cible, sort;

-- Voir les produits (les champs calculés seront NULL pour l'instant)
SELECT * FROM produits LIMIT 5;

-- Voir les commandes (les champs calculés seront NULL pour l'instant)
SELECT * FROM commandes LIMIT 5;

-- ============================================
-- IMPORTANT: Après avoir exécuté ce SQL
-- ============================================
-- 1. Redémarrer Directus pour charger l'extension
-- 2. L'extension va charger les formules depuis quartz_formulas
-- 3. Pour remplir les champs calculés existants, faire un UPDATE :
--    UPDATE produits SET date_updated = NOW();
--    UPDATE commandes SET date_updated = NOW();
-- 4. Ou créer de nouveaux enregistrements via l'interface Directus
-- ============================================
