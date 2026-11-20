// Relations action catalog metadata (V2-SPEC §3.9.2, research/17 §1.4). Owner: WS4.
// Behaviour (ActionDef with preview/apply) lives in src/engine/v2/actors/actions.ts; this is the data table.
export interface ActionMeta { id: string; title: string; group: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'S' | 'X' }

export const RELATION_ACTION_META: ActionMeta[] = [
  { id: 'A1', title: 'Pre-deploy testing', group: 'A' },
  { id: 'A2', title: 'Evaluator access', group: 'A' },
  { id: 'A3', title: 'Publish framework', group: 'A' },
  { id: 'A4', title: 'Publish research', group: 'A' },
  { id: 'A5', title: 'Bug bounty', group: 'A' },
  { id: 'A6', title: 'Whistleblower channel', group: 'A' },
  { id: 'B1', title: 'Loss-leader contract', group: 'B' },
  { id: 'B2', title: 'Defense contract', group: 'B' },
  { id: 'B3', title: 'Hire officials', group: 'B' },
  { id: 'B4', title: 'Lobby', group: 'B' },
  { id: 'B5', title: 'Voluntary accord', group: 'B' },
  { id: 'B6', title: 'Sue', group: 'B' },
  { id: 'B7', title: 'Brief officials', group: 'B' },
  { id: 'C1', title: 'Share threat intel', group: 'C' },
  { id: 'C2', title: 'Restrict adversaries', group: 'C' },
  { id: 'C3', title: 'Joint evals', group: 'C' },
  { id: 'C4', title: 'Poach', group: 'C' },
  { id: 'C6', title: 'Open weights', group: 'C' },
  { id: 'D1', title: 'Academic grant', group: 'D' },
  { id: 'D2', title: 'Safety fellowship', group: 'D' },
  // Data actions (model v3 D2, production/dataActions.ts; the old D3 "License data" is data.license 'web').
  { id: 'data.license', title: 'License data', group: 'D' },
  { id: 'data.expert', title: 'Buy expert data', group: 'D' },
  { id: 'data.synthesize', title: 'Generate data', group: 'D' },
  { id: 'data.usagePolicy', title: 'Usage-data policy', group: 'D' },
  { id: 'E1', title: 'Track-2 dialogue', group: 'E' },
  { id: 'E2', title: 'Gov-gov agreement', group: 'E' },
  { id: 'E3', title: 'Lobby export controls', group: 'E' },
  { id: 'F1', title: 'Community benefits', group: 'F' },
  { id: 'F3', title: 'No drop-in agents', group: 'F' },
  // Security sphere (§3.6) and Retire (§5.1 #10).
  { id: 'SEC_TARGET', title: 'Security target', group: 'S' },
  { id: 'SEC_SILO', title: 'Siloing', group: 'S' },
  { id: 'SEC_CI', title: 'Counter-intel', group: 'S' },
  { id: 'RETIRE', title: 'Retire', group: 'X' },
];
