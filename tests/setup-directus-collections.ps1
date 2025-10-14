# Script PowerShell pour créer les collections dans Directus via l'API
# Usage: .\setup-directus-collections.ps1

$DIRECTUS_URL = "http://localhost:8055"
$DIRECTUS_EMAIL = "admin@example.com"
$DIRECTUS_PASSWORD = "password123"

Write-Host "Configuration de Directus pour l'extension RealTime-Calc" -ForegroundColor Cyan
Write-Host ""

# 1. Authentification
Write-Host "Connexion a Directus..." -ForegroundColor Yellow
$authBody = @{
    email = $DIRECTUS_EMAIL
    password = $DIRECTUS_PASSWORD
} | ConvertTo-Json

try {
    $authResponse = Invoke-RestMethod -Uri "$DIRECTUS_URL/auth/login" -Method POST -Body $authBody -ContentType "application/json"
    $token = $authResponse.data.access_token
    Write-Host "Connecte avec succes!" -ForegroundColor Green
} catch {
    Write-Host "Erreur de connexion: $_" -ForegroundColor Red
    exit 1
}

$headers = @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
}

# 2. Créer la collection quartz_formulas
Write-Host ""
Write-Host "Creation de la collection 'quartz_formulas'..." -ForegroundColor Yellow

$quartzFormulasCollection = @{
    collection = "quartz_formulas"
    meta = @{
        collection = "quartz_formulas"
        icon = "functions"
        note = "Configuration des formules pour l'extension RealTime-Calc"
        display_template = "{{collection_cible}}.{{champ_cible}}"
        hidden = $false
        singleton = $false
        translations = $null
        archive_field = $null
        archive_app_filter = $true
        archive_value = $null
        unarchive_value = $null
        sort_field = "sort"
    }
    schema = @{
        name = "quartz_formulas"
    }
    fields = @(
        @{
            field = "id"
            type = "integer"
            schema = @{ is_primary_key = $true; has_auto_increment = $true }
            meta = @{ hidden = $true; readonly = $true }
        },
        @{
            field = "collection_cible"
            type = "string"
            schema = @{ is_nullable = $false; max_length = 255 }
            meta = @{ interface = "input"; width = "half"; required = $true; note = "Nom de la collection cible (ex: factures)" }
        },
        @{
            field = "champ_cible"
            type = "string"
            schema = @{ is_nullable = $false; max_length = 255 }
            meta = @{ interface = "input"; width = "half"; required = $true; note = "Nom du champ à calculer" }
        },
        @{
            field = "formula"
            type = "text"
            schema = @{ is_nullable = $false }
            meta = @{ interface = "input-code"; options = @{ language = "plaintext" }; required = $true; note = "Formule DSL (ex: {{prix}} * {{quantite}})" }
        },
        @{
            field = "status"
            type = "string"
            schema = @{ default_value = "draft"; max_length = 50 }
            meta = @{ 
                interface = "select-dropdown"
                options = @{
                    choices = @(
                        @{ text = "Brouillon"; value = "draft" }
                        @{ text = "Publié"; value = "published" }
                        @{ text = "Archivé"; value = "archived" }
                    )
                }
                width = "half"
            }
        },
        @{
            field = "sort"
            type = "integer"
            schema = @{ default_value = 0 }
            meta = @{ interface = "input"; width = "half"; note = "Ordre d'exécution" }
        },
        @{
            field = "description"
            type = "text"
            meta = @{ interface = "input-multiline"; note = "Description de la formule" }
        },
        @{
            field = "date_created"
            type = "timestamp"
            meta = @{ interface = "datetime"; readonly = $true; hidden = $true; special = @("date-created") }
        },
        @{
            field = "date_updated"
            type = "timestamp"
            meta = @{ interface = "datetime"; readonly = $true; hidden = $true; special = @("date-updated") }
        }
    )
} | ConvertTo-Json -Depth 10

try {
    Invoke-RestMethod -Uri "$DIRECTUS_URL/collections" -Method POST -Body $quartzFormulasCollection -Headers $headers | Out-Null
    Write-Host "Collection 'quartz_formulas' creee!" -ForegroundColor Green
} catch {
    Write-Host "Collection 'quartz_formulas' existe deja ou erreur: $_" -ForegroundColor Yellow
}

# 3. Créer la collection produits
Write-Host ""
Write-Host "Creation de la collection 'produits'..." -ForegroundColor Yellow

$produitsCollection = @{
    collection = "produits"
    meta = @{
        collection = "produits"
        icon = "inventory_2"
        note = "Gestion des produits avec calculs automatiques"
        display_template = "{{nom}}"
        hidden = $false
        singleton = $false
    }
    schema = @{ name = "produits" }
    fields = @(
        @{ field = "id"; type = "integer"; schema = @{ is_primary_key = $true; has_auto_increment = $true }; meta = @{ hidden = $true } },
        @{ field = "nom"; type = "string"; schema = @{ is_nullable = $false; max_length = 255 }; meta = @{ interface = "input"; required = $true; width = "full" } },
        @{ field = "prix_unitaire"; type = "decimal"; schema = @{ numeric_precision = 10; numeric_scale = 2; default_value = 0 }; meta = @{ interface = "input"; width = "half"; note = "Prix HT" } },
        @{ field = "quantite_stock"; type = "integer"; schema = @{ default_value = 0 }; meta = @{ interface = "input"; width = "half" } },
        @{ field = "seuil_alerte"; type = "integer"; schema = @{ default_value = 10 }; meta = @{ interface = "input"; width = "half"; note = "Seuil d'alerte stock" } },
        @{ field = "taux_tva"; type = "decimal"; schema = @{ numeric_precision = 5; numeric_scale = 2; default_value = 20 }; meta = @{ interface = "input"; width = "half"; note = "Taux TVA en %" } },
        @{ field = "valeur_stock"; type = "decimal"; schema = @{ numeric_precision = 10; numeric_scale = 2 }; meta = @{ interface = "input"; readonly = $true; note = "🤖 Calculé automatiquement" } },
        @{ field = "statut_stock"; type = "string"; schema = @{ max_length = 50 }; meta = @{ interface = "input"; readonly = $true; note = "🤖 Calculé automatiquement" } },
        @{ field = "prix_ttc"; type = "decimal"; schema = @{ numeric_precision = 10; numeric_scale = 2 }; meta = @{ interface = "input"; readonly = $true; note = "🤖 Calculé automatiquement" } },
        @{ field = "date_created"; type = "timestamp"; meta = @{ interface = "datetime"; readonly = $true; hidden = $true; special = @("date-created") } },
        @{ field = "date_updated"; type = "timestamp"; meta = @{ interface = "datetime"; readonly = $true; hidden = $true; special = @("date-updated") } }
    )
} | ConvertTo-Json -Depth 10

try {
    Invoke-RestMethod -Uri "$DIRECTUS_URL/collections" -Method POST -Body $produitsCollection -Headers $headers | Out-Null
    Write-Host "✅ Collection 'produits' créée!" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Collection 'produits' existe déjà ou erreur: $_" -ForegroundColor Yellow
}

# 4. Créer la collection commandes
Write-Host ""
Write-Host "📦 Création de la collection 'commandes'..." -ForegroundColor Yellow

$commandesCollection = @{
    collection = "commandes"
    meta = @{
        collection = "commandes"
        icon = "shopping_cart"
        note = "Commandes avec calculs automatiques de remise et TVA"
        display_template = "{{client_nom}} - {{total_ttc}}€"
        hidden = $false
        singleton = $false
    }
    schema = @{ name = "commandes" }
    fields = @(
        @{ field = "id"; type = "integer"; schema = @{ is_primary_key = $true; has_auto_increment = $true }; meta = @{ hidden = $true } },
        @{ field = "client_nom"; type = "string"; schema = @{ max_length = 255 }; meta = @{ interface = "input"; width = "full" } },
        @{ field = "quantite"; type = "integer"; schema = @{ default_value = 1 }; meta = @{ interface = "input"; width = "half" } },
        @{ field = "prix_unitaire"; type = "decimal"; schema = @{ numeric_precision = 10; numeric_scale = 2; default_value = 0 }; meta = @{ interface = "input"; width = "half" } },
        @{ field = "code_promo"; type = "string"; schema = @{ max_length = 50 }; meta = @{ interface = "input"; width = "half"; note = "VIP20 pour 20% de remise" } },
        @{ field = "montant_brut"; type = "decimal"; schema = @{ numeric_precision = 10; numeric_scale = 2 }; meta = @{ interface = "input"; readonly = $true; note = "🤖 Calculé" } },
        @{ field = "remise_pourcent"; type = "decimal"; schema = @{ numeric_precision = 5; numeric_scale = 2 }; meta = @{ interface = "input"; readonly = $true; note = "🤖 Calculé" } },
        @{ field = "montant_remise"; type = "decimal"; schema = @{ numeric_precision = 10; numeric_scale = 2 }; meta = @{ interface = "input"; readonly = $true; note = "🤖 Calculé" } },
        @{ field = "montant_net"; type = "decimal"; schema = @{ numeric_precision = 10; numeric_scale = 2 }; meta = @{ interface = "input"; readonly = $true; note = "🤖 Calculé" } },
        @{ field = "montant_tva"; type = "decimal"; schema = @{ numeric_precision = 10; numeric_scale = 2 }; meta = @{ interface = "input"; readonly = $true; note = "🤖 Calculé" } },
        @{ field = "total_ttc"; type = "decimal"; schema = @{ numeric_precision = 10; numeric_scale = 2 }; meta = @{ interface = "input"; readonly = $true; note = "🤖 Calculé" } },
        @{ field = "date_created"; type = "timestamp"; meta = @{ interface = "datetime"; readonly = $true; hidden = $true; special = @("date-created") } },
        @{ field = "date_updated"; type = "timestamp"; meta = @{ interface = "datetime"; readonly = $true; hidden = $true; special = @("date-updated") } }
    )
} | ConvertTo-Json -Depth 10

try {
    Invoke-RestMethod -Uri "$DIRECTUS_URL/collections" -Method POST -Body $commandesCollection -Headers $headers | Out-Null
    Write-Host "✅ Collection 'commandes' créée!" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Collection 'commandes' existe déjà ou erreur: $_" -ForegroundColor Yellow
}

# 5. Insérer les formules dans quartz_formulas
Write-Host ""
Write-Host "📝 Insertion des formules de test..." -ForegroundColor Yellow

$formulas = @(
    # Produits
    @{ collection_cible = "produits"; champ_cible = "valeur_stock"; formula = "ROUND({{prix_unitaire}} * {{quantite_stock}}, 2)"; status = "published"; sort = 1; description = "Valeur totale du stock" },
    @{ collection_cible = "produits"; champ_cible = "statut_stock"; formula = 'IF({{quantite_stock}} < {{seuil_alerte}}, "🔴 Rupture", IF({{quantite_stock}} < {{seuil_alerte}} * 2, "🟡 Faible", "🟢 OK"))'; status = "published"; sort = 2; description = "Statut visuel du stock" },
    @{ collection_cible = "produits"; champ_cible = "prix_ttc"; formula = "ROUND({{prix_unitaire}} * (1 + {{taux_tva}} / 100), 2)"; status = "published"; sort = 3; description = "Prix TTC avec TVA" },
    
    # Commandes
    @{ collection_cible = "commandes"; champ_cible = "montant_brut"; formula = "ROUND({{quantite}} * {{prix_unitaire}}, 2)"; status = "published"; sort = 1; description = "Montant avant remise" },
    @{ collection_cible = "commandes"; champ_cible = "remise_pourcent"; formula = 'IF({{code_promo}} = "VIP20", 20, IF({{montant_brut}} > 1000, 15, IF({{montant_brut}} > 500, 10, 5)))'; status = "published"; sort = 2; description = "Remise selon code promo et montant" },
    @{ collection_cible = "commandes"; champ_cible = "montant_remise"; formula = "ROUND({{montant_brut}} * {{remise_pourcent}} / 100, 2)"; status = "published"; sort = 3; description = "Montant de la remise" },
    @{ collection_cible = "commandes"; champ_cible = "montant_net"; formula = "ROUND({{montant_brut}} - {{montant_remise}}, 2)"; status = "published"; sort = 4; description = "Montant après remise" },
    @{ collection_cible = "commandes"; champ_cible = "montant_tva"; formula = "ROUND({{montant_net}} * 0.2, 2)"; status = "published"; sort = 5; description = "TVA à 20%" },
    @{ collection_cible = "commandes"; champ_cible = "total_ttc"; formula = "ROUND({{montant_net}} + {{montant_tva}}, 2)"; status = "published"; sort = 6; description = "Total TTC final" }
)

$successCount = 0
foreach ($formula in $formulas) {
    try {
        $formulaJson = $formula | ConvertTo-Json -Depth 5
        Invoke-RestMethod -Uri "$DIRECTUS_URL/items/quartz_formulas" -Method POST -Body $formulaJson -Headers $headers | Out-Null
        $successCount++
    } catch {
        # Ignore si déjà existe
    }
}
Write-Host "✅ $successCount formules insérées!" -ForegroundColor Green

# 6. Insérer des données de test dans produits
Write-Host ""
Write-Host "📦 Insertion de produits de test..." -ForegroundColor Yellow

$produits = @(
    @{ nom = "Laptop Dell XPS"; prix_unitaire = 999.99; quantite_stock = 15; seuil_alerte = 5; taux_tva = 20 },
    @{ nom = "Souris Logitech"; prix_unitaire = 29.99; quantite_stock = 3; seuil_alerte = 10; taux_tva = 20 },
    @{ nom = "Clavier Mécanique"; prix_unitaire = 89.99; quantite_stock = 25; seuil_alerte = 8; taux_tva = 20 },
    @{ nom = "Écran 27 pouces 4K"; prix_unitaire = 449.99; quantite_stock = 8; seuil_alerte = 5; taux_tva = 20 },
    @{ nom = "Webcam HD"; prix_unitaire = 59.99; quantite_stock = 2; seuil_alerte = 10; taux_tva = 20 }
)

$successCount = 0
foreach ($produit in $produits) {
    try {
        $produitJson = $produit | ConvertTo-Json -Depth 5
        Invoke-RestMethod -Uri "$DIRECTUS_URL/items/produits" -Method POST -Body $produitJson -Headers $headers | Out-Null
        $successCount++
    } catch {
        # Ignore si déjà existe
    }
}
Write-Host "✅ $successCount produits insérés!" -ForegroundColor Green

# 7. Insérer des données de test dans commandes
Write-Host ""
Write-Host "📦 Insertion de commandes de test..." -ForegroundColor Yellow

$commandes = @(
    @{ client_nom = "Jean Dupont"; quantite = 2; prix_unitaire = 999.99; code_promo = $null },
    @{ client_nom = "Marie Martin"; quantite = 1; prix_unitaire = 449.99; code_promo = "VIP20" },
    @{ client_nom = "Paul Durant"; quantite = 5; prix_unitaire = 89.99; code_promo = $null },
    @{ client_nom = "Sophie Bernard"; quantite = 3; prix_unitaire = 29.99; code_promo = $null },
    @{ client_nom = "Luc Thomas"; quantite = 10; prix_unitaire = 59.99; code_promo = "VIP20" }
)

$successCount = 0
foreach ($commande in $commandes) {
    try {
        $commandeJson = $commande | ConvertTo-Json -Depth 5
        Invoke-RestMethod -Uri "$DIRECTUS_URL/items/commandes" -Method POST -Body $commandeJson -Headers $headers | Out-Null
        $successCount++
    } catch {
        # Ignore si déjà existe
    }
}
Write-Host "✅ $successCount commandes insérées!" -ForegroundColor Green

# 8. Recharger les formules dans l'extension
Write-Host ""
Write-Host "🔄 Rechargement des formules dans l'extension..." -ForegroundColor Yellow
try {
    $reloadResponse = Invoke-RestMethod -Uri "$DIRECTUS_URL/utils/realtime-calc.reload-formulas" -Method POST -Headers $headers
    Write-Host "✅ $($reloadResponse.message)" -ForegroundColor Green
} catch {
    Write-Host "⚠️  L'extension n'est peut-être pas encore chargée. Redémarrez Directus." -ForegroundColor Yellow
}

# 9. Résumé
Write-Host ""
Write-Host "Configuration terminee!" -ForegroundColor Green
Write-Host ""
Write-Host "Collections creees:" -ForegroundColor Cyan
Write-Host "  - quartz_formulas (9 formules)" -ForegroundColor White
Write-Host "  - produits (5 produits avec calculs auto)" -ForegroundColor White
Write-Host "  - commandes (5 commandes avec calculs auto)" -ForegroundColor White
Write-Host ""
Write-Host "Accedez a Directus:" -ForegroundColor Cyan
Write-Host "  URL: http://localhost:8055" -ForegroundColor White
Write-Host "  Email: admin@example.com" -ForegroundColor White
Write-Host "  Mot de passe: password123" -ForegroundColor White
Write-Host ""
Write-Host "Testez en creant un nouveau produit ou une commande!" -ForegroundColor Yellow
Write-Host "Les champs calcules seront remplis automatiquement!" -ForegroundColor Yellow
