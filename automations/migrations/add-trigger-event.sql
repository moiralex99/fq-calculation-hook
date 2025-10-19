-- Migration: Add trigger_event column to quartz_automations table
-- Date: 2025-10-18
-- Description: Permet de spécifier quand déclencher l'automation (create, update, delete, ou combinaison)

-- Pour PostgreSQL (recommandé avec Directus)
ALTER TABLE quartz_automations 
ADD COLUMN IF NOT EXISTS trigger_event JSONB DEFAULT '["update"]';

-- Pour MySQL/MariaDB (décommenter si besoin)
-- ALTER TABLE quartz_automations 
-- ADD COLUMN trigger_event JSON DEFAULT ('["update"]');

-- Valeurs possibles (array JSON):
-- ["create"]           : se déclenche uniquement sur items.create
-- ["update"]           : se déclenche uniquement sur items.update (défaut)
-- ["delete"]           : se déclenche uniquement sur items.delete
-- ["create", "update"] : se déclenche sur create ET update
-- ["*"]                : se déclenche sur tous les événements

COMMENT ON COLUMN quartz_automations.trigger_event IS 
'Array of events that trigger this automation: ["create"], ["update"], ["delete"], ["create","update"], or ["*"] for all';
