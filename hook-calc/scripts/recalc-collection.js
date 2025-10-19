// Manual recalculation helper
// Touches items in a collection to trigger the realtime-calc hook post-commit path.
// Updates are no-op (empty payload), so only calculated fields that actually change will be written.
// Usage examples:
//   node scripts/recalc-collection.js collection=test_calculs
//   node scripts/recalc-collection.js collection=test_calculs batch=500
//   node scripts/recalc-collection.js collection=test_calculs filter='{"status":{"_eq":"open"}}'
//   node scripts/recalc-collection.js collection=test_calculs url=http://localhost:8055 token=YOUR_TOKEN

import { createDirectus, rest, withToken, updateItem, readItems } from '@directus/sdk';

function parseArgs(argv) {
  const entries = argv.slice(2).map((a) => {
    const idx = a.indexOf('=');
    if (idx === -1) return [a, 'true'];
    return [a.slice(0, idx), a.slice(idx + 1)];
  });
  return Object.fromEntries(entries);
}

const args = parseArgs(process.argv);
const url = args.url || process.env.DIRECTUS_URL || 'http://localhost:8055';
const token = args.token || process.env.DIRECTUS_TOKEN || '';
const collection = args.collection;
const batch = Math.max(1, Math.min(500, Number(args.batch || 200)));
const filter = args.filter ? JSON.parse(args.filter) : undefined;

if (!collection) {
  console.error('Usage: node scripts/recalc-collection.js collection=<name> [url=...] [token=...] [batch=1..500] [filter={...}]');
  process.exit(1);
}

const client = createDirectus(url).with(rest());

async function main() {
  const authed = token ? client.with(withToken(token)) : client;
  let offset = 0;
  let total = 0;
  const startedAt = Date.now();
  for (;;) {
    const items = await authed.request(
      readItems(collection, { limit: batch, offset, filter, fields: ['id'] })
    );
    if (!items?.length) break;

    // Fire updates sequentially to keep logs readable; can be parallelized if needed
    for (const it of items) {
      await authed.request(updateItem(collection, it.id, {}));
    }

    total += items.length;
    offset += items.length;
    console.log(`Processed ${total} item(s)...`);
    if (items.length < batch) break; // last page
  }
  const dur = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`Done. Touched ${total} items in '${collection}' in ${dur}s. Check Directus logs for recalculation details.`);
}

main().catch((e) => {
  console.error('Recalc failed:', e?.response?.data || e?.message || e);
  process.exit(1);
});
