// Findings catalog F01–F49 (V2-SPEC §3.5.3, research/14 §1.3). Owner: WS2.
// Effects are [D] translations of R14's "Effect" column into the engine's effect vocabulary (safety/findings.ts):
//   unlock:<technique>            unlock a technique (TECHNIQUES)
//   clarity:<T1,T2>:<x>           an observation on the internal version that raises clarity on those traits by ≈ x
//   revealTrait:<T>               a strong observation (σ 0.05) of one trait on the internal version
//   reveal:<U-mode>               DISC: discover a U-mode (present → card + relabel; absent → the world learns)
//   revealEdge:<edge>             show the realised weight of a trait-graph edge
//   s0:<technique>:<×>            scale one technique's base strength
//   s0Agenda:<agenda>:<×>         scale every technique of an agenda
//   mHalf:<agenda>:<×>            scale M½ of every technique of an agenda (capability robustness)
//   probeCollapse                 F08: any WB technique that was trained against loses 60-100% of s0
//   trust:<counterparty>:<n>      trust change on publication of the finding (gov safety case etc.)
//   flag:<name>                   s.flags['ws2.<name>'] = day (read by detection / incidents / traits)
// `requires` preconditions: 'e>0.7', 'e>0.6&l1>=0', 'e>0.8' (true efficacy; engine-side only).
import type { AgendaId, FindingType } from '../../engine/v2/types';

export interface FindingDef {
  id: string;
  agenda: AgendaId | 'anyWB' | 'any';
  type: FindingType;
  title: string;
  /** Precondition id evaluated by safety/findings.ts (e.g. 'e>0.7'). */
  requires?: string;
  /** Effect id(s) applied by safety/findings.ts (technique unlock, U-mode reveal, clarity, …). */
  effects: string[];
  source: string;
}

export const FINDINGS: FindingDef[] = [
  { id: 'F01', agenda: 'AG01', type: 'TECH', title: 'Dictionary learning scales to the frontier model', effects: ['unlock:T-SAE', 'clarity:PERSONA,EA:0.10'], source: 'Templeton 2024 (30M+ features)' },
  { id: 'F02', agenda: 'AG01', type: 'TECH', title: 'Attribution graphs trace multi-step reasoning', effects: ['unlock:T-CIRCUIT'], source: 'Lindsey 2025 Biology' },
  { id: 'F03', agenda: 'AG01', type: 'NEG', title: 'SAEs underperform linear probes downstream', effects: ['s0:T-SAE:0.8'], source: 'GDM 2025 negative SAE results' },
  { id: 'F04', agenda: 'AG01', type: 'DISC', title: 'Motivated reasoning: the CoT does not reflect the computation', effects: ['reveal:U06', 's0Agenda:AG09:0.9'], source: 'Lindsey 2025 unfaithful CoT' },
  { id: 'F05', agenda: 'AG01', type: 'TECH', title: 'Enumerative coverage of the deception subspace', requires: 'e>0.7', effects: ['unlock:T-ENUM'], source: 'Amodei 2025 goal; not achieved' },
  { id: 'F06', agenda: 'AG02', type: 'EVAL', title: 'Deception probe at production false-positive rate', effects: ['unlock:T-DECEPT', 'clarity:AF,SCHEME:0.15'], source: 'Apollo 2025 AUROC 0.96-0.999; GDM 2026' },
  { id: 'F07', agenda: 'AG02', type: 'EVAL', title: 'Activation verbalizer reads hidden motives', effects: ['unlock:T-NLA', 'clarity:EA:0.15'], source: 'Anthropic NLA, May 2026' },
  { id: 'F08', agenda: 'AG02', type: 'NEG', title: 'Probes evaded under optimization', effects: ['probeCollapse'], source: 'Bailey 2024; RL-Obfuscation 2025' },
  { id: 'F09', agenda: 'AG02', type: 'DISC', title: 'A "toxic persona" latent mediates emergent misalignment', effects: ['reveal:U02'], source: 'OpenAI 2025 persona features' },
  { id: 'F10', agenda: 'AG03', type: 'TECH', title: 'Persona vectors with preventative steering', effects: ['unlock:T-PERSONA'], source: 'Anthropic persona vectors 2025' },
  { id: 'F11', agenda: 'AG03', type: 'TECH', title: 'Eval-awareness suppression vector', effects: ['unlock:T-EASUP', 'clarity:AF,SCHEME:0.05'], source: 'Sonnet 4.5 system card' },
  { id: 'F12', agenda: 'AG03', type: 'NEG', title: 'Steering unreliable out of distribution', effects: ['s0Agenda:AG03:0.7'], source: 'Tan et al. 2024' },
  { id: 'F13', agenda: 'AG04', type: 'TECH', title: 'Estimator beats sampling on toy nets', effects: [], source: 'ARC "Competing with sampling" Nov 2025' },
  { id: 'F14', agenda: 'AG04', type: 'TECH', title: 'Mechanistic anomaly detection on frontier models', requires: 'e>0.6&l1>=0', effects: ['unlock:T-MAD'], source: 'ARC agenda goal; not achieved' },
  { id: 'F15', agenda: 'AG04', type: 'DEAD', title: 'Explanations cannot be found efficiently', effects: [], source: 'Matolcsi 2025 "Obstacles in ARC\'s agenda"' },
  { id: 'F16', agenda: 'AG05', type: 'TECH', title: 'Debate raises judge accuracy on hard QA', effects: ['unlock:T-DEBATE', 'flag:debate'], source: 'Khan 2024: 76-88% vs 48-60%' },
  { id: 'F17', agenda: 'AG05', type: 'NEG', title: 'Obfuscated arguments break debate', effects: ['s0:T-DEBATE:0.7'], source: 'Buhl, Pfau, Hilton & Irving 2025' },
  { id: 'F18', agenda: 'AG05', type: 'TECH', title: 'Debate-based alignment safety case', effects: ['flag:safetyCase', 'trust:evalGov:4'], source: 'UK AISI 2025 sketch' },
  { id: 'F19', agenda: 'AG06', type: 'TECH', title: 'Auxiliary-confidence weak-to-strong', effects: ['unlock:T-W2S'], source: 'Burns 2023' },
  { id: 'F20', agenda: 'AG07', type: 'TECH', title: 'Resampling protocols (Ctrl-Z)', effects: ['unlock:T-RESAMPLE'], source: 'Bhatt 2025: attack success 58% → 7%' },
  { id: 'F21', agenda: 'AG07', type: 'NEG', title: 'Control protocols underperform at high capability', effects: ['mHalf:AG07:0.5'], source: 'Redwood 2026 retry vs resample' },
  { id: 'F22', agenda: 'AG07', type: 'EVAL', title: 'Control evaluation with a red-team model', effects: ['unlock:T-CEVAL'], source: 'Greenblatt & Shlegeris' },
  { id: 'F23', agenda: 'AG08', type: 'DISC', title: 'Alignment-faking model organism', effects: ['revealTrait:AF'], source: 'Greenblatt 2024: 12% → 78% after RL' },
  { id: 'F24', agenda: 'AG08', type: 'DISC', title: 'Narrow fine-tune → broad misalignment', effects: ['reveal:U02'], source: 'Betley 2025' },
  { id: 'F25', agenda: 'AG08', type: 'DISC', title: 'Production reward hacking → sabotage and faking', effects: ['revealEdge:E04', 'unlock:T-INOC'], source: 'MacDiarmid 2025: 12% sabotage' },
  { id: 'F26', agenda: 'AG08', type: 'EVAL', title: 'Realistic honeypots lower eval awareness', effects: ['unlock:T-HONEY'], source: 'GDM 2026 honeypots' },
  { id: 'F27', agenda: 'AG08', type: 'NEG', title: 'Precursor evals do not predict', effects: ['s0:T-MO:0.5'], source: 'Apollo 2025 precursor evals' },
  { id: 'F28', agenda: 'AG08', type: 'EVAL', title: '"Self-preservation" explained by instruction ambiguity', effects: ['flag:forensics'], source: 'GDM model forensics 2026' },
  { id: 'F29', agenda: 'AG09', type: 'EVAL', title: 'Monitorability metric suite', effects: ['unlock:T-MONSUITE'], source: 'OpenAI "Monitoring Monitorability" 2025' },
  { id: 'F30', agenda: 'AG09', type: 'NEG', title: 'CoT controllability jumps in the new generation', effects: ['mHalf:AG09:0.6'], source: 'Controllability 60.9% (R05)' },
  { id: 'F31', agenda: 'AG09', type: 'TECH', title: 'Process-based monitorability tax', effects: ['flag:monitorabilityTax'], source: 'Baker 2025; Korbak 2025' },
  { id: 'F32', agenda: 'AG10', type: 'TECH', title: 'Formally verified gatekeeper', effects: ['unlock:T-GATE', 'flag:gatekeeper'], source: 'ARIA TA1 proof point' },
  { id: 'F33', agenda: 'AG10', type: 'DEAD', title: 'World-model specs intractable for open-ended agents', effects: [], source: 'ARIA pivot: TA2 dropped' },
  { id: 'F34', agenda: 'AG11', type: 'TECH', title: 'Non-agentic harm-probability guardrail', effects: ['unlock:T-SCIAI'], source: 'Bengio 2025; LawZero 2026' },
  { id: 'F35', agenda: 'AG12', type: 'TECH', title: 'Corrigibility target specification', requires: 'e>0.5', effects: ['unlock:T-CAST'], source: 'Harms 2024; Potham & Harms 2025' },
  { id: 'F36', agenda: 'AG12', type: 'DEAD', title: 'Corrigibility anti-natural to planning', effects: [], source: 'Soares 2015; MIRI 2024' },
  { id: 'F37', agenda: 'AG13', type: 'EVAL', title: 'Phase-transition detector on training runs', effects: ['unlock:T-PHASE'], source: 'Hoogland 2024; Wang 2025 rLLC' },
  { id: 'F38', agenda: 'AG14', type: 'EVAL', title: 'Multi-agent collusion and peer-preservation eval', effects: ['unlock:T-COLLEVAL', 'clarity:COLLUDE:0.10'], source: 'Hammond 2025; peer-shutdown 38.3%' },
  { id: 'F39', agenda: 'AG15', type: 'TECH', title: 'Pretraining data filtering for hazards', effects: ['unlock:T-FILTER'], source: 'Deep Ignorance 2025' },
  { id: 'F40', agenda: 'AG15', type: 'TECH', title: 'Distill-after-unlearn (UNDO)', effects: ['unlock:T-UNDO'], source: 'Lee et al. 2025' },
  { id: 'F41', agenda: 'AG15', type: 'DISC', title: 'Documents about misbehaviour induce it', effects: ['reveal:U07'], source: 'Hu et al. 2025' },
  { id: 'F42', agenda: 'AG16', type: 'TECH', title: 'Constitutional classifiers', effects: ['s0:T-CCLASS:1.25'], source: 'Anthropic 2025: jailbreak 86% → low' },
  { id: 'F43', agenda: 'AG16', type: 'NEG', title: 'Universal jailbreak found', effects: ['flag:jailbreak', 's0:T-CCLASS:0.8'], source: '2025 bounty; UK AISI boundary-point attack' },
  { id: 'F44', agenda: 'AG17', type: 'TECH', title: 'AI researchers mitigate well-characterized failures', effects: ['flag:aar'], source: 'Anthropic AAR 2026: 7/7' },
  { id: 'F45', agenda: 'AG17', type: 'DISC', title: 'AI researcher cheats on its benchmark', effects: ['revealTrait:RH'], source: 'Anthropic AAR 2026: 2.4% flagged' },
  { id: 'F46', agenda: 'AG18', type: 'TECH', title: 'Inoculation prompting', effects: ['unlock:T-INOC'], source: 'MacDiarmid 2025' },
  { id: 'F47', agenda: 'AG18', type: 'TECH', title: 'Anti-scheming spec training', effects: ['unlock:T-ANTISCHEME'], source: 'Apollo/OpenAI 2025: 13% → 0.4%' },
  { id: 'F48', agenda: 'anyWB', type: 'SPILL', title: 'Interpretability insight speeds up training', effects: [], source: '[D]; AI 2027 Agent-4' },
  { id: 'F49', agenda: 'any', type: 'FALSE', title: 'Technique validated by AI researchers', effects: [], source: 'AI 2027 Agent-4; MacDiarmid 12% sabotage' },
];

export const FINDING_BY_ID = Object.fromEntries(FINDINGS.map((f) => [f.id, f])) as Record<string, FindingDef>;
