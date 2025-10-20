-- ========================================
-- Script de création des collections de test
-- pour l'Automation Engine
-- ========================================

-- ========================================
-- 1. COLLECTIONS POUR TESTS BASIQUES
-- ========================================

-- Collection projets (parent principal)
CREATE TABLE IF NOT EXISTS projets (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(255) NOT NULL,
    description TEXT,
    statut VARCHAR(50) DEFAULT 'planifie', -- planifie, en_cours, termine, annule, archive
    type VARCHAR(50), -- web, mobile, backend
    priorite VARCHAR(50), -- basse, moyenne, haute, urgente, critique
    
    -- Dates
    date_creation TIMESTAMP DEFAULT NOW(),
    date_debut DATE,
    date_fin DATE,
    date_echeance DATE,
    date_maj TIMESTAMP DEFAULT NOW(),
    
    -- Budget
    budget_total DECIMAL(10,2),
    budget_utilise DECIMAL(10,2) DEFAULT 0,
    
    -- KPI (calculés par automations)
    nb_taches_total INTEGER DEFAULT 0,
    nb_taches_terminees INTEGER DEFAULT 0,
    pourcentage_completion DECIMAL(5,2) DEFAULT 0,
    duree_estimee INTEGER, -- en heures
    duree_reelle INTEGER,
    
    -- Responsables
    chef_projet_id UUID REFERENCES directus_users(id),
    
    -- Actions
    dupliquer BOOLEAN DEFAULT FALSE,
    action_export BOOLEAN DEFAULT FALSE,
    action_supprimer BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by UUID REFERENCES directus_users(id),
    
    -- Relations
    template_id INTEGER REFERENCES projets(id),
    copie_id INTEGER, -- ID du projet copié
    archived_version_id INTEGER, -- lien vers ancienne version
    next_version_id INTEGER -- lien vers nouvelle version
);

-- Collection taches (enfants de projets)
CREATE TABLE IF NOT EXISTS taches (
    id SERIAL PRIMARY KEY,
    projet_id INTEGER NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
    
    titre VARCHAR(255) NOT NULL,
    description TEXT,
    statut VARCHAR(50) DEFAULT 'a_faire', -- a_faire, en_cours, termine, bloquee, annule
    priorite VARCHAR(50) DEFAULT 'moyenne',
    
    -- Dates
    date_creation TIMESTAMP DEFAULT NOW(),
    date_debut TIMESTAMP,
    date_fin TIMESTAMP,
    date_echeance TIMESTAMP,
    
    -- Durées
    duree_jours INTEGER,
    duree_estimee INTEGER, -- en heures
    duree_reelle INTEGER,
    
    -- Budget
    budget_estime DECIMAL(10,2),
    
    -- Responsables
    responsable_id UUID REFERENCES directus_users(id),
    
    -- KPI calculés
    en_retard BOOLEAN DEFAULT FALSE,
    jours_retard INTEGER DEFAULT 0,
    
    -- Alertes
    alerte_24h_creee BOOLEAN DEFAULT FALSE,
    alerte_budget TEXT,
    
    -- Ordre
    ordre INTEGER,
    
    -- Metadata
    deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    auto_assign BOOLEAN DEFAULT FALSE,
    competence_requise VARCHAR(100)
);

-- Collection sous_processus (niveau intermédiaire)
CREATE TABLE IF NOT EXISTS sous_processus (
    id SERIAL PRIMARY KEY,
    projet_id INTEGER REFERENCES projets(id) ON DELETE CASCADE,
    
    nom VARCHAR(255) NOT NULL,
    description TEXT,
    statut VARCHAR(50) DEFAULT 'planifie',
    ordre INTEGER,
    
    date_creation TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- 2. COLLECTIONS POUR TESTS M2M
-- ========================================

-- Table de jonction projet_membres
CREATE TABLE IF NOT EXISTS projet_membres (
    id SERIAL PRIMARY KEY,
    projet_id INTEGER NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES directus_users(id) ON DELETE CASCADE,
    role VARCHAR(50), -- chef, developer, designer, testeur
    date_ajout TIMESTAMP DEFAULT NOW(),
    
    erreur TEXT,
    deleted BOOLEAN DEFAULT FALSE,
    
    UNIQUE(projet_id, user_id)
);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL UNIQUE,
    couleur VARCHAR(7),
    nb_produits INTEGER DEFAULT 0
);

-- Produits
CREATE TABLE IF NOT EXISTS produits (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(255) NOT NULL,
    description TEXT,
    prix DECIMAL(10,2),
    categorie_id INTEGER,
    note_moyenne DECIMAL(3,2) DEFAULT 0,
    nb_avis INTEGER DEFAULT 0
);

-- Junction produit_tags
CREATE TABLE IF NOT EXISTS produit_tags (
    id SERIAL PRIMARY KEY,
    produit_id INTEGER NOT NULL REFERENCES produits(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    
    UNIQUE(produit_id, tag_id)
);

-- Avis produits
CREATE TABLE IF NOT EXISTS avis_produit (
    id SERIAL PRIMARY KEY,
    produit_id INTEGER NOT NULL REFERENCES produits(id) ON DELETE CASCADE,
    user_id UUID REFERENCES directus_users(id),
    note INTEGER CHECK (note BETWEEN 1 AND 5),
    commentaire TEXT,
    date_creation TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- 3. COLLECTIONS POUR COMMANDES & AGRÉGATIONS
-- ========================================

-- Commandes
CREATE TABLE IF NOT EXISTS commandes (
    id SERIAL PRIMARY KEY,
    numero VARCHAR(50) UNIQUE,
    client_nom VARCHAR(255),
    client_email VARCHAR(255),
    
    statut VARCHAR(50) DEFAULT 'brouillon', -- brouillon, confirmee, payee, expediee, livree, annulee
    
    -- Totaux (calculés par automations)
    total DECIMAL(10,2) DEFAULT 0,
    nb_lignes INTEGER DEFAULT 0,
    
    date_creation TIMESTAMP DEFAULT NOW(),
    date_paiement TIMESTAMP,
    
    -- Actions
    action_export BOOLEAN DEFAULT FALSE,
    format_export VARCHAR(20),
    statut_export VARCHAR(50)
);

-- Lignes de commande
CREATE TABLE IF NOT EXISTS lignes_commande (
    id SERIAL PRIMARY KEY,
    commande_id INTEGER NOT NULL REFERENCES commandes(id) ON DELETE CASCADE,
    produit_id INTEGER REFERENCES produits(id),
    
    designation VARCHAR(255),
    quantite INTEGER NOT NULL DEFAULT 1,
    prix_unitaire DECIMAL(10,2) NOT NULL,
    total_ligne DECIMAL(10,2) -- calculé automatiquement
);

-- ========================================
-- 4. COLLECTIONS POUR DUPLICATION CASCADE
-- ========================================

-- Processus (pour test de duplication multi-niveau)
CREATE TABLE IF NOT EXISTS processus_cascade (
    id SERIAL PRIMARY KEY,
    projet_id INTEGER REFERENCES projets(id),
    
    titre VARCHAR(255) NOT NULL,
    description TEXT,
    statut VARCHAR(50) DEFAULT 'brouillon', -- brouillon, actif, inactif, archive
    
    -- Duplication
    dupliquer BOOLEAN DEFAULT FALSE,
    version_precedente_id INTEGER,
    version_suivante_id INTEGER,
    date_archivage TIMESTAMP,
    
    -- Champs divers
    calc_1 DECIMAL(10,2),
    calc_2 DECIMAL(10,2),
    
    date_creation TIMESTAMP DEFAULT NOW()
);

-- Tâches liées aux processus_cascade
CREATE TABLE IF NOT EXISTS taches_processus (
    id SERIAL PRIMARY KEY,
    processus_id INTEGER REFERENCES processus_cascade(id) ON DELETE CASCADE,
    
    nom VARCHAR(255),
    duree_estimee INTEGER,
    priorite VARCHAR(50),
    ordre INTEGER
);

-- ========================================
-- 5. COLLECTIONS POUR LOGS & AUDIT
-- ========================================

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    collection VARCHAR(100),
    item_id INTEGER,
    field VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    user_id UUID REFERENCES directus_users(id),
    timestamp TIMESTAMP DEFAULT NOW(),
    
    archived BOOLEAN DEFAULT FALSE,
    date_creation TIMESTAMP DEFAULT NOW(),
    action_purge BOOLEAN DEFAULT FALSE
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES directus_users(id),
    type VARCHAR(50),
    titre VARCHAR(255),
    message TEXT,
    lien TEXT,
    date_creation TIMESTAMP DEFAULT NOW(),
    lu BOOLEAN DEFAULT FALSE,
    
    -- Pour logs de cascade
    tache_id INTEGER REFERENCES taches(id),
    projet_id INTEGER REFERENCES projets(id)
);

-- Alertes
CREATE TABLE IF NOT EXISTS alertes (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50), -- echeance_proche, sla_depasse, budget_depasse
    priorite VARCHAR(50),
    message TEXT,
    
    destinataire_id UUID REFERENCES directus_users(id),
    
    -- Relations
    tache_id INTEGER REFERENCES taches(id),
    ticket_id INTEGER,
    document_id INTEGER,
    
    date_creation TIMESTAMP DEFAULT NOW(),
    resolu BOOLEAN DEFAULT FALSE
);

-- ========================================
-- 6. COLLECTIONS POUR VALIDATION & WORKFLOW
-- ========================================

-- Documents (pour workflow de validation)
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    titre VARCHAR(255) NOT NULL,
    contenu TEXT,
    
    statut VARCHAR(50) DEFAULT 'brouillon', -- brouillon, en_validation, valide, rejete, publie
    
    auteur_id UUID REFERENCES directus_users(id),
    valideur_id UUID REFERENCES directus_users(id),
    
    date_creation TIMESTAMP DEFAULT NOW(),
    date_transition TIMESTAMP,
    date_validation TIMESTAMP,
    
    raison_rejet TEXT,
    
    -- Actions
    action_valider BOOLEAN DEFAULT FALSE,
    action_supprimer BOOLEAN DEFAULT FALSE,
    
    erreur_validation TEXT
);

-- Workflow log
CREATE TABLE IF NOT EXISTS workflow_log (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(id),
    statut_precedent VARCHAR(50),
    statut_nouveau VARCHAR(50),
    user_id UUID REFERENCES directus_users(id),
    timestamp TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- 7. COLLECTIONS POUR TICKETS & SLA
-- ========================================

-- Tickets support
CREATE TABLE IF NOT EXISTS tickets_support (
    id SERIAL PRIMARY KEY,
    titre VARCHAR(255) NOT NULL,
    description TEXT,
    
    statut VARCHAR(50) DEFAULT 'nouveau', -- nouveau, en_cours, en_attente, resolu, ferme
    priorite VARCHAR(50) DEFAULT 'normale', -- basse, normale, haute, urgente, critique
    
    source_collection VARCHAR(100),
    source_id INTEGER,
    
    responsable_id UUID REFERENCES directus_users(id),
    
    date_creation TIMESTAMP DEFAULT NOW(),
    date_echeance TIMESTAMP,
    date_resolution TIMESTAMP,
    
    -- SLA
    sla_depasse BOOLEAN DEFAULT FALSE,
    heures_depassement INTEGER,
    
    deleted BOOLEAN DEFAULT FALSE
);

-- ========================================
-- 8. COLLECTIONS POUR CAMPAGNES (TEST CASCADE PROFONDE)
-- ========================================

-- Campagnes (niveau 1)
CREATE TABLE IF NOT EXISTS campagnes (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(255) NOT NULL,
    annee INTEGER,
    periode VARCHAR(50),
    
    dupliquer BOOLEAN DEFAULT FALSE,
    campagne_source_id INTEGER REFERENCES campagnes(id),
    
    date_creation TIMESTAMP DEFAULT NOW(),
    date_duplication TIMESTAMP
);

-- Calendriers (niveau 2)
CREATE TABLE IF NOT EXISTS calendriers (
    id SERIAL PRIMARY KEY,
    campagne_id INTEGER REFERENCES campagnes(id) ON DELETE CASCADE,
    
    nom VARCHAR(255) NOT NULL,
    annee INTEGER,
    periode VARCHAR(50),
    
    date_creation TIMESTAMP DEFAULT NOW()
);

-- Domaines (niveau 3)
CREATE TABLE IF NOT EXISTS domaines (
    id SERIAL PRIMARY KEY,
    calendrier_id INTEGER REFERENCES calendriers(id) ON DELETE CASCADE,
    
    nom VARCHAR(255) NOT NULL,
    description TEXT,
    
    statut_projet VARCHAR(50),
    archive BOOLEAN DEFAULT FALSE,
    
    date_creation TIMESTAMP DEFAULT NOW()
);

-- Processus (niveau 4)
CREATE TABLE IF NOT EXISTS processus_campagne (
    id SERIAL PRIMARY KEY,
    domaine_id INTEGER REFERENCES domaines(id) ON DELETE CASCADE,
    
    nom VARCHAR(255) NOT NULL,
    description TEXT,
    statut VARCHAR(50) DEFAULT 'planifie',
    
    date_creation TIMESTAMP DEFAULT NOW()
);

-- Tâches (niveau 5)
CREATE TABLE IF NOT EXISTS taches_campagne (
    id SERIAL PRIMARY KEY,
    processus_id INTEGER REFERENCES processus_campagne(id) ON DELETE CASCADE,
    
    nom VARCHAR(255) NOT NULL,
    delai INTEGER,
    
    date_creation TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- 9. INDEX POUR PERFORMANCE
-- ========================================

-- Projets
CREATE INDEX idx_projets_statut ON projets(statut);
CREATE INDEX idx_projets_chef ON projets(chef_projet_id);
CREATE INDEX idx_projets_deleted ON projets(deleted);

-- Taches
CREATE INDEX idx_taches_projet ON taches(projet_id);
CREATE INDEX idx_taches_statut ON taches(statut);
CREATE INDEX idx_taches_responsable ON taches(responsable_id);
CREATE INDEX idx_taches_echeance ON taches(date_echeance);

-- Commandes
CREATE INDEX idx_commandes_statut ON commandes(statut);
CREATE INDEX idx_lignes_commande ON lignes_commande(commande_id);

-- Audit
CREATE INDEX idx_audit_collection ON audit_log(collection);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp);

-- Campagnes cascade
CREATE INDEX idx_calendriers_campagne ON calendriers(campagne_id);
CREATE INDEX idx_domaines_calendrier ON domaines(calendrier_id);
CREATE INDEX idx_processus_domaine ON processus_campagne(domaine_id);
CREATE INDEX idx_taches_processus ON taches_campagne(processus_id);

-- ========================================
-- 10. DONNÉES DE TEST
-- ========================================

-- Insérer quelques projets de test
INSERT INTO projets (nom, description, statut, type, priorite, budget_total, date_debut, date_fin)
VALUES 
    ('Projet Alpha', 'Refonte du site web', 'en_cours', 'web', 'haute', 50000.00, '2025-01-15', '2025-06-30'),
    ('Projet Beta', 'Application mobile', 'planifie', 'mobile', 'moyenne', 30000.00, '2025-03-01', '2025-08-31'),
    ('Projet Gamma', 'API REST', 'termine', 'backend', 'basse', 15000.00, '2024-10-01', '2025-01-15');

-- Insérer des tâches
INSERT INTO taches (projet_id, titre, description, statut, priorite, duree_estimee, ordre)
VALUES 
    (1, 'Analyse des besoins', 'Recueil des besoins utilisateurs', 'termine', 'haute', 40, 1),
    (1, 'Maquettage UI', 'Création des maquettes Figma', 'en_cours', 'haute', 60, 2),
    (1, 'Développement Frontend', 'Intégration React', 'a_faire', 'haute', 120, 3),
    (1, 'Tests utilisateurs', 'Tests avec panel utilisateurs', 'a_faire', 'moyenne', 30, 4),
    (2, 'Setup projet mobile', 'Configuration React Native', 'a_faire', 'haute', 20, 1),
    (2, 'Design app', 'Maquettes mobile', 'a_faire', 'moyenne', 40, 2);

-- Insérer des produits
INSERT INTO produits (nom, description, prix)
VALUES 
    ('Produit A', 'Description A', 29.99),
    ('Produit B', 'Description B', 49.99),
    ('Produit C', 'Description C', 19.99);

-- Insérer des commandes
INSERT INTO commandes (numero, client_nom, client_email, statut)
VALUES 
    ('CMD-2025-001', 'Jean Dupont', 'jean@example.com', 'confirmee'),
    ('CMD-2025-002', 'Marie Martin', 'marie@example.com', 'brouillon');

-- Insérer des lignes de commande
INSERT INTO lignes_commande (commande_id, produit_id, designation, quantite, prix_unitaire)
VALUES 
    (1, 1, 'Produit A', 2, 29.99),
    (1, 2, 'Produit B', 1, 49.99),
    (2, 3, 'Produit C', 3, 19.99);

-- Insérer une campagne de test pour duplication
INSERT INTO campagnes (nom, annee, periode)
VALUES ('Campagne Test 2025', 2025, 'Q1');

INSERT INTO calendriers (campagne_id, nom, annee)
VALUES (1, 'Calendrier Principal', 2025);

INSERT INTO domaines (calendrier_id, nom)
VALUES (1, 'Domaine Finance'), (1, 'Domaine RH');

INSERT INTO processus_campagne (domaine_id, nom, description)
VALUES 
    (1, 'Clôture mensuelle', 'Processus de clôture comptable'),
    (1, 'Budget annuel', 'Préparation budget'),
    (2, 'Recrutement', 'Process de recrutement');

INSERT INTO taches_campagne (processus_id, nom, delai)
VALUES 
    (1, 'Rapprochement bancaire', 5),
    (1, 'Validation comptes', 10),
    (2, 'Collecte besoins', 15),
    (3, 'Publication offre', 7);

-- ========================================
-- RÉSUMÉ DES COLLECTIONS CRÉÉES
-- ========================================

/*
📊 COLLECTIONS CRÉÉES (25 au total):

1. ✅ projets - Parent principal pour tests basiques
2. ✅ taches - Enfants M2O pour cascade et agrégation
3. ✅ sous_processus - Niveau intermédiaire
4. ✅ projet_membres - Junction M2M
5. ✅ tags - Pour tests M2M
6. ✅ produits - Pour M2M et agrégations
7. ✅ produit_tags - Junction M2M
8. ✅ avis_produit - Pour calculs moyenne
9. ✅ commandes - Pour agrégations
10. ✅ lignes_commande - Enfants pour calcul totaux
11. ✅ processus_cascade - Pour duplication avec archivage
12. ✅ taches_processus - Enfants de processus
13. ✅ audit_log - Pour logs et purge
14. ✅ notifications - Pour notifications automatiques
15. ✅ alertes - Pour alertes SLA/budget
16. ✅ documents - Pour workflow validation
17. ✅ workflow_log - Historique workflow
18. ✅ tickets_support - Pour SLA et escalades
19. ✅ campagnes - Niveau 1 cascade profonde
20. ✅ calendriers - Niveau 2
21. ✅ domaines - Niveau 3
22. ✅ processus_campagne - Niveau 4
23. ✅ taches_campagne - Niveau 5

🎯 SCÉNARIOS COUVERTS:
- Modification item courant
- Cascade M2O (parents/enfants)
- Cascade multi-niveaux (jusqu'à 5 niveaux)
- Relations M2M
- Agrégations (SUM, AVG, COUNT)
- Duplication avec assign
- Soft delete
- Validation et contrôles
- Workflow multi-étapes
- Alertes et SLA
- Logs et audit

💡 UTILISATION:
psql -U directus -d directus < setup-automation-test-collections.sql
*/
