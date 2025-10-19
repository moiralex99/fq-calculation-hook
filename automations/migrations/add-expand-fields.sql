-- Migration: Add expand_fields column to quartz_automations table
-- Date: 2025-10-18
-- Description: Permet de précharger les relations (M2O, O2M, M2M) dans le contexte des automations

-- Pour PostgreSQL (recommandé avec Directus)
ALTER TABLE quartz_automations 
ADD COLUMN IF NOT EXISTS expand_fields JSONB NULL;

-- Pour MySQL/MariaDB (décommenter si besoin)
-- ALTER TABLE quartz_automations 
-- ADD COLUMN expand_fields JSON NULL;

-- Exemple de valeur pour expand_fields:
-- ["domaine_lie.*", "responsable.email", "taches.*"]

COMMENT ON COLUMN quartz_automations.expand_fields IS 
'Array of field paths to expand (e.g., ["project.*", "client.email"]). Supports M2O, O2M, M2M relations.';
