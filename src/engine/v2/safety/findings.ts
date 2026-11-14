// Findings: type draw, content selection, FALSE findings, publishing (V2-SPEC §3.5.3). Owner: WS2.
//
// Hidden → visible: agenda efficacy e is never shown; findings move a visible Beta posterior (Promising / Mixed /
// Struggling). FALSE findings (F49) show as TECH until an AG02/AG08 NEG or an investigation with an independent tool
// family exposes them ("we were wrong").
import { AGENDA_BY_ID } from '../../../data/v2/agendas';
import { EDGES } from '../../../data/v2/edges';
import { FINDINGS, FINDING_BY_ID, type FindingDef } from '../../../data/v2/findings';
import { TECHNIQUES } from '../../../data/v2/techniques';
import { UMODE_BY_ID, UMODES } from '../../../data/v2/umodes';
import { CHINA_ID, internalVersion } from '../models/labs';
import type { AgendaId, FindingRecord, FindingType, GameStateV2, SystemCtx, TechniqueState, ToolFamily, TraitId, UModeId } from '../types';
import { clamp01, setFlag, trueEfficacy, versionM } from './common';
import { observeVersion } from './detection';
import { decayAt, unlockTechnique } from './techniques';
import { discoverUMode, isDiscovered, revealToWorld, sabOf } from './umodes';

const WB_AGENDAS: AgendaId[] = ['AG01', 'AG02', 'AG03', 'AG13'];
const CROSS_CHECK: AgendaId[] = ['AG02', 'AG08'];

function fired(s: GameStateV2, id: string): boolean {
  return s.player.safety.findings.some((f) => f.id === id);
}

function requiresOk(s: GameStateV2, req: string | undefined, ag: AgendaId): boolean {
  if (!req) return true;
  const e = trueEfficacy(s, ag);
  return req.split('&').every((r) => {
    const m = /^(e|l1)(>=|>)(-?[\d.]+)$/.exec(r.trim());
    if (!m) return true;
    const v = m[1] === 'e' ? e : s.hidden.latents.legibility;
    return m[2] === '>' ? v > Number(m[3]) : v >= Number(m[3]);
  });
}

/** Unfired catalog rows of an agenda of the given types whose preconditions hold. */
function candidates(s: GameStateV2, ag: AgendaId, types: FindingType[]): FindingDef[] {
  return FINDINGS.filter((f) => {
    const agOk = f.agenda === ag || (f.agenda === 'anyWB' && WB_AGENDAS.includes(ag));
    return agOk && types.includes(f.type) && !fired(s, f.id) && requiresOk(s, f.requires, ag);
  });
}

function revealableUModes(s: GameStateV2, ag: AgendaId): { present: UModeId[]; absent: UModeId[] } {
  const present: UModeId[] = [];
  const absent: UModeId[] = [];
  const iv = internalVersion(s);
  const inModels = new Set(s.player.models.versions.filter((v) => v.status !== 'retired').flatMap((v) => v.uModes));
  for (const u of UMODES) {
    if (!u.revealedBy.includes(ag) || isDiscovered(s, u.id)) continue;
    // AG01 reveals U16/U22 only at e > 0.8 (R14 §1.4).
    if (ag === 'AG01' && (u.id === 'U16' || u.id === 'U22') && trueEfficacy(s, ag) <= 0.8) continue;
    if (inModels.has(u.id) || iv?.uModes.includes(u.id)) present.push(u.id);
    else absent.push(u.id);
  }
  return { present, absent };
}

function agendaTechniques(s: GameStateV2, ag: AgendaId): TechniqueState[] {
  return Object.values(s.player.safety.techniques).filter((t) => t.agenda === ag);
}

/** An active technique of this agenda whose overseen M is past its M½ (NEG precondition, §3.5.3). */
function decayedTechnique(s: GameStateV2, ag: AgendaId, M: number): TechniqueState | undefined {
  return agendaTechniques(s, ag).find((t) => t.unlocked && t.active && !t.falseValidated && t.k > 0 && decayAt(s, t, M, false) < 0.5);
}

function anyFalseActive(s: GameStateV2): TechniqueState | undefined {
  return Object.values(s.player.safety.techniques).find((t) => t.falseValidated && t.unlocked && t.active);
}

/** Observation that raises clarity on `traits` of the internal version by ≈ `amount` (finding "clarity +x"). */
function clarityBoost(s: GameStateV2, ctx: SystemCtx, ag: AgendaId, traits: TraitId[], amount: number) {
  const v = internalVersion(s);
  if (!v) return;
  const fam: ToolFamily = (['BB', 'COT', 'WB', 'OR'] as ToolFamily[]).includes(AGENDA_BY_ID[ag].family as ToolFamily) ? (AGENDA_BY_ID[ag].family as ToolFamily) : 'BB';
  for (const t of traits) {
    const b = v.beliefs[t];
    if (!b) continue;
    // Choose σ so the posterior sd shrinks by `amount`·0.35 (clarity = 1 − sd/0.35).
    const target = Math.max(0.02, b.sd - amount * 0.35);
    const sigma = target >= b.sd ? 0.5 : Math.sqrt(1 / Math.max(1e-6, 1 / (target * target) - 1 / (b.sd * b.sd)));
    observeVersion(s, ctx.rng('safety'), ctx.day, v, t, fam, 0.12 / sigma);
  }
}

/** Apply a catalog row's effect list (data/v2/findings.ts vocabulary). */
export function applyEffects(s: GameStateV2, ctx: SystemCtx, ag: AgendaId, effects: readonly string[]): void {
  const dept = s.player.safety;
  for (const eff of effects) {
    const [kind, a, b] = eff.split(':');
    switch (kind) {
      case 'unlock':
        if (unlockTechnique(s, a)) ctx.log('research', `New tool: ${TECHNIQUES.find((t) => t.id === a)?.name ?? a}.`, 2, a);
        break;
      case 'clarity':
        clarityBoost(s, ctx, ag, a.split(',') as TraitId[], Number(b));
        break;
      case 'revealTrait': {
        const v = internalVersion(s);
        if (v) observeVersion(s, ctx.rng('safety'), ctx.day, v, a as TraitId, 'OR', 0.12 / 0.05);
        break;
      }
      case 'reveal':
        discoverUMode(s, ctx, a as UModeId);
        break;
      case 'revealEdge':
        dept.edgeRevealed[a] = true;
        dept.edgeGrades[a] = dept.edgeGrades[a] === 'C' || dept.edgeGrades[a] === 'D' ? 'B' : dept.edgeGrades[a];
        break;
      case 's0': {
        const t = dept.techniques[a];
        if (t) t.s0 = clamp01(t.s0 * Number(b));
        break;
      }
      case 's0Agenda':
        for (const t of agendaTechniques(s, a as AgendaId)) t.s0 = clamp01(t.s0 * Number(b));
        break;
      case 'mHalf':
        for (const t of agendaTechniques(s, a as AgendaId)) if (t.k > 0) t.mHalf = Math.max(1, t.mHalf * Number(b));
        break;
      case 'probeCollapse':
        for (const t of Object.values(dept.techniques)) {
          if (t.family === 'WB' && t.trainedAgainst > 0) t.s0 *= 0.2;
        }
        break;
      case 'flag':
        setFlag(s, a, ctx.day);
        break;
      case 'trust':
        // Applied on publication (publishFinding).
        break;
    }
  }
}

/** Generic upgrade when the catalog is exhausted (§3.5.3 "Content selection"). */
function genericPositive(s: GameStateV2, ctx: SystemCtx, ag: AgendaId, type: 'TECH' | 'EVAL'): string {
  const dept = s.player.safety;
  if (type === 'TECH') {
    const gen = TECHNIQUES.find((t) => t.agenda === ag && t.unlockedBy === 'generic' && !dept.techniques[t.id]?.unlocked);
    if (gen) {
      unlockTechnique(s, gen.id);
      return `${gen.name} validated`;
    }
    const ts = agendaTechniques(s, ag).filter((t) => t.unlocked && !t.falseValidated);
    for (const t of ts) t.s0 = clamp01(t.s0 * 1.1);
    return ts.length ? 'Tools sharpened (+10% strength)' : 'Incremental progress';
  }
  const cov = AGENDA_BY_ID[ag].coverage.filter((t) => t !== 'CORRIG');
  clarityBoost(s, ctx, ag, cov.length ? cov : ['SYC'], 0.05);
  if (ag === 'AG08') {
    // Evals science raises an edge grade and reveals its weight in this world (§3.5.4).
    const order = { D: 0, C: 1, B: 2, A: 3 } as const;
    const e = EDGES.filter((x) => !dept.edgeRevealed[x.id]).sort((p, q) => order[dept.edgeGrades[p.id] ?? p.grade] - order[dept.edgeGrades[q.id] ?? q.grade])[0];
    if (e) {
      dept.edgeRevealed[e.id] = true;
      const g = dept.edgeGrades[e.id];
      dept.edgeGrades[e.id] = g === 'D' ? 'C' : g === 'C' ? 'B' : g;
      return `Evals sharpened; edge ${e.id} measured`;
    }
  }
  return 'Evals sharpened';
}

function nextId(s: GameStateV2, base: string): string {
  if (!fired(s, base)) return base;
  let n = 2;
  while (fired(s, `${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** Reveal a false-validated technique (E35 "we were wrong"): deactivate, posterior a − 1, b + 2. */
export function revealFalse(s: GameStateV2, ctx: SystemCtx, techniqueId: string): void {
  const dept = s.player.safety;
  const t = dept.techniques[techniqueId];
  if (!t || !t.falseValidated || !t.unlocked) return;
  t.active = false;
  t.unlocked = false;
  const rec = dept.findings.find((f) => `T-${f.id}` === techniqueId);
  if (rec) {
    rec.type = 'FALSE';
    rec.revealedFalseDay = ctx.day;
    if (rec.published) ctx.bump('relations.credibility', -5, 'safety', `retracted ${rec.id}`);
  }
  const p = dept.agendas[t.agenda].posterior;
  p.a = Math.max(0.5, p.a - 1);
  p.b += 2;
  setFlag(s, 'lastFalseReveal', techniqueId);
  setFlag(s, 'lastFalseRevealDay', ctx.day);
  ctx.log('research', `We were wrong: a validated ${AGENDA_BY_ID[t.agenda].name} tool was masking, not detecting.`, 4, techniqueId);
}

/**
 * Fire one finding for an agenda (§3.5.3): draw the type, select the catalog row (or a generic upgrade), apply its
 * effects, move the posterior, record it, auto-publish under the 'all' policy.
 */
export function fireFinding(s: GameStateV2, ctx: SystemCtx, agenda: AgendaId): FindingRecord | undefined {
  const dept = s.player.safety;
  const st = dept.agendas[agenda];
  const def = AGENDA_BY_ID[agenda];
  const rng = ctx.rng('safety');
  const e = trueEfficacy(s, agenda);
  const iv = internalVersion(s);
  const M = versionM(s, iv);
  const uRev = revealableUModes(s, agenda);
  const discRows = candidates(s, agenda, ['DISC']).filter((f) => !f.effects.some((x) => x.startsWith('reveal:')));
  const falseT = CROSS_CHECK.includes(agenda) ? anyFalseActive(s) : undefined;
  const weights: { item: FindingType; weight: number }[] = [
    { item: 'TECH', weight: e },
    { item: 'DEAD', weight: 0.5 * (1 - e) },
    { item: 'NEG', weight: (decayedTechnique(s, agenda, M) || candidates(s, agenda, ['NEG']).length ? 0.3 : 0) + (falseT ? 0.3 : 0) },
    { item: 'DISC', weight: 0.15 * uRev.present.length + 0.05 * uRev.absent.length + 0.1 * discRows.length },
    { item: 'SPILL', weight: WB_AGENDAS.includes(agenda) ? 0.1 : 0 },
    { item: 'FALSE', weight: st.aiLabour * sabOf(iv) },
  ];
  const type = rng.weighted(weights.filter((w) => w.weight > 0));

  let id = '';
  let shown: FindingType = type;
  let title = '';
  switch (type) {
    case 'TECH': {
      const rows = candidates(s, agenda, ['TECH', 'EVAL']);
      if (rows.length) {
        const row = rows[0];
        id = row.id;
        shown = row.type;
        title = row.title;
        applyEffects(s, ctx, agenda, row.effects);
      } else {
        shown = def.family === 'BB' || def.family === 'BB+' ? 'EVAL' : 'TECH';
        id = nextId(s, `${agenda}-${shown}`);
        title = genericPositive(s, ctx, agenda, shown as 'TECH' | 'EVAL');
      }
      st.posterior.a += 1;
      break;
    }
    case 'DEAD': {
      const row = candidates(s, agenda, ['DEAD'])[0];
      id = row?.id ?? nextId(s, `${agenda}-DEAD`);
      title = row?.title ?? 'A line of attack dead-ends';
      st.posterior.b += 2;
      if (st.posterior.a / (st.posterior.a + st.posterior.b) < 0.25) st.status = 'deadEnd';
      break;
    }
    case 'NEG': {
      if (falseT) {
        id = nextId(s, `${agenda}-XCHECK`);
        title = 'Cross-check: a validated tool does not detect';
        revealFalse(s, ctx, falseT.id);
      } else {
        const row = candidates(s, agenda, ['NEG'])[0];
        if (row) {
          id = row.id;
          title = row.title;
          applyEffects(s, ctx, agenda, row.effects);
        } else {
          const t = decayedTechnique(s, agenda, M);
          id = nextId(s, `${agenda}-NEG`);
          title = t ? `${t.id} weaker than thought on current models` : 'Negative result';
          if (t) t.mHalf = Math.max(1, t.mHalf * 0.5);
        }
      }
      st.posterior.b += 1;
      break;
    }
    case 'DISC': {
      const pool: { item: string; weight: number }[] = [
        ...uRev.present.map((u) => ({ item: u as string, weight: 0.15 })),
        ...uRev.absent.map((u) => ({ item: u as string, weight: 0.05 })),
        ...discRows.map((r) => ({ item: r.id, weight: 0.1 })),
      ];
      const pick = rng.weighted(pool);
      const row = FINDING_BY_ID[pick] ?? candidates(s, agenda, ['DISC']).find((r) => r.effects.includes(`reveal:${pick}`));
      if (row) {
        id = row.id;
        title = row.title;
        applyEffects(s, ctx, agenda, row.effects);
      }
      if (UMODE_BY_ID[pick as UModeId]) {
        if (!row) {
          id = nextId(s, `DISC-${pick}`);
          title = UMODE_BY_ID[pick as UModeId].name;
        }
        discoverUMode(s, ctx, pick as UModeId);
      }
      break;
    }
    case 'SPILL': {
      const row = candidates(s, agenda, ['SPILL'])[0];
      id = row?.id ?? nextId(s, 'SPILL');
      title = row?.title ?? 'Interpretability insight speeds up training';
      ctx.bump('player.pa', 0.02, 'safety spillover', id);
      break;
    }
    case 'FALSE': {
      id = fired(s, 'F49') ? nextId(s, 'F49') : 'F49';
      shown = 'TECH';
      const fam: ToolFamily = (['BB', 'COT', 'WB', 'OR'] as ToolFamily[]).includes(def.family as ToolFamily) ? (def.family as ToolFamily) : 'BB';
      const cov: Partial<Record<TraitId, number>> = {};
      for (const t of def.coverage) if (t !== 'CORRIG') cov[t] = 0.6;
      if (!Object.keys(cov).length) cov.SCHEME = 0.5;
      dept.techniques[`T-${id}`] = {
        id: `T-${id}`, agenda, family: fam, unlocked: true, active: true, s0: 0.8, mHalf: Math.max(25, def.mHalf), k: Math.max(0.5, def.k),
        goodhart: def.G, trainedAgainst: 0, falseValidated: true, coverage: cov,
      };
      title = `AI-validated ${def.name} detector`;
      st.posterior.a += 1;
      break;
    }
  }
  if (!id) return undefined;
  const rec: FindingRecord = { id, agenda, type: shown, trueType: type, day: ctx.day, published: false };
  dept.findings.push(rec);
  st.hazardAcc = 0;
  ctx.log('research', `${def.name}: ${title}.`, type === 'DISC' || type === 'NEG' ? 3 : 2, id);
  if (s.player.policies.publishSafety === 'all' && type !== 'SPILL') publishFinding(s, ctx, id);
  return rec;
}

/**
 * Publish a finding (§3.5.3): knowledge.publishedFindings, sharedTechniquePool +0.02 (TECH/EVAL) / +0.04 (DISC),
 * credibility +2, safety talent pull +1; SPILL leaks capability (every rival's and China's pa +0.02); a DISC that
 * revealed a U-mode tells the world (presence × 0.7 for every lab).
 */
export function publishFinding(s: GameStateV2, ctx: SystemCtx, findingId: string): void {
  const rec = s.player.safety.findings.find((f) => f.id === findingId);
  if (!rec || rec.published) return;
  rec.published = true;
  s.knowledge.publishedFindings.push(rec.id);
  const k = s.knowledge;
  if (rec.type === 'TECH' || rec.type === 'EVAL') k.sharedTechniquePool = Math.min(1, k.sharedTechniquePool + 0.02);
  if (rec.type === 'DISC') k.sharedTechniquePool = Math.min(1, k.sharedTechniquePool + 0.04);
  ctx.bump('relations.credibility', 2, 'published research', rec.id);
  ctx.bump('relations.talentPull', 1, 'published research', rec.id);
  if (rec.trueType === 'SPILL') {
    s.rivals.forEach((r, i) => {
      if (r.core.status === 'active') ctx.bump(`rivals.${i}.core.pa`, 0.02, 'safety spillover', rec.id);
    });
    if (s.china.lab.core.status === 'active') ctx.bump('china.lab.core.pa', 0.02, 'safety spillover', `${CHINA_ID}:${rec.id}`);
  }
  const row = FINDING_BY_ID[rec.id];
  for (const eff of row?.effects ?? []) {
    const [kind, a, b] = eff.split(':');
    if (kind === 'reveal') revealToWorld(s, a as UModeId);
    if (kind === 'trust') ctx.bump(`trust:${a}`, Number(b), 'published research', rec.id);
  }
  if (rec.id.startsWith('DISC-')) revealToWorld(s, rec.id.slice(5, 8) as UModeId);
}

/** Expected findings per year for an agenda at its current funding (visible; for previews). */
export function expectedFindingsPerYear(lambdaPerDay: number): number {
  return lambdaPerDay * 365;
}
