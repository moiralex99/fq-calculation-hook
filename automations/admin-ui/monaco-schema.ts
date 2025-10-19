// JSON Schema + snippets for Automation editor

export function getAutomationJsonSchema() {
  const jsonLogicExpr: any = {
    anyOf: [
      { type: 'boolean' },
      { type: 'number' },
      { type: 'string' },
      { type: 'null' },
      { type: 'array', items: { $ref: '#/definitions/jsonLogicExpr' } },
      {
        type: 'object',
        additionalProperties: { $ref: '#/definitions/jsonLogicExpr' },
        description: 'JSONLogic object or plain values',
      },
    ],
    description: 'JSONLogic expression or literal',
  };

  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: 'inmemory://model/automation-schema.json',
    title: 'Automation Schema',
    type: 'object',
    definitions: { jsonLogicExpr },
    properties: {
      name: { type: 'string' },
      status: { enum: ['active', 'inactive'] },
      collection_cible: {
        anyOf: [
          { type: 'string' },
          { type: 'array', items: { type: 'string' } },
        ],
      },
      trigger_event: { type: 'array', items: { type: 'string' } },
      priority: { type: 'number' },
      expand_fields: { type: 'array', items: { type: 'string' } },
      throttle_ms: { type: 'number', minimum: 0 },
      throttle_scope: { enum: ['rule', 'collection', 'item', 'user'] },
      rule: { $ref: '#/definitions/jsonLogicExpr' },
      actions: {
        type: 'array',
        items: {
          type: 'object',
          required: ['type'],
          properties: {
            when: { $ref: '#/definitions/jsonLogicExpr' },
            type: {
              enum: [
                'set_field',
                'create_item',
                'update_item',
                'update_many',
                'for_each',
                'trigger_flow',
                'send_email',
              ],
            },
            assign: { type: 'string', description: 'Nom de variable contextuelle à alimenter' },
            data: { type: 'object', additionalProperties: { $ref: '#/definitions/jsonLogicExpr' } },
            id: { $ref: '#/definitions/jsonLogicExpr' },
            collection: { type: 'string' },
            list: { type: 'array', items: { $ref: '#/definitions/jsonLogicExpr' } },
            limit: { $ref: '#/definitions/jsonLogicExpr' },
          },
        },
      },
    },
  } as const;
}

export function getRuleSnippet() {
  return {
    and: [
      { '===': [ { get: 'status' }, 'open' ] },
      { 'any_by': [ { get: 'tasks' }, { '>': [ { get: '$.progress' }, 50 ] } ] }
    ]
  };
}

export function getActionsSnippet() {
  return [
    {
      type: 'set_field',
      when: { '===': [ { get: 'priority' }, null ] },
      data: { priority: 10 }
    },
    {
      type: 'update_many',
      collection: 'taches',
      data: { statut: 'en_cours' },
      limit: 100
    }
  ];
}

export const OPERATORS_HELP: Array<{ name: string; signature: string; example?: any; }> = [
  { name: 'now', signature: 'now -> ISO string' },
  { name: 'date_add', signature: "date_add(date, { days|hours|...: n }) -> ISO" },
  { name: 'date_diff', signature: 'date_diff(a, b, unit=\'ms\') -> number' },
  { name: 'concat', signature: 'concat(a, b, ...strings) -> string' },
  { name: 'matches', signature: 'matches(text, pattern, flags?) -> bool' },
  { name: 'imatches', signature: 'imatches(text, pattern) -> bool' },
  { name: 'iif', signature: 'iif(cond, then, else)' },
  { name: 'case', signature: 'case([[cond, value], ...], default?)' },
  { name: 'get', signature: 'get(path) -> value; supports dot-path and $ vars' },
  { name: 'coalesce', signature: 'coalesce(a, b, ... )' },
  { name: 'length', signature: 'length(array|string|object)' },
  { name: 'map_by', signature: 'map_by(list, expr using $. for item)' },
  { name: 'filter_by', signature: 'filter_by(list, predicate)' },
  { name: 'reduce_by', signature: 'reduce_by(list, init, reducer)' },
  { name: 'sum_by', signature: 'sum_by(list, expr)' },
  { name: 'any_by', signature: 'any_by(list, predicate) -> bool' },
  { name: 'all_by', signature: 'all_by(list, predicate) -> bool' },
  { name: 'lookup', signature: 'lookup(collection, filter, fields?, limit?)' },
  { name: 'lookup_many', signature: 'lookup_many(collection, filter, fields?, limit?)' },
  { name: 'changed_to', signature: 'changed_to(field, value) -> bool' },
];
