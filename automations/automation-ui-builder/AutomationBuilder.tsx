// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  MultiSelect,
  NumberInput,
  Paper,
  Select,
  Stack,
  TagsInput,
  Text,
  Textarea,
  TextInput,
  Title,
  ThemeIcon,
  ActionIcon,
  Tooltip,
  ScrollArea,
  rem,
  JsonInput,
  Switch,
  Collapse,
  Modal,
  Code
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import ReactFlow, {
  Background,
  Connection,
  Controls,
  Handle,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  Position,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';

import { AutomationDraft, BuilderNodeData, BuilderNodeKind, ConditionOperator, ActionType } from './types';

type BuilderNode = ReactFlow.Node<BuilderNodeData>;

// --- Inline Icons ---
const IconBolt = ({ size = 24, ...props }: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11" /></svg>
);
const IconGitBranch = ({ size = 24, ...props }: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M7 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M7 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M17 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M7 8l0 8" /><path d="M9 18h6a2 2 0 0 0 2 -2v-5" /><path d="M14 14l3 -3l3 3" /></svg>
);
const IconPlayerPlay = ({ size = 24, ...props }: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M7 4v16l13 -8z" /></svg>
);
const IconTrash = ({ size = 24, ...props }: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>
);
const IconPlus = ({ size = 24, ...props }: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
);
const IconEdit = ({ size = 24, ...props }: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M4 20h4l10.5 -10.5a1.5 1.5 0 0 0 -4 -4l-10.5 10.5v4" /><path d="M13.5 6.5l4 4" /></svg>
);
const IconFiles = ({ size = 24, ...props }: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M15 3v4a1 1 0 0 0 1 1h4" /><path d="M18 17h-7a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h4l5 5v7a2 2 0 0 1 -2 2z" /><path d="M16 17v2a2 2 0 0 1 -2 2h-7a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h2" /></svg>
);
const IconRepeat = ({ size = 24, ...props }: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M4 12v-3a3 3 0 0 1 3 -3h13m-3 -3l3 3l-3 3" /><path d="M20 12v3a3 3 0 0 1 -3 3h-13m3 3l-3 -3l3 -3" /></svg>
);
const IconMail = ({ size = 24, ...props }: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10z" /><path d="M3 7l9 6l9 -6" /></svg>
);
const IconSettings = ({ size = 24, ...props }: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" /><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /></svg>
);
const IconCode = ({ size = 24, ...props }: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M7 8l-4 4l4 4" /><path d="M17 8l4 4l-4 4" /><path d="M14 4l-4 16" /></svg>
);

// --- Theme & Styles ---
const THEME_COLORS = {
  bg: '#09090b',
  panelBg: 'rgba(20, 20, 23, 0.7)',
  panelBorder: 'rgba(255, 255, 255, 0.1)',
  text: '#e4e4e7',
  textDimmed: '#a1a1aa',
  primary: '#3b82f6',
  trigger: '#0ea5e9',
  condition: '#d946ef',
  action: '#22c55e',
  grid: '#27272a'
};

const GLOW_STYLES = {
  trigger: `0 0 15px ${THEME_COLORS.trigger}40`,
  condition: `0 0 15px ${THEME_COLORS.condition}40`,
  action: `0 0 15px ${THEME_COLORS.action}40`,
};

const darkInputStyles = {
  input: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderColor: 'rgba(255,255,255,0.1)',
    color: THEME_COLORS.text,
    '&:focus': { borderColor: THEME_COLORS.primary }
  },
  label: { color: THEME_COLORS.textDimmed }
};

// --- Palette Definition ---
const paletteItems = [
  { kind: 'trigger', title: 'Trigger', subtitle: 'Start automation', icon: IconBolt, color: THEME_COLORS.trigger },
  { kind: 'condition', title: 'Condition', subtitle: 'Logic filter', icon: IconGitBranch, color: THEME_COLORS.condition },
  { kind: 'action', actionType: 'set_field', title: 'Set Field', subtitle: 'Update current item', icon: IconEdit, color: THEME_COLORS.action },
  { kind: 'action', actionType: 'create_item', title: 'Create Item', subtitle: 'Insert new record', icon: IconPlus, color: THEME_COLORS.action },
  { kind: 'action', actionType: 'update_item', title: 'Update Item', subtitle: 'Update by ID', icon: IconEdit, color: THEME_COLORS.action },
  { kind: 'action', actionType: 'update_many', title: 'Update Many', subtitle: 'Bulk update', icon: IconFiles, color: THEME_COLORS.action },
  { kind: 'action', actionType: 'for_each', title: 'For Each', subtitle: 'Loop over list', icon: IconRepeat, color: THEME_COLORS.action },
  { kind: 'action', actionType: 'trigger_flow', title: 'Trigger Flow', subtitle: 'Call Directus Flow', icon: IconPlayerPlay, color: THEME_COLORS.action },
  { kind: 'action', actionType: 'send_email', title: 'Send Email', subtitle: 'Mock email', icon: IconMail, color: THEME_COLORS.action },
];

// --- Helper Functions ---
function defaultConfig(kind: BuilderNodeKind, actionType?: ActionType) {
  if (kind === 'trigger') return { event: 'items.update' };
  if (kind === 'condition') return { field: 'status', operator: 'equals', value: 'open' };

  // Actions
  const base = { actionType: actionType || 'set_field', when: '' };
  switch (actionType) {
    case 'set_field': return { ...base, field: 'status', value: '"done"' };
    case 'create_item': return { ...base, collection: 'tasks', data: '{}', assign: 'new_item' };
    case 'update_item': return { ...base, collection: 'tasks', id: '{ "var": "id" }', data: '{}', assign: 'updated_item' };
    case 'update_many': return { ...base, collection: 'tasks', filter: '{}', data: '{}', assign: 'bulk_result' };
    case 'for_each': return { ...base, list: 'items', actions: [] };
    case 'trigger_flow': return { ...base, key: 'flow_key', payload: '{}' };
    case 'send_email': return { ...base, to: 'user@example.com', subject: 'Notification', body: 'Hello' };
    default: return base;
  }
}

function describeNode(data: BuilderNodeData) {
  if (data.kind === 'trigger') return data.config.event || 'Event';
  if (data.kind === 'condition') return `${data.config.field} ${data.config.operator} ${data.config.value}`;
  if (data.kind === 'action') {
    const type = data.config.actionType;
    if (type === 'set_field') return `Set ${data.config.field}`;
    if (type === 'create_item') return `Create in ${data.config.collection}`;
    if (type === 'update_item') return `Update ${data.config.collection}`;
    if (type === 'update_many') return `Bulk update ${data.config.collection}`;
    if (type === 'for_each') return `Loop ${data.config.list}`;
    if (type === 'trigger_flow') return `Flow: ${data.config.key}`;
    if (type === 'send_email') return `Email to ${data.config.to}`;
    return 'Action';
  }
  return 'Node';
}

// --- Node Components ---
const NodeContainer = ({ children, color, glow, selected }: any) => (
  <Box
    style={{
      background: 'rgba(30, 30, 35, 0.95)',
      border: `1px solid ${selected ? color : 'rgba(255,255,255,0.1)'}`,
      borderRadius: 12,
      minWidth: 240,
      boxShadow: selected ? glow : '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(10px)',
      overflow: 'hidden'
    }}
  >
    {children}
  </Box>
);

const NodeHeader = ({ icon: Icon, label, color }: any) => (
  <Group p="xs" gap="xs" style={{ background: `linear-gradient(90deg, ${color}20 0%, transparent 100%)`, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
    <ThemeIcon size="sm" radius="xl" color={color} variant="light"><Icon size={14} /></ThemeIcon>
    <Text size="xs" fw={700} tt="uppercase" c={color}>{label}</Text>
  </Group>
);

const GenericNode = ({ data, selected, icon, color, label }: any) => (
  <NodeContainer color={color} glow={`0 0 15px ${color}40`} selected={selected}>
    <Handle type="target" position={Position.Left} style={{ background: color, width: 8, height: 8 }} />
    <Handle type="source" position={Position.Right} style={{ background: color, width: 8, height: 8 }} />
    <NodeHeader icon={icon} label={label} color={color} />
    <Box p="sm">
      <Text size="sm" c="white" fw={500} lineClamp={2}>{describeNode(data)}</Text>
      {data.config.when && <Badge size="xs" variant="outline" color="gray" mt={4}>Conditional</Badge>}
    </Box>
  </NodeContainer>
);

const nodeTypes = {
  triggerNode: ({ data, selected }: any) => (
    <NodeContainer color={THEME_COLORS.trigger} glow={GLOW_STYLES.trigger} selected={selected}>
      <Handle type="source" position={Position.Right} style={{ background: THEME_COLORS.trigger }} />
      <NodeHeader icon={IconBolt} label="Trigger" color={THEME_COLORS.trigger} />
      <Box p="sm"><Text size="sm" c="white" fw={500}>{data.config.event}</Text></Box>
    </NodeContainer>
  ),
  conditionNode: ({ data, selected }: any) => <GenericNode data={data} selected={selected} icon={IconGitBranch} color={THEME_COLORS.condition} label="Condition" />,
  actionNode: ({ data, selected }: any) => {
    const type = data.config.actionType;
    let icon = IconPlayerPlay;
    if (type === 'create_item') icon = IconPlus;
    if (type === 'update_item' || type === 'set_field') icon = IconEdit;
    if (type === 'update_many') icon = IconFiles;
    if (type === 'for_each') icon = IconRepeat;
    if (type === 'send_email') icon = IconMail;
    return <GenericNode data={data} selected={selected} icon={icon} color={THEME_COLORS.action} label={type.replace('_', ' ')} />;
  }
};

// --- Main Component ---
export function AutomationBuilder({ value, onChange, height = 800 }: any) {
  const [meta, setMeta] = useState({
    name: value.name || '',
    status: value.status || 'active',
    priority: value.priority || 10,
    collections: Array.isArray(value.collection_cible) ? value.collection_cible : value.collection_cible ? [value.collection_cible] : [],
    events: value.trigger_event || ['update'],
    throttle_ms: value.throttle_ms || 0,
    throttle_scope: value.throttle_scope || 'rule',
    expand_fields: value.expand_fields || []
  });

  const [nodes, setNodes, onNodesChange] = useNodesState<BuilderNodeData>([
    {
      id: 'trigger-1',
      type: 'triggerNode',
      position: { x: 50, y: 80 },
      data: { label: 'Trigger', kind: 'trigger', config: { event: 'items.update' } }
    }
  ]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [previewOpened, { open: openPreview, close: closePreview }] = useDisclosure(false);
  const [counter, setCounter] = useState(2);
  const reactFlowWrapperRef = useRef<HTMLDivElement | null>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  // Sync meta
  useEffect(() => {
    onChange({
      ...value,
      ...meta,
      collection_cible: meta.collections.length === 1 ? meta.collections[0] : meta.collections,
      trigger_event: meta.events,
      rule: buildRuleFromNodes(),
      actions: buildActionsFromNodes()
    });
  }, [meta, nodes]);

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedNodeId), [nodes, selectedNodeId]);

  const addNode = (kind: BuilderNodeKind, actionType?: ActionType, pos?: { x: number, y: number }) => {
    const id = `${kind}-${counter}`;
    const newNode: BuilderNode = {
      id,
      type: kind === 'trigger' ? 'triggerNode' : kind === 'condition' ? 'conditionNode' : 'actionNode',
      position: pos || { x: 300 + counter * 50, y: 300 },
      data: {
        label: kind,
        kind,
        config: defaultConfig(kind, actionType)
      }
    };
    setNodes((nds) => [...nds, newNode]);
    setCounter((c) => c + 1);
  };

  const updateNodeConfig = (patch: any) => {
    setNodes((nds) => nds.map((n) => n.id === selectedNodeId ? { ...n, data: { ...n.data, config: { ...n.data.config, ...patch } } } : n));
  };

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge({ ...params, type: 'smoothstep', animated: true, style: { stroke: '#5c5c5c', strokeWidth: 2 } }, eds)), []);

  // --- Graph Serialization Logic ---

  const getSortedNodes = useCallback(() => {
    const trigger = nodes.find(n => n.data.kind === 'trigger');
    if (!trigger) return [];

    const sorted: BuilderNode[] = [];
    const visited = new Set<string>();
    const queue = [trigger];
    visited.add(trigger.id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      // We don't add the trigger to the result list for rules/actions, but we traverse from it
      if (current.data.kind !== 'trigger') {
        sorted.push(current);
      }

      // Find connected nodes (outgoing)
      const outgoers = edges
        .filter(e => e.source === current.id)
        .map(e => nodes.find(n => n.id === e.target))
        .filter((n): n is BuilderNode => !!n && !visited.has(n.id));

      // Sort outgoers by Y position to have a deterministic order for parallel branches (top to bottom)
      outgoers.sort((a, b) => a.position.y - b.position.y);

      for (const node of outgoers) {
        visited.add(node.id);
        queue.push(node);
      }
    }
    return sorted;
  }, [nodes, edges]);

  const buildRuleFromNodes = useCallback(() => {
    const sorted = getSortedNodes();
    const conditions = sorted.filter(n => n.data.kind === 'condition');

    if (conditions.length === 0) return value.rule || {};

    const expressions = conditions.map(node => {
      const { field, operator, value: v } = node.data.config;
      // Try to parse value if it looks like a number or boolean
      let val = v;
      if (typeof v === 'string' && !isNaN(Number(v))) val = Number(v);
      if (v === 'true') val = true;
      if (v === 'false') val = false;
      // Support { "var": "..." } raw input
      if (typeof v === 'string' && v.trim().startsWith('{') && v.includes('var')) {
        try { val = JSON.parse(v); } catch { }
      }

      switch (operator) {
        case 'equals': return { "==": [{ "var": field }, val] };
        case 'not_equals': return { "!=": [{ "var": field }, val] };
        case 'gt': return { ">": [{ "var": field }, val] };
        case 'gte': return { ">=": [{ "var": field }, val] };
        case 'lt': return { "<": [{ "var": field }, val] };
        case 'lte': return { "<=": [{ "var": field }, val] };
        case 'includes': return { "in": [val, { "var": field }] }; // Note: "in" expects [needle, haystack]
        case 'matches': return { "matches": [{ "var": field }, val] };
        case 'in': return { "in": [{ "var": field }, val] }; // field in list
        case 'not_in': return { "!": { "in": [{ "var": field }, val] } };
        default: return { "==": [{ "var": field }, val] };
      }
    });

    if (expressions.length === 1) return expressions[0];
    return { "and": expressions };
  }, [getSortedNodes, value.rule]);

  const buildActionsFromNodes = useCallback(() => {
    const sorted = getSortedNodes();
    const actionNodes = sorted.filter(n => n.data.kind === 'action');

    return actionNodes.map(node => {
      const { actionType, ...config } = node.data.config;

      // Base action structure
      const action: any = {
        type: actionType,
        ...config
      };

      // Clean up and parse JSON fields
      if (typeof action.data === 'string') {
        try { action.data = JSON.parse(action.data); } catch { }
      }
      if (typeof action.filter === 'string') {
        try { action.filter = JSON.parse(action.filter); } catch { }
      }
      if (typeof action.payload === 'string') {
        try { action.payload = JSON.parse(action.payload); } catch { }
      }
      if (typeof action.actions === 'string') {
        try { action.actions = JSON.parse(action.actions); } catch { }
      }
      if (typeof action.when === 'string' && action.when.trim() !== '') {
        try { action.when = JSON.parse(action.when); } catch { }
      } else if (!action.when) {
        delete action.when;
      }

      // Ensure numeric/boolean values are parsed if entered as strings in text inputs
      // (Optional refinement based on field types)

      return action;
    });
  }, [getSortedNodes]);

  // --- Drag & Drop ---
  const onDragStart = (event: any, kind: string, actionType?: string) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({ kind, actionType }));
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = (event: any) => {
    event.preventDefault();
    const data = JSON.parse(event.dataTransfer.getData('application/reactflow'));
    if (!data || !reactFlowInstance) return;
    const bounds = reactFlowWrapperRef.current.getBoundingClientRect();
    const position = reactFlowInstance.project({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
    addNode(data.kind, data.actionType, position);
  };

  return (
    <Box style={{ height, background: THEME_COLORS.bg, color: THEME_COLORS.text, fontFamily: 'Inter, sans-serif', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(${THEME_COLORS.grid} 1px, transparent 1px)`, backgroundSize: '20px 20px', opacity: 0.5, pointerEvents: 'none' }} />

      {/* Canvas Layer - Full Screen */}
      <Box style={{ position: 'absolute', inset: 0, zIndex: 0 }} ref={reactFlowWrapperRef}>
        <ReactFlow
          nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes}
          fitView onNodeClick={(_, n) => setSelectedNodeId(n.id)} onPaneClick={() => setSelectedNodeId(null)} onInit={setReactFlowInstance}
          onDrop={onDrop} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} size={1} color="rgba(255,255,255,0.1)" />
          <Controls style={{ background: THEME_COLORS.panelBg, border: `1px solid ${THEME_COLORS.panelBorder}`, fill: 'white' }} />
          <MiniMap style={{ background: THEME_COLORS.panelBg, border: `1px solid ${THEME_COLORS.panelBorder}` }} maskColor="rgba(0,0,0,0.6)" />
        </ReactFlow>
      </Box>

      {/* Floating Palette - Left */}
      <Box
        w={280}
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          bottom: 20,
          background: THEME_COLORS.panelBg,
          border: `1px solid ${THEME_COLORS.panelBorder}`,
          borderRadius: 16,
          backdropFilter: 'blur(16px)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
        }}
      >
        <Box p="md" style={{ borderBottom: `1px solid ${THEME_COLORS.panelBorder}` }}>
          <Group justify="space-between">
            <div>
              <Title order={5} c="white">Automation</Title>
              <Text size="xs" c="dimmed">Builder v2.0</Text>
            </div>
            <Badge variant="outline" color="gray" size="xs">BETA</Badge>
          </Group>
        </Box>
        <ScrollArea style={{ flex: 1 }}>
          <Stack p="md" gap="sm">
            <Text size="xs" fw={700} c="dimmed" tt="uppercase">Tools</Text>
            {paletteItems.map((item, i) => (
              <Card key={i} padding="xs" radius="md" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', cursor: 'grab', transition: 'all 0.2s' }} draggable onDragStart={(e) => onDragStart(e, item.kind, item.actionType)} onClick={() => addNode(item.kind, item.actionType)}>
                <Group gap="xs">
                  <ThemeIcon color={item.color} variant="light" size="md"><item.icon size={16} /></ThemeIcon>
                  <Box>
                    <Text size="sm" fw={500} c="white">{item.title}</Text>
                    <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>{item.subtitle}</Text>
                  </Box>
                </Group>
              </Card>
            ))}
          </Stack>
        </ScrollArea>
        <Box p="md" style={{ borderTop: `1px solid ${THEME_COLORS.panelBorder}` }}>
          <Stack gap="xs">
            <Button fullWidth variant="light" leftSection={<IconSettings size={16} />} onClick={() => setSelectedNodeId('global')}>Global Settings</Button>
            <Button fullWidth variant="outline" color="gray" leftSection={<IconCode size={16} />} onClick={openPreview}>Preview JSON</Button>
          </Stack>
        </Box>
      </Box>

      {/* Floating Inspector - Right */}
      {(selectedNode || selectedNodeId === 'global') && (
        <Box
          w={340}
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            bottom: 20,
            background: THEME_COLORS.panelBg,
            border: `1px solid ${THEME_COLORS.panelBorder}`,
            borderRadius: 16,
            backdropFilter: 'blur(16px)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
          }}
        >
          <Box p="md" style={{ borderBottom: `1px solid ${THEME_COLORS.panelBorder}` }}>
            <Group justify="space-between">
              <Title order={5} c="white">{selectedNodeId === 'global' ? 'Global Settings' : 'Inspector'}</Title>
              <ActionIcon color="gray" variant="subtle" onClick={() => setSelectedNodeId(null)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>
              </ActionIcon>
            </Group>
          </Box>
          <ScrollArea style={{ flex: 1 }}>
            <Stack p="md" gap="md">
              {selectedNodeId === 'global' ? (
                <>
                  <TextInput label="Name" value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.currentTarget.value })} styles={darkInputStyles} />
                  <Select label="Status" data={['active', 'inactive']} value={meta.status} onChange={(v) => setMeta({ ...meta, status: v as any })} styles={darkInputStyles} />
                  <TagsInput label="Target Collections" value={meta.collections} onChange={(v) => setMeta({ ...meta, collections: v })} styles={darkInputStyles} />
                  <MultiSelect label="Trigger Events" data={['create', 'update', 'delete']} value={meta.events} onChange={(v) => setMeta({ ...meta, events: v })} styles={darkInputStyles} />
                  <NumberInput label="Priority" value={meta.priority} onChange={(v) => setMeta({ ...meta, priority: Number(v) })} styles={darkInputStyles} />
                  <Divider label="Performance" labelPosition="center" color="dark.4" />
                  <NumberInput label="Throttle (ms)" value={meta.throttle_ms} onChange={(v) => setMeta({ ...meta, throttle_ms: Number(v) })} styles={darkInputStyles} />
                  <Select label="Throttle Scope" data={['rule', 'collection', 'item', 'user']} value={meta.throttle_scope} onChange={(v) => setMeta({ ...meta, throttle_scope: v as any })} styles={darkInputStyles} />
                  <TagsInput label="Expand Fields" description="Pre-load relations (e.g. project.name)" value={meta.expand_fields} onChange={(v) => setMeta({ ...meta, expand_fields: v })} styles={darkInputStyles} />
                </>
              ) : selectedNode && (
                <>
                  <Group justify="space-between">
                    <Badge variant="dot" color={nodeColors[selectedNode.data.kind]}>{selectedNode.data.kind.toUpperCase()}</Badge>
                    <ActionIcon color="red" variant="light" size="sm" onClick={() => { setNodes(ns => ns.filter(n => n.id !== selectedNodeId)); setSelectedNodeId(null); }}><IconTrash size={14} /></ActionIcon>
                  </Group>

                  {/* Common: Conditional Execution */}
                  {selectedNode.data.kind === 'action' && (
                    <TextInput label="Run Condition (When)" placeholder='{ "var": "..." }' value={selectedNode.data.config.when} onChange={(e) => updateNodeConfig({ when: e.currentTarget.value })} styles={darkInputStyles} />
                  )}

                  {/* Specific Forms */}
                  {selectedNode.data.kind === 'trigger' && (
                    <Select label="Event" data={['items.create', 'items.update', 'items.delete']} value={selectedNode.data.config.event} onChange={(v) => updateNodeConfig({ event: v })} styles={darkInputStyles} />
                  )}

                  {selectedNode.data.kind === 'condition' && (
                    <>
                      <TextInput label="Field" value={selectedNode.data.config.field} onChange={(e) => updateNodeConfig({ field: e.currentTarget.value })} styles={darkInputStyles} />
                      <Select label="Operator" data={['equals', 'not_equals', 'gt', 'gte', 'lt', 'lte', 'includes', 'matches', 'in', 'not_in']} value={selectedNode.data.config.operator} onChange={(v) => updateNodeConfig({ operator: v })} styles={darkInputStyles} />
                      <TextInput label="Value" value={selectedNode.data.config.value} onChange={(e) => updateNodeConfig({ value: e.currentTarget.value })} styles={darkInputStyles} />
                    </>
                  )}

                  {selectedNode.data.kind === 'action' && (
                    <>
                      {/* Action Type Specifics */}
                      {['create_item', 'update_item', 'update_many'].includes(selectedNode.data.config.actionType) && (
                        <TextInput label="Collection" value={selectedNode.data.config.collection} onChange={(e) => updateNodeConfig({ collection: e.currentTarget.value })} styles={darkInputStyles} />
                      )}

                      {['update_item'].includes(selectedNode.data.config.actionType) && (
                        <TextInput label="ID (Value or {var})" value={selectedNode.data.config.id} onChange={(e) => updateNodeConfig({ id: e.currentTarget.value })} styles={darkInputStyles} />
                      )}

                      {selectedNode.data.config.actionType === 'set_field' && (
                        <>
                          <TextInput label="Field" value={selectedNode.data.config.field} onChange={(e) => updateNodeConfig({ field: e.currentTarget.value })} styles={darkInputStyles} />
                          <TextInput label="Value" value={selectedNode.data.config.value} onChange={(e) => updateNodeConfig({ value: e.currentTarget.value })} styles={darkInputStyles} />
                        </>
                      )}

                      {selectedNode.data.config.actionType === 'update_many' && (
                        <JsonInput label="Filter (JSON)" formatOnBlur autosize minRows={2} value={selectedNode.data.config.filter} onChange={(v) => updateNodeConfig({ filter: v })} styles={darkInputStyles} />
                      )}

                      {['create_item', 'update_item', 'update_many'].includes(selectedNode.data.config.actionType) && (
                        <JsonInput label="Data Payload (JSON)" formatOnBlur autosize minRows={4} value={selectedNode.data.config.data} onChange={(v) => updateNodeConfig({ data: v })} styles={darkInputStyles} />
                      )}

                      {selectedNode.data.config.actionType === 'for_each' && (
                        <>
                          <TextInput label="List (Variable)" value={selectedNode.data.config.list} onChange={(e) => updateNodeConfig({ list: e.currentTarget.value })} styles={darkInputStyles} />
                          <JsonInput label="Nested Actions (JSON)" formatOnBlur autosize minRows={6} value={selectedNode.data.config.actions} onChange={(v) => updateNodeConfig({ actions: v })} styles={darkInputStyles} />
                        </>
                      )}

                      {selectedNode.data.config.actionType === 'trigger_flow' && (
                        <>
                          <TextInput label="Flow Key" value={selectedNode.data.config.key} onChange={(e) => updateNodeConfig({ key: e.currentTarget.value })} styles={darkInputStyles} />
                          <JsonInput label="Payload (JSON)" formatOnBlur autosize minRows={4} value={selectedNode.data.config.payload} onChange={(v) => updateNodeConfig({ payload: v })} styles={darkInputStyles} />
                        </>
                      )}

                      {selectedNode.data.config.actionType === 'send_email' && (
                        <>
                          <TextInput label="To" value={selectedNode.data.config.to} onChange={(e) => updateNodeConfig({ to: e.currentTarget.value })} styles={darkInputStyles} />
                          <TextInput label="Subject" value={selectedNode.data.config.subject} onChange={(e) => updateNodeConfig({ subject: e.currentTarget.value })} styles={darkInputStyles} />
                          <Textarea label="Body" value={selectedNode.data.config.body} onChange={(e) => updateNodeConfig({ body: e.currentTarget.value })} styles={darkInputStyles} />
                        </>
                      )}

                      {['create_item', 'update_item', 'update_many'].includes(selectedNode.data.config.actionType) && (
                        <TextInput label="Assign Result To ($var)" value={selectedNode.data.config.assign} onChange={(e) => updateNodeConfig({ assign: e.currentTarget.value })} styles={darkInputStyles} />
                      )}
                    </>
                  )}
                </>
              )}
            </Stack>
          </ScrollArea>
        </Box>
      )}

      <Modal opened={previewOpened} onClose={closePreview} title="Automation JSON Preview" size="xl" centered styles={{ content: { background: THEME_COLORS.panelBg, border: `1px solid ${THEME_COLORS.panelBorder}`, backdropFilter: 'blur(12px)' }, header: { background: 'transparent', color: 'white' }, body: { color: 'white' } }}>
        <Code block style={{ background: 'rgba(0,0,0,0.3)', color: '#a5d6ff' }}>
          {JSON.stringify(value, null, 2)}
        </Code>
      </Modal>
    </Box>
  );
}

const nodeColors: Record<BuilderNodeKind, string> = {
  trigger: THEME_COLORS.trigger,
  condition: THEME_COLORS.condition,
  action: THEME_COLORS.action
};
