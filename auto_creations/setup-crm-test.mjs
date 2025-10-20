#!/usr/bin/env node

/**
 * 🚀 CRM Complet - Installation Directus
 * 
 * Source: NocoDB
 * Gestion complète de la relation client
 * 
 * Collections: companies, contacts, deals, activities, tasks
 * 
 * Usage:
 *   $env:DIRECTUS_URL="http://127.0.0.1:8055"
 *   $env:DIRECTUS_TOKEN="your-token"
 *   node setup-crm-test.mjs
 */

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://127.0.0.1:8055';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || 'YOUR-TOKEN-HERE';
const VERBOSE = process.env.VERBOSE === 'true';
const TIMEOUT_MS = 15000;

async function api(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `${DIRECTUS_URL}${path}`;
    if (VERBOSE) console.log(`→ ${options.method || 'GET'} ${url}`);

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
    if (res.status === 204 || res.headers.get('content-length') === '0') return null;
    return await res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error(`Timeout: ${path}`);
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
  console.log(`\n📦 Création: ${collectionName}`);
  
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
      console.log(`  ↳ ${field.field} (${field.type})`);
      await api(`/fields/${collectionName}`, {
        method: 'POST',
        body: JSON.stringify(field)
      });
      await new Promise(r => setTimeout(r, 100));
    }
    
    console.log(`✅ ${collectionName} créée`);
  } catch (error) {
    if (error.message?.includes('already exists')) {
      console.log(`⚠️  ${collectionName} existe déjà`);
    } else {
      throw error;
    }
  }
}

async function main() {
  console.log('🚀 Installation du template: CRM Complet\n');
  console.log(`📍 URL: ${DIRECTUS_URL}\n`);
  
  try {
    // companies
    await createCollectionWithFields('companies',     [
          {
                "field": "name",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": true
                },
                "schema": {}
          },
          {
                "field": "industry",
                "type": "string",
                "meta": {
                      "interface": "select-dropdown",
                      "required": false,
                      "options": {
                            "choices": [
                                  {
                                        "text": "Technology",
                                        "value": "Technology"
                                  },
                                  {
                                        "text": "Finance",
                                        "value": "Finance"
                                  },
                                  {
                                        "text": "Healthcare",
                                        "value": "Healthcare"
                                  },
                                  {
                                        "text": "Manufacturing",
                                        "value": "Manufacturing"
                                  },
                                  {
                                        "text": "Retail",
                                        "value": "Retail"
                                  },
                                  {
                                        "text": "Other",
                                        "value": "Other"
                                  }
                            ]
                      }
                },
                "schema": {}
          },
          {
                "field": "size",
                "type": "string",
                "meta": {
                      "interface": "select-dropdown",
                      "required": false,
                      "options": {
                            "choices": [
                                  {
                                        "text": "1-10",
                                        "value": "1-10"
                                  },
                                  {
                                        "text": "11-50",
                                        "value": "11-50"
                                  },
                                  {
                                        "text": "51-200",
                                        "value": "51-200"
                                  },
                                  {
                                        "text": "201-500",
                                        "value": "201-500"
                                  },
                                  {
                                        "text": "500+",
                                        "value": "500+"
                                  }
                            ]
                      }
                },
                "schema": {}
          },
          {
                "field": "website",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "phone",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "email",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "address",
                "type": "text",
                "meta": {
                      "interface": "input-multiline",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "notes",
                "type": "text",
                "meta": {
                      "interface": "input-multiline",
                      "required": false
                },
                "schema": {}
          }
    ], {"icon":"business","note":"Companies and organizations"});

    // contacts
    await createCollectionWithFields('contacts',     [
          {
                "field": "first_name",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": true
                },
                "schema": {}
          },
          {
                "field": "last_name",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": true
                },
                "schema": {}
          },
          {
                "field": "email",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "phone",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "company_id",
                "type": "integer",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "position",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "linkedin",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "notes",
                "type": "text",
                "meta": {
                      "interface": "input-multiline",
                      "required": false
                },
                "schema": {}
          }
    ], {"icon":"people","note":"Contact persons"});

    // deals
    await createCollectionWithFields('deals',     [
          {
                "field": "title",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": true
                },
                "schema": {}
          },
          {
                "field": "company_id",
                "type": "integer",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "contact_id",
                "type": "integer",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "value",
                "type": "decimal",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {
                      "default_value": 0
                }
          },
          {
                "field": "stage",
                "type": "string",
                "meta": {
                      "interface": "select-dropdown",
                      "required": false,
                      "options": {
                            "choices": [
                                  {
                                        "text": "lead",
                                        "value": "lead"
                                  },
                                  {
                                        "text": "qualified",
                                        "value": "qualified"
                                  },
                                  {
                                        "text": "proposal",
                                        "value": "proposal"
                                  },
                                  {
                                        "text": "negotiation",
                                        "value": "negotiation"
                                  },
                                  {
                                        "text": "won",
                                        "value": "won"
                                  },
                                  {
                                        "text": "lost",
                                        "value": "lost"
                                  }
                            ]
                      }
                },
                "schema": {
                      "default_value": "lead"
                }
          },
          {
                "field": "probability",
                "type": "decimal",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {
                      "default_value": 0
                }
          },
          {
                "field": "expected_close_date",
                "type": "date",
                "meta": {
                      "interface": "datetime",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "notes",
                "type": "text",
                "meta": {
                      "interface": "input-multiline",
                      "required": false
                },
                "schema": {}
          }
    ], {"icon":"attach_money","note":"Sales opportunities"});

    // activities
    await createCollectionWithFields('activities',     [
          {
                "field": "title",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": true
                },
                "schema": {}
          },
          {
                "field": "type",
                "type": "string",
                "meta": {
                      "interface": "select-dropdown",
                      "required": false,
                      "options": {
                            "choices": [
                                  {
                                        "text": "call",
                                        "value": "call"
                                  },
                                  {
                                        "text": "email",
                                        "value": "email"
                                  },
                                  {
                                        "text": "meeting",
                                        "value": "meeting"
                                  },
                                  {
                                        "text": "task",
                                        "value": "task"
                                  },
                                  {
                                        "text": "note",
                                        "value": "note"
                                  }
                            ]
                      }
                },
                "schema": {}
          },
          {
                "field": "contact_id",
                "type": "integer",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "deal_id",
                "type": "integer",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "due_date",
                "type": "timestamp",
                "meta": {
                      "interface": "datetime",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "completed",
                "type": "boolean",
                "meta": {
                      "interface": "boolean",
                      "required": false
                },
                "schema": {
                      "default_value": false,
                      "is_nullable": false
                }
          },
          {
                "field": "notes",
                "type": "text",
                "meta": {
                      "interface": "input-multiline",
                      "required": false
                },
                "schema": {}
          }
    ], {"icon":"box","note":"Activities and interactions"});

    // tasks
    await createCollectionWithFields('tasks',     [
          {
                "field": "title",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": true
                },
                "schema": {}
          },
          {
                "field": "description",
                "type": "text",
                "meta": {
                      "interface": "input-multiline",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "deal_id",
                "type": "integer",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "due_date",
                "type": "date",
                "meta": {
                      "interface": "datetime",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "priority",
                "type": "string",
                "meta": {
                      "interface": "select-dropdown",
                      "required": false,
                      "options": {
                            "choices": [
                                  {
                                        "text": "low",
                                        "value": "low"
                                  },
                                  {
                                        "text": "medium",
                                        "value": "medium"
                                  },
                                  {
                                        "text": "high",
                                        "value": "high"
                                  }
                            ]
                      }
                },
                "schema": {
                      "default_value": "medium"
                }
          },
          {
                "field": "status",
                "type": "string",
                "meta": {
                      "interface": "select-dropdown",
                      "required": false,
                      "options": {
                            "choices": [
                                  {
                                        "text": "todo",
                                        "value": "todo"
                                  },
                                  {
                                        "text": "in_progress",
                                        "value": "in_progress"
                                  },
                                  {
                                        "text": "done",
                                        "value": "done"
                                  }
                            ]
                      }
                },
                "schema": {
                      "default_value": "todo"
                }
          }
    ], {"icon":"check_box","note":"Todo tasks"});

    console.log('\n✅ Template CRM Complet installé !');
    console.log('\n📊 Collections créées : 5');
    console.log('📝 Champs créés : 37');
  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
