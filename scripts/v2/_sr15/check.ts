// SR-15 targeted check (run alone: npx tsx scripts/v2/_sr15/check.ts): method effects scale with research efficacy; the
// run plan's prediction is the engine's mechanism on believed values.
//  1. a method's moderator is 1 − (1 − base)·s0·e (s0 = 1 / prior mean): base at the prior mean, weaker below, stronger above;
//  2. with beliefs equal to truth (posterior = true efficacy, every edge revealed, D = 1, no U-modes, no active
//     instruments) the predicted traits equal the engine's, methods, healing and anti-scheming included;
//  3. the prediction reads believed efficacy, never the hidden one (changing the hidden efficacy moves the engine only).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { playerEnv, playerMods, predictBeliefs, stepTraits, zeroSignals } from '../../../src/engine/v2/safety/traits';
import { methodS0 } from '../../../src/engine/v2/safety/methods';
import { AGENDA_BY_ID } from '../../../src/data/v2/agendas';
import { REFERENCE_POST } from '../../../src/data/v2/runDesign';
import { TRAIT_IDS } from '../../../src/data/v2/traits';
import { EDGES } from '../../../src/data/v2/edges';
import type { AgendaId, GameStateV2, PostDesign, TraitBelief, TraitId } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const s: GameStateV2 = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
const methods = ['T-PERSONA', 'T-ANTISCHEME', 'T-CONFESS', 'T-INOC'];
for (const id of methods) s.player.safety.techniques[id].unlocked = true;
const post: PostDesign = { ...REFERENCE_POST, safety: 'heavy', methods };

// 1. scaling
const ag = s.player.safety.techniques['T-PERSONA'].agenda as AgendaId;
const [a, b] = AGENDA_BY_ID[ag].prior;
const s0 = methodS0(s, 'T-PERSONA');
const e05 = (e: number) => { s.hidden.agendaEfficacy[ag] = e; return playerMods(s, post).E05 ?? 1; };
const mean = a / (a + b);
const lo = e05(mean / 2), mid = e05(mean), hi = e05(Math.min(1, mean * 1.5));
check(Math.abs(s0 - 1 / mean) < 1e-12, 's0 = 1 / prior mean efficacy', `${ag} prior mean ${mean.toFixed(3)}, s0 ${s0.toFixed(3)}`);
check(Math.abs(mid - 0.7) < 1e-6 && Math.abs(lo - (1 - 0.3 * 0.5)) < 1e-6 && hi < mid && lo > mid, 'persona vectors E05: ×0.7 at the prior mean, ×0.85 at half, stronger above', `${lo.toFixed(3)} / ${mid.toFixed(3)} / ${hi.toFixed(3)}`);

// 2. beliefs = truth → prediction = engine
for (const id of Object.keys(s.player.safety.agendas) as AgendaId[]) {
  const e = Math.min(0.999, Math.max(0.001, s.hidden.agendaEfficacy[id] ?? 0));
  s.hidden.agendaEfficacy[id] = e;
  s.player.safety.agendas[id].posterior = { ...s.player.safety.agendas[id].posterior, a: e * 1e9, b: (1 - e) * 1e9 };
}
for (const e of EDGES) s.player.safety.edgeRevealed[e.id] = true;
s.hidden.difficultyMult = 1;
for (const t of Object.values(s.player.safety.techniques)) if (t.family) t.active = false;
const v = s.player.models.versions[s.player.models.versions.length - 1];
v.uModes = [];
const x = { ...v.traitsTrue };
const sg = { ...zeroSignals(), S1: 0.4, S2: 0.5, S3: 0.3, S5: 0.3, S7: 0.2 };
const omega = 0.6, lh = 0.3;
const prior = Object.fromEntries(TRAIT_IDS.map((t) => [t, { est: x[t], sd: 0.1, clarity: 0.5, evidence: [] } as TraitBelief])) as Record<TraitId, TraitBelief>;
const engine = () => { const env = playerEnv(s, x, sg, omega, post, 'L0', [], v, v.G); env.lh = lh; return stepTraits(x, env); };
const predicted = () => predictBeliefs(s, prior, sg, omega, post, 'L0', omega, undefined, lh, v.G, false, undefined, 'predicted', 0.04, v);
const xe = engine();
const xp = predicted();
const diff = Math.max(...TRAIT_IDS.map((t) => Math.abs(xe[t] - xp[t].est)));
check(diff < 1e-12, 'beliefs = truth: predicted traits equal the engine\'s (methods, healing, anti-scheming, audits)', `max |Δ| ${diff.toExponential(2)}; SCHEME ${x.SCHEME.toFixed(3)} → ${xe.SCHEME.toFixed(3)}`);

// 3. hidden efficacy moves the engine, not the prediction
const agS = s.player.safety.techniques['T-ANTISCHEME'].agenda as AgendaId;
const e0 = s.hidden.agendaEfficacy[agS];
s.hidden.agendaEfficacy[agS] = e0 * 0.3;
const xe2 = engine();
const xp2 = predicted();
s.hidden.agendaEfficacy[agS] = e0;
check(xe2.SCHEME > xe.SCHEME && Math.abs(xp2.SCHEME.est - xp.SCHEME.est) < 1e-12, 'a weaker hidden efficacy weakens the engine\'s effect only (the prediction reads the posterior)', `engine SCHEME ${xe.SCHEME.toFixed(4)} → ${xe2.SCHEME.toFixed(4)}; predicted ${xp.SCHEME.est.toFixed(4)} → ${xp2.SCHEME.est.toFixed(4)}`);
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
