/**
 * Template Renderer
 * Rend les templates avec variables Mustache-like
 */

export class TemplateRenderer {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Rend un template avec des variables
   * @param {string} template - Template avec {{variables}}
   * @param {Object} data - Données pour remplacement
   * @returns {string} - Template rendu
   */
  render(template, data) {
    if (!template) return '';

    try {
      // Enrichir les données avec helpers
      const enrichedData = this.enrichData(data);

      // Remplacer les variables {{key}} et {{obj.nested.key}}
      return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const value = this.getNestedValue(enrichedData, path.trim());
        return value !== undefined && value !== null ? this.formatValue(value) : match;
      });
    } catch (error) {
      this.logger?.error(`[TemplateRenderer] Error rendering template:`, error);
      return template;
    }
  }

  /**
   * Rend un template avec des conditionnels simples
   * {{#if variable}}...{{/if}}
   */
  renderWithConditionals(template, data) {
    let rendered = template;

    // Gérer les {{#if}}...{{/if}}
    rendered = rendered.replace(/\{\{#if ([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
      const value = this.getNestedValue(data, condition.trim());
      return value ? content : '';
    });

    // Gérer les {{#unless}}...{{/unless}}
    rendered = rendered.replace(/\{\{#unless ([^}]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g, (match, condition, content) => {
      const value = this.getNestedValue(data, condition.trim());
      return !value ? content : '';
    });

    // Rendre les variables standard
    return this.render(rendered, data);
  }

  /**
   * Enrichit les données avec des helpers
   */
  enrichData(data) {
    return {
      ...data,
      // Date helpers
      now: new Date().toISOString(),
      today: new Date().toISOString().split('T')[0],
      
      // URL helpers (à adapter selon votre config)
      directus_url: process.env.PUBLIC_URL || 'http://localhost:8055',
    };
  }

  /**
   * Récupère une valeur imbriquée avec dot notation
   */
  getNestedValue(obj, path) {
    // Support des filtres: {{date | date}}
    const [actualPath, filter] = path.split('|').map(s => s.trim());

    const value = actualPath.split('.').reduce((current, key) => {
      if (current === undefined || current === null) return undefined;
      return current[key];
    }, obj);

    // Appliquer les filtres
    if (filter && value !== undefined) {
      return this.applyFilter(value, filter);
    }

    return value;
  }

  /**
   * Applique un filtre à une valeur
   */
  applyFilter(value, filterName) {
    switch (filterName.toLowerCase()) {
      case 'date':
        return this.formatDate(value);
      
      case 'datetime':
        return this.formatDateTime(value);
      
      case 'uppercase':
      case 'upper':
        return String(value).toUpperCase();
      
      case 'lowercase':
      case 'lower':
        return String(value).toLowerCase();
      
      case 'capitalize':
        return String(value).charAt(0).toUpperCase() + String(value).slice(1).toLowerCase();
      
      case 'currency':
        return this.formatCurrency(value);
      
      case 'number':
        return this.formatNumber(value);
      
      default:
        return value;
    }
  }

  /**
   * Formate une valeur selon son type
   */
  formatValue(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
    if (value instanceof Date) return this.formatDateTime(value);
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  /**
   * Formate une date (YYYY-MM-DD)
   */
  formatDate(value) {
    try {
      const date = new Date(value);
      if (isNaN(date)) return value;
      return date.toISOString().split('T')[0];
    } catch {
      return value;
    }
  }

  /**
   * Formate une date-heure (DD/MM/YYYY HH:MM)
   */
  formatDateTime(value) {
    try {
      const date = new Date(value);
      if (isNaN(date)) return value;
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch {
      return value;
    }
  }

  /**
   * Formate un nombre en devise
   */
  formatCurrency(value, currency = 'EUR') {
    try {
      const num = Number(value);
      if (isNaN(num)) return value;
      
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency
      }).format(num);
    } catch {
      return value;
    }
  }

  /**
   * Formate un nombre
   */
  formatNumber(value) {
    try {
      const num = Number(value);
      if (isNaN(num)) return value;
      
      return new Intl.NumberFormat('fr-FR').format(num);
    } catch {
      return value;
    }
  }

  /**
   * Extrait les variables utilisées dans un template
   */
  extractVariables(template) {
    if (!template) return [];

    const matches = template.match(/\{\{([^}]+)\}\}/g) || [];
    const variables = matches.map(match => {
      const content = match.replace(/\{\{|\}\}/g, '').trim();
      const [path] = content.split('|').map(s => s.trim());
      return path.split('.')[0]; // Premier segment seulement
    });

    return [...new Set(variables)].filter(v => !['now', 'today', 'directus_url'].includes(v));
  }

  /**
   * Valide un template
   */
  validate(template) {
    if (!template) return { valid: true };

    try {
      // Vérifier les accolades équilibrées
      const openCount = (template.match(/\{\{/g) || []).length;
      const closeCount = (template.match(/\}\}/g) || []).length;

      if (openCount !== closeCount) {
        return { valid: false, error: 'Unbalanced curly braces' };
      }

      // Tester le rendu avec des données vides
      this.render(template, {});

      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}
