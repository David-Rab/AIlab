// End-screen view check (npx tsx scripts/v2/_endview/endview.ts [fixture]): forces each of the 17 endings on a mature
// fixture (day900 by default) the way the endings system reaches it (its inputs set, then endingsSystem.run; war,
// catastrophes and rogue through endGame, as the system calls it once its roll fires), then checks endingView:
// finite numbers, no template slots left, a non-empty epilogue, scores = s.ending.scores and = round(clamp(Σ terms)),
// shares in 0..1, and the why-gauge agreeing with the ending. Prints the 17 epilogues.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { makeCtx } from '../../../src/engine/v2/core/loop';
import { endGame, endingsSystem, ENDING_TEXT } from '../../../src/engine/v2/endings/endings';
import { resolveAsi, playerContain, otherContain } from '../../../src/engine/v2/endings/epilogue';
import { endingView, type EndingView } from '../../../src/engine/v2/endings/view';
import { ws4 } from '../../../src/engine/v2/actors/state';
import { bestPlayerVersion } from '../../../src/engine/v2/models/labs';
import { misalignment } from '../../../src/engine/v2/safety/traits';
import { CONTROL } from '../../../src/data/v2/danger';
import { check, finish, FIXTURE_DIR } from '../lib';
import type { EndingId, GameStateV2, LabId } from '../../../src/engine/v2/types';

const FIX = process.argv[2] ?? 'day900';
const load = (): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, `${FIX}.json`), 'utf8'));
const run = (s: GameStateV2) => endingsSystem.run(s, makeCtx(s));
const rival = (s: GameStateV2) => s.rivals.find((r) => r.core.status === 'active')!;
/** Set the world's tolerance θ exactly (doomThreshold + noise; lossThreshold clamps to 0.05..0.95). */
const setTheta = (s: GameStateV2, theta: number) => { s.hidden.toleranceNoise = theta - s.hidden.doomThreshold; };

/** Reach a lab's ASI with control lost and (contested) contained: θ just under the margin containment covers. */
function asiLost(s: GameStateV2, lab: LabId, contained: boolean) {
  if (lab === 'player') s.player.milestoneDays[6] = s.time.day;
  else (lab === 'china' ? s.china.lab : s.rivals.find((r) => r.core.id === lab)!).core.milestoneDays[6] = s.time.day;
  const r = resolveAsi(s, lab);
  const cont = CONTROL.containK * (lab === 'player' ? playerContain(s) : otherContain(s, lab)) * (1 - r.lev);
  // contained: need 1 − θ/E ≤ cont → θ ≥ E(1 − cont); lost: θ < E(1 − cont). Keep θ < E either way.
  setTheta(s, contained ? r.exposure * (1 - cont / 2) : Math.min(r.exposure * (1 - cont) * 0.5, r.exposure * 0.5));
}

const CASES: Record<EndingId, (s: GameStateV2) => void> = {
  asiAligned: (s) => { setTheta(s, 0.95); s.player.milestoneDays[6] = s.time.day; run(s); },
  asiContested: (s) => { asiLost(s, rival(s).core.id, true); run(s); },
  asiTakeover: (s) => {
    for (const v of s.player.models.versions) Object.assign(v.traitsTrue, { SCHEME: 1, AF: 1, POWER: 1, SUCC: 1, COLLUDE: 1, SAND: 1, HONEST: 0, CORRIG: 0 });
    asiLost(s, 'player', false); run(s);
  },
  rivalAligned: (s) => { setTheta(s, 0.95); rival(s).core.milestoneDays[6] = s.time.day; run(s); },
  rivalTakeover: (s) => { asiLost(s, rival(s).core.id, false); run(s); },
  chinaAligned: (s) => { setTheta(s, 0.95); s.china.lab.core.milestoneDays[6] = s.time.day; run(s); },
  chinaTakeover: (s) => { asiLost(s, 'china', false); run(s); },
  overtaken: (s) => { delete s.player.milestoneDays[4]; delete s.player.milestoneDays[5]; rival(s).core.milestoneDays[5] = s.time.day; run(s); },
  catastropheBio: (s) => endGame(s, makeCtx(s), 'catastropheBio', 'none'),
  catastropheCyber: (s) => endGame(s, makeCtx(s), 'catastropheCyber', 'none'),
  war: (s) => endGame(s, makeCtx(s), 'war', 'none'), // in play: a quarterly roll at China tension 4 (world/chinagov.ts)
  rogue: (s) => {
    const v = bestPlayerVersion(s)!;
    ws4(s).loose = { day: s.time.day - 45, versionId: v.id, mis: misalignment(v.traitsTrue, v.uModes) };
    endGame(s, makeCtx(s), 'rogue', 'none');
  },
  insolvent: (s) => { s.player.finance.state = 'insolvent'; run(s); },
  ousted: (s) => { s.flags['ws3.ousterDay'] = s.time.day; run(s); },
  nationalized: (s) => { ws4(s).nationalizedHard = true; run(s); },
  acquired: (s) => { ws4(s).soldControl = true; run(s); },
  retired: (s) => { ws4(s).retired = true; run(s); },
};

/** Every number finite; every string free of '{'. Returns the offending paths. */
function walk(x: unknown, path: string, bad: string[]) {
  if (typeof x === 'number') { if (!Number.isFinite(x)) bad.push(`${path}=${x}`); }
  else if (typeof x === 'string') { if (x.includes('{') || x.includes('}')) bad.push(`${path}: ${x}`); }
  else if (Array.isArray(x)) x.forEach((y, i) => walk(y, `${path}[${i}]`, bad));
  else if (x && typeof x === 'object') for (const [k, y] of Object.entries(x)) walk(y, `${path}.${k}`, bad);
}

function shares(v: EndingView): [string, number][] {
  const out: [string, number][] = [];
  for (const d of v.world.power) { out.push([`${d.id}.aiShare`, d.aiShare]); for (const l of d.labs) out.push([`${d.id}.${l.lab}`, l.share]); }
  const w = v.hidden.why;
  if (w) for (const k of ['wouldTry', 'afterOversight', 'tolerance', 'containment', 'containmentNeeded'] as const) if (w[k] !== undefined) out.push([`why.${k}`, w[k]!]);
  for (const l of v.hidden.labs) out.push([`lab.${l.id}.truth`, l.truth], [`lab.${l.id}.lo`, l.lo], [`lab.${l.id}.hi`, l.hi]);
  for (const f of v.hidden.facts) out.push([`fact.${f.id}`, f.pos]);
  for (const a of v.hidden.agendas) out.push([`ag.${a.id}.lo`, a.lo], [`ag.${a.id}.hi`, a.hi], [`ag.${a.id}.truth`, a.truth]);
  for (const o of v.world.company.ownership) out.push([`own.${o.name}`, o.share]);
  out.push(['playerShare', v.world.company.playerShare]);
  return out;
}

const HELD: EndingId[] = ['asiAligned', 'rivalAligned', 'chinaAligned'];
const LOST: EndingId[] = ['asiTakeover', 'rivalTakeover', 'chinaTakeover'];
const epis: string[] = [];
check(endingView(load()) === null, 'no ending: endingView returns null');
for (const id of Object.keys(ENDING_TEXT) as EndingId[]) {
  const s = load();
  CASES[id](s);
  const e = s.ending;
  check(e?.id === id, `${id}: forced`, e ? `got ${e.id}` : 'no ending');
  if (!e || e.id !== id) continue;
  const v = endingView(s)!;
  const bad: string[] = [];
  walk(v, 'view', bad);
  check(!bad.length, `${id}: finite numbers, no template slots`, bad.slice(0, 3).join(' | '));
  check(v.epilogue.trim().length > 40, `${id}: epilogue non-empty`);
  const scoreBad = v.scores.filter((x) => x.value !== e.scores[x.key] || Math.abs(Math.min(100, Math.max(0, x.terms.reduce((a, t) => a + t.value, 0))) - x.value) > 0.51);
  check(!scoreBad.length, `${id}: scores = ending scores = round(clamp(Σ terms))`, scoreBad.map((x) => `${x.key} ${x.value} vs ${e.scores[x.key]} raw ${x.raw}`).join(', '));
  const out = shares(v).filter(([, x]) => x < 0 || x > 1);
  check(!out.length, `${id}: shares in 0..1`, out.slice(0, 4).map(([k, x]) => `${k}=${x}`).join(', '));
  const w = v.hidden.why;
  if (HELD.includes(id) || LOST.includes(id) || id === 'asiContested') {
    const exp = w ? (w.afterOversight ?? w.wouldTry) : NaN;
    const want = HELD.includes(id) ? 'held' : LOST.includes(id) ? 'lost' : 'contained';
    const numeric = !!w && (want === 'held' ? exp <= w.tolerance : exp > w.tolerance && (want === 'contained' ? w.containment! >= w.containmentNeeded! : w.containment! < w.containmentNeeded!));
    check(!!w && w.outcome === want && numeric, `${id}: why-gauge ${want}`, w ? `${w.outcome} exp ${exp} tol ${w.tolerance} cont ${w.containment} need ${w.containmentNeeded}` : 'no why');
  } else if (v.future.projected) {
    const ok = !w || (w.outcome === 'lost') === (e.power === 'none') && (w.outcome === 'lost') === (w.wouldTry > w.tolerance);
    check(ok, `${id}: projected why-gauge agrees with the projected power`, w ? `${w.outcome} ${w.wouldTry} vs ${w.tolerance}, power ${e.power}` : 'no projection');
  } else check(!w, `${id}: no why-gauge without a superintelligence`);
  check(v.steps.length >= 1 && v.steps.length <= 3, `${id}: 1–3 steps`, `${v.steps.length}`);
  check(v.race.labs.every((l) => l.days.length === l.level.length && l.days.length <= 150), `${id}: race series ≤ 150 points`);
  epis.push(`── ${id} (${v.future.holder}${v.future.projected ? ', projected' : ''}) ──\n${v.epilogue}\n   steps: ${v.steps.map((x) => `${x.when} ${x.title}${x.sub ? ` (${x.sub})` : ''}`).join(' → ')}`);
}
// Projection variants: an aligned projected winner, and no lab left to project.
for (const [name, prep] of [
  ['retired, projected winner holds', (s: GameStateV2) => setTheta(s, 0.95)],
  ['retired, no lab left', (s: GameStateV2) => { for (const r of [...s.rivals, s.china.lab]) r.core.status = 'bankrupt'; }],
] as const) {
  const s = load();
  prep(s);
  CASES.retired(s);
  const v = endingView(s)!;
  const bad: string[] = [];
  walk(v, 'view', bad);
  const w = v.hidden.why;
  const ok = !bad.length && v.epilogue.length > 40 && (name.includes('holds') ? w?.outcome === 'held' && s.ending!.power !== 'none' && v.future.holder === s.ending!.power : !w && v.future.holder === 'none');
  check(ok, `${name}: view consistent`, `${bad.slice(0, 2).join(' | ')} ${w?.outcome} ${s.ending?.power} ${v.future.holder}`);
  epis.push(`── ${name} (${v.future.holder}) ──\n${v.epilogue}\n   steps: ${v.steps.map((x) => `${x.when} ${x.title}${x.sub ? ` (${x.sub})` : ''}`).join(' → ')}`);
}
console.log(`\n${epis.join('\n')}\n`);
finish('endview');
