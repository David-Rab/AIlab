// RD-T02 targeted check: a continue run on the day-400 fixture draws its added tokens from the portfolio. On a small
// portfolio (every pretraining asset shrunk) the cumulative draw repeats and the added part's effective compute (f_add)
// is lower than on a large one (every asset grown); the finished base's epochs follow the draw.
// Run alone: npx tsx scripts/v2/_t02/check.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { act, tick } from '../../../src/engine/v2/core/loop';
import { continueFData } from '../../../src/engine/v2/models/effective';
import { FIXTURE_DIR } from '../lib';

const raw = readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8');
function runOn(k: number) {
  const s = deserialize(raw);
  s.player.finance.cash = Math.max(s.player.finance.cash, 50);
  for (const a of s.player.dataPortfolio.assets) {
    if (a.kind === 'public') a.coverage = Math.min(1, a.coverage * k);
    else a.tokensT *= k;
  }
  const nR = s.player.models.runs.length;
  const nB = s.player.models.bases.length;
  const err = act(s, 'launchContinue', {});
  if (err) throw new Error(err);
  const run = s.player.models.runs[nR];
  const parent = s.player.models.bases.find((b) => b.id === run.baseId)!;
  const rec = run.recipe!;
  const add = run.flopNeeded / (6 * parent.params);
  const fAdd = continueFData(parent.params, parent.tokens, add, rec.draw!.dEff, rec.prevDEff!);
  run.readyDay = s.time.day;
  run.flopDone = run.flopNeeded;
  tick(s);
  const b = s.player.models.bases[nB];
  return { k, drawTokens: rec.draw!.tokens, expected: parent.tokens + add, epochs: rec.draw!.epochs, baseEpochs: b?.epochs, fAdd, gGain: b ? b.gPre - parent.gPre : NaN };
}
const small = runOn(0.02);
const large = runOn(1);
for (const r of [small, large]) console.log(`k ${r.k}: draw ${r.drawTokens.toExponential(3)} tokens (parent + added ${r.expected.toExponential(3)}), epochs ${r.epochs.toFixed(2)}, base epochs ${r.baseEpochs?.toFixed(2)}, f_add ${r.fAdd.toFixed(3)}, gPre gain ${r.gGain.toFixed(4)} OOM`);
const checks: [string, boolean][] = [
  ['draw = parent + added tokens', Math.abs(small.drawTokens / small.expected - 1) < 1e-9],
  ['small portfolio repeats (epochs > 1)', small.epochs > 1],
  ['base epochs follow the draw', small.baseEpochs === small.epochs && large.baseEpochs === large.epochs],
  ['added effective compute lower on the small portfolio', small.fAdd < large.fAdd && small.gGain < large.gGain],
];
let fails = 0;
for (const [n, ok] of checks) { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}`); }
if (fails) process.exit(1);
