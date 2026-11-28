// Events, endings and China-lead acceptance tests (V2-SPEC §8.3: E1–E5; §7.1 T3, T4). Owner: events.
//   E1  catalog shape: the kept events, ≥ 2 choices each, titles, text length (preview truth is lint-tradeoffs.ts)
//   E2  no event text references an inactive lab (fuzz 1,000 seeds)
//   E3  rival comparisons use the PUBLIC models (player vs NPC, both stepped; F7)
//   E4  pacing limits hold
//   E5  every EndingId is reachable (forced states; the statistical 2,000-run coverage is in scripts/v2/bots.ts)
//   T3  China lead 150–200 d until a theft (RefBot play; the mean; the 10th–90th percentile of the daily lead vs
//       75–275 d is INFO since M5), then ≈ 60 d; R10 gap formula within ±2 months at the start
//   T4  rival gaps at start are 3–9 months (same lead metric as WS1's calib: trueLeadDays)
// E2, E4, E5, T3 and the T4 spread go through the simulation cache (simcache.ts). `--smoke` (test:quick): E2 on 60
// seeds, E4 on 2 seeds, T3 on 2 seeds, the T4 spread on 20; checks that every seed must pass stay
// binding on the subset, means and counts print SMOKE.
import { setControl } from '../../src/engine/v2/safety/safeguards';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TRAIT_IDS, TRAIT_START } from '../../src/data/v2/traits';
import { leadDays } from '../../src/engine/v2/actors/intel';
import { deactivateRival } from '../../src/engine/v2/actors/rivals';
import { request } from '../../src/engine/v2/events/request';
import { blockingCommitments, measuredDomain, signCommitment } from '../../src/engine/v2/actors/commitments';
import { refreshFramework, worldHighL } from '../../src/engine/v2/safety/framework';
import { FRAMEWORK_CRITICAL_L } from '../../src/data/v2/framework';
import { deployGate } from '../../src/engine/v2/models/deployments';
import { CHINAGOV } from '../../src/engine/v2/world/chinagov';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { makeCtx, tick } from '../../src/engine/v2/core/loop';
import { EVENTS } from '../../src/engine/v2/core/registry';
import { seedStreams } from '../../src/engine/v2/core/rng';
import { deserialize } from '../../src/engine/v2/core/save';
import { DIRECTOR } from '../../src/engine/v2/events/director';
import { bestG, internalVersion, publicG } from '../../src/engine/v2/models/labs';
import { executeTheft } from '../../src/engine/v2/security/theft';
import { footholdFromEscape } from '../../src/engine/v2/safety/footholds';
import { gOfLevel, lagDays, levelOfG } from '../../src/engine/v2/models/capability';
/** Lead of lab a over lab b in days (the lead clock; RD-L03 deleted the engine alias). */
const leadBetween = (s: GameStateV2, a: LabId, b: LabId): number => lagDays(s, b, a);
import { LEVEL_KNOTS } from '../../src/data/v2/calibration';
import { PRE_GAME_G_PER_YEAR } from '../../src/data/v2/runDesign';
import type { EndingId, EngineSystem, GameStateV2, LabId, MilestoneIdx, TraitVector } from '../../src/engine/v2/types';
import { refBot } from '../../src/engine/v2/bots/ref';
import { engine } from '../../src/engine/v2/index';
import { fileURLToPath } from 'node:url';
import { FIXTURE_DIR, SMOKE, check, finish, smokeCheck } from './lib';
import { cached } from './simcache';

const ME = [fileURLToPath(import.meta.url)];

const fixtures = [0, 400, 900].map((d) => readFileSync(join(FIXTURE_DIR, `day${d}.json`), 'utf8'));
const load = (i: number) => deserialize(fixtures[i]);

// ───────── E1: catalog shape ─────────
{
  const ids = new Set(EVENTS.map((e) => e.id));
  // 2026-11-15 cut: events are rare decisions the regular mechanisms do not model (15 kept, 22 removed). FIN3b
  // (FINANCE-V3 §10) dropped E37 Board revolt: the ouster vote is on the Board card, the critics' seat is an action.
  // W1c (outside-world spec §8.2) cut E16 Talent raid and E29 Evaluator contradicts; W1d cut E12 Clearances, E20
  // Oversight committee, E22 DPA consolidation and E23 China deal; W5 rebuilt E12, E20 and E22 (events/catalog/gov.ts).
  const want = ['E01', 'E10', 'E12', 'E19', 'E20', 'E22', 'E23', 'E25', 'E32'];
  check(want.every((id) => ids.has(id)) && ids.size === want.length, `E1 catalog: exactly the ${want.length} kept events`, `${EVENTS.length} events`);
  const states = [0, 1, 2].map(load);
  let bad: string[] = [];
  for (const e of EVENTS) {
    if (e.choices.length < 2) bad.push(`${e.id}: < 2 choices`);
    if (e.defaultChoice < 0 || e.defaultChoice >= e.choices.length) bad.push(`${e.id}: bad default`);
    if (e.title.split(/\s+/).length > 3) bad.push(`${e.id}: title > 3 words`);
    e.choices.forEach((c, i) => {
      if (c.label.split(/\s+/).length > 3) bad.push(`${e.id}.${i}: label > 3 words`);
    });
  }
  check(bad.length === 0, 'E1 every event has ≥ 2 choices, a valid default, short title and labels', bad.slice(0, 5).join('; '));
  bad = [];
  for (const s of states) for (const e of EVENTS) {
    const d = e.when(s);
    const t = e.text(s, d || { lab: 'r0', versionId: 'V0', theirL: 9, ourL: 8, severity: 3, lead: 90, cid: 'C1', mult: 1, site: 'S1', score: 60, trait: 'SCHEME', est: 40 });
    if (t.length > 220) bad.push(`${e.id} ${t.length} chars`);
    // The player's own model names (default theme "Agent-n", MODEL-NAMING) are state, not event wording: strip them first.
    const own = s.player.models.versions.reduce((x, v) => x.split(v.name).join('a model'), t);
    if (/AI 2027|Agent-\d|OpenBrain'?s? (Agent)|20(25|26|27|28) (Jan|Feb|Mar|Apr)/.test(own)) bad.push(`${e.id}: canon in text`);
  }
  check(bad.length === 0, 'E1 event texts ≤ 220 chars, no AI 2027 canon', bad.slice(0, 5).join('; '));
}

// ───────── E2: never name inactive labs (fuzz 1,000 seeds) ─────────
{
  const N = SMOKE ? 60 : 1000;
  const { violations, checkedTexts } = cached('directorEndings-e2', { N }, ME, () => {
  const violations: string[] = [];
  let checkedTexts = 0;
  for (let seed = 1; seed <= N; seed++) {
    const s = load(seed % 3);
    s.rng = seedStreams(seed);
    const ctx = makeCtx(s);
    // Deactivate a pseudo-random non-empty subset of rivals (merged into the player, a rival, or bankrupt).
    const mask = 1 + (seed % ((1 << s.rivals.length) - 1));
    const gone: string[] = [];
    s.rivals.forEach((r, i) => {
      if (!(mask & (1 << i))) return;
      const into = s.rivals.find((_x, j) => j !== i && !(mask & (1 << j)))?.core.id ?? 'player';
      gone.push(r.core.name);
      // Leave a stale request and a stale pending decision about the lab behind before it goes.
      request(s, 'E32', { lab: r.core.id });
      s.events.pending.push({ id: 'E32', instance: `E32@stale${i}`, day: s.time.day, deadline: s.time.day + 30, data: { lab: r.core.id }, crisis: false });
      deactivateRival(s, ctx, r.core.id, seed % 2 ? 'merged' : 'bankrupt', seed % 2 ? into : undefined);
      // Simulate a stale pending decision added after deactivation (e.g. by another workstream).
      s.events.pending.push({ id: 'E32', instance: `E32@late${i}`, day: s.time.day, deadline: s.time.day + 30, data: { lab: r.core.id }, crisis: false });
    });
    const named = (t: string) => gone.find((n) => t.includes(n));
    for (let d = 0; d < (seed <= 60 ? 30 : 2) && !s.ending; d++) {
      tick(s);
      for (const p of s.events.pending) {
        const e = EVENTS.find((x) => x.id === p.id);
        if (!e) continue;
        checkedTexts++;
        const n = named(e.text(s, p.data));
        if (n) violations.push(`seed ${seed} pending ${p.id} names ${n}`);
      }
    }
    for (const e of EVENTS) {
      const data = e.when(s);
      if (!data) continue;
      checkedTexts++;
      const n = named(e.text(s, data));
      if (n) violations.push(`seed ${seed} ${e.id} names ${n}`);
    }
    if (s.events.requests.some((r) => typeof r.data.lab === 'string' && s.rivals.find((x) => x.core.id === r.data.lab)?.core.status !== 'active')) violations.push(`seed ${seed}: stale request survives`);
  }
  return { violations, checkedTexts };
  });
  check(violations.length === 0, `E2 no event text references an inactive lab (${N} seeds, ${checkedTexts} texts)`, violations.slice(0, 3).join('; '));
}

// ───────── E3: comparisons use the PUBLIC models (F7) ─────────
{
  const s = load(1);
  const r = s.rivals.find((x) => x.core.status === 'active' && x.publicModel)!;
  const v = internalVersion(s)!;
  // Add an internal-only version far ahead of every public deployment: the lead does not move (nothing is released).
  const boost = 0.5 * PRE_GAME_G_PER_YEAR;
  const v2 = { ...JSON.parse(JSON.stringify(v)), id: 'VX', name: 'Atlas-X', status: 'ready', G: v.G + boost, Lg: levelOfG(s.hidden.timeline, v.G + boost) };
  // The estimate reads the player's best MEASURED version (UB-2): the new internal version has been through the lab's own evals.
  v2.evals.measuredL = Math.max(v.evals.measuredL ?? 0, levelOfG(s.hidden.timeline, v.G + boost));
  const truthBefore = leadBetween(s, 'player', r.core.id);
  const estBefore = leadDays(s, r.core.id).est;
  s.player.models.versions.push(v2);
  const truthAfter = leadBetween(s, 'player', r.core.id);
  check(bestG(s, 'player') === v2.G, 'E3 bestG(player) is the best INTERNAL version (hidden: the engine logic keeps it)');
  check(truthAfter === truthBefore && leadDays(s, r.core.id).est === estBefore, 'E3 an unreleased version moves no lead readout', `${truthBefore.toFixed(0)} → ${truthAfter.toFixed(0)} d`);
  // A rival whose public model has stood 0.3 yr of pace above the player's leads; releasing the player's far-ahead version
  // (swap it into its product) turns the lead around.
  {
    const t = load(1);
    const rr = t.rivals.find((x) => x.core.id === r.core.id)!;
    const w = t.hidden.timeline;
    const base = publicG(t, 'player');
    t.series.GP = JSON.parse(JSON.stringify(t.series.G)); // a fixture saved before F7 has no public series
    t.series.GP[rr.core.id] = t.series.GP.player.map((x) => x + 0.3 * PRE_GAME_G_PER_YEAR); // the lead clock reads series.GP
    rr.publicModel = { ...rr.publicModel!, G: base + 0.3 * PRE_GAME_G_PER_YEAR, Lg: levelOfG(w, base + 0.3 * PRE_GAME_G_PER_YEAR) };
    const behind = leadBetween(t, 'player', rr.core.id);
    const vy = { ...JSON.parse(JSON.stringify(internalVersion(t)!)), id: 'VY', name: 'Atlas-Y', status: 'deployed', G: base + 0.5 * PRE_GAME_G_PER_YEAR, Lg: levelOfG(w, base + 0.5 * PRE_GAME_G_PER_YEAR) };
    t.player.models.versions.push(vy);
    const d = t.player.deployments.find((x) => x.channel !== 'internal' && x.status !== 'withdrawn')!;
    d.versionId = 'VY';
    const ahead = leadBetween(t, 'player', rr.core.id);
    check(behind < -30 && ahead > 0, 'E3 true lead follows the public models (releasing a version turns a rival lead around)', `${behind.toFixed(0)} → ${ahead.toFixed(0)} d`);
  }
}

// ───────── E4: pacing limits ─────────
{
  const E4_SEEDS = SMOKE ? 2 : 12;
  const { bad, crisesSeen } = cached('directorEndings-e4', { seeds: E4_SEEDS, days: 300 }, ME, () => {
  const bad: string[] = [];
  let crisesSeen = 0;
  {
    const lim = DIRECTOR;
    const st = 'director';
    for (let seed = 1; seed <= E4_SEEDS; seed++) {
      const s = newGame(defaultSetupV2({ seed, tutorial: false }));
      const spam: EngineSystem = { id: 'spam', owner: 'WS4', cadence: 'daily', order: 139, system: 'core', run: (x) => {
        // Requests obey cooldowns, so clear the record each day to keep the pressure on the pacing limits.
        for (const id of ['E10', 'E19', 'E25']) {
          delete x.events.fired[id];
          request(x, id, { n: x.time.day });
        }
      } };
      let prev = new Set<string>();
      let lastEnd = -1e9;
      const probe: EngineSystem = { id: 'probe', owner: 'WS4', cadence: 'daily', order: 141, system: 'core', run: (x) => {
        const cur = new Set(x.events.pending.filter((p) => p.crisis).map((p) => p.instance));
        if (cur.size > lim.maxCrises) bad.push(`${st}/${seed} day ${x.time.day}: ${cur.size} crises`);
        const ended = [...prev].some((i) => !cur.has(i));
        if (ended) lastEnd = x.time.day;
        for (const i of cur) if (!prev.has(i) && x.time.day < lastEnd + lim.quietDays) bad.push(`${st}/${seed} day ${x.time.day}: crisis in quiet period (ended ${lastEnd})`);
        for (const i of cur) if (!prev.has(i)) crisesSeen++;
        prev = cur;
      } };
      for (let d = 0; d < 300 && !s.ending; d++) tick(s, { extraSystems: [spam, probe] });
    }
  }
  return { bad, crisesSeen };
  });
  if (SMOKE) {
    check(bad.length === 0, 'E4 pacing limits hold under crisis spam (SMOKE seeds: every crisis checked)', bad.slice(0, 3).join('; '));
    smokeCheck(crisesSeen > 50, 'E4 crisis spam fires > 50 crises', `${crisesSeen}`);
  } else check(bad.length === 0 && crisesSeen > 50, `E4 pacing limits hold (max concurrent crises, quiet period) under crisis spam (${crisesSeen} crises fired)`, bad.slice(0, 3).join('; '));
}

// ───────── E5: every EndingId reachable (forced states) ─────────
{
  const W = (seed: number) => newGame(defaultSetupV2({ seed, alignment: 'medium', tutorial: false }));
  const BAD: TraitVector = Object.fromEntries(TRAIT_IDS.map((t) => [t, t === 'HONEST' || t === 'CORRIG' ? 0 : 1])) as TraitVector;
  // 'war' is a quarterly roll at China tension 4 (world/chinagov.ts); scripts/v2/worldChina.ts covers it.
  const setups: Partial<Record<EndingId, (s: GameStateV2) => void>> = {
    insolvent: (s) => void (s.player.finance.state = 'insolvent'),
    ousted: (s) => void (s.flags['ws3.ousterDay'] = s.time.day), // WS3's board ouster vote
    // C3: the ouster under a controller whose in-house lab leads you (Azimuth with 60% of the voting stock, its lab 90
    // days ahead on your estimate).
    absorbed: (s) => {
      s.player.charter = { ...s.player.charter, missionBody: false, profitCap: false };
      s.player.finance.ownership = { founder: 0.2, mission: 0, fin: 0.2, public: 0, strat: { Azimuth: 0.6 } };
      s.player.finance.stratVoting = { Azimuth: true };
      const lab = s.rivals.find((r) => r.core.status === 'active' && r.npc.kind === 'bigtech');
      if (lab) lab.npc.d -= -90 - leadDays(s, lab.core.id).est;
      s.flags['ws3.ousterDay'] = s.time.day;
    },
    nationalized: (s) => void (s.usgov.consolidated = 'nationalized'),
    catastropheBio: (s) => misuse(s, 'bio'),
    catastropheCyber: (s) => misuse(s, 'cyber'),
    rogue: (s) => {
      atLevel(s, 4);
      s.player.security.loose = { day: s.time.day - 100, versionId: 'V0', mis: 1 };
      // Model v3 E9: the copy is a foothold that has acquired compute (4 copies) and acts once its exposure is above θ_w.
      footholdFromEscape(s, s.time.day - 100, internalVersion(s)!, 1).size = 4;
    },
    rivalAligned: (s) => rivalAsi(s, s.rivals[0].core.id, false),
    rivalTakeover: (s) => rivalAsi(s, s.rivals[0].core.id, true),
    chinaAligned: (s) => rivalAsi(s, 'china', false),
    chinaTakeover: (s) => rivalAsi(s, 'china', true),
    asiAligned: (s) => playerAsi(s, false, false),
    asiTakeover: (s) => playerAsi(s, true, false),
    asiContested: (s) => playerAsi(s, true, true),
    overtaken: (s) => void (s.rivals[0].core.milestoneDays[5] = s.time.day),
    retired: (s) => void (s.endingProgress.retired = true),
  };
  function misuse(s: GameStateV2, kind: 'bio' | 'cyber') {
    const v = internalVersion(s)!;
    v.flags[kind === 'bio' ? 'bioUplift' : 'cyberOffense'] = true;
    for (const t of Object.values(s.world.techs)) t.exposure = 1;
    s.player.safety.incidents.push({ id: 'I1', day: s.time.day + 1, labId: 'player', versionId: v.id, trueSource: 'misuse', apparent: 'misuse', severity: 5, exposure: 'public', status: 'open', responses: [] });
  }
  function atLevel(s: GameStateV2, idx: number) {
    const v = internalVersion(s)!;
    v.G = gOfLevel(s.hidden.timeline, LEVEL_KNOTS[idx]) + 0.01;
    v.Lg = levelOfG(s.hidden.timeline, v.G);
    // RD-L04 / L05: milestones are the work-fit predicate on the version's build (not its G) and the rogue gate reads
    // the SAR record, so force the record (milestones 0..idx met today), as the ASI setups force milestoneDays[6].
    for (let i = 0; i <= idx; i++) s.player.milestoneDays[i as MilestoneIdx] ??= s.time.day;
  }
  /** An NPC lab at ASI: its hidden m (npc/risk.ts) is what the endings read (aligned 0, misaligned 1). */
  function rivalAsi(s: GameStateV2, id: string, bad: boolean) {
    const r = id === 'china' ? s.china.lab : s.rivals.find((x) => x.core.id === id)!;
    r.core.milestoneDays[6] = 0;
    r.npc.m = bad ? 1 : 0;
  }
  function playerAsi(s: GameStateV2, bad: boolean, contain: boolean) {
    const v = internalVersion(s)!;
    v.traitsTrue = bad ? { ...BAD } : { ...TRAIT_START };
    s.player.milestoneDays[6] = 0;
    if (contain) {
      // §5.2 Cont = Contain(2000) + 0.2·[F32 verified gatekeeper] + 0.1·[AG10 e > 0.6 adopted].
      for (const d of s.player.deployments) if (d.channel === 'internal') setControl(d, true); for (const a of Object.values(s.player.agents)) a.control = true;
      s.flags['ws2.gatekeeper'] = s.time.day;
      const gate = s.player.safety.techniques['T-GATE'];
      if (gate) Object.assign(gate, { unlocked: true, active: true, falseValidated: false });
      s.player.safety.agendas.AG10.status = 'active';
      s.hidden.agendaEfficacy.AG10 = 0.9;
    }
  }
  const missing = cached('directorEndings-e5', { endings: Object.keys(setups), maxSeed: 300, days: 3 }, ME, () => {
  const missing: string[] = [];
  for (const [id, setup] of Object.entries(setups) as [EndingId, (s: GameStateV2) => void][]) {
    let hit = false;
    for (let seed = 1; seed <= 300 && !hit; seed++) {
      const s = W(seed);
      setup(s);
      for (let d = 0; d < 3 && !s.ending; d++) tick(s);
      hit = s.ending?.id === id;
    }
    if (!hit) missing.push(id);
  }
  return missing;
  });
  check(missing.length === 0, `E5 every EndingId is reachable (${Object.keys(setups).length} endings, forced states)`, missing.join(', '));
}

// ───────── T3: China lead ─────────
// China's lab runs on the NPC compute rule (W6) and its lead is read from the public view (W2), so the old
// "mean 150–200 d against the player" and "≈ 60 d behind after a theft" no longer describe it. The new rule's shape
// (NPC-LABS §13), on real RefBot play with no theft, sampled daily over days 30–540: China's lab stays behind the US
// frontier (the best of the player and the active rivals), by roughly its start lag (mean within the cast span, 90–270 d); a theft closes
// the gap to the player (it never widens it) and leaves China behind the stolen model.
{
  const T3_SEEDS = SMOKE ? 2 : 8;
  const { leads0, pre, post } = cached('directorEndings-t3', { seeds: T3_SEEDS, days: 540 }, ME, () => {
  const leads0: number[] = [];
  const pre: number[] = [];
  const post: number[] = [];
  const minRung = CHINAGOV.theftRung;
  CHINAGOV.theftRung = 99; // no theft: the lead must stay in band
  for (let seed = 1; seed <= T3_SEEDS; seed++) {
    const s = newGame(defaultSetupV2({ seed, alignment: 'medium', tutorial: false }));
    tick(s, { skip: ['endings'] });
    leads0.push(leadBetween(s, 'player', 'china'));
    const usFrontier = (): LabId => [...s.rivals.filter((r) => r.core.status === 'active').map((r) => r.core.id), 'player' as LabId].reduce((a, b) => (bestG(s, b) > bestG(s, a) ? b : a));
    while (s.time.day < 540 && !s.ending) {
      refBot.act(s, engine);
      tick(s, { skip: ['endings'] });
      if (s.time.day >= 30) pre.push(leadBetween(s, usFrontier(), 'china'));
    }
    const before = leadBetween(s, 'player', 'china');
    executeTheft(s, makeCtx(s), 'player');
    tick(s, { skip: ['endings'] });
    post.push(leadBetween(s, 'player', 'china') - before);
  }
  CHINAGOV.theftRung = minRung;
  return { leads0, pre, post };
  });
  const mean = pre.reduce((a, x) => a + x, 0) / Math.max(1, pre.length);
  check(leads0.every((x) => x >= 150 && x <= 200), 'T3 China lead at start 150–200 d', leads0.map((x) => x.toFixed(0)).join(', '));
  const sorted = [...pre].sort((a, b) => a - b);
  const pct = (q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];
  smokeCheck(mean >= 90 && mean <= 270, `T3 China's lab trails the US frontier by 90–270 d (the cast span, 3–9 months) on average until a theft (RefBot, days 30–540 daily, ${T3_SEEDS} seeds)`, `mean ${mean.toFixed(0)} d`);
  smokeCheck(pre.filter((x) => x > 0).length / pre.length >= 0.95, "T3 China's lab stays behind the US frontier on ≥ 95% of days", `${(100 * pre.filter((x) => x > 0).length / pre.length).toFixed(1)}%`);
  // M5 (lead decision on F2): the mean is the test; the 10th–90th percentile of the daily lead is reported (INFO).
  console.log(`INFO  T3 China lead: 10th–90th percentile of the daily lead (window 75–275 d): p10 ${pct(0.1).toFixed(0)} d, p90 ${pct(0.9).toFixed(0)} d (p25 ${pct(0.25).toFixed(0)}, median ${pct(0.5).toFixed(0)}, p75 ${pct(0.75).toFixed(0)})`);
  console.log(`INFO  T3 China lead min–max (daily, days 30–540, ${T3_SEEDS} seeds): ${sorted[0].toFixed(0)}–${sorted[sorted.length - 1].toFixed(0)} d; share of days below 75 d ${(100 * pre.filter((x) => x < 75).length / pre.length).toFixed(1)}%, above 275 d ${(100 * pre.filter((x) => x > 275).length / pre.length).toFixed(1)}%`);
  check(post.every((x) => x <= 1), "T3 a theft never widens China's gap to the player (change in the lead, days)", post.map((x) => x.toFixed(0)).join(', '));
}

// ───────── T4: rival start gaps 3–9 months ─────────
// Same metric as WS1's calib T4 (trueLeadDays / 30.4): every rival of the fixture seed in 3–9 months; the spread over
// 200 seeds is printed (archetype gap ranges are WS4 data).
{
  const fx = newGame(defaultSetupV2({ seed: 2027, alignment: 'medium' }));
  const fxMonths = fx.rivals.map((r) => leadBetween(fx, 'player', r.core.id) / 30.4);
  // The cast's measured start lags (npc/CAST-2025.md §1: 2.5–9.5 months behind the public frontier, 0 for the leader) are
  // the new rule; the gap to the player is positive and inside the cast's span (NPC-LABS §13).
  check(fxMonths.every((m) => m > 0 && m <= 10), 'T4 rival gaps at start are positive and within the cast span, ≤ 10 months (fixture seed)', fxMonths.map((m) => m.toFixed(1)).join(', '));
  const T4_SEEDS = SMOKE ? 20 : 200;
  const months: number[] = cached('directorEndings-t4', { seeds: T4_SEEDS }, ME, () => {
    const months: number[] = [];
    for (let seed = 1; seed <= T4_SEEDS; seed++) {
      const s = newGame(defaultSetupV2({ seed }));
      for (const r of s.rivals) months.push(leadBetween(s, 'player', r.core.id) / 30.4);
    }
    return months;
  });
  months.sort((x, y) => x - y);
  const inBand = months.filter((m) => m >= 3 && m <= 9).length / months.length;
  console.log(`      T4 over ${T4_SEEDS} seeds (classic): min ${months[0].toFixed(2)}, median ${months[months.length >> 1].toFixed(2)}, max ${months[months.length - 1].toFixed(2)} months; ${(100 * inBand).toFixed(0)}% in 3–9`);
  check(months[0] > 0 && months[months.length - 1] <= 10, 'T4 every rival gap at start over the seeds is positive and ≤ 10 months', `${months[0].toFixed(2)}–${months[months.length - 1].toFixed(2)}`);
}

// ───────── C1 (R1 B1/B2): a commitment blocks only launches in its own scope, judged on the candidate ─────────
{
  const s = deserialize(fixtures[1]);
  const ctx = makeCtx(s);
  s.player.safety.framework.evalDepth = 'none';
  const v = [...s.player.models.versions].reverse().find((x) => x.variant === 'full' && (x.status === 'ready' || x.status === 'deployed'));
  check(!!v, 'C1 fixture has a deployable full version');
  if (v) {
    check(deployGate(s, v, 'api') === true, 'C1 baseline: the version can launch on the API');
    // B1: a breached whistleblower pledge binds but has nothing to do with launches.
    signCommitment(s, ctx, 'whistleblower', 'Right-to-warn whistleblower channel', 'whistleblower', {});
    s.player.security.internalReport = { day: s.time.day - 40, deadline: s.time.day - 1 };
    check(blockingCommitments(s).some((c) => c.condition.predicate === 'whistleblower'), 'C1 the whistleblower pledge binds');
    check(deployGate(s, v, 'api') === true, 'C1 (B1) an out-of-scope binding commitment does not block a launch', String(deployGate(s, v, 'api')));
    // B2: the framework judges the candidate.
    // CP3 rewrite (RD-M01 / SR-19): the measured domain level is the benchmark fit (evals.measuredDom), so set it there.
    // CP4 (CAL2 (c)): since CAL-S, Bio High is the world's median expert (6.4 on ai2027; classifiers) and Bio Critical the
    // best human (10; hardened + an external evaluation), and since RF-S13b the gate judges the candidate with the parts
    // the framework adds itself as it goes live. So: at Critical the launch is held, naming the rule and the external
    // evaluation it needs; midway between High and Critical the framework's own classifiers let it pass.
    v.evals.measuredDom = { ...(v.evals.measuredDom ?? {}), BIO: FRAMEWORK_CRITICAL_L + 0.5 };
    // RF-S2: publishing = the Safety framework commitment (its rules hold; the old noDeployAbove pledge is gone).
    signCommitment(s, ctx, 'framework', 'Published Safety framework', 'safetyFramework', {});
    const g1 = deployGate(s, v, 'api', { safeguards: 'standard' });
    check(typeof g1 === 'string' && /Safety framework \(".+"\)/.test(g1) && g1.includes('BIO') && g1.includes('external evaluation'), 'C1 (B2) the framework blocks the candidate that breaks it, naming the rule and clause (Bio Critical: an external evaluation)', String(g1));
    v.evals.measuredDom = { ...(v.evals.measuredDom ?? {}), BIO: (worldHighL(s) + FRAMEWORK_CRITICAL_L) / 2 };
    check(deployGate(s, v, 'api', { safeguards: 'standard' }) === true, 'C1 at Bio High the launch passes with the classifiers the framework adds itself (RF-S13b)', String(deployGate(s, v, 'api', { safeguards: 'standard' })));
    check(deployGate(s, v, 'internal') === true, 'C1 internal use is outside the framework scope');
    // An existing violating deployment does not block an unrelated, compliant launch.
    const dep = s.player.deployments.find((d) => d.status === 'live' && d.channel === 'api');
    if (dep) {
      dep.versionId = v.id;
      dep.safeguards = 'standard';
      refreshFramework(s);
      check(!!dep.held && dep.held.includes('BIO'), 'C1 the standing breach is held by the framework (RF-S2)', String(dep.held));
      const other = s.player.models.versions.find((x) => x.id !== v.id && x.variant === 'full' && (x.status === 'ready' || x.status === 'deployed') && measuredDomain(x, 'BIO') < 10);
      if (other) check(deployGate(s, other, 'enterprise') === true, 'C1 (B2) a standing breach no longer blocks other launches', String(deployGate(s, other, 'enterprise')));
    }
  }
}

finish('directorEndings');
