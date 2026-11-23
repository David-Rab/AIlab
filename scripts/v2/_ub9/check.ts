// UB-9 check (npx tsx scripts/v2/_ub9/check.ts): the SAFETY header and Risks readouts (safetyModels, riskTableOf,
// actReadouts with severity and Unstopped range, unstoppedBySeverity) on the day-400 and day-900 fixtures: they add up
// (rows → tile, attempts → Unstopped), the default pick is the lab's riskiest model, and none moves when the hidden values
// are rewritten (versions' true levels and traits, programme efficacy).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { check, finish, FIXTURE_DIR } from '../lib';
import { actReadouts, riskTableOf, safetyModels, unstoppedBySeverity } from '../../../src/engine/v2/safety/safetyReadouts';
import { lossOfControlRisk } from '../../../src/engine/v2/safety/lossRisk';
import type { GameStateV2 } from '../../../src/engine/v2/types';

const load = (day: number): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, `day${day}.json`), 'utf8'));

function rewriteHidden(s: GameStateV2) {
  for (const v of s.player.models.versions) {
    v.G += 0.8;
    v.Lg += 1.3;
    for (const d of Object.keys(v.domains) as (keyof typeof v.domains)[]) v.domains[d] = v.domains[d] * 0.7 + 1.1;
    for (const t of Object.keys(v.traitsTrue) as (keyof typeof v.traitsTrue)[]) v.traitsTrue[t] = 1 - v.traitsTrue[t];
  }
  for (const k of Object.keys(s.hidden.agendaEfficacy)) s.hidden.agendaEfficacy[k as keyof typeof s.hidden.agendaEfficacy] = 1 - (s.hidden.agendaEfficacy[k as keyof typeof s.hidden.agendaEfficacy] ?? 0);
}

function readout(s: GameStateV2) {
  const models = safetyModels(s);
  return models.map((m) => {
    const rt = riskTableOf(s, m.id);
    const rows = rt ? actReadouts(rt.table) : [];
    return { m, where: rt?.where, rows, harm: rt ? unstoppedBySeverity(rt.table) : undefined };
  });
}

for (const day of [400, 900]) {
  const s = load(day);
  const out = readout(s);
  check(out.length > 0, `day ${day}: at least one running model in the picker`);
  check(out[0].m.id === lossOfControlRisk(s)?.versionId, `day ${day}: the picker's first model is the lab's riskiest (the L0 item's)`, `${out[0].m.name} vs ${lossOfControlRisk(s)?.name}`);
  for (const o of out) {
    if (!o.harm) continue;
    const year = o.rows.filter((r) => r.per === 'year');
    const sum = year.reduce((a, r) => a + r.unstopped, 0);
    const bins = o.harm.bins.reduce((a, b) => a + b.acts, 0);
    check(Math.abs(sum - o.harm.acts) < 1e-12 && Math.abs(bins - o.harm.acts) < 1e-12, `day ${day} ${o.m.name}: Unstopped harm = Σ per-year rows = Σ severity bins`, `${sum} · ${o.harm.acts} · ${bins}`);
    check(o.harm.lo <= o.harm.acts + 1e-12 && o.harm.hi >= o.harm.acts - 1e-12, `day ${day} ${o.m.name}: the harm range holds the best guess`);
    const bad = year.filter((r) => r.chancesPerYear !== undefined && r.unstopped > 1e-9 && Math.abs(r.wouldTry * r.ableTo * r.chancesPerYear * (1 - r.stopRate) - r.unstopped) / r.unstopped > 0.02);
    check(!bad.length, `day ${day} ${o.m.name}: Would try × Able to × Chances / yr × (1 − Stop rate) = Unstopped / yr`, bad.map((r) => r.name).join(', '));
    check(year.every((r) => !!r.severity), `day ${day} ${o.m.name}: every per-year row has a severity word`);
    check(o.rows.some((r) => r.per === 'exposure') === (o.where === 'staff'), `day ${day} ${o.m.name}: the composite row shows on AI staff work only`);
  }
  const t = load(day);
  rewriteHidden(t);
  const a = JSON.stringify(out.map((o) => ({ ...o, m: { ...o.m } })));
  const b = JSON.stringify(readout(t).map((o) => ({ ...o, m: { ...o.m } })));
  check(a === b, `day ${day}: unchanged when hidden values are rewritten`);
}
finish('ub9');
