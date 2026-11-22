// SR-04 targeted check: Loss-of-control risk (safety/lossRisk.ts) behaves as the design says. Run alone:
// npx tsx scripts/v2/_sr04/check.ts
//  1. wider beliefs raise the risk when the belief mean sits below the line;
//  2. a located backdoor lowers it against the same backdoor suspected; removing it lowers it further;
//  3. a better stop rate (control layer on / more monitor budget / a stronger stop) lowers it;
//  4. it never reads the world's draw (toleranceNoise ε_w, doomThreshold) or true traits;
//  5. Unstopped harm / yr is finite and ≥ 0; the lab headline is the max over the models it runs.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { lineageOf } from '../../../src/engine/v2/safety/footholds';
import { lossOfControlRisk, modelLossRisk, runningModels, thetaCdf, unstoppedHarmPerYear } from '../../../src/engine/v2/safety/lossRisk';
import type { Foothold, GameStateV2 } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const f4 = (x: number) => x.toFixed(4);
const load = (fx: string) => deserialize(readFileSync(join(FIXTURE_DIR, fx), 'utf8'));
const clone = (s: GameStateV2) => structuredClone(s);

for (const fx of ['day400.json', 'day900.json']) {
  const s = load(fx);
  const lab = lossOfControlRisk(s);
  check(!!lab, `${fx}: a lab headline exists`);
  if (!lab) continue;
  console.log(`     ${fx}: ${lab.name} p ${f4(lab.p)} (${f4(lab.lo)}–${f4(lab.hi)}) mis ${f4(lab.mis)} ± ${f4(1.64 * lab.misSd)} stop ${f4(lab.stopRate)} F ${f4(lab.F)} (unfound ${f4(lab.unfoundF)}) reach ${f4(lab.reach)}`);
  const all = runningModels(s).map((v) => modelLossRisk(s, v).p);
  check(lab.p === Math.max(...all), `${fx}: lab headline = max over ${all.length} running models`);

  // 1. Wider beliefs raise the risk while the mean exposure sits below the line (k fixed: misShift moves the mean down).
  const below = lossOfControlRisk(s, lab.versionId, { misShift: Math.min(0, 0.25 - lab.mis) })!;
  const kExp = below.exposure;
  const wide = lossOfControlRisk(s, lab.versionId, { misShift: Math.min(0, 0.25 - lab.mis), sdMult: 2 })!;
  const narrow = lossOfControlRisk(s, lab.versionId, { misShift: Math.min(0, 0.25 - lab.mis), sdMult: 0.5 })!;
  check(kExp < 0.4 && wide.p > below.p && below.p > narrow.p, `${fx}: mean below the line (exposure ${f4(kExp)}): sd ×0.5 / ×1 / ×2 → risk rises`, `${f4(narrow.p)} < ${f4(below.p)} < ${f4(wide.p)}`);

  // 2. A backdoor in the model's lineage: suspected (full weight, typical size) > located (half weight) > removed.
  const v = s.player.models.versions.find((x) => x.id === lab.versionId)!;
  const withBd = (status: Foothold['status']) => {
    const c = clone(s);
    const bd: Foothold = { id: 'fh-sr04', kind: 'backdoor', versionId: v.id, lineage: lineageOf(c, v), day: c.time.day, acts: 1, severity: 4, size: 0.32, status };
    (c.player.safety.footholds ??= []).push(bd);
    return lossOfControlRisk(c, v.id)!.p;
  };
  const [pHid, pSus, pLoc, pRem] = [withBd('hidden'), withBd('suspected'), withBd('detected'), withBd('removed')];
  check(pHid === modelLossRisk(s, v).p, `${fx}: a hidden backdoor is invisible to the risk (no leak)`);
  check(pSus > pLoc && pLoc > pRem, `${fx}: backdoor suspected > located > removed`, `${f4(pSus)} > ${f4(pLoc)} > ${f4(pRem)}`);

  // 3. A better stop rate lowers it: control layer on, more monitor budget, +10 pts stop.
  const base = modelLossRisk(s, v).p;
  const layer = clone(s);
  for (const d of layer.player.deployments) if (d.channel === 'internal') d.controlLayer = true;
  const pLayer = lossOfControlRisk(layer, v.id)!.p;
  const mon = clone(s);
  mon.player.split.monitors = Math.max(0.05, mon.player.split.monitors * 4);
  const pMon = lossOfControlRisk(mon, v.id)!.p;
  const pStop = lossOfControlRisk(s, v.id, { stopAdd: 0.1 })!.p;
  check(pLayer <= base && pMon <= base && pStop < base && (pLayer < base || pMon < base), `${fx}: control layer / monitor budget ×4 / stop +10 pts do not raise it, and one safeguard lowers it`, `${f4(base)} → layer ${f4(pLayer)} · monitors ${f4(pMon)} · stop ${f4(pStop)}`);

  // 4. Never reads the world's draw or true traits.
  const w = clone(s);
  w.hidden.toleranceNoise = -0.2;
  w.hidden.doomThreshold = 0.31;
  for (const x of w.player.models.versions) for (const t of Object.keys(x.traitsTrue)) (x.traitsTrue as Record<string, number>)[t] = 1;
  const lw = lossOfControlRisk(w)!;
  check(lw.p === lab.p && lw.lo === lab.lo && lw.hi === lab.hi, `${fx}: unchanged with ε_w, doomThreshold and true traits rewritten`);
  check(thetaCdf(s, 0.04) === 0 && thetaCdf(s, 0.96) === 1 && thetaCdf(s, 0.3) < thetaCdf(s, 0.4) && thetaCdf(s, 0.4) < thetaCdf(s, 0.5), `${fx}: θ prior CDF clamped and increasing (${s.setup.alignment})`);

  // 5. Unstopped harm.
  const h = unstoppedHarmPerYear(s);
  check(Number.isFinite(h.harm) && h.harm >= h.acts && h.acts >= 0, `${fx}: unstopped harm ${f4(h.harm)} / yr from ${f4(h.acts)} acts (severity ≥ 1)`);
}
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
