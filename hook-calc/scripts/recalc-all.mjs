// Recalculate all collections that have formulas using extension actions
// Usage (PowerShell):
//   node scripts/recalc-all.mjs
//   node scripts/recalc-all.mjs url=http://localhost:8055 token=YOUR_TOKEN
//   node scripts/recalc-all.mjs batch=200 dryRun=true
//   node scripts/recalc-all.mjs include=test_calculs,orders exclude=logs

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const i = a.indexOf("=");
    return i === -1 ? [a, "true"] : [a.slice(0, i), a.slice(i + 1)];
  })
);

const baseUrl = args.url || process.env.DIRECTUS_URL || "http://localhost:8055";
const token = args.token || process.env.DIRECTUS_TOKEN || "";
const batchSize = Math.max(1, Math.min(500, Number(args.batch || 100)));
const dryRun = String(args.dryRun || args["dry-run"] || "false").toLowerCase() === "true";
const include = (args.include || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const exclude = (args.exclude || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
  }
  return res.json().catch(() => ({}));
}

async function callAction(action, payload = {}) {
  return api(`/utils/${encodeURIComponent(action)}`, { method: "POST", body: payload });
}

function shouldRunCollection(name, stats) {
  if (!stats || !stats[name]) return false;
  if (Array.isArray(include) && include.length > 0 && !include.includes(name)) return false;
  if (Array.isArray(exclude) && exclude.includes(name)) return false;
  // Run only if there is at least one formula
  return (stats[name].formulaCount || 0) > 0;
}

async function safeGetConfigViaUtils() {
  try {
    const reloaded = await callAction("realtime-calc.reload-formulas");
    console.log(`Reload: ${reloaded?.message || "done"}`);
  } catch (e) {
    console.warn("Reload formulas failed (continuing):", e?.message || e);
  }
  try {
    const cfg = await callAction("realtime-calc.get-config");
    return cfg?.stats || {};
  } catch (e) {
    const text = e?.message || String(e);
    if (text.includes("ROUTE_NOT_FOUND") || text.includes("404")) return null;
    throw e;
  }
}

async function listCollectionsFromQuartzFormulas() {
  // Fallback: read quartz_formulas to discover target collections
  const seen = new Set();
  let offset = 0;
  for (;;) {
    const params = new URLSearchParams({
      fields: "collection_cible",
      limit: String(200),
      offset: String(offset),
    });
    const data = await api(`/items/quartz_formulas?${params.toString()}`);
    const rows = Array.isArray(data?.data) ? data.data : data;
    if (!rows || rows.length === 0) break;
    for (const r of rows) {
      if (r?.collection_cible) seen.add(r.collection_cible);
    }
    offset += rows.length;
    if (rows.length < 200) break;
  }
  return Array.from(seen);
}

async function* paginateItems(collection) {
  let offset = 0;
  for (;;) {
    const params = new URLSearchParams({ limit: String(batchSize), offset: String(offset) });
    const data = await api(`/items/${encodeURIComponent(collection)}?${params.toString()}`);
    const items = Array.isArray(data?.data) ? data.data : data;
    if (!items?.length) break;
    for (const it of items) yield it;
    offset += items.length;
    if (items.length < batchSize) break;
  }
}

async function touchItem(collection, id) {
  await api(`/items/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: {},
  });
}

function pickId(item) {
  return item?.id ?? item?.primary_key ?? item?.uuid ?? item?.ID ?? null;
}

(async () => {
  console.log(`Recalculate ALL — baseUrl=${baseUrl}, batchSize=${batchSize}, dryRun=${dryRun}`);

  let stats = await safeGetConfigViaUtils();
  let usingFallback = false;
  let candidates = [];

  if (stats) {
    candidates = Object.keys(stats).filter((c) => shouldRunCollection(c, stats));
  } else {
    usingFallback = true;
    console.log("Utils endpoints not available — falling back to quartz_formulas scan.");
    const cols = await listCollectionsFromQuartzFormulas();
    candidates = cols
      .filter((c) => (include.length ? include.includes(c) : true))
      .filter((c) => (exclude.length ? !exclude.includes(c) : true));
  }

  if (candidates.length === 0) {
    console.log("No collections with formulas found to recalc.");
    return;
  }

  console.log(`Collections to process (${candidates.length}): ${candidates.join(", ")}`);

  const started = Date.now();
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalItems = 0;

  for (const col of candidates) {
    process.stdout.write(`\n▶ Recalculating ${col} ... `);
    if (!usingFallback) {
      try {
        const res = await callAction("realtime-calc.recalculate-collection", {
          collection: col,
          batchSize,
          dryRun,
        });
        totalProcessed += Number(res?.processed || 0);
        totalUpdated += Number(res?.updated || 0);
        totalItems += Number(res?.total || 0);
        console.log(
          `OK — ${res?.message || "done"} (processed=${res?.processed}, updated=${res?.updated}, total=${res?.total})`
        );
        continue;
      } catch (e) {
        const msg = e?.message || String(e);
        if (!(msg.includes("ROUTE_NOT_FOUND") || msg.includes("404"))) {
          console.error(`FAIL via utils for ${col}:`, msg, "— falling back to PATCH");
        } else {
          console.log("utils route missing — switching to PATCH fallback");
        }
      }
    }

    // Fallback path: touch each item via no-op PATCH
    let processed = 0;
    let updated = 0; // unknown via this path
    let datasetTotal = 0;
    try {
      // Count total if possible
      try {
        const metaRes = await api(`/items/${encodeURIComponent(col)}?limit=0&meta=total_count`);
        datasetTotal = metaRes?.meta?.total_count || 0;
      } catch {}

      for await (const item of paginateItems(col)) {
        const id = pickId(item);
        if (id === null || id === undefined) continue;
        await touchItem(col, id);
        processed++;
        if (processed % batchSize === 0) process.stdout.write(` ${processed}...`);
      }
      totalProcessed += processed;
      totalItems += datasetTotal;
      console.log(`OK — touched ${processed} item(s) (total=${datasetTotal || "?"})`);
    } catch (e) {
      console.error(`FAIL for ${col} (PATCH fallback):`, e?.message || e);
    }
  }

  const dur = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `\nSummary: processed=${totalProcessed}, updated=${totalUpdated}${usingFallback ? " (fallback)" : ""}, datasetTotal=${totalItems}, dryRun=${dryRun}, duration=${dur}s`
  );
  console.log("Done.");
})().catch((e) => {
  console.error("recalc-all failed:", e?.message || e);
  process.exit(1);
});
