// WS4 acceptance tests (V2-SPEC §8.3: E1–E5; §7.1 T3, T4). Owner: WS4.
//   E1  every event has ≥ 2 choices passing the trade-off lint (plus catalog shape: ids, titles, text length)
//   E2  no event text references an inactive lab (fuzz 1,000 seeds)
//   E3  rival comparisons use the player's INTERNAL frontier
//   E4  storyteller limits hold
//   E5  every EndingId is reachable (forced states; the statistical 2,000-run coverage is in scripts/v2/bots.ts)
//   T3  China lead 150–200 d until a theft (RefBot play), then ≈ 60 d; R10 gap formula within ±2 months at the start
//   T4  rival gaps at start are 3–9 months (same lead metric as WS1's calib: trueLeadDays)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RIVAL_NAMES_V2 } from '../../src/data/v2/names';
import { TRAIT_IDS, TRAIT_START } from '../../src/data/v2/traits';
import { chinaGapFormulaMonths } from '../../src/engine/v2/actors/china';
import { updateIntel, leadDays } from '../../src/engine/v2/actors/intel';
import { deactivateRival, leadBetween } from '../../src/engine/v2/actors/rivals';
import { request, ws4 } from '../../src/engine/v2/actors/state';
import { blockingCommitments, measuredDomain, signCommitment } from '../../src/engine/v2/actors/commitments';
import { deployGate } from '../../src/engine/v2/models/deployments';
import { WS4_TUNING } from '../../src/engine/v2/actors/tuning';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { makeCtx, tick } from '../../src/engine/v2/core/loop';
import { ACTIONS, EVENTS } from '../../src/engine/v2/core/registry';
import { seedStreams } from '../../src/engine/v2/core/rng';
import { deserialize } from '../../src/engine/v2/core/save';
import { STORYTELLERS } from '../../src/engine/v2/events/director';
import { bestPm, internalVersion } from '../../src/engine/v2/models/labs';
import { executeTheft } from '../../src/engine/v2/security/theft';
import { levelOf, thresholds } from '../../src/engine/v2/world/calibration';
import type { CostLine, EndingId, EngineSystem, GameStateV2, StorytellerId, TraitVector } from '../../src/engine/v2/types';
import { refBot } from '../../src/engine/v2/bots/ref';
import { engine } from '../../src/engine/v2/index';
import { FIXTURE_DIR, check, finish } from './lib';

const fixtures = [0, 400, 900].map((d) => readFileSync(join(FIXTURE_DIR, `day${d}.json`), 'utf8'));
const load = (i: number) => deserialize(fixtures[i]);

// ───────── E1: catalog shape + trade-off lint on every choice ─────────
{
  const ids = new Set(EVENTS.map((e) => e.id));
  // 2026-11-15 cut: events are rare decisions the regular mechanisms do not model (15 kept, 22 removed).
  const want = ['E01', 'E10', 'E12', 'E16', 'E17', 'E19', 'E20', 'E22', 'E23', 'E25', 'E27', 'E29', 'E30', 'E32', 'E37'];
  check(want.every((id) => ids.has(id)) && ids.size === want.length, 'E1 catalog: exactly the 15 kept events', `${EVENTS.length} events`);
  const okLint = (p: { costs: CostLine[]; gains: CostLine[] }) => {
    const g = new Set(p.gains.map((x) => x.currency));
    return p.costs.some((c) => !g.has(c.currency));
  };
  const states = [0, 1, 2].map(load);
  let bad: string[] = [];
  for (const e of EVENTS) {
    if (e.choices.length < 2) bad.push(`${e.id}: < 2 choices`);
    if (e.defaultChoice < 0 || e.defaultChoice >= e.choices.length) bad.push(`${e.id}: bad default`);
    if (e.title.split(/\s+/).length > 3) bad.push(`${e.id}: title > 3 words`);
    e.choices.forEach((c, i) => {
      if (c.label.split(/\s+/).length > 3) bad.push(`${e.id}.${i}: label > 3 words`);
      for (const s of states) if (!okLint(c.preview(s))) bad.push(`${e.id}.${i} lint @${s.time.day}`);
    });
  }
  check(bad.length === 0, 'E1 every event has ≥ 2 choices passing the trade-off lint', bad.slice(0, 5).join('; '));
  bad = [];
  for (const s of states) for (const e of EVENTS) {
    const d = e.when(s);
    const t = e.text(s, d || { lab: 'r0', versionId: 'V0', theirL: 9, ourL: 8, severity: 3, lead: 90, cid: 'C1', mult: 1, site: 'S1', score: 60, trait: 'SCHEME', est: 40 });
    if (t.length > 220) bad.push(`${e.id} ${t.length} chars`);
    if (/AI 2027|Agent-\d|OpenBrain'?s? (Agent)|20(25|26|27|28) (Jan|Feb|Mar|Apr)/.test(t)) bad.push(`${e.id}: canon in text`);
  }
  check(bad.length === 0, 'E1 event texts ≤ 220 chars, no AI 2027 canon', bad.slice(0, 5).join('; '));
  bad = [];
  for (const a of ACTIONS) for (const s of states) if (!okLint(a.preview(s, {}))) bad.push(`${a.id}@${s.time.day}`);
  check(bad.length === 0, `E1 all ${ACTIONS.length} actions pass the trade-off lint`, bad.join(', '));
}

// ───────── E2: never name inactive labs (fuzz 1,000 seeds) ─────────
{
  const N = 1000;
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
      s.events.pending.push({ id: 'E16', instance: `E16@stale${i}`, day: s.time.day, deadline: s.time.day + 30, data: { lab: r.core.id }, crisis: false });
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
    if (ws4(s).requests.some((r) => typeof r.data.lab === 'string' && s.rivals.find((x) => x.core.id === r.data.lab)?.core.status !== 'active')) violations.push(`seed ${seed}: stale request survives`);
  }
  check(violations.length === 0, `E2 no event text references an inactive lab (${N} seeds, ${checkedTexts} texts)`, violations.slice(0, 3).join('; '));
  check(RIVAL_NAMES_V2.length >= 4, 'E2 rival names available');
}

// ───────── E3: comparisons use the player's INTERNAL frontier ─────────
{
  const s = load(1);
  const ctx = makeCtx(s);
  const r = s.rivals.find((x) => x.core.status === 'active')!;
  const v = internalVersion(s)!;
  // Add an internal-only version far ahead of every public deployment.
  const boost = 0.5;
  const v2 = { ...JSON.parse(JSON.stringify(v)), id: 'VX', name: 'Atlas-X', status: 'ready', pm: v.pm + boost, Lg: levelOf(s.hidden.timeline, v.pm + boost) };
  const truthBefore = leadBetween(s, 'player', r.core.id);
  for (let i = 0; i < 12; i++) updateIntel(s, ctx, r);
  const estBefore = leadDays(s, r.core.id).est;
  s.player.models.versions.push(v2);
  const truthAfter = leadBetween(s, 'player', r.core.id);
  for (let i = 0; i < 12; i++) updateIntel(s, ctx, r);
  const estAfter = leadDays(s, r.core.id).est;
  check(bestPm(s, 'player') === v2.pm, 'E3 bestPm(player) is the best INTERNAL version (not the deployed one)');
  // [M2 test fix] The true lead is WS1's time-lag (how long ago the leader stood where the follower stands now, from
  // the weekly history of internal frontiers): an instant jump of the LEADER does not move it (truthAfter =
  // truthBefore here, by definition), so "> 50 d" was a check of the old gap/rate metric. What must hold is that the
  // INTERNAL frontier decides the comparison: a rival that has stood 0.5 L above the player throughout leads; an
  // internal-only player version above it (nothing deployed changes) turns the lead around.
  {
    const t = load(1);
    const rr = t.rivals.find((x) => x.core.id === r.core.id)!;
    const w = t.hidden.timeline;
    const base = bestPm(t, 'player');
    t.series.L[rr.core.id] = t.series.L.player.map((x) => x + 0.5);
    rr.internal = { ...rr.internal, pm: base + 0.3, Lg: levelOf(w, base + 0.3) };
    rr.publicModel = undefined;
    const behind = leadBetween(t, 'player', rr.core.id);
    const deployed = JSON.stringify(t.player.deployments);
    t.player.models.versions.push({ ...JSON.parse(JSON.stringify(internalVersion(t)!)), id: 'VY', name: 'Atlas-Y', status: 'ready', pm: base + 0.5, Lg: levelOf(w, base + 0.5) });
    const ahead = leadBetween(t, 'player', rr.core.id);
    check(behind < -30 && ahead > 0 && JSON.stringify(t.player.deployments) === deployed, 'E3 true lead follows the internal frontier (an internal-only version turns a rival lead around)', `${behind.toFixed(0)} → ${ahead.toFixed(0)} d; a leader's instant jump alone ${truthBefore.toFixed(0)} → ${truthAfter.toFixed(0)} d (time-lag metric)`);
  }
  check(estAfter - estBefore > 0.5 * (truthAfter - truthBefore), 'E3 intel estimate tracks the internal frontier', `${estBefore} → ${estAfter} d (truth +${(truthAfter - truthBefore).toFixed(0)})`);
}

// ───────── E4: storyteller limits ─────────
{
  const bad: string[] = [];
  let crisesSeen = 0;
  for (const st of ['measured', 'rising', 'chaotic'] as StorytellerId[]) {
    const lim = STORYTELLERS[st];
    for (let seed = 1; seed <= 12; seed++) {
      const s = newGame(defaultSetupV2({ seed, storyteller: st, tutorial: false }));
      const spam: EngineSystem = { id: 'spam', owner: 'WS4', cadence: 'daily', order: 139, run: (x) => {
        // Requests obey cooldowns, so clear the record each day to keep the pressure on the storyteller limits.
        for (const id of ['E10', 'E19', 'E20', 'E25']) {
          delete x.events.fired[id];
          request(x, id, { n: x.time.day });
        }
      } };
      let prev = new Set<string>();
      let lastEnd = -1e9;
      const probe: EngineSystem = { id: 'probe', owner: 'WS4', cadence: 'daily', order: 141, run: (x) => {
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
  check(bad.length === 0 && crisesSeen > 50, `E4 storyteller limits hold (max concurrent crises, quiet period) under crisis spam (${crisesSeen} crises fired)`, bad.slice(0, 3).join('; '));
}

// ───────── E5: every EndingId reachable (forced states) ─────────
{
  const W = (seed: number) => newGame(defaultSetupV2({ seed, alignment: 'medium', tutorial: false }));
  const BAD: TraitVector = Object.fromEntries(TRAIT_IDS.map((t) => [t, t === 'HONEST' || t === 'CORRIG' ? 0 : 1])) as TraitVector;
  const setups: Record<EndingId, (s: GameStateV2) => void> = {
    insolvent: (s) => void (s.player.finance.state = 'insolvent'),
    acquired: (s) => void (ws4(s).soldControl = true),
    ousted: (s) => void (s.flags['ws3.ousterDay'] = s.time.day), // WS3's board ouster roll
    nationalized: (s) => void (ws4(s).nationalizedHard = true),
    catastropheBio: (s) => misuse(s, 'bio'),
    catastropheCyber: (s) => misuse(s, 'cyber'),
    war: (s) => {
      s.china.rung = 6;
      s.time.day = 91; // tick → day 92 = 1 Oct (quarterly)
    },
    rogue: (s) => {
      atLevel(s, 4);
      ws4(s).loose = { day: s.time.day - 100, versionId: 'V0', mis: 1 };
    },
    rivalAligned: (s) => rivalAsi(s, 'r0', false),
    rivalTakeover: (s) => rivalAsi(s, 'r0', true),
    chinaAligned: (s) => rivalAsi(s, 'china', false),
    chinaTakeover: (s) => rivalAsi(s, 'china', true),
    asiAligned: (s) => playerAsi(s, false, false),
    asiTakeover: (s) => playerAsi(s, true, false),
    asiContested: (s) => playerAsi(s, true, true),
    overtaken: (s) => void (s.rivals[0].core.milestoneDays[5] = s.time.day),
    retired: (s) => void (ws4(s).retired = true),
  };
  function misuse(s: GameStateV2, kind: 'bio' | 'cyber') {
    const v = internalVersion(s)!;
    v.flags[kind === 'bio' ? 'bioUplift' : 'cyberOffense'] = true;
    for (const t of Object.values(s.world.techs)) t.exposure = 1;
    s.player.safety.incidents.push({ id: 'I1', day: s.time.day + 1, labId: 'player', versionId: v.id, trueSource: 'misuse', apparent: 'misuse', severity: 5, exposure: 'public', status: 'open', responses: [] });
  }
  function atLevel(s: GameStateV2, idx: number) {
    const v = internalVersion(s)!;
    v.pm = thresholds(s.hidden.timeline)[idx] + 0.01;
    v.Lg = levelOf(s.hidden.timeline, v.pm);
    s.player.pa = Math.max(s.player.pa, v.pm);
  }
  function rivalAsi(s: GameStateV2, id: string, bad: boolean) {
    const r = id === 'china' ? s.china.lab : s.rivals.find((x) => x.core.id === id)!;
    r.core.milestoneDays[6] = 0;
    r.internal.traitsTrue = bad ? { ...BAD } : { ...TRAIT_START };
  }
  function playerAsi(s: GameStateV2, bad: boolean, contain: boolean) {
    const v = internalVersion(s)!;
    v.traitsTrue = bad ? { ...BAD } : { ...TRAIT_START };
    s.player.milestoneDays[6] = 0;
    if (contain) {
      // §5.2 Cont = Contain(2000) + 0.2·[F32 verified gatekeeper] + 0.1·[AG10 e > 0.6 adopted].
      for (const d of s.player.deployments) if (d.channel === 'internal') d.controlLayer = true;
      s.flags['ws2.gatekeeper'] = s.time.day;
      const gate = s.player.safety.techniques['T-GATE'];
      if (gate) Object.assign(gate, { unlocked: true, active: true, falseValidated: false });
      s.player.safety.agendas.AG10.status = 'active';
      s.hidden.agendaEfficacy.AG10 = 0.9;
    }
  }
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
  check(missing.length === 0, `E5 every EndingId is reachable (${Object.keys(setups).length} endings, forced states)`, missing.join(', '));
}

// ───────── T3: China lead ─────────
// Same metric as WS1's calib T3 (leadBetween vs the player = WS1 trueLeadDays) on real RefBot play with no theft:
// the mean over the pre-SC year is 150–200 d and every sample stays within one release interval (75–275 d); a theft
// then puts China ≈ 60 d behind; the R10 gap formula matches the simulated start lead within ±2 months.
{
  const leads0: number[] = [];
  const formulaGap: number[] = [];
  const pre: number[] = [];
  const post: number[] = [];
  const minRung = WS4_TUNING.theftMinRung;
  WS4_TUNING.theftMinRung = 99; // no theft: the lead must stay in band
  for (let seed = 1; seed <= 8; seed++) {
    const s = newGame(defaultSetupV2({ seed, alignment: 'medium', tutorial: false }));
    tick(s, { skip: ['endings'] });
    leads0.push(leadBetween(s, 'player', 'china'));
    formulaGap.push(chinaGapFormulaMonths(s) - (leadBetween(s, 'player', 'china') / 365) * 12);
    while (s.time.day < 540 && !s.ending) {
      refBot.act(s, engine);
      tick(s, { skip: ['endings'] });
      if (s.time.day % 30 === 0) pre.push(leadBetween(s, 'player', 'china'));
    }
    executeTheft(s, makeCtx(s), 'player');
    tick(s, { skip: ['endings'] });
    post.push(leadBetween(s, 'player', 'china'));
  }
  WS4_TUNING.theftMinRung = minRung;
  const mean = pre.reduce((a, x) => a + x, 0) / Math.max(1, pre.length);
  check(leads0.every((x) => x >= 150 && x <= 200), 'T3 China lead at start 150–200 d', leads0.map((x) => x.toFixed(0)).join(', '));
  check(mean >= 150 && mean <= 200, 'T3 China mean lead 150–200 d until a theft (RefBot, days 30–540, 8 seeds)', `mean ${mean.toFixed(0)} d`);
  check(pre.every((x) => x >= 75 && x <= 275), 'T3 China lead stays within 75–275 d (release-interval band)', `${Math.min(...pre).toFixed(0)}–${Math.max(...pre).toFixed(0)}`);
  check(post.every((x) => x >= 40 && x <= 80), 'T3 after a theft China is ≈ 60 d behind', post.map((x) => x.toFixed(0)).join(', '));
  check(formulaGap.every((x) => Math.abs(x) <= 2), 'T3 R10 gap formula within ±2 months of the simulated start lead', formulaGap.map((x) => x.toFixed(2)).join(', '));
}

// ───────── T4: rival start gaps 3–9 months ─────────
// Same metric as WS1's calib T4 (trueLeadDays / 30.4): every rival of the fixture seed in 3–9 months; the spread over
// 200 seeds is printed (archetype gap ranges are WS4 data).
{
  const fx = newGame(defaultSetupV2({ seed: 2027, alignment: 'medium' }));
  const fxMonths = fx.rivals.map((r) => leadBetween(fx, 'player', r.core.id) / 30.4);
  check(fxMonths.every((m) => m >= 3 - 1e-9 && m <= 9 + 1e-9), 'T4 rival gaps at start are 3–9 months (fixture seed)', fxMonths.map((m) => m.toFixed(1)).join(', '));
  const months: number[] = [];
  for (let seed = 1; seed <= 200; seed++) {
    const s = newGame(defaultSetupV2({ seed }));
    for (const r of s.rivals) months.push(leadBetween(s, 'player', r.core.id) / 30.4);
  }
  months.sort((x, y) => x - y);
  const inBand = months.filter((m) => m >= 3 && m <= 9).length / months.length;
  console.log(`      T4 over 200 seeds (classic): min ${months[0].toFixed(2)}, median ${months[months.length >> 1].toFixed(2)}, max ${months[months.length - 1].toFixed(2)} months; ${(100 * inBand).toFixed(0)}% in 3–9`);
}

// ───────── C1 (R1 B1/B2): a commitment blocks only launches in its own scope, judged on the candidate ─────────
{
  const s = deserialize(fixtures[1]);
  const ctx = makeCtx(s);
  s.player.safety.evalGate = 'none';
  const v = [...s.player.models.versions].reverse().find((x) => x.variant === 'full' && (x.status === 'ready' || x.status === 'deployed'));
  check(!!v, 'C1 fixture has a deployable full version');
  if (v) {
    check(deployGate(s, v, 'api') === true, 'C1 baseline: the version can launch on the API');
    // B1: a breached whistleblower pledge binds (E30) but has nothing to do with launches.
    signCommitment(s, ctx, 'whistleblower', 'Right-to-warn whistleblower channel', 'whistleblower', {}, [], { trust: 1, credibility: 1 });
    ws4(s).internalReport = { day: s.time.day - 40, deadline: s.time.day - 1 };
    check(blockingCommitments(s).some((c) => c.condition.predicate === 'whistleblower'), 'C1 the whistleblower pledge binds');
    check(deployGate(s, v, 'api') === true, 'C1 (B1) an out-of-scope binding commitment does not block a launch', String(deployGate(s, v, 'api')));
    // B2: the framework judges the candidate. Make the version measure BIO ≥ 10.
    const bio = measuredDomain(v, 'BIO');
    v.domains.BIO += 10.5 - bio;
    signCommitment(s, ctx, 'framework', 'Frontier safety framework: no BIO ≥ 10 deployment without classifiers', 'noDeployAbove', { domain: 'BIO', level: 10, mitigation: 'classifiers' }, [], { trust: 1, credibility: 1 });
    const g1 = deployGate(s, v, 'api', { safeguards: 'standard' });
    check(typeof g1 === 'string' && g1.includes('Frontier safety framework') && g1.includes('classifier'), 'C1 (B2) the framework blocks the candidate that breaks it, naming the commitment and clause', String(g1));
    check(deployGate(s, v, 'api', { safeguards: 'classifiers' }) === true, 'C1 the same launch with classifiers passes');
    check(deployGate(s, v, 'internal') === true, 'C1 internal use is outside the framework scope');
    // An existing violating deployment does not block an unrelated, compliant launch.
    const dep = s.player.deployments.find((d) => d.status === 'live' && d.channel === 'api');
    if (dep) {
      dep.versionId = v.id;
      dep.safeguards = 'standard';
      check(blockingCommitments(s).some((c) => c.condition.predicate === 'noDeployAbove'), 'C1 the standing breach binds (E30 shows it)');
      const other = s.player.models.versions.find((x) => x.id !== v.id && x.variant === 'full' && (x.status === 'ready' || x.status === 'deployed') && measuredDomain(x, 'BIO') < 10);
      if (other) check(deployGate(s, other, 'enterprise') === true, 'C1 (B2) a standing breach no longer blocks other launches', String(deployGate(s, other, 'enterprise')));
    }
  }
}

finish('ws4');
