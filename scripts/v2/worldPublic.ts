// W4 test: the public (src/engine/v2/world/public.ts) on constructed cases over the fixture states, stepping the daily system
// directly.   npx tsx scripts/v2/worldPublic.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../src/engine/v2/core/save';
import { makeCtx } from '../../src/engine/v2/core/loop';
import { approvalPush, concernTarget, PUBLIC, stepPublic } from '../../src/engine/v2/world/public';
import { attention, publicMilestones } from '../../src/engine/v2/world/observe';
import { localMood } from '../../src/engine/v2/compute/sites';
import { FIXTURE_DIR, check, finish } from './lib';
import type { GameStateV2 } from '../../src/engine/v2/types';

const load = (n: string): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, n), 'utf8'));
const f2 = (x: number) => x.toFixed(2);

/** A day-0 world with no public milestone, no job loss and no incident: the frozen world. */
function frozen(): GameStateV2 {
  const s = load('day0.json');
  for (const d of s.player.deployments) d.channel = 'internal';
  for (const r of s.rivals) for (const i of Object.keys(r.core.milestoneDays)) delete r.core.milestoneDays[i as unknown as 0];
  for (const i of Object.keys(s.china.lab.core.milestoneDays)) delete s.china.lab.core.milestoneDays[i as unknown as 0];
  s.player.safety.incidents = [];
  s.public = { concern: 50, approval: 0 };
  s.world.fx.uHist = [s.world.unemployment.US];
  return s;
}
const step = (s: GameStateV2, days: number) => { for (let i = 0; i < days; i++) { s.time.day++; stepPublic(s, makeCtx(s)); } };

// S3 frozen world: concern stays at 50 for 2 years.
{
  const s = frozen();
  check(Math.abs(concernTarget(s) - 50) < 1e-9, 'frozen: target is the base 50', f2(concernTarget(s)));
  let lo = 50, hi = 50;
  for (let i = 0; i < 730; i++) { step(s, 1); lo = Math.min(lo, s.public.concern); hi = Math.max(hi, s.public.concern); }
  check(lo >= 49.5 && hi <= 50.5, 'S3 frozen world: concern stays 50 ± 0.5 for 2 years', `${f2(lo)}..${f2(hi)}`);
  check(Math.abs(s.public.approval) < 0.5, 'frozen: approval stays near 0', f2(s.public.approval));
}

// A public milestone 1 (reliable agent) leaves concern at its base: only milestone 2 and up move it.
{
  const s = frozen();
  s.rivals[0].core.milestoneDays[1 as 0] = -1000;
  s.rivals[0].npc && (s.rivals[0].npc.phase = -500);
  check(publicMilestones(s)[1] !== undefined && Math.abs(concernTarget(s) - 50) < 1e-9, 'milestone 1 public: the target stays 50', f2(concernTarget(s)));
}

// One more public milestone: the target is 56; concern is within 1 of it after a year.
{
  const s = frozen();
  const before = Object.keys(publicMilestones(s)).filter((k) => Number(k) >= PUBLIC.milestoneFrom).length;
  const r = s.rivals[0];
  r.core.milestoneDays[PUBLIC.milestoneFrom as 0] = -1000;
  r.npc && (r.npc.phase = -500);
  const after = Object.keys(publicMilestones(s)).filter((k) => Number(k) >= PUBLIC.milestoneFrom).length;
  check(after === before + 1, 'a rival milestone 2 reached long ago is public', `${before} -> ${after}`);
  check(Math.abs(concernTarget(s) - 56) < 1e-9, 'one more public milestone: target 56', f2(concernTarget(s)));
  step(s, 30);
  check(s.public.concern > 50 && s.public.concern < 56, 'concern moves from 50 toward 56', f2(s.public.concern));
  step(s, 335);
  check(Math.abs(s.public.concern - 56) <= 1, 'within 1 of 56 after a year', f2(s.public.concern));
  check(Math.abs(s.public.approval) < 0.5 === (attention(s, 'player') < 0.1), 'approval baseline follows the attention on the lab (an unknown lab stays neutral)', f2(s.public.approval));
}

// Jobs: a 1-point 12-month unemployment rise adds 5 to the target.
{
  const s = frozen();
  const t0 = concernTarget(s);
  s.world.unemployment.US = s.world.fx.uHist[0] + 1;
  check(Math.abs(concernTarget(s) - t0 - 5) < 1e-9, 'a 1-pt unemployment rise adds +5 to the target', f2(concernTarget(s) - t0));
}

// Approval's drift baseline is scaled by the player's attention: one day's move at concern 80 = -0.4 x 30 x attention x k.
{
  for (const n of ['day0.json', 'start-spinout-day400.json']) {
    const s = load(n);
    s.public = { concern: 80, approval: 0 };
    const att = attention(s, 'player');
    s.time.day++;
    stepPublic(s, makeCtx(s));
    const k = 1 - Math.pow(0.5, 1 / PUBLIC.approvalHalfLifeDays);
    const want = -PUBLIC.concernToApproval * (s.public.concern - 50) * att * k;
    check(Math.abs(s.public.approval - want) < 1e-9, `approval baseline scales with attention (${n}, attention ${att.toFixed(2)})`, `${s.public.approval.toFixed(5)} vs ${want.toFixed(5)}`);
  }
}

// Approval pushes scale with attention: spinout day 400 (attention ~0.4) vs day 0 (attention 1).
{
  const a = load('day0.json');
  const b = load('start-spinout-day400.json');
  const att0 = attention(a, 'player');
  const att1 = attention(b, 'player');
  const push = (s: GameStateV2) => { s.public.approval = 0; approvalPush(s, makeCtx(s), -10, 'test'); return s.public.approval; };
  const p0 = push(a), p1 = push(b);
  check(Math.abs(p0 - -10 * att0) < 1e-9 && att0 === 1, 'day 0: a push of -10 lands in full (attention 1)', `${f2(p0)} (attention ${f2(att0)})`);
  check(Math.abs(p1 / p0 - att1 / att0) < 1e-9 && att1 < 0.6, 'spinout day 400: the same push is scaled by its attention', `${f2(p1)} (attention ${f2(att1)}), ratio ${f2(p1 / p0)}`);
}

// Local opposition: 45 at concern 50, 35 with the community package; rises with concern.
{
  const s = frozen();
  check(localMood(s) === 45, 'localMood is 45 at concern 50', String(localMood(s)));
  s.player.policies.communityBenefits = true;
  check(localMood(s) === 35, 'localMood is 35 with the community package', String(localMood(s)));
  s.player.policies.communityBenefits = false;
  s.public.concern = 70;
  check(localMood(s) === 45 + PUBLIC.concernToNimby * 20, 'localMood rises with concern', String(localMood(s)));
}

finish('worldPublic');
