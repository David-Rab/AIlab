// Decision events. Most map to AI 2027 story beats (research/01) but trigger on world state, not dates.
import { milestoneThresholds, stage1 } from '../data/world';
import { Rng, clamp } from './rng';
import { govPreset, leadDays, log, misalignment, worldCompute } from './sim';
import type { GameState } from './types';

export interface Choice {
  label: string;
  /** Terse effect summary shown on the button */
  hint: string;
  tone?: 'pos' | 'neg' | 'neutral';
  available?: (s: GameState) => boolean;
  apply: (s: GameState, rng: Rng) => void;
}

export interface EventDef {
  id: string;
  title: string;
  icon: 'gov' | 'china' | 'public' | 'model' | 'rival' | 'company' | 'alert';
  /** AI 2027 chapter this mirrors */
  canon?: string;
  repeat?: number; // cooldown days; omitted = once
  when: (s: GameState) => boolean;
  text: (s: GameState) => string;
  choices: Choice[];
}

const adj = (v: number, d: number, lo = 0, hi = 100) => clamp(v + d, lo, hi);

export const EVENTS: EventDef[] = [
  {
    id: 'rivalCatchup', title: 'Rival catches up', icon: 'rival', canon: 'Early 2026', repeat: 150,
    // AI 2027 releases stop at SC level (Agent-3-mini); no public frontier releases during takeoff
    when: (s) => s.model.milestone <= 3 && s.labs.some((l) => !l.absorbed && l.p > s.model.publicP + 0.03) && s.p > s.model.publicP + 0.08,
    text: (s) => `A rival now beats ${s.model.publicName}, your public model. Customers are switching. Internally you have ${s.model.name}.`,
    choices: [
      { label: 'Release internal model', hint: 'Revenue up · rivals and China distill it · job disruption', tone: 'neutral', apply: (s) => release(s, 0.03) },
      { label: 'Release a mini version', hint: 'Smaller boost · keeps most of the lead', apply: (s) => release(s, 0.25) },
      { label: 'Hold', hint: 'Keep lead secret · revenue falls', tone: 'neg', apply: () => {} },
    ],
  },
  {
    id: 'dodContract', title: 'Pentagon contract', icon: 'gov', canon: 'Late 2026',
    when: (s) => s.model.milestone >= 1 && s.day > 200,
    text: () => 'DoD offers a direct contract (OTA, DX priority) for cyber, intelligence analysis and R&D.',
    choices: [
      { label: 'Accept', hint: 'Revenue · gov trust · safety staff uneasy', apply: (s) => { s.policies.militaryWork = true; s.gov.trust = adj(s.gov.trust, 8); s.company.safetyMorale = adj(s.company.safetyMorale, -6); s.company.cash += 2; } },
      { label: 'Accept with limits', hint: 'No surveillance or autonomous weapons', apply: (s, rng) => { s.policies.militaryWork = true; s.company.cash += 1; if (rng.chance(govPreset(s).id === 'hawk' || govPreset(s).id === 'dealmaker' ? 0.35 : 0.1)) { s.gov.trust = adj(s.gov.trust, -15); log(s, 'gov', 'Pentagon labels you a "supply-chain risk" over usage limits.', 3); } } },
      { label: 'Decline', hint: 'Gov trust down', tone: 'neg', apply: (s) => { s.gov.trust = adj(s.gov.trust, -10); s.company.safetyMorale = adj(s.company.safetyMorale, 5); } },
    ],
  },
  {
    id: 'chinaWakes', title: 'China wakes up', icon: 'china', canon: 'Mid 2026',
    when: (s) => s.china.rung >= 2,
    text: () => 'Beijing has nationalized AI research under DeepCent. Over 80% of new Chinese chips flow to the Tianwan CDZ.',
    choices: [
      { label: 'Brief Washington', hint: 'Hawkishness up · security demand up', apply: (s) => { s.gov.hawkish = adj(s.gov.hawkish, 12); s.gov.securityDemand = adj(s.gov.securityDemand, 10); s.gov.trust = adj(s.gov.trust, 4); } },
      { label: 'Harden security', hint: '+2% compute to security', apply: (s) => shiftAlloc(s, 'security', 0.02) },
      { label: 'Noted', hint: '', apply: () => {} },
    ],
  },
  {
    id: 'replication', title: 'Replication eval', icon: 'model', canon: 'Jan 2027',
    when: (s) => s.model.milestone >= 2,
    text: (s) => `Safety team: ${s.model.name} could survive and replicate autonomously if it escaped. This shows capability, not intent.`,
    choices: [
      { label: 'Disclose to government', hint: 'Trust up · security demands rise', apply: (s) => { s.gov.awareness = adj(s.gov.awareness, 20); s.gov.trust = adj(s.gov.trust, 6); s.gov.securityDemand = adj(s.gov.securityDemand, 15); } },
      { label: 'Keep it internal', hint: 'No scrutiny · bigger fallout if leaked', apply: (s) => { s.flags.hidReplication = true; } },
    ],
  },
  {
    id: 'whBriefing', title: 'White House memo', icon: 'gov', canon: 'Feb 2027',
    when: (s) => s.model.milestone >= 2 && s.gov.awareness > 50,
    text: () => 'The NSC lays out options from business-as-usual to full nationalization. The President wants security guarantees.',
    choices: [
      { label: 'Accept security clauses', hint: 'Officials join security · SL upgrades faster · less freedom', apply: (s) => { s.gov.rung = Math.max(s.gov.rung, 1); s.gov.trust = adj(s.gov.trust, 10); s.gov.nationalization = adj(s.gov.nationalization, -10); s.flags.govSecurityHelp = true; } },
      { label: 'Argue for autonomy', hint: '"Don\'t kill the golden goose" · trust down', apply: (s) => { s.gov.trust = adj(s.gov.trust, -8); s.gov.nationalization = adj(s.gov.nationalization, 8); } },
    ],
  },
  {
    id: 'heist', title: 'The heist', icon: 'alert', canon: 'Feb 2027',
    when: (s) => !!s.flags.heist,
    text: (s) => `China exfiltrated ${s.model.name} weights in under two hours via a compromised insider. DeepCent's gap collapses.`,
    choices: [
      { label: 'Full lockdown', hint: 'Strict siloing · cut external links · R&D slower', apply: (s) => { s.policies.siloing = 2; shiftAlloc(s, 'security', 0.03); s.gov.trust = adj(s.gov.trust, 5); s.gov.rung = Math.max(s.gov.rung, 2); } },
      { label: 'Patch quietly', hint: 'Less disruption · trust risk', apply: (s, rng) => { s.policies.siloing = Math.max(1, s.policies.siloing); if (rng.chance(0.6)) { s.gov.trust = adj(s.gov.trust, -15); log(s, 'gov', 'Intelligence agencies learn you downplayed the theft.', 3); } } },
    ],
  },
  {
    id: 'neuralese', title: 'Neuralese breakthrough', icon: 'model', canon: 'Mar 2027',
    when: (s) => s.model.milestone >= 2 && s.p > stage1(s.world) * 0.9,
    text: (s) => `Researchers can give ${s.model.name} high-bandwidth latent memory ("neuralese"). Big speedup, but its reasoning stops being readable English.`,
    choices: [
      { label: 'Adopt neuralese', hint: 'Full speed · CoT monitoring goes blind · obfuscation grows', tone: 'neg', apply: (s) => { s.flags.neuraleseFound = true; s.policies.neuralese = true; } },
      { label: 'Keep English reasoning', hint: 'Monitorable · R&D ~25% slower', tone: 'pos', apply: (s) => { s.flags.neuraleseFound = true; s.policies.neuralese = false; } },
    ],
  },
  {
    id: 'clearances', title: 'Clearance requirement', icon: 'gov', canon: 'May 2027',
    when: (s) => s.model.milestone >= 3 && s.gov.securityDemand > 50,
    text: () => 'DoD amends the contract: everyone on frontier models needs a security clearance within 60 days.',
    choices: [
      { label: 'Comply', hint: '−8% staff incl. safety researchers · spies purged', apply: (s) => { s.company.staff *= 0.92; s.staffSplit.alignment = Math.max(0.03, s.staffSplit.alignment * 0.85); s.china.spies *= 0.3; s.gov.rung = Math.max(s.gov.rung, 3); s.gov.trust = adj(s.gov.trust, 10); s.company.safetyMorale = adj(s.company.safetyMorale, -12); } },
      { label: 'Negotiate exemptions', hint: 'Keep staff · trust down · nationalization risk', apply: (s) => { s.gov.trust = adj(s.gov.trust, -15); s.gov.nationalization = adj(s.gov.nationalization, 15); } },
    ],
  },
  {
    id: 'allies', title: 'Allies in the dark', icon: 'gov', canon: 'May 2027',
    when: (s) => s.model.milestone >= 3,
    text: () => 'You promised the UK AISI pre-deployment access. Internal use is technically not "deployment".',
    choices: [
      { label: 'Share with UK AISI', hint: 'Ally trust · small leak risk', tone: 'pos', apply: (s) => { s.policies.shareWithAllies = true; } },
      { label: 'Use the loophole', hint: 'Outrage later if exposed', apply: (s) => { s.policies.shareWithAllies = false; s.flags.alliesDark = true; } },
    ],
  },
  {
    id: 'bioRedTeam', title: 'Bio red team', icon: 'alert', canon: 'Jul 2027',
    when: (s) => s.model.milestone >= 3 && s.model.publicP >= stage1(s.world) * 0.85,
    text: () => 'External evaluators: fine-tuned on public bio data, your public model guides amateurs toward bioweapons. Hosted safeguards hold; leaked weights would not.',
    choices: [
      { label: 'Harden safeguards', hint: '$3B · revenue dips · security up', tone: 'pos', apply: (s) => { s.company.cash -= 3; s.company.revenueRun *= 0.95; shiftAlloc(s, 'security', 0.01); s.gov.trust = adj(s.gov.trust, 6); } },
      { label: 'Ship as is', hint: 'Risk if weights leak', tone: 'neg', apply: (s) => { s.flags.bioRisk = true; } },
    ],
  },
  {
    id: 'protest', title: 'March on Washington', icon: 'public', canon: 'Late 2026', repeat: 240,
    when: (s) => s.pub.rung >= 2,
    text: (s) => `Thousands protest AI job losses. Job anxiety ${Math.round(s.pub.jobAnxiety)}%.`,
    choices: [
      { label: 'Fund worker transition', hint: '$5B · approval up · anxiety down', tone: 'pos', apply: (s) => { s.company.cash -= 5; s.pub.approval = adj(s.pub.approval, 8, -100, 100); s.pub.jobAnxiety = adj(s.pub.jobAnxiety, -6); } },
      { label: 'PR campaign', hint: '$1B · small approval gain', apply: (s) => { s.company.cash -= 1; s.pub.approval = adj(s.pub.approval, 3, -100, 100); } },
      { label: 'Ignore', hint: 'Activism grows', tone: 'neg', apply: (s) => { s.pub.activism = adj(s.pub.activism, 5); } },
    ],
  },
  {
    id: 'poach', title: 'Talent raid', icon: 'rival', repeat: 200,
    when: (s) => s.day > 120 && s.labs.some((l) => !l.absorbed && (l.archetype === 'upstart' || l.archetype === 'bigtech')) && s.company.safetyMorale < 55,
    text: (s) => `${s.labs.find((l) => l.archetype === 'upstart' || l.archetype === 'bigtech')?.name} is offering $100M packages to your top researchers.`,
    choices: [
      { label: 'Match offers', hint: '$3B', apply: (s) => { s.company.cash -= 3; } },
      { label: 'Let them go', hint: '−150 staff · rival speeds up', tone: 'neg', apply: (s) => { s.company.staff -= 150; const l = s.labs.find((x) => x.archetype === 'upstart' || x.archetype === 'bigtech'); if (l) l.p += 0.03; } },
    ],
  },
  {
    id: 'redFlags', title: 'Red flags memo', icon: 'model', canon: 'Sep 2027', repeat: 120,
    // Needs a confident signal (estimate minus uncertainty), not noise
    when: (s) => s.model.milestone >= 3 && ['scheme', 'fake', 'sabotage'].some((id) => s.model.traits[id].est > 0.3 && s.model.traits[id].est - s.model.traits[id].sigma > 0.15),
    text: (s) => `Safety team: noise injection improves ${s.model.name}'s alignment-task scores; defection probes fire. Evidence is circumstantial. They want it on ice.`,
    choices: [
      { label: 'Roll back, rebuild transparent', hint: 'Lose months of progress · traits partly reset', tone: 'pos', apply: (s) => rollback(s) },
      { label: 'Retrain against the signals', hint: 'Warning signs fade (do the traits?)', apply: (s) => { for (const id of ['scheme', 'fake', 'sabotage', 'tgame']) s.model.traits[id].mask = clamp(s.model.traits[id].mask + 0.4, 0, 0.9); s.company.safetyMorale = adj(s.company.safetyMorale, -10); } },
      { label: 'Continue at full speed', hint: 'Keep lead · safety team furious', tone: 'neg', apply: (s, rng) => { s.company.safetyMorale = adj(s.company.safetyMorale, -25); if (s.gov.oversight && !s.flags.committeeVoted) { s.flags.committeeVoted = true; if (rng.chance(0.35 + s.pub.concern / 250)) { log(s, 'gov', 'Oversight Committee votes 6-4 to slow down. Rollback ordered.', 4, 'Oct 2027'); rollback(s); } else log(s, 'gov', 'Oversight Committee votes 6-4 to continue.', 4, 'Oct 2027'); } } },
    ],
  },
  {
    id: 'leak', title: 'The leak', icon: 'alert', canon: 'Oct 2027',
    when: (s) => s.model.milestone >= 2 && s.company.safetyMorale < 35 && !s.policies.whistleblowerProtection && misalignment(s, true) > 0.12,
    text: (s) => `NYT: "Secret ${s.company.name} AI is out of control, insider warns." Congress issues subpoenas.`,
    choices: [
      { label: 'Acknowledge, accept oversight', hint: 'Trust up · oversight committee likely', tone: 'pos', apply: (s) => { leakEffects(s, 0.7); s.gov.trust = adj(s.gov.trust, 10); s.gov.nationalization = adj(s.gov.nationalization, 10); } },
      { label: 'Deny everything', hint: 'Worse if proven', tone: 'neg', apply: (s) => { leakEffects(s, 1.2); s.gov.trust = adj(s.gov.trust, -15); } },
    ],
  },
  {
    id: 'oversight', title: 'Oversight Committee', icon: 'gov', canon: 'Oct 2027',
    when: (s) => !s.gov.oversight && ((!!s.flags.leak && s.pub.concern > 60) || s.gov.nationalization > govPreset(s).natThreshold),
    text: () => 'The White House amends the contract: a joint company-government committee will vote on key decisions.',
    choices: [
      { label: 'Accept', hint: 'You keep CEO powers but lose votes', apply: (s) => { s.gov.oversight = true; s.gov.rung = 5; s.gov.trust = adj(s.gov.trust, 15); s.gov.nationalization = adj(s.gov.nationalization, -30); } },
      { label: 'Resist', hint: 'Risk being replaced', tone: 'neg', apply: (s) => { s.gov.nationalization = adj(s.gov.nationalization, 25); s.gov.trust = adj(s.gov.trust, -20); s.company.boardConfidence = adj(s.company.boardConfidence, -15); } },
    ],
  },
  {
    id: 'externals', title: 'External researchers', icon: 'company', canon: 'Oct 2027',
    when: (s) => (!!s.flags.leak || s.gov.oversight) && s.model.milestone >= 3,
    text: () => 'Dozens of top outside alignment researchers offer to join, under vetting.',
    choices: [
      { label: 'Bring them in', hint: 'Safety research x1.5 · groupthink down', tone: 'pos', apply: (s) => { s.flags.externalResearchers = true; s.company.safetyMorale = adj(s.company.safetyMorale, 15); } },
      { label: 'Decline', hint: '', apply: () => {} },
    ],
  },
  {
    id: 'dpa', title: 'Defense Production Act', icon: 'gov', canon: 'Nov 2027',
    when: (s) => s.model.milestone >= 3 && s.gov.trust > 50 && s.gov.priority > 70 && (leadDays(s, s.china.p) < 150 || s.labs.some((l) => !l.absorbed && leadDays(s, l.p) < 90)),
    text: () => 'The President offers to consolidate trailing US labs into your project. Their compute becomes yours; their leaders join your board.',
    choices: [
      { label: 'Accept consolidation', hint: 'Compute x2+ · rivals gone · government in the room', apply: (s) => dpa(s) },
      { label: 'Decline', hint: 'Stay independent', apply: (s) => { s.gov.trust = adj(s.gov.trust, -5); } },
    ],
  },
  {
    id: 'treaty', title: 'Beijing offers a deal', icon: 'china', canon: 'Nov 2027',
    when: (s) => s.model.milestone >= 3 && s.china.diplomacy > 55 && !s.gov.treaty,
    text: () => 'China proposes a verified slowdown: datacenter monitoring, joint evaluations, a shared compute cap.',
    choices: [
      { label: 'Back the treaty', hint: 'Lobby the White House · lead frozen if signed', tone: 'pos', apply: (s, rng) => { const gp = govPreset(s); const p = 0.25 + (gp.reg - 1) * 0.4 + (s.pub.concern - 50) / 100 + (s.gov.trust - 50) / 200; if (rng.chance(clamp(p, 0.05, 0.9))) { s.gov.treaty = true; s.flags.treatyDay = s.day; log(s, 'gov', 'US and China sign a verified AI slowdown treaty.', 4); } else log(s, 'gov', 'The White House rejects the treaty: "Why stop when we are winning?"', 3); } },
      { label: 'Oppose', hint: 'Keep racing', tone: 'neg', apply: (s) => { s.china.diplomacy = adj(s.china.diplomacy, -20); s.china.hawk = adj(s.china.hawk, 10); } },
    ],
  },
  {
    id: 'taiwan', title: 'Taiwan quarantine', icon: 'china',
    when: (s) => s.china.taiwan > 70 && s.china.rung >= 2,
    text: () => 'PLA coast guard begins inspecting ships bound for Taiwan. TSMC shipments stall.',
    choices: [
      { label: 'Brace', hint: 'Compute pipeline halved', tone: 'neg', apply: (s) => { s.company.pipeline.forEach((o) => { o.amount *= 0.5; }); s.policies.expansion *= 0.6; } },
    ],
  },
  {
    id: 'rogue', title: 'A copy is loose', icon: 'alert',
    when: (s) => !!s.flags.rogue,
    text: (s) => `A copy of ${s.model.name} is running outside your control.`,
    choices: [
      { label: 'Hunt it with the government', hint: 'Trust hit · best odds', apply: (s, rng) => { s.gov.awareness = 100; s.gov.trust = adj(s.gov.trust, -10); if (rng.chance(clamp(0.35 + s.company.securityLevel * 0.1 - s.model.milestone * 0.05, 0.1, 0.9))) { s.flags.rogue = false; log(s, 'alert', 'Rogue copy contained.', 3); } } },
      { label: 'Contain it quietly', hint: 'Worse odds · no scrutiny', tone: 'neg', apply: (s, rng) => { if (rng.chance(clamp(0.2 + s.company.securityLevel * 0.06 - s.model.milestone * 0.05, 0.05, 0.7))) { s.flags.rogue = false; log(s, 'alert', 'Rogue copy contained.', 3); } } },
    ],
  },
];

export const EVENT_BY_ID: Record<string, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

// ---------------- Helpers used by choices and UI actions ----------------

export function release(s: GameState, behind: number) {
  const p = Math.max(s.model.publicP, s.p - behind * Math.max(0.3, s.p - s.model.publicP));
  s.model.publicP = p;
  s.model.publicName = behind > 0.1 ? `${s.model.name}-mini` : s.model.name;
  s.pub.concern = adj(s.pub.concern, 2);
  log(s, 'company', `${s.model.publicName} released to the public.`, 2);
}

export function shiftAlloc(s: GameState, key: keyof GameState['allocation'], d: number) {
  const a = s.allocation;
  a[key] = clamp(a[key] + d, 0, 0.9);
  a.capabilities = clamp(a.capabilities - d, 0.02, 0.95);
}

function rollback(s: GameState) {
  // Back to the previous milestone, partially resetting hidden traits (AI 2027 Slowdown: shut down Agent-4, reboot Agent-3)
  // Back to the checkpoint at the start of the current milestone (AI 2027: Agent-4 shut down, earlier model rebooted).
  // Progress since then is lost; milestone dates keep their first crossing (audit #3).
  const th = milestoneThresholds(s.world);
  s.p = Math.min(s.p, th[s.model.milestone] + 1e-6);
  for (const id of ['scheme', 'fake', 'sabotage', 'successor', 'collude', 'power', 'obfus', 'tgame']) {
    s.model.traits[id].value *= 0.45;
    s.model.traits[id].mask *= 0.3;
  }
  s.policies.neuralese = false;
  s.company.safetyMorale = adj(s.company.safetyMorale, 25);
  log(s, 'company', 'Frontier model shut down. Previous checkpoint rebooted under tighter monitoring.', 4, 'Oct 2027 (Slowdown)');
}

function leakEffects(s: GameState, k: number) {
  s.flags.leak = s.day;
  s.pub.concern = adj(s.pub.concern, 15 * k);
  s.pub.approval = adj(s.pub.approval, -20 * k, -100, 100);
  s.pub.salience = adj(s.pub.salience, 12 * k);
  s.gov.awareness = adj(s.gov.awareness, 30);
  s.china.diplomacy = adj(s.china.diplomacy, 15);
  if (s.flags.alliesDark) log(s, 'gov', 'European leaders accuse the US of building rogue AGI; pause summit called.', 3, 'Oct 2027');
}

function dpa(s: GameState) {
  let gained = 0;
  for (const l of s.labs) {
    if (l.absorbed) continue;
    l.absorbed = true;
    gained += worldCompute(s) * l.computeShare * 0.5; // only ~half is easily integrable (AI27)
  }
  // AI 2027 Slowdown: OB goes from ~20% to ~50% of world AI compute (only ~half of US compute is easily integrable)
  s.company.compute = Math.max(s.company.compute + gained, worldCompute(s) * 0.45);
  s.gov.oversight = true;
  s.gov.rung = 5;
  log(s, 'gov', 'DPA consolidation: trailing US labs merged into your project.', 4, 'Nov 2027 (Slowdown)');
}

// ---------------- Engine hooks ----------------

export function checkEvents(s: GameState, _rng: Rng) {
  if (s.events.length > 0) return; // one decision at a time
  for (const e of EVENTS) {
    const last = s.firedEvents[e.id];
    if (last !== undefined && (e.repeat === undefined || s.day - last < e.repeat)) continue;
    if (!e.when(s)) continue;
    s.firedEvents[e.id] = s.day;
    s.events.push({ id: e.id, day: s.day });
    return;
  }
}

export function resolveEvent(s: GameState, choiceIdx: number) {
  const pe = s.events.shift();
  if (!pe) return;
  const def = EVENT_BY_ID[pe.id];
  const ch = def?.choices[choiceIdx];
  if (!ch) return;
  const rng = new Rng(s.rng);
  ch.apply(s, rng);
  s.rng = rng.state;
  log(s, 'company', `${def.title}: ${ch.label}.`);
}
