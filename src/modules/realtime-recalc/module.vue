<template>
  <div class="recalc-module">
    <div v-if="loadingConfig" class="recalc-loading">
      <v-progress-circular indeterminate :size="32" />
      <span>Chargement des formules…</span>
    </div>

    <v-notice v-else-if="configError" type="danger" icon="error">
      {{ configError }}
    </v-notice>

    <div v-else class="recalc-card">
      <header class="recalc-card__header">
        <h1>Recalcul des formules</h1>
        <p>Sélectionne une collection qui utilise le hook de calcul puis déclenche un recalcul ciblé.</p>
      </header>

      <v-notice
        v-if="collectionOptions.length === 0"
        type="warning"
        icon="info"
        class="recalc-empty"
      >
        Aucune collection avec formules locales publiée n'a été détectée.
      </v-notice>

      <section class="recalc-grid">
        <v-select
          label="Collection"
          :items="collectionOptions"
          :disabled="collectionOptions.length === 0"
          placeholder="Sélectionne une collection"
          v-model="selectedCollection"
        />

        <v-select
          label="Champs calculés"
          :items="fieldOptions"
          v-model="selectedFields"
          multiple
          chips
          :disabled="!selectedCollection || fieldOptions.length === 0"
          placeholder="Tous les champs"
        />

        <v-input
          label="Batch size (1-500)"
          v-model.number="batchSize"
          type="number"
          :min="1"
          :max="500"
        />

        <v-checkbox
          label="Mode dry-run (aucune écriture)"
          v-model="dryRun"
        />
      </section>

      <section>
        <label class="recalc-label">Filtre JSON Directus (optionnel)</label>
        <v-textarea
          v-model="filterInput"
          placeholder='{ "status": { "_eq": "published" } }'
          rows="5"
          auto-grow
        />
        <small v-if="filterError" class="recalc-error">{{ filterError }}</small>
      </section>

      <v-notice
        v-if="selectedCollection"
        type="info"
        icon="calculate"
        class="recalc-summary"
      >
        <span><strong>{{ availableFields.length }}</strong> champ(s) calculé(s) détecté(s) dans {{ selectedCollection }}.</span>
        <span v-if="selectedFields.length === 0 || selectedFields.length === availableFields.length">
          Tous les champs seront recalculés.
        </span>
        <span v-else>
          {{ selectedFields.length }} champ(s) sélectionné(s): {{ selectedFields.join(', ') }}
        </span>
      </v-notice>

      <div class="recalc-actions">
        <v-button
          :loading="running"
          :disabled="!canRun"
          icon="play_arrow"
          color="primary"
          @click="runRecalculate"
        >
          Lancer le recalcul
        </v-button>
      </div>

      <v-notice
        v-if="result"
        :type="result.success ? 'success' : 'warning'"
        :icon="result.success ? 'check_circle' : 'error'"
        class="recalc-result"
      >
        <strong>{{ result.message || (result.success ? 'Recalcul terminé.' : 'Recalcul terminé avec des erreurs.') }}</strong>
        <div class="recalc-result__details">
          <span>Traités&nbsp;: {{ result.processed ?? '–' }}</span>
          <span>Mises à jour&nbsp;: {{ result.updated ?? '–' }}</span>
          <span v-if="result.total !== undefined">Total&nbsp;: {{ result.total }}</span>
          <span v-if="Array.isArray(result.fields) && result.fields.length">Champs&nbsp;: {{ result.fields.join(', ') }}</span>
          <span v-if="result.dryRun">Mode dry-run</span>
        </div>
      </v-notice>

      <details v-if="result" class="recalc-result-json">
        <summary>Voir la réponse complète</summary>
        <pre>{{ formattedResult }}</pre>
      </details>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useApi, useNotifications } from '@directus/extensions-sdk';

const api = useApi();
const { notify } = useNotifications();

const loadingConfig = ref(true);
const configError = ref(null);
const config = ref({});
const selectedCollection = ref(null);
const selectedFields = ref([]);
const filterInput = ref('');
const filterError = ref(null);
const batchSize = ref(100);
const dryRun = ref(false);
const running = ref(false);
const result = ref(null);

const collectionOptions = computed(() =>
  Object.entries(config.value || {}).map(([collection, stats]) => ({
    value: collection,
    text: `${collection} (${stats?.formulaCount ?? stats?.fields?.length ?? 0})`,
  }))
);

const availableFields = computed(() => {
  if (!selectedCollection.value) return [];
  return config.value[selectedCollection.value]?.fields || [];
});

const fieldOptions = computed(() =>
  availableFields.value.map((field) => ({
    value: field,
    text: field,
  }))
);

const canRun = computed(() => Boolean(selectedCollection.value) && !running.value);

const formattedResult = computed(() => (result.value ? JSON.stringify(result.value, null, 2) : ''));

watch(selectedCollection, (collection) => {
  result.value = null;
  filterError.value = null;
  if (!collection) {
    selectedFields.value = [];
    return;
  }
  const defaults = [...(config.value[collection]?.fields || [])];
  selectedFields.value = defaults;
});

watch(filterInput, () => {
  filterError.value = null;
});

async function loadConfig() {
  loadingConfig.value = true;
  configError.value = null;
  try {
    const { data } = await api.post('/realtime-calc/utils/realtime-calc.get-config', {});
    config.value = data?.stats || {};
    if (Object.keys(config.value).length === 0) {
      selectedCollection.value = null;
    } else if (!selectedCollection.value) {
      selectedCollection.value = Object.keys(config.value)[0];
    }
  } catch (error) {
    const message = error?.response?.data?.error || error?.message || String(error);
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

onMounted(loadConfig);

function parseFilterInput() {
  if (!filterInput.value || !filterInput.value.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(filterInput.value);
    filterError.value = null;
    return parsed;
  } catch (error) {
    filterError.value = error?.message || String(error);
    throw error;
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

  try {
    const { data } = await api.post('/realtime-calc/utils/realtime-calc.recalculate-collection', payload);
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
.recalc-module {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  max-width: 900px;
  margin: auto;
}

.recalc-loading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  justify-content: center;
  color: var(--theme--foreground-subdued);
}

.recalc-card {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.recalc-card__header h1 {
  margin: 0;
  font-size: 1.4rem;
}

.recalc-card__header p {
  margin: 0;
  color: var(--theme--foreground-subdued);
}

.recalc-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  align-items: flex-end;
}

.recalc-label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.recalc-error {
  color: var(--theme--danger);
}

.recalc-summary {
  white-space: pre-line;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.recalc-actions {
  display: flex;
  justify-content: flex-start;
}

.recalc-result__details {
  margin-top: 0.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.recalc-result-json {
  background: var(--theme--background-subdued);
  border-radius: 6px;
  padding: 0.75rem 1rem;
}

.recalc-result-json pre {
  margin-top: 0.75rem;
  overflow-x: auto;
  font-family: var(--theme--font-monospace);
  font-size: 0.85rem;
}

.recalc-empty {
  margin-bottom: 1rem;
}
</style>
