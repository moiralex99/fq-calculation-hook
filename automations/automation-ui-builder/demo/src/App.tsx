import { MantineProvider, Stack, Title } from '@mantine/core';
import { useState } from 'react';
import { AutomationBuilder, AutomationDraft } from '@builder';

const initialDraft: AutomationDraft = {
  name: 'Mise à jour statut projet',
  status: 'active',
  collection_cible: ['projects'],
  trigger_event: ['update'],
  priority: 10,
  rule: {},
  actions: []
};

export default function App() {
  const [draft, setDraft] = useState<AutomationDraft>(initialDraft);

  return (
    <MantineProvider defaultColorScheme="dark">
      <AutomationBuilder value={draft} onChange={setDraft} height="100vh" />
    </MantineProvider>
  );
}
