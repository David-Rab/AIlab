// SR-10 targeted check (run alone: npx tsx scripts/v2/_sr10/check.ts): disagreement detection and false-instrument
// exposure.
//  1. the fixture migrates to rev 72 (empty disagreement list);
//  2. two independent instruments (behavioural tests BB, internals WB) whose readings of one trait on one model are
//     outside each other's ranges produce one disagreement item and lower the believed reliability of both sides'
//     instruments by DISAGREE_DROP (true reliability unchanged); the same pair is recorded once; agreeing readings and
//     same-family readings (logs/COT vs reasoning/COT) record nothing;
//  3. a falsely-trusted instrument (hidden falseValidated) keeps its believed reliability through AI-assisted
//     validations (mean trust about 1) and loses it after one human-run validation (found 0 of 20).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DISAGREE_DROP, VAL_N } from '../../../src/data/v2/agendas';
import { deserialize, SCHEMA_REV } from '../../../src/engine/v2/core/save';
import { Rng } from '../../../src/engine/rng';
import { safetyLabour } from '../../../src/engine/v2/departments/workfit';
import { internalVersion } from '../../../src/engine/v2/models/labs';
import { observeVersion } from '../../../src/engine/v2/safety/detection';
import { instruments, reliability } from '../../../src/engine/v2/safety/instruments';
import { versionOom } from '../../../src/engine/v2/safety/oversight';
import { completeValidation, trueRecall } from '../../../src/engine/v2/safety/validation';
import { trustOf } from '../../../src/engine/v2/safety/techniques';
import type { GameStateV2, RngLike, TechniqueState, TraitId } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const load = (f: string): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, f), 'utf8'));
/** An rng whose next normal draw is given (a reading's sampling noise). */
const noise = (xs: number[]): RngLike => {
  const r = new Rng(3) as unknown as RngLike;
  return { ...r, float: () => r.float(), normal: (mean = 0) => mean + (xs.shift() ?? 0) } as RngLike;
};

// 1. migration
const s = load('day400.json');
check(s.schemaRev === SCHEMA_REV && SCHEMA_REV >= 77 && Array.isArray(s.player.safety.disagreements) && s.player.safety.disagreements.length === 0, 'migration to 77 (SR-10; was 72 before the merge into rd): empty disagreement list');

// 2. disagreement
const v = internalVersion(s)!;
const own = instruments(s);
const reads = (fam: string, k: TraitId) => own.filter((t) => t.family === fam && (t.coverage[k] ?? 0) > 0);
const trait = (Object.keys(v.traitsTrue) as TraitId[]).find((k) => reads('BB', k).length && reads('WB', k).length)!;
check(!!trait, 'a trait read by both behavioural tests and internals', String(trait));
const x = versionOom(s, v);
const bel = (t: TechniqueState) => reliability(s, t, { x, v, trait }, true).value;
const tru = (t: TechniqueState) => reliability(s, t, { x, v, trait }, false).value;
const sides = [...reads('BB', trait), ...reads('WB', trait)];
const others = own.filter((t) => !sides.includes(t));
const b0 = sides.map(bel), t0 = sides.map(tru), o0 = others.map(bel);
const day = s.time.day;
observeVersion(s, noise([0]), day, v, trait, 'BB', 1, 1, 'suite');
observeVersion(s, noise([0]), day, v, trait, 'WB', 1, 1, 'audit');
const agreeing = (s.player.safety.disagreements ?? []).length;
check(agreeing === 0, 'readings inside each other\'s ranges: no disagreement', `${agreeing}`);
// Tests read high, internals read low (sigma 0.12 each: gap 0.6 > 1.64 x 0.17).
observeVersion(s, noise([0.3]), day + 1, v, trait, 'BB', 1, 1, 'suite');
observeVersion(s, noise([-0.3]), day + 1, v, trait, 'WB', 1, 1, 'audit');
const dis = s.player.safety.disagreements ?? [];
check(dis.length === 1 && dis[0].model === v.id && dis[0].trait === trait && dis[0].a.kind !== dis[0].b.kind, 'conflicting independent readings: one disagreement item', JSON.stringify(dis.map((d) => [d.a.kind, d.a.reading, d.b.kind, d.b.reading])));
const b1 = sides.map(bel);
check(sides.every((_t, i) => Math.abs(b1[i] - b0[i] * (1 - DISAGREE_DROP)) < 1e-9), 'both sides\' believed reliability x (1 - DISAGREE_DROP)', sides.map((t, i) => `${t.id} ${b0[i].toFixed(3)}->${b1[i].toFixed(3)}`).join(', '));
check(sides.every((t, i) => tru(t) === t0[i]), 'true reliability unchanged');
check(others.every((t, i) => bel(t) === o0[i]), 'instruments of other families unchanged');
check(sides.every((t) => t.trust?.evidence.at(-1)?.source === 'disagreement'), 'each side carries a disagreement evidence entry', sides[0].trust?.evidence.at(-1)?.note);
observeVersion(s, noise([0.3]), day + 2, v, trait, 'BB', 1, 1, 'suite');
check((s.player.safety.disagreements ?? []).length === 1 && sides.every((t, i) => bel(t) === b1[i]), 'same model / trait / pair: recorded once');
const s2 = load('day400.json');
const v2 = internalVersion(s2)!;
observeVersion(s2, noise([0.3]), day, v2, trait, 'COT', 1, 1, 'suite');
observeVersion(s2, noise([-0.3]), day, v2, trait, 'COT', 1, 2, 'monitor');
check((s2.player.safety.disagreements ?? []).length === 0, 'same family (logs vs reasoning, both COT): no disagreement');

// 3. false instrument exposed only by a human-run validation
const s3 = load('day900.json');
const v3 = internalVersion(s3)!;
// The player hands safety experiments to AI (the safety agents line gets compute, trusted to AI), so validations are
// AI-assisted.
s3.player.policies.trustedToAI = 1;
s3.player.split.safetyAgents = 0.05;
const m = safetyLabour(s3).exp.m;
check(m > 1, 'day 900 has an AI share in safety experiments (AI-assisted validation possible)', `m ${m.toFixed(2)}`);
const f = instruments(s3)[0];
f.falseValidated = true; // hidden: it masks, does not detect
const x3 = versionOom(s3, v3);
const believed = () => reliability(s3, f, { x: x3 }, true).value;
const r0 = believed();
check(trueRecall(s3, f, v3) === 0 && r0 > 0.05, 'the false instrument: true recall 0, believed reliable', `believed ${r0.toFixed(3)}`);
const rng = new Rng(11) as unknown as RngLike;
let sumF = 0;
const K = 300;
for (let i = 0; i < K; i++) {
  f.trust = undefined;
  completeValidation(s3, rng, s3.time.day, { id: 'a', tool: f.id, model: v3.id, progress: 1, by: 'player', day: 0 });
  sumF += trustOf(f, v3.id);
}
check(f.measured!.human === false && Math.abs(sumF / K - 1) < 0.1, 'AI-assisted validations: it passes (mean trust about 1)', `mean ${(sumF / K).toFixed(3)}`);
f.trust = undefined;
completeValidation(s3, rng, s3.time.day, { id: 'a', tool: f.id, model: v3.id, progress: 1, by: 'player', day: 0 });
const rAi = believed();
completeValidation(s3, rng, s3.time.day, { id: 'h', tool: f.id, model: v3.id, progress: 1, by: 'player', day: 0, human: true });
const rH = believed();
check(f.measured!.human === true && f.measured!.found === 0 && f.measured!.n === VAL_N, 'human-run validation: found 0 of 20 planted', `${f.measured!.found} of ${f.measured!.n}`);
check(rH < 0.01 && rAi > r0 * 0.5, 'believed reliability falls only after the human-run validation', `${r0.toFixed(3)} -> AI ${rAi.toFixed(3)} -> human ${rH.toFixed(3)}`);
check(f.trust!.evidence.at(-1)!.source === 'validation' && /human-run/.test(f.trust!.evidence.at(-1)!.note), 'validation evidence names who ran it', f.trust!.evidence.at(-1)!.note);
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
