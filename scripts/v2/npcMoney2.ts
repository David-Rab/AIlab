// N8b test: NPC money is display (design/npc/NPC-LABS.md "NPC money is simpler"). Direct calls and a few ticks only.
// Run: npx tsx scripts/v2/npcMoney2.ts
import { newGame, defaultSetupV2 } from '../../src/engine/v2/core/init';
import { makeCtx, tick } from '../../src/engine/v2/core/loop';
import { rivalFinanceQ } from '../../src/engine/v2/actors/rivals';
import { bustTarget, rivalMoneyQ } from '../../src/engine/v2/finance/rivalFinance';
import { cPlanQ, npcTarget } from '../../src/engine/v2/npc/lab';
import { RIVAL_GROWTH } from '../../src/engine/v2/compute/market';
import { readFileSync, readdirSync } from 'fs';

let fails = 0;
const check = (ok: boolean, msg: string, detail = '') => { console.log(`${ok ? '  ok ' : 'FAIL '} ${msg}${detail ? `  (${detail})` : ''}`); if (!ok) fails++; };
const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) <= e * Math.max(1, Math.abs(b));
const mk = () => newGame(defaultSetupV2({ world: 'tl-central', seed: 11, tutorial: false, start: 'challenger' }));
const pending = (s: ReturnType<typeof mk>, id: string) => s.market.ws3.labOrders.filter((o) => o.lab === id).reduce((t, o) => t + o.qty - o.delivered, 0);

// 1. The plan: start compute x 2.25 a year for every lab, the same rate.
let s = mk();
check(s.rivals.length > 0, 'cast present', String(s.rivals.length));
check(s.rivals.every((r) => near(cPlanQ(s, r, 4) / cPlanQ(s, r, 0), RIVAL_GROWTH) && near(cPlanQ(s, r, 0), r.npc!.c0)), 'plan grows 2.25x a year from start compute, every lab');

// 2. Cash never limits orders: broke labs order the same as rich ones.
s = mk();
for (const r of s.rivals) r.finance.cash = -500;
s.market.ws3.labOrders = [];
rivalFinanceQ(s, makeCtx(s));
check(s.rivals.every((r) => near(pending(s, r.core.id), cPlanQ(s, r, 1) - r.core.computeOnline)), 'broke labs order the full step to next quarter\'s plan');
check(s.rivals.every((r) => !r.finance.distress), 'negative cash puts no lab in distress');

// 3. Supply shortfall: the lag target rises; orders top back up; nothing is double-ordered.
s = mk();
const r = s.rivals[0];
s.market.ws3.labOrders = [];
const plan1 = cPlanQ(s, r, 1);
const t0 = npcTarget(s, r);
r.core.computeOnline = r.npc!.c0 * 0.5; // supply fell short
const t1 = npcTarget(s, r);
check(t1.short > t0.short && t1.dStar > t0.dStar, 'a shortfall raises the lag target', `d* ${t0.dStar.toFixed(1)} -> ${t1.dStar.toFixed(1)}`);
rivalFinanceQ(s, makeCtx(s));
check(near(pending(s, r.core.id), plan1 - r.core.computeOnline), 'order covers the whole gap to plan');
const o = s.market.ws3.labOrders.find((x) => x.lab === r.core.id)!;
const half = (o.qty - o.delivered) / 2; o.delivered += half; r.core.computeOnline += half; // half delivered
const before = pending(s, r.core.id);
rivalFinanceQ(s, makeCtx(s));
check(near(pending(s, r.core.id), before) && s.market.ws3.labOrders.filter((x) => x.lab === r.core.id).every((x) => x.qty - x.delivered >= 0), 'order on the books is netted: no double ordering');
// the late quarter's tick moves the plan up a step; supply returns (all pending delivered): the next order is just the new step
for (const x of s.market.ws3.labOrders.filter((y) => y.lab === r.core.id)) { r.core.computeOnline += x.qty - x.delivered; x.delivered = x.qty; }
s.market.ws3.labOrders = s.market.ws3.labOrders.filter((x) => x.lab !== r.core.id);
rivalFinanceQ(s, makeCtx(s));
check(near(pending(s, r.core.id), Math.max(0, cPlanQ(s, r, 1) - r.core.computeOnline)), 'back at plan, the next order is the plan step only');

// 4. Failure only through the bust.
s = mk();
for (const x of s.rivals) x.finance.cash = -1e3;
for (let i = 0; i < 40; i++) tick(s);
check(s.rivals.every((x) => !x.finance.distress && x.core.status === 'active'), '40 days with no cash anywhere and no bust: nobody in distress');
const tgt = bustTarget(s)!;
check(!!tgt, 'a bust target exists (a private lab)', tgt?.core.id);
s.capital.busted = { day: s.time.day, recoverDay: s.time.day + 365, rival: tgt.core.id };
const others = s.rivals.filter((x) => x !== tgt);
rivalMoneyQ(s, makeCtx(s), tgt);
for (const x of others) rivalMoneyQ(s, makeCtx(s), x);
check(tgt.finance.distress && s.events.requests.some((q) => q.id === 'E32' && q.data.lab === tgt.core.id), 'the bust pushes the most over-committed private lab into distress and an E32 offer');
check(others.every((x) => !x.finance.distress), 'no other lab is touched');
s.time.day += 91; rivalMoneyQ(s, makeCtx(s), tgt);
check(tgt.core.status !== 'active', 'a quarter later it exits (license-and-hire or bankruptcy)', tgt.core.status);

// 5. No LEADER_ID in finance/ and compute/.
const dirs = ['src/engine/v2/finance', 'src/engine/v2/compute'];
const hits = dirs.flatMap((d) => readdirSync(d).filter((f) => f.endsWith('.ts') && /LEADER_ID/.test(readFileSync(`${d}/${f}`, 'utf8'))));
check(hits.length === 0, 'no LEADER_ID in finance/ or compute/', hits.join(','));

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
