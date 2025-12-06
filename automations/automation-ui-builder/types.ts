export type AutomationDraft = {
  id?: string;
  name: string;
  status?: 'active' | 'inactive';
  collection_cible?: string | string[];
  trigger_event?: string[];
  priority?: number;
  expand_fields?: string[];
  throttle_ms?: number;
  throttle_scope?: 'rule' | 'collection' | 'item' | 'user';
  rule: any;
  actions: any[];
};

export type BuilderNodeKind = 'trigger' | 'condition' | 'action';

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'includes'
  | 'matches'
  | 'in'
  | 'not_in';

export type ActionType =
  | 'set_field'
  | 'trigger_flow'
  | 'create_item'
  | 'update_item'
  | 'update_many'
  | 'for_each'
  | 'send_email';

export type BuilderNodeData = {
  label: string;
  kind: BuilderNodeKind;
  config: Record<string, any>;
};
