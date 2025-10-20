#!/usr/bin/env node

/**
 * Script de création des collections Directus
 * Généré automatiquement par schema-converter.mjs
 * 
 * Usage:
 *   node asana-directus-setup.mjs
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
  console.log('🚀 Création des collections...\n');
  console.log(`📍 URL: ${DIRECTUS_URL}\n`);
  
  try {
    // project
    await createCollectionWithFields('project',     [
          {
                "field": "gid",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false,
                      "readonly": true
                },
                "schema": {}
          },
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
                "field": "notes",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "archived",
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
                "field": "color",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "created_at",
                "type": "timestamp",
                "meta": {
                      "interface": "datetime",
                      "required": false,
                      "readonly": true
                },
                "schema": {}
          },
          {
                "field": "current_status",
                "type": "string",
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
                "field": "due_on",
                "type": "date",
                "meta": {
                      "interface": "datetime",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "modified_at",
                "type": "timestamp",
                "meta": {
                      "interface": "datetime",
                      "required": false,
                      "readonly": true
                },
                "schema": {}
          },
          {
                "field": "owner_id",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "public",
                "type": "boolean",
                "meta": {
                      "interface": "boolean",
                      "required": false
                },
                "schema": {
                      "default_value": true,
                      "is_nullable": false
                }
          },
          {
                "field": "start_on",
                "type": "date",
                "meta": {
                      "interface": "datetime",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "workspace_id",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          }
    ], {"icon":"folder","note":"A project represents a prioritized list of tasks"});

    // task
    await createCollectionWithFields('task',     [
          {
                "field": "gid",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false,
                      "readonly": true
                },
                "schema": {}
          },
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
                "field": "notes",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "assignee_id",
                "type": "string",
                "meta": {
                      "interface": "input",
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
                "field": "completed_at",
                "type": "timestamp",
                "meta": {
                      "interface": "datetime",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "created_at",
                "type": "timestamp",
                "meta": {
                      "interface": "datetime",
                      "required": false,
                      "readonly": true
                },
                "schema": {}
          },
          {
                "field": "due_at",
                "type": "timestamp",
                "meta": {
                      "interface": "datetime",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "due_on",
                "type": "date",
                "meta": {
                      "interface": "datetime",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "liked",
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
                "field": "modified_at",
                "type": "timestamp",
                "meta": {
                      "interface": "datetime",
                      "required": false,
                      "readonly": true
                },
                "schema": {}
          },
          {
                "field": "num_likes",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false,
                      "readonly": true
                },
                "schema": {
                      "default_value": 0
                }
          },
          {
                "field": "num_subtasks",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false,
                      "readonly": true
                },
                "schema": {
                      "default_value": 0
                }
          },
          {
                "field": "parent_id",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "project_id",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "start_on",
                "type": "date",
                "meta": {
                      "interface": "datetime",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "workspace_id",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": true
                },
                "schema": {}
          }
    ], {"icon":"check_box","note":"The task is the basic object around which many operations revolve"});

    // user
    await createCollectionWithFields('user',     [
          {
                "field": "gid",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false,
                      "readonly": true
                },
                "schema": {}
          },
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
                "field": "email",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": true
                },
                "schema": {}
          },
          {
                "field": "photo",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "workspaces",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          }
    ], {"icon":"person","note":"A user object represents an account in Asana"});

    // team
    await createCollectionWithFields('team',     [
          {
                "field": "gid",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false,
                      "readonly": true
                },
                "schema": {}
          },
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
                "field": "description",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "organization_id",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          }
    ], {"icon":"groups","note":"A team is used to group related projects and people together"});

    // tag
    await createCollectionWithFields('tag',     [
          {
                "field": "gid",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false,
                      "readonly": true
                },
                "schema": {}
          },
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
                "field": "color",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "created_at",
                "type": "timestamp",
                "meta": {
                      "interface": "datetime",
                      "required": false,
                      "readonly": true
                },
                "schema": {}
          },
          {
                "field": "workspace_id",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          }
    ], {"icon":"label","note":"A tag is a label that can be attached to any task"});

    // section
    await createCollectionWithFields('section',     [
          {
                "field": "gid",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false,
                      "readonly": true
                },
                "schema": {}
          },
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
                "field": "created_at",
                "type": "timestamp",
                "meta": {
                      "interface": "datetime",
                      "required": false,
                      "readonly": true
                },
                "schema": {}
          },
          {
                "field": "project_id",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": true
                },
                "schema": {}
          }
    ], {"icon":"view_list","note":"A section is a subdivision of a project"});

    // story
    await createCollectionWithFields('story',     [
          {
                "field": "gid",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false,
                      "readonly": true
                },
                "schema": {}
          },
          {
                "field": "created_at",
                "type": "timestamp",
                "meta": {
                      "interface": "datetime",
                      "required": false,
                      "readonly": true
                },
                "schema": {}
          },
          {
                "field": "created_by_id",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false,
                      "readonly": true
                },
                "schema": {}
          },
          {
                "field": "text",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "type",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "task_id",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          }
    ], {"icon":"chat","note":"A story represents an activity associated with an object in Asana"});

    // attachment
    await createCollectionWithFields('attachment',     [
          {
                "field": "gid",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false,
                      "readonly": true
                },
                "schema": {}
          },
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
                "field": "created_at",
                "type": "timestamp",
                "meta": {
                      "interface": "datetime",
                      "required": false,
                      "readonly": true
                },
                "schema": {}
          },
          {
                "field": "download_url",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false,
                      "readonly": true
                },
                "schema": {}
          },
          {
                "field": "host",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "parent_id",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "size",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          },
          {
                "field": "view_url",
                "type": "string",
                "meta": {
                      "interface": "input",
                      "required": false
                },
                "schema": {}
          }
    ], {"icon":"attach_file","note":"An attachment object represents a file attached to a task"});

    console.log('\n✅ Toutes les collections ont été créées !');
  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
