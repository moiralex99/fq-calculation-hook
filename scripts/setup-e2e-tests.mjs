// E2E setup and validation against a running Directus with the realtime-calc hook
// - Creates quartz_formulas (if missing)
// - Creates calc_tests collection with input and output fields
// - Inserts published formulas covering supported functions
// - Creates one test item, waits for hook to compute, then verifies results
//
// Usage (PowerShell):
//   $env:DIRECTUS_URL = 'http://localhost:8055'
//   $env:DIRECTUS_TOKEN = '<YOUR_TOKEN>'
//   node scripts/setup-e2e-tests.mjs
//
// Optional args:
//   url=http://localhost:8055 token=... wait=7000

import { DSLEvaluator } from '../src/dsl-parser.js';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const i = a.indexOf('=');
    return i === -1 ? [a, 'true'] : [a.slice(0, i), a.slice(i + 1)];
  })
);

const baseUrl = args.url || process.env.DIRECTUS_URL || 'http://localhost:8055';
const token = args.token || process.env.DIRECTUS_TOKEN || '';
const waitMs = Number(args.wait || 7000);

if (!token) {
  console.error('Missing token. Set DIRECTUS_TOKEN or pass token=...');
  process.exit(1);
}

const TIMEOUT_MS = Number(args.timeout || process.env.DIRECTUS_TIMEOUT_MS || 15000);
const VERBOSE = String(args.verbose || process.env.DIRECTUS_VERBOSE || 'false').toLowerCase() === 'true';
async function api(path, { method = 'GET', body, headers = {}, timeout = TIMEOUT_MS } = {}) {
  const url = `${baseUrl}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Timeout ${timeout}ms`)), timeout);
  if (VERBOSE) console.log(`[API] ${method} ${url} body=${body ? JSON.stringify(body).slice(0, 200) : 'none'}`);
  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${res.statusText} for ${method} ${path}: ${text}`);
    }
    try {
      const json = await res.json();
      if (VERBOSE) console.log(`[API] OK ${method} ${url}`);
      return json;
    } catch {
      if (VERBOSE) console.log(`[API] OK (no JSON) ${method} ${url}`);
      return {};
    }
  } catch (e) {
    const msg = e?.name === 'AbortError' ? `Request aborted: ${e?.message || e}` : (e?.message || String(e));
    console.error(`[API] ERROR ${method} ${url} -> ${msg}`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
async function ensureCollection(def) {
  try {
    await api('/collections', { method: 'POST', body: def });
    console.log(`Created collection '${def.collection}'`);
  } catch (e) {
    const msg = String(e.message || e);
    if (msg.includes('already exists') || msg.includes('already been created') || msg.includes('exists')) {
      console.log(`Collection '${def.collection}' already exists (skipping)`);
    } else if (msg.includes('HTTP 400') && msg.includes('exists')) {
      console.log(`Collection '${def.collection}' already exists (400) (skipping)`);
    } else {
      throw e;
    }
  }
}

function decField(field, note, precision = 18, scale = 4, readonly = true) {
  return {
    field,
    type: 'decimal',
    schema: { numeric_precision: precision, numeric_scale: scale },
    meta: { interface: 'input', readonly: !!readonly, note },
  };
}

function intField(field, note, readonly = true) {
  return { field, type: 'integer', meta: { interface: 'input', readonly: !!readonly, note } };
}

function strField(field, note, readonly = true, length = 255) {
  return {
    field,
    type: 'string',
    schema: { max_length: length },
    meta: { interface: 'input', readonly: !!readonly, note },
  };
}

function boolField(field, note, readonly = true) {
  return { field, type: 'boolean', meta: { interface: 'boolean', readonly: !!readonly, note } };
}

function dateField(field, note, readonly = true) {
  return { field, type: 'date', meta: { interface: 'date', readonly: !!readonly, note } };
}

async function setupQuartzFormulas() {
  const def = {
    collection: 'quartz_formulas',
    meta: {
      collection: 'quartz_formulas',
      icon: 'functions',
      display_template: '{{collection_cible}}.{{champ_cible}}',
      sort_field: 'sort',
    },
    schema: { name: 'quartz_formulas' },
    fields: [
      { field: 'id', type: 'integer', schema: { is_primary_key: true, has_auto_increment: true }, meta: { hidden: true } },
      { field: 'collection_cible', type: 'string', schema: { max_length: 255 }, meta: { interface: 'input', required: true } },
      { field: 'champ_cible', type: 'string', schema: { max_length: 255 }, meta: { interface: 'input', required: true } },
      { field: 'formula', type: 'text', schema: {}, meta: { interface: 'input-code', options: { language: 'plaintext' }, required: true } },
      { field: 'status', type: 'string', schema: { max_length: 50, default_value: 'published' }, meta: { interface: 'select-dropdown' } },
      { field: 'sort', type: 'integer', schema: { default_value: 0 }, meta: { interface: 'input' } },
      { field: 'description', type: 'text', meta: { interface: 'input-multiline' } },
      { field: 'date_created', type: 'timestamp', meta: { interface: 'datetime', readonly: true, hidden: true, special: ['date-created'] } },
      { field: 'date_updated', type: 'timestamp', meta: { interface: 'datetime', readonly: true, hidden: true, special: ['date-updated'] } },
    ],
  };
  await ensureCollection(def);
}

async function setupCalcTestsCollection() {
  const fields = [
    { field: 'id', type: 'integer', schema: { is_primary_key: true, has_auto_increment: true }, meta: { hidden: true } },
    // Inputs
    intField('a', 'input'),
    intField('b', 'input'),
    decField('x', 'input', 18, 6, false),
    strField('text', 'input', false),
    strField('code', 'input', false),
    strField('status', 'input', false),
    decField('amount', 'input amount', 18, 2, false),
    intField('score', 'input score', false),
    strField('bad_int', 'input bad int', false),
    { field: 'maybe_null', type: 'integer', schema: { is_nullable: true }, meta: { interface: 'input', note: 'may be null', readonly: false } },
    dateField('date1', 'input', false),
    dateField('date2', 'input', false),

    // Outputs (calculated)
    decField('add_ab', 'calc'),
    decField('sub_ab', 'calc'),
    decField('mul_ab', 'calc'),
    decField('div_ab', 'calc'),
    intField('mod_ab', 'calc'),
    intField('negate_a', 'calc'),
    decField('round_x2', 'calc', 18, 2),
    decField('coalesce_demo', 'calc'),
    boolField('logical_and', 'calc'),
    boolField('eq_demo', 'calc'),
    boolField('in_demo', 'calc'),
    boolField('between_demo', 'calc'),
    dateField('today_demo', 'calc'),
    intField('date_diff_days', 'calc'),
    dateField('date_add_demo', 'calc'),
    dateField('date_trunc_month', 'calc'),
    dateField('end_of_month', 'calc'),
    intField('extract_year', 'calc'),
    strField('upper_text', 'calc'),
    intField('length_text', 'calc'),
    strField('left_code3', 'calc'),
    strField('regex_extract_num', 'calc'),
    strField('concat_ws', 'calc', true, 255),
    intField('cast_int', 'calc'),
    intField('try_cast_fail', 'calc'),
    intField('power_demo', 'calc'),
    decField('sqrt_demo', 'calc', 18, 6),
    intField('sign_demo', 'calc'),
    intField('greatest_demo', 'calc'),
    intField('least_demo', 'calc'),
    strField('case_when_demo', 'calc'),
    boolField('is_null_demo', 'calc'),
    strField('replace_demo', 'calc'),
    strField('trim_demo', 'calc'),
    strField('substring_demo', 'calc'),
    dateField('start_of_week', 'calc'),
    dateField('end_of_week', 'calc'),
    dateField('make_date_demo', 'calc'),
    // CASE_WHEN and nested functions
    strField('case_grade', 'calc'),
    decField('case_nested', 'calc', 18, 2),
    decField('nested_math', 'calc', 18, 2),
    strField('nested_text', 'calc'),
    intField('nested_date_week', 'calc'),
    strField('nested_case', 'calc'),
    intField('nested_coalesce', 'calc'),
  ];

  const def = {
    collection: 'calc_tests',
    meta: { collection: 'calc_tests', icon: 'science', display_template: '{{id}}' },
    schema: { name: 'calc_tests' },
    fields,
  };

  await ensureCollection(def);

  // Ensure fields exist even when collection already present
  for (const f of fields) {
    try {
      await api(`/fields/calc_tests`, { method: 'POST', body: f });
    } catch (e) {
      const msg = String(e.message || e);
      if (msg.includes('exists') || msg.includes('already')) {
        // ignore if field already exists
      } else {
        // Some drivers return 400 with details; attempt PATCH to ensure meta/schema updates if needed
        try {
          await api(`/fields/calc_tests/${encodeURIComponent(f.field)}`, { method: 'PATCH', body: f });
        } catch (_) {
          // swallow; not critical for tests
        }
      }
    }
  }
}

function formulasForCalcTests() {
  const list = [
    ['add_ab', "ADD({{a}}, {{b}}, 5)", 1, 'sum a+b+5'],
    ['sub_ab', "SUB({{a}}, {{b}}, 2)", 2, 'a-b-2'],
    ['mul_ab', "MUL({{a}}, {{b}})", 3, 'a*b'],
    ['div_ab', "DIV({{a}}, {{b}})", 4, 'a/b'],
    ['mod_ab', "MOD({{a}}, {{b}})", 5, 'a%b'],
    ['negate_a', "NEGATE({{a}})", 6, 'negate a'],
    ['round_x2', "ROUND({{x}}, 2)", 7, 'round x 2'],
    ['coalesce_demo', "COALESCE({{maybe_null}}, 99)", 8, 'coalesce'],
    ['logical_and', "and({{a}} > 0, {{b}} < 5)", 9, 'logical and'],
    ['eq_demo', "EQ({{a}}, 10)", 10, 'eq'],
    ['in_demo', "IN({{status}}, \"new\", \"actif\", \"clos\")", 11, 'in'],
    ['between_demo', "BETWEEN({{a}}, 5, 15)", 12, 'between'],
    ['today_demo', 'TODAY()', 13, 'today'],
    ['date_diff_days', 'DATE_DIFF("day", {{date2}}, {{date1}})', 14, 'date_diff'],
    ['date_add_demo', 'DATE_ADD("day", 5, {{date2}})', 15, 'date_add'],
    ['date_trunc_month', 'DATE_TRUNC("month", {{date1}})', 16, 'date_trunc'],
    ['end_of_month', 'END_OF("month", {{date1}})', 17, 'end_of'],
    ['extract_year', 'EXTRACT("year", {{date1}})', 18, 'extract year'],
    ['upper_text', 'UPPER({{text}})', 19, 'upper'],
    ['length_text', 'LENGTH({{text}})', 20, 'length'],
    ['left_code3', 'LEFT({{code}}, 4)', 21, 'left'],
    ['regex_extract_num', 'REGEX_EXTRACT({{code}}, "([A-Z]+)-(\\d+)", 2)', 22, 'regex extract'],
    ['concat_ws', 'CONCAT_WS("-", {{a}}, {{b}}, "X")', 23, 'concat ws'],
    ['cast_int', 'CAST("12", "int")', 24, 'cast int'],
    ['try_cast_fail', 'TRY_CAST("abc", "int")', 25, 'try cast fail'],
    ['power_demo', 'POWER({{b}}, 3)', 26, 'power'],
    ['sqrt_demo', 'SQRT(16)', 27, 'sqrt'],
    ['sign_demo', 'SIGN(-5)', 28, 'sign'],
    ['greatest_demo', 'GREATEST({{a}}, 7, 12)', 29, 'greatest'],
    ['least_demo', 'LEAST({{a}}, 7, 12)', 30, 'least'],
    ['case_when_demo', 'CASE_WHEN({{a}} > 10, "big", {{a}} = 10, "ten", "small")', 31, 'case when'],
    ['is_null_demo', 'IS_NULL({{maybe_null}})', 32, 'is_null'],
    ['replace_demo', 'REPLACE({{code}}, "-", "_")', 33, 'replace'],
    ['trim_demo', 'TRIM("  test  ")', 34, 'trim'],
    ['substring_demo', 'SUBSTRING({{text}}, 1, 3)', 35, 'substring'],
    ['start_of_week', 'START_OF("week", {{date1}})', 36, 'start_of week'],
    ['end_of_week', 'END_OF("week", {{date1}})', 37, 'end_of week'],
    ['make_date_demo', 'MAKE_DATE(2025, 10, 15)', 38, 'make_date'],
    // New formulas for CASE_WHEN and nested functions
    ['case_grade', 'CASE_WHEN({{score}} >= 90, "A", {{score}} >= 80, "B", {{score}} >= 70, "C", "D")', 39, 'grade by score'],
    ['case_nested', 'CASE_WHEN({{status}} = "vip", ROUND({{amount}} * 0.9, 2), {{status}} = "new", ROUND({{amount}} * 0.95, 2), ROUND({{amount}}, 2))', 40, 'case with nested round'],
    ['nested_math', 'ROUND(ADD(MUL({{a}}, {{b}}), POWER({{b}}, 2)), 2)', 41, 'nested math'],
    ['nested_text', 'CONCAT_WS("-", UPPER(LEFT({{text}}, 2)), LOWER(RIGHT({{text}}, 3)))', 42, 'nested text'],
    ['nested_date_week', 'EXTRACT("week", DATE_ADD("day", 10, {{date1}}))', 43, 'nested date'],
    ['nested_case', 'CASE_WHEN(and({{a}} > 5, {{b}} < 10), "ok", "ko")', 44, 'nested bool in case'],
    ['nested_coalesce', 'COALESCE(TRY_CAST({{bad_int}}, "int"), 42)', 45, 'nested coalesce try_cast'],
  ];
  return list.map(([field, formula, sort, description]) => ({
    collection_cible: 'calc_tests',
    champ_cible: field,
    formula,
    status: 'published',
    sort,
    description,
  }));
}

async function insertFormulas(rows) {
  let ok = 0;
  for (const row of rows) {
    try {
      await api('/items/quartz_formulas', { method: 'POST', body: row });
      ok++;
    } catch (e) {
      const msg = String(e.message || e);
      if (msg.includes('Duplicate') || msg.includes('already exists')) {
        // try update by unique key (not defined) -> fallback: ignore
      } else {
        console.warn('Insert formula failed:', msg);
      }
    }
  }
  console.log(`Inserted ${ok}/${rows.length} formulas (others may already exist).`);
}

function computeExpectedFor(data, formulas) {
  const evaluator = new DSLEvaluator();
  const expected = {};
  for (const f of formulas) {
    expected[f.champ_cible] = evaluator.evaluate(f.formula, data);
  }
  return expected;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function ensurePermissionsNote() {
  // quick probe: read collections
  try {
    await api('/collections');
  } catch (e) {
    console.error('\nPermission error when listing collections. Ensure your token has admin rights.');
    throw e;
  }
}

async function main() {
  console.log(`Base: ${baseUrl}`);
  await ensurePermissionsNote();
  await setupQuartzFormulas();
  await setupCalcTestsCollection();

  const formulas = formulasForCalcTests();
  await insertFormulas(formulas);

  console.log(`Waiting ${waitMs} ms for the hook to hot-reload formulas...`);
  await sleep(waitMs);

  // Seed one test item
  const input = {
    a: 10,
    b: 3,
    x: 10.556,
    text: 'Bonjour',
    code: 'TASK-42',
    status: 'actif',
    amount: 123.45,
    score: 85,
    bad_int: 'abc',
    maybe_null: null,
    date1: '2025-10-15',
    date2: '2025-10-10',
  };

  const created = await api('/items/calc_tests', { method: 'POST', body: input });
  const id = created?.data?.id ?? created?.id;
  if (!id) throw new Error('Created item has no id');

  // Allow post-commit hook to run and update calculated fields
  await sleep(1000);

  const readRes = await api(`/items/calc_tests/${id}`);
  const item = readRes?.data ?? readRes;

  const expected = computeExpectedFor(input, formulas);

  // Compare
  const results = [];
  let fails = 0;
  const toBool = (v) => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') return ['true', '1', 'yes', 'y'].includes(v.toLowerCase());
    return Boolean(v);
  };

  for (const { champ_cible } of formulas) {
    const got = item[champ_cible];
    const exp = expected[champ_cible];
    let ok;
    if (typeof exp === 'number' && typeof got === 'number') {
      ok = Number.isFinite(exp) && Number.isFinite(got) ? Math.abs(exp - got) < 1e-6 : String(exp) === String(got);
    } else if (typeof exp === 'boolean') {
      ok = toBool(got) === exp;
    } else {
      ok = (exp == null && got == null) || String(got) === String(exp);
    }
    if (!ok) fails++;
    results.push({ field: champ_cible, expected: exp, got, ok });
  }

  console.log('\nE2E Results for calc_tests:', { id });
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.field}: expected=${JSON.stringify(r.expected)} got=${JSON.stringify(r.got)}`);
  }
  console.log(`\nSummary: ${results.length - fails} passed, ${fails} failed.`);

  if (fails > 0) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('setup-e2e-tests failed:', e?.message || e);
  process.exit(1);
});
