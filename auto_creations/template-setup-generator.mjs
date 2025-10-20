#!/usr/bin/env node

/**
 * 🚀 Template Setup Generator
 * 
 * Génère des scripts d'installation Directus à partir des templates NocoDB
 * 
 * Usage:
 *   node template-setup-generator.mjs --input templates/nocodb/crm-complete.json
 *   node template-setup-generator.mjs --batch templates/nocodb/*.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { basename } from 'path';

function generateDirectusSetup(template, options = {}) {
  const { outputFile } = options;
  
  let code = `#!/usr/bin/env node

/**
 * 🚀 ${template.name} - Installation Directus
 * 
 * Source: ${template.source || 'Unknown'}
 * ${template.description}
 * 
 * Collections: ${template.collections.map(c => c.name).join(', ')}
 * 
 * Usage:
 *   $env:DIRECTUS_URL="http://127.0.0.1:8055"
 *   $env:DIRECTUS_TOKEN="your-token"
 *   node ${outputFile || 'setup.mjs'}
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
  console.log('🚀 Installation du template: ${template.name}\\n');
  console.log(\`📍 URL: \${DIRECTUS_URL}\\n\`);
  
  try {
`;

  // Generate collection creation code
  for (const collection of template.collections) {
    code += `    // ${collection.name}\n`;
    code += `    await createCollectionWithFields('${collection.name}', ${JSON.stringify(collection.fields, null, 6).replace(/^/gm, '    ')}, ${JSON.stringify(collection.meta)});\n\n`;
  }

  code += `    console.log('\\n✅ Template ${template.name} installé !');
    console.log('\\n📊 Collections créées : ${template.collections.length}');
    console.log('📝 Champs créés : ${template.collections.reduce((sum, c) => sum + c.fields.length, 0)}');
  } catch (error) {
    console.error('\\n❌ ERREUR:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
`;

  return code;
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    console.log(`
🚀 Template Setup Generator

Usage:
  node template-setup-generator.mjs --input <file>

Options:
  --input <file>    Fichier template JSON (requis)
  --output <file>   Fichier setup.mjs de sortie

Exemple:
  node template-setup-generator.mjs \\
    --input templates/nocodb/crm-complete.json \\
    --output setup-crm.mjs
`);
    process.exit(0);
  }
  
  let inputFile = null;
  let outputFile = null;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input') inputFile = args[++i];
    else if (args[i] === '--output') outputFile = args[++i];
  }
  
  if (!inputFile) {
    console.error('❌ --input est requis');
    process.exit(1);
  }
  
  try {
    console.log(`📥 Lecture: ${inputFile}`);
    const template = JSON.parse(readFileSync(inputFile, 'utf-8'));
    
    if (!outputFile) {
      outputFile = `setup-${template.key || basename(inputFile, '.json')}.mjs`;
    }
    
    console.log(`📝 Génération du script d'installation...`);
    const code = generateDirectusSetup(template, { outputFile });
    
    writeFileSync(outputFile, code, 'utf-8');
    console.log(`✅ Fichier créé: ${outputFile}`);
    console.log(`\n💡 Pour installer:`);
    console.log(`   $env:DIRECTUS_TOKEN="your-token"`);
    console.log(`   node ${outputFile}`);
  } catch (error) {
    console.error(`❌ Erreur: ${error.message}`);
    process.exit(1);
  }
}

main();
