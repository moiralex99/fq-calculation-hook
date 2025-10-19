# Automations Admin UI (React + Mantine + Monaco)

This folder contains a ready-to-use React component to manage automations with a Monaco JSON editor for the rule and actions.

- AutomationEditor.tsx: main component
- monaco-schema.ts: JSON schema support for Monaco + handy snippets and operators reference
- directus-schema.ts: optional helper to wire Directus schema endpoints
- automations-api.ts: tiny client to call /automations endpoints (dry-run, lint)

## Install peer dependencies

This UI expects Mantine and Monaco editor packages in your React app.

- @mantine/core
- @monaco-editor/react
- react, react-dom

## Basic usage

```tsx
import React, { useState } from 'react';
import { AutomationEditor, type AutomationDraft } from './automations/admin-ui';
import { makeDirectusSchemaProvider } from './automations/admin-ui/directus-schema';
import { makeAutomationsApi } from './automations/admin-ui/automations-api';

export default function Page() {
  const [draft, setDraft] = useState<AutomationDraft>({
    name: 'Exemple',
    status: 'active',
    collection_cible: ['taches'],
    trigger_event: ['update'],
    priority: 10,
    rule: { '===': [ { get: 'status' }, 'open' ] },
    actions: [ { type: 'set_field', field: 'flag', value: true } ],
  });

  const schemaProvider = makeDirectusSchemaProvider({ baseUrl: 'https://your-directus.example.com', token: 'YOUR_TOKEN' });
  const apiClient = makeAutomationsApi({ baseUrl: 'https://your-directus.example.com', token: 'YOUR_TOKEN' });

  return (
    <AutomationEditor
      value={draft}
      onChange={setDraft}
      onSave={(val) => console.log('save automation', val)}
      schemaProvider={schemaProvider}
      apiClient={apiClient}
    />
  );
}
```

## Features
- Dynamic pickers: load collections and fields, insert field paths into the rule editor at cursor.
- Insert-on-click menus: add operator stubs and append action templates quickly.
- Dry-run: provide onDryRun or pass apiClient; results rendered in the UI.
- Validation: provide onLint or pass apiClient; messages rendered.
- JSON schema hints and basic parsing error display.
- Use the Snippet buttons to preload examples.
- Action-level `when` is supported.
- `collection_cible` accepts a string or array.
- Throttling options are available: `throttle_ms`, `throttle_scope`.

## Next ideas
- Add a side panel listing operators and insert-on-click.
- Provide dynamic collection/field pickers via Directus schema API.
- Hook this form to your backend saving endpoint.
