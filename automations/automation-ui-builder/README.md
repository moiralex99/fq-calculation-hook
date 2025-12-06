# Automation UI Builder (Mantine + React Flow)

Prototype d'éditeur visuel inspiré de Zapier/n8n pour construire des automations Directus.

## Contenu

- `AutomationBuilder.tsx` : composant principal (palette + canvas React Flow + inspector Mantine).
- `types.ts` : définitions réutilisables (`AutomationDraft`, `BuilderNodeData`, etc.).
- `index.ts` : point d'entrée pour réexporter le composant.

## Dépendances suggérées

```bash
npm install @mantine/core @mantine/hooks @mantine/dates reactflow
```

> Le dépôt utilise déjà Mantine pour l'admin UI; ajoutez simplement `reactflow` si nécessaire.

## Utilisation rapide

```tsx
import { AutomationBuilder } from './automations/automation-ui-builder';

const [draft, setDraft] = useState<AutomationDraft>({
  name: 'Màj statut projet',
  status: 'active',
  collection_cible: ['projects'],
  trigger_event: ['update'],
  priority: 10,
  rule: {},
  actions: [],
});

<AutomationBuilder value={draft} onChange={setDraft} />;
```

- Palette à gauche : ajoute des triggers / conditions / actions.
- Canvas (React Flow) : réordonner et relier les blocs (connecteurs visuels).
- Inspector à droite : configure le bloc sélectionné (champ, opérateur, payload…).
- Le composant recompose automatiquement `draft.rule` (JSONLogic) et `draft.actions`.

## Démarrer le serveur de dev

Une mini app Vite est fournie dans `automation-ui-builder/demo` :

```bash
cd automations/automation-ui-builder/demo
npm install
npm run dev
```

Le serveur (port 5175 par défaut) charge `AutomationBuilder` via un alias local `@builder`. Modifiez `src/App.tsx` pour tester différents drafts, jouer avec le layout, etc.

## Limitations actuelles

- Conversion automatique supporte les conditions basiques (`===`, `>`, `>=`, `contains`) et les actions `set_field` & `trigger_flow`.
- Le mapping depuis un `draft` existant vers les nœuds reste minimal (réinitialisation recommandée lors d'une nouvelle automation).
- La persistance des positions/edges est locale au composant (à stocker si besoin).

Ces fondations suffisent pour étendre vers un vrai builder drag & drop façon n8n (plus de types de nœuds, variables contextuelles, tests inline…).

## Open source à étudier

- **React Flow** (MIT) – déjà utilisé ici, mais le dépôt officiel regorge d’exemples avancés (minimap, sous-flux, validation visuelle) à réutiliser tels quels : https://github.com/wbkd/react-flow.
- **n8n** (AGPL) – l’éditeur de workflows complet est open source et peut servir d’inspiration UX/drag-n-drop si la licence AGPL convient : https://github.com/n8n-io/n8n.
- **LogicFlow** (MIT) – alternative canvas orientée BPMN/logiciel métier (https://github.com/didi/LogicFlow). Utile si l’on veut plus de tooling BPMN ou un rendu plus proche de Camunda.

En combinant React Flow (base MIT) avec des patterns UX observés dans n8n, on garde une implémentation légère tout en se rapprochant des éditeurs professionnels.
