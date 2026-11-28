// RD-L04 targeted check: ONE milestone predicate (departments/workfit.ts milestonesOf) decides every lab's milestones.
// The player's versions read it on their builds, rivals and China on a reference-profile build of their model; day-0
// records come from it; a rival meeting SAR by work-type fit is credited whatever its display level, and one at a high
// display level that fails the criterion (AI dearer than engineers) is not. Fresh games, synthetic G.
// Cost: 4 newGame + a few 1000 predicate calls, no sim days (≈ 5 CPU-s). Tier: quick, full.
// Run alone: npx tsx scripts/v2/milestonepred.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { makeCtx } from '../../src/engine/v2/core/loop';
import { labMilestones, milestonesOf, referenceProfileModel, versionMilestones, flopPerToken } from '../../src/engine/v2/departments/workfit';
import { levelOfG, milestonesSystem, otherLabMilestones } from '../../src/engine/v2/models/capability';
import { npcServeFpt } from '../../src/engine/v2/npc/model';
import type { GameStateV2, MilestoneIdx, RivalLab } from '../../src/engine/v2/types';
import { HERE, check, finish } from './lib';

const fresh = (): GameStateV2 => newGame(defaultSetupV2({ seed: 11, tutorial: false }));
const eq = (a: boolean[], b: boolean[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const fmt = (m: boolean[]) => m.map((x) => (x ? 1 : 0)).join('');
// RD-X03: a rival's model carries its own reference-profile build, and otherLabMilestones reads that build when there is
// one (G is then only its summary): a synthetic G has to drop the build so the rival is "known by G alone" (the fallback,
// referenceProfileModel(G)). Setting only G left the predicate on the day-0 build (the milestones read 1000000 at any G).
const setG = (r: RivalLab, g: number) => { r.internal = { ...r.internal, G: g, build: undefined }; r.publicModel = undefined; };

// 1. Day 0: every lab's record equals the predicate's ordered first crossings at day 0.
{
  const s = fresh();
  const ordered = (m: boolean[]) => { const out: number[] = []; for (let i = 0; i < 7; i++) { if (m[i]) out.push(i); else if (i >= 3) break; } return out; };
  const rec = (d: Partial<Record<MilestoneIdx, number>>) => Object.keys(d).map(Number).sort((a, b) => a - b);
  const p = ordered(labMilestones(s));
  check(JSON.stringify(rec(s.player.milestoneDays)) === JSON.stringify(p) && Object.values(s.player.milestoneDays).every((d) => d === 0), 'day 0: player record = predicate', `rec ${JSON.stringify(s.player.milestoneDays)} pred ${fmt(labMilestones(s))}`);
  for (const r of [...s.rivals, s.china.lab]) {
    const m = otherLabMilestones(s, r);
    check(JSON.stringify(rec(r.core.milestoneDays)) === JSON.stringify(ordered(m)), `day 0: ${r.core.id} record = predicate`, `λ ${levelOfG(s.hidden.timeline, r.internal.G).toFixed(2)} pred ${fmt(m)}`);
  }
}

// 2. Same predicate: a player version with the reference profile and a rival with the same G and the same FLOP per
//    token get identical milestones, across a sweep of G; the reference-profile build = the no-build (general G) read.
{
  const s = fresh();
  const r = s.rivals.find((x) => x.core.status === 'active')!;
  const v0 = s.player.models.versions[0];
  const fpt = flopPerToken(s, v0);
  let same = true; let fallback = true; let detail = '';
  const g0 = v0.G;
  for (let dg = -1; dg <= 8; dg += 0.25) {
    const G = g0 + dg;
    setG(r, G);
    r.internal.fpt = fpt;
    const rv = otherLabMilestones(s, r);
    const pv = versionMilestones(s, { ...v0, G, build: referenceProfileModel(G).build, fpt });
    if (!eq(rv, pv)) { same = false; detail = `G ${G.toFixed(2)} rival ${fmt(rv)} player ${fmt(pv)}`; }
    if (!eq(milestonesOf(s, referenceProfileModel(G), fpt), milestonesOf(s, { G }, fpt))) fallback = false;
  }
  check(same, 'player version (reference profile) and rival at same G and fpt: same milestones', detail);
  check(fallback, 'reference-profile build reads as general G in every domain');
  check(eq(labMilestones(s), s.player.models.versions.filter((v) => v.status !== 'retired' && v.status !== 'rolledBack').map((v) => versionMilestones(s, v)).reduce((a, m) => a.map((x, i) => x || m[i]), [false, false, false, false, false, false, false])), 'labMilestones = OR of versionMilestones');
}

// 3. A rival meeting SAR by work-type fit is credited regardless of display level; a rival above SAR's display level
//    whose AI costs more than engineers (huge FLOP per token) is not.
{
  const s = fresh();
  const w = s.hidden.timeline;
  const [r, q] = s.rivals.filter((x) => x.core.status === 'active');
  // Smallest G (0.01 OOM grid) where the predicate gives SAR.
  let gSar = NaN;
  const gr0 = r.internal.G; // setG moves internal.G, so the bound must not read it (that made this loop endless when SAR is never reached)
  for (let G = gr0; G < gr0 + 15; G += 0.01) { setG(r, G); if (otherLabMilestones(s, r)[4]) { gSar = G; break; } }
  check(Number.isFinite(gSar), 'rival reaches SAR by the predicate', `G ${gSar.toFixed(2)} λ ${levelOfG(w, gSar).toFixed(2)}`);
  setG(r, gSar);
  r.core.milestoneDays = {};
  // q: display level 13 (past the SAR knot 12) but AI dearer than the best engineers per work-hour.
  const gq0 = q.internal.G;
  for (let G = gq0; G < gq0 + 15 && levelOfG(w, G) < 13; G += 0.01) setG(q, G);
  q.internal.params = 1e17; q.internal.fpt = 1e18;
  q.core.milestoneDays = {};
  s.time.day = 10;
  milestonesSystem.run(s, makeCtx(s));
  check(r.core.milestoneDays[4] === 10 && r.core.milestoneDays[3] === 10, 'rival credited SAR on its fit (SC then SAR, same day)', `λ ${levelOfG(w, r.internal.G).toFixed(2)} rec ${JSON.stringify(r.core.milestoneDays)}`);
  check(q.core.milestoneDays[3] === undefined && q.core.milestoneDays[4] === undefined, 'rival at display level 13 failing the cost criterion: no SC / SAR', `λ ${levelOfG(w, q.internal.G).toFixed(2)} fpt ${npcServeFpt(s, q.internal).toExponential(1)} rec ${JSON.stringify(q.core.milestoneDays)}`);
}

// 4. Player notice and China's flags come from the predicate: the player's version pushed to SC by G gets the record,
//    the seenMilestone flag and an "evaluations show" notice.
{
  const s = fresh();
  const v = s.player.models.versions.find((x) => x.status !== 'retired' && x.status !== 'rolledBack')!;
  const g = v.G;
  let G = g;
  for (; G < g + 15; G += 0.01) if (versionMilestones(s, { ...v, G, build: v.build ? { ...v.build, gPre: v.build.gPre + (G - g) } : undefined }).slice(0, 4)[3]) break;
  if (v.build) v.build.gPre += G - g;
  v.G = G;
  s.time.day = 20;
  const ctx = makeCtx(s);
  const logs: string[] = [];
  const log0 = ctx.log;
  ctx.log = (k, msg, p) => { logs.push(msg); return log0(k, msg, p); };
  milestonesSystem.run(s, ctx);
  check(s.player.milestoneDays[3] === 20 && s.flags.seenMilestone3 === 20, 'player SC recorded by the predicate, flag set', `G ${G.toFixed(2)} λ ${levelOfG(s.hidden.timeline, G).toFixed(2)}`);
  check(logs.some((m) => m.startsWith('Superhuman coder: your evaluations show the criterion met')), 'player notice in player language', logs.find((m) => m.includes('Superhuman coder')) ?? 'none');
}

// 5. Sources: no level-knot milestone path left.
{
  const src = (p: string) => readFileSync(join(HERE, '../../src/engine/v2', p), 'utf8');
  const cap = src('models/capability.ts');
  const ms = cap.slice(cap.indexOf('export function otherLabMilestones'), cap.indexOf('export const milestonesSystem') + 1500);
  check(!/LEVEL_KNOTS|measuredL|levelOf/.test(ms), 'milestones system: no level thresholds');
  check(!/initialMilestones|LEVEL_KNOTS/.test(src('core/init.ts')), 'init: day-0 milestones by the predicate');
  check(/milestoneDays\[6\]/.test(src('endings/endings.ts')), 'endings read the recorded (predicate) milestones');
}
finish('milestonepred');
