-- Migration: Update collection_cible to support array format
-- Date: 2025-10-18
-- Description: Permet de définir plusieurs collections cibles pour une automation

-- Pour PostgreSQL
-- Option 1: Garder TEXT et parser en array côté code (recommandé pour rétrocompatibilité)
-- Pas de changement nécessaire, le code supporte déjà string OU array

-- Option 2: Changer le type en JSONB pour stocker un vrai array
-- ALTER TABLE quartz_automations 
-- ALTER COLUMN collection_cible TYPE JSONB USING 
--   CASE 
--     WHEN collection_cible IS NULL THEN NULL
--     WHEN collection_cible = '' THEN NULL
--     ELSE to_jsonb(ARRAY[collection_cible])
--   END;

-- Recommandation: Garder TEXT et utiliser le format suivant dans l'interface:
-- - String simple: "processus" (une seule collection)
-- - Array JSON: ["taches", "actions"] (plusieurs collections)
-- 
-- Le code supporte automatiquement les deux formats via matchesCollection()

-- Exemples de valeurs:
-- NULL ou '' : écoute toutes les collections
-- "processus" : écoute seulement processus
-- ["taches", "actions"] : écoute taches ET actions
-- ["orders", "invoices", "payments"] : écoute 3 collections

COMMENT ON COLUMN quartz_automations.collection_cible IS 
'Target collection(s): string for single collection, JSON array for multiple, or NULL for all. Examples: "orders", ["tasks","actions"]';
