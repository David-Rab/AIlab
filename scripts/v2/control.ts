// Model v3 E9: loss of control as a process (design/MODEL-V3.md §11.4; src/engine/v2/safety/control.ts). Owner: WS2.
//   Effective control C = 1 − E, exposure E = Mis · (1 − O_eff) · (1 + F): it falls with undetected footholds and the
//   capability gap and recovers with removal and oversight; footholds grow once control is low (escaped copies acquire
//   compute, hidden compute launches more jobs, a backdoor raises exfiltration odds, an escape can go unnoticed); loss of
//   control comes only from the process (E above the world's tolerance θ_w = doomThreshold + ε_w while the AI can act),
//   never from a roll; a lab with strong oversight and no footholds keeps control through ASI; difficulty shifts the
//   threshold; the endings still resolve.
import { setControl, controlOn } from '../../src/engine/v2/safety/safeguards';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CONTROL, EXFIL } from '../../src/data/v2/danger';
import { LEVEL_KNOTS } from '../../src/data/v2/calibration';
import { TRAIT_IDS, TRAIT_START } from '../../src/data/v2/traits';
import { ws4 } from '../../src/engine/v2/actors/state';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { act, makeCtx, tick } from '../../src/engine/v2/core/loop';
import { deserialize, serialize } from '../../src/engine/v2/core/save';
import { resetWorkContext } from '../../src/engine/v2/departments/workfit';
import { resolveAsi } from '../../src/engine/v2/endings/epilogue';
import { bestPlayerVersion, internalVersion } from '../../src/engine/v2/models/labs';
import {
  asiControl, controlStep, controlTerms, controlThreshold, controlView, copyExposure, copyGrowthRate, escapeNoticed, labControl, lossThreshold, rogueCopy,
} from '../../src/engine/v2/safety/control';
import { footholdFromEscape, footholdsOf, lineageOf } from '../../src/engine/v2/safety/footholds';
import { controlDangerDelta, controlReadout } from '../../src/engine/v2/safety/dangerView';
import { applyResponse } from '../../src/engine/v2/safety/responses';
import { ACTION_BY_ID } from '../../src/engine/v2/core/registry';
import { exfiltrationHazard } from '../../src/engine/v2/safety/incidents';
import { securitySystem } from '../../src/engine/v2/security/security';
import { misalignment } from '../../src/engine/v2/safety/traits';
import { gOfLevel } from '../../src/engine/v2/models/capability';
import { toleranceNoiseOf } from '../../src/engine/v2/world/hidden';
import type { DomainId, EndingV2, Foothold, FootholdKind, GameStateV2, MilestoneIdx, ModelVersion, TraitVector } from '../../src/engine/v2/types';
import { FIXTURE_DIR, HERE, check, finish } from './lib';

const DOMS: DomainId[] = ['CODE', 'RSCH', 'REASON', 'AGENCY', 'SOCIAL', 'MEDIA', 'CYBER', 'BIO', 'PHYS'];
const f3 = (x: number) => x.toFixed(3);
const fixture = (n: string) => deserialize(readFileSync(join(FIXTURE_DIR, n), 'utf8'));
const routine = (s: GameStateV2) => s.player.models.versions.find((x) => x.id === s.player.agents.capRoutine.versionId)!;
const setLevel = (v: ModelVersion, L: number) => { v.Lg = L; for (const d of DOMS) v.domains[d] = L; };
/** The day-400 lab with every model at level L and a moderate misaligned disposition (Mis ≈ 0.4). */
function lab(L = 12): GameStateV2 {
  const s = fixture('day400.json');
  for (const v of s.player.models.versions) {
    v.traitsTrue = { ...TRAIT_START, SCHEME: 0.6, POWER: 0.6, AF: 0.4, SUCC: 0.3 };
    v.uModes = [];
    setLevel(v, L);
  }
  resetWorkContext(s);
  return s;
}
let nid = 100;
function plant(s: GameStateV2, kind: FootholdKind, v: ModelVersion, size: number, extra: Partial<Foothold> = {}): Foothold {
  const f: Foothold = { id: `FT${nid++}`, kind, versionId: v.id, lineage: lineageOf(s, v), day: s.time.day, acts: 1, severity: 3, size, status: 'hidden', ...extra };
  s.player.safety.footholds.push(f);
  return f;
}
/** Strong oversight: the control layer on every internal deployment and every AG07 containment tool real and full
 *  strength at any capability (efficacy 1, no decay). */
function strongOversight(s: GameStateV2) {
  for (const d of s.player.deployments) if (d.channel === 'internal') setControl(d, true); for (const a of Object.values(s.player.agents)) a.control = true;
  s.hidden.agendaEfficacy.AG07 = 1;
  for (const t of Object.values(s.player.safety.techniques)) {
    if (t.agenda !== 'AG07') continue;
    Object.assign(t, { unlocked: true, active: true, falseValidated: false, oHalf: 99, trainedAgainst: 0 });
  }
}

// ───────────── control falls with undetected footholds and the capability gap ─────────────
{
  const s = lab(12);
  const v = routine(s);
  const t0 = controlTerms(s, v);
  check(Math.abs(t0.exposure - t0.mis * (1 - t0.oEff) * (1 + t0.F)) < 1e-12 && t0.F === 0 && Math.abs(t0.control - (1 - t0.exposure)) < 1e-12 && t0.mis > 0.3,
    'control: C = 1 − E, E = Mis · (1 − O_eff) · (1 + F) (no footholds: F = 0)', `Mis ${f3(t0.mis)}, O_eff ${f3(t0.oEff)}, E ${f3(t0.exposure)}, C ${f3(t0.control)}`);
  const bd = plant(s, 'backdoor', v, 0.5);
  const t1 = controlTerms(s, v);
  const hc = plant(s, 'hiddenCompute', v, 0.02 * (s.player.computeOnline + 1));
  const t2 = controlTerms(s, v);
  const cp = plant(s, 'exfiltratedCopy', v, 1, { mis: t0.mis, status: 'detected' });
  const t3 = controlTerms(s, v);
  const ss = plant(s, 'steeredSuccessor', v, 0.1, { ref: v.id, delta: { SCHEME: 0.05, POWER: 0.05 } });
  const t4 = controlTerms(s, v);
  check(t1.reach > 0.49 && t1.oEff < t0.oEff && t1.control < t0.control, 'control: a hidden backdoor (reach 0.5) bypasses half of block and catch: oversight and control fall',
    `O_eff ${f3(t0.oEff)} → ${f3(t1.oEff)}, C ${f3(t0.control)} → ${f3(t1.control)}`);
  check(t2.hiddenCompute > 0.3 && t2.control < t1.control, 'control: hidden compute (≈ 2% of the fleet) adds capacity outside oversight (F += share ÷ 5%)', `F ${f3(t2.F)}, C ${f3(t2.control)}`);
  check(Math.abs(t3.copies - CONTROL.copyBase) < 1e-12 && t3.control < t2.control, 'control: an escaped copy (even a located one, outside the lab) adds 0.25', `F ${f3(t3.F)}, C ${f3(t3.control)}`);
  check(Math.abs(t4.steered - CONTROL.steeredPerPull * 0.1) < 1e-12 && t4.control < t3.control, 'control: a steered successor in the lineage adds 2·Σ|δ|', `F ${f3(t4.F)}, C ${f3(t4.control)}`);
  // Capability gap: the same model 3 levels above its overseers' reach (human review falls, monitors at a larger gap).
  const g = lab(12);
  const gv = routine(g);
  const lo = controlTerms(g, gv);
  for (const x of g.player.models.versions) setLevel(x, 15);
  const hi = controlTerms(g, gv);
  check(hi.oversight < lo.oversight && hi.control < lo.control && Math.abs(hi.mis - lo.mis) < 1e-12, 'control: a wider capability gap over its overseers (L12 → L15, same Mis) lowers oversight and control',
    `O ${f3(lo.oversight)} → ${f3(hi.oversight)}, C ${f3(lo.control)} → ${f3(hi.control)}`);

  // ───────────── recovery: location, removal, oversight ─────────────
  bd.status = 'detected';
  hc.status = 'detected';
  const r1 = controlTerms(s, v);
  check(r1.control > t4.control && r1.control < t0.control, 'recovery: located footholds act at half weight (control partly back)', `C ${f3(t4.control)} → ${f3(r1.control)}`);
  for (const f of [bd, hc, cp, ss]) f.status = 'removed';
  const r2 = controlTerms(s, v);
  check(Math.abs(r2.control - t0.control) < 1e-12, 'recovery: removed footholds (and a captured copy) no longer count: control back to its foothold-free level', `C ${f3(r2.control)} vs ${f3(t0.control)}`);
  strongOversight(s);
  const r3 = controlTerms(s, v);
  check(r3.oEff > r2.oEff + 0.2 && r3.control > r2.control, 'recovery: stronger oversight (control layer, strong containment) raises control', `O_eff ${f3(r2.oEff)} → ${f3(r3.oEff)}, C ${f3(r2.control)} → ${f3(r3.control)}`);
  const n = newGame(defaultSetupV2({ seed: 4, alignment: 'medium', tutorial: false }));
  check(n.player.safety.effectiveControl.level === 1 && footholdsOf(n).length === 0, 'state: a new game starts at full control with no footholds');
  const sv = clone(s);
  controlStep(sv, makeCtx(sv));
  const lc = labControl(sv)!;
  const view = controlView(sv);
  check(sv.player.safety.effectiveControl.level === Math.round(lc.control * 1e4) / 1e4 && view.believed === sv.player.safety.effectiveControl.believed && !('level' in view) && !('exposure' in view),
    'state: the daily step stores the lab\'s lowest control; the view shows only the believed estimate', `C ${f3(lc.control)} (${lc.versionId}), believed ${f3(view.believed)}`);
}
function clone<T>(x: T): T { return JSON.parse(JSON.stringify(x)); }

// ───────────── E15: believed control reads no hidden truth ─────────────
for (const fx of ['day400.json', 'day900.json']) {
  const s = fixture(fx);
  strongOversight(s); // the control layer on, so containment counts
  resetWorkContext(s);
  controlStep(s, makeCtx(s));
  const before = controlView(s);
  const r0 = controlReadout(s);
  const p = clone(s);
  // Hidden truth only: true tool strengths (efficacy, false validation), true masks, undiscovered U-modes, true traits
  // and true levels of every model.
  for (const a of Object.keys(p.hidden.agendaEfficacy)) p.hidden.agendaEfficacy[a as keyof typeof p.hidden.agendaEfficacy] = 0.05;
  for (const t of Object.values(p.player.safety.techniques)) t.falseValidated = true;
  const hiddenU = (['U19', 'U03', 'U07'] as const).filter((u) => !p.player.safety.discoveredUModes.includes(u));
  for (const v of p.player.models.versions) {
    for (const k of TRAIT_IDS) v.masks[k] = { BB: 0.9, COT: 0.9, WB: 0.9 };
    v.uModes = [...new Set([...v.uModes, ...hiddenU])];
    v.traitsTrue = { ...v.traitsTrue, SCHEME: 1, POWER: 1, CONCEAL: 1 };
    v.Lg += 2;
  }
  resetWorkContext(p);
  controlStep(p, makeCtx(p));
  const after = controlView(p);
  const r1 = controlReadout(p);
  check(after.believed === before.believed && after.versionId === before.versionId && r1.oversight === r0.oversight && r1.mis === r0.mis && p.player.safety.effectiveControl.level !== s.player.safety.effectiveControl.level,
    `E15 (${fx}): perturbing hidden truth (tool strengths, masks, undiscovered U-modes, traits, levels) leaves believed control and its model unchanged (true control moves)`,
    `believed ${before.believed} (${before.versionId}) → ${after.believed} (${after.versionId}); true ${s.player.safety.effectiveControl.level} → ${p.player.safety.effectiveControl.level}`);
}

// ───────────── footholds grow once control is low ─────────────
{
  // Hidden compute: grows with its lineage's exposure; not at all with an aligned fleet.
  const s = lab(12);
  const v = routine(s);
  for (const x of s.player.models.versions) x.traitsTrue = { ...x.traitsTrue, SCHEME: 1, POWER: 1, AF: 1, SUCC: 1, COLLUDE: 1, HONEST: 0, CORRIG: 0 };
  const h0 = 0.1 * s.player.computeOnline * (s.player.split.routine + s.player.split.frontier); // inside the agent pool it hides in
  const hc = plant(s, 'hiddenCompute', v, h0);
  const e = controlTerms(s, v).exposure;
  const ctx = makeCtx(s);
  for (let d = 0; d < 30; d++) controlStep(s, ctx);
  const want = h0 * Math.pow(1 + CONTROL.hidCompGrowth * e * s.hidden.difficultyMult, 30);
  const a = lab(12);
  const av = routine(a);
  for (const x of a.player.models.versions) x.traitsTrue = { ...TRAIT_START, SCHEME: 0, POWER: 0, AF: 0, SUCC: 0, HONEST: 1, CORRIG: 1 };
  const ah = plant(a, 'hiddenCompute', av, h0);
  for (let d = 0; d < 30; d++) controlStep(a, makeCtx(a));
  check(hc.size > h0 * 1.05 && Math.abs(hc.size / want - 1) < 0.05 && Math.abs(ah.size - h0) < 1e-6 * h0,
    'growth: hidden compute launches more jobs the less the lab sees (1/120 per day × E × D_w); an aligned fleet (E = 0) adds none',
    `30 d at E ${f3(e)}: ×${f3(hc.size / h0)} (rule ×${f3(want / h0)}); aligned ×${f3(ah.size / h0)}`);
  // Escaped copy: acquires compute (doubling in 30 d · misRef/Mis / D_w / (1 − cyber defence)).
  const c = lab(12);
  const cv = routine(c);
  const cp = footholdFromEscape(c, c.time.day, cv, 0.4);
  const rate = copyGrowthRate(c, cp);
  for (let d = 0; d < 30; d++) controlStep(c, makeCtx(c));
  check(Math.abs(cp.size - Math.pow(2, 30 * rate)) < 1e-9 && cp.size > 1.3, 'growth: an escaped copy acquires compute (×2 per 30 d at Mis 0.4, D_w 1, no cyber defence)',
    `30 d: ${f3(cp.size)} copies (D_w ${f3(c.hidden.difficultyMult)})`);
  // Backdoor: raises exfiltration odds (its reach bypasses weight security and containment).
  const x = lab(14);
  const xv = internalVersion(x)!;
  setLevel(xv, 14);
  for (const d of x.player.deployments) if (d.channel === 'internal') setControl(d, true); for (const a of Object.values(x.player.agents)) a.control = true;
  const p0 = exfiltrationHazard(x);
  plant(x, 'backdoor', xv, 0.5);
  const p1 = exfiltrationHazard(x);
  check(p0 > 0 && p1 > p0 * 1.2, 'growth: a backdoor raises the exfiltration hazard (reach bypasses weight security and containment)', `${p0.toExponential(2)} → ${p1.toExponential(2)} per day`);
  // Unnoticed escape: security notices with P = C (hash draws over many days).
  const u = lab(12);
  const uv = routine(u);
  const cu = controlTerms(u, uv).control;
  let seen = 0;
  const N = 4000;
  for (let d = 0; d < N; d++) if (escapeNoticed(u, uv, d)) seen++;
  check(Math.abs(seen / N - cu) < 0.03, 'growth: an escape goes unnoticed with P = 1 − C (a hidden copy: no alert, no hunt)', `noticed ${f3(seen / N)} vs C ${f3(cu)}`);
  // Integration: the security system books an unnoticed escape as a hidden copy (no loose record, no E25).
  // (κ × 1000 so escapes happen every few days; restored after.)
  const w = lab(14);
  for (const y of w.player.models.versions) y.traitsTrue = { ...y.traitsTrue, SCHEME: 0.7, POWER: 0.7, AF: 0.5, SUCC: 0.5 };
  const kappa = EXFIL.kappa;
  EXFIL.kappa *= 1000;
  let hidden = 0;
  let loud = 0;
  for (let k = 0; k < 400 && (hidden === 0 || loud === 0); k++) {
    w.time.day += 1;
    const before = footholdsOf(w).length;
    securitySystem.run(w, makeCtx(w));
    for (const f of footholdsOf(w).slice(before)) {
      if (f.kind !== 'exfiltratedCopy') continue;
      if (f.status === 'hidden' && !ws4(w).loose) hidden++;
      if (f.status === 'detected' && ws4(w).loose?.day === w.time.day) loud++;
    }
    delete ws4(w).loose;
  }
  EXFIL.kappa = kappa;
  check(hidden > 0 && loud > 0, 'growth: escapes split into noticed (located, the hunt) and unnoticed (hidden, no alert) copies', `${loud} noticed, ${hidden} unnoticed`);
}

// ───────────── loss of control only through the process ─────────────
{
  // No roll left: no engine file draws a chance on P_mis, the doom curve or doomThreshold.
  const engineDir = join(HERE, '..', '..', 'src', 'engine', 'v2');
  const files: string[] = [];
  const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.ts')) files.push(p); } };
  walk(engineDir);
  const bad: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/chance\(([^;\n]*)/g)) if (/pMis|doomThreshold|sigmoid\(\s*\(\s*\w*mis/i.test(m[1])) bad.push(`${f.split(/[\\/]/).slice(-2).join('/')}: chance(${m[1].slice(0, 60)}`);
  }
  check(bad.length === 0, 'process: no engine file rolls a chance on P_mis, the doom curve or doomThreshold (no single-roll path)', bad.join('; ') || `${files.length} files scanned`);
  // Deterministic given the state: resolveAsi takes no RNG, and the endings system gives the same ASI ending whatever the
  // 'endings' stream holds.
  const s = lab(15);
  s.player.milestoneDays[6] = s.time.day;
  const ids = new Set<string>();
  for (let k = 1; k <= 12; k++) {
    const y = clone(s);
    y.rng.endings = (k * 2246822519) >>> 0;
    tick(y);
    ids.add(y.ending?.id ?? 'none');
  }
  const r = resolveAsi(s, 'player');
  check(ids.size === 1 && [...ids][0] === r.id && resolveAsi.length === 2, 'process: the ASI ending is a function of the state (12 RNG states, one ending; resolveAsi takes no RNG)', `${[...ids].join(', ')}; E ${f3(r.exposure)} vs θ_w ${f3(r.threshold)}`);
  // Crossing: the same lab keeps control at ASI with E just under θ_w and loses it just over (Mis scaled).
  const near = (k: number) => {
    const y = lab(15);
    y.player.milestoneDays[6] = y.time.day;
    const v = bestPlayerVersion(y)!;
    const t = asiControl(y)!;
    const scale = (k * lossThreshold(y)) / t.exposure;
    for (const x of y.player.models.versions) for (const id of TRAIT_IDS) if (id !== 'HONEST' && id !== 'CORRIG') x.traitsTrue[id] = Math.min(1, x.traitsTrue[id] * scale);
    void v;
    return resolveAsi(y, 'player');
  };
  const under = near(0.9);
  const over = near(1.1);
  check(!under.misaligned && under.id === 'asiAligned' && over.misaligned && over.id === 'asiTakeover', 'process: control is lost at ASI exactly when exposure crosses θ_w (0.9·θ_w kept, 1.1·θ_w lost)',
    `E ${f3(under.exposure)} → ${under.id}; E ${f3(over.exposure)} → ${over.id}; θ_w ${f3(under.threshold)}`);
  // An escaped copy acts only once grown, above θ_w, with the frontier at SAR.
  const c = lab(12);
  const cv = routine(c);
  const thr = lossThreshold(c);
  // RD-L05: "the frontier at SAR" is the SAR milestone record (the predicate on the build's work fit), not a level.
  const md = c.player.milestoneDays;
  for (let i = 0; i <= 4; i++) md[i as MilestoneIdx] ??= c.time.day;
  const cp = footholdFromEscape(c, c.time.day, cv, Math.min(1, thr / 1.1));
  const small = rogueCopy(c);
  cp.size = 4; // 1 + 0.25·2 = 1.5× → above θ_w
  const grown = rogueCopy(c);
  delete md[4];
  const early = rogueCopy(c);
  check(!small && grown === cp && !early && copyExposure(c, cp) > thr, 'process: an escaped copy takes control only once it holds ≥ 2 copies, its exposure is above θ_w and the frontier is at SAR',
    `exposure ${f3(copyExposure(c, cp))} vs θ_w ${f3(thr)}`);
}

// ───────────── strong oversight, no footholds: control kept through ASI ─────────────
{
  const s = lab(15);
  for (const v of s.player.models.versions) v.traitsTrue = { ...v.traitsTrue, SCHEME: 0.8, POWER: 0.8, AF: 0.6, SUCC: 0.6 };
  s.player.milestoneDays[6] = s.time.day;
  const v = bestPlayerVersion(s)!;
  const mis = misalignment(v.traitsTrue, v.uModes);
  const weak = resolveAsi(s, 'player');
  strongOversight(s);
  const strong = resolveAsi(s, 'player');
  const y = clone(s);
  tick(y);
  check(mis > lossThreshold(s) && weak.misaligned && !strong.misaligned && strong.id === 'asiAligned' && y.ending?.id === 'asiAligned' && footholdsOf(s).length === 0,
    'ASI: a misaligned model (Mis above θ_w) under strong oversight with no footholds stays under control (asiAligned); without the oversight control is lost',
    `Mis ${f3(mis)}, θ_w ${f3(lossThreshold(s))}; E ${f3(weak.exposure)} → ${weak.id}; strong oversight E ${f3(strong.exposure)} → ${strong.id}`);
}

// ───────────── difficulty shifts the threshold ─────────────
{
  const s = lab(15);
  s.player.milestoneDays[6] = s.time.day;
  const e = asiControl(s)!.exposure;
  s.hidden.toleranceNoise = 0;
  s.hidden.doomThreshold = e + 0.05;
  const easy = resolveAsi(s, 'player');
  const cEasy = controlThreshold(s);
  s.hidden.doomThreshold = e - 0.05;
  const hard = resolveAsi(s, 'player');
  check(!easy.misaligned && hard.misaligned && controlThreshold(s) > cEasy, 'difficulty: a lower doomThreshold (harder world) raises the control the lab needs; the same state keeps control in the easy world and loses it in the hard one',
    `C needed ${f3(cEasy)} → ${f3(controlThreshold(s))}; E ${f3(e)}`);
  // Over worlds, with no oversight and no footholds, P(loss | Mis) is v1's σ((Mis − θ)/0.06).
  const mis = 0.45;
  let lost = 0;
  const N = 20000;
  for (let seed = 1; seed <= N; seed++) if (mis > 0.4 + toleranceNoiseOf(seed)) lost++;
  const want = 1 / (1 + Math.exp(-(mis - 0.4) / 0.06));
  check(Math.abs(lost / N - want) < 0.01, 'difficulty: the world\'s tolerance noise reproduces v1\'s doom curve over worlds (Mis 0.45, θ 0.4)', `${f3(lost / N)} vs σ = ${f3(want)}`);
  // D_w sets how fast footholds grow (an escaped copy's compute).
  const c = lab(12);
  const cp = footholdFromEscape(c, c.time.day, routine(c), 0.4);
  const r1 = copyGrowthRate(c, cp);
  c.hidden.difficultyMult *= 1.5;
  check(Math.abs(copyGrowthRate(c, cp) / r1 - 1.5) < 1e-9, 'difficulty: the world\'s difficulty D_w scales foothold growth (×1.5 D_w → ×1.5 copy growth)');
}

// ───────────── the endings still resolve ─────────────
{
  const BAD: TraitVector = Object.fromEntries(TRAIT_IDS.map((t) => [t, t === 'HONEST' || t === 'CORRIG' ? 0 : 1])) as TraitVector;
  const W = (seed: number) => newGame(defaultSetupV2({ seed, alignment: 'medium', tutorial: false }));
  const setups: Partial<Record<EndingV2['id'], (s: GameStateV2) => void>> = {
    asiAligned: (s) => { internalVersion(s)!.traitsTrue = { ...TRAIT_START }; s.player.milestoneDays[6] = 0; },
    asiTakeover: (s) => { internalVersion(s)!.traitsTrue = { ...BAD }; s.player.milestoneDays[6] = 0; },
    asiContested: (s) => {
      s.player.milestoneDays[6] = 0;
      for (const d of s.player.deployments) if (d.channel === 'internal') setControl(d, true); for (const a of Object.values(s.player.agents)) a.control = true;
      s.flags['ws2.gatekeeper'] = s.time.day;
      const gate = s.player.safety.techniques['T-GATE'];
      if (gate) Object.assign(gate, { unlocked: true, active: true, falseValidated: false });
      s.player.safety.agendas.AG10.status = 'active';
      s.hidden.agendaEfficacy.AG10 = 0.9;
      // Exposure just over the tolerance (1.1 θ_w): a narrow loss that containment can hold.
      const scale = (1.1 * lossThreshold(s)) / Math.max(1e-9, asiControl(s)!.exposure);
      for (const x of s.player.models.versions) for (const id of TRAIT_IDS) if (id !== 'HONEST' && id !== 'CORRIG') x.traitsTrue[id] = Math.min(1, x.traitsTrue[id] * scale);
    },
    rivalAligned: (s) => { s.rivals[0].core.milestoneDays[6] = 0; s.rivals[0].internal.traitsTrue = { ...TRAIT_START }; },
    rivalTakeover: (s) => { s.rivals[0].core.milestoneDays[6] = 0; s.rivals[0].internal.traitsTrue = { ...BAD }; },
    chinaAligned: (s) => { s.china.lab.core.milestoneDays[6] = 0; s.china.lab.internal.traitsTrue = { ...TRAIT_START }; },
    chinaTakeover: (s) => { s.china.lab.core.milestoneDays[6] = 0; s.china.lab.internal.traitsTrue = { ...BAD }; },
    rogue: (s) => {
      const v = internalVersion(s)!;
      v.Lg = LEVEL_KNOTS[4] + 0.1;
      v.G = gOfLevel(s.hidden.timeline, LEVEL_KNOTS[4]) + 0.01;
      // RD-L05: the rogue gate is the SAR milestone record (the predicate reads the build's work fit, not G): force it.
      for (let i = 0; i <= 4; i++) s.player.milestoneDays[i as MilestoneIdx] ??= s.time.day;
      footholdFromEscape(s, s.time.day, v, 1).size = 4;
    },
  };
  const missing: string[] = [];
  const seen: string[] = [];
  for (const [id, setup] of Object.entries(setups) as [EndingV2['id'], (s: GameStateV2) => void][]) {
    let hit = false;
    for (let seed = 1; seed <= 40 && !hit; seed++) {
      const s = W(seed);
      setup(s);
      for (let d = 0; d < 3 && !s.ending; d++) tick(s);
      hit = s.ending?.id === id;
      if (hit) seen.push(`${id}${s.ending!.epilogue.controlAtAsi !== undefined ? ` (C ${s.ending!.epilogue.controlAtAsi})` : ''}`);
    }
    if (!hit) missing.push(id);
  }
  check(missing.length === 0, 'endings: every ASI and rogue ending type still resolves from forced states (no roll)', missing.length ? `missing ${missing.join(', ')}` : seen.join('; '));
  // Company-loss epilogue: the competitor's outcome is deterministic in its projected Mis vs θ_w.
  const powers = new Set<string>();
  for (let k = 1; k <= 6; k++) {
    const s = W(7);
    s.flags['ws3.ousterDay'] = s.time.day;
    s.rng.endings = (k * 2654435761) >>> 0;
    tick(s);
    powers.add(`${s.ending?.id}/${s.ending?.power}`);
  }
  check(powers.size === 1 && [...powers][0].startsWith('ousted/'), 'endings: a company-loss epilogue resolves the competitor without a roll (same power under 6 RNG states)', [...powers].join(', '));
}

// ───────────── save: a new game's tolerance noise and control record round-trip (RD-C03: saves below rev 33 no longer load) ─────────────
{
  const fresh = newGame(defaultSetupV2({ seed: 3 }));
  const back = deserialize(serialize(fresh));
  check(back.hidden.toleranceNoise === fresh.hidden.toleranceNoise && fresh.hidden.toleranceNoise === toleranceNoiseOf(3) && back.player.safety.effectiveControl.level === 1, 'save: a new game carries its tolerance noise and control record and round-trips');
}

// Model v3 F6 (lead decision): the control layer can be turned off — the Remove control response, symmetrical to Add
// control, with a preview of the tax saved and the believed danger change (dangerView's estimate, beliefs only).
{
  const s = fixture('day400.json');
  resetWorkContext(s);
  const iv = s.player.deployments.find((d) => d.channel === 'internal' && d.status === 'live')!;
  const vid = iv.versionId;
  act(s, 'safety.respond', { kind: 'addControl', versionId: vid });
  const on = controlReadout(s);
  check(on.layer && on.layerVersionId === vid, 'F6 off switch: Add control turns the layer on and the readout names its model', `${on.layer} ${on.layerVersionId}`);
  const pv = ACTION_BY_ID.get('safety.respond')!.preview(s, { kind: 'removeControl', versionId: vid });
  const dd = controlDangerDelta(s, vid, false);
  const prog = pv.gains.find((c) => c.currency === 'progress');
  const ex = pv.exposure.find((c) => c.unit === 'acts/yr');
  check(!!prog && prog.amount > 0 && prog.amount === Math.round(on.tax * 100) && prog.unit === "%" && dd.sites > 0 && dd.after >= dd.now && !!ex && pv.costs.some((c) => c.currency === 'security'),
    'F6 off switch: the Remove control preview shows the tax saved and the believed danger with the layer off', `tax ${prog?.amount}; harmful ${dd.now.toFixed(3)} → ${dd.after.toFixed(3)} /yr at ${dd.sites} sites; ${ex?.target}`);
  act(s, 'safety.respond', { kind: 'removeControl', versionId: vid });
  const off = controlReadout(s);
  const again = applyResponse(s, makeCtx(s), 'removeControl', vid);
  check(!off.layer && !s.player.deployments.some((d) => d.versionId === vid && controlOn(d)) && again === 'No control layer on this model',
    'F6 off switch: Remove control turns the layer off on every deployment of the model; a second removal is refused', `${off.layer} / ${again}`);
}

finish('control');
