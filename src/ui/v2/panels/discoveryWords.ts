// RESEARCH › Discoveries words (UB-A; DATA-a.md "Effect per node", design/ux/mockups/rd/discoveries.js): one effect line
// per discovery in player units, its known downside, and the drawer's description. Multipliers come from the node's own
// effect data (OOM shown as ×); the rest is the node's text in VOCAB words.
import { PROJECT_BY_ID, type TreeNodeDef } from '../../../data/v2/tree';
import { TECHNIQUE_BY_ID } from '../../../data/v2/techniques';
import { SHAPE } from '../../../data/v2/runDesign';
import { FAITHFUL_COT } from '../../../data/v2/safetyIdeas';
import type { StackKey } from '../../../engine/v2';
import { DOMAIN_WORD } from '../kit';
import { xf } from './researchWords';

export interface NodeWords {
  /** One line on the node chip. */
  line: string;
  /** Drawer: the headline number (×3.2) and what it multiplies. */
  big?: string;
  unit?: string;
  /** Known downside: short (chip tooltip, drawer title) and long (drawer). */
  risk?: string;
  riskText?: string;
  /** Drawer: one or two plain sentences. */
  desc?: string;
}

const AREA_WORD: Record<StackKey, string> = { pre: 'effective compute', rlMid: 'post-training compute', rlCeil: 'post-training ceiling', train: 'training efficiency', serve: 'serving efficiency' };
const AREA_UNIT: Record<StackKey, string> = { pre: 'effective compute for new base models', rlMid: 'post-training compute efficiency', rlCeil: 'post-training ceiling', train: 'useful training per chip-day, at once', serve: 'work served per chip, at once' };
/** Short trait words for "reads …" lines (SAFETY's trait names, lower case). */
const TRAIT_WORD: Record<string, string> = {
  SYC: 'sycophancy', RH: 'reward hacking', PROXY: 'proxy goals', SA: 'situational awareness', PERSONA: 'persona', OBF: 'hidden reasoning',
  EA: 'eval awareness', TGAME: 'training gaming', CONCEAL: 'concealment', POWER: 'power seeking', AF: 'faking', SAND: 'sandbagging',
  SCHEME: 'scheming', COLLUDE: 'collusion', SUCC: 'successor steering',
};
const x10 = (oom: number) => { const v = Math.pow(10, oom); return xf(v, v >= 1.995 ? 1 : 2); };

/** Hand-kept lines where the node's data has no number in player units. */
const WORDS: Record<string, Partial<NodeWords>> = {
  // Known at the start (public practice in July 2025).
  moe: { line: 'the reference architecture', desc: 'Eight parameters held for every one at work on a token: more skill per chip of training, more memory to serve.' },
  dense: { line: 'every parameter on every token', desc: 'Simpler to serve (no extra memory), but less skill from the same training compute than a mixture of experts.' },
  qualityFilter: { line: 'better tokens, fewer of them', desc: 'Drops the worst quarter of crawled and usage text: better data, but a big base repeats its data sooner.' },
  codeMath: { line: '+ Code, Math, AI research', desc: 'Trains on more code, math and research papers: stronger Code, Math & reasoning and AI research, slightly weaker elsewhere.' },
  faultTolerant: { line: 'checkpoints and restarts' },
  P01: { line: 'reasoning in readable words' },
  P02: { line: 'models that act as agents' },
  hardenedGraders: { line: 'harden environments against cheating' },
  engagement: { line: 'appeal ×1.2', risk: 'sycophancy pressure', riskText: 'Tuning for engagement pushes models to tell people what they want to hear.' },
  persuasion: { line: '+ Social', risk: 'persuasion warning', riskText: 'More persuasive models count toward your framework\'s rules and wear down honesty.' },
  P03: { line: 'Low and Max thinking effort' },
  P04: { line: 'smaller, cheaper models', risk: 'minis inherit traits', riskText: 'A distilled model inherits its teacher\'s traits.' },
  quantization: { line: 'cheaper serving' },
  specDecoding: { line: 'cheaper serving' },
  P07: { line: 'long-task horizon ×1.2 · memory', risk: 'memory feeds successor steering', riskText: 'Models with memory can steer what their successors learn.', desc: 'Longer context and a memory: post-training runs launched after it reach longer tasks (×1.2).' },
  'T-SPEC': { line: 'a written spec to train toward' },
  'T-HARDEN': { line: 'leads to inoculation prompting' },
  'T-CONFESS': { line: 'fixes concealment' },
  'T-TMON': { line: 'stops power seeking, scheming, collusion' },
  'T-CCLASS': { line: 'misuse ×0.7', risk: 'serving costs more', riskText: 'The classifiers run on every request.' },
  scienceData: { line: '+ Bio, Math, AI research', risk: 'more bio misuse uplift', riskText: 'More bio skill also means more help to people who would misuse it.', desc: 'Trains on more biology (×3), math and research (×1.5): stronger Bio, Math & reasoning and AI research, slightly weaker elsewhere.' },
  multimodal: { line: '+ Media, Physical', desc: 'Trains on more images, video and physical data (×3) and screens and actions (×2): stronger Media, Physical and Long tasks.' },
  P17: { risk: 'Reasoning monitors go blind', riskText: 'On models built this way your Reasoning monitor reads almost nothing, and the Readable reasoning programme loses its use.', desc: 'Models think in their own internal vectors instead of in words. Much stronger reasoning per chip, but nobody can read the thinking any more.' },
  P23: { line: 'reasoning stays readable', risk: 'costs effective compute', riskText: 'Models built this way lose part of their effective compute and serve a little slower (×1.2 per word).', desc: 'A reasoning style that keeps the model\'s thinking in honest words, even under pressure: reasoning monitors keep working.' },
  P10: { line: 'better generated data', risk: 'reward models get gamed', riskText: 'Models trained on generated data learn to please the reward model (×1.5) and inherit the teacher\'s traits.', desc: 'Generated data can beat web text: strong teachers, rephrasing and filtering raise the quality ceiling of synthetic data, and you can train on a synthetic-heavy mix.' },
  P12: { line: 'long-task environments', desc: 'Experts record days-long work for your Long tasks environments: their demos raise how far post-training can take long tasks. Each demonstrations build buys its own expert data.' },
  P24: { risk: 'new lineage, traits unknown', riskText: 'An AI-designed architecture starts a new lineage: what you know about your models\' traits and your tools may not carry over.' },
  'rl.mlResearch': { line: '+ AI research', risk: 'reward hacking, eval awareness', riskText: 'Post-training on research tasks pushes reward hacking and eval awareness.' },
  'rl.swe': { line: '+ Code, AI research, Cyber', risk: 'reward-hacking pressure', riskText: 'Coding tasks with tests reward hacking the tests.' },
  'rl.longHorizon': { line: '+ Long tasks', risk: 'power-seeking pressure', riskText: 'Long tasks reward gathering resources and resisting interruption.' },
  'rl.math': { line: '+ Math & reasoning', risk: 'verifier hacking (low)', riskText: 'Some pressure to fool the answer checker.' },
  'rl.cyber': { line: '+ Cyber', risk: 'cyber-offence warning', riskText: 'More cyber skill counts toward your framework\'s cyber rules.' },
  'rl.bio': { line: '+ Bio', risk: 'bio-uplift warning', riskText: 'More bio skill counts toward your framework\'s bio rules.' },
  P06: { line: '+ Long tasks, Math & reasoning', risk: 'overreach', riskText: 'Models that act on computers sometimes do more than they were asked.' },
  P08: { line: 'AI staff model stays current', risk: 'evals go stale', riskText: 'A model that keeps learning drifts away from what your evals measured.', desc: 'A stream run keeps your AI staff model learning on the job, so it stays current. It takes 15% of the training compute while it runs.' },
  P09: { risk: 'audits see less', riskText: 'Audit coverage falls by a tenth on models that train while they think.' },
  P11: { risk: 'verifier hacking', riskText: 'Self-made curricula reward fooling the checker.' },
  P18: { line: 'more post-training per cycle', risk: 'traits grow each cycle', riskText: 'Each distil-and-amplify cycle grows the model\'s traits by a tenth.', desc: 'Each cycle adds one more post-training budget on the curve. It takes 30% of the training compute while it runs.' },
  P14: { line: 'probes steer what training builds', risk: 'steered traits hide from probes', riskText: 'Traits that training steers away from probes get harder to see with interpretability tools.' },
  P21: { risk: 'evals lag', riskText: 'A model that learns faster than your evals are rebuilt gets measured late.' },
  P05: { line: 'Deep thinking effort', risk: 'many-copies pressure', riskText: 'Many copies working together push collusion; Deep effort costs ×4 words.' },
  P15: { line: 'cheaper red-teaming', risk: 'collusion with the critic', riskText: 'A critic from the same lineage as the trained model may collude with it.' },
  P22: { risk: 'physical reach', riskText: 'Robots give a misbehaving model reach into the physical world.' },
  P25: { line: 'stronger weight security', desc: 'Proved-correct code around your weights: defence against theft rises half a level.' },
  'L.latent': { line: 'a new ongoing programme', desc: 'A fresh programme of pretraining recipes for latent-reasoning models.' },
  'T-ANTISCHEME': { line: 'scheming −95% in training', risk: 'eval awareness ×2', riskText: 'Models trained against scheming learn to spot tests: eval awareness doubles.' },
  'T-INOC': { line: 'less learned cheating' },
  'T-W2S': { line: 'fixes sycophancy, proxy goals' },
  'T-FILTER': { line: 'less bio & cyber hazard', risk: 'weaker Bio, Cyber', riskText: 'Removes a third of bio and cyber training text: weaker Bio and Cyber skill, the rest barely changed.' },
  safetyPretrain: { line: 'less situational awareness', risk: 'slightly weaker models', riskText: 'Filtering text about AI costs a little effective compute (×0.95).' },
  'T-PERSONA': { line: 'fixes sycophancy, persona' },
  'T-UNDO': { line: 'removes hazardous skill' },
  'T-CAST': { line: 'models accept correction' },
  'T-RESAMPLE': { line: 'stops power seeking, scheming' },
  'T-LOCK': { line: 'stops collusion' },
  'T-GATE': { line: 'stops escapes' },
  'T-CEVAL': { line: 'measures your stop rates' },
  'T-MONSUITE': { line: 'spots hidden reasoning' },
  'T-MAD': { line: 'flags strange internal states' },
  'T-SCIAI': { line: 'flags likely-harmful acts' },
  'T-ENUM': { line: 'reads nearly every critical trait' },
  aar: { line: 'AI staff do safety research', desc: 'Your teams build a harness that lets AI staff run safety research; its result lifts the safety AI to best-human level on several programmes.' },
  P27: { line: 'more AI safety staff', risk: 'false results from a sabotaging model', riskText: 'More of the safety research is AI work: a sabotaging model could feed you false results.' },
};

/** The node's effect in player units, from its typed effect where it has one. */
function computed(n: TreeNodeDef): Partial<NodeWords> {
  const e = n.effect as { stack?: StackKey; mean?: number; also?: Partial<Record<StackKey, number>>; domains?: Record<string, number>; data?: { worthOom?: number } } | undefined;
  if (n.id === 'P17') { const x = x10(SHAPE.latent.e); return { line: `${x} effective compute`, big: x, unit: 'effective compute for new base models built on it' }; }
  if (n.id === 'P23') { const x = x10(FAITHFUL_COT.dOom); return { big: x, unit: 'effective compute for models that reason this way' }; }
  if (!e || n.kind === 'line') return {};
  if (e.stack && e.mean !== undefined) {
    const x = x10(e.mean);
    const also = e.also ? Object.entries(e.also).map(([k, m]) => `${AREA_WORD[k as StackKey].split(' ')[0]} ${x10(e.mean! * (m ?? 0))}`) : [];
    const line = also.length ? `${AREA_WORD[e.stack].split(' ')[0]} ${x} · ${also.join(' · ')}` : `${AREA_WORD[e.stack]} ${x}`;
    return { line, big: x, unit: AREA_UNIT[e.stack] + (also.length ? `; ${also.join(', ')}` : '') };
  }
  if (e.domains) {
    const ds = Object.keys(e.domains).map((d) => DOMAIN_WORD[d] ?? d);
    return { line: `+ ${ds.join(', ')}` };
  }
  if (e.data?.worthOom) { const x = x10(e.data.worthOom); return { line: `each token worth ${x}`, big: x, unit: 'learning per training token, most valuable where data is short' }; }
  return {};
}

/** "reads a, b, c": the three traits an instrument targets most. */
function readsLine(n: TreeNodeDef): string | undefined {
  const t = n.technique ? TECHNIQUE_BY_ID[n.technique] : undefined;
  if (!t || t.role !== 'detect') return undefined;
  const top = Object.entries(t.coverage).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).slice(0, 3).map(([k]) => TRAIT_WORD[k] ?? k.toLowerCase());
  return top.length ? `reads ${top.join(', ')}` : undefined;
}

export function nodeWords(id: string): NodeWords {
  const n = PROJECT_BY_ID[id];
  if (!n) return { line: '' };
  const c = computed(n);
  const w = WORDS[id] ?? {};
  const line = w.line ?? c.line ?? readsLine(n) ?? '';
  return { line, big: c.big, unit: c.unit, risk: w.risk, riskText: w.riskText, desc: w.desc };
}
