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
  centralize: number; theft: number; taiwan: number; treaty: number; openSource: number; hawk: number;
}
// Weights from research/10-china.md (China deep dive, incl. Chinese-language sources), which supersedes 07.
// efficiency: 1 for every preset (CAL-W: AI 2027 gives DeepCent no research efficiency separable from compute; the
// Fast Follower 1.1 / Diffuser 1.05 flavours were [D] with no source; designer CP3k: equal recipe efficiency).
export const CHINA_PRESETS: ChinaPreset[] = [
  { id: 'fastfollower', name: 'Fast Follower', weight: 35, desc: 'Distill and diffuse. Stays months behind at a fraction of the cost. Theft is opportunistic.', centralize: 0.5, theft: 0.7, taiwan: 0.8, treaty: 1, openSource: 1.3, hawk: 40 },
  { id: 'diffuser', name: 'Open-Source Diffuser', weight: 20, desc: 'Open weights as geopolitics. Wins the Global South, pushes norms at the UN.', centralize: 0.6, theft: 0.8, taiwan: 0.7, treaty: 1.2, openSource: 1.8, hawk: 35 },
  { id: 'selfreliant', name: 'Self-Reliance Fortress', weight: 20, desc: 'Refuses US chips, builds Huawei/SMIC. Patient; avoids military risk until chip parity.', centralize: 1, theft: 0.9, taiwan: 0.6, treaty: 1, openSource: 1, hawk: 45 },
  { id: 'nationalizer', name: 'Centralized Sprint', weight: 10, desc: "AI 2027's China. National collective, CDZ at Tianwan, theft as policy, Taiwan as lever.", centralize: 1.6, theft: 1.6, taiwan: 1.3, treaty: 0.7, openSource: 0.3, hawk: 65 },
  { id: 'gambler', name: 'Hawkish Gambler', weight: 5, desc: 'Centralized Sprint that sees a closing window. Willing to blockade Taiwan.', centralize: 1.6, theft: 1.6, taiwan: 2, treaty: 0.4, openSource: 0.3, hawk: 80 },
  { id: 'bargainer', name: 'Cautious Stabilizer', weight: 10, desc: 'Leadership has absorbed loss-of-control risk. Seeks restraint and verification on parity terms.', centralize: 1, theft: 0.8, taiwan: 0.6, treaty: 1.8, openSource: 0.9, hawk: 30 },
];

