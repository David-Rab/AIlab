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
import type { Target } from './types';

export const area = 'market';

const fixture = (d: number) => deserialize(readFileSync(join(FIXTURE_DIR, `day${d}.json`), 'utf8'));
const run = (s: GameStateV2, n: number) => {
  for (let i = 0; i < n; i++) tick(s, { skip: ['endings'] });
};
const prod = (s: GameStateV2, ch: Deployment['channel']) => s.player.deployments.find((d) => d.channel === ch && d.status !== 'withdrawn')!;

export function targets(): Target[] {
  const rows: Target[] = [];
  const row = (id: string, label: string, band: string, value: string, ok: boolean, source: string) => rows.push({ id: `market.${id}`, label, band, value, ok, source });
  const day0 = () => newGame(defaultSetupV2({ seed: 2027, world: 'tl-central', alignment: 'medium', tutorial: false }));

  // C1: the leader's Chat starts at ≈ 700M weekly users.
  {
    const g0 = day0();
    const u0 = revenueReadout(g0).deps.filter((x) => x.channel === 'consumer').reduce((a, x) => a + (x.users ?? 0), 0);
    row('c1.users', "C1 the leader's Chat starts at ≈ 700M weekly users (ChatGPT, Jul 2025, NBER w34255; ±10%)", '630–770M', `${(u0 / 1e6).toFixed(0)}M`, u0 > 630e6 && u0 < 770e6, 'NBER w34255 (ChatGPT, Jul 2025)');
  }
  // C5: the paid-share target for the start model at the going price (R22: 5–6%).
  {
    const p = paidShareTarget(0.14, 22, 22);
    row('c5.paidShare', 'C5 paid-share target: ≈5.5% for the start model at the going price (R22: 5–6%)', '5–6%', `${(p * 100).toFixed(2)}%`, p > 0.05 && p < 0.06, 'research/22 §2');
  }
  // A7: a free message's energy (Google's measured median Gemini Apps text prompt, arXiv 2508.15734). Since RD-P02 the free
  // tier is the lab's cheapest lineup model, ~12× cheaper to serve than the Gemini median the anchor measures.
  {
    const s = day0();
    run(s, 3);
    const chat = prod(s, 'consumer');
    const ft = chatFreeTier(s, chat)!;
    const msgS = (h100eHoursPer(ft.fpt, CONSUMER_MKT.perDay.free, decodeUtilNow(s)) * 3600) / CONSUMER_MKT.messagesPerDay;
    const wh = (msgS * 0.7) / 3.6; // accelerator energy at 0.7 kW per H100e
    row('a7.wh', "A7 a free message costs within ×3 of Google's measured 0.24 Wh median", '0.08–0.72 Wh', `${msgS.toFixed(2)} H100e-s ≈ ${wh.toFixed(2)} Wh`, wh >= 0.24 / 3 && wh <= 0.24 * 3, 'arXiv 2508.15734 (Google, Gemini Apps median prompt)');
  }
  // A8: the start sector spend and the leader's day-1 revenue.
  {
    const s = day0();
    const mix = worldMix(s);
    const pi = mix.providers.findIndex((p) => p.key === 'player');
    // The classic leader (3–9 months ahead) holds the measured spread: 0.25 (OpenAI mid-2025) to 0.45 (Anthropic 40% end-2025)
    // of US and ROW sector spend (Menlo Ventures, Jul and Dec 2025).
    let sp = 0;
    let pl = 0;
    for (const r of ['US', 'ROW'] as const) for (const def of SECTORS) {
      const x = sectorSpendParts(s, r, def.id, mix);
      const y = x.adopted + x.agent + x.seat;
      sp += y;
      pl += y * mix.sec[r][def.id].share[pi];
    }
    row('a8.leaderShare', 'A8 multi-homing: the classic leader holds 0.25–0.45 of US + ROW sector spend', '0.25–0.45', `leader ${(pl / sp).toFixed(3)} of $${sp.toFixed(2)}B`, pl / sp >= 0.25 && pl / sp <= 0.45, 'Menlo Ventures, Jul and Dec 2025 (OpenAI 0.25, Anthropic 0.45 of sector spend)');
    // ROW firms start paying for AI work at the rate their AI-using workers hold paid seats, so US buyers are 40–72% of the
    // start sector spend outside China (72%: Anthropic's US billing share, an upper bound [UNVERIFIED]); workers' use keeps
    // its scale (ROW / US hours of use ≈ 3.6, the Anthropic Economic Index's Claude.ai split).
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
    row('a8.usShare', 'A8 US buyers 40–72% of the start sector spend outside China, ROW / US hours of use ≈ 3.6', 'US 40–72%, hours ROW / US 3–4.2',
      `US ${us.toFixed(2)}B of ${(us + rw).toFixed(2)}B (${((100 * us) / (us + rw)).toFixed(0)}%); hours ROW / US ${hr.toFixed(2)}`, us / (us + rw) >= 0.4 && us / (us + rw) <= 0.72 && hr > 3 && hr < 4.2,
      'research/22 (Anthropic US billing share 72% [UNVERIFIED]); Anthropic Economic Index (ROW / US hours ≈ 3.6)');
    // research/22 §4: the leader's 2025 run-rate ≈ $12–15B, Chat ≈ two thirds.
    run(s, 1);
    const rd = revenueReadout(s);
    const chatRev = rd.deps.find((z) => z.channel === 'consumer')!.revenue;
    row('a8.revenue', "A8 the leader's day-1 revenue $12–15B, Chat 60–75% of it", '$12–15B, Chat 60–75%', `revenue ${rd.total.toFixed(2)}B (Chat ${chatRev.toFixed(2)}B, ${((100 * chatRev) / rd.total).toFixed(0)}%)`,
      rd.total >= 12 && rd.total <= 15 && chatRev / rd.total >= 0.6 && chatRev / rd.total <= 0.75, 'research/22 §4');
  }
  // A3: the price of V0's capability falls ×6–×900 a year per task and per token. Band ×6–×900 (M9 re-baseline, lead
  // decision): Cottier, Snodin, Owen & Adamczewski (Epoch AI, Mar 2025; research/20 D3) measure price-for-fixed-capability
  // declines of ×9 to ×900 a year depending on the capability threshold (GPT-4-level GPQA ≈ ×40/yr); the floor ×6 is kept
  // (below Epoch's ×9) to allow the slower conservative estimates, ×5–10/yr (research/12 §0.6). Read on the day-0 and
  // day-900 fixtures of the seed-2027 central game (2.46 years).
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
    row('a3.decline', "A3 the price of a fixed capability (V0's) falls ×6–×900 a year per task and per token (R20 D3: ≈ ×10, ×9–×900; Cottier et al. 2025)", '×6–×900 per task and per token',
      `×${total.toFixed(1)}/yr per task, ×${perTok.toFixed(1)}/yr per token over ${a.t.toFixed(2)}–${b.t.toFixed(2)}`, total >= 6 && total <= 900 && perTok >= 6 && perTok <= 900, 'research/20 D3; Cottier et al. 2025 (Epoch AI)');
  }
  return rows;
}
