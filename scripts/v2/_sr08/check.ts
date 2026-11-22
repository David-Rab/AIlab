// SR-08 targeted check (run alone: npx tsx scripts/v2/_sr08/check.ts): one reliability definition per instrument.
//  1. detection (familyDetection) and understanding (detectionAt) both read safety/instruments.ts reliability();
//  2. reliability falls with the capability gap from the model the instrument was validated on (and is full on it);
//  3. the reasons list speaks player language ("not validated on …", "capability gap from …").
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { internalVersion, measuredLOf } from '../../../src/engine/v2/models/labs';
import { combineTools, familyDetection } from '../../../src/engine/v2/safety/detection';
import { instrumentKind, instruments, reliability, reliabilityReasons } from '../../../src/engine/v2/safety/instruments';
import { oomOfLevel, versionOom } from '../../../src/engine/v2/safety/oversight';
import { detectionAt } from '../../../src/engine/v2/safety/understanding';
import type { GameStateV2, TechniqueState } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const near = (a: number, b: number, e = 1e-9) => Math.abs(a - b) < e;
const s: GameStateV2 = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
const v = internalVersion(s)!;
const owned = instruments(s);
check(owned.length > 0 && owned.every((t) => !!instrumentKind(t)), 'instruments: owned detect tools each have a kind', owned.map((t) => `${t.id}:${instrumentKind(t)}`).join(' '));

// 1a. detection: familyDetection = combine(cov · reliability(true).base) over the family's tools.
const X = versionOom(s, v);
const fam = owned[0].family;
const trait = (Object.keys(owned[0].coverage) as (keyof TechniqueState['coverage'])[]).find((k) => (owned[0].coverage[k] ?? 0) > 0)!;
const tools = Object.values(s.player.safety.techniques).filter((t) => t.unlocked && t.active && t.family === fam && (t.coverage[trait] ?? 0) > 0);
const want = combineTools(tools.map((t) => ({ agenda: t.agenda, d: (t.coverage[trait] ?? 0) * reliability(s, t, { x: X }, false).base })));
const got = familyDetection(s, v, trait, fam, X);
check(near(got, want), 'detection: familyDetection is built from reliability() (true)', `${fam}/${trait} ${got.toFixed(4)} vs ${want.toFixed(4)}`);

// 1b. understanding: detectionAt with a single tool = cov · reliability(believed).value at the measured level.
const L0 = measuredLOf(s, v).L;
const t0 = owned.find((t) => t.family === 'WB') ?? owned[0];
const tr0 = (Object.keys(t0.coverage) as (keyof TechniqueState['coverage'])[]).find((k) => (t0.coverage[k] ?? 0) > 0)!;
const u = detectionAt(s, v, tr0, L0, [t0]);
const r0 = reliability(s, t0, { x: oomOfLevel(s.hidden.timeline, L0), v, trait: tr0 }, true);
check(near(u, (t0.coverage[tr0] ?? 0) * r0.value), 'understanding: detectionAt is cov · reliability() (believed)', `${t0.id}/${tr0} ${u.toFixed(4)} vs ${((t0.coverage[tr0] ?? 0) * r0.value).toFixed(4)}`);

// 2. reliability falls with the capability gap from the validated model.
const t = { ...(owned.find((x) => x.k > 0 && x.oHalf < 1e8 && x.agenda !== 'AG05') ?? owned[0]) };
t.validatedOn = v.id;
t.validatedOom = X;
const at = (dx: number) => reliability(s, t, { x: X + dx }, false).base;
const r = [0, 1, 2, 4, 8].map(at);
const full = reliability(s, { ...t, validatedOom: 1e6 }, { x: X }, false).base; // gap 0 by clamping
check(r.every((y, i) => i === 0 || y < r[i - 1]) && near(r[0], full), 'reliability: full on the validated model, falls with the gap from it', `${t.id} gap 0/1/2/4/8 OOM: ${r.map((y) => y.toFixed(3)).join(' ')}`);
const older = reliability(s, { ...t, validatedOom: X - 2 }, { x: X }, false).base;
check(older < r[0] && near(older, at(2)), 'reliability: validated on an older model = the same gap read today', `${older.toFixed(3)} vs ${at(2).toFixed(3)}`);

// 3. reasons in player language.
const reasons = reliabilityReasons(s, { ...t, validatedOn: s.player.models.versions[0].id, validatedOom: 0 }, v, tr0, measuredLOf(s, v).L);
check(reasons.some((x) => x.startsWith('not validated on')) && reasons.some((x) => x.startsWith('capability gap from')), 'reasons: "not validated on …" and "capability gap from …"', reasons.join('; '));
console.log(fails ? `${fails} FAIL` : 'all ok');
process.exit(fails ? 1 : 0);
