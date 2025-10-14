-- ============================================
-- SETUP DE TESTS EXHAUSTIFS POUR REALTIME-CALC
-- ============================================
-- Ce fichier configure plusieurs collections avec des formules
-- de complexité croissante pour tester tous les cas de figure

-- 1. COLLECTION: test_calculs_simples
-- Tests de base: arithmétique simple
-- ============================================

CREATE TABLE IF NOT EXISTS test_calculs_simples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Champs sources
  valeur_a REAL DEFAULT 0,
  valeur_b REAL DEFAULT 0,
  valeur_c REAL DEFAULT 0,
  
  -- Champs calculés simples
  somme REAL,           -- a + b
  difference REAL,      -- a - b
  produit REAL,         -- a * b
  quotient REAL,        -- a / b
  moyenne REAL,         -- (a + b + c) / 3
  
  date_created TEXT DEFAULT (datetime('now')),
  date_updated TEXT DEFAULT (datetime('now'))
);

-- 2. COLLECTION: test_cascades
-- Tests de dépendances en cascade (A→B→C)
-- ============================================

CREATE TABLE IF NOT EXISTS test_cascades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Champ source initial
  prix_base REAL DEFAULT 0,
  taux_remise REAL DEFAULT 0,
  
  -- Cascade niveau 1: dépend de prix_base
  prix_reduit REAL,     -- prix_base * (1 - taux_remise/100)
  
  -- Cascade niveau 2: dépend de prix_reduit
  tva REAL,             -- prix_reduit * 0.20
  
  -- Cascade niveau 3: dépend de prix_reduit ET tva
  prix_final REAL,      -- prix_reduit + tva
  
  date_created TEXT DEFAULT (datetime('now')),
  date_updated TEXT DEFAULT (datetime('now'))
);

-- 3. COLLECTION: test_conditions
-- Tests avec conditions IF()
-- ============================================

CREATE TABLE IF NOT EXISTS test_conditions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Champs sources
  quantite INTEGER DEFAULT 0,
  seuil_min INTEGER DEFAULT 10,
  seuil_max INTEGER DEFAULT 100,
  prix REAL DEFAULT 0,
  
  -- Champs calculés avec conditions
  statut TEXT,          -- IF({{quantite}} < {{seuil_min}}, "RUPTURE", IF({{quantite}} > {{seuil_max}}, "SURSTOCK", "NORMAL"))
  remise REAL,          -- IF({{quantite}} > 50, {{prix}} * 0.1, 0)
  prix_unitaire REAL,   -- {{prix}} - {{remise}}
  total REAL,           -- {{prix_unitaire}} * {{quantite}}
  
  date_created TEXT DEFAULT (datetime('now')),
  date_updated TEXT DEFAULT (datetime('now'))
);

-- 4. COLLECTION: test_fonctions
-- Tests de toutes les fonctions disponibles
-- ============================================

CREATE TABLE IF NOT EXISTS test_fonctions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Champs sources
  nombre REAL DEFAULT 0,
  texte TEXT DEFAULT '',
  date_debut TEXT,
  date_fin TEXT,
  
  -- Fonctions mathématiques
  arrondi REAL,         -- ROUND({{nombre}}, 2)
  plafond REAL,         -- CEIL({{nombre}})
  plancher REAL,        -- FLOOR({{nombre}})
  absolu REAL,          -- ABS({{nombre}})
  racine REAL,          -- SQRT({{nombre}})
  puissance REAL,       -- POW({{nombre}}, 2)
  
  -- Fonctions texte
  majuscules TEXT,      -- UPPER({{texte}})
  minuscules TEXT,      -- LOWER({{texte}})
  longueur INTEGER,     -- LEN({{texte}})
  concatenation TEXT,   -- CONCAT({{texte}}, " - ", {{nombre}})
  
  -- Fonctions de date
  jours_ecart INTEGER,  -- DAYS_BETWEEN({{date_debut}}, {{date_fin}})
  
  date_created TEXT DEFAULT (datetime('now')),
  date_updated TEXT DEFAULT (datetime('now'))
);

-- 5. COLLECTION: test_null_handling
-- Tests de gestion des valeurs NULL
-- ============================================

CREATE TABLE IF NOT EXISTS test_null_handling (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Champs sources (peuvent être NULL)
  valeur_opt_a REAL,
  valeur_opt_b REAL,
  
  -- Tests avec NULL
  somme_avec_null REAL,     -- {{valeur_opt_a}} + {{valeur_opt_b}}
  coalesce_test REAL,       -- COALESCE({{valeur_opt_a}}, 0) + COALESCE({{valeur_opt_b}}, 0)
  is_null_test TEXT,        -- IF({{valeur_opt_a}} == null, "NULL", "VALEUR")
  
  date_created TEXT DEFAULT (datetime('now')),
  date_updated TEXT DEFAULT (datetime('now'))
);

-- 6. COLLECTION: test_produits_complet
-- Test réaliste: gestion de produits avec stock
-- ============================================

CREATE TABLE IF NOT EXISTS test_produits_complet (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Informations produit
  nom TEXT NOT NULL,
  reference TEXT,
  
  -- Prix et coûts
  prix_achat REAL DEFAULT 0,
  marge_pourcentage REAL DEFAULT 30,
  
  -- Stock
  quantite_stock INTEGER DEFAULT 0,
  seuil_alerte INTEGER DEFAULT 10,
  
  -- TVA
  taux_tva REAL DEFAULT 20,
  
  -- CHAMPS CALCULÉS
  prix_vente_ht REAL,       -- {{prix_achat}} * (1 + {{marge_pourcentage}}/100)
  prix_vente_ttc REAL,      -- {{prix_vente_ht}} * (1 + {{taux_tva}}/100)
  valeur_stock REAL,        -- {{prix_achat}} * {{quantite_stock}}
  statut_stock TEXT,        -- IF({{quantite_stock}} == 0, "RUPTURE", IF({{quantite_stock}} < {{seuil_alerte}}, "ALERTE", "OK"))
  marge_unitaire REAL,      -- {{prix_vente_ht}} - {{prix_achat}}
  marge_totale REAL,        -- {{marge_unitaire}} * {{quantite_stock}}
  
  date_created TEXT DEFAULT (datetime('now')),
  date_updated TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- INSERTION DES FORMULES DANS quartz_formulas
-- ============================================

-- Formules pour test_calculs_simples
INSERT INTO quartz_formulas (collection_cible, champ_cible, formula, status, sort, description) VALUES
('test_calculs_simples', 'somme', '{{valeur_a}} + {{valeur_b}}', 'published', 1, 'Addition simple'),
('test_calculs_simples', 'difference', '{{valeur_a}} - {{valeur_b}}', 'published', 2, 'Soustraction simple'),
('test_calculs_simples', 'produit', '{{valeur_a}} * {{valeur_b}}', 'published', 3, 'Multiplication simple'),
('test_calculs_simples', 'quotient', '{{valeur_a}} / {{valeur_b}}', 'published', 4, 'Division simple'),
('test_calculs_simples', 'moyenne', '({{valeur_a}} + {{valeur_b}} + {{valeur_c}}) / 3', 'published', 5, 'Moyenne de 3 valeurs');

-- Formules pour test_cascades (ordre important!)
INSERT INTO quartz_formulas (collection_cible, champ_cible, formula, status, sort, description) VALUES
('test_cascades', 'prix_reduit', '{{prix_base}} * (1 - {{taux_remise}}/100)', 'published', 1, 'Prix après remise'),
('test_cascades', 'tva', '{{prix_reduit}} * 0.20', 'published', 2, 'TVA sur prix réduit'),
('test_cascades', 'prix_final', '{{prix_reduit}} + {{tva}}', 'published', 3, 'Prix TTC final');

-- Formules pour test_conditions
INSERT INTO quartz_formulas (collection_cible, champ_cible, formula, status, sort, description) VALUES
('test_conditions', 'statut', 'IF({{quantite}} < {{seuil_min}}, "RUPTURE", IF({{quantite}} > {{seuil_max}}, "SURSTOCK", "NORMAL"))', 'published', 1, 'Statut selon stock'),
('test_conditions', 'remise', 'IF({{quantite}} > 50, {{prix}} * 0.1, 0)', 'published', 2, 'Remise si quantité > 50'),
('test_conditions', 'prix_unitaire', '{{prix}} - {{remise}}', 'published', 3, 'Prix après remise'),
('test_conditions', 'total', '{{prix_unitaire}} * {{quantite}}', 'published', 4, 'Total de la commande');

-- Formules pour test_fonctions
INSERT INTO quartz_formulas (collection_cible, champ_cible, formula, status, sort, description) VALUES
('test_fonctions', 'arrondi', 'ROUND({{nombre}}, 2)', 'published', 1, 'Arrondi à 2 décimales'),
('test_fonctions', 'plafond', 'CEIL({{nombre}})', 'published', 2, 'Arrondi supérieur'),
('test_fonctions', 'plancher', 'FLOOR({{nombre}})', 'published', 3, 'Arrondi inférieur'),
('test_fonctions', 'absolu', 'ABS({{nombre}})', 'published', 4, 'Valeur absolue'),
('test_fonctions', 'racine', 'SQRT({{nombre}})', 'published', 5, 'Racine carrée'),
('test_fonctions', 'puissance', 'POW({{nombre}}, 2)', 'published', 6, 'Nombre au carré'),
('test_fonctions', 'majuscules', 'UPPER({{texte}})', 'published', 7, 'Texte en majuscules'),
('test_fonctions', 'minuscules', 'LOWER({{texte}})', 'published', 8, 'Texte en minuscules'),
('test_fonctions', 'longueur', 'LEN({{texte}})', 'published', 9, 'Longueur du texte'),
('test_fonctions', 'concatenation', 'CONCAT({{texte}}, " - ", {{nombre}})', 'published', 10, 'Concaténation');

-- Formules pour test_null_handling
INSERT INTO quartz_formulas (collection_cible, champ_cible, formula, status, sort, description) VALUES
('test_null_handling', 'somme_avec_null', '{{valeur_opt_a}} + {{valeur_opt_b}}', 'published', 1, 'Somme avec NULL possible'),
('test_null_handling', 'coalesce_test', 'COALESCE({{valeur_opt_a}}, 0) + COALESCE({{valeur_opt_b}}, 0)', 'published', 2, 'Somme avec valeurs par défaut'),
('test_null_handling', 'is_null_test', 'IF({{valeur_opt_a}} == null, "NULL", "VALEUR")', 'published', 3, 'Test si NULL');

-- Formules pour test_produits_complet
INSERT INTO quartz_formulas (collection_cible, champ_cible, formula, status, sort, description) VALUES
('test_produits_complet', 'prix_vente_ht', '{{prix_achat}} * (1 + {{marge_pourcentage}}/100)', 'published', 1, 'Prix de vente HT'),
('test_produits_complet', 'marge_unitaire', '{{prix_vente_ht}} - {{prix_achat}}', 'published', 2, 'Marge par unité'),
('test_produits_complet', 'prix_vente_ttc', '{{prix_vente_ht}} * (1 + {{taux_tva}}/100)', 'published', 3, 'Prix de vente TTC'),
('test_produits_complet', 'valeur_stock', '{{prix_achat}} * {{quantite_stock}}', 'published', 4, 'Valeur du stock'),
('test_produits_complet', 'marge_totale', '{{marge_unitaire}} * {{quantite_stock}}', 'published', 5, 'Marge totale du stock'),
('test_produits_complet', 'statut_stock', 'IF({{quantite_stock}} == 0, "RUPTURE", IF({{quantite_stock}} < {{seuil_alerte}}, "ALERTE", "OK"))', 'published', 6, 'Statut du stock');

-- ============================================
-- DONNÉES DE TEST
-- ============================================

-- Données pour test_calculs_simples
INSERT INTO test_calculs_simples (valeur_a, valeur_b, valeur_c) VALUES
(10, 5, 15),
(100, 25, 50),
(7.5, 2.5, 3.0);

-- Données pour test_cascades
INSERT INTO test_cascades (prix_base, taux_remise) VALUES
(100, 10),
(250, 20),
(50, 5);

-- Données pour test_conditions
INSERT INTO test_conditions (quantite, seuil_min, seuil_max, prix) VALUES
(5, 10, 100, 50),      -- Rupture
(75, 10, 100, 50),     -- Normal avec remise
(150, 10, 100, 50);    -- Surstock avec remise

-- Données pour test_fonctions
INSERT INTO test_fonctions (nombre, texte, date_debut, date_fin) VALUES
(3.14159, 'Hello World', '2025-01-01', '2025-01-31'),
(-42.7, 'Test TEST', '2025-06-01', '2025-12-31');

-- Données pour test_null_handling
INSERT INTO test_null_handling (valeur_opt_a, valeur_opt_b) VALUES
(10, 20),
(NULL, 15),
(25, NULL),
(NULL, NULL);

-- Données pour test_produits_complet
INSERT INTO test_produits_complet (nom, reference, prix_achat, marge_pourcentage, quantite_stock, seuil_alerte, taux_tva) VALUES
('Ordinateur Portable', 'PC-001', 500, 30, 25, 10, 20),
('Souris Bluetooth', 'MS-002', 15, 50, 150, 20, 20),
('Clavier Mécanique', 'KB-003', 80, 40, 5, 10, 20),
('Écran 27"', 'MON-004', 200, 35, 0, 5, 20);

-- ============================================
-- VÉRIFICATION
-- ============================================

SELECT '=== FORMULES CONFIGURÉES ===' AS info;
SELECT collection_cible, champ_cible, status, sort FROM quartz_formulas ORDER BY collection_cible, sort;

SELECT '=== COLLECTIONS DE TEST CRÉÉES ===' AS info;
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'test_%' ORDER BY name;
