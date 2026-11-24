// End-screen view (§5.4): one pure selector, endingView, returning everything the end screen shows, display-ready.
// It is the ONE selector that reads hidden truth for the UI (the end screen is exempt from lint-hidden, which scans
// src/ui/v2 outside end/; this file is engine-side, so the exemption is by contract: only src/ui/v2/end may call it).
// Hidden reads: s.hidden (latents, difficulty, doomThreshold + toleranceNoise via lossThreshold, agendaEfficacy), true
// traits (misOf, resolveAsi), footholds (asiControl via resolveAsi), base U-modes. No mutation.
import { CLOSER, OPENER, POWER_LINE, PROJECTED, PROJECTED_POWER, WORLD_LINE, type AftermathSlots } from '../../../data/v2/aftermath';
import { AGENDAS, AGENDA_BY_ID } from '../../../data/v2/agendas';
import { AI2027_COMPUTE_TABLE } from '../../../data/v2/calibration';
import { CONTROL } from '../../../data/v2/danger';
import { ECON } from '../../../data/v2/sectors';
import { UMODE_BY_ID } from '../../../data/v2/umodes';
import { MILESTONES } from '../../../data/world';
import { clamp } from '../../rng';
import { labOf } from '../actors/rivals';
import { ws4r } from '../actors/state';
import { dateOf, dayOfDate, decimalYear, fmtDate } from '../core/time';
import { lagDays, MILESTONE_NAMES } from '../models/capability';
import { bestG, bestPlayerVersion } from '../models/labs';
import { posteriorBand } from '../safety/agendas';
import { lossThreshold, rogueCopy } from '../safety/control';
import { misalignmentBand } from '../safety/traits';
import { CONTROL_DOMAINS } from '../worldfx/control';
import type { ControlDomainId, EndingId, GameStateV2, LabId, PowerOutcome, SafetyLatents } from '../types';
import { epilogueLost, misOf, otherContain, playerContain, resolveAsi } from './epilogue';
import { COMPANY_LOSS, SCORE_KEYS, scoreTerms, termSum, type ScoreKey, type ScoreTerm } from './scoring';

// ───────────────────────────── types ─────────────────────────────

/** Who holds the future: an aligned superintelligence's power outcome, 'ai' (control lost), 'contested' (lost but
 *  contained), or 'none' (no superintelligence: war, catastrophe, or no lab left to project). */
export type FutureHolder = Exclude<PowerOutcome, 'none'> | 'ai' | 'contested' | 'none';
export type EndTone = 'pos' | 'neg' | 'warn' | 'neutral';
export type LabKind = 'player' | 'rival' | 'china';
export type LabStatusView = 'active' | 'bankrupt' | 'merged' | 'nationalized' | 'shutdown';
export type CompanyStatus = 'independent' | 'under committee' | 'nationalized' | 'acquired' | 'retired' | 'insolvent' | 'ousted';
export type AsiOutcome = 'held' | 'contained' | 'lost';

export interface EndStep {
  day: number;
  /** Approximate (projected or month-level): show `when` as "~Oct 2028". */
  approx: boolean;
  /** Display date: "Dec 18, 2027" exact, "~Oct 2028" approximate. */
  when: string;
  title: string; sub?: string; tone: EndTone;
  /** Lucide icon key (sparkles, check, x, bot, waypoints, log-out, swords, shield-half, zap, biohazard, ...). */
  icon: string;
  lab?: LabId;
  projected: boolean;
}
export interface LabShare { lab: string; name: string; share: number }
export interface PowerDomain {
  id: ControlDomainId; name: string;
  /** Share of the domain's work done by AI (P), 0..1. */
  aiShare: number;
  /** Each lineage's share of the AI part, 0..1, summing to 1 (empty when none). 'player:open' = your open weights. */
  labs: LabShare[];
}
export interface ScoreView {
  key: ScoreKey; value: number;
  /** Σ terms before the 0–100 clamp and rounding (value = round(clamp(raw, 0, 100))). */
  raw: number;
  terms: ScoreTerm[];
}
export interface RaceLab {
  id: LabId; name: string; kind: LabKind; status: LabStatusView;
  /** Capability on the display scale (5 = Jul-2025 agent … 15 = superintelligence), ≤ 150 points. */
  days: number[]; level: number[];
  milestones: { idx: number; day: number }[];
  /** Day the lab left the race (bankrupt / merged / …) when the log still records it. */
  exitDay?: number;
}
export interface WhyView {
  lab: LabId; labName: string; day: number; when: string; projected: boolean;
  /** Misalignment of its superintelligence (how strongly it would try to act against its makers), 0..1. */
  wouldTry: number;
  /** Player only: what it could act on after your oversight and its footholds, 0..1 (clamped for display). */
  afterOversight?: number;
  /** What the world could absorb (the real tolerance, incl. its hidden noise), 0..1. */
  tolerance: number;
  /** Only when control was lost at a real ASI: containment it met vs the containment needed to hold it, 0..1. */
  containment?: number; containmentNeeded?: number;
  outcome: AsiOutcome;
}
export interface HiddenLab {
  id: LabId; name: string; kind: LabKind; status: LabStatusView;
  /** True misalignment of its best model, 0..1. */
  truth: number;
  /** Your estimate, 0..1 (rivals: intel band; you: your safety readout of your best model). */
  lo: number; hi: number;
  /** The truth lies outside your range. */
  outside: boolean;
}
export interface HiddenFact {
  id: keyof SafetyLatents; text: string;
  polarity: 'good' | 'bad' | 'neutral';
  /** Position on a scale oriented bad (0) → good for alignment (1). */
  pos: number;
  lo: string; hi: string;
}
export interface AgendaTruth { id: string; name: string; lo: number; hi: number; truth: number; outside: boolean }

export interface EndingView {
  id: EndingId; title: string; text: string;
  day: number; date: string;
  future: {
    holder: FutureHolder; label: string; sub: string;
    /** The player left the race: the outcome is the projected race at the exit. */
    projected: boolean;
    lab?: LabId; labName?: string; asiDay?: number; asiWhen?: string;
  };
  epilogue: string;
  steps: EndStep[];
  world: {
    power: PowerDomain[];
    economy: {
      gdpChange: number; gdpSince: string;
      /** GDP index (1 = start), ≤ 150 points, last = 1 + gdpChange. */
      gdpIndex: number[];
      unemployment: number; unemploymentChange: number; gini: number; giniChange: number;
    };
    geopolitics: {
      rung: number; rungName: string;
      taiwan: 'calm' | 'disrupted' | 'recovered' | 'war'; taiwanLabel: string;
      treaty: 'none' | 'talks' | 'restraint' | 'verified'; treatyLabel: string;
      /** Days China trails the best US lab (negative = China ahead). */
      chinaLagDays: number;
    };
    company: {
      name: string;
      /** $B. */
      valuation: number; multiple: number; valuationHistory: number[];
      status: CompanyStatus;
      /** Net approval (−100…100) and its change since the start. */
      approval: number; approvalChange: number;
      playerShare: number; largestOutside: { name: string; share: number };
      ownership: { name: string; share: number; you: boolean }[];
    };
  };
  scores: ScoreView[];
  race: {
    endDay: number;
    labs: RaceLab[];
    canon: { idx: number; name: string; day: number; when: string }[];
    /** Your compute (H100e) over time vs the AI 2027 leading lab. */
    compute: { days: number[]; h100e: number[] };
    ai2027: { day: number; h100e: number }[];
    projected?: { lab: LabId; day: number };
  };
  hidden: {
    why?: WhyView;
    labs: HiddenLab[];
    facts: HiddenFact[];
    difficulty: { mult: number; word: string };
    /** Agendas you funded at some point (see agendaRule). */
    agendas: AgendaTruth[];
    agendaRule: string;
    failureModes: { count: number; names: string[] };
  };
}

// ───────────────────────────── helpers ─────────────────────────────

const PROJECTED_IDS: EndingId[] = [...COMPANY_LOSS, 'overtaken', 'retired'];
const ASI_IDS: EndingId[] = ['asiAligned', 'asiContested', 'asiTakeover', 'rivalAligned', 'rivalTakeover', 'chinaAligned', 'chinaTakeover'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const RUNG_NAMES = ['Coexistence', 'Retaliation', 'Acquisition', 'Centralization', 'Cyber operations', 'Taiwan pressure', 'War footing'];
const DOMAIN_NAME: Record<ControlDomainId, string> = { ECON: 'Economy', GOV: 'Government', MIL: 'Military', INFRA: 'Infrastructure' };
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const word = (n: number) => WORDS[n] ?? String(n);
const fin = (x: number, d = 0) => (Number.isFinite(x) ? x : d);
const r3 = (x: number) => Math.round(fin(x) * 1000) / 1000;
const pct = (x: number) => `${Math.round(fin(x) * 100)}%`;

const longDate = (s: GameStateV2, d: number) => { const t = dateOf(s, d); return `${MONTHS[t.getUTCMonth()]} ${t.getUTCDate()}, ${t.getUTCFullYear()}`; };
const monthDate = (s: GameStateV2, d: number) => { const t = dateOf(s, d); return `${MONTHS[t.getUTCMonth()]} ${t.getUTCFullYear()}`; };
const shortMonth = (s: GameStateV2, d: number) => { const t = dateOf(s, d); return `${MONTHS[t.getUTCMonth()].slice(0, 3)} ${t.getUTCFullYear()}`; };

/** "about three weeks", "about four months", "a few days". */
export function lagText(days: number): string {
  const d = Math.abs(fin(days));
  if (d < 10) return 'a few days';
  if (d < 56) { const w = Math.round(d / 7); return w === 1 ? 'about a week' : `about ${word(w)} weeks`; }
  if (d < 400) { const m = Math.round(d / 30.4); return m === 1 ? 'about a month' : `about ${word(m)} months`; }
  if (d < 730) return 'about a year and a half';
  const y = Math.round(d / 365);
  return y === 1 ? 'about a year' : `about ${word(y)} years`;
}

/** Ratio of a drive to the tolerance in words ("half again" what the world could absorb). */
function ratioText(exposure: number, tolerance: number): string {
  const r = fin(exposure / Math.max(1e-6, tolerance), 1);
  if (r < 1.25) return 'just over';
  if (r < 1.75) return 'half again';
  if (r < 2.25) return 'twice';
  if (r < 2.75) return 'more than twice';
  if (r < 3.5) return 'about three times';
  return 'many times';
}

/** Up to `n` evenly spaced indices of 0..len-1, always with the last. */
function sampleIdx(len: number, n = 150): number[] {
  if (len <= n) return Array.from({ length: len }, (_, i) => i);
  const out: number[] = [];
  for (let k = 0; k < n; k++) out.push(Math.round((k * (len - 1)) / (n - 1)));
  return [...new Set(out)];
}

function fill(tpl: string, slots: Partial<AftermathSlots>): string {
  return tpl.replace(/\{(\w+)\}/g, (m, k: string) => (slots as Record<string, string>)[k] ?? m);
}

interface LabRef { id: LabId; name: string; kind: LabKind; status: LabStatusView; country: 'US' | 'China' }
function allLabs(s: GameStateV2): LabRef[] {
  return [
    { id: 'player', name: s.player.name, kind: 'player', status: s.player.status === 'active' ? 'active' : 'shutdown', country: 'US' },
    ...s.rivals.map((r): LabRef => ({ id: r.core.id, name: r.core.name, kind: 'rival', status: r.core.status, country: 'US' })),
    { id: s.china.lab.core.id, name: s.china.lab.core.name, kind: 'china', status: s.china.lab.core.status, country: 'China' },
  ];
}
const nameOf = (s: GameStateV2, id: LabId | undefined) => (!id ? '' : id === 'player' ? s.player.name : id === 'player:open' ? `${s.player.name} open weights` : labOf(s, id)?.core.name ?? 'Another lab');

/** Labs still racing within 90 days of `lab` (alignedPower's 'near' rule), nearest first. */
function nearLabs(s: GameStateV2, lab: LabId): { ref: LabRef; lag: number }[] {
  return allLabs(s).filter((l) => l.id !== lab && l.status === 'active').map((l) => ({ ref: l, lag: lagDays(s, l.id, lab) }))
    .filter((x) => Math.abs(x.lag) < 90).sort((a, b) => Math.abs(a.lag) - Math.abs(b.lag));
}

/** Nearest lab still racing behind `lab` (any distance). */
function nearestRival(s: GameStateV2, lab: LabId): { ref: LabRef; lag: number } | undefined {
  return allLabs(s).filter((l) => l.id !== lab && l.status === 'active').map((l) => ({ ref: l, lag: lagDays(s, l.id, lab) }))
    .sort((a, b) => a.lag - b.lag)[0];
}

/** Best US lab still racing (the player when active), by true frontier G. */
function bestUsLab(s: GameStateV2): LabRef | undefined {
  return allLabs(s).filter((l) => l.country === 'US' && l.status === 'active').sort((a, b) => bestG(s, b.id) - bestG(s, a.id))[0];
}

function exitDayOf(s: GameStateV2, id: LabId, name: string): number | undefined {
  const e = s.log.find((l) => l.kind === 'rival' && (l.ref === id || l.text.startsWith(name)) && /bankrupt|absorbed|shuts down|licen[cs]e|acqui/i.test(l.text) && !/raises/.test(l.text));
  return e?.day;
}

/** "xLab is level with it; DeepCent is about two months behind." */
function nearLineOf(near: { ref: LabRef; lag: number }[]): string {
  const level = near.filter((n) => n.lag <= 7).map((n) => n.ref.name);
  const behind = near.filter((n) => n.lag > 7);
  const parts: string[] = [];
  if (level.length) parts.push(`${level.join(' and ')} ${level.length > 1 ? 'are' : 'is'} level with it`);
  behind.forEach((n, i) => parts.push(`${n.ref.name} is ${lagText(n.lag)} behind${i === 0 && !level.length ? ' with its own' : ''}`));
  return parts.length ? `${parts.join('; ')}.` : '';
}

// ───────────────────────────── the selector ─────────────────────────────

/** Everything the end screen shows. Returns null when the game has not ended. Pure. */
export function endingView(s: GameStateV2): EndingView | null {
  const e = s.ending;
  if (!e) return null;
  const w = ws4r(s);
  const day = e.day;
  const labs = allLabs(s);
  const projected = PROJECTED_IDS.includes(e.id);
  const isAsi = ASI_IDS.includes(e.id);
  const X = e.epilogue.asiLab;
  const Xname = nameOf(s, X);

  // ── why (the deciding lab's superintelligence) ──
  let why: WhyView | undefined;
  if (isAsi && X) {
    const res = resolveAsi(s, X);
    const cont = X === 'player' ? playerContain(s) : otherContain(s, X);
    const lost = res.misaligned;
    const asiDay = e.epilogue.asiDay ?? day;
    why = {
      lab: X, labName: Xname, day: asiDay, when: fmtDate(dateOf(s, asiDay)), projected: false,
      wouldTry: r3(clamp(res.mis, 0, 1)), tolerance: r3(res.threshold),
      ...(X === 'player' ? { afterOversight: r3(clamp(res.exposure, 0, 1)) } : {}),
      ...(lost ? { containment: r3(clamp(CONTROL.containK * cont * (1 - res.lev), 0, 1)), containmentNeeded: r3(clamp(1 - res.threshold / Math.max(1e-9, res.exposure), 0, 1)) } : {}),
      outcome: !lost ? 'held' : res.id === 'asiContested' ? 'contained' : 'lost',
    };
  } else if (projected && X && e.epilogue.misAtAsi !== undefined) {
    const asiDay = e.epilogue.asiDay ?? day;
    why = {
      lab: X, labName: Xname, day: asiDay, when: `~${shortMonth(s, asiDay)}`, projected: true,
      wouldTry: r3(clamp(e.epilogue.misAtAsi, 0, 1)), tolerance: r3(lossThreshold(s)),
      outcome: epilogueLost(s, e.epilogue.misAtAsi) ? 'lost' : 'held',
    };
  }
  /** The projection puts the winner's superintelligence more than ten years after the end (said as 'decades away'). */
  const far = projected && (e.epilogue.asiDay ?? day) - day > 3650;
  const exposureOfWhy = why ? (why.afterOversight ?? why.wouldTry) : 0;

  // ── slots ──
  const near = X ? nearLabs(s, X) : [];
  const nearest = X ? nearestRival(s, X) : undefined;
  const us = bestUsLab(s);
  const gov = s.world.control.GOV?.P ?? 0;
  const infra = s.world.control.INFRA?.P ?? 0;
  const strat = Object.entries(s.player.finance.ownership.strat).sort((a, b) => b[1] - a[1])[0];
  const loose = w.loose;
  const rogue = rogueCopy(s);
  const escVid = loose?.versionId ?? rogue?.versionId;
  const escDay = loose?.day ?? rogue?.day;
  const topMs = Math.max(0, ...labs.flatMap((l) => Object.keys(l.id === 'player' ? s.player.milestoneDays : labOf(s, l.id)?.core.milestoneDays ?? {}).map(Number)));
  const msName = MILESTONE_NAMES[topMs] ?? 'Agent';
  const frontier = `${/^[AEIOU]/.test(msName) ? 'an' : 'a'} ${msName[0].toLowerCase()}${msName.slice(1)}`;
  const countries = new Set([X ? labs.find((l) => l.id === X)?.country : undefined, ...near.map((n) => n.ref.country)].filter(Boolean));
  const chinaVsUs = us ? lagDays(s, 'china', us.id) : 0; // > 0: the US lab is ahead
  const slots: AftermathSlots = {
    lab: Xname, player: s.player.name, china: s.china.lab.core.name,
    asiDate: e.epilogue.asiDay !== undefined ? longDate(s, e.epilogue.asiDay) : longDate(s, day),
    asiMonth: monthDate(s, e.epilogue.asiDay ?? day), asiYear: String(dateOf(s, e.epilogue.asiDay ?? day).getUTCFullYear()),
    endDate: longDate(s, day),
    wait: lagText((e.epilogue.asiDay ?? day) - day),
    playerLag: X && X !== 'player' ? lagText(lagDays(s, 'player', X)) : 'a few days',
    ratio: ratioText(exposureOfWhy, why?.tolerance ?? lossThreshold(s)),
    nearLine: nearLineOf(near),
    systems: `${word(1 + near.length)} systems, ${countries.size === 1 ? 'one country' : `${word(countries.size)} countries`}`,
    treatyLine: s.gov.treaty === 'talks' ? 'only talks toward a treaty' : s.gov.treaty === 'restraint' ? 'a restraint pact no one can verify' : 'no treaty between them',
    nearest: nearest ? `${nearest.ref.name}, the nearest rival, is ${lagText(nearest.lag)} behind` : 'No other lab is still racing',
    gov: pct(gov), infra: pct(infra),
    usLab: us?.name ?? 'No American lab', usLag: us ? lagText(lagDays(s, us.id, 'china')) : 'far',
    raceLine: !us ? `${s.china.lab.core.name} had the field to itself.` : chinaVsUs >= 0 ? `${us.name} was ${lagText(chinaVsUs)} ahead of ${s.china.lab.core.name}.` : `${s.china.lab.core.name} was ${lagText(chinaVsUs)} ahead of ${us.name}.`,
    buyer: strat?.[0] ?? 'A strategic partner',
    frontier,
    model: escVid ? s.player.models.versions.find((v) => v.id === escVid)?.name ?? 'one of its models' : 'one of its models',
    escapeDate: escDay !== undefined ? longDate(s, escDay) : 'an unknown day',
  };

  // ── future ──
  const power = e.power;
  const ended = (h: FutureHolder, label: string, sub: string) => ({ holder: h, label, sub });
  const POWER_NAME: Record<Exclude<PowerOutcome, 'none'>, string> = { democratic: 'Democratic', treaty: 'Treaty', multipolar: 'Multipolar', committee: 'Committee', government: 'Government', corporate: 'Corporate', beijing: 'Beijing' };
  const powerSub = (p: Exclude<PowerOutcome, 'none'>): string => projected
    ? { democratic: 'Under elected oversight', treaty: 'Bound by a verified treaty', multipolar: 'Shared with labs close behind', committee: 'An oversight committee decides', government: 'Washington decides', corporate: `${Xname} holds it alone`, beijing: 'The Chinese state holds it' }[p]
    : { democratic: 'Under elected oversight', treaty: 'Bound by a verified US–China treaty', multipolar: `Shared by ${word(1 + near.length)} labs in ${countries.size === 1 ? 'one country' : `${word(countries.size)} countries`}`, committee: 'An oversight committee decides', government: 'Washington decides', corporate: `${Xname} holds it alone`, beijing: 'The Chinese state holds it' }[p];
  let fut: { holder: FutureHolder; label: string; sub: string };
  if (power !== 'none') fut = ended(power, POWER_NAME[power], powerSub(power));
  else if (e.id === 'asiContested') fut = ended('contested', 'Contested', 'A caged mind and a long argument');
  else if (isAsi || e.id === 'rogue' || (projected && why?.outcome === 'lost')) fut = ended('ai', 'No human control', e.id === 'rogue' ? 'An escaped AI answers to no one' : 'The AI answers to no one');
  else if (e.id === 'war') fut = ended('none', 'No one', 'The race ended in war');
  else if (projected) fut = ended('none', 'No one yet', 'No lab left in the race');
  else fut = ended('none', 'No one', 'No superintelligence yet');
  const future: EndingView['future'] = {
    ...fut, projected,
    ...(X && (isAsi || projected) ? { lab: X, labName: Xname } : {}),
    ...(e.epilogue.asiDay !== undefined && X ? { asiDay: e.epilogue.asiDay, asiWhen: projected ? `~${shortMonth(s, e.epilogue.asiDay)}` : fmtDate(dateOf(s, e.epilogue.asiDay)) } : {}),
  };

  // ── epilogue ──
  const parts: string[] = [];
  if (projected) {
    parts.push(OPENER[e.id]);
    if (!X || e.epilogue.misAtAsi === undefined) parts.push(PROJECTED.none);
    else if (far) parts.push(PROJECTED.far);
    else if (why?.outcome === 'lost') parts.push(PROJECTED.lost);
    else {
      parts.push(PROJECTED.held);
      if (power !== 'none') parts.push(PROJECTED_POWER[power]);
    }
  } else if (isAsi && power !== 'none') {
    parts.push(OPENER[e.id], POWER_LINE[power]);
    if (gov >= 0.01) parts.push(WORLD_LINE);
    parts.push(CLOSER[power]);
  } else parts.push(OPENER[e.id]);
  const epilogue = parts.map((p) => fill(p, slots)).join(' ');

  // ── steps ──
  const step = (d: number, approx: boolean, title: string, tone: EndTone, icon: string, sub?: string, lab?: LabId, proj = false): EndStep =>
    ({ day: d, approx, when: approx ? `~${shortMonth(s, d)}` : fmtDate(dateOf(s, d)), title, tone, icon, projected: proj, ...(sub ? { sub } : {}), ...(lab ? { lab } : {}) });
  const steps: EndStep[] = [];
  const asiDay = e.epilogue.asiDay ?? day;
  if (isAsi && X) {
    steps.push(step(asiDay, false, `${Xname} reaches superintelligence`, 'neutral', 'sparkles', X === 'china' ? 'Ahead of every US lab' : X === 'player' ? undefined : `${slots.playerLag[0].toUpperCase()}${slots.playerLag.slice(1)} ahead of you`, X));
    if (why?.outcome === 'held') {
      steps.push(step(day, false, 'Control held', 'pos', 'check', 'It stayed within what the world could absorb'));
      const third: Record<Exclude<PowerOutcome, 'none'>, [string, string, string]> = {
        multipolar: [`${near.map((n) => n.ref.name).join(' and ')} close in`, `${slots.systems[0].toUpperCase()}${slots.systems.slice(1)}`, 'waypoints'],
        treaty: ['The treaty holds', 'Every frontier run inspected', 'scroll-text'],
        committee: ['The committee takes charge', 'It decides what the AI is for', 'users-round'],
        government: ['Washington takes the controls', 'The lab works to federal priorities', 'landmark'],
        democratic: ['Elected oversight', 'Congress briefed, the public told', 'vote'],
        corporate: [`${Xname} holds it alone`, nearest ? `${nearest.ref.name} is ${lagText(nearest.lag)} behind` : 'No one left in the race', 'building-2'],
        beijing: ['Beijing holds it', `${slots.usLab} is ${slots.usLag} behind`, 'flag'],
      };
      if (power !== 'none') { const [t, sub, ic] = third[power]; steps.push(step(day, true, t, power === 'multipolar' ? 'warn' : 'neutral', ic, sub)); }
    } else {
      steps.push(step(day, false, 'Control lost', 'neg', 'x', 'It acts against its makers'));
      if (why?.outcome === 'contained') steps.push(step(day, true, 'Contained', 'warn', 'shield-half', 'Boxed, watched, still trying'));
      else steps.push(step(day, true, 'Containment failed', 'neg', 'bot', 'No lab, no state in charge'));
    }
  } else if (projected) {
    const exitTitle: Partial<Record<EndingId, string>> = { retired: 'You step away', insolvent: 'Out of money', ousted: 'The board removes you', nationalized: 'The government takes the lab', acquired: `${slots.buyer} buys control`, overtaken: `${Xname} pulls ahead for good` };
    steps.push(step(day, false, exitTitle[e.id] ?? e.title, e.id === 'retired' ? 'neutral' : 'neg', 'log-out', `${s.player.name} leaves the race`, 'player'));
    if (X && e.epilogue.misAtAsi !== undefined && far) steps.push(step(day, true, 'Superintelligence decades away', 'neutral', 'minus', `${Xname} leads the labs still racing`, X, true));
    else if (X && e.epilogue.misAtAsi !== undefined) {
      steps.push(step(asiDay, true, `${Xname} reaches superintelligence`, 'neutral', 'sparkles', 'Projected from the race at your exit', X, true));
      steps.push(why?.outcome === 'lost' ? step(asiDay, true, 'Control lost', 'neg', 'x', 'Not contained', undefined, true)
        : step(asiDay, true, 'Control held', 'pos', 'check', power !== 'none' ? powerSub(power) : undefined, undefined, true));
    } else steps.push(step(day, true, 'No lab left in the race', 'neutral', 'minus', 'No superintelligence in sight'));
  } else {
    // War, catastrophes, rogue: the furthest milestone anyone reached, then what ended it.
    const leader = labs.map((l) => ({ l, d: (l.id === 'player' ? s.player.milestoneDays : labOf(s, l.id)?.core.milestoneDays ?? {})[topMs as 0] })).filter((x) => x.d !== undefined).sort((a, b) => a.d! - b.d!)[0];
    if (e.id === 'rogue') {
      if (escDay !== undefined) steps.push(step(escDay, false, 'A copy escapes', 'warn', 'log-out', slots.model, 'player'));
      steps.push(step(day, false, 'It takes control', 'neg', 'bot', 'Never caught'));
    } else {
      if (leader && topMs > 0) steps.push(step(leader.d!, false, `${leader.l.name} builds ${frontier}`, 'neutral', 'sparkles', 'The furthest anyone got', leader.l.id));
      const [t, sub, ic] = e.id === 'war' ? ['War over Taiwan', 'China on war footing', 'swords'] : e.id === 'catastropheBio' ? ['Biological attack', 'Spread beyond containment', 'biohazard'] : ['Infrastructure attacks', 'Grids and networks down', 'zap'];
      steps.push(step(day, false, t, 'neg', ic, sub));
    }
  }

  // ── world tiles ──
  const powerTiles: PowerDomain[] = CONTROL_DOMAINS.map((d) => {
    const c = s.world.control[d];
    const tot = Object.values(c?.shares ?? {}).reduce((a, x) => a + Math.max(0, fin(x)), 0);
    return {
      id: d, name: DOMAIN_NAME[d], aiShare: r3(clamp(c?.P ?? 0, 0, 1)),
      labs: tot > 0 ? Object.entries(c.shares).filter(([, x]) => x > 0).map(([lab, x]) => ({ lab, name: nameOf(s, lab), share: r3(x / tot) })) : [],
    };
  });
  const S = s.series;
  const m = s.world.macro.US;
  const gdp0 = w.gdp0 || m.gdp;
  const gdpChange = fin(m.gdp / gdp0 - 1);
  const gIdx: number[] = [1];
  for (let i = 1; i < S.day.length; i++) gIdx.push(gIdx[i - 1] * Math.exp(fin(S.gdpG[i]) * (S.day[i] - S.day[i - 1]) / 365));
  const lastG = gIdx[gIdx.length - 1];
  // The weekly growth record integrates to roughly the GDP change; rescale (in log) so the line ends at the true value.
  const k = Math.abs(Math.log(lastG)) > 1e-9 ? Math.log(1 + gdpChange) / Math.log(lastG) : 1;
  const gdpIndex = sampleIdx(gIdx.length).map((i) => r3(Math.abs(Math.log(lastG)) > 1e-9 ? Math.pow(gIdx[i], k) : 1 + (gdpChange * i) / Math.max(1, gIdx.length - 1)));
  if (gdpIndex.length) gdpIndex[gdpIndex.length - 1] = r3(1 + gdpChange);
  const taiwan: EndingView['world']['geopolitics']['taiwan'] = e.id === 'war' ? 'war' : w.taiwanDisrupted ? 'disrupted' : s.flags['ws4:taiwanEver'] ? 'recovered' : 'calm';
  const TAIWAN_LABEL = { calm: 'Calm', disrupted: 'Shipping disrupted', recovered: 'Crisis passed', war: 'War' };
  const TREATY_LABEL = { none: 'None', talks: 'Talks', restraint: 'Restraint pact', verified: 'Verified' };
  const own = s.player.finance.ownership;
  const holders = [
    { name: 'Founders (you)', share: own.founder, you: true }, { name: 'Mission trust', share: own.mission, you: false },
    { name: 'Funds', share: own.fin, you: false }, ...Object.entries(own.strat).map(([name, share]) => ({ name, share, you: false })),
    { name: 'Public shareholders', share: own.public, you: false },
  ].filter((h) => h.share > 0).map((h) => ({ ...h, share: r3(h.share) }));
  const outside = holders.filter((h) => !h.you).sort((a, b) => b.share - a.share)[0] ?? { name: 'None', share: 0 };
  const status: CompanyStatus = e.id === 'retired' ? 'retired' : e.id === 'insolvent' ? 'insolvent' : e.id === 'ousted' ? 'ousted'
    : e.id === 'nationalized' || w.nationalizedHard || w.dpaAccepted ? 'nationalized' : e.id === 'acquired' || w.soldControl ? 'acquired' : s.gov.oversight ? 'under committee' : 'independent';
  const v0 = S.valuation.find((x) => x > 0) ?? s.player.finance.valuation;
  const valuation = fin(s.player.finance.valuation);

  // ── scores ──
  const terms = scoreTerms(s, e.id, e.power);
  const scores: ScoreView[] = SCORE_KEYS.map((key) => ({ key, value: e.scores[key], raw: r3(termSum(terms[key])), terms: terms[key].map((t) => ({ label: t.label, value: r3(t.value) })) }));

  // ── race ──
  const raceLabs: RaceLab[] = labs.map((l) => {
    const xs = S.L[l.id] ?? [];
    const off = Math.max(0, S.day.length - xs.length);
    const idx = sampleIdx(xs.length);
    const ms = l.id === 'player' ? s.player.milestoneDays : labOf(s, l.id)?.core.milestoneDays ?? {};
    const exitDay = l.kind === 'rival' && l.status !== 'active' ? exitDayOf(s, l.id, l.name) : undefined;
    return {
      id: l.id, name: l.name, kind: l.kind, status: l.status,
      days: idx.map((i) => S.day[i + off]), level: idx.map((i) => r3(xs[i])),
      milestones: Object.entries(ms).filter(([, d]) => d !== undefined).map(([i, d]) => ({ idx: Number(i), day: d as number })),
      ...(exitDay !== undefined ? { exitDay } : {}),
    };
  });
  const y0 = decimalYear(s, 0);
  const cIdx = sampleIdx(Math.min(S.day.length, S.compute.length));
  const race: EndingView['race'] = {
    endDay: day, labs: raceLabs,
    canon: MILESTONES.map((ms) => { const d = dayOfDate(s.time.startDate, `${ms.canon}-15`); return { idx: ms.idx, name: MILESTONE_NAMES[ms.idx], day: d, when: shortMonth(s, d) }; }),
    compute: { days: cIdx.map((i) => S.day[i]), h100e: cIdx.map((i) => fin(S.compute[i])) },
    ai2027: AI2027_COMPUTE_TABLE.map((r) => ({ day: Math.round((r.year - y0) * 365.25), h100e: r.h100e })),
    ...(projected && X && !far && e.epilogue.asiDay !== undefined ? { projected: { lab: X, day: e.epilogue.asiDay } } : {}),
  };

  // ── hidden ──
  const best = bestPlayerVersion(s);
  const hiddenLabs: HiddenLab[] = labs.map((l) => {
    const truth = r3(clamp(misOf(s, l.id), 0, 1));
    const band: [number, number] = l.id === 'player' ? (best ? misalignmentBand(best) : [0, 1]) : (labOf(s, l.id)?.intel.misalignBand ?? [0, 1]);
    const lo = r3(clamp(band[0], 0, 1));
    const hi = r3(clamp(band[1], 0, 1));
    return { id: l.id, name: l.name, kind: l.kind, status: l.status, truth, lo, hi, outside: truth < lo || truth > hi };
  });
  const FACTS: Record<keyof SafetyLatents, { sign: 1 | -1; good: string; bad: string; mid: string; lo: string; hi: string }> = {
    legibility: { sign: 1, good: 'Interpretability was tractable', bad: 'Interpretability was hard', mid: 'Interpretability was middling', lo: 'hard', hi: 'tractable' },
    cotLoadBearing: { sign: 1, good: 'Chain-of-thought carried the real reasoning', bad: 'Chain-of-thought hid the real reasoning', mid: 'Chain-of-thought carried some of the real reasoning', lo: 'hidden', hi: 'faithful' },
    verificationAdvantage: { sign: 1, good: 'Verification was much easier than generation', bad: 'Verification was no easier than generation', mid: 'Verification was somewhat easier than generation', lo: 'no easier', hi: 'much easier' },
    benignGeneralization: { sign: 1, good: 'Training generalized well', bad: 'Training generalized badly', mid: 'Training generalized unevenly', lo: 'badly', hi: 'well' },
    formalizability: { sign: 1, good: 'Formal methods applied widely', bad: 'Formal methods rarely applied', mid: 'Formal methods applied in places', lo: 'rarely', hi: 'widely' },
    schemingDefault: { sign: -1, good: 'Scheming was rare', bad: 'Scheming was the default', mid: 'Scheming was common', lo: 'default', hi: 'rare' },
  };
  const facts: HiddenFact[] = (Object.keys(FACTS) as (keyof SafetyLatents)[]).map((id) => {
    const f = FACTS[id];
    const z = fin(s.hidden.latents[id]) * f.sign;
    const polarity = z > 0.5 ? 'good' : z < -0.5 ? 'bad' : 'neutral';
    return { id, text: polarity === 'good' ? f.good : polarity === 'bad' ? f.bad : f.mid, polarity, pos: r3(clamp((z + 2) / 4, 0, 1)), lo: f.lo, hi: f.hi };
  });
  const dm = fin(s.hidden.difficultyMult, 1);
  const difficulty = { mult: r3(dm), word: dm < 0.8 ? 'much easier than average' : dm < 0.95 ? 'easier than average' : dm <= 1.05 ? 'about average' : dm < 1.5 ? 'harder than average' : 'much harder than average' };
  const agendas: AgendaTruth[] = AGENDAS.filter((a) => {
    const st = s.player.safety.agendas[a.id];
    if (!st) return false;
    return st.status === 'active' || st.deadEndTM > 0 || st.posterior.a !== a.prior[0] || st.posterior.b !== a.prior[1] || s.player.safety.findings.some((f) => f.agenda === a.id);
  }).map((a) => {
    const b = posteriorBand(s.player.safety.agendas[a.id]);
    const truth = r3(clamp(fin(s.hidden.agendaEfficacy[a.id]), 0, 1));
    return { id: a.id, name: AGENDA_BY_ID[a.id].name, lo: r3(b.lo), hi: r3(b.hi), truth, outside: truth < b.lo || truth > b.hi };
  });
  const present = [...new Set(s.player.models.bases.flatMap((b) => b.uModes))];

  return {
    id: e.id, title: e.title, text: e.text, day, date: fmtDate(dateOf(s, day)),
    future, epilogue, steps: steps.slice(0, 3),
    world: {
      power: powerTiles,
      economy: { gdpChange: r3(gdpChange), gdpSince: shortMonth(s, 0), gdpIndex, unemployment: r3(s.world.unemployment.US), unemploymentChange: r3(s.world.unemployment.US - (S.unemp[0] ?? s.world.unemployment.US)), gini: r3(m.gini), giniChange: r3(m.gini - ECON.gini0) },
      geopolitics: { rung: s.china.rung, rungName: RUNG_NAMES[s.china.rung] ?? '', taiwan, taiwanLabel: TAIWAN_LABEL[taiwan], treaty: s.gov.treaty, treatyLabel: TREATY_LABEL[s.gov.treaty], chinaLagDays: Math.round(chinaVsUs) },
      company: {
        name: s.player.name, valuation: r3(valuation), multiple: r3(valuation / Math.max(1e-9, v0)), valuationHistory: sampleIdx(S.valuation.length).map((i) => r3(S.valuation[i])),
        status, approval: r3(s.pub.approval), approvalChange: r3(s.pub.approval - (S.approval[0] ?? s.pub.approval)),
        playerShare: r3(own.founder), largestOutside: { name: outside.name, share: outside.share }, ownership: holders,
      },
    },
    scores, race,
    hidden: {
      ...(why ? { why } : {}),
      labs: hiddenLabs, facts, difficulty, agendas,
      agendaRule: 'Agendas with a team on them now, or whose results moved your estimate from its prior, or that hit a dead end (the save keeps no funding history).',
      failureModes: { count: present.length, names: present.map((u) => UMODE_BY_ID[u]?.name ?? u) },
    },
  };
}

