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
  console.error('Usage: node scripts/recalc-collection.mjs collection=<name> [url=...] [token=...] [batch=1..500] [filter={...}] [filterEnv=ENV] [filterFile=path.json]');
  process.exit(1);
}

function qs(obj) {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(typeof v === 'string' ? v : JSON.stringify(v))}`)
    .join('&');
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

async function* paginateItems() {
  let offset = 0;
  for (;;) {
    const query = qs({ limit: batch, offset, filter });
    const data = await api(`/items/${encodeURIComponent(collection)}?${query}`);
    const items = Array.isArray(data?.data) ? data.data : data;
    if (!items?.length) break;
    for (const it of items) yield it;
    offset += items.length;
    if (items.length < batch) break;
  }
}

async function touchItem(id) {
  await api(`/items/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: {}, // no-op payload, enough to trigger post-commit hook
  });
}

(async () => {
  const started = Date.now();
  let count = 0;
  for await (const item of paginateItems()) {
    const id = item?.id ?? item?.primary_key ?? item?.uuid;
    if (id === undefined || id === null) continue;
    await touchItem(id);
    count++;
    if (count % batch === 0) console.log(`Processed ${count}...`);
  }
  const dur = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`Done. Touched ${count} item(s) in ${collection} in ${dur}s. Check Directus logs for recalculation details.`);
})().catch(e => {
  console.error('Recalc failed:', e?.message || e);
  process.exit(1);
});
