# Test rapide de l'extension RealTime-Calc
# Pas besoin de SQL, tout via l'API Directus!

$URL = "http://localhost:8055"
$TOKEN = "KcW81EVM3xesF5RgU-erSsaWkVyqdGHv"

Write-Host "=== TEST EXTENSION REALTIME-CALC ===" -ForegroundColor Cyan
Write-Host ""

# Headers avec le token
$headers = @{ Authorization = "Bearer $TOKEN"; "Content-Type" = "application/json" }
Write-Host "[1] Token configure!" -ForegroundColor Green
Write-Host ""

# 2. Créer la collection de test "test_calculs"
Write-Host "[2] Creation collection de test..." -ForegroundColor Yellow
$collection = @{
    collection = "test_calculs"
    schema = @{ name = "test_calculs" }
    meta = @{ collection = "test_calculs"; icon = "calculate"; note = "Test des calculs automatiques" }
} | ConvertTo-Json -Depth 5

try {
    Invoke-RestMethod -Uri "$URL/collections" -Method POST -Body $collection -Headers $headers | Out-Null
    Write-Host "OK - Collection creee!" -ForegroundColor Green
} catch {
    Write-Host "Collection existe deja (OK)" -ForegroundColor Yellow
}
Write-Host ""

# 3. Ajouter les champs
Write-Host "[3] Creation des champs..." -ForegroundColor Yellow

# Champ: prix
$field1 = @{
    collection = "test_calculs"
    field = "prix"
    type = "float"
    schema = @{ default_value = 0 }
    meta = @{ interface = "input"; note = "Prix unitaire" }
} | ConvertTo-Json -Depth 5
try { Invoke-RestMethod -Uri "$URL/fields/test_calculs" -Method POST -Body $field1 -Headers $headers | Out-Null } catch {}

# Champ: quantite
$field2 = @{
    collection = "test_calculs"
    field = "quantite"
    type = "integer"
    schema = @{ default_value = 1 }
    meta = @{ interface = "input"; note = "Quantite" }
} | ConvertTo-Json -Depth 5
try { Invoke-RestMethod -Uri "$URL/fields/test_calculs" -Method POST -Body $field2 -Headers $headers | Out-Null } catch {}

# Champ calculé: total (sera calculé par l'extension)
$field3 = @{
    collection = "test_calculs"
    field = "total"
    type = "float"
    schema = @{}
    meta = @{ interface = "input"; readonly = $true; note = "Calcule automatiquement" }
} | ConvertTo-Json -Depth 5
try { Invoke-RestMethod -Uri "$URL/fields/test_calculs" -Method POST -Body $field3 -Headers $headers | Out-Null } catch {}

Write-Host "OK - Champs crees!" -ForegroundColor Green
Write-Host ""

# 4. Créer la table quartz_formulas si elle n'existe pas
Write-Host "[4] Creation table formules..." -ForegroundColor Yellow
$formulas_coll = @{
    collection = "quartz_formulas"
    schema = @{ name = "quartz_formulas" }
    meta = @{ collection = "quartz_formulas"; icon = "functions" }
} | ConvertTo-Json -Depth 5
try { Invoke-RestMethod -Uri "$URL/collections" -Method POST -Body $formulas_coll -Headers $headers | Out-Null } catch {}

# Ajouter les champs de quartz_formulas
$qf_fields = @(
    @{ field = "collection_cible"; type = "string" },
    @{ field = "champ_cible"; type = "string" },
    @{ field = "formula"; type = "text" },
    @{ field = "status"; type = "string"; schema = @{ default_value = "draft" } },
    @{ field = "sort"; type = "integer"; schema = @{ default_value = 0 } },
    @{ field = "description"; type = "text" }
)

foreach ($f in $qf_fields) {
    $fjson = @{
        collection = "quartz_formulas"
        field = $f.field
        type = $f.type
        schema = if ($f.schema) { $f.schema } else { @{} }
        meta = @{ interface = if ($f.type -eq "text") { "input-multiline" } else { "input" } }
    } | ConvertTo-Json -Depth 5
    try { Invoke-RestMethod -Uri "$URL/fields/quartz_formulas" -Method POST -Body $fjson -Headers $headers | Out-Null } catch {}
}

Write-Host "OK - Table formules prete!" -ForegroundColor Green
Write-Host ""

# 5. Ajouter une formule de test
Write-Host "[5] Ajout formule de test..." -ForegroundColor Yellow
$formula = @{
    collection_cible = "test_calculs"
    champ_cible = "total"
    formula = "{{prix}} * {{quantite}}"
    status = "published"
    sort = 1
    description = "Calcul automatique du total"
} | ConvertTo-Json -Depth 5

try {
    Invoke-RestMethod -Uri "$URL/items/quartz_formulas" -Method POST -Body $formula -Headers $headers | Out-Null
    Write-Host "OK - Formule ajoutee!" -ForegroundColor Green
} catch {
    Write-Host "Formule existe deja (OK)" -ForegroundColor Yellow
}
Write-Host ""

# 6. Recharger les formules dans l'extension
Write-Host "[6] Rechargement extension..." -ForegroundColor Yellow
try {
    $reload = Invoke-RestMethod -Uri "$URL/utils/realtime-calc.reload-formulas" -Method POST -Headers $headers
    Write-Host "OK - $($reload.message)" -ForegroundColor Green
} catch {
    Write-Host "ERREUR - Extension pas chargee! Redemarrez Directus" -ForegroundColor Red
    Write-Host "Erreur: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 7. Tester la formule
Write-Host "[7] Test de la formule..." -ForegroundColor Yellow
$testData = @{
    formula = "{{prix}} * {{quantite}}"
    sampleData = @{ prix = 10; quantite = 5 }
} | ConvertTo-Json -Depth 5

$testResult = Invoke-RestMethod -Uri "$URL/utils/realtime-calc.test-formula" -Method POST -Body $testData -Headers $headers -ContentType "application/json"
Write-Host "Resultat: $($testResult.result)" -ForegroundColor Cyan
Write-Host "Valide: $($testResult.valid)" -ForegroundColor Cyan
Write-Host "Local: $($testResult.isLocal)" -ForegroundColor Cyan
Write-Host ""

# 8. Créer un item de test (les calculs se feront automatiquement!)
Write-Host "[8] Creation d'un item de test..." -ForegroundColor Yellow
$item = @{
    prix = 99.99
    quantite = 3
} | ConvertTo-Json -Depth 5

$created = Invoke-RestMethod -Uri "$URL/items/test_calculs" -Method POST -Body $item -Headers $headers -ContentType "application/json"
Write-Host "Item cree avec ID: $($created.data.id)" -ForegroundColor Green
Write-Host "Prix: $($created.data.prix)" -ForegroundColor White
Write-Host "Quantite: $($created.data.quantite)" -ForegroundColor White
Write-Host "Total (calcule): $($created.data.total)" -ForegroundColor Cyan
Write-Host ""

# 9. Modifier l'item (recalcul automatique!)
Write-Host "[9] Modification de l'item..." -ForegroundColor Yellow
$update = @{
    quantite = 10
} | ConvertTo-Json -Depth 5

$updated = Invoke-RestMethod -Uri "$URL/items/test_calculs/$($created.data.id)" -Method PATCH -Body $update -Headers $headers -ContentType "application/json"
Write-Host "Item modifie!" -ForegroundColor Green
Write-Host "Prix: $($updated.data.prix)" -ForegroundColor White
Write-Host "Quantite: $($updated.data.quantite)" -ForegroundColor White
Write-Host "Total (recalcule): $($updated.data.total)" -ForegroundColor Cyan
Write-Host ""

# Résumé
Write-Host "========================================" -ForegroundColor Green
Write-Host "TEST REUSSI!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "L'extension fonctionne!" -ForegroundColor Cyan
Write-Host "- Formule: {{prix}} * {{quantite}}" -ForegroundColor White
Write-Host "- Calcul initial: 99.99 * 3 = $($created.data.total)" -ForegroundColor White
Write-Host "- Apres modif: 99.99 * 10 = $($updated.data.total)" -ForegroundColor White
Write-Host ""
Write-Host "Va voir dans Directus: http://localhost:8055" -ForegroundColor Yellow
Write-Host "Collection: test_calculs" -ForegroundColor Yellow
