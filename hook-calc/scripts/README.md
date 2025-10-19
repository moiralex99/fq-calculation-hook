# Recalculate a Collection (CLI)

Small helper to trigger recalculation by touching items in a collection. It uses the standard Directus REST API and the realtime-calc hook (post-commit) will do the actual compute.

- Script: `scripts/recalc-collection.mjs`
- Requirements: Node 18+ (fetch available globally)
- Auth: pass a Directus user token via CLI or env var

## Usage (Windows PowerShell)

- Minimal (default URL `http://localhost:8055`):

```powershell
node scripts/recalc-collection.mjs collection=test_calculs
```

- With server URL and token:

```powershell
$token = "<YOUR_TOKEN>"
node scripts/recalc-collection.mjs collection=test_calculs url=http://localhost:8055 token=$token
```

- With batch size (1..500) to control page size when scanning items:

```powershell
node scripts/recalc-collection.mjs collection=test_calculs batch=500
```

- With filter (JSON) to limit which items to touch:

Note: In PowerShell, wrap JSON in single quotes to avoid escaping quotes.

```powershell
node scripts/recalc-collection.mjs collection=test_calculs filter='{"status":{"_eq":"open"}}'
```

- Combine options:

```powershell
$token = "<YOUR_TOKEN>"
node scripts/recalc-collection.mjs collection=test_calculs url=http://localhost:8055 token=$token batch=300 filter='{"archived":{"_neq":true}}'
```

### Exemple ciblé: recalculer uniquement les items publiés

Recalcule seulement les éléments de `test_calculs` dont le champ `status` est `published`:

```powershell
$token = "<YOUR_TOKEN>"
node scripts/recalc-collection.mjs collection=test_calculs url=http://localhost:8055 token=$token batch=300 filter='{"status":{"_eq":"published"}}'
```

## Parameters

- `collection` (required): target collection name
- `url` (optional): Directus base URL (default `http://localhost:8055`)
- `token` (optional): Directus user token; can also use env var `DIRECTUS_TOKEN`
- `batch` (optional): page size while reading items (1..500, default 200)
- `filter` (optional): Directus filter object in JSON

## How it works

- The script pages through `/items/<collection>` using `limit` + `offset` and optional `filter`
- For each item, it sends a no-op `PATCH` `{}` to `/items/<collection>/<id>`
- The realtime-calc hook listens to post-commit updates and recalculates dependent fields

## Tips

- If you see 401/403 errors, confirm the token has `read` and `update` permissions on the target collection
- If your primary key field isn't `id`, the script also tries `primary_key` and `uuid`
- Watch Directus logs while running to track recalculation progress

## Related

If you prefer using the endpoint actions directly (when available):
- GET  `<base>/realtime-calc/status`
- POST `<base>/realtime-calc/reload`
- POST `<base>/realtime-calc/recalculate` with body `{ "collection": "...", "filter": null, "batchSize": 100, "dryRun": false }`

Where `<base>` is your endpoint mount path, eg: `http://localhost:8055/directus-endpoint-realtime-calc-utils`.

token to test in directus test OHJ4HEV2RG-WwmdNpC2h3PKa1ujLZO5C