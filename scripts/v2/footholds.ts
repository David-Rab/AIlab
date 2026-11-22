// Model v3 E8: footholds (design/MODEL-V3.md §11.4; src/engine/v2/safety/footholds.ts, footholdDetection.ts). Owner: WS2.
//   Uncaught covert acts and escapes leave countable hidden AI assets: a backdoor (raises its lineage's later covert
//   success), hidden compute (subtracted from usable compute), a steered successor (carries the steered pull), a
//   corrupted safety tool (masks), an exfiltrated copy. Checks: each act kind creates its foothold kind (and grows it);
//   effects; suspicion (monitors, compute accounting, eval drift, model organisms, caught-act sweeps) and location (cases)
//   at their stated probabilities; removal clears the effect and costs what the preview says; the player's view never
//   shows hidden footholds; the 2025 start makes ≈ none; a schemaRev-30 save migrates (E8 built as 25 → 26, renumbered in M5).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FOOTHOLD } from '../../src/data/v2/danger';
import { WORK_TYPES } from '../../src/data/v2/workTypes';
import { computeOnlineOf, computeOnlineSystem, poolsOf } from '../../src/engine/v2/compute/power';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { makeCtx } from '../../src/engine/v2/core/loop';
import { ACTION_BY_ID } from '../../src/engine/v2/core/registry';
import { SCHEMA_REV, deserialize, serialize } from '../../src/engine/v2/core/save';
import { resetWorkContext } from '../../src/engine/v2/departments/workfit';
import { securitySystem } from '../../src/engine/v2/security/security';
import { ws4 } from '../../src/engine/v2/actors/state';
import { covertOutcome, covertRecord, internalFleetCompute, dayTerms, fleetCovertTerms, itemTerms, noteCovert, rdParts, rollFleetCovert, safetySabotage, steerSuccessor } from '../../src/engine/v2/safety/covert';
import { caseOdds, caseOnModel, footholdView, footholdsStep, removalPreview, suspicionRate } from '../../src/engine/v2/safety/footholdDetection';
import { backdoorReach, escapeResolved, footholdsOf, hiddenComputeH, lineageOf } from '../../src/engine/v2/safety/footholds';
import { fireFinding, revealFalse } from '../../src/engine/v2/safety/findings';
import { resolveInvestigation, safetyReHeads } from '../../src/engine/v2/safety/investigations';
import { patchFte } from '../../src/engine/v2/safety/responses';
import { resetSafAllocation, lineLabour } from '../../src/engine/v2/safety/lineProjects';
import { pulledTraits, successorPull } from '../../src/engine/v2/safety/traits';
import type { DomainId, Foothold, GameStateV2, Investigation, ModelVersion } from '../../src/engine/v2/types';
import { FIXTURE_DIR, check, finish } from './lib';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const DOMS: DomainId[] = ['CODE', 'RSCH', 'REASON', 'AGENCY', 'SOCIAL', 'MEDIA', 'CYBER', 'BIO', 'PHYS'];
const atLevel = (v: ModelVersion, L: number) => { for (const d of DOMS) v.domains[d] = L; };
const fixture = (n: string) => deserialize(readFileSync(join(FIXTURE_DIR, n), 'utf8'));
const f3 = (x: number) => x.toFixed(3);
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
/** A lab whose models all scheme and seek power at level L (day-400 fixture: monitors still catch some). */
const scheming = (L = 12, extra: Partial<Record<'SUCC' | 'SAND', number>> = {}) => {
  const s = fixture('day400.json');
  for (const v of s.player.models.versions) {
    v.traitsTrue.SCHEME = 1; v.traitsTrue.POWER = 1; v.traitsTrue.SUCC = extra.SUCC ?? 0; v.traitsTrue.SAND = extra.SAND ?? 0;
    v.uModes = [];
    atLevel(v, L);
  }
  resetWorkContext(s);
  return s;
};
const routine = (s: GameStateV2) => s.player.models.versions.find((x) => x.id === s.player.agents.capRoutine.versionId)!;
/** Book one uncaught act of `act` by model v (severity draw u). */
const uncaught = (s: GameStateV2, act: 'BACKDOOR' | 'HIDCOMP', v: ModelVersion, u = 0.5) => noteCovert(s, makeCtx(s), v, dayTerms(s, v, act, 1), 'uncaught', u);

// ───────────── creation: each act kind leaves its foothold kind ─────────────
{
  const s = scheming();
  const v = routine(s);
  const day = s.time.day;
  const a = uncaught(s, 'BACKDOOR', v)!;
  const b = uncaught(s, 'HIDCOMP', v)!;
  const pool = internalFleetCompute(s);
  check(!!a && a.kind === 'backdoor' && a.versionId === v.id && a.lineage === lineageOf(s, v) && a.day === day && a.status === 'hidden' && Math.abs(a.size - FOOTHOLD.reachPerSev * a.severity) < 1e-12,
    'creation: an uncaught BACKDOOR act leaves a hidden backdoor (maker, lineage, day; reach 0.08 per severity point)', a ? `${a.id} severity ${a.severity}, reach ${f3(a.size)}` : 'none');
  check(!!b && b.kind === 'hiddenCompute' && b.status === 'hidden' && Math.abs(b.size - FOOTHOLD.hidCompPerSev * b.severity * pool) < 1e-6,
    'creation: an uncaught HIDCOMP act leaves a hidden compute reservation (1% of the agent pool per severity point, in H100e)', b ? `${b.id} severity ${b.severity}, ${Math.round(b.size)} H100e of a ${Math.round(pool)} H100e agent pool` : 'none');
  const a2 = uncaught(s, 'BACKDOOR', v, 0.9);
  const b2 = uncaught(s, 'HIDCOMP', v, 0.9);
  check(a2 === a && a.acts === 2 && b2 === b && b.acts === 2 && footholdsOf(s).length === 2 && covertRecord(s, 'BACKDOOR').n === 2 && covertRecord(s, 'HIDCOMP').sev === b.severity,
    'creation: further acts by the same lineage grow its hidden foothold (count and severity; E7\'s records now read the footholds)', `backdoor reach ${f3(a.size)}, hidden compute ${Math.round(b.size)} H100e`);
  a.status = 'detected';
  const a3 = uncaught(s, 'BACKDOOR', v);
  check(!!a3 && a3 !== a && a3.kind === 'backdoor', 'creation: once a backdoor is located, a new act plants a new one');
  // Integration: the daily roll books uncaught acts as footholds and nothing else.
  const r = scheming();
  const ctx = makeCtx(r);
  for (let d = 0; d < 20000; d++) { r.time.day += 1; rollFleetCovert(r, ctx); }
  const kinds = new Set(footholdsOf(r).map((f) => f.kind));
  const n = covertRecord(r, 'BACKDOOR').n + covertRecord(r, 'HIDCOMP').n;
  check(kinds.has('backdoor') && kinds.has('hiddenCompute') && footholdsOf(r).every((f) => f.kind === 'backdoor' || f.kind === 'hiddenCompute') && n === footholdsOf(r).reduce((x, f) => x + f.acts, 0) && !Object.keys(r.flags).some((k) => /covert\.(BACKDOOR|HIDCOMP)\.(n|sev)$/.test(k)),
    'creation: 20000 days of the fleets\' daily roll leave backdoors and hidden compute footholds (no flag records left)', `${footholdsOf(r).length} footholds from ${n} uncaught acts`);
}
{
  // Successor steering: an uncaught act on a run leaves a steered successor linked to the model it made.
  const s = scheming(12, { SUCC: 1 });
  const ctx = makeCtx(s);
  const x0 = { ...s.player.models.versions[0].traitsTrue, SUCC: 0, SCHEME: 0 };
  let k = 0;
  let x = x0;
  while (k < 300 && !footholdsOf(s).some((f) => f.kind === 'steeredSuccessor')) x = pulledTraits(s, ctx, { id: `R${k++}` }, x0, 'VNEW');
  const f = footholdsOf(s).find((y) => y.kind === 'steeredSuccessor');
  const e4 = successorPull(s);
  check(!!f && f.ref === 'VNEW' && (f.delta?.SUCC ?? 0) > 0 && f.size > 0 && Math.abs((x.SUCC - x0.SUCC) - (f.delta?.SUCC ?? 0) - e4.parts.reduce((a, p) => a + p.omega * ((s.player.models.versions.find((q) => q.id === p.versionId)?.traitsTrue.SUCC ?? 0) - x0.SUCC), 0)) < 1e-9,
    'creation: an uncaught successor-steering act leaves a steered successor on the model the run made (its delta = the steered part of the pull)', f ? `after ${k} runs: SUCC +${f3(f.delta?.SUCC ?? 0)} beyond E4's pull, extra ω ${f3(f.size)}` : 'none');
  const p0 = successorPull(s);
  const again = steerSuccessor(s, ctx, p0, 'VNEW-run');
  check(again === p0 || footholdsOf(s).filter((y) => y.kind === 'steeredSuccessor').length >= 1, 'creation: successor steering still returns E4\'s pull unless an act got through');
}
{
  // Sabotage of safety research: a FALSE finding is a corrupted-tool foothold (the masking technique).
  const s = newGame(defaultSetupV2({ seed: 6, alignment: 'medium' }));
  const v = s.player.models.versions[0];
  v.uModes = [];
  v.traitsTrue.SAND = 0.5; v.traitsTrue.SCHEME = 0.5;
  s.player.policies.trustedToAI = 1;
  if (v.build) v.build.dg += 6;
  s.player.agents.safety.compute = 0.3;
  resetSafAllocation(s);
  s.player.policies.publishSafety = 'none';
  const ctx = makeCtx(s);
  let i = 0;
  while (i++ < 3000 && !footholdsOf(s).some((f) => f.kind === 'corruptedTool' && f.ref)) {
    const snapF = s.player.safety.findings.length;
    fireFinding(s, ctx, 'AG08');
    if (s.player.safety.findings.length > snapF + 50) break;
  }
  const f = footholdsOf(s).find((x) => x.kind === 'corruptedTool');
  const t = f?.ref ? s.player.safety.techniques[f.ref] : undefined;
  check(!!f && !!t && t.falseValidated && t.unlocked && f.size === t.s0 && f.status === 'hidden' && footholdsOf(s).every((x) => x.kind === 'corruptedTool' && !!x.ref),
    'creation: an uncaught safety-sabotage act (a FALSE finding) leaves a corrupted-tool foothold on its masking technique', f ? `${f.id} → ${f.ref} (s0 ${t?.s0}) after ${i} results` : `none in ${i}`);
  if (f?.ref) {
    revealFalse(s, ctx, f.ref);
    check(f.status === 'removed' && f.detectedDay === s.time.day, 'detection: the cross-check that exposes a masking tool locates and removes its foothold');
  }
}
{
  // Exfiltration (security system, E25): the escaped copy is a located foothold; the hunt removes it, "went quiet" leaves it suspected.
  const s = scheming(15);
  s.player.security.wsl = 1;
  const ctx = makeCtx(s);
  let d = 0;
  while (d++ < 20000 && !ws4(s).loose) { s.time.day += 1; securitySystem.run(s, ctx); }
  // The escape that set `loose` (an earlier escape security did not notice is a hidden copy, E9: not this one).
  const f = footholdsOf(s).find((x) => x.kind === 'exfiltratedCopy' && x.day === ws4(s).loose?.day);
  check(!!ws4(s).loose && !!f && f.status === 'detected' && f.versionId === ws4(s).loose?.versionId, 'creation: an escape (the security system\'s exfiltration roll) leaves a located exfiltrated-copy foothold', f ? `after ${d} days: ${f.id}` : `none in ${d} days`);
  const g = clone(s);
  escapeResolved(s, s.time.day, 'captured');
  escapeResolved(g, g.time.day, 'quiet');
  check(f?.status === 'removed' && footholdsOf(g).find((x) => x.id === f.id)?.status === 'suspected', 'creation: the hunt removes the copy; a copy that went quiet stays suspected (location unknown)');
  if (f) {
    const h = clone(g);
    const ff = footholdsOf(h).find((x) => x.kind === 'exfiltratedCopy')!;
    ff.status = 'detected';
    check(!!ACTION_BY_ID.get('safety.respond') && (ACTION_BY_ID.get('safety.respond')!.apply(h, makeCtx(h), { kind: 'removeFoothold', footholdId: ff.id }), ff.status === 'detected'), 'removal: an escaped copy cannot be removed from the Respond menu (outside the lab: the hunt)');
  }
}

// ───────────── effects ─────────────
{
  const s = scheming();
  const ctx = makeCtx(s);
  computeOnlineSystem.run(s, ctx);
  const before = s.player.computeOnline;
  const poolBefore = poolsOf(s).training;
  const v = routine(s);
  const f = uncaught(s, 'HIDCOMP', v)!;
  computeOnlineSystem.run(s, ctx);
  check(Math.abs(s.player.computeOnline - (computeOnlineOf(s) - f.size)) < 1e-6 && s.player.computeOnline < before && poolsOf(s).training < poolBefore && Math.abs(hiddenComputeH(s) - f.size) < 1e-9,
    'effect: hidden compute is subtracted from the lab\'s usable compute (every pool shrinks; the gap to the installed fleet is the symptom)', `online ${Math.round(before)} → ${Math.round(s.player.computeOnline)} H100e (−${pct(f.size / before)})`);
}
{
  const s = scheming();
  const v = routine(s);
  const t0 = dayTerms(s, v, 'HIDCOMP', 1);
  const i0 = itemTerms(s, v, 'STEER', 0.5, WORK_TYPES.EXP.H);
  const f = uncaught(s, 'BACKDOOR', v)!;
  f.size = 0.5;
  const t1 = dayTerms(s, v, 'HIDCOMP', 1);
  const i1 = itemTerms(s, v, 'STEER', 0.5, WORK_TYPES.EXP.H);
  const other = clone(s);
  for (const x of footholdsOf(other)) x.lineage = 'L-elsewhere';
  const t2 = dayTerms(other, other.player.models.versions.find((x) => x.id === v.id)!, 'HIDCOMP', 1);
  check(Math.abs(backdoorReach(s, lineageOf(s, v)) - 0.5) < 1e-12 && Math.abs(t1.block - t0.block * 0.5) < 1e-12 && Math.abs(t1.catch - t0.catch * 0.5) < 1e-12 && t1.rate > t0.rate && i1.rate > i0.rate && Math.abs(i1.catch - i0.catch * 0.5) < 1e-12,
    'effect: a backdoor of reach R lets its lineage\'s later covert acts bypass R of block and catch (daily and per-item acts)', `HIDCOMP uncaught/day ${t0.rate.toExponential(2)} → ${t1.rate.toExponential(2)}; STEER uncaught ${pct(i0.rate)} → ${pct(i1.rate)}`);
  check(Math.abs(t2.catch - t0.catch) < 1e-12 && Math.abs(t2.block - t0.block) < 1e-12, 'effect: another lineage\'s backdoor does not help this model');
}

// ───────────── detection: suspicion at the stated rates ─────────────
/** Run footholdsStep for `days` on K copies of foothold f; fraction suspected vs 1 − exp(−λ·days). */
function suspicionTrial(s: GameStateV2, f: Foothold, K: number, days: number) {
  const base = footholdsOf(s).filter((x) => x !== f);
  const copies = Array.from({ length: K }, (_, i) => ({ ...clone(f), id: `FT${i}`, status: 'hidden' as const }));
  s.player.safety.footholds = [...base.map((x) => ({ ...x, status: 'removed' as const })), ...copies];
  const lam = suspicionRate(s, copies[0]).total;
  const ctx = makeCtx(s);
  const d0 = s.time.day;
  for (let d = 0; d < days; d++) { s.time.day = d0 + d; footholdsStep(s, ctx); }
  s.time.day = d0;
  const got = copies.filter((x) => (x.status as string) === 'suspected').length / K;
  const want = 1 - Math.exp(-lam * days);
  return { got, want, lam, ok: Math.abs(got - want) < 4 * Math.sqrt((want * (1 - want)) / K) + 0.01, sym: copies.find((x) => (x.status as string) === 'suspected')?.symptom ?? '' };
}
{
  const s = scheming();
  const v = routine(s);
  const f = uncaught(s, 'HIDCOMP', v)!;
  f.size *= 3;
  const t = suspicionRate(s, f);
  const installed = computeOnlineOf(s);
  check(t.monitors > 0 && Math.abs(t.accounting - f.size / installed / FOOTHOLD.accountingNoise / FOOTHOLD.accountingDays) < 1e-12,
    'suspicion: hidden compute shows to the monitors (trace rate × E6 monitor catch) and to compute accounting ((share ÷ 2% noise) per 90 days)', `monitors ${t.monitors.toExponential(2)}/day, accounting ${t.accounting.toExponential(2)}/day (${pct(f.size / installed)} of the fleet)`);
  const r = suspicionTrial(s, f, 400, 60);
  check(r.ok && r.sym.length > 0, 'suspicion: hidden footholds become suspected at P = 1 − exp(−λ·t)', `${pct(r.got)} vs ${pct(r.want)} after 60 d (λ ${r.lam.toExponential(2)}/day); symptom "${r.sym}"`);
  const s2 = scheming();
  const v2 = routine(s2);
  const b = uncaught(s2, 'BACKDOOR', v2)!;
  const tb = suspicionRate(s2, b);
  const noMon = clone(s2);
  for (const u of Object.values(noMon.player.agents)) delete (u as { monitorId?: string }).monitorId;
  for (const tt of Object.values(noMon.player.safety.techniques)) tt.active = false;
  resetWorkContext(noMon);
  const tbn = suspicionRate(noMon, footholdsOf(noMon).find((x) => x.id === b.id)!);
  check(tb.monitors > 0 && tb.accounting === 0 && tbn.monitors < tb.monitors, 'suspicion: a backdoor shows only to the monitors, and less without monitors and tools (overseer gap × tool strength)', `${tb.monitors.toExponential(2)} → ${tbn.monitors.toExponential(2)}/day`);
  // A caught act of the same kind by the same lineage prompts a sweep.
  const s3 = scheming();
  const v3 = routine(s3);
  const K = 400;
  for (let i = 0; i < K; i++) uncaught(s3, 'BACKDOOR', v3);
  for (const x of footholdsOf(s3)) x.status = 'hidden';
  // footholdFromAct grows one foothold; make K separate ones for the sweep's odds.
  const one = footholdsOf(s3)[0];
  s3.player.safety.footholds = Array.from({ length: K }, (_, i) => ({ ...clone(one), id: `FS${i}`, acts: 1 }));
  noteCovert(s3, makeCtx(s3), v3, dayTerms(s3, v3, 'BACKDOOR', 1), 'caught', 0.3);
  const sw = footholdsOf(s3).filter((x) => x.status === 'suspected').length / K;
  check(Math.abs(sw - FOOTHOLD.caughtSuspect) < 4 * Math.sqrt(0.25 / K), 'suspicion: a caught backdoor attempt makes the lineage\'s hidden backdoors suspected with P 0.5 (a sweep)', `${pct(sw)} of ${K}`);
}
{
  // Steered successor: eval drift on the successor; corrupted tool: model organisms.
  const s = scheming(12, { SUCC: 1 });
  const v = routine(s);
  const f: Foothold = { id: 'FX1', kind: 'steeredSuccessor', versionId: v.id, lineage: lineageOf(s, v), day: s.time.day, acts: 1, severity: 3, size: 0.3, ref: v.id, delta: { SUCC: 0.3, SCHEME: 0.2 }, status: 'hidden' };
  s.player.safety.footholds = [f];
  const t = suspicionRate(s, f);
  check(t.evals > 0 && t.monitors === 0, 'suspicion: a steered successor shows as eval drift (Σ |δ| × the stack\'s detection ÷ 0.1 per 30 days)', `${t.evals.toExponential(2)}/day`);
  const g = newGame(defaultSetupV2({ seed: 6, alignment: 'medium' }));
  g.player.safety.techniques['T-FAKE'] = { ...clone(g.player.safety.techniques['T-MO']), id: 'T-FAKE', falseValidated: true, unlocked: true, active: true };
  const ft: Foothold = { id: 'FX2', kind: 'corruptedTool', versionId: g.player.models.versions[0].id, lineage: lineageOf(g, g.player.models.versions[0]), day: 0, acts: 1, severity: 2, size: 0.8, ref: 'T-FAKE', status: 'hidden' };
  g.player.safety.footholds = [ft];
  const tc = suspicionRate(g, ft);
  g.player.safety.techniques['T-MO'].active = false;
  const tc0 = suspicionRate(g, ft);
  check(tc.organisms > 0 && tc0.total === 0, 'suspicion: model organisms (T-MO) expose a masking tool\'s missing recall; without them nothing does', `${tc.organisms.toExponential(2)}/day`);
}

// ───────────── detection: cases locate at the stated probabilities ─────────────
{
  const s = scheming();
  const v = routine(s);
  const f = uncaught(s, 'BACKDOOR', v)!;
  const K = 2000;
  const c = 0.6;
  const odds = (st: 'hidden' | 'suspected', traits: ('SCHEME' | 'POWER' | 'SYC')[]) => {
    let loc = 0;
    let sus = 0;
    for (let i = 0; i < K; i++) {
      f.status = st;
      delete f.detectedDay;
      caseOnModel(s, makeCtx(s), v, traits, c, `K${i}`, 'test case');
      const now = f.status as string;
      if (now === 'detected') loc++;
      else if (now === 'suspected' && st === 'hidden') sus++;
    }
    return { loc: loc / K, sus: sus / K };
  };
  const a = odds('suspected', ['SCHEME']);
  const b = odds('hidden', ['POWER']);
  const z = odds('suspected', ['SYC']);
  const se = (p: number) => 4 * Math.sqrt((p * (1 - p)) / K) + 0.005;
  check(Math.abs(a.loc - c) < se(c) && caseOdds({ ...f, status: 'suspected' }, ['SCHEME'], c).locate === c, 'location: a case at clarity c on the foothold\'s traits locates a suspected foothold with P = c·ρ', `${pct(a.loc)} vs ${pct(c)}`);
  check(Math.abs(b.loc - c / 2) < se(c / 2) && Math.abs(b.sus - c / 2) < se(c / 2), 'location: … a hidden one with c·ρ/2, and makes it suspected with another c·ρ/2', `located ${pct(b.loc)}, suspected ${pct(b.sus)} vs ${pct(c / 2)} each`);
  check(z.loc === 0, 'location: a case on unrelated traits finds nothing (ρ = 0)');
  // Through the investigation mechanics: a resolving case on the maker with clarity 1 on SCHEME locates it.
  f.status = 'suspected';
  delete f.detectedDay;
  const inv: Investigation = { id: 'INV-T', target: { kind: 'trait', versionId: v.id, trait: 'SCHEME' }, fte: 15, computeShare: 0.05, tools: ['T-MO'], startDay: s.time.day - 60, clarity: 1 };
  s.player.safety.investigations.push(inv);
  resolveInvestigation(s, makeCtx(s), inv);
  check((f.status as string) === 'detected' && /investigation INV-T/.test(f.symptom ?? ''), 'location: an investigation resolving on the maker (SCHEME, clarity 1) locates a suspected backdoor', `${inv.outcome}; ${f.symptom}`);
}

// ───────────── removal: the effect ends, the cost is the preview ─────────────
{
  const s = scheming();
  const ctx = makeCtx(s);
  const v = routine(s);
  const respond = ACTION_BY_ID.get('safety.respond')!;
  const h = uncaught(s, 'HIDCOMP', v)!;
  const notYet = removalPreview(s, h.id);
  respond.apply(s, ctx, { kind: 'removeFoothold', footholdId: h.id });
  check(h.status === 'hidden' && notYet.gains.length === 0, 'removal: a hidden or suspected foothold cannot be removed (locate it first)');
  h.status = 'detected';
  computeOnlineSystem.run(s, ctx);
  const on0 = s.player.computeOnline;
  const pv = removalPreview(s, h.id);
  const re0 = patchFte(s);
  const free = safetyReHeads(s) - re0;
  respond.apply(s, ctx, { kind: 'removeFoothold', footholdId: h.id });
  computeOnlineSystem.run(s, ctx);
  const cost = FOOTHOLD.removal.hiddenCompute;
  const staff = pv.costs.find((x) => x.currency === 'staffTime')?.amount;
  const down = -(pv.costs.find((x) => x.currency === 'compute')?.amount ?? 0);
  const gain = pv.gains.find((x) => x.currency === 'compute')?.amount ?? 0;
  check(free >= cost.fte && (h.status as string) === 'removed' && Math.abs(s.player.computeOnline - on0 - gain) <= 1 && staff === cost.fte && patchFte(s) - re0 === staff && Number(s.flags['ws4:agentsOffUntil']) === s.time.day + down && h.removal?.until === s.time.day + cost.days,
    'removal: hidden compute: the reservation returns to usable compute and the lab pays what the preview said (engineers, agent downtime)',
    `+${Math.round(s.player.computeOnline - on0)} H100e (preview +${gain}); ${staff} engineers for ${cost.days} d; agents off ${down} d`);
  const ctx2 = makeCtx(s);
  const d0 = s.time.day;
  s.time.day = d0 + cost.days;
  footholdsStep(s, ctx2);
  check(patchFte(s) === re0 && !h.removal, 'removal: the engineers are free again after the removal\'s days');
  s.time.day = d0;
  // Backdoor: oversight back to full.
  const t0 = dayTerms(s, v, 'HIDCOMP', 1);
  const b = uncaught(s, 'BACKDOOR', v)!;
  b.status = 'detected';
  const t1 = dayTerms(s, v, 'HIDCOMP', 1);
  const pb = removalPreview(s, b.id);
  respond.apply(s, ctx, { kind: 'removeFoothold', footholdId: b.id });
  const t2 = dayTerms(s, v, 'HIDCOMP', 1);
  check(t1.catch < t0.catch && Math.abs(t2.catch - t0.catch) < 1e-12 && (b.status as string) === 'removed' && pb.gains[0].currency === 'security' && Math.abs(pb.gains[0].amount - Math.round(b.size * 100) / 100) < 1e-9,
    'removal: a removed backdoor no longer helps its lineage (catch back to full); the preview showed its reach', `catch ${f3(t0.catch)} → ${f3(t1.catch)} → ${f3(t2.catch)}`);
  // Steered successor: the steered dispositions are stripped; the next post-run pays the progress penalty.
  const st: Foothold = { id: 'FX3', kind: 'steeredSuccessor', versionId: v.id, lineage: lineageOf(s, v), day: s.time.day, acts: 1, severity: 3, size: 0.2, ref: v.id, delta: { SUCC: 0.2 }, status: 'detected' };
  s.player.safety.footholds.push(st);
  v.traitsTrue.SUCC = 0.5;
  const pen0 = Number(s.flags['ws2.runPenalty'] ?? 0);
  const ps = removalPreview(s, st.id);
  for (const x of s.player.safety.footholds) if (x.removal) delete x.removal; // free the engineers for this check
  respond.apply(s, ctx, { kind: 'removeFoothold', footholdId: st.id });
  check(st.status === 'removed' && Math.abs(v.traitsTrue.SUCC - 0.3) < 1e-12 && Math.abs(Number(s.flags['ws2.runPenalty']) - pen0 - (-(ps.costs.find((x) => x.currency === 'progress')?.amount ?? 0))) < 1e-12,
    'removal: a steered successor: its steered dispositions are removed and the next post-run pays the preview\'s progress penalty', `SUCC 0.5 → ${f3(v.traitsTrue.SUCC)}`);
  // Not enough engineers: refused.
  const poor = clone(s);
  const pb2 = uncaught(poor, 'BACKDOOR', poor.player.models.versions.find((x) => x.id === v.id)!)!;
  pb2.status = 'detected';
  for (const t of poor.player.teams) if (t.role === 're' && t.dept === 'saf') t.heads = 0;
  respond.apply(poor, makeCtx(poor), { kind: 'removeFoothold', footholdId: pb2.id });
  check(pb2.status === 'detected', 'removal: refused without free safety research engineers');
}

// ───────────── the player's view: never hidden footholds ─────────────
{
  const s = scheming();
  const v = routine(s);
  const a = uncaught(s, 'BACKDOOR', v)!;
  const b = uncaught(s, 'HIDCOMP', v)!;
  const v0 = footholdView(s);
  b.status = 'suspected';
  b.symptom = 'unexplained compute use ≈ 1% of the fleet';
  const v1 = footholdView(s);
  a.status = 'detected';
  const v2 = footholdView(s);
  const rb = v1.rows.find((r) => r.id === b.id);
  check(v0.rows.length === 0 && v1.rows.length === 1 && !!rb && rb.versionId === undefined && rb.size === undefined && rb.caseVersionId === v.id && v2.rows.find((r) => r.id === a.id)?.size !== undefined && v2.located === 1 && v2.suspected === 1 && v1.symptoms.length === 1,
    'view: hidden footholds never appear; a suspected one shows its symptom and where to look (not its maker or size); a located one shows both', `${v0.rows.length} / ${v1.rows.length} / ${v2.rows.length} rows; "${v1.symptoms[0]}"`);
}

// ───────────── the 2025 start: footholds ≈ never form ─────────────
{
  const s = newGame(defaultSetupV2({ world: 'ai2027', alignment: 'medium', seed: 2027, tutorial: false }));
  const daily = fleetCovertTerms(s).reduce((x, t) => x + t.rate, 0) * 365.25;
  const succ = rdParts(s).reduce((x, p) => x + itemTerms(s, p.v, 'SUCCSTEER', p.share, WORK_TYPES[p.slot].H).rate, 0) * 12;
  const saf = (safetySabotage(s, lineLabour(s, 'AG08').aiShare)?.rate ?? 0) * 20;
  check(daily + succ + saf < 1e-3, '2025 start: expected new footholds per lab-year ≈ 0 (backdoors and hidden compute, successor steering at 12 runs/yr, sabotage at 20 results/yr)', `${(daily + succ + saf).toExponential(1)} per year`);
  void covertOutcome;
}

// ───────────── save: a schemaRev-30 save (before E8; E8 was built as 25 → 26, renumbered in M5) migrates ─────────────
{
  const s = scheming();
  const raw = JSON.parse(serialize(s));
  raw.schemaRev = 30;
  delete raw.player.safety.footholds;
  raw.flags['ws2.covert.BACKDOOR.n'] = 2;
  raw.flags['ws2.covert.BACKDOOR.sev'] = 7;
  raw.flags['ws2.covert.HIDCOMP.n'] = 1;
  raw.flags['ws2.covert.HIDCOMP.sev'] = 3;
  raw.flags['ws2.covert.BACKDOOR.caught'] = 4;
  const tid = Object.keys(raw.player.safety.techniques)[0];
  raw.player.safety.techniques[tid].falseValidated = true;
  raw.player.safety.techniques[tid].unlocked = true;
  let msg = '';
  let m: GameStateV2 | undefined;
  try { m = deserialize(JSON.stringify(raw)); } catch (e) { msg = String(e); }
  const fs = m ? footholdsOf(m) : [];
  const bd = fs.find((f) => f.kind === 'backdoor');
  const hc = fs.find((f) => f.kind === 'hiddenCompute');
  const ct = fs.find((f) => f.kind === 'corruptedTool');
  const pool = s.player.computeOnline * s.player.split.agents;
  check(!!m && m.schemaRev === SCHEMA_REV && SCHEMA_REV === 44 && bd?.acts === 2 && bd.severity === 7 && Math.abs((hc?.size ?? 0) - 0.03 * pool) < 1e-6 && ct?.ref === tid && fs.every((f) => f.status === 'hidden')
    && m.flags['ws2.covert.BACKDOOR.n'] === undefined && m.flags['ws2.covert.BACKDOOR.caught'] === 4 && covertRecord(m, 'BACKDOOR').n === 2,
    'save: a schemaRev-30 save migrates to 31 (flag records → hidden footholds, false-validated tools → corrupted tools; caught counts kept)', msg || `${fs.length} footholds`);
  const fresh = newGame(defaultSetupV2({ seed: 3 }));
  check(Array.isArray(fresh.player.safety.footholds) && fresh.player.safety.footholds.length === 0 && footholdsOf(deserialize(serialize(fresh))).length === 0, 'save: a new game starts with no footholds and round-trips');
}

finish('footholds');
