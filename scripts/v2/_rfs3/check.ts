// RF-S3 targeted check (run alone: npx tsx scripts/v2/_rfs3/check.ts).
//  1. catchRate's containment part: true tool strength for the engine (believed = false), believed for readouts;
//  2. the package preview's Slowdown does not move when a hidden true level moves (it reads measured levels);
//  3. info: true vs believed containment on the fixture.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { catchRate } from '../../../src/engine/v2/models/products';
import { containment, reliabilityBase, techniqueRole } from '../../../src/engine/v2/safety/techniques';
import { oomOfLevel } from '../../../src/engine/v2/safety/oversight';
import { previewPackage } from '../../../src/engine/v2/safety/packages';
import { agentVersion, monitorVersion } from '../../../src/engine/v2/departments/agents';
import { setControl } from '../../../src/engine/v2/safety/safeguards';
import type { GameStateV2 } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const load = (f = 'day900.json'): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, f), 'utf8'));

// 1. containment in the catch rate
{
  const s = load();
  const ts = Object.values(s.player.safety.techniques).filter((t) => t.agenda === 'AG07' && techniqueRole(t) === 'contain');
  check(ts.length > 0, 'fixture has an AG07 containment tool', ts.map((t) => t.id).join(','));
  for (const t of ts) { t.unlocked = true; t.active = true; t.s0 = Math.max(t.s0, 1); t.falseValidated = false; }
  s.hidden.agendaEfficacy.AG07 = 0.9; // true efficacy apart from the believed posterior
  // The lowest-level version as the watched model (containment tools decay with the watched model's level).
  const v = [...s.player.models.versions].sort((a, b) => a.Lg - b.Lg)[0] ?? agentVersion(s, 'capRoutine')!;
  const m = monitorVersion(s, 'capRoutine') ?? v;
  for (const t of ts) { const r = reliabilityBase(s, t, oomOfLevel(s.hidden.timeline, v.Lg), false); console.log(`info ${t.id} s0 ${t.s0} efficacy ${r.efficacy.toFixed(2)} decay ${r.decay.toFixed(3)} goodhart ${r.goodhart.toFixed(2)}`); }
  const x = oomOfLevel(s.hidden.timeline, v.Lg);
  const cT = containment(s, x, true, false), cB = containment(s, x, true, true);
  check(Math.abs(cT - cB) > 1e-3, "true and believed tool strength differ here", `true ${cT.toFixed(3)} vs believed ${cB.toFixed(3)}`);
  check(Math.abs(catchRate(s, v, m, false, false).control - cT) < 1e-12, 'engine catch rate uses true tool strength', `${catchRate(s, v, m, false, false).control.toFixed(3)}`);
  const xb = oomOfLevel(s.hidden.timeline, (v.evals.measuredL ?? v.Lg));
  check(Math.abs(catchRate(s, v, m, false, true).control - containment(s, xb, true, true)) < 1e-12, 'readout catch rate uses believed tool strength at the measured level');
}

// 2. package preview Slowdown reads measured levels
{
  const s = load('day400.json');
  const d = s.player.deployments.find((y) => y.channel === 'internal' && y.status === 'live')!;
  setControl(d, false);
  const p0 = previewPackage(s, d).total.slowdown;
  for (const v of s.player.models.versions) v.Lg += 1.5; // hidden truth moves
  const p1 = previewPackage(s, d).total.slowdown;
  check(p0 > 0 && Math.abs(p0 - p1) < 1e-12, 'package preview Slowdown ignores true levels', `${(p0 * 100).toFixed(2)}% → ${(p1 * 100).toFixed(2)}%`);
}

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
