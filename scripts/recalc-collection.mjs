// Manual recalculation helper (no external deps)
// Touch items in a collection to trigger the realtime-calc hook post-commit.
// Usage examples (PowerShell):
//   node scripts/recalc-collection.mjs collection=test_calculs
//   node scripts/recalc-collection.mjs collection=test_calculs batch=500
//   node scripts/recalc-collection.mjs collection=test_calculs filter='{"status":{"_eq":"open"}}'
//   node scripts/recalc-collection.mjs collection=test_calculs url=http://localhost:8055 token=YOUR_TOKEN

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const i = a.indexOf('=');
  return i === -1 ? [a, 'true'] : [a.slice(0, i), a.slice(i + 1)];
}));

const baseUrl = args.url || process.env.DIRECTUS_URL || 'http://localhost:8055';
const token = args.token || process.env.DIRECTUS_TOKEN || '';
const collection = args.collection;
const batch = Math.max(1, Math.min(500, Number(args.batch || 200)));

async function loadFilter() {
  // Priority: explicit JSON arg -> file -> named env var -> DIRECTUS_FILTER
  if (args.filter) {
    try { return JSON.parse(args.filter); } catch (e) {
      console.error('Invalid JSON in filter. Tip (PowerShell): use single quotes around JSON or use filterEnv=DIRECTUS_FILTER');
      throw e;
    }
  }
  if (args.filterFile || args.filterfile) {
    const fs = await import('node:fs/promises');
    const p = args.filterFile || args.filterfile;
    const txt = await fs.readFile(p, 'utf8');
    return JSON.parse(txt);
  }
  if (args.filterEnv || args.filterenv) {
    const name = args.filterEnv || args.filterenv;
    const val = process.env[name];
    if (!val) return undefined;
    return JSON.parse(val);
  }
  if (process.env.DIRECTUS_FILTER) {
    return JSON.parse(process.env.DIRECTUS_FILTER);
  }
  return undefined;
}

let filter;
try {
  filter = await loadFilter();
} catch (e) {
  console.error('Failed to parse filter JSON:', e?.message || e);
  process.exit(1);
}

if (!collection) {
  console.error('Usage: node scripts/recalc-collection.mjs collection=<name> [url=...] [token=...] [batch=1..500] [filter={...}] [filterEnv=ENV] [filterFile=path.json] [fields=a,b,c] [dryRun=true]');
  process.exit(1);
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
  }
  return res.json().catch(() => ({}));
}

function parseFieldsArg(raw) {
  if (!raw) return undefined;
  try {
    if (raw.trim().startsWith('[')) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((f) => String(f)).filter(Boolean);
      }
    }
  } catch (e) {
    // fallback to comma parsing below
  }
  return raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
}

function parseBooleanArg(...keys) {
  for (const key of keys) {
    if (key in args) {
      return ['1', 'true', 'yes', 'on'].includes(String(args[key]).toLowerCase());
    }
  }
  return false;
}

const fields = parseFieldsArg(args.fields || args.field);
const dryRun = parseBooleanArg('dryRun', 'dryrun', 'dry-run', 'dry');

(async () => {
  const payload = {
    collection,
    batchSize: batch,
    dryRun,
  };

  if (filter) {
    payload.filter = filter;
  }

  if (fields && fields.length > 0) {
    payload.fields = fields;
  }

  console.log(`[Recalc] Triggering endpoint for collection "${collection}"...`);
  const result = await api('/realtime-calc/utils/realtime-calc.recalculate-collection', {
    method: 'POST',
    body: payload,
  });

  console.log(JSON.stringify(result, null, 2));

  if (!result?.success) {
    process.exitCode = 1;
  }
})().catch((e) => {
  console.error('Recalc failed:', e?.message || e);
  process.exit(1);
});
