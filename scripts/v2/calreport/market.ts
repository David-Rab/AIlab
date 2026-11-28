// Calibration targets: market (the sourced start numbers and fixed-capability decline of the serving / consumer / sector market).
// Moved from serving.ts (test audit CRB, design/TESTING.md §0): C1, A7, A8, C5 and A3's bands. The mechanism halves of
// those checks (reach and paid share move toward their targets, identities, multi-homing shape, the exact decomposition of
// the decline) stay in serving.ts. Cost: one fresh game (day 0, +3 days, +1 day) and the day-0/400/900 fixtures: a few CPU-s.
// No seeds: every row reads seed 2027, tl-central (CALREPORT_SEEDS does not apply).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TOKENS, CONSUMER_MKT } from '../../../src/data/v2/serving';
import { SECTORS } from '../../../src/data/v2/sectors';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { tick } from '../../../src/engine/v2/core/loop';
import { deserialize } from '../../../src/engine/v2/core/save';
import { decimalYear } from '../../../src/engine/v2/core/time';
import { workFit } from '../../../src/engine/v2/departments/workfit';
import { versionById } from '../../../src/engine/v2/models/labs';
import { decodeUtilNow } from '../../../src/engine/v2/models/stacks';
import { worldMix } from '../../../src/engine/v2/worldfx/mix';
import { revenueReadout, sectorHours, sectorSpendParts } from '../../../src/engine/v2/worldfx/revenue';
import { chatFreeTier, h100eHoursPer, paidShareTarget, serveDollarsPerHour, tokEff } from '../../../src/engine/v2/worldfx/serving';
import type { Deployment, GameStateV2 } from '../../../src/engine/v2/types';
import { cheapestAt } from '../cheapest';
import { FIXTURE_DIR } from '../lib';
import { rowOf, type Target } from './types';

export const area = 'market';

const fixture = (d: number) => deserialize(readFileSync(join(FIXTURE_DIR, `day${d}.json`), 'utf8'));
const run = (s: GameStateV2, n: number) => {
  for (let i = 0; i < n; i++) tick(s, { skip: ['endings'] });
};
const prod = (s: GameStateV2, ch: Deployment['channel']) => s.player.deployments.find((d) => d.channel === ch && d.status !== 'withdrawn')!;

export function targets(): Target[] {
  const rows: Target[] = [];
  const day0 = () => newGame(defaultSetupV2({ seed: 2027, world: 'tl-central', alignment: 'medium', tutorial: false }));

  // C1: the leader's Chat starts at ≈ 700M weekly users.
  {
    const g0 = day0();
    const u0 = revenueReadout(g0).deps.filter((x) => x.channel === 'consumer').reduce((a, x) => a + (x.users ?? 0), 0);
    rows.push(rowOf('C1.chatUsers', `${(u0 / 1e6).toFixed(0)}M`, u0));
  }
  // C5: the paid-share target for the start model at the going price.
  {
    const p = paidShareTarget(0.14, 22, 22);
    rows.push(rowOf('C5.paidShareTarget', `${(p * 100).toFixed(2)}%`, p));
  }
  // A7: a free message's energy. Since RD-P02 the free tier is the lab's cheapest lineup model, ~12× cheaper to serve than
  // the Gemini median the anchor measures.
  {
    const s = day0();
    run(s, 3);
    const chat = prod(s, 'consumer');
    const ft = chatFreeTier(s, chat)!;
    const msgS = (h100eHoursPer(ft.fpt, CONSUMER_MKT.perDay.free, decodeUtilNow(s)) * 3600) / CONSUMER_MKT.messagesPerDay;
    const wh = (msgS * 0.7) / 3.6; // accelerator energy at 0.7 kW per H100e
    rows.push(rowOf('A7.freeMessageWh', `${msgS.toFixed(2)} H100e-s ≈ ${wh.toFixed(2)} Wh`, wh));
  }
  // A8: the start sector spend and the leader's day-1 revenue.
  {
    const s = day0();
    const mix = worldMix(s);
    const pi = mix.providers.findIndex((p) => p.key === 'player');
    let sp = 0;
    let pl = 0;
    for (const r of ['US', 'ROW'] as const) for (const def of SECTORS) {
      const x = sectorSpendParts(s, r, def.id, mix);
      const y = x.adopted + x.agent + x.seat;
      sp += y;
      pl += y * mix.sec[r][def.id].share[pi];
    }
    rows.push(rowOf('A8.leaderShare', `leader ${(pl / sp).toFixed(3)} of $${sp.toFixed(2)}B`, pl / sp));
    let us = 0;
    let rw = 0;
    for (const def of SECTORS) {
      const a = sectorSpendParts(s, 'US', def.id, mix);
      const b = sectorSpendParts(s, 'ROW', def.id, mix);
      us += a.adopted + a.agent + a.seat;
      rw += b.adopted + b.agent + b.seat;
    }
    const hrs = (r: 'US' | 'ROW') => SECTORS.reduce((x, def) => x + sectorHours(s, r, def.id), 0);
    const hr = hrs('ROW') / hrs('US');
    rows.push(rowOf('A8.usBuyerShare', `US ${us.toFixed(2)}B of ${(us + rw).toFixed(2)}B (${((100 * us) / (us + rw)).toFixed(0)}%)`, us / (us + rw)));
    rows.push(rowOf('A8.hoursRatio', `hours ROW / US ${hr.toFixed(2)}`, hr));
    run(s, 1);
    const rd = revenueReadout(s);
    const chatRev = rd.deps.find((z) => z.channel === 'consumer')!.revenue;
    rows.push(rowOf('A8.leaderRevenue', `revenue ${rd.total.toFixed(2)}B`, rd.total));
    rows.push(rowOf('A8.chatRevenueShare', `Chat ${chatRev.toFixed(2)}B, ${((100 * chatRev) / rd.total).toFixed(0)}%`, chatRev / rd.total));
  }
  // A3: the price of V0's capability falls per task and per token. Read on the day-0 and day-900 fixtures of the
  // seed-2027 central game (2.46 years).
  {
    const states = [fixture(0), fixture(900)];
    const fixedG = workFit(states[0], states[0].player.models.versions[0], 'SWE').fit; // V0's capability, held fixed
    const tok = TOKENS.agentic;
    const snaps = states.map((st) => {
      const c = cheapestAt(st, fixedG)!;
      const tau = tokEff(versionById(st, c.versionId)!); // a student reasons like its teacher (it learns from its traces)
      const task = h100eHoursPer(c.fpt, { input: tok.input, output: tok.output * tau }, decodeUtilNow(st)) * serveDollarsPerHour(st);
      return { t: decimalYear(st), task, perM: task / (tok.input + tok.output * tau) };
    });
    const [a, b] = snaps;
    const py = (x: number) => Math.pow(x, 1 / (b.t - a.t));
    const total = py(a.task / b.task);
    const perTok = py(a.perM / b.perM);
    rows.push(rowOf('A3.priceDecline', `×${total.toFixed(1)}/yr per task, ×${perTok.toFixed(1)}/yr per token over ${a.t.toFixed(2)}–${b.t.toFixed(2)}`, [total, perTok]));
  }
  return rows;
}
