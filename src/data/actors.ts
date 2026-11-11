// Actor personality presets. Source: research/07-actors.md (weights = "Realistic" draw probabilities).

export interface GovPreset {
  id: string; name: string; desc: string; weight: number;
  accel: number; security: number; reg: number; transactional: number; hawk: number; natThreshold: number; lag: number; pollSensitivity: number;
}
export const GOV_PRESETS: GovPreset[] = [
  { id: 'dealmaker', name: 'Dealmaker', weight: 45, desc: 'Accelerationist, transactional. Trades policy for deals; resists safety rules.', accel: 1.5, security: 0.8, reg: 0.4, transactional: 1.6, hawk: 0.8, natThreshold: 85, lag: 20, pollSensitivity: 1 },
  { id: 'hawk', name: 'Security Hawk', weight: 25, desc: 'AI is a weapon. Fast clearances, export controls, DPA planning. AI 2027\'s default government.', accel: 1.1, security: 1.6, reg: 0.7, transactional: 1, hawk: 1.6, natThreshold: 60, lag: 10, pollSensitivity: 1 },
  { id: 'populist', name: 'Populist', weight: 13, desc: 'Follows the polls. Turns on Big Tech when approval falls.', accel: 1, security: 1, reg: 1.2, transactional: 1.2, hawk: 1.1, natThreshold: 70, lag: 15, pollSensitivity: 2 },
  { id: 'regulator', name: 'Cautious Regulator', weight: 12, desc: 'Safety testing, licensing, arms-control channels with China.', accel: 0.8, security: 1.2, reg: 1.6, transactional: 0.6, hawk: 0.9, natThreshold: 70, lag: 25, pollSensitivity: 1.2 },
  { id: 'absentee', name: 'Absentee', weight: 5, desc: 'Distracted by other crises. Reacts late, then overreacts.', accel: 0.6, security: 0.6, reg: 0.6, transactional: 1, hawk: 0.6, natThreshold: 90, lag: 45, pollSensitivity: 0.6 },
];

export interface PublicPreset {
  id: string; name: string; desc: string; weight: number;
  shock: number; halfLife: number; jobs: number; xrisk: number; benefit: number; mobilization: number;
}
export const PUBLIC_PRESETS: PublicPreset[] = [
  { id: 'anxious', name: 'Anxious Majority', weight: 50, desc: 'Uses AI daily, distrusts it. Concern ratchets up with each incident.', shock: 1, halfLife: 120, jobs: 1.2, xrisk: 1, benefit: 0.7, mobilization: 0.8 },
  { id: 'backlash', name: 'Populist Backlash', weight: 22, desc: 'Anger at billionaires, datacenters and lost jobs. Fast mobilization.', shock: 1.1, halfLife: 150, jobs: 1.6, xrisk: 0.9, benefit: 0.6, mobilization: 1.5 },
  { id: 'optimist', name: 'Tech Optimist', weight: 10, desc: 'Benefits dominate. Concern decays fast.', shock: 0.7, halfLife: 45, jobs: 0.8, xrisk: 0.7, benefit: 1.6, mobilization: 0.5 },
  { id: 'doomer', name: 'Doomer Wave', weight: 10, desc: 'X-risk framing dominates. Misalignment news hits hard.', shock: 1.3, halfLife: 140, jobs: 1, xrisk: 1.8, benefit: 0.7, mobilization: 1.2 },
  { id: 'distracted', name: 'Distracted', weight: 8, desc: 'Other crises crowd AI out. Moves only on huge events.', shock: 0.6, halfLife: 60, jobs: 0.8, xrisk: 0.7, benefit: 0.8, mobilization: 0.4 },
];

export interface ChinaPreset {
  id: string; name: string; desc: string; weight: number;
  centralize: number; theft: number; taiwan: number; treaty: number; openSource: number; efficiency: number; hawk: number;
}
export const CHINA_PRESETS: ChinaPreset[] = [
  { id: 'fastfollower', name: 'Open-Source Fast Follower', weight: 35, desc: 'Many labs, open weights, efficiency over scale. Opportunistic theft.', centralize: 0.6, theft: 0.8, taiwan: 0.8, treaty: 1, openSource: 1.5, efficiency: 1.2, hawk: 40 },
  { id: 'nationalizer', name: 'Hawkish Nationalizer', weight: 30, desc: 'AI 2027\'s China. Full CDZ, theft as policy, Taiwan as lever.', centralize: 1.5, theft: 1.5, taiwan: 1.3, treaty: 0.7, openSource: 0.6, efficiency: 1, hawk: 65 },
  { id: 'selfreliant', name: 'Self-Reliance Builder', weight: 15, desc: 'Rejects US chips, builds Huawei/SMIC. Patient, avoids military risk.', centralize: 1, theft: 0.9, taiwan: 0.6, treaty: 1, openSource: 1, efficiency: 1, hawk: 45 },
  { id: 'bargainer', name: 'Cautious Bargainer', weight: 15, desc: 'Leadership takes AI risk seriously. Seeks arms control; still steals if refused.', centralize: 1, theft: 1, taiwan: 0.7, treaty: 1.8, openSource: 0.9, efficiency: 1, hawk: 30 },
  { id: 'gambler', name: 'Taiwan Gambler', weight: 5, desc: 'Sees a closing window. Willing to blockade Taiwan.', centralize: 1.3, theft: 1.3, taiwan: 2, treaty: 0.4, openSource: 0.8, efficiency: 1, hawk: 80 },
];

export interface LabArchetype {
  id: string; name: string; desc: string; weight: number;
  safety: number; openness: number; lobby: number; computeMult: number; gapYears: [number, number];
}
export const LAB_ARCHETYPES: LabArchetype[] = [
  { id: 'safety', name: 'Safety Rival', weight: 25, desc: 'Frontier lab that lobbies for regulation and publishes evals.', safety: 80, openness: 15, lobby: 60, computeMult: 0.8, gapYears: [0.15, 0.45] },
  { id: 'bigtech', name: 'Big Tech Incumbent', weight: 30, desc: 'Deep pockets, own chips. Steady fast follower.', safety: 50, openness: 30, lobby: -20, computeMult: 1.3, gapYears: [0.1, 0.4] },
  { id: 'maverick', name: 'Maverick Accelerationist', weight: 20, desc: 'Founder-driven, fastest build-out, weakest safety.', safety: 20, openness: 50, lobby: -70, computeMult: 1, gapYears: [0.2, 0.5] },
  { id: 'openweights', name: 'Open-Weights Spoiler', weight: 15, desc: 'Releases near-frontier weights to commoditize rivals.', safety: 30, openness: 85, lobby: -40, computeMult: 0.7, gapYears: [0.35, 0.7] },
  { id: 'upstart', name: 'Boutique Upstart', weight: 10, desc: 'Elite small team of ex-OpenBrain staff. Poaches talent.', safety: 55, openness: 20, lobby: 0, computeMult: 0.3, gapYears: [0.5, 1.1] },
];

export const RIVAL_NAMES = ['Anthropos', 'Gemini Labs', 'xLab', 'Meridian', 'Helix AI'];
