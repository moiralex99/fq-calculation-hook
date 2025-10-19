// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Group, List, NumberInput, Select, Stack, Tabs, TagsInput, Text, TextInput, Title } from '@mantine/core';
import Editor, { useMonaco, OnChange, OnMount } from '@monaco-editor/react';

import { getAutomationJsonSchema, getActionsSnippet, getRuleSnippet, OPERATORS_HELP } from './monaco-schema';

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

type Props = {
  value: AutomationDraft;
  onChange: (next: AutomationDraft) => void;
  onSave?: (draft: AutomationDraft) => void;
  disabled?: boolean;
  height?: number | string;
  schemaProvider?: {
    loadCollections: () => Promise<string[]>;
    loadFields: (collection: string) => Promise<string[]>;
  };
  apiClient?: { dryRun: (args: any) => Promise<any>; lint: (args: any) => Promise<any> };
  onDryRun?: (args: { draft: AutomationDraft; sampleItem: any }) => Promise<{ ok: boolean; output?: any; logs?: any[]; error?: string }>;
  onLint?: (args: { draft: AutomationDraft }) => Promise<Array<{ level: 'info'|'warn'|'error'; message: string }>>;
};

function safeStringify(v: any) {
  try { return JSON.stringify(v, null, 2); } catch { return ''; }
}

function safeParse<T = any>(s: string, fallback: T): T {
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

export function AutomationEditor({ value, onChange, onSave, disabled, height = 520, apiClient, onDryRun, onLint }: Props) {
  const monaco = useMonaco();
  const [ruleText, setRuleText] = useState<string>(safeStringify(value.rule ?? {},));
  const [actionsText, setActionsText] = useState<string>(safeStringify(value.actions ?? []));
  const [ruleErrors, setRuleErrors] = useState<string | null>(null);
  const [actionsErrors, setActionsErrors] = useState<string | null>(null);
  const ruleEditorRef = useRef<any>(null);
  const actionsEditorRef = useRef<any>(null);
  const [collections, setCollections] = useState<string[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [fields, setFields] = useState<string[]>([]);

  // Register JSON schema once monaco is ready
  useEffect(() => {
    if (!monaco) return;
    const monacoJSON = monaco.languages.json;
    const schema = getAutomationJsonSchema();
    monacoJSON.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: true,
      enableSchemaRequest: false,
      schemas: [
        {
          uri: 'inmemory://model/automation-schema.json',
          fileMatch: ['*automation-rule*', '*automation-actions*'],
          schema,
        },
      ],
    });
  }, [monaco]);

  // Keep outer value in sync if it changes from outside
  useEffect(() => { setRuleText(safeStringify(value.rule ?? {})); }, [value.rule]);
  useEffect(() => { setActionsText(safeStringify(value.actions ?? [])); }, [value.actions]);

  const collectionsValue = useMemo(() => {
    const c = value.collection_cible;
    return Array.isArray(c) ? c : (c ? [c] : []);
  }, [value.collection_cible]);

  // Load collections/fields with provided provider
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!cancelled && (AutomationEditor as any).props?.schemaProvider) {
          // no-op in isolated env
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const onRuleChange: OnChange = (text) => {
    const s = text ?? '';
    setRuleText(s);
    try {
      const parsed = JSON.parse(s);
      setRuleErrors(null);
      onChange({ ...value, rule: parsed });
    } catch (e: any) {
      setRuleErrors(String(e?.message || e));
    }
  };

  const onActionsChange: OnChange = (text) => {
    const s = text ?? '';
    setActionsText(s);
    try {
      const parsed = JSON.parse(s);
      if (!Array.isArray(parsed)) throw new Error('Actions doit être un tableau');
      setActionsErrors(null);
      onChange({ ...value, actions: parsed });
    } catch (e: any) {
      setActionsErrors(String(e?.message || e));
    }
  };

  const insertRuleSnippet = () => {
    const snippet = getRuleSnippet();
    setRuleText(safeStringify(snippet));
    onChange({ ...value, rule: snippet });
  };

  const insertActionsSnippet = () => {
    const snippet = getActionsSnippet();
    setActionsText(safeStringify(snippet));
    onChange({ ...value, actions: snippet });
  };

  const onRuleMount: OnMount = (editor) => { ruleEditorRef.current = editor; };
  const onActionsMount: OnMount = (editor) => { actionsEditorRef.current = editor; };

  const insertIntoRuleAtCursor = (jsonValue: any) => {
    const editor = ruleEditorRef.current;
    if (!editor) return;
    try {
      const model = editor.getModel();
      const pos = editor.getPosition();
      const Range = (monaco as any)?.Range || (window as any).monaco?.Range;
      const text = JSON.stringify(jsonValue, null, 2);
      editor.executeEdits('insert-json', [{ range: new Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column), text }]);
      editor.focus();
    } catch {}
  };

  // Append a template into the Actions JSON array
  const appendActionTemplate = (tpl: any) => {
    try {
      const arr = JSON.parse(actionsText || '[]');
      if (!Array.isArray(arr)) throw new Error('Actions JSON n\'est pas un tableau');
      arr.push(tpl);
      const next = safeStringify(arr);
      setActionsText(next);
      onChange({ ...value, actions: arr });
      setActionsErrors(null);
    } catch (e: any) {
      setActionsErrors('Impossible d\'ajouter le template: ' + (e?.message || e));
      const editor = actionsEditorRef.current;
      if (editor) {
        const text = JSON.stringify(tpl, null, 2);
        const full = editor.getModel().getFullModelRange();
        editor.executeEdits('append-action', [{ range: full, text }]);
        editor.focus();
      }
    }
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Title order={4}>Automation</Title>
        <Group>
          <Button variant="light" onClick={() => insertRuleSnippet()} disabled={disabled}>Snippet règle</Button>
          <Button variant="light" onClick={() => insertActionsSnippet()} disabled={disabled}>Snippet actions</Button>
          {onSave && (
            <Button onClick={() => onSave(value)} disabled={disabled || !!ruleErrors || !!actionsErrors}>Enregistrer</Button>
          )}
        </Group>
      </Group>

      <Card withBorder>
        <Stack>
          <Group grow>
            <TextInput
              label="Nom"
              placeholder="Nom de l'automation"
              value={value.name}
              onChange={(e) => onChange({ ...value, name: e.currentTarget.value })}
              disabled={disabled}
            />
            <Select
              label="Statut"
              data={[{ value: 'active', label: 'active' }, { value: 'inactive', label: 'inactive' }]}
              value={value.status ?? 'active'}
              onChange={(v) => onChange({ ...value, status: (v as any) ?? 'active' })}
            />
            <NumberInput
              label="Priorité"
              value={value.priority ?? 10}
              onChange={(v) => onChange({ ...value, priority: Number(v ?? 10) })}
              min={-100}
              max={100}
            />
          </Group>

          <Group grow>
            <TagsInput
              label="Collections cibles"
              placeholder="ex: taches, actions"
              value={collectionsValue}
              onChange={(vals) => onChange({ ...value, collection_cible: vals })}
            />
            <TagsInput
              label="Événements (trigger_event)"
              placeholder="create, update, *"
              value={value.trigger_event ?? ['update']}
              onChange={(vals) => onChange({ ...value, trigger_event: vals })}
            />
          </Group>

          <Group grow>
            <TagsInput
              label="expand_fields"
              placeholder="project.name, client.email"
              value={value.expand_fields ?? []}
              onChange={(vals) => onChange({ ...value, expand_fields: vals })}
            />
            <NumberInput
              label="throttle_ms"
              value={value.throttle_ms ?? 0}
              onChange={(v) => onChange({ ...value, throttle_ms: Number(v ?? 0) })}
              min={0}
              step={50}
            />
            <Select
              label="throttle_scope"
              data={[
                { value: 'rule', label: 'rule' },
                { value: 'collection', label: 'collection' },
                { value: 'item', label: 'item' },
                { value: 'user', label: 'user' },
              ]}
              value={value.throttle_scope ?? 'rule'}
              onChange={(v) => onChange({ ...value, throttle_scope: (v as any) ?? 'rule' })}
            />
          </Group>
        </Stack>
      </Card>

      <Tabs defaultValue="rule">
        <Tabs.List>
          <Tabs.Tab value="rule">Règle (JSONLogic)</Tabs.Tab>
          <Tabs.Tab value="actions">Actions (array)</Tabs.Tab>
          <Tabs.Tab value="help">Aide</Tabs.Tab>
          <Tabs.Tab value="dry">Dry-run</Tabs.Tab>
          <Tabs.Tab value="validate">Validation</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="rule" pt="md">
          <Card withBorder>
            <Editor
              height={height}
              defaultLanguage="json"
              path="automation-rule.json"
              value={ruleText}
              onChange={onRuleChange}
              onMount={onRuleMount}
              options={{ minimap: { enabled: false }, fontSize: 13, tabSize: 2 }}
            />
            {ruleErrors && <Text c="red" size="sm" mt="xs">{ruleErrors}</Text>}
            {/* Dynamic pickers */}
            <Group mt="md" grow>
              <Button variant="light" onClick={async () => {
                if (!(AutomationEditor as any).props?.schemaProvider) return;
                try {
                  const list = await (AutomationEditor as any).props.schemaProvider.loadCollections();
                  setCollections(list || []);
                } catch { setCollections([]); }
              }}>Charger collections</Button>
              <Select
                label="Collection"
                placeholder="Sélectionner"
                data={collections.map((c) => ({ value: c, label: c }))}
                value={selectedCollection}
                onChange={async (v) => {
                  setSelectedCollection(v);
                  if (!(AutomationEditor as any).props?.schemaProvider || !v) return;
                  try {
                    const fs = await (AutomationEditor as any).props.schemaProvider.loadFields(v);
                    setFields(fs || []);
                  } catch { setFields([]); }
                }}
              />
              <Select
                label="Champ"
                placeholder="Sélectionner"
                data={fields.map((f) => ({ value: f, label: f }))}
                onChange={(f) => f && insertIntoRuleAtCursor({ get: f })}
              />
            </Group>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="actions" pt="md">
          <Card withBorder>
            <Editor
              height={height}
              defaultLanguage="json"
              path="automation-actions.json"
              value={actionsText}
              onChange={onActionsChange}
              onMount={onActionsMount}
              options={{ minimap: { enabled: false }, fontSize: 13, tabSize: 2 }}
            />
            {actionsErrors && <Text c="red" size="sm" mt="xs">{actionsErrors}</Text>}
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="help" pt="md">
          <Card withBorder>
            <HelpContent />
            <Title order={6} mt="md">Insertion rapide</Title>
            <Group align="flex-start" grow>
              <Card withBorder>
                <Title order={6}>Opérateurs</Title>
                <List size="sm">
                  {OPERATORS_HELP.map((op: { name: string; signature: string }) => (
                    <List.Item key={op.name}>
                      <Group justify="space-between">
                        <Text size="sm"><b>{op.name}</b>: {op.signature}</Text>
                        <Button size="xs" variant="light" onClick={() => insertIntoRuleAtCursor({ [op.name]: [] })}>Insérer</Button>
                      </Group>
                    </List.Item>
                  ))}
                </List>
              </Card>
              <Card withBorder>
                <Title order={6}>Actions</Title>
                <Stack gap="xs">
                  <Button size="xs" variant="light" onClick={() => appendActionTemplate({ type: 'set_field', field: 'my_field', value: { get: 'path' } })}>Ajouter action: set_field</Button>
                  <Button size="xs" variant="light" onClick={() => appendActionTemplate({ type: 'create_item', collection: 'taches', data: { name: 'New' } })}>Ajouter action: create_item</Button>
                  <Button size="xs" variant="light" onClick={() => appendActionTemplate({ type: 'update_item', collection: 'taches', id: { get: 'id' }, data: { statut: 'done' } })}>Ajouter action: update_item</Button>
                  <Button size="xs" variant="light" onClick={() => appendActionTemplate({ type: 'update_many', collection: 'taches', filter: { statut: { _neq: 'done' } }, data: { statut: 'en_cours' }, limit: 100 })}>Ajouter action: update_many</Button>
                  <Button size="xs" variant="light" onClick={() => appendActionTemplate({ type: 'for_each', list: { get: 'items' }, actions: [ { type: 'set_field', field: 'ok', value: true } ] })}>Ajouter action: for_each</Button>
                  <Button size="xs" variant="light" onClick={() => appendActionTemplate({ type: 'trigger_flow', key: 'my_flow', payload: { id: { get: 'id' } } })}>Ajouter action: trigger_flow</Button>
                  <Button size="xs" variant="light" onClick={() => appendActionTemplate({ type: 'send_email', to: ['user@example.com'], subject: 'Sujet', body: 'Contenu' })}>Ajouter action: send_email</Button>
                </Stack>
              </Card>
            </Group>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="dry" pt="md">
          <Card withBorder>
            <Group justify="space-between" align="center" mb="xs">
              <Title order={6}>Dry-run avec un item d'exemple</Title>
              <Button size="xs" onClick={async () => {
                try {
                  const sample = safeParse<any>(sampleItemText || '{}', {});
                  const fn = onDryRun || (apiClient ? async ({ draft, sampleItem }: any) => {
                    const resp = await apiClient.dryRun({ draft, sampleItem });
                    return resp;
                  } : null);
                  if (!fn) return; // nothing to call
                  const res = await fn({ draft: value, sampleItem: sample });
                  setDryRunResult(res);
                } catch (e: any) {
                  setDryRunResult({ ok: false, error: String(e?.message || e) });
                }
              }}>Exécuter</Button>
            </Group>
            <Group align="flex-start" grow>
              <Card withBorder>
                <Text size="sm">Item d'exemple</Text>
                <Editor height={Math.max(220, Number(height) / 2)} defaultLanguage="json" value={sampleItemText} onChange={(t) => setSampleItemText(t || '{}')} options={{ minimap: { enabled: false }, fontSize: 13, tabSize: 2 }} />
              </Card>
              <Card withBorder>
                <Text size="sm">Résultat</Text>
                <pre style={{ maxHeight: 260, overflow: 'auto', margin: 0 }}>{safeStringify(dryRunResult)}</pre>
              </Card>
            </Group>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="validate" pt="md">
          <Card withBorder>
            <Group justify="space-between" align="center" mb="xs">
              <Title order={6}>Validation serveur</Title>
              <Button size="xs" onClick={async () => {
                const fn = onLint || (apiClient ? async ({ draft }: any) => {
                  const resp = await apiClient.lint({ draft });
                  // Normalize into array of messages for UI
                  return resp?.messages || [];
                } : null);
                if (!fn) return;
                const msgs = await fn({ draft: value });
                setLintResults(msgs || []);
              }}>Valider</Button>
            </Group>
            {lintResults && (
              <List size="sm">
                {lintResults.map((m, i) => (
                  <List.Item key={i}><b>[{String(m.level).toUpperCase()}]</b> {m.message}</List.Item>
                ))}
              </List>
            )}
            {!lintResults && <Text size="sm">Branchez la prop onLint pour effectuer des vérifications côté serveur (lookups, schéma, etc.).</Text>}
          </Card>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function HelpContent() {
  return (
    <Stack gap="xs">
      <Title order={5}>Aide rapide</Title>
      <Text size="sm">- Règle: JSONLogic (operators: if/and/or, et customs: now, date_add, date_diff, concat, matches, imatches, iif, case, get, coalesce, length, map_by, filter_by, reduce_by, sum_by, any_by, all_by, lookup, lookup_many, changed_to)</Text>
      <Text size="sm">- Contexte: champs de l'item, + $OLD, $CHANGED, $USER, et en for_each: $item, $index, $parent</Text>
      <Text size="sm">- Actions supportées: set_field, create_item, update_item, update_many, for_each, trigger_flow, send_email</Text>
      <Text size="sm">- Option when par action: JSONLogic pour conditionner l'exécution de l'action</Text>
      <Text size="sm">- Astuce: utilisez expand_fields pour précharger des relations nécessaires à la règle</Text>
      <Text size="sm">- Throttle: throttle_ms + throttle_scope pour coalescer des rafales</Text>
      <Title order={6} mt="sm">Opérateurs personnalisés</Title>
      {OPERATORS_HELP.map((op: { name: string; signature: string }) => (
        <Text size="sm" key={op.name}>
          <b>{op.name}</b>: {op.signature}
        </Text>
      ))}
    </Stack>
  );
}

export default AutomationEditor;
