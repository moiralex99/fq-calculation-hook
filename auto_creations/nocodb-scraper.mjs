#!/usr/bin/env node

/**
 * 🔧 NocoDB Template Scraper
 * 
 * Télécharge et convertit les templates NocoDB en format FlowQuartz/Directus
 * 
 * Usage:
 *   node nocodb-scraper.mjs --output templates/
 *   node nocodb-scraper.mjs --template crm --output crm-template.json
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================
// NOCODB TEMPLATE SOURCES
// ============================================

const NOCODB_TEMPLATES = {
  // Business & Operations
  'crm-complete': {
    name: 'CRM Complet',
    url: 'https://raw.githubusercontent.com/nocodb/nocodb-seed/main/CRM.json',
    description: 'Gestion complète de la relation client',
    collections: ['companies', 'contacts', 'deals', 'activities', 'tasks']
  },
  'project-management': {
    name: 'Gestion de Projets',
    url: 'https://raw.githubusercontent.com/nocodb/nocodb-seed/main/ProjectManagement.json',
    description: 'Suivi de projets avec tâches et jalons',
    collections: ['projects', 'tasks', 'milestones', 'team_members']
  },
  'inventory': {
    name: 'Gestion Inventaire',
    url: 'https://raw.githubusercontent.com/nocodb/nocodb-seed/main/Inventory.json',
    description: 'Suivi des stocks et commandes',
    collections: ['products', 'warehouses', 'orders', 'suppliers']
  },
  'hr-management': {
    name: 'Gestion RH',
    url: 'https://raw.githubusercontent.com/nocodb/nocodb-seed/main/HumanResources.json',
    description: 'Gestion des employés et recrutement',
    collections: ['employees', 'departments', 'positions', 'candidates', 'leaves']
  },
  'sales-pipeline': {
    name: 'Pipeline de Ventes',
    url: 'https://raw.githubusercontent.com/nocodb/nocodb-seed/main/SalesPipeline.json',
    description: 'Suivi des opportunités commerciales',
    collections: ['leads', 'opportunities', 'quotes', 'contracts']
  },
  'event-planning': {
    name: 'Planification Événements',
    url: 'https://raw.githubusercontent.com/nocodb/nocodb-seed/main/EventPlanning.json',
    description: 'Organisation d\'événements',
    collections: ['events', 'venues', 'attendees', 'tasks', 'budgets']
  },
  'real-estate': {
    name: 'Immobilier',
    url: 'https://raw.githubusercontent.com/nocodb/nocodb-seed/main/RealEstate.json',
    description: 'Gestion de biens immobiliers',
    collections: ['properties', 'clients', 'showings', 'contracts']
  },
  'issue-tracker': {
    name: 'Suivi de Bugs',
    url: 'https://raw.githubusercontent.com/nocodb/nocodb-seed/main/IssueTracker.json',
    description: 'Gestion de bugs et tickets',
    collections: ['issues', 'projects', 'users', 'comments']
  },
  'library-management': {
    name: 'Gestion Bibliothèque',
    url: 'https://raw.githubusercontent.com/nocodb/nocodb-seed/main/Library.json',
    description: 'Gestion de prêts de livres',
    collections: ['books', 'members', 'loans', 'categories']
  },
  'restaurant': {
    name: 'Gestion Restaurant',
    url: 'https://raw.githubusercontent.com/nocodb/nocodb-seed/main/Restaurant.json',
    description: 'Menu, commandes, réservations',
    collections: ['menu_items', 'orders', 'reservations', 'tables']
  }
};

// Backup : Structure manuelle si URLs ne marchent pas
const MANUAL_TEMPLATES = {
  'crm-complete': {
    tables: [
      {
        title: 'companies',
        description: 'Companies and organizations',
        columns: [
          { column_name: 'name', uidt: 'SingleLineText', required: true },
          { column_name: 'industry', uidt: 'SingleSelect', options: ['Technology', 'Finance', 'Healthcare', 'Manufacturing', 'Retail', 'Other'] },
          { column_name: 'size', uidt: 'SingleSelect', options: ['1-10', '11-50', '51-200', '201-500', '500+'] },
          { column_name: 'website', uidt: 'URL' },
          { column_name: 'phone', uidt: 'PhoneNumber' },
          { column_name: 'email', uidt: 'Email' },
          { column_name: 'address', uidt: 'LongText' },
          { column_name: 'notes', uidt: 'LongText' }
        ]
      },
      {
        title: 'contacts',
        description: 'Contact persons',
        columns: [
          { column_name: 'first_name', uidt: 'SingleLineText', required: true },
          { column_name: 'last_name', uidt: 'SingleLineText', required: true },
          { column_name: 'email', uidt: 'Email' },
          { column_name: 'phone', uidt: 'PhoneNumber' },
          { column_name: 'company_id', uidt: 'LinkToAnotherRecord', ref_table: 'companies' },
          { column_name: 'position', uidt: 'SingleLineText' },
          { column_name: 'linkedin', uidt: 'URL' },
          { column_name: 'notes', uidt: 'LongText' }
        ]
      },
      {
        title: 'deals',
        description: 'Sales opportunities',
        columns: [
          { column_name: 'title', uidt: 'SingleLineText', required: true },
          { column_name: 'company_id', uidt: 'LinkToAnotherRecord', ref_table: 'companies' },
          { column_name: 'contact_id', uidt: 'LinkToAnotherRecord', ref_table: 'contacts' },
          { column_name: 'value', uidt: 'Currency', default: 0 },
          { column_name: 'stage', uidt: 'SingleSelect', options: ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'], default: 'lead' },
          { column_name: 'probability', uidt: 'Percent', default: 0 },
          { column_name: 'expected_close_date', uidt: 'Date' },
          { column_name: 'notes', uidt: 'LongText' }
        ]
      },
      {
        title: 'activities',
        description: 'Activities and interactions',
        columns: [
          { column_name: 'title', uidt: 'SingleLineText', required: true },
          { column_name: 'type', uidt: 'SingleSelect', options: ['call', 'email', 'meeting', 'task', 'note'] },
          { column_name: 'contact_id', uidt: 'LinkToAnotherRecord', ref_table: 'contacts' },
          { column_name: 'deal_id', uidt: 'LinkToAnotherRecord', ref_table: 'deals' },
          { column_name: 'due_date', uidt: 'DateTime' },
          { column_name: 'completed', uidt: 'Checkbox', default: false },
          { column_name: 'notes', uidt: 'LongText' }
        ]
      },
      {
        title: 'tasks',
        description: 'Todo tasks',
        columns: [
          { column_name: 'title', uidt: 'SingleLineText', required: true },
          { column_name: 'description', uidt: 'LongText' },
          { column_name: 'deal_id', uidt: 'LinkToAnotherRecord', ref_table: 'deals' },
          { column_name: 'due_date', uidt: 'Date' },
          { column_name: 'priority', uidt: 'SingleSelect', options: ['low', 'medium', 'high'], default: 'medium' },
          { column_name: 'status', uidt: 'SingleSelect', options: ['todo', 'in_progress', 'done'], default: 'todo' }
        ]
      }
    ]
  },
  'project-management': {
    tables: [
      {
        title: 'projects',
        columns: [
          { column_name: 'name', uidt: 'SingleLineText', required: true },
          { column_name: 'description', uidt: 'LongText' },
          { column_name: 'status', uidt: 'SingleSelect', options: ['planning', 'active', 'on_hold', 'completed', 'cancelled'], default: 'planning' },
          { column_name: 'start_date', uidt: 'Date' },
          { column_name: 'end_date', uidt: 'Date' },
          { column_name: 'budget', uidt: 'Currency' },
          { column_name: 'priority', uidt: 'SingleSelect', options: ['low', 'medium', 'high'], default: 'medium' }
        ]
      },
      {
        title: 'tasks',
        columns: [
          { column_name: 'title', uidt: 'SingleLineText', required: true },
          { column_name: 'description', uidt: 'LongText' },
          { column_name: 'project_id', uidt: 'LinkToAnotherRecord', ref_table: 'projects' },
          { column_name: 'status', uidt: 'SingleSelect', options: ['todo', 'in_progress', 'review', 'done'], default: 'todo' },
          { column_name: 'priority', uidt: 'SingleSelect', options: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
          { column_name: 'due_date', uidt: 'Date' },
          { column_name: 'estimated_hours', uidt: 'Number' },
          { column_name: 'actual_hours', uidt: 'Number' }
        ]
      },
      {
        title: 'milestones',
        columns: [
          { column_name: 'name', uidt: 'SingleLineText', required: true },
          { column_name: 'project_id', uidt: 'LinkToAnotherRecord', ref_table: 'projects' },
          { column_name: 'due_date', uidt: 'Date' },
          { column_name: 'completed', uidt: 'Checkbox', default: false },
          { column_name: 'notes', uidt: 'LongText' }
        ]
      },
      {
        title: 'team_members',
        columns: [
          { column_name: 'name', uidt: 'SingleLineText', required: true },
          { column_name: 'email', uidt: 'Email' },
          { column_name: 'role', uidt: 'SingleSelect', options: ['developer', 'designer', 'manager', 'qa', 'other'] },
          { column_name: 'hourly_rate', uidt: 'Currency' }
        ]
      }
    ]
  }
};

// ============================================
// TYPE MAPPINGS
// ============================================

const NOCODB_TO_DIRECTUS = {
  // Text types
  'SingleLineText': 'string',
  'LongText': 'text',
  'RichText': 'text',
  
  // Number types
  'Number': 'integer',
  'Decimal': 'decimal',
  'Currency': 'decimal',
  'Percent': 'decimal',
  'Duration': 'integer',
  'Rating': 'integer',
  
  // Date types
  'Date': 'date',
  'DateTime': 'timestamp',
  'Time': 'time',
  
  // Boolean
  'Checkbox': 'boolean',
  
  // Selection
  'SingleSelect': 'string',
  'MultiSelect': 'json',
  
  // Relations
  'LinkToAnotherRecord': 'integer', // Will be converted to M2O/O2M
  
  // Special
  'Email': 'string',
  'PhoneNumber': 'string',
  'URL': 'string',
  'Attachment': 'uuid', // Directus file
  'User': 'uuid',
  'CreatedTime': 'timestamp',
  'LastModifiedTime': 'timestamp',
  'CreatedBy': 'uuid',
  'LastModifiedBy': 'uuid',
  'AutoNumber': 'integer',
  'Barcode': 'string',
  'Button': 'json',
  'Collaborator': 'json',
  'Count': 'integer',
  'Formula': 'string',
  'Lookup': 'string',
  'Rollup': 'decimal',
  'QRCode': 'string',
  'Geometry': 'json',
  'JSON': 'json'
};

const INTERFACE_MAPPINGS = {
  'SingleLineText': 'input',
  'LongText': 'input-multiline',
  'RichText': 'input-rich-text-md',
  'Number': 'input',
  'Decimal': 'input',
  'Currency': 'input',
  'Percent': 'input',
  'Date': 'datetime',
  'DateTime': 'datetime',
  'Time': 'datetime',
  'Checkbox': 'boolean',
  'SingleSelect': 'select-dropdown',
  'MultiSelect': 'select-multiple-dropdown',
  'Email': 'input',
  'PhoneNumber': 'input',
  'URL': 'input',
  'Attachment': 'file',
  'User': 'select-dropdown-m2o'
};

// ============================================
// DOWNLOAD HELPER
// ============================================

async function downloadTemplate(url) {
  try {
    console.log(`📥 Téléchargement: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.warn(`⚠️  Impossible de télécharger ${url}: ${error.message}`);
    return null;
  }
}

// ============================================
// CONVERSION FUNCTIONS
// ============================================

function convertNocoDBColumn(column) {
  const type = NOCODB_TO_DIRECTUS[column.uidt] || 'string';
  const interfaceType = INTERFACE_MAPPINGS[column.uidt] || 'input';
  
  const field = {
    field: column.column_name,
    type: type,
    meta: {
      interface: interfaceType,
      required: column.required || false
    },
    schema: {}
  };
  
  // Handle default values
  if (column.default !== undefined && column.default !== null) {
    field.schema.default_value = column.default;
  }
  
  // Handle booleans (SQLite compatibility)
  if (type === 'boolean') {
    field.schema.default_value = column.default ?? false;
    field.schema.is_nullable = false;
  }
  
  // Handle select options
  if (column.uidt === 'SingleSelect' && column.options) {
    field.meta.options = {
      choices: column.options.map(opt => ({
        text: opt,
        value: opt
      }))
    };
  }
  
  // Handle readonly (formulas, auto fields)
  if (['Formula', 'Rollup', 'Count', 'AutoNumber', 'CreatedTime', 'LastModifiedTime'].includes(column.uidt)) {
    field.meta.readonly = true;
  }
  
  return field;
}

function convertNocoDBTable(table) {
  const fields = [];
  
  // Convert columns
  for (const column of table.columns || []) {
    // Skip system columns
    if (['id', 'created_at', 'updated_at'].includes(column.column_name)) {
      continue;
    }
    
    const field = convertNocoDBColumn(column);
    fields.push(field);
  }
  
  return {
    name: normalizeCollectionName(table.title),
    fields: fields,
    meta: {
      icon: getIconForCollection(table.title),
      note: table.description || ''
    }
  };
}

function normalizeCollectionName(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function getIconForCollection(name) {
  const iconMap = {
    'companies': 'business',
    'contacts': 'people',
    'deals': 'attach_money',
    'projects': 'folder',
    'tasks': 'check_box',
    'employees': 'badge',
    'products': 'inventory',
    'orders': 'shopping_cart',
    'events': 'event',
    'properties': 'home',
    'issues': 'bug_report',
    'books': 'menu_book'
  };
  
  const normalized = normalizeCollectionName(name);
  return iconMap[normalized] || 'box';
}

// ============================================
// MAIN SCRAPER
// ============================================

async function scrapeNocoDB(options = {}) {
  const { template, outputDir = 'templates/nocodb', verbose = false } = options;
  
  console.log('🔧 NocoDB Template Scraper\n');
  
  // Create output directory
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
    console.log(`📁 Dossier créé: ${outputDir}\n`);
  }
  
  // Get templates to process
  const templatesToProcess = template
    ? { [template]: NOCODB_TEMPLATES[template] }
    : NOCODB_TEMPLATES;
  
  const results = [];
  
  for (const [key, templateInfo] of Object.entries(templatesToProcess)) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📦 Template: ${templateInfo.name}`);
    console.log(`${'='.repeat(60)}\n`);
    
    // Try to download
    let nocoData = await downloadTemplate(templateInfo.url);
    
    // Fallback to manual structure if download fails
    if (!nocoData) {
      console.log('⚠️  URL NocoDB non disponible, utilisation du template manuel de secours');
      // Use manual template if exists
      if (MANUAL_TEMPLATES[key]) {
        nocoData = MANUAL_TEMPLATES[key];
      } else {
        // Generate basic template
        nocoData = { tables: [] };
      }
    }
    
    if (!nocoData) {
      console.log(`❌ Template ${key} non disponible\n`);
      continue;
    }
    
    // Convert tables to collections
    const collections = [];
    for (const table of nocoData.tables || []) {
      console.log(`  ↳ Table: ${table.title} (${table.columns?.length || 0} colonnes)`);
      const collection = convertNocoDBTable(table);
      collections.push(collection);
    }
    
    // Create template metadata
    const template = {
      name: templateInfo.name,
      key: key,
      description: templateInfo.description,
      collections: collections,
      version: '1.0.0',
      source: 'NocoDB',
      created_at: new Date().toISOString()
    };
    
    // Save to file
    const outputFile = join(outputDir, `${key}.json`);
    writeFileSync(outputFile, JSON.stringify(template, null, 2));
    console.log(`\n✅ Sauvegardé: ${outputFile}`);
    console.log(`   📊 ${collections.length} collections`);
    console.log(`   📝 ${collections.reduce((sum, c) => sum + c.fields.length, 0)} champs au total`);
    
    results.push({
      key,
      name: templateInfo.name,
      collections: collections.length,
      file: outputFile
    });
  }
  
  // Summary
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('📊 RÉSUMÉ');
  console.log(`${'='.repeat(60)}\n`);
  console.log(`Templates téléchargés: ${results.length}`);
  console.log(`Collections totales: ${results.reduce((sum, r) => sum + r.collections, 0)}`);
  console.log(`\nFichiers créés:`);
  results.forEach(r => {
    console.log(`  ✅ ${r.name} (${r.collections} collections)`);
  });
  
  return results;
}

// ============================================
// CLI
// ============================================

function printUsage() {
  console.log(`
🔧 NocoDB Template Scraper

Usage:
  node nocodb-scraper.mjs [options]

Options:
  --template <name>    Template spécifique à télécharger
  --output <dir>       Dossier de sortie (défaut: templates/nocodb)
  --list              Liste les templates disponibles
  --verbose           Mode verbose

Templates disponibles:
${Object.entries(NOCODB_TEMPLATES).map(([key, info]) => `  - ${key.padEnd(20)} ${info.name}`).join('\n')}

Exemples:
  # Télécharger tous les templates
  node nocodb-scraper.mjs

  # Télécharger CRM seulement
  node nocodb-scraper.mjs --template crm-complete

  # Dossier personnalisé
  node nocodb-scraper.mjs --output my-templates/
`);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }
  
  if (args.includes('--list')) {
    console.log('\n📋 Templates NocoDB disponibles:\n');
    Object.entries(NOCODB_TEMPLATES).forEach(([key, info]) => {
      console.log(`  📦 ${key}`);
      console.log(`     ${info.name}`);
      console.log(`     ${info.description}`);
      console.log(`     Collections: ${info.collections.join(', ')}\n`);
    });
    process.exit(0);
  }
  
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--template') {
      options.template = args[++i];
    } else if (args[i] === '--output') {
      options.outputDir = args[++i];
    } else if (args[i] === '--verbose') {
      options.verbose = true;
    }
  }
  
  try {
    await scrapeNocoDB(options);
    console.log('\n🎉 Terminé !\n');
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
