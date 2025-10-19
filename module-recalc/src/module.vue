<template>
  <private-view title="Recalcul des formules">
    <template #headline>Formules</template>
    <template #title-outer:prepend>
      <v-button class="header-icon" rounded disabled icon secondary>
        <v-icon name="auto_graph" />
      </v-button>
    </template>

    <template #actions>
      <v-button
        v-if="!loadingConfig && !configError"
        rounded
        icon
        @click="clearCache"
        v-tooltip="'Vider le cache'"
        :loading="clearingCache"
      >
        <v-icon name="delete_sweep" />
      </v-button>
      <v-button
        v-if="!loadingConfig && !configError"
        rounded
        icon
        @click="loadFormulas"
        v-tooltip="'Recharger'"
      >
        <v-icon name="refresh" />
      </v-button>
    </template>

    <div class="recalc-module">
      <div v-if="loadingConfig" class="recalc-loading">
        <v-progress-circular indeterminate :size="32" />
        <span>Chargement des formules…</span>
      </div>

      <v-notice v-else-if="configError" type="danger" icon="error">
        {{ configError }}
      </v-notice>

      <div v-else class="recalc-container">
        <!-- Result Alert - Top -->
        <div v-if="result && !running" class="result-card">
          <div class="result-card-header" :class="result.success ? 'result-success' : 'result-warning'">
            <div class="result-icon">
              <v-icon :name="result.success ? 'check_circle' : 'warning'" large />
            </div>
            <div class="result-main">
              <h3 class="result-title">
                {{ result.message || (result.success ? 'Recalcul terminé avec succès' : 'Recalcul terminé avec des erreurs') }}
              </h3>
              <div class="result-meta">
                <span class="result-collection">
                  <v-icon name="storage" x-small />
                  {{ result.collection }}
                </span>
                <span v-if="result.fields && result.fields.length" class="result-fields-count">
                  {{ result.fields.length }} champ(s) recalculé(s)
                </span>
                <span v-if="result.dryRun" class="result-badge result-badge-dry">
                  <v-icon name="visibility" x-small />
                  Dry Run
                </span>
              </div>
            </div>
          </div>
          <div class="result-stats">
            <div class="result-stat">
              <div class="result-stat-icon">
                <v-icon name="check_circle" small />
              </div>
              <div class="result-stat-content">
                <span class="result-stat-label">Items traités</span>
                <span class="result-stat-value">{{ result.processed ?? '–' }}</span>
              </div>
            </div>
            <div class="result-stat">
              <div class="result-stat-icon">
                <v-icon name="edit" small />
              </div>
              <div class="result-stat-content">
                <span class="result-stat-label">Items modifiés</span>
                <span class="result-stat-value">{{ result.updated ?? '–' }}</span>
              </div>
            </div>
            <div class="result-stat" v-if="result.total !== undefined">
              <div class="result-stat-icon">
                <v-icon name="dataset" small />
              </div>
              <div class="result-stat-content">
                <span class="result-stat-label">Total</span>
                <span class="result-stat-value">{{ result.total }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Progress Bar -->
        <div v-if="running" class="progress-card">
          <div class="progress-header">
            <span class="progress-title">Recalculation en cours...</span>
            <span class="progress-status">Traitement des données</span>
          </div>
          <v-progress-linear indeterminate />
          <div class="progress-details">
            <span>Collection: {{ selectedCollection }}</span>
            <span v-if="selectedFields.length">{{ selectedFields.length }} champ(s) sélectionné(s)</span>
          </div>
        </div>

        <!-- Formula Tester - Collapsible -->
        <details class="formula-tester-card">
          <summary class="formula-tester-header">
            <v-icon name="science" small />
            <span>Testeur de Formule</span>
            <span class="formula-tester-badge">Nouveau</span>
          </summary>
          <div class="formula-tester-body">
            <div class="form-group">
              <label class="form-label">Formule à tester</label>
              <v-textarea
                v-model="testFormula"
                placeholder='Exemple: {{prix_ht}} * (1 + {{tva_rate}})'
                rows="2"
                font-family="monospace"
              />
              <span class="form-hint">Utilisez la syntaxe DSL avec {{champ}}</span>
            </div>

            <div class="form-group">
              <label class="form-label">Données de test (JSON)</label>
              <v-textarea
                v-model="testSampleData"
                placeholder='{"prix_ht": 100, "tva_rate": 0.2}'
                rows="3"
                font-family="monospace"
              />
              <span class="form-hint">Fournissez les valeurs pour chaque champ utilisé dans la formule</span>
              <span v-if="testFormulaError" class="form-error">{{ testFormulaError }}</span>
            </div>

            <div class="form-actions">
              <v-button
                @click="runTestFormula"
                :loading="testingFormula"
                :disabled="!testFormula.trim()"
              >
                <v-icon name="play_arrow" left />
                Tester
              </v-button>
              <v-button
                @click="resetTestFormula"
                :disabled="testingFormula"
                secondary
              >
                Réinitialiser
              </v-button>
            </div>

            <!-- Test Result -->
            <div v-if="testFormulaResult" class="test-result-card" :class="testFormulaResult.valid ? 'test-result-success' : 'test-result-error'">
              <div class="test-result-header">
                <v-icon :name="testFormulaResult.valid ? 'check_circle' : 'error'" />
                <span class="test-result-title">
                  {{ testFormulaResult.valid ? 'Formule valide' : 'Formule invalide' }}
                </span>
              </div>
              <div v-if="testFormulaResult.valid" class="test-result-details">
                <div class="test-result-row">
                  <span class="test-result-label">Résultat :</span>
                  <span class="test-result-value">{{ testFormulaResult.result }}</span>
                </div>
                <div class="test-result-row" v-if="testFormulaResult.fields && testFormulaResult.fields.length">
                  <span class="test-result-label">Dépendances :</span>
                  <span class="test-result-value">{{ testFormulaResult.fields.join(', ') }}</span>
                </div>
                <div class="test-result-row">
                  <span class="test-result-label">Type :</span>
                  <span class="test-result-badge" :class="testFormulaResult.isLocal ? 'badge-local' : 'badge-relational'">
                    {{ testFormulaResult.isLocal ? 'Locale' : 'Relationnelle' }}
                  </span>
                </div>
              </div>
              <div v-else class="test-result-error-msg">
                {{ testFormulaResult.error }}
              </div>
            </div>
          </div>
        </details>

        <!-- Main Content Grid -->
        <div class="content-grid">
          <!-- Left: Configuration Form -->
          <div class="config-card">
            <div class="card-header">
              <h3 class="card-title">Configuration</h3>
            </div>
            <div class="card-body">
              <div class="form-group">
                <div class="select-group-header">
                  <div class="select-group-titles">
                    <label class="form-label">Collection</label>
                    <span class="form-subtitle">Choisissez la source à recalculer</span>
                  </div>
                  <span class="select-count" v-if="collectionOptions.length">
                    {{ filteredCollectionOptions.length }} / {{ collectionOptions.length }}
                  </span>
                </div>
                <input
                  class="select-search"
                  type="search"
                  v-model.trim="collectionSearch"
                  :disabled="collectionOptions.length === 0"
                  placeholder="Rechercher une collection..."
                />
                <v-select
                  :items="filteredCollectionOptions"
                  :disabled="collectionOptions.length === 0"
                  placeholder="Sélectionnez une collection..."
                  v-model="selectedCollection"
                />
                <span
                  v-if="collectionSearch && filteredCollectionOptions.length === 0"
                  class="form-hint form-hint-warning"
                >
                  Aucune collection ne correspond à cette recherche
                </span>
              </div>

              <div class="form-group">
                <label class="form-label">Champs à recalculer</label>
                <div class="fields-container">
                  <div class="fields-header">
                    <div class="fields-header-top">
                      <div class="fields-header-title">
                        <input 
                          type="checkbox" 
                          id="selectAllFields" 
                          :checked="allDisplayedFieldsSelected"
                          :indeterminate.prop="someDisplayedFieldsSelected"
                          @change="toggleAllFields"
                          :disabled="!selectedCollection || availableFields.length === 0 || filteredFields.length === 0"
                        >
                        <label for="selectAllFields">Sélectionner tout</label>
                      </div>
                      <span class="fields-count" v-if="availableFields.length">
                        {{ filteredFields.length }} / {{ availableFields.length }}
                      </span>
                    </div>
                    <input
                      class="fields-search"
                      type="search"
                      v-model.trim="fieldSearch"
                      :disabled="!selectedCollection || availableFields.length === 0"
                      placeholder="Rechercher un champ..."
                    />
                  </div>
                  <div v-if="!selectedCollection" class="fields-empty">
                    Sélectionnez d'abord une collection
                  </div>
                  <div v-else-if="availableFields.length === 0" class="fields-empty">
                    Aucune formule trouvée pour cette collection
                  </div>
                  <div v-else-if="filteredFields.length === 0" class="fields-empty">
                    Aucun champ ne correspond à cette recherche
                  </div>
                  <template v-else>
                    <div 
                      v-for="field in filteredFields" 
                      :key="field"
                      class="field-item"
                      @click="toggleField(field)"
                    >
                      <input 
                        type="checkbox" 
                        :id="`field_${field}`"
                        :value="field"
                        v-model="selectedFields"
                        @click.stop
                      >
                      <label :for="`field_${field}`">{{ field }}</label>
                    </div>
                  </template>
                </div>
                <span class="form-hint">Laissez vide pour recalculer tous les champs</span>
              </div>

              <div class="form-group">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
                  <label class="form-label" style="margin: 0;">Filtre (optionnel)</label>
                  <div style="display: flex; align-items: center; gap: 0.35rem;">
                    <input 
                      type="checkbox" 
                      id="excludeArchived"
                      v-model="excludeArchived"
                      style="margin: 0;"
                    >
                    <label for="excludeArchived" style="margin: 0; cursor: pointer; font-size: 0.75rem; color: var(--theme--foreground-subdued);">
                      Exclure archivés
                    </label>
                  </div>
                </div>
                <v-textarea
                  v-model="filterInput"
                  placeholder='{"status": {"_eq": "published"}}'
                  rows="2"
                />
                <span class="form-hint">Filtre JSON pour sélectionner les items à traiter</span>
                <span v-if="filterError" class="form-error">{{ filterError }}</span>
              </div>

              <div class="form-group">
                <label class="form-label">Taille de batch</label>
                <v-input
                  v-model.number="batchSize"
                  type="number"
                  :min="1"
                  :max="500"
                  placeholder="100"
                />
                <span class="form-hint">Nombre d'items traités par lot (recommandé: 100)</span>
              </div>

              <div class="form-group">
                <v-checkbox
                  v-model="dryRun"
                  label="Mode test (Dry Run) - Ne modifie pas les données"
                />
              </div>

              <div class="form-actions">
                <v-button
                  :loading="running"
                  :disabled="!canRun"
                  @click="runRecalculate"
                  large
                >
                  <v-icon name="play_arrow" left />
                  Lancer la recalculation
                </v-button>
                <v-button
                  :loading="previewing"
                  :disabled="!selectedCollection || running"
                  @click="runPreview"
                  secondary
                  large
                >
                  <v-icon name="visibility" left />
                  Aperçu (1 item)
                </v-button>
                <v-button
                  @click="resetForm"
                  :disabled="running || previewing"
                  secondary
                >
                  Réinitialiser
                </v-button>
              </div>
            </div>
          </div>

          <!-- Right: Stats & Recent Formulas -->
          <div class="sidebar">
            <!-- Stats Card -->
            <div class="stats-card">
              <div class="card-header">
                <h3 class="card-title">Statistiques</h3>
              </div>
              <div class="card-body">
                <div class="stats-grid">
                  <div class="stat-box">
                    <div class="stat-label">Formulas</div>
                    <div class="stat-value">{{ formulas.length }}</div>
                  </div>
                  <div class="stat-box">
                    <div class="stat-label">Collections</div>
                    <div class="stat-value">{{ Object.keys(formulasByCollection).length }}</div>
                  </div>
                </div>
                <div class="info-box" v-if="selectedCollection">
                  <div class="info-box-label">Collection sélectionnée</div>
                  <div class="info-box-value">{{ selectedCollection }}</div>
                  <div class="info-box-detail">{{ availableFields.length }} formule(s) disponible(s)</div>
                </div>
              </div>
            </div>

            <!-- Recent Formulas Card -->
            <div class="recent-card">
              <div class="card-header">
                <h3 class="card-title">Formules récentes</h3>
                <span class="badge badge-success">Live</span>
              </div>
              <div class="formula-list">
                <div 
                  v-for="formula in recentFormulas" 
                  :key="formula.id"
                  class="formula-item"
                  @click="selectFormulaCollection(formula)"
                >
                  <div class="formula-item-header">
                    <div class="formula-name">{{ formula.champ_cible }}</div>
                    <div class="formula-collection">{{ formula.collection_cible }}</div>
                  </div>
                  <div class="formula-code">{{ formula.formula }}</div>
                  <div class="formula-meta">
                    <span>{{ formula.scope }}</span>
                  </div>
                </div>
                <div v-if="formulas.length === 0" class="formula-empty">
                  Aucune formule disponible
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Debug: JSON Result -->
        <details v-if="result" class="result-json">
          <summary>Voir la réponse complète (JSON)</summary>
          <pre>{{ formattedResult }}</pre>
        </details>
      </div>
    </div>
  </private-view>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useApi, useStores } from '@directus/extensions-sdk';

const api = useApi();
// Notifications wrapper compatible across Directus versions
let notify = ({ title, message, type }) => {
  // Fallback logger if notifications store isn't available
  const text = message ?? '';
  if (type === 'error' || type === 'danger') console.error(title, text);
  else if (type === 'warning') console.warn(title, text);
  else console.log(title, text);
};

try {
  const stores = typeof useStores === 'function' ? useStores() : null;
  const notificationsStore = stores?.useNotificationsStore?.();
  if (notificationsStore?.add) {
    notify = ({ title, message, type }) =>
      notificationsStore.add({ title, message, text: message, type });
  }
} catch (_err) {
  // ignore and keep console fallback
}

const loadingConfig = ref(true);
const configError = ref(null);
const formulas = ref([]);
const selectedCollection = ref(null);
const selectedFields = ref([]);
const collectionSearch = ref('');
const fieldSearch = ref('');
const filterInput = ref('');
const filterError = ref(null);
const excludeArchived = ref(true); // Exclure les archivés par défaut
const batchSize = ref(100);
const dryRun = ref(false);
const running = ref(false);
const result = ref(null);

// Preview state
const previewing = ref(false);

// Formula tester state
const testFormula = ref('');
const testSampleData = ref('{}');
const testingFormula = ref(false);
const testFormulaResult = ref(null);
const testFormulaError = ref(null);

// Clear cache state
const clearingCache = ref(false);

// Grouper les formules par collection
const formulasByCollection = computed(() => {
  const grouped = {};
  for (const formula of formulas.value) {
    const collection = formula.collection_cible;
    if (!grouped[collection]) {
      grouped[collection] = [];
    }
    grouped[collection].push(formula);
  }
  return grouped;
});

const collectionOptions = computed(() =>
  Object.entries(formulasByCollection.value).map(([collection, formulas]) => ({
    value: collection,
    text: `${collection} (${formulas.length} formule${formulas.length > 1 ? 's' : ''})`,
  }))
);

const availableFields = computed(() => {
  if (!selectedCollection.value) return [];
  const collectionFormulas = formulasByCollection.value[selectedCollection.value] || [];
  return collectionFormulas.map(f => f.champ_cible);
});

const filteredCollectionOptions = computed(() => {
  if (!collectionSearch.value.trim()) return collectionOptions.value;
  const query = collectionSearch.value.trim().toLowerCase();
  return collectionOptions.value.filter(({ value, text }) => {
    const base = `${value ?? ''}`.toLowerCase();
    const label = `${text ?? ''}`.toLowerCase();
    return base.includes(query) || label.includes(query);
  });
});

const filteredFields = computed(() => {
  const fields = availableFields.value;
  if (!fieldSearch.value.trim()) return fields;
  const query = fieldSearch.value.trim().toLowerCase();
  return fields.filter((field) => field.toLowerCase().includes(query));
});

const allDisplayedFieldsSelected = computed(() => {
  if (!filteredFields.value.length) return false;
  return filteredFields.value.every((field) => selectedFields.value.includes(field));
});

const someDisplayedFieldsSelected = computed(() => {
  if (!filteredFields.value.length) return false;
  const selectedInView = filteredFields.value.filter((field) => selectedFields.value.includes(field));
  return selectedInView.length > 0 && selectedInView.length < filteredFields.value.length;
});

const recentFormulas = computed(() => {
  // Show last 5 formulas sorted by date_updated DESC
  return [...formulas.value]
    .sort((a, b) => {
      const dateA = a.date_updated ? new Date(a.date_updated) : new Date(0);
      const dateB = b.date_updated ? new Date(b.date_updated) : new Date(0);
      return dateB - dateA; // DESC
    })
    .slice(0, 5);
});

const canRun = computed(() => Boolean(selectedCollection.value) && !running.value);

const formattedResult = computed(() => (result.value ? JSON.stringify(result.value, null, 2) : ''));

// Toggle all fields
function toggleAllFields(event) {
  const targetFields = filteredFields.value.length ? filteredFields.value : availableFields.value;
  if (!targetFields.length) return;

  if (event.target.checked) {
    const merged = new Set([...selectedFields.value, ...targetFields]);
    selectedFields.value = availableFields.value.filter((field) => merged.has(field));
  } else {
    const removal = new Set(targetFields);
    selectedFields.value = selectedFields.value.filter((field) => !removal.has(field));
  }
}

// Toggle individual field
function toggleField(field) {
  const index = selectedFields.value.indexOf(field);
  if (index > -1) {
    selectedFields.value.splice(index, 1);
  } else {
    selectedFields.value.push(field);
  }
}

// Select collection from formula click
function selectFormulaCollection(formula) {
  collectionSearch.value = '';
  selectedCollection.value = formula.collection_cible;
}

// Reset form
function resetForm() {
  selectedCollection.value = null;
  selectedFields.value = [];
  collectionSearch.value = '';
  fieldSearch.value = '';
  filterInput.value = '';
  filterError.value = null;
  batchSize.value = 100;
  dryRun.value = false;
  result.value = null;
}

watch(selectedCollection, (collection) => {
  result.value = null;
  filterError.value = null;
  fieldSearch.value = '';
  if (!collection) {
    selectedFields.value = [];
    return;
  }
  // Auto-select all fields when changing collection
  const collectionFormulas = formulasByCollection.value[collection] || [];
  const defaults = collectionFormulas.map(f => f.champ_cible);
  selectedFields.value = defaults;
});

watch(filterInput, () => {
  filterError.value = null;
});

async function loadFormulas() {
  loadingConfig.value = true;
  configError.value = null;
  try {
    console.log('[Module] Chargement des formules depuis quartz_formulas...');
    const { data } = await api.get('/items/quartz_formulas', {
      params: {
        limit: -1,
        fields: ['id', 'collection_cible', 'champ_cible', 'formula', 'scope', 'status', 'date_updated']
      }
    });
    console.log('[Module] Formules reçues:', data);
    formulas.value = data?.data || [];
    console.log('[Module] Nombre de formules:', formulas.value.length);
    
    if (Object.keys(formulasByCollection.value).length === 0) {
      selectedCollection.value = null;
    } else if (!selectedCollection.value) {
      selectedCollection.value = Object.keys(formulasByCollection.value)[0];
    }
  } catch (error) {
    console.error('[Module] Erreur lors du chargement:', error);
    const message = error?.response?.data?.errors?.[0]?.message || error?.message || String(error);
    configError.value = message;
    notify({
      title: 'Erreur de chargement',
      message,
      type: 'error',
    });
  } finally {
    loadingConfig.value = false;
  }
}

async function clearCache() {
  clearingCache.value = true;
  try {
    await api.post('/realtime-calc/clear-cache');
    notify({
      title: 'Cache vidé',
      message: 'Le cache des formules a été vidé avec succès',
      type: 'success',
    });
  } catch (error) {
    const message = error?.response?.data?.error || error?.message || String(error);
    notify({
      title: 'Erreur',
      message: `Impossible de vider le cache: ${message}`,
      type: 'error',
    });
  } finally {
    clearingCache.value = false;
  }
}

async function runTestFormula() {
  if (!testFormula.value.trim()) {
    return;
  }

  testingFormula.value = true;
  testFormulaResult.value = null;
  testFormulaError.value = null;

  try {
    let sampleData = {};
    if (testSampleData.value && testSampleData.value.trim()) {
      try {
        sampleData = JSON.parse(testSampleData.value);
      } catch (error) {
        testFormulaError.value = `JSON invalide: ${error.message}`;
        testingFormula.value = false;
        return;
      }
    }

    const { data } = await api.post('/realtime-calc/test-formula', {
      formula: testFormula.value,
      sampleData
    });

    testFormulaResult.value = data;

    if (data.valid) {
      notify({
        title: 'Formule valide',
        message: `Résultat: ${data.result}`,
        type: 'success',
      });
    } else {
      notify({
        title: 'Formule invalide',
        message: data.error,
        type: 'error',
      });
    }
  } catch (error) {
    const message = error?.response?.data?.error || error?.message || String(error);
    testFormulaError.value = message;
    notify({
      title: 'Erreur test',
      message,
      type: 'error',
    });
  } finally {
    testingFormula.value = false;
  }
}

function resetTestFormula() {
  testFormula.value = '';
  testSampleData.value = '{}';
  testFormulaResult.value = null;
  testFormulaError.value = null;
}

onMounted(loadFormulas);

function parseFilterInput() {
  let userFilter = null;
  
  if (filterInput.value && filterInput.value.trim()) {
    try {
      userFilter = JSON.parse(filterInput.value);
      filterError.value = null;
    } catch (error) {
      filterError.value = error?.message || String(error);
      throw error;
    }
  }

  // Si "Exclure archivés" est coché, on ajoute le filtre status != archived
  if (excludeArchived.value) {
    const archiveFilter = { status: { _neq: 'archived' } };
    
    if (!userFilter) {
      return archiveFilter;
    }
    
    // Merge les filtres : si userFilter a déjà _and, on ajoute dedans, sinon on crée _and
    if (userFilter._and) {
      return { _and: [...userFilter._and, archiveFilter] };
    } else {
      return { _and: [userFilter, archiveFilter] };
    }
  }

  return userFilter;
}

async function runPreview() {
  if (!selectedCollection.value) {
    notify({
      title: 'Collection manquante',
      message: 'Choisis une collection à prévisualiser.',
      type: 'warning',
    });
    return;
  }

  previewing.value = true;
  filterError.value = null;

  try {
    let filter = null;
    try {
      filter = parseFilterInput();
    } catch (error) {
      notify({
        title: 'Filtre invalide',
        message: "Ton filtre JSON n'est pas valide.",
        type: 'error',
      });
      previewing.value = false;
      return;
    }

    // Fetch 1 item from collection
    const fetchParams = {
      limit: 1,
      fields: ['*']
    };
    if (filter) {
      fetchParams.filter = filter;
    }

    const { data: itemsData } = await api.get(`/items/${selectedCollection.value}`, { params: fetchParams });
    const items = itemsData?.data || [];

    if (items.length === 0) {
      notify({
        title: 'Aucun item',
        message: 'Aucun item trouvé avec le filtre actuel.',
        type: 'warning',
      });
      previewing.value = false;
      return;
    }

    const item = items[0];

    // Calculate preview using /calculate endpoint
    const fields = selectedFields.value.length > 0 ? selectedFields.value : null;
    const { data: calcData } = await api.post('/realtime-calc/calculate', {
      collection: selectedCollection.value,
      data: item,
      fields
    });

    if (calcData.success) {
      // Show preview result
      result.value = {
        success: true,
        collection: selectedCollection.value,
        processed: 1,
        updated: Object.keys(calcData.updates).length > 0 ? 1 : 0,
        total: 1,
        dryRun: true,
        updatedItems: [{
          id: item.id,
          updates: calcData.updates
        }],
        message: `Aperçu: ${Object.keys(calcData.updates).length} champ(s) seraient modifiés`
      };

      notify({
        title: 'Aperçu généré',
        message: `${Object.keys(calcData.updates).length} champ(s) seraient modifiés`,
        type: 'success',
      });
    } else {
      notify({
        title: 'Erreur aperçu',
        message: calcData.error || 'Erreur lors du calcul',
        type: 'error',
      });
    }
  } catch (error) {
    const message = error?.response?.data?.error || error?.message || String(error);
    notify({
      title: 'Erreur aperçu',
      message,
      type: 'error',
    });
  } finally {
    previewing.value = false;
  }
}

async function runRecalculate() {
  if (!selectedCollection.value) {
    notify({
      title: 'Collection manquante',
      message: 'Choisis une collection à recalculer.',
      type: 'warning',
    });
    return;
  }

  filterError.value = null;
  result.value = null;

  let filter = null;
  try {
    filter = parseFilterInput();
  } catch (error) {
    notify({
      title: 'Filtre invalide',
      message: "Ton filtre JSON n'est pas valide.",
      type: 'error',
    });
    return;
  }

  const payload = {
    collection: selectedCollection.value,
    dryRun: dryRun.value,
    batchSize: Math.max(1, Math.min(500, Number(batchSize.value) || 100)),
  };

  if (filter) {
    payload.filter = filter;
  }

  const available = availableFields.value;
  const uniqueSelection = Array.from(new Set(selectedFields.value));
  if (uniqueSelection.length > 0 && uniqueSelection.length < available.length) {
    payload.fields = uniqueSelection;
  }

  running.value = true;

  console.log('[Module] Envoi du recalcul avec payload:', payload);
  try {
    const { data } = await api.post('/realtime-calc/utils/realtime-calc.recalculate-collection', payload);
    console.log('[Module] Réponse reçue:', data);
    result.value = data || null;
    const message = data?.message || (data?.success ? 'Recalcul terminé.' : 'Recalcul terminé avec des erreurs.');
    notify({
      title: 'Recalcul',
      message,
      type: data?.success ? 'success' : 'warning',
    });
  } catch (error) {
    const message = error?.response?.data?.error || error?.message || String(error);
    notify({
      title: 'Erreur recalcul',
      message,
      type: 'error',
    });
  } finally {
    running.value = false;
  }
}
</script>

<style scoped>
/* Container - Ultra compact for single page view */
.recalc-container {
  padding: 0.75rem;
  padding-top: 0;
  max-width: 1400px;
  margin: 0 auto;
  height: calc(100vh - 110px);
  overflow-y: auto;
}

.recalc-loading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  justify-content: center;
  padding: 1.5rem;
  color: var(--theme--foreground-subdued);
}

/* Result Card - Modern Design */
.result-card {
  background: var(--theme--background);
  border: 1px solid var(--theme--border-color);
  border-radius: var(--theme--border-radius);
  margin-bottom: 0.75rem;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.result-card-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid var(--theme--border-color-subdued);
}

.result-card-header.result-success {
  background: linear-gradient(to right, #e8f5e9 0%, var(--theme--background) 100%);
  border-left: 4px solid #4caf50;
}

.result-card-header.result-warning {
  background: linear-gradient(to right, #fff3e0 0%, var(--theme--background) 100%);
  border-left: 4px solid #ff9800;
}

.result-icon {
  flex-shrink: 0;
  color: inherit;
}

.result-success .result-icon {
  color: #4caf50;
}

.result-warning .result-icon {
  color: #ff9800;
}

.result-main {
  flex: 1;
  min-width: 0;
}

.result-title {
  margin: 0 0 0.5rem 0;
  color: var(--theme--foreground);
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.3;
}

.result-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  font-size: 0.75rem;
  color: var(--theme--foreground-subdued);
}

.result-collection {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-weight: 500;
  color: var(--theme--primary);
}

.result-fields-count {
  color: var(--theme--foreground-subdued);
}

.result-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-weight: 500;
  font-size: 0.7rem;
}

.result-badge-dry {
  background: var(--theme--background-subdued);
  color: var(--theme--foreground);
  border: 1px solid var(--theme--border-color);
}

.result-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0;
}

.result-stat {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border-right: 1px solid var(--theme--border-color-subdued);
  transition: background 0.15s;
}

.result-stat:last-child {
  border-right: none;
}

.result-stat:hover {
  background: var(--theme--background-subdued);
}

.result-stat-icon {
  flex-shrink: 0;
  color: var(--theme--primary);
  opacity: 0.7;
}

.result-stat-content {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.result-stat-label {
  font-size: 0.65rem;
  color: var(--theme--foreground-subdued);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 500;
}

.result-stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--theme--foreground);
  line-height: 1;
}

/* Progress Card - Ultra Compact */
.progress-card {
  background: var(--theme--background);
  border: 1px solid var(--theme--border-color);
  border-radius: var(--theme--border-radius);
  padding: 0.75rem;
  margin-bottom: 0.75rem;
}

.progress-card h3 {
  margin: 0 0 0.5rem 0;
  color: var(--theme--foreground);
  font-size: 0.95rem;
  font-weight: 600;
}

.progress-details {
  display: flex;
  justify-content: space-between;
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--theme--foreground-subdued);
}

/* Content Grid - Ultra Compact */
.content-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 0.75rem;
  align-items: start;
}

@media (max-width: 1024px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}

/* Config Card - Ultra Compact */
.config-card {
  background: var(--theme--background);
  border: 1px solid var(--theme--border-color);
  border-radius: var(--theme--border-radius);
  padding: 0.75rem;
}

.card-header {
  margin-bottom: 0.75rem;
}

.card-title {
  margin: 0;
  color: var(--theme--foreground);
  font-size: 0.95rem;
  font-weight: 600;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* Form Groups - Ultra Compact */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.form-label {
  font-weight: 500;
  color: var(--theme--foreground);
  font-size: 0.75rem;
}

.form-subtitle {
  font-size: 0.65rem;
  color: var(--theme--foreground-subdued);
}

.form-hint-warning {
  color: var(--theme--warning, var(--theme--danger));
  font-weight: 500;
}

.form-hint {
  font-size: 0.65rem;
  color: var(--theme--foreground-subdued);
  margin-top: -0.15rem;
}

.form-error {
  color: var(--theme--danger);
  font-size: 0.7rem;
  margin-top: 0.2rem;
}

/* Fields Container - Ultra Compact */
.fields-container {
  border: 1px solid var(--theme--border-color);
  border-radius: var(--theme--border-radius);
  max-height: 220px;
  overflow-y: auto;
  background: var(--theme--background);
}

.fields-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.65rem 0.75rem 0.75rem;
  background: var(--theme--background-subdued);
  border-bottom: 1px solid var(--theme--border-color);
  position: sticky;
  top: 0;
  z-index: 1;
}

.fields-header:hover {
  background: var(--theme--background-accent);
}

.fields-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.fields-header-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  font-size: 0.75rem;
  user-select: none;
}

.fields-header-title input[type="checkbox"] {
  cursor: pointer;
}

.fields-header-title label {
  cursor: pointer;
  margin: 0;
}

.fields-count {
  font-size: 0.65rem;
  color: var(--theme--foreground-subdued);
  background: var(--theme--background);
  border: 1px solid var(--theme--border-color-subdued);
  border-radius: 999px;
  padding: 0.15rem 0.5rem;
  line-height: 1;
}

.fields-search,
.select-search {
  width: 100%;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--theme--border-color-subdued);
  border-radius: var(--theme--border-radius);
  font-size: 0.75rem;
  color: var(--theme--foreground);
  background: var(--theme--background);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.fields-search:focus,
.select-search:focus {
  border-color: var(--theme--primary);
  outline: none;
  box-shadow: 0 0 0 1px var(--theme--primary-20, rgba(80, 86, 231, 0.2));
}

.fields-search::placeholder,
.select-search::placeholder {
  color: var(--theme--foreground-subdued);
}

.select-group-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.select-group-titles {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.select-count {
  font-size: 0.65rem;
  color: var(--theme--foreground-subdued);
  background: var(--theme--background-subdued);
  border-radius: 999px;
  padding: 0.15rem 0.5rem;
  line-height: 1;
  font-weight: 600;
}

.field-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--theme--border-color-subdued);
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}

.field-item:last-child {
  border-bottom: none;
}

.field-item:hover {
  background: var(--theme--background-accent);
}

.field-item input[type="checkbox"] {
  cursor: pointer;
}

.field-item label {
  cursor: pointer;
  margin: 0;
  font-size: 0.75rem;
  color: var(--theme--foreground);
  flex: 1;
}

.fields-empty {
  padding: 1.25rem;
  text-align: center;
  color: var(--theme--foreground-subdued);
  font-size: 0.75rem;
}

/* Scrollbar */
.fields-container::-webkit-scrollbar {
  width: 6px;
}

.fields-container::-webkit-scrollbar-track {
  background: var(--theme--background-subdued);
}

.fields-container::-webkit-scrollbar-thumb {
  background: var(--theme--border-color);
  border-radius: 3px;
}

.fields-container::-webkit-scrollbar-thumb:hover {
  background: var(--theme--foreground-subdued);
}

/* Action Buttons - Ultra Compact */
.action-buttons {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

/* Sidebar - Ultra Compact */
.sidebar {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* Stats Card - Ultra Compact */
.stats-card {
  background: var(--theme--background);
  border: 1px solid var(--theme--border-color);
  border-radius: var(--theme--border-radius);
  padding: 0.75rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.stat-box {
  text-align: center;
  padding: 0.6rem;
  background: var(--theme--background-subdued);
  border-radius: var(--theme--border-radius);
}

.stat-box .label {
  display: block;
  font-size: 0.6rem;
  color: var(--theme--foreground-subdued);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.3rem;
}

.stat-box .value {
  display: block;
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--theme--primary);
}

/* Recent Card - Ultra Compact */
.recent-card {
  background: var(--theme--background);
  border: 1px solid var(--theme--border-color);
  border-radius: var(--theme--border-radius);
  padding: 0.75rem;
}

.formula-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-top: 0.5rem;
}

.formula-item {
  padding: 0.5rem;
  background: var(--theme--background-subdued);
  border: 1px solid var(--theme--border-color-subdued);
  border-radius: var(--theme--border-radius);
  cursor: pointer;
  transition: all 0.15s;
}

.formula-item:hover {
  background: var(--theme--background-accent);
  border-color: var(--theme--primary);
  transform: translateX(2px);
}

.formula-item .collection {
  font-weight: 600;
  color: var(--theme--foreground);
  font-size: 0.75rem;
  margin-bottom: 0.15rem;
}

.formula-item .field {
  color: var(--theme--foreground-subdued);
  font-size: 0.65rem;
  font-family: var(--theme--font-monospace);
}

/* Formula Tester - Collapsible */
.formula-tester-card {
  background: var(--theme--background);
  border: 1px solid var(--theme--border-color);
  border-radius: var(--theme--border-radius);
  margin-bottom: 0.75rem;
  overflow: hidden;
}

.formula-tester-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: linear-gradient(to right, var(--theme--primary-subdued, rgba(80, 86, 231, 0.1)) 0%, var(--theme--background) 100%);
  border-left: 3px solid var(--theme--primary);
  cursor: pointer;
  user-select: none;
  font-weight: 600;
  color: var(--theme--foreground);
  font-size: 0.85rem;
  transition: background 0.15s;
}

.formula-tester-header:hover {
  background: linear-gradient(to right, var(--theme--primary-subdued, rgba(80, 86, 231, 0.15)) 0%, var(--theme--background-accent) 100%);
}

.formula-tester-badge {
  margin-left: auto;
  font-size: 0.65rem;
  background: var(--theme--primary);
  color: white;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.formula-tester-body {
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  border-top: 1px solid var(--theme--border-color-subdued);
}

/* Test Result Card */
.test-result-card {
  border: 2px solid;
  border-radius: var(--theme--border-radius);
  padding: 0.75rem;
  margin-top: 0.5rem;
}

.test-result-success {
  border-color: #4caf50;
  background: linear-gradient(to right, #e8f5e9 0%, var(--theme--background) 100%);
}

.test-result-error {
  border-color: #f44336;
  background: linear-gradient(to right, #ffebee 0%, var(--theme--background) 100%);
}

.test-result-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.test-result-title {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--theme--foreground);
}

.test-result-details {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.75rem;
}

.test-result-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.test-result-label {
  font-weight: 600;
  color: var(--theme--foreground-subdued);
  min-width: 100px;
}

.test-result-value {
  color: var(--theme--foreground);
  font-family: var(--theme--font-monospace);
}

.test-result-badge {
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
}

.test-result-badge.badge-local {
  background: #4caf50;
  color: white;
}

.test-result-badge.badge-relational {
  background: #ff9800;
  color: white;
}

.test-result-error-msg {
  color: var(--theme--danger);
  font-size: 0.75rem;
  font-family: var(--theme--font-monospace);
  background: var(--theme--background);
  padding: 0.5rem;
  border-radius: var(--theme--border-radius);
  border: 1px solid var(--theme--danger);
}
</style>
