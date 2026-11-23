// RF-S5 targeted check (run alone: npx tsx scripts/v2/_rfs5/check.ts). Trust per model, not one factor per instrument.
//  1. a disagreement on model A records one item and leaves trust as it was (CAL2-S, decision 10: no automatic cut);
//  2. a validation on B sets B's factor; A keeps its own factor; a model with no entry reads the last
//     validated model's (extrapolated);
//  3. migration 99 → 100: an old single factor goes to the model the instrument was validated on.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize, SCHEMA_REV } from '../../../src/engine/v2/core/save';
import { Rng } from '../../../src/engine/rng';
import { internalVersion } from '../../../src/engine/v2/models/labs';
import { observeVersion } from '../../../src/engine/v2/safety/detection';
import { instruments, reliability } from '../../../src/engine/v2/safety/instruments';
import { versionOom } from '../../../src/engine/v2/safety/oversight';
import { trustOf } from '../../../src/engine/v2/safety/techniques';
import { setTrust } from '../../../src/engine/v2/safety/disagreement';
import { completeValidation } from '../../../src/engine/v2/safety/validation';
import type { GameStateV2, ModelVersion, RngLike, TechniqueState, TraitId } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const raw = readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8');
const noise = (xs: number[]): RngLike => {
  const r = new Rng(3) as unknown as RngLike;
  return { ...r, float: () => r.float(), normal: (mean = 0) => mean + (xs.shift() ?? 0) } as RngLike;
};

const s: GameStateV2 = deserialize(raw);
const A = internalVersion(s)!;
const B = s.player.models.versions.find((v) => v.id !== A.id && (v.status === 'ready' || v.status === 'deployed'))!;
check(!!B, 'fixture has a second live model', `${A.name} / ${B?.name}`);
const own = instruments(s);
const reads = (fam: string, k: TraitId) => own.filter((t) => t.family === fam && (t.coverage[k] ?? 0) > 0);
const trait = (Object.keys(A.traitsTrue) as TraitId[]).find((k) => reads('BB', k).length && reads('WB', k).length)!;
const sides = [...reads('BB', trait), ...reads('WB', trait)];
const bel = (t: TechniqueState, v: ModelVersion) => reliability(s, t, { x: versionOom(s, v), v, trait }, true).value;
const fA0 = sides.map((t) => trustOf(t, A.id)), fB0 = sides.map((t) => trustOf(t, B.id)), rB0 = sides.map((t) => bel(t, B));
observeVersion(s, noise([0.3]), s.time.day, A, trait, 'BB', 1, 1, 'suite');
observeVersion(s, noise([-0.3]), s.time.day, A, trait, 'WB', 1, 1, 'audit');
check((s.player.safety.disagreements ?? []).length === 1, 'one disagreement on A');
check(sides.every((t, i) => trustOf(t, A.id) === fA0[i]), 'CAL2-S: A: trust unchanged by the disagreement', sides.map((t) => `${t.id} ${trustOf(t, A.id)}`).join(', '));
check(sides.every((t, i) => trustOf(t, B.id) === fB0[i] && Math.abs(bel(t, B) - rB0[i]) < 1e-12), 'B: trust and believed reliability unchanged', sides.map((t) => `${t.id} ${trustOf(t, B.id)}`).join(', '));

// 2. validation on B
const t = sides[0];
// CAL2-S: disagreements no longer write a factor, so A gets its own entry directly (as an earlier validation on A would).
setTrust(t, 0.9, { day: s.time.day, source: 'validation', model: A.id, note: 'test: own factor on A' });
completeValidation(s, new Rng(5) as unknown as RngLike, s.time.day, { id: 'v', tool: t.id, model: B.id, progress: 1, by: 'player', day: 0, human: true });
const fB = trustOf(t, B.id);
check(t.trust!.byModel[B.id] === fB && t.validatedOn === B.id, 'validation on B sets B\'s own factor', `${fB}`);
check(trustOf(t, A.id) === 0.9 && fB !== 0.9, 'A keeps its own factor', `${trustOf(t, A.id)}`);
const C = s.player.models.versions.find((v) => v.id !== A.id && v.id !== B.id && !t.trust!.byModel[v.id]);
if (C) check(trustOf(t, C.id) === fB, 'a model with no entry reads the last validated model\'s (extrapolated)', `${C.name} ${trustOf(t, C.id)}`);

// 3. migration
{
  const o = JSON.parse(raw) as { schemaRev: number; player: { safety: { techniques: Record<string, { validatedOn: string | null; trust?: unknown }> } } };
  const id = Object.keys(o.player.safety.techniques)[0];
  o.schemaRev = 99;
  o.player.safety.techniques[id].validatedOn = A.id;
  o.player.safety.techniques[id].trust = { f: 0.7, evidence: [{ day: 1, source: 'validation', model: A.id, note: 'x', f: 0.7 }] };
  const m = deserialize(JSON.stringify(o));
  const tr = m.player.safety.techniques[id as keyof typeof m.player.safety.techniques]!.trust as unknown as Record<string, unknown>;
  check(m.schemaRev === SCHEMA_REV && SCHEMA_REV === 102 && JSON.stringify(tr.byModel) === JSON.stringify({ [A.id]: 0.7 }) && !('f' in tr), 'migration 99 → 100 (→ 102) moves the factor to the validated model', JSON.stringify(tr.byModel));
}

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
