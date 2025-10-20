# Security Fix: UUID-Only for Automation Identification

## What Changed

We removed the `automation_name` parameter from the `/quartz-automations/run` endpoint to prevent production issues.

## Why This Change?

Using automation names instead of UUIDs creates serious risks:

1. **Name Collisions**: Multiple automations could have similar names, causing the wrong one to execute
2. **Silent Breakage**: Renaming an automation in Directus Studio breaks all CRON Flows without warning
3. **Log Ambiguity**: When debugging, "Automation X failed" could match multiple automations across environments

## What You Need to Do

### Before (UNSAFE ❌)
```json
{
  "automation_name": "Purge logs anciens",
  "filter": { ... }
}
```

### After (SAFE ✅)
```json
{
  "automation_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "filter": { ... }
}
```

## How to Get the UUID

### Method 1: Directus Studio
1. Open your Directus admin interface
2. Navigate to Content → `quartz_automations`
3. Click on the automation you want to use
4. Copy the **ID** field (it's a UUID)

### Method 2: Helper Script
Run this command to list all automations with their UUIDs:

```powershell
$env:DIRECTUS_TOKEN="your-token-here"
node tests/list-automations.mjs
```

Output:
```
✅ ACTIVE Automations:

1. Alertes tâches en retard
   UUID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
   Collection: taches

2. Purge logs anciens
   UUID: f9e8d7c6-b5a4-3210-9876-543210fedcba
   Collection: audit_log
```

## Updated Files

- **automations/src/endpoint.js**: Removed `automation_name` parameter, enforces `automation_id` (UUID) only
- **automations/docs/CRON_USAGE.md**: All examples now use `automation_id` with UUID placeholders
- **tests/test-run-endpoint-v2.mjs**: New test script that lists automations and uses UUIDs
- **tests/list-automations.mjs**: Helper script to discover automation UUIDs

## Migration Guide

If you have existing CRON Flows using `automation_name`:

1. Run `node tests/list-automations.mjs` to get the UUID of your automation
2. Open your Flow in Directus Studio
3. Edit the Webhook operation
4. Replace `"automation_name": "My Automation"` with `"automation_id": "uuid-from-step-1"`
5. Save the Flow

## Testing

To test the endpoint with the new UUID-only approach:

```powershell
$env:DIRECTUS_TOKEN="your-token-here"
node tests/test-run-endpoint-v2.mjs
```

This will:
- List all available automations with UUIDs
- Select the first active one
- Run it in dry-run mode
- Execute it for real
- Verify the results

## Error Messages

If you forget to provide `automation_id`, you'll get a clear error:

```json
{
  "ok": false,
  "error": "automation_id (UUID) is required. Do not use automation names to avoid production issues."
}
```

## Best Practice

Always store automation UUIDs in your deployment configuration, not names. For example:

```javascript
// config/cron-automations.js
module.exports = {
  DAILY_ALERTS: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  WEEKLY_PURGE: 'f9e8d7c6-b5a4-3210-9876-543210fedcba',
  MONTHLY_REPORT: '12345678-90ab-cdef-1234-567890abcdef'
};
```

Then in your CRON Flow:
```json
{
  "automation_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "context": { "$TRIGGER": "cron_daily" }
}
```

## Questions?

See the updated documentation:
- [CRON_USAGE.md](../automations/docs/CRON_USAGE.md) - Complete CRON guide with UUID examples
- [COMMON_USECASES.md](../automations/docs/COMMON_USECASES.md) - Automation examples

---

**Bottom line**: UUIDs are immutable and unique. Names are mutable and ambiguous. Use UUIDs in production.
