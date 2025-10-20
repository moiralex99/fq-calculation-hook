#!/usr/bin/env node

/**
 * 🔄 Convertisseur de Schémas → Directus
 * 
 * Supporte :
 * - JSON Schema
 * - OpenAPI 3.0
 * - Asana/Trello/ClickUp exports
 * - Formats personnalisés
 * 
 * Usage:
 *   node schema-converter.mjs --input asana-schema.json --output directus-setup.mjs
 *   node schema-converter.mjs --input schema.json --format asana
 */

import { readFileSync, writeFileSync } from 'fs';
import { basename } from 'path';

// ============================================
// MAPPINGS DE TYPES
// ============================================

const TYPE_MAPPINGS = {
  // JSON Schema → Directus
  'string': 'string',
  'integer': 'integer',
  'number': 'decimal',
  'boolean': 'boolean',
  'object': 'json',
  'array': 'json',
  
  // Types spéciaux
  'date': 'date',
  'datetime': 'timestamp',
  'date-time': 'timestamp',
  'time': 'time',
  'email': 'string',
  'url': 'string',
  'uuid': 'uuid',
  'text': 'text',
};

const INTERFACE_MAPPINGS = {
  'string': 'input',
  'text': 'input-multiline',
  'integer': 'input',
  'decimal': 'input',
  'boolean': 'boolean',
  'date': 'datetime',
  'timestamp': 'datetime',
  'time': 'datetime',
  'json': 'input-code',
  'uuid': 'input',
  'email': 'input',
  'url': 'input',
};

// ============================================
// PARSERS PAR FORMAT
// ============================================

/**
 * Parser pour JSON Schema standard
 */
function parseJsonSchema(schema) {
  const collections = [];
  
  // Si c'est un objet avec definitions/components
  const defs = schema.definitions || schema.components?.schemas || { root: schema };
  
  for (const [name, definition] of Object.entries(defs)) {
    if (definition.type !== 'object' && !definition.properties) continue;
    
    const fields = [];
    const properties = definition.properties || {};
    const required = definition.required || [];
    
    for (const [fieldName, fieldDef] of Object.entries(properties)) {
      const field = convertField(fieldName, fieldDef, required.includes(fieldName));
      fields.push(field);
    }
    
    collections.push({
      name: normalizeCollectionName(name),
      fields,
      meta: {
        icon: 'box',
        note: definition.description || ''
      }
    });
  }
  
  return collections;
}

/**
 * Parser pour format Asana
 */
function parseAsanaSchema(schema) {
  const collections = [];
  
  // Asana utilise "resources" pour définir les entités
  const resources = schema.resources || [];
  
  for (const resource of resources) {
    const fields = [];
    
    // Parser les propriétés Asana
    const properties = resource.properties || resource.fields || {};
    
    for (const [fieldName, fieldDef] of Object.entries(properties)) {
      const field = convertAsanaField(fieldName, fieldDef);
      fields.push(field);
    }
    
    collections.push({
      name: normalizeCollectionName(resource.name || resource.resource_type),
      fields,
      meta: {
        icon: getIconForResource(resource.name),
        note: resource.description || ''
      }
    });
  }
  
  return collections;
}

/**
 * Parser pour OpenAPI 3.0
 */
function parseOpenAPI(schema) {
  const collections = [];
  const schemas = schema.components?.schemas || {};
  
  for (const [name, definition] of Object.entries(schemas)) {
    if (definition.type !== 'object') continue;
    
    const fields = [];
    const properties = definition.properties || {};
    const required = definition.required || [];
    
    for (const [fieldName, fieldDef] of Object.entries(properties)) {
      const field = convertField(fieldName, fieldDef, required.includes(fieldName));
      fields.push(field);
    }
    
    collections.push({
      name: normalizeCollectionName(name),
      fields,
      meta: {
        icon: 'box',
        note: definition.description || ''
      }
    });
  }
  
  return collections;
}

/**
 * Parser générique (auto-détection)
 */
function parseGeneric(schema) {
  // Détecter le format
  if (schema.openapi || schema.swagger) {
    return parseOpenAPI(schema);
  }
  
  if (schema.resources || schema.data?.resource_type) {
    return parseAsanaSchema(schema);
  }
  
  // Par défaut, JSON Schema
  return parseJsonSchema(schema);
}

// ============================================
// HELPERS DE CONVERSION
// ============================================

function convertField(name, definition, isRequired = false) {
  const type = TYPE_MAPPINGS[definition.type] || 'string';
  const format = definition.format;
  
  // Détecter les types spéciaux
  let finalType = type;
  let interfaceType = INTERFACE_MAPPINGS[type];
  
  if (format === 'date-time' || format === 'datetime') {
    finalType = 'timestamp';
    interfaceType = 'datetime';
  } else if (format === 'date') {
    finalType = 'date';
    interfaceType = 'datetime';
  } else if (format === 'email') {
    interfaceType = 'input';
  } else if (format === 'uri' || format === 'url') {
    interfaceType = 'input';
  }
  
  // Détecter les relations (foreign keys)
  const isRelation = name.endsWith('_id') || name.endsWith('Id');
  
  const field = {
    field: normalizeFieldName(name),
    type: finalType,
    meta: {
      interface: interfaceType,
      required: isRequired
    },
    schema: {}
  };
  
  // Ajouter default_value si présent
  if (definition.default !== undefined) {
    field.schema.default_value = definition.default;
  }
  
  // Gestion spéciale des booleans (SQLite compatibility)
  if (finalType === 'boolean') {
    field.schema.default_value = definition.default ?? false;
    field.schema.is_nullable = false;
  }
  
  // Ajouter readonly pour les champs calculés
  if (definition.readOnly || definition.computed) {
    field.meta.readonly = true;
  }
  
  return field;
}

function convertAsanaField(name, definition) {
  // Asana a des types spécifiques
  const asanaTypeMap = {
    'string': 'string',
    'number': 'decimal',
    'boolean': 'boolean',
    'date': 'date',
    'enum': 'string',
    'object': 'json',
    'array': 'json',
    'gid': 'string', // Asana Global ID
    'resource': 'json'
  };
  
  const type = asanaTypeMap[definition.type] || 'string';
  const isRequired = definition.required || false;
  
  return convertField(name, { ...definition, type }, isRequired);
}

function normalizeCollectionName(name) {
  return name
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/-/g, '_')
    .replace(/\s+/g, '_');
}

function normalizeFieldName(name) {
  return name
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/-/g, '_');
}

function getIconForResource(name) {
  const iconMap = {
    'project': 'folder',
    'task': 'check_box',
    'user': 'person',
    'team': 'groups',
    'workspace': 'business',
    'tag': 'label',
    'story': 'chat',
    'attachment': 'attach_file',
    'comment': 'comment',
    'section': 'view_list',
  };
  
  const normalized = name.toLowerCase();
  return iconMap[normalized] || 'box';
}

// ============================================
// GÉNÉRATEUR DE CODE DIRECTUS
// ============================================

function generateDirectusScript(collections, options = {}) {
  const { includeData = false } = options;
  
  let code = `#!/usr/bin/env node

/**
 * Script de création des collections Directus
 * Généré automatiquement par schema-converter.mjs
 * 
 * Usage:
 *   node ${options.outputFile || 'directus-setup.mjs'}
 */

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://127.0.0.1:8055';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || 'YOUR-TOKEN-HERE';
const VERBOSE = process.env.VERBOSE === 'true';
const TIMEOUT_MS = 15000;

async function api(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = \`\${DIRECTUS_URL}\${path}\`;
    if (VERBOSE) console.log(\`→ \${options.method || 'GET'} \${url}\`);

    const res = await fetch(url, {
      ...options,
      headers: {
        'Authorization': \`Bearer \${DIRECTUS_TOKEN}\`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(\`HTTP \${res.status}: \${text}\`);
    }
    if (res.status === 204 || res.headers.get('content-length') === '0') return null;
    return await res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error(\`Timeout: \${path}\`);
    throw err;
  }
}

function normalizeBooleans(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(item => normalizeBooleans(item));
  if (typeof obj === 'object') {
    const normalized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'boolean') {
        normalized[key] = Boolean(value);
      } else if (typeof value === 'object') {
        normalized[key] = normalizeBooleans(value);
      } else {
        normalized[key] = value;
      }
    }
    return normalized;
  }
  return obj;
}

async function createCollectionWithFields(collectionName, fields, meta = {}) {
  console.log(\`\\n📦 Création: \${collectionName}\`);
  
  try {
    await api('/collections', {
      method: 'POST',
      body: JSON.stringify({
        collection: collectionName,
        meta: { icon: 'box', ...meta },
        schema: { name: collectionName }
      })
    });
    
    for (const field of fields) {
      console.log(\`  ↳ \${field.field} (\${field.type})\`);
      await api(\`/fields/\${collectionName}\`, {
        method: 'POST',
        body: JSON.stringify(field)
      });
      await new Promise(r => setTimeout(r, 100));
    }
    
    console.log(\`✅ \${collectionName} créée\`);
  } catch (error) {
    if (error.message?.includes('already exists')) {
      console.log(\`⚠️  \${collectionName} existe déjà\`);
    } else {
      throw error;
    }
  }
}

async function main() {
  console.log('🚀 Création des collections...\\n');
  console.log(\`📍 URL: \${DIRECTUS_URL}\\n\`);
  
  try {
`;

  // Générer les appels de création
  for (const collection of collections) {
    code += `    // ${collection.name}\n`;
    code += `    await createCollectionWithFields('${collection.name}', ${JSON.stringify(collection.fields, null, 6).replace(/^/gm, '    ')}, ${JSON.stringify(collection.meta)});\n\n`;
  }

  code += `    console.log('\\n✅ Toutes les collections ont été créées !');
  } catch (error) {
    console.error('\\n❌ ERREUR:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
`;

  return code;
}

// ============================================
// CLI PRINCIPAL
// ============================================

function printUsage() {
  console.log(`
🔄 Schema Converter → Directus

Usage:
  node schema-converter.mjs --input <file> --output <file> [options]

Options:
  --input <file>     Fichier JSON source (requis)
  --output <file>    Fichier .mjs de sortie (défaut: directus-setup.mjs)
  --format <type>    Format: auto|json-schema|openapi|asana (défaut: auto)
  --data             Inclure des données de test (TODO)

Exemples:
  node schema-converter.mjs --input asana.json --output setup.mjs
  node schema-converter.mjs --input openapi.json --format openapi
  node schema-converter.mjs --input schema.json
`);
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }
  
  const options = {
    input: null,
    output: 'directus-setup.mjs',
    format: 'auto',
    includeData: false
  };
  
  // Parser les arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--input') options.input = args[++i];
    else if (arg === '--output') options.output = args[++i];
    else if (arg === '--format') options.format = args[++i];
    else if (arg === '--data') options.includeData = true;
  }
  
  if (!options.input) {
    console.error('❌ --input est requis');
    printUsage();
    process.exit(1);
  }
  
  try {
    console.log('🔄 Conversion du schéma...\n');
    console.log(`📥 Input:  ${options.input}`);
    console.log(`📤 Output: ${options.output}`);
    console.log(`🎯 Format: ${options.format}\n`);
    
    // Lire le fichier source
    const rawData = readFileSync(options.input, 'utf-8');
    const schema = JSON.parse(rawData);
    
    // Parser selon le format
    let collections;
    switch (options.format) {
      case 'json-schema':
        collections = parseJsonSchema(schema);
        break;
      case 'openapi':
        collections = parseOpenAPI(schema);
        break;
      case 'asana':
        collections = parseAsanaSchema(schema);
        break;
      default:
        collections = parseGeneric(schema);
    }
    
    console.log(`✅ ${collections.length} collections détectées:\n`);
    for (const col of collections) {
      console.log(`   📦 ${col.name} (${col.fields.length} champs)`);
    }
    
    // Générer le code Directus
    const code = generateDirectusScript(collections, { 
      ...options, 
      outputFile: basename(options.output) 
    });
    
    // Écrire le fichier
    writeFileSync(options.output, code, 'utf-8');
    
    console.log(`\n🎉 Fichier généré: ${options.output}`);
    console.log(`\n💡 Next step:`);
    console.log(`   $env:DIRECTUS_TOKEN="your-token"`);
    console.log(`   node ${options.output}`);
    
  } catch (error) {
    console.error(`\n❌ ERREUR: ${error.message}`);
    if (process.env.VERBOSE) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
