// Relations panel action catalogue metadata (V2-SPEC §3.9.2, research/17 §1.4). Owner: WS4. B7 Brief officials sits in
// the panel's US-government section.
// Behaviour (ActionDef with preview/apply) lives with each action's owner (world/usgov.ts B7, safety/actions.ts
// A1 A3 A6, departments/poach.ts C4, models/openWeights.ts C6, worldfx/actions.ts F3); this is the panel's list.
export interface ActionMeta { id: string; title: string; group: 'A' | 'C' | 'F' }

export const RELATION_ACTION_META: ActionMeta[] = [
  { id: 'A1', title: 'Pre-deploy testing', group: 'A' },
  { id: 'A3', title: 'Publish framework', group: 'A' },
  { id: 'A6', title: 'Whistleblower channel', group: 'A' },
  { id: 'C4', title: 'Poach', group: 'C' },
  { id: 'C6', title: 'Open weights', group: 'C' },
  // Data actions (model v3 D2, production/dataActions.ts) live on Models › Data since D4 (one home per control).
  { id: 'F3', title: 'No drop-in agents', group: 'F' },
  // Security levers (security/actions.ts) live on Lab › Security; Retire (endings/retire.ts) stands apart below.
];
