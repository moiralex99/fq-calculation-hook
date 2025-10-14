# Script simple pour configurer Directus
# Encodage: UTF-8 sans BOM

$DIRECTUS_URL = "http://localhost:8055"
$EMAIL = "admin@example.com"
$PASSWORD = "password123"

Write-Host "=== Configuration Directus RealTime-Calc ===" -ForegroundColor Cyan

# Authentification
Write-Host "[1/7] Connexion..." -ForegroundColor Yellow
$auth = @{ email = $EMAIL; password = $PASSWORD } | ConvertTo-Json
$response = Invoke-RestMethod -Uri "$DIRECTUS_URL/auth/login" -Method POST -Body $auth -ContentType "application/json"
$token = $response.data.access_token
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }
Write-Host "OK - Token obtenu" -ForegroundColor Green

# Créer quartz_formulas
Write-Host "[2/7] Creation collection quartz_formulas..." -ForegroundColor Yellow
$coll1 = @{
    collection = "quartz_formulas"
    schema = @{ name = "quartz_formulas" }
    meta = @{ collection = "quartz_formulas"; icon = "functions" }
} | ConvertTo-Json -Depth 5
try { Invoke-RestMethod -Uri "$DIRECTUS_URL/collections" -Method POST -Body $coll1 -Headers $headers | Out-Null; Write-Host "OK" -ForegroundColor Green } catch { Write-Host "Existe deja" -ForegroundColor Yellow }

# Créer produits
Write-Host "[3/7] Creation collection produits..." -ForegroundColor Yellow
$coll2 = @{
    collection = "produits"
    schema = @{ name = "produits" }
    meta = @{ collection = "produits"; icon = "inventory_2" }
} | ConvertTo-Json -Depth 5
try { Invoke-RestMethod -Uri "$DIRECTUS_URL/collections" -Method POST -Body $coll2 -Headers $headers | Out-Null; Write-Host "OK" -ForegroundColor Green } catch { Write-Host "Existe deja" -ForegroundColor Yellow }

# Créer commandes
Write-Host "[4/7] Creation collection commandes..." -ForegroundColor Yellow
$coll3 = @{
    collection = "commandes"
    schema = @{ name = "commandes" }
    meta = @{ collection = "commandes"; icon = "shopping_cart" }
} | ConvertTo-Json -Depth 5
try { Invoke-RestMethod -Uri "$DIRECTUS_URL/collections" -Method POST -Body $coll3 -Headers $headers | Out-Null; Write-Host "OK" -ForegroundColor Green } catch { Write-Host "Existe deja" -ForegroundColor Yellow }

Write-Host ""
Write-Host "Collections creees! Maintenant executez le SQL pour les champs et donnees:" -ForegroundColor Cyan
Write-Host "  demo-setup.sql" -ForegroundColor White
Write-Host ""
Write-Host "Puis redemarrez Directus pour charger l'extension!" -ForegroundColor Yellow
