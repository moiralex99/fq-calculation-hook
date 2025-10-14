/**
 * Système de batching pour éviter la saturation de l'API Directus
 * Regroupe les mises à jour et les exécute par chunks optimisés
 */

export class UpdateBatcher {
    constructor(options = {}) {
        this.options = {
            batchDelay: options.batchDelay || 100,      // Délai avant traitement (ms)
            maxBatchSize: options.maxBatchSize || 10,   // Taille max d'un batch
            maxConcurrent: options.maxConcurrent || 3,  // Requêtes simultanées max
            retryAttempts: options.retryAttempts || 3,  // Tentatives en cas d'erreur
            ...options
        };

        this.pendingUpdates = new Map();     // itemId -> updateData
        this.batchTimeout = null;
        this.currentRequests = 0;
        this.requestQueue = [];
        this.stats = {
            totalUpdates: 0,
            batchesProcessed: 0,
            apiCallsSaved: 0,
            errors: 0
        };
    }

    /**
     * Planifie une mise à jour (sera batchée)
     * @param {string} collection - Collection Directus
     * @param {string} itemId - ID de l'item
     * @param {object} data - Données à mettre à jour
     * @param {number} priority - Priorité (0 = haute, plus = basse)
     */
    scheduleUpdate(collection, itemId, data, priority = 5) {
        const key = `${collection}.${itemId}`;
        
        // Fusionne avec les données existantes si déjà planifié
        if (this.pendingUpdates.has(key)) {
            const existing = this.pendingUpdates.get(key);
            existing.data = { ...existing.data, ...data };
            existing.priority = Math.min(existing.priority, priority);
            existing.scheduledAt = Date.now();
        } else {
            this.pendingUpdates.set(key, {
                collection,
                itemId,
                data,
                priority,
                scheduledAt: Date.now(),
                attempts: 0
            });
        }

        this.stats.totalUpdates++;
        this.scheduleBatchProcessing();
    }

    /**
     * Planifie le traitement du batch
     */
    scheduleBatchProcessing() {
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
        }

        this.batchTimeout = setTimeout(() => {
            this.processPendingUpdates();
        }, this.options.batchDelay);
    }

    /**
     * Traite tous les updates en attente
     */
    async processPendingUpdates() {
        if (this.pendingUpdates.size === 0) return;

        // Récupère et trie les updates par priorité
        const updates = Array.from(this.pendingUpdates.values())
            .sort((a, b) => a.priority - b.priority);

        // Vide la queue (les nouveaux updates seront dans un nouveau batch)
        this.pendingUpdates.clear();

        // Divise en chunks
        const chunks = this.chunkArray(updates, this.options.maxBatchSize);
        
        console.log(`[UpdateBatcher] Traitement de ${updates.length} updates en ${chunks.length} batches`);

        // Traite chaque chunk
        for (const chunk of chunks) {
            await this.processChunk(chunk);
        }

        this.stats.batchesProcessed++;
        const saved = updates.length - chunks.length;
        this.stats.apiCallsSaved += Math.max(0, saved);

        console.log(`[UpdateBatcher] Batch terminé. API calls économisées: ${saved}`);
    }

    /**
     * Traite un chunk d'updates
     * @param {Array} chunk - Chunk d'updates à traiter
     */
    async processChunk(chunk) {
        // Attend qu'une slot soit disponible
        await this.waitForSlot();

        this.currentRequests++;

        try {
            // Groupe les updates par collection pour optimiser
            const byCollection = this.groupByCollection(chunk);

            const promises = Object.entries(byCollection).map(([collection, items]) =>
                this.updateCollection(collection, items)
            );

            await Promise.all(promises);

        } catch (error) {
            console.error('[UpdateBatcher] Erreur dans le chunk:', error);
            this.stats.errors++;
            
            // Retry logic pour les updates échouées
            this.retryFailedUpdates(chunk);
        } finally {
            this.currentRequests--;
            this.processQueue();
        }
    }

    /**
     * Met à jour une collection avec plusieurs items
     * @param {string} collection - Nom de la collection
     * @param {Array} items - Items à mettre à jour
     */
    async updateCollection(collection, items) {
        // Simule l'appel API Directus
        // En vrai: await this.directusApi.items(collection).updateMany(items)
        
        console.log(`[UpdateBatcher] Mise à jour ${collection}: ${items.length} items`);
        
        // Simulation d'un délai d'API
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
        
        // Simule une erreur occasionnelle (5% de chance)
        if (Math.random() < 0.05) {
            throw new Error(`Erreur simulée pour ${collection}`);
        }

        return { success: true, updated: items.length };
    }

    /**
     * Groupe les updates par collection
     * @param {Array} updates - Updates à grouper
     * @returns {object} - Groupé par collection
     */
    groupByCollection(updates) {
        const grouped = {};
        
        updates.forEach(update => {
            if (!grouped[update.collection]) {
                grouped[update.collection] = [];
            }
            grouped[update.collection].push({
                id: update.itemId,
                ...update.data
            });
        });

        return grouped;
    }

    /**
     * Gère les tentatives de retry
     * @param {Array} failedUpdates - Updates qui ont échoué
     */
    retryFailedUpdates(failedUpdates) {
        failedUpdates.forEach(update => {
            update.attempts = (update.attempts || 0) + 1;
            
            if (update.attempts < this.options.retryAttempts) {
                // Replanifie avec une priorité plus haute et un délai
                setTimeout(() => {
                    this.scheduleUpdate(
                        update.collection, 
                        update.itemId, 
                        update.data, 
                        0 // Priorité haute pour retry
                    );
                }, 1000 * update.attempts); // Délai exponentiel
            } else {
                console.error(`[UpdateBatcher] Abandon après ${update.attempts} tentatives:`, update);
            }
        });
    }

    /**
     * Attend qu'un slot soit disponible pour les requêtes
     */
    async waitForSlot() {
        return new Promise(resolve => {
            if (this.currentRequests < this.options.maxConcurrent) {
                resolve();
            } else {
                this.requestQueue.push(resolve);
            }
        });
    }

    /**
     * Traite la queue des requêtes en attente
     */
    processQueue() {
        while (this.requestQueue.length > 0 && this.currentRequests < this.options.maxConcurrent) {
            const resolve = this.requestQueue.shift();
            resolve();
        }
    }

    /**
     * Divise un array en chunks
     * @param {Array} array - Array à diviser
     * @param {number} size - Taille des chunks
     * @returns {Array} - Array de chunks
     */
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    /**
     * Force le traitement immédiat des updates en attente
     */
    async flush() {
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
            this.batchTimeout = null;
        }
        await this.processPendingUpdates();
    }

    /**
     * Obtient les statistiques du batcher
     * @returns {object} - Statistiques
     */
    getStats() {
        return {
            ...this.stats,
            pendingUpdates: this.pendingUpdates.size,
            currentRequests: this.currentRequests,
            queuedRequests: this.requestQueue.length
        };
    }

    /**
     * Reset les statistiques
     */
    resetStats() {
        this.stats = {
            totalUpdates: 0,
            batchesProcessed: 0,
            apiCallsSaved: 0,
            errors: 0
        };
    }
}
