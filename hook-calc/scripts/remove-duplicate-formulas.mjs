#!/usr/bin/env node
/**
 * Remove duplicate formulas from quartz_formulas collection
 * Keeps the first occurrence of each unique formula based on:
 * - collection_cible
 * - champ_cible
 * 
 * Usage:
 *   DIRECTUS_URL=http://127.0.0.1:8055 DIRECTUS_TOKEN=xxx node scripts/remove-duplicate-formulas.mjs
 */

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://127.0.0.1:8055';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || 'OHJ4HEV2RG-WwmdNpC2h3PKa1ujLZO5C';
const VERBOSE = process.env.DIRECTUS_VERBOSE === 'true';
const DRY_RUN = process.env.DRY_RUN === 'true'; // Set to 'true' to preview without deleting

const TIMEOUT_MS = 15000;

/**
 * Wrapper around fetch with timeout
 */
async function api(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `${DIRECTUS_URL}${path}`;
    if (VERBOSE) {
      console.log(`→ ${options.method || 'GET'} ${url}`);
    }

    const res = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${DIRECTUS_TOKEN}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    // DELETE requests may return 204 No Content (empty response)
    if (res.status === 204 || res.headers.get('content-length') === '0') {
      return null;
    }

    return await res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Request timeout after ${TIMEOUT_MS}ms: ${path}`);
    }
    throw err;
  }
}

/**
 * Fetch all formulas with pagination
 */
async function getAllFormulas() {
  const allFormulas = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const data = await api(
      `/items/quartz_formulas?limit=${limit}&offset=${offset}&sort=id`
    );

    if (!data.data || data.data.length === 0) {
      break;
    }

    allFormulas.push(...data.data);
    offset += limit;

    if (data.data.length < limit) {
      break;
    }
  }

  return allFormulas;
}

/**
 * Main logic
 */
async function main() {
  console.log('🔍 Fetching all formulas from quartz_formulas...');
  const formulas = await getAllFormulas();
  console.log(`   Found ${formulas.length} total formulas.\n`);

  // Track unique formulas by (collection_cible, champ_cible)
  const seen = new Map();
  const duplicates = [];

  for (const formula of formulas) {
    const key = `${formula.collection_cible}::${formula.champ_cible}`;

    if (seen.has(key)) {
      // This is a duplicate - mark for deletion
      duplicates.push({
        id: formula.id,
        collection: formula.collection_cible,
        field: formula.champ_cible,
        formula: formula.formula,
        firstId: seen.get(key).id,
      });
    } else {
      // First occurrence - keep it
      seen.set(key, {
        id: formula.id,
        collection: formula.collection_cible,
        field: formula.champ_cible,
        formula: formula.formula,
      });
    }
  }

  if (duplicates.length === 0) {
    console.log('✅ No duplicates found! All formulas are unique.\n');
    return;
  }

  console.log(`⚠️  Found ${duplicates.length} duplicate formulas:\n`);

  // Group duplicates by collection and field for better readability
  const groupedDuplicates = {};
  for (const dup of duplicates) {
    const key = `${dup.collection}.${dup.field}`;
    if (!groupedDuplicates[key]) {
      groupedDuplicates[key] = [];
    }
    groupedDuplicates[key].push(dup);
  }

  for (const [key, dups] of Object.entries(groupedDuplicates)) {
    console.log(`📋 ${key} (${dups.length} duplicates):`);
    for (const dup of dups) {
      console.log(`   - ID ${dup.id} (keeping first ID ${dup.firstId})`);
      if (VERBOSE) {
        console.log(`     Formula: ${dup.formula.substring(0, 60)}...`);
      }
    }
    console.log('');
  }

  if (DRY_RUN) {
    console.log('🔒 DRY_RUN mode - no formulas will be deleted.');
    console.log(`   To delete duplicates, run without DRY_RUN=true\n`);
    return;
  }

  // Delete duplicates
  console.log(`🗑️  Deleting ${duplicates.length} duplicate formulas...\n`);

  let deleted = 0;
  let failed = 0;

  for (const dup of duplicates) {
    try {
      await api(`/items/quartz_formulas/${dup.id}`, {
        method: 'DELETE',
      });
      deleted++;
      if (VERBOSE) {
        console.log(`   ✓ Deleted ID ${dup.id} (${dup.collection}.${dup.field})`);
      }
    } catch (err) {
      failed++;
      console.error(`   ✗ Failed to delete ID ${dup.id}: ${err.message}`);
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   - Total formulas before: ${formulas.length}`);
  console.log(`   - Duplicates found: ${duplicates.length}`);
  console.log(`   - Successfully deleted: ${deleted}`);
  console.log(`   - Failed to delete: ${failed}`);
  console.log(`   - Remaining formulas: ${formulas.length - deleted}`);
  console.log('\n✅ Done!\n');
}

// Run the script
main().catch((err) => {
  console.error('\n❌ Error:', err.message);
  if (VERBOSE) {
    console.error(err.stack);
  }
  process.exit(1);
});
