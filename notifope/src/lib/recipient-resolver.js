/**
 * Recipient Resolver
 * Résout les destinataires (statiques, dynamiques, rôles, équipes)
 */

export class RecipientResolver {
  constructor(services, database, logger) {
    this.services = services;
    this.database = database;
    this.logger = logger;
  }

  /**
   * Résout les destinataires d'une notification
   * @param {Object} recipientConfig - Configuration destinataires
   * @param {Object} item - Item source
   * @param {string} collection - Collection source
   * @returns {Promise<Array>} - Liste d'objets {email, user_id, name}
   */
  async resolve(recipientConfig, item, collection) {
    const { type, field, fallback, role, team, emails, query } = recipientConfig;

    this.logger?.info(`[RecipientResolver] Resolving recipients: type=${type}, config=${JSON.stringify(recipientConfig)}`);

    try {
      switch (type) {
        case 'static':
          return this.resolveStatic(emails || fallback);

        case 'dynamic_field':
          return await this.resolveDynamicField(field, item, collection, fallback);

        case 'role':
          return await this.resolveByRole(role, fallback);

        case 'team':
          return await this.resolveByTeam(team, fallback);

        case 'custom_query':
          return await this.resolveCustomQuery(query, item, fallback);

        default:
          this.logger?.warn(`[RecipientResolver] Unknown recipient type: ${type}`);
          return this.resolveStatic(fallback);
      }
    } catch (error) {
      this.logger?.error(`[RecipientResolver] Error resolving recipients:`, error);
      return this.resolveStatic(fallback || []);
    }
  }

  /**
   * Destinataires statiques (emails directs)
   */
  resolveStatic(emails) {
    if (!emails || !Array.isArray(emails)) return [];

    return emails
      .filter(email => this.isValidEmail(email))
      .map(email => ({
        email,
        user_id: null,
        name: email
      }));
  }

  /**
   * Destinataires depuis un champ de l'item
   */
  async resolveDynamicField(field, item, collection, fallback) {
    if (!field || !item) return this.resolveStatic(fallback);

    // Gestion des champs imbriqués: "assignee.email" ou "responsible_team.members"
    const fieldValue = this.getNestedValue(item, field);

    if (!fieldValue) {
      this.logger?.warn(`[RecipientResolver] Field ${field} not found or empty in item`);
      return this.resolveStatic(fallback);
    }

    // Si c'est un ID utilisateur, récupérer l'user
    if (typeof fieldValue === 'number' || (typeof fieldValue === 'string' && !fieldValue.includes('@'))) {
      return await this.resolveUserById(fieldValue, fallback);
    }

    // Si c'est un email direct
    if (typeof fieldValue === 'string' && this.isValidEmail(fieldValue)) {
      return [{
        email: fieldValue,
        user_id: null,
        name: fieldValue
      }];
    }

    // Si c'est un tableau d'IDs ou d'emails
    if (Array.isArray(fieldValue)) {
      const recipients = await Promise.all(
        fieldValue.map(val => this.resolve({ type: 'dynamic_field', field: null }, { [field]: val }, collection, fallback))
      );
      return recipients.flat();
    }

    return this.resolveStatic(fallback);
  }

  /**
   * Destinataires par rôle Directus
   */
  async resolveByRole(roleName, fallback) {
    try {
      const users = await this.database('directus_users')
        .join('directus_roles', 'directus_users.role', 'directus_roles.id')
        .where('directus_roles.name', roleName)
        .where('directus_users.status', 'active')
        .select('directus_users.id as user_id', 'directus_users.email', 'directus_users.first_name', 'directus_users.last_name');

      if (users.length === 0) {
        this.logger?.warn(`[RecipientResolver] No users found for role: ${roleName}`);
        return this.resolveStatic(fallback);
      }

      return users.map(user => ({
        email: user.email,
        user_id: user.user_id,
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email
      }));
    } catch (error) {
      this.logger?.error(`[RecipientResolver] Error resolving by role:`, error);
      return this.resolveStatic(fallback);
    }
  }

  /**
   * Destinataires par équipe (collection custom)
   */
  async resolveByTeam(teamId, fallback) {
    try {
      // Adapter selon votre modèle de données
      const members = await this.database('team_members')
        .where('team_id', teamId)
        .where('status', 'active')
        .select('user_id');

      if (members.length === 0) {
        return this.resolveStatic(fallback);
      }

      const userIds = members.map(m => m.user_id);
      return await Promise.all(userIds.map(id => this.resolveUserById(id, [])));
    } catch (error) {
      this.logger?.error(`[RecipientResolver] Error resolving by team:`, error);
      return this.resolveStatic(fallback);
    }
  }

  /**
   * Requête custom pour destinataires complexes
   */
  async resolveCustomQuery(query, item, fallback) {
    try {
      // Remplacer les variables dans la query
      const processedQuery = this.interpolateQuery(query, item);
      
      const results = await this.database.raw(processedQuery);
      const rows = results[0] || results;

      if (!rows || rows.length === 0) {
        return this.resolveStatic(fallback);
      }

      return rows.map(row => ({
        email: row.email,
        user_id: row.user_id || row.id,
        name: row.name || row.email
      }));
    } catch (error) {
      this.logger?.error(`[RecipientResolver] Error executing custom query:`, error);
      return this.resolveStatic(fallback);
    }
  }

  /**
   * Résout un utilisateur Directus par ID
   */
  async resolveUserById(userId, fallback) {
    try {
      const user = await this.database('directus_users')
        .where('id', userId)
        .where('status', 'active')
        .first('id as user_id', 'email', 'first_name', 'last_name');

      if (!user || !user.email) {
        return this.resolveStatic(fallback);
      }

      return [{
        email: user.email,
        user_id: user.user_id,
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email
      }];
    } catch (error) {
      this.logger?.error(`[RecipientResolver] Error resolving user:`, error);
      return this.resolveStatic(fallback);
    }
  }

  /**
   * Valide un email
   */
  isValidEmail(email) {
    return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Récupère une valeur imbriquée (dot notation)
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Interpole des variables dans une query SQL
   */
  interpolateQuery(query, data) {
    return query.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const value = this.getNestedValue(data, key.trim());
      return value !== undefined ? this.database.raw('?', [value]).toString() : 'NULL';
    });
  }
}
