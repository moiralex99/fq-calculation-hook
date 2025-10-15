/**
 * Parser et évaluateur DSL → JavaScript
 * Compatible avec le format DSL de FlowQuartz Engine
 * Supporte un subset du DSL pour les formules locales uniquement
 * 
 * Format DSL:
 * - Champs: {{field_name}} ou {{Collection.field_name}}
 * - Fonctions: IF(cond, then, else), COALESCE(a, b, ...), ROUND(x, decimals)
 * - Opérateurs: +, -, *, /, %, =, <>, !=, <, <=, >, >=, AND, OR, NOT
 * - Littéraux: nombres, "chaînes", true, false, null
 */

const TIME_UNITS_MS = {
  millisecond: 1,
  second: 1000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000
};

const DATE_ONLY_UNITS = new Set(['day', 'week', 'month', 'quarter', 'year']);

const DATE_DIFF_MONTH_BASED = new Set(['month', 'quarter', 'year']);

function normalizeUnit(unit) {
  return String(unit || '').toLowerCase();
}

function cloneDate(date) {
  return new Date(date.getTime());
}

function ensureDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return cloneDate(value);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateOnly(date) {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateTime(date) {
  if (!date) return null;
  return date.toISOString();
}

function addMonths(date, months) {
  const result = cloneDate(date);
  const targetMonth = result.getMonth() + months;
  result.setDate(1);
  result.setMonth(targetMonth);
  const originalDay = date.getDate();
  const lastDayOfTarget = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDayOfTarget));
  return result;
}

function addUnit(date, unit, amount) {
  const normalized = normalizeUnit(unit);
  if (!Number.isFinite(amount)) return null;

  if (normalized === 'quarter') {
    return addMonths(date, amount * 3);
  }

  if (normalized === 'year') {
    return addMonths(date, amount * 12);
  }

  if (normalized === 'month') {
    return addMonths(date, amount);
  }

  const scale = TIME_UNITS_MS[normalized];
  if (scale) {
    return new Date(date.getTime() + amount * scale);
  }

  return null;
}

function startOfUnit(date, unit) {
  const normalized = normalizeUnit(unit);
  const result = cloneDate(date);

  switch (normalized) {
    case 'day':
      result.setHours(0, 0, 0, 0);
      return result;
    case 'week': {
      const day = (result.getDay() + 6) % 7; // ISO: lundi = 0
      result.setHours(0, 0, 0, 0);
      result.setDate(result.getDate() - day);
      return result;
    }
    case 'month':
      result.setHours(0, 0, 0, 0);
      result.setDate(1);
      return result;
    case 'quarter': {
      result.setHours(0, 0, 0, 0);
      const quarter = Math.floor(result.getMonth() / 3) * 3;
      result.setMonth(quarter, 1);
      return result;
    }
    case 'year':
      result.setHours(0, 0, 0, 0);
      result.setMonth(0, 1);
      return result;
    default:
      return result;
  }
}

function endOfUnit(date, unit) {
  const normalized = normalizeUnit(unit);
  if (normalized === 'day') {
    const result = cloneDate(date);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  const start = startOfUnit(date, normalized);
  const next = addUnit(start, normalized, 1);
  if (!next) return start;
  next.setMilliseconds(next.getMilliseconds() - 1);
  return next;
}

function diffDate(unit, start, end) {
  const normalized = normalizeUnit(unit);
  const startDate = ensureDate(start);
  const endDate = ensureDate(end);
  if (!startDate || !endDate) return null;

  const diffMs = endDate.getTime() - startDate.getTime();

  if (DATE_DIFF_MONTH_BASED.has(normalized)) {
    const months =
      (endDate.getFullYear() - startDate.getFullYear()) * 12 +
      (endDate.getMonth() - startDate.getMonth());

    const adjust = endDate.getDate() - startDate.getDate();
    let adjustedMonths = months;
    if (diffMs >= 0 && adjust < 0) {
      adjustedMonths -= 1;
    } else if (diffMs < 0 && adjust > 0) {
      adjustedMonths += 1;
    }

    if (normalized === 'month') return adjustedMonths;
    if (normalized === 'quarter') return Math.trunc(adjustedMonths / 3);
    if (normalized === 'year') return Math.trunc(adjustedMonths / 12);
  }

  const scale = TIME_UNITS_MS[normalized];
  if (!scale) return null;
  return Math.trunc(diffMs / scale);
}

function safeToNumber(value) {
  if (value == null || value === '') return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function castValue(value, type, { strict = true } = {}) {
  const normalizedType = String(type || '').toLowerCase();

  if (value == null) {
    return null;
  }

  const throwOrNull = (message) => {
    if (strict) {
      throw new Error(message);
    }
    return null;
  };

  switch (normalizedType) {
    case 'string':
    case 'text':
      return String(value);

    case 'int':
    case 'integer':
    case 'bigint': {
      const num = safeToNumber(value);
      if (num == null) {
        return throwOrNull('Invalid integer cast');
      }
      return Math.trunc(num);
    }

    case 'float':
    case 'double':
    case 'decimal':
    case 'numeric':
      return safeToNumber(value) ?? throwOrNull('Invalid decimal cast');

    case 'bool':
    case 'boolean': {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value !== 0;
      const lowered = String(value).trim().toLowerCase();
      if (['true', '1', 'yes', 'y'].includes(lowered)) return true;
      if (['false', '0', 'no', 'n'].includes(lowered)) return false;
      return throwOrNull('Invalid boolean cast');
    }

    case 'date': {
      const parsed = ensureDate(value);
      if (!parsed) return throwOrNull('Invalid date cast');
      return formatDateOnly(parsed);
    }

    case 'datetime':
    case 'timestamp': {
      const parsed = ensureDate(value);
      if (!parsed) return throwOrNull('Invalid datetime cast');
      return formatDateTime(parsed);
    }

    default:
      return throwOrNull(`Unsupported cast type: ${type}`);
  }
}

export class DSLParser {
  constructor() {
    // Regex pour extraire les tokens du DSL
    this.tokenRegex = /(\{\{[a-zA-Z0-9_\.]+\}\}|"(?:[^"\\]|\\.)*"|[0-9]+(?:\.[0-9]+)?|\b(?:IF|CASE_WHEN|COALESCE|ROUND|ABS|CEIL|FLOOR|NULLIF|IS_NULL|IN|BETWEEN|EQ|NE|LT|LTE|GT|GTE|DATE_DIFF|DATEDIFF|DATE_ADD|DATE_TRUNC|EXTRACT|START_OF|END_OF|MAKE_DATE|TODAY|NOW|UPPER|LOWER|LENGTH|LEFT|RIGHT|SUBSTR|SUBSTRING|TRIM|LTRIM|RTRIM|REPLACE|REGEX_MATCH|REGEX_EXTRACT|REGEX_REPLACE|CONCAT|CONCAT_WS|CAST|TRY_CAST|ADD|SUB|MUL|DIV|MOD|NEGATE|POWER|SQRT|SIGN|GREATEST|LEAST|AND|OR|NOT|true|false|null)\b|[+\-*\/%()=<>!,]|<=|>=|<>|!=)/gi;
  }

  /**
   * Parse une formule DSL et retourne une fonction JavaScript évaluable
   * @param {string} formula - Formule DSL (ex: "{{prix}} * {{quantite}}")
   * @returns {Function} - Fonction qui prend (data) et retourne le résultat
   */
  compile(formula) {
    if (!formula) {
      return () => null;
    }

    try {
      // 1. Convertir DSL → JavaScript
      const jsCode = this.dslToJavaScript(formula);
      const helpers = this.createHelpers();
      const helperEntries = Object.entries(helpers);
      const helperNames = helperEntries.map(([name]) => name);

      // 2. Créer une fonction évaluable (sans 'use strict' et 'with')
      // eslint-disable-next-line no-new-func
      const fn = new Function('data', ...helperNames, `
        return (${jsCode});
      `);
      
      return (data) => {
        const helperValues = helperEntries.map(([, value]) => value);
        return fn(data, ...helperValues);
      };
      
    } catch (error) {
      throw new Error(`Failed to compile formula: ${error.message}`);
    }
  }

  /**
   * Traduit une formule DSL en expression JavaScript
   * @param {string} formula - Formule DSL
   * @returns {string} - Expression JavaScript
   */
  dslToJavaScript(formula) {
    let js = formula;

    // 1. Remplacer les champs {{field}} par data.field
    // Ne pas utiliser ?? 0 car ça empêche COALESCE de fonctionner
    js = js.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, field) => {
      return `(data.${field})`;
    });

    // 2. Remplacer les champs avec collection {{Collection.field}} par null (non supporté)
    js = js.replace(/\{\{([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\}\}/g, () => {
      return 'null /* cross-collection reference not supported */';
    });

    // 3. Remplacer les opérateurs SQL par JavaScript (dans le bon ordre!)
    js = js.replace(/\s+AND\s+/gi, ' && ');
    js = js.replace(/\s+OR\s+/gi, ' || ');
    js = js.replace(/\bNOT\s+/gi, '!');
    
    // Remplacer les opérateurs de comparaison
    // IMPORTANT: Utiliser des marqueurs temporaires pour éviter les conflits
    js = js.replace(/\s*<=\s*/g, ' __LTE__ ');
    js = js.replace(/\s*>=\s*/g, ' __GTE__ ');
    js = js.replace(/\s*<>\s*/g, ' __NEQ__ ');
    js = js.replace(/\s*!=\s*/g, ' __NEQ__ ');
    js = js.replace(/\s*<\s*/g, ' __LT__ ');
    js = js.replace(/\s*>\s*/g, ' __GT__ ');
    
    // = pour égalité (mais pas == ou === ou <= ou >=)
    // Ne pas remplacer = dans les chaînes entre guillemets
    js = js.replace(/(?<![=<>!])\s*=\s*(?![=])/g, (match, offset) => {
      // Vérifier si on est dans une chaîne
      const before = js.substring(0, offset);
      const doubleQuotes = (before.match(/"/g) || []).length;
      const singleQuotes = (before.match(/'/g) || []).length;
      
      // Si nombre impair de guillemets, on est dans une chaîne
      if (doubleQuotes % 2 === 1 || singleQuotes % 2 === 1) {
        return match;
      }
      return ' __EQ__ ';
    });
    
    // Remplacer les marqueurs par les vrais opérateurs JavaScript
    js = js.replace(/__LTE__/g, '<=');
    js = js.replace(/__GTE__/g, '>=');
    js = js.replace(/__NEQ__/g, '!==');
    js = js.replace(/__LT__/g, '<');
    js = js.replace(/__GT__/g, '>');
    js = js.replace(/__EQ__/g, '===');

    // 4. Remplacer les fonctions DSL par des appels aux helpers
    js = js.replace(/\band\s*\(/gi, 'AND_FUNC(');
    js = js.replace(/\bor\s*\(/gi, 'OR_FUNC(');
    js = js.replace(/\bnot\s*\(/gi, 'NOT_FUNC(');

    const helperNames = [
      'IF', 'CASE_WHEN', 'COALESCE', 'ROUND', 'ABS', 'CEIL', 'FLOOR', 'NULLIF', 'IS_NULL',
      'IN', 'BETWEEN', 'EQ', 'NE', 'LT', 'LTE', 'GT', 'GTE',
      'DATE_DIFF', 'DATEDIFF', 'DATE_ADD', 'DATE_TRUNC', 'EXTRACT',
      'START_OF', 'END_OF', 'MAKE_DATE', 'TODAY', 'NOW', 'UPPER', 'LOWER', 'LENGTH',
      'LEFT', 'RIGHT', 'SUBSTR', 'SUBSTRING', 'TRIM', 'LTRIM', 'RTRIM',
      'REPLACE', 'REGEX_MATCH', 'REGEX_EXTRACT', 'REGEX_REPLACE',
      'CONCAT', 'CONCAT_WS', 'CAST', 'TRY_CAST', 
      'ADD', 'SUB', 'MUL', 'DIV', 'MOD', 'NEGATE', 'POWER', 'SQRT', 'SIGN',
      'GREATEST', 'LEAST'
    ];

    for (const name of helperNames) {
      const regex = new RegExp(`\\b${name}\\s*\\(`, 'gi');
      js = js.replace(regex, `${name}(`);
    }

    return js;
  }

  /**
   * Crée les fonctions helpers disponibles dans les formules
   * @returns {Object} - Map de fonctions
   */
  createHelpers() {
    const helpers = {};

    helpers.IF = (condition, trueValue, falseValue) => (condition ? trueValue : falseValue);

    helpers.CASE_WHEN = (...args) => {
      const len = args.length;
      for (let i = 0; i < len - 1; i += 2) {
        if (args[i]) {
          return args[i + 1];
        }
      }
      return len % 2 === 1 ? args[len - 1] : null;
    };

    helpers.COALESCE = (...args) => {
      for (const arg of args) {
        if (arg != null && arg !== undefined) {
          return arg;
        }
      }
      return null;
    };

    helpers.ROUND = (value, decimals = 2) => {
      const num = safeToNumber(value);
      if (num == null) return null;
      const factor = 10 ** (decimals ?? 0);
      return Math.round(num * factor) / factor;
    };

    helpers.ABS = (value) => {
      const num = safeToNumber(value);
      return num == null ? null : Math.abs(num);
    };

    helpers.CEIL = (value) => {
      const num = safeToNumber(value);
      return num == null ? null : Math.ceil(num);
    };

    helpers.FLOOR = (value) => {
      const num = safeToNumber(value);
      return num == null ? null : Math.floor(num);
    };

    helpers.NULLIF = (a, b) => (a === b ? null : a);

    helpers.IS_NULL = (value) => value === null || value === undefined;

    helpers.IN = (value, ...candidates) => {
      for (const candidate of candidates) {
        if (Array.isArray(candidate)) {
          if (candidate.includes(value)) return true;
        } else if (value === candidate) {
          return true;
        }
      }
      return false;
    };

    helpers.BETWEEN = (value, lower, upper) => {
      if (value == null || lower == null || upper == null) return false;

      const valueDate = ensureDate(value);
      const lowerDate = ensureDate(lower);
      const upperDate = ensureDate(upper);
      if (valueDate && lowerDate && upperDate) {
        const time = valueDate.getTime();
        return time >= lowerDate.getTime() && time <= upperDate.getTime();
      }

      const valueNumber = safeToNumber(value);
      const lowerNumber = safeToNumber(lower);
      const upperNumber = safeToNumber(upper);
      if (valueNumber != null && lowerNumber != null && upperNumber != null) {
        return valueNumber >= lowerNumber && valueNumber <= upperNumber;
      }

      return value >= lower && value <= upper;
    };

    // Comparison aliases
    helpers.EQ = (a, b) => a === b;
    helpers.NE = (a, b) => a !== b;
    helpers.LT = (a, b) => {
      const numA = safeToNumber(a);
      const numB = safeToNumber(b);
      if (numA != null && numB != null) return numA < numB;
      const dateA = ensureDate(a);
      const dateB = ensureDate(b);
      if (dateA && dateB) return dateA.getTime() < dateB.getTime();
      return a < b;
    };
    helpers.LTE = (a, b) => {
      const numA = safeToNumber(a);
      const numB = safeToNumber(b);
      if (numA != null && numB != null) return numA <= numB;
      const dateA = ensureDate(a);
      const dateB = ensureDate(b);
      if (dateA && dateB) return dateA.getTime() <= dateB.getTime();
      return a <= b;
    };
    helpers.GT = (a, b) => {
      const numA = safeToNumber(a);
      const numB = safeToNumber(b);
      if (numA != null && numB != null) return numA > numB;
      const dateA = ensureDate(a);
      const dateB = ensureDate(b);
      if (dateA && dateB) return dateA.getTime() > dateB.getTime();
      return a > b;
    };
    helpers.GTE = (a, b) => {
      const numA = safeToNumber(a);
      const numB = safeToNumber(b);
      if (numA != null && numB != null) return numA >= numB;
      const dateA = ensureDate(a);
      const dateB = ensureDate(b);
      if (dateA && dateB) return dateA.getTime() >= dateB.getTime();
      return a >= b;
    };

    helpers.DATE_DIFF = (unit, start, end) => diffDate(unit, start, end);

    helpers.DATEDIFF = (end, start, unit) => helpers.DATE_DIFF(unit, start, end);

    helpers.DATE_ADD = (unit, amount, base) => {
      const baseDate = ensureDate(base);
      const numericAmount = safeToNumber(amount);
      if (!baseDate || numericAmount == null) return null;

      const result = addUnit(baseDate, unit, numericAmount);
      if (!result) return null;

      return DATE_ONLY_UNITS.has(normalizeUnit(unit))
        ? formatDateOnly(result)
        : formatDateTime(result);
    };

    helpers.DATE_TRUNC = (unit, value) => {
      const date = ensureDate(value);
      if (!date) return null;
      const result = startOfUnit(date, unit);
      return DATE_ONLY_UNITS.has(normalizeUnit(unit))
        ? formatDateOnly(result)
        : formatDateTime(result);
    };

    helpers.START_OF = (unit, value) => helpers.DATE_TRUNC(unit, value);

    helpers.END_OF = (unit, value) => {
      const date = ensureDate(value);
      if (!date) return null;
      const result = endOfUnit(date, unit);
      return DATE_ONLY_UNITS.has(normalizeUnit(unit))
        ? formatDateOnly(result)
        : formatDateTime(result);
    };

    helpers.MAKE_DATE = (year, month, day) => {
      const y = safeToNumber(year);
      const m = safeToNumber(month);
      const d = safeToNumber(day);
      if (y == null || m == null || d == null) return null;
      const date = new Date(Date.UTC(y, m - 1, d));
      if (Number.isNaN(date.getTime())) return null;
      return formatDateOnly(date);
    };

    helpers.TODAY = () => formatDateOnly(new Date());

    helpers.NOW = () => formatDateTime(new Date());

    helpers.EXTRACT = (part, value) => {
      const date = ensureDate(value);
      if (!date) return null;
      const normalized = normalizeUnit(part);

      switch (normalized) {
        case 'year':
          return date.getFullYear();
        case 'month':
          return date.getMonth() + 1;
        case 'day':
        case 'day_of_month':
          return date.getDate();
        case 'hour':
          return date.getHours();
        case 'minute':
          return date.getMinutes();
        case 'second':
          return date.getSeconds();
        case 'quarter':
          return Math.floor(date.getMonth() / 3) + 1;
        case 'week': {
          const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
          const dayNumber = temp.getUTCDay() || 7;
          temp.setUTCDate(temp.getUTCDate() + 4 - dayNumber);
          const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
          return Math.ceil(((temp - yearStart) / 86_400_000 + 1) / 7);
        }
        case 'dow':
        case 'day_of_week':
          return (date.getDay() + 6) % 7 + 1; // ISO (1 = lundi)
        default:
          return null;
      }
    };

    helpers.UPPER = (text) => (text != null ? String(text).toUpperCase() : '');

    helpers.LOWER = (text) => (text != null ? String(text).toLowerCase() : '');

    helpers.LENGTH = (text) => (text != null ? String(text).length : 0);

    helpers.LEFT = (text, length) => {
      const str = text != null ? String(text) : '';
      const count = safeToNumber(length) ?? 0;
      return str.slice(0, Math.max(0, count));
    };

    helpers.RIGHT = (text, length) => {
      const str = text != null ? String(text) : '';
      const count = safeToNumber(length) ?? 0;
      return count === 0 ? '' : str.slice(-Math.max(0, count));
    };

    helpers.SUBSTR = (text, start, length) => {
      const str = text != null ? String(text) : '';
      const startPos = safeToNumber(start) ?? 0;
      if (length == null) {
        return str.substring(startPos);
      }
      const len = safeToNumber(length) ?? 0;
      return str.substring(startPos, startPos + len);
    };

    helpers.SUBSTRING = helpers.SUBSTR;

    helpers.TRIM = (text) => (text != null ? String(text).trim() : '');
    helpers.LTRIM = (text) => (text != null ? String(text).trimStart() : '');
    helpers.RTRIM = (text) => (text != null ? String(text).trimEnd() : '');

    helpers.REPLACE = (text, search, replacement) => {
      if (text == null) return '';
      const source = String(text);
      const target = search != null ? String(search) : '';
      const replaceBy = replacement != null ? String(replacement) : '';
      if (target === '') return source;
      return source.split(target).join(replaceBy);
    };

    helpers.REGEX_MATCH = (text, pattern) => {
      if (text == null || pattern == null) return false;
      const regex = new RegExp(pattern);
      return regex.test(String(text));
    };

    helpers.REGEX_EXTRACT = (text, pattern, groupIndex = 1) => {
      if (text == null || pattern == null) return null;
      const regex = new RegExp(pattern);
      const match = regex.exec(String(text));
      if (!match) return null;
      const indexRaw = groupIndex == null ? 1 : Number(groupIndex);
      const index = Number.isNaN(indexRaw) ? 1 : indexRaw;
      return match[index] ?? null;
    };

    helpers.REGEX_REPLACE = (text, pattern, replacement = '') => {
      if (text == null || pattern == null) return null;
      const regex = new RegExp(pattern, 'g');
      return String(text).replace(regex, replacement);
    };

    helpers.CONCAT = (...args) => args.filter((v) => v != null && v !== undefined).map((v) => String(v)).join('');

    helpers.CONCAT_WS = (separator, ...args) => {
      const sep = separator != null ? String(separator) : '';
      return args.filter((v) => v != null && v !== undefined).map((v) => String(v)).join(sep);
    };

    helpers.CAST = (value, type) => castValue(value, type, { strict: true });

    helpers.TRY_CAST = (value, type) => castValue(value, type, { strict: false });

    helpers.ADD = (...args) => {
      if (!args.length) return 0;
      let total = 0;
      for (const arg of args) {
        const num = safeToNumber(arg) ?? 0;
        total += num;
      }
      return total;
    };

    helpers.SUB = (...args) => {
      if (!args.length) return null;
      const first = safeToNumber(args[0]);
      if (first == null) return null;
      let result = first;
      for (let i = 1; i < args.length; i++) {
        const num = safeToNumber(args[i]) ?? 0;
        result -= num;
      }
      return result;
    };

    helpers.MUL = (...args) => {
      if (!args.length) return null;
      let result = 1;
      for (const arg of args) {
        const num = safeToNumber(arg);
        if (num == null) return null;
        result *= num;
      }
      return result;
    };

    helpers.DIV = (a, b) => {
      const numerator = safeToNumber(a);
      const denominator = safeToNumber(b);
      if (numerator == null || denominator == null || denominator === 0) return null;
      return numerator / denominator;
    };

    helpers.MOD = (a, b) => {
      const left = safeToNumber(a);
      const right = safeToNumber(b);
      if (left == null || right == null || right === 0) return null;
      return left % right;
    };

    helpers.NEGATE = (value) => {
      const num = safeToNumber(value);
      return num == null ? null : -num;
    };

    helpers.POWER = (base, exponent) => {
      const b = safeToNumber(base);
      const e = safeToNumber(exponent);
      if (b == null || e == null) return null;
      return Math.pow(b, e);
    };

    helpers.SQRT = (value) => {
      const num = safeToNumber(value);
      if (num == null || num < 0) return null;
      return Math.sqrt(num);
    };

    helpers.SIGN = (value) => {
      const num = safeToNumber(value);
      if (num == null) return null;
      return num > 0 ? 1 : num < 0 ? -1 : 0;
    };

    helpers.GREATEST = (...args) => {
      const nums = args.map(safeToNumber).filter(n => n != null);
      return nums.length ? Math.max(...nums) : null;
    };

    helpers.LEAST = (...args) => {
      const nums = args.map(safeToNumber).filter(n => n != null);
      return nums.length ? Math.min(...nums) : null;
    };

    helpers.AND_FUNC = (...args) => args.every((value) => Boolean(value));

    helpers.OR_FUNC = (...args) => args.some((value) => Boolean(value));

    helpers.NOT_FUNC = (value) => !Boolean(value);

    return helpers;
  }

  /**
   * Extrait les champs référencés dans une formule
   * @param {string} formula - Formule DSL
   * @returns {string[]} - Liste des champs (format: "field" ou "Collection.field")
   */
  extractFields(formula) {
    if (!formula) return [];

    const fields = [];
    const regex = /\{\{([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)?)\}\}/g;
    let match;

    while ((match = regex.exec(formula)) !== null) {
      fields.push(match[1]);
    }

    return [...new Set(fields)]; // Unique
  }

  /**
   * Extrait les dépendances locales (sans collection)
   * @param {string} formula - Formule DSL
   * @returns {string[]} - Liste des champs locaux
   */
  extractLocalDependencies(formula) {
    const allFields = this.extractFields(formula);
    return allFields.filter(field => !field.includes('.'));
  }

  /**
   * Teste si une formule est locale (pas de références croisées)
   * @param {string} formula - Formule DSL
   * @returns {boolean} - true si locale
   */
  isLocalFormula(formula) {
    if (!formula) return true;

    // Patterns qui indiquent une formule NON locale
    const nonLocalPatterns = [
      /\{\{[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+\}\}/,  // {{Collection.field}}
      /\bLOOKUP\s*\(/i,                         // LOOKUP()
      /\bPARENT\s*\(/i,                         // PARENT()
      /\bCHILDREN\s*\(/i,                       // CHILDREN()
      /\bRELATED\s*\(/i,                        // RELATED()
      /\bSUM\s*\(/i,                            // SUM() - agrégation
      /\bAVG\s*\(/i,                            // AVG() - agrégation
      /\bCOUNT\s*\(/i,                          // COUNT() - agrégation
      /\bMIN\s*\(/i,                            // MIN() - agrégation
      /\bMAX\s*\(/i,                            // MAX() - agrégation
      /\bCOUNT_DISTINCT\s*\(/i,                 // COUNT_DISTINCT() - agrégation
    ];

    for (const pattern of nonLocalPatterns) {
      if (pattern.test(formula)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Valide une formule et retourne les erreurs éventuelles
   * @param {string} formula - Formule DSL
   * @param {Object} sampleData - Données d'exemple pour tester
   * @returns {Object} - {valid: boolean, error?: string, result?: any}
   */
  validate(formula, sampleData = {}) {
    try {
      const fn = this.compile(formula);
      const result = fn(sampleData);
      
      return {
        valid: true,
        result: result
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }
}

/**
 * Évaluateur de formules DSL simplifié
 * Utilise le parser pour compiler et évaluer des formules
 */
export class DSLEvaluator {
  constructor(logger) {
    this.parser = new DSLParser();
    this.logger = logger;
    this.compiledCache = new Map(); // Cache des formules compilées
  }

  /**
   * Évalue une formule avec des données
   * @param {string} formula - Formule DSL
   * @param {Object} data - Données de contexte
   * @returns {any} - Résultat calculé
   */
  evaluate(formula, data) {
    try {
      // Utiliser le cache si disponible
      let compiledFn = this.compiledCache.get(formula);
      
      if (!compiledFn) {
        compiledFn = this.parser.compile(formula);
        this.compiledCache.set(formula, compiledFn);
      }

      const result = compiledFn(data);
      this.logger?.debug(`Evaluated: ${formula} = ${result}`);
      return result;
      
    } catch (error) {
      this.logger?.error(`Error evaluating formula "${formula}":`, error.message);
      throw error;
    }
  }

  /**
   * Efface le cache des formules compilées
   */
  clearCache() {
    this.compiledCache.clear();
  }

  /**
   * Retourne la taille du cache
   * @returns {number} - Nombre de formules en cache
   */
  getCacheSize() {
    return this.compiledCache.size;
  }

  /**
   * Extrait les dépendances d'une formule
   * @param {string} formula - Formule DSL
   * @returns {string[]} - Liste des champs dépendants
   */
  extractDependencies(formula) {
    return this.parser.extractLocalDependencies(formula);
  }

  /**
   * Teste si une formule est locale
   * @param {string} formula - Formule DSL
   * @returns {boolean} - true si locale
   */
  isLocal(formula) {
    return this.parser.isLocalFormula(formula);
  }

  /**
   * Alias pour isLocal (pour compatibilité avec les tests)
   * @param {string} formula - Formule DSL
   * @returns {boolean} - true si locale
   */
  isLocalFormula(formula) {
    return this.isLocal(formula);
  }
}
