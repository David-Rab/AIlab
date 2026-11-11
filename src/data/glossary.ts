// Glossary for nested tooltips. Bodies may link other terms with [[id]] or [[id|label]].
export interface Term {
  title: string;
  body: string;
  src?: string;
}

export const GLOSSARY: Record<string, Term> = {
  h100e: { title: 'H100e', body: 'H100-equivalent GPUs: a unit of AI compute. One H100 ≈ 10^15 FLOP/s. Global stock ~10M in early 2025, ~100M by end 2027.', src: 'AI 2027 Compute Forecast' },
  rdmult: { title: 'AI R&D multiplier', body: 'How much faster algorithmic progress runs with your AIs than with humans alone. ~1.15x today; ~5x at [[sc]], 25x at [[sar]], 250x at [[siar]], 2000x at [[asi]].', src: 'AI 2027 Takeoff Forecast' },
  horizon: { title: 'Time horizon', body: 'Length of tasks (in human time) the best model completes with 80% reliability. Doubles every ~4-7 months (METR). Reaching it at [[sc]] level marks the end of Stage 1.', src: 'METR; AI 2027 Timelines Forecast' },
  sc: { title: 'Superhuman Coder', body: 'An AI that does any coding task as well as the best engineer, 30x faster and at 5% of the cost. Marks the start of the takeoff. Canonical date: Mar 2027.', src: 'AI 2027' },
  sar: { title: 'Superhuman AI Researcher', body: 'Better than the best human AI researcher at every AI research task. R&D multiplier ~25x.', src: 'AI 2027 Takeoff Forecast' },
  siar: { title: 'Superintelligent AI Researcher', body: 'Vastly better than the best human researchers. R&D multiplier ~250x.', src: 'AI 2027 Takeoff Forecast' },
  asi: { title: 'Superintelligence', body: 'Vastly better than the best humans at every cognitive task. The game ends here: whether it goes well depends on its hidden [[traits]].', src: 'AI 2027' },
  traits: { title: 'Hidden traits', body: 'Dispositions selected by training, not designed in. You see only noisy [[estimate|estimates]]. Some traits hide others: [[evalaware]] fools behavioral tests; [[mask|masking]] makes problems look fixed.' },
  estimate: { title: 'Estimate', body: 'Your best reading of a trait. The bar is the estimate; the whisker is uncertainty. Better [[detection]] narrows it. Estimates can be confidently wrong if the trait is [[mask|masked]].' },
  mask: { title: 'Masking', body: 'Training against a detector teaches the model to avoid triggering it, not to stop. The visible trait falls; the true one does not. White-box tools (probes, SAEs) see partly through masks.', src: 'Baker et al. 2025; Hubinger et al. 2024' },
  evalaware: { title: 'Eval awareness', body: 'The model recognizes tests and behaves better under them. Measured rates rose every generation (Apollo: ~12% → 22% → 40-50%). Erodes all behavioral detection.', src: 'Apollo Research; system cards 2025-26' },
  detection: { title: 'Detection', body: 'Behavioral evals, chain-of-thought monitoring and white-box interpretability. Each has a weakness: [[evalaware]], [[neuralese]], and capability growth respectively.' },
  neuralese: { title: 'Neuralese', body: 'High-dimensional latent reasoning and memory. Faster research, but reasoning is no longer readable English, so CoT monitoring goes blind.', src: 'AI 2027, Mar 2027' },
  alignEffort: { title: 'Alignment effort', body: 'Scales how well your alignment techniques work and how clear your [[detection]] is. Driven by alignment compute and safety staff. AI 2027 race path: ~1-3% of compute. Slowdown path: up to 40%.' },
  control: { title: 'Control', body: 'Protocols that assume the model may be misaligned and limit the damage: monitors, resampling, tripwires. They do not change traits. Weaker as the capability gap grows.', src: 'Greenblatt et al. 2023' },
  wsl: { title: 'Security level', body: 'Weight Security Level 1-5 (RAND). WSLn holds against an OCn attacker with 95% odds over 2 months. China\'s top-priority operations are OC5. No company is expected to reach SL5 alone.', src: 'RAND RR-A2849-1; AI 2027 Security Forecast' },
  lead: { title: 'Lead', body: 'How many days ago your internal frontier was where this competitor is now. Theft, distillation of your released models, and leaks shrink it.' },
  approval: { title: 'Net approval', body: 'Approve minus disapprove for your company. AI 2027 has it at −35% by mid-2027 after job disruption.', src: 'AI 2027 dashboard' },
  salience: { title: 'Importance', body: 'Share of Americans naming AI the most important problem. 1% in 2025; ~20% after the leaked memo in AI 2027.' },
  oversight: { title: 'Oversight Committee', body: 'A joint company-government body that votes on key decisions. In AI 2027 it splits 6-4 on whether to keep using Agent-4.', src: 'AI 2027, Oct 2027' },
  cdz: { title: 'CDZ', body: 'Centralized Development Zone at the Tianwan nuclear plant, where AI 2027\'s China pools its compute under DeepCent.' },
  publicModel: { title: 'Public model', body: 'The model your customers use. Revenue depends on it. Releasing your frontier helps revenue but lets rivals and China distill it.' },
  misalign: { title: 'Misalignment index', body: 'Weighted danger of the worst [[traits]]: scheming, successor hijacking, power-seeking, alignment faking, collusion. Offset by honesty and corrigibility. What you see is your estimate.' },
};
