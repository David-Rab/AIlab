// W5 test: the US government (src/engine/v2/world/usgov.ts) on constructed cases over the fixture states, stepping the
// daily step directly (no sampled games).   npx tsx scripts/v2/worldUsgov.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../src/engine/v2/core/save';
import { makeCtx } from '../../src/engine/v2/core/loop';
import { dayOfDate } from '../../src/engine/v2/core/time';
import { initialUsgov, stepUsgov, USGOV } from '../../src/engine/v2/world/usgov';
import { attention } from '../../src/engine/v2/world/observe';
import { versionById } from '../../src/engine/v2/models/labs';
import { lawIdsInForce, lawsInForce } from '../../src/data/v2/laws';
import { endingsSystem } from '../../src/engine/v2/endings/endings';
import { FIXTURE_DIR, check, finish } from './lib';
import type { GameStateV2 } from '../../src/engine/v2/types';

const load = (n: string): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, n), 'utf8'));
const step = (s: GameStateV2, days: number, each?: (s: GameStateV2) => void) => {
  for (let i = 0; i < days; i++) { s.time.day++; stepUsgov(s, makeCtx(s)); each?.(s); }
};
const asked = (s: GameStateV2, id: string) => s.events.requests.some((r) => r.id === id) || s.usgov.asked[id as 'E12'] !== undefined;
const clearMilestones = (s: GameStateV2) => {
  for (const r of [...s.rivals, s.china.lab]) for (const i of Object.keys(r.core.milestoneDays)) delete r.core.milestoneDays[i as unknown as 0];
  for (const i of Object.keys(s.player.milestoneDays)) delete s.player.milestoneDays[i as unknown as 0];
};

// S3 frozen frontier: no milestone anywhere for 2 years: stage 0, no law but the dated ones.
{
  const s = load('day0.json');
  clearMilestones(s);
  s.usgov = initialUsgov();
  step(s, 730);
  const dated = ['euGpai', 'sb53', 'sb243', 'raise'];
  const ids = lawIdsInForce(s);
  check(s.usgov.stage === 0, 'S3 frozen frontier: stage stays 0 for 2 years', String(s.usgov.stage));
  check(ids.every((x) => dated.includes(x)) && Object.keys(s.usgov.laws).length === 0, 'S3: only the dated laws are in force', ids.join(', '));
}

// S1 weak player: NPC labs show milestones 2-4, the player is invisible (no public model, no briefing).
{
  const s = load('day0.json');
  clearMilestones(s);
  s.usgov = initialUsgov();
  for (const d of s.player.deployments) d.channel = 'internal';
  s.player.policies.govBriefing = 0;
  const r = s.rivals[0];
  if (r.npc) r.npc.phase = -500;
  r.core.milestoneDays[2 as 0] = -1000;
  r.core.milestoneDays[3 as 0] = 150;
  r.core.milestoneDays[4 as 0] = 300;
  const att = attention(s, 'player');
  const t0 = s.usgov.trust;
  step(s, 720);
  const sd = s.usgov.stageDay;
  check(att < USGOV.attentionMin, 'S1: the player draws little attention', att.toFixed(2));
  check(s.usgov.stage === 3, 'S1: the stage climbs to 3 from the rivals', `stage ${s.usgov.stage}, days ${JSON.stringify(sd)}`);
  check((sd[1] ?? 0) < (sd[2] ?? 0) && (sd[2] ?? 0) < (sd[3] ?? 0), 'S1: one step at a time, in order', JSON.stringify(sd));
  check(!asked(s, 'E12') && !asked(s, 'E20'), 'S1: no clearances or oversight request reaches the player', JSON.stringify(s.events.requests.map((x) => x.id)));
  check(s.usgov.trust === t0, 'S1: trust unchanged (no briefing)', `${t0} -> ${s.usgov.trust}`);
}

// S2 leading player (day 900: the player's deployed models show milestone 2 from day 819, its internal one from day 588):
// the player's milestones drive the stage; full briefing makes the internal one count from the day reached.
{
  const run = (brief: 0 | 2) => {
    const s = load('day900.json');
    for (const r of [...s.rivals, s.china.lab]) for (const i of Object.keys(r.core.milestoneDays)) delete r.core.milestoneDays[i as unknown as 0];
    // The fixture's reference player is slower than the comment above says (milestone 1 on day 702, no milestone 2 by day 900),
    // so the case is built: the deployed version is half an OOM better (it shows milestone 2), live since day 819, and the
    // internal milestone was reached on day 588.
    for (const v of new Set(s.player.deployments.map((d) => versionById(s, d.versionId)!))) { v.G += 0.5; if (v.build) v.build.gPre += 0.5; }
    for (const d of s.player.deployments) if (d.kind !== 'internal') d.versionSince = 819;
    s.player.milestoneDays[2 as 0] = 588;
    s.usgov = initialUsgov();
    s.player.policies.govBriefing = brief;
    let first = -1;
    step(s, 120, (x) => { if (first < 0 && x.usgov.stage >= 1) first = x.time.day; });
    return { first, trust: s.usgov.trust, att: attention(s, 'player') };
  };
  const b0 = run(0), b2 = run(2);
  check(b0.first > 0 && b2.first > 0, 'S2: the player\'s milestones drive stage 1', `briefing 0: day ${b0.first}; full: day ${b2.first}`);
  check(b2.first < b0.first, 'S2: full briefing, the stage climbs sooner', `${b2.first} < ${b0.first}`);
  check(b2.trust > b0.trust, 'S2: full briefing raises trust', `${b2.trust.toFixed(2)} > ${b0.trust.toFixed(2)} (attention ${b2.att.toFixed(2)})`);
}

// S4 job losses: a 1.5-point 12-month rise passes relief, then basic income 182 days later; basic income stays after.
{
  const s = load('day0.json');
  clearMilestones(s);
  s.usgov = initialUsgov();
  const u0 = s.world.unemployment.US;
  s.world.fx.uHist = [u0];
  s.world.unemployment.US = u0 + 1.5;
  step(s, 45);
  const reliefDay = s.usgov.laws.relief;
  check(reliefDay !== undefined && s.usgov.laws.ubi === undefined, 'S4: a 1.5-pt rise passes worker relief (not yet basic income)', `relief day ${reliefDay}`);
  step(s, 190);
  check(s.usgov.laws.ubi !== undefined && s.usgov.laws.ubi - reliefDay! >= USGOV.ubiHoldDays, 'S4: basic income after 182 days of relief', `ubi day ${s.usgov.laws.ubi}`);
  s.world.unemployment.US = u0;
  step(s, 40);
  check(s.usgov.laws.relief === undefined && s.usgov.laws.ubi !== undefined, 'S4: relief ends with the rise, basic income stays', JSON.stringify(s.usgov.laws));
}

// S7 dated laws switch on their dates; the export policy follows the dated rows, then the stage rule.
{
  const s = load('day0.json');
  s.usgov = initialUsgov();
  const at = (date: string) => dayOfDate(s.time.startDate, date);
  check(!lawsInForce(s, at('2025-08-01')).euGpai && lawsInForce(s, at('2025-08-02')).euGpai, 'S7: EU AI Act from 2 Aug 2025');
  check(!lawsInForce(s, at('2025-12-31')).sb53 && lawsInForce(s, at('2026-01-01')).sb53 && lawsInForce(s, at('2026-01-01')).sb243, 'S7: SB 53 and SB 243 from 1 Jan 2026');
  check(!lawsInForce(s, at('2026-12-31')).raise && lawsInForce(s, at('2027-01-01')).raise, 'S7: RAISE from 1 Jan 2027');
  check(lawsInForce(s, at('2026-01-12')).exportPolicy === 'strict' && lawsInForce(s, at('2026-01-13')).exportPolicy === 'caseByCase', 'S7: export controls strict, case-by-case from 13 Jan 2026');
  s.time.day = at('2026-12-31');
  s.usgov.stage = 2;
  step(s, 1);
  check(lawsInForce(s).exportPolicy === 'strict', 'S7: stage 2 returns export controls to strict', lawsInForce(s).exportPolicy);
  const t = load('day0.json');
  t.usgov = initialUsgov();
  t.time.day = at('2026-12-31');
  t.usgov.thefts = [t.time.day];
  step(t, 1);
  check(lawsInForce(t).exportPolicy === 'strict' && t.usgov.stage === 0, 'S7: a detected Chinese theft makes them strict at stage 0', `${lawsInForce(t).exportPolicy}, stage ${t.usgov.stage}`);
  step(t, 300);
  check(lawsInForce(t).exportPolicy === 'strict', 'S7: still strict 300 days after the theft', lawsInForce(t).exportPolicy);
  step(t, 100);
  check(lawsInForce(t).exportPolicy === 'caseByCase' && t.usgov.laws.exportStrict === undefined, 'S7: back to case-by-case 365 days after the theft with stage below 2', lawsInForce(t).exportPolicy);
  s.usgov.stage = 1; // stage 2 held, then lost: strict goes off at once (monthly) with no theft
  step(s, 40, (x) => { x.usgov.stage = 1; });
  check(lawsInForce(s).exportPolicy === 'caseByCase', 'S7: stage falling below 2 with no recent theft returns case-by-case', lawsInForce(s).exportPolicy);
}

// Hard path: trust 15 held 90 days at stage 3 (a prominent player) -> nationalized, and the ending fires.
{
  const s = load('day900.json');
  s.usgov = initialUsgov();
  s.usgov.stage = 3;
  s.usgov.stageDay = { 1: 800, 2: 850, 3: s.time.day };
  s.usgov.asked = { E12: 800, E20: 850 };
  s.usgov.trust = 15;
  s.player.policies.govBriefing = 0;
  s.player.security.wsl = 0;
  step(s, 85);
  check(s.usgov.consolidated === 'none', 'hard path: not before 90 days of low trust', `${s.usgov.consolidated}, trust ${s.usgov.trust.toFixed(1)}`);
  step(s, 10);
  check(s.usgov.consolidated === 'nationalized' && (s.usgov.stage as number) === 4, 'hard path: trust 15 held 90 days at stage 3 -> nationalized', `${s.usgov.consolidated}, stage ${s.usgov.stage}`);
  endingsSystem.run(s, makeCtx(s));
  check(s.ending?.id === 'nationalized', 'hard path: the nationalized ending', String(s.ending?.id));
}

finish('worldUsgov');
