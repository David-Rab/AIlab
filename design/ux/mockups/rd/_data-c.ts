// Mockup data c: SAFETY › Model, Instruments, Safeguards, Incidents & cases on the day-400 fixture (player-visible
// selectors only; never s.hidden / true traits). Run from the worktree root:
//   npx tsx design/ux/mockups/rd/_data-c.ts  → design/ux/mockups/rd/data400c.json
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../../src/engine/v2/core/save';
import { FIXTURE_DIR } from '../../../../scripts/v2/lib';
import type { GameStateV2 } from '../../../../src/engine/v2';
import { riskFamilies, beliefView, incidentRows, uModeCards, safetyUtilisation } from '../../../../src/engine/v2/safety/view';
import { alignmentEvalView } from '../../../../src/engine/v2/safety/alignmentEvals';
import { instrumentReliability, safetyModels, oversightGaps } from '../../../../src/engine/v2/safety/safetyReadouts';
import { instruments, instrumentName, instrumentKind, instrumentReads, validatedLabel, reliabilityReasons } from '../../../../src/engine/v2/safety/instruments';
import { validationView, validationRange } from '../../../../src/engine/v2/safety/validation';
import { disagreementsOn } from '../../../../src/engine/v2/safety/disagreement';
import { ownedMethods, methodQRange, methodPolicyOn } from '../../../../src/engine/v2/safety/methods';
import { frameworkOf, worldHighL } from '../../../../src/engine/v2/safety/framework';
import { previewPackage, packageMeets } from '../../../../src/engine/v2/safety/packages';
import { footholdView } from '../../../../src/engine/v2/safety/footholdDetection';
import { safetySpend } from '../../../../src/engine/v2/safety/spend';
import { trustOf, autoWatcher } from '../../../../src/engine/v2/safety/trusted';
import { disclosurePolicy, responseOptions } from '../../../../src/engine/v2/safety/responses';
import { TRAIT_BY_ID } from '../../../../src/data/v2/traits';
import { RISK_FAMILIES } from '../../../../src/data/v2/agents';

const s = deserialize(readFileSync(join(FIXTURE_DIR, process.argv[2] ?? 'day400.json'), 'utf8')) as GameStateV2;
const p = s.player;
const r3 = (x: number) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : String(x));
const clean = (o: unknown): unknown => {
  if (typeof o === 'number') return r3(o);
  if (Array.isArray(o)) return o.map(clean);
  if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && typeof v !== 'function').map(([k, v]) => [k, clean(v)]));
  return o;
};
const errors: Record<string, string> = {};
const t = <T>(k: string, f: () => T): T | undefined => { try { return f(); } catch (e) { errors[k] = String((e as Error)?.stack ?? e).split('\n').slice(0, 3).join(' | '); return undefined; } };
const out: Record<string, unknown> = { day: s.time.day };
const running = t('safetyModels', () => safetyModels(s)) ?? [];
out.safetyModels = running.map((m) => ({ ...m }));
out.families = RISK_FAMILIES;
out.traitNames = Object.fromEntries(Object.entries(TRAIT_BY_ID).map(([k, v]) => [k, (v as { name: string }).name]));
const per: Record<string, unknown> = {};
for (const m of running) {
  const v = p.models.versions.find((x) => x.id === m.id)!;
  per[m.name] = {
    id: v.id, parent: v.parentVersionId, status: v.status,
    methods: (v as unknown as { post?: { methods?: string[] } }).post?.methods,
    families: t('fam' + m.name, () => riskFamilies(s, v.id)),
    beliefs: t('bel' + m.name, () => beliefView(s, v.id)),
    align: t('al' + m.name, () => alignmentEvalView(v)),
    instr: t('ir' + m.name, () => instrumentReliability(s, v.id)),
    valRange: t('vr' + m.name, () => instruments(s).map((ti) => ({ id: ti.id, ...validationRange(s, ti, v) }))),
    reasons: t('rr' + m.name, () => instruments(s).map((ti) => ({ id: ti.id, r: reliabilityReasons(s, ti, v) }))),
    disagree: t('dg' + m.name, () => disagreementsOn(s, v.name)),
    trust: t('tr' + m.name, () => trustOf(s, v)),
    watcher: t('aw' + m.name, () => { const a = autoWatcher(s, v); return { v: a.v?.name, reason: a.reason }; }),
  };
}
out.perModel = per;
out.instruments = t('instruments', () => instruments(s).map((ti) => ({ id: ti.id, name: instrumentName(ti), kind: instrumentKind(ti), reads: instrumentReads(ti), validatedOn: validatedLabel(s, ti), family: ti.family, agenda: ti.agenda, trainedAgainst: ti.trainedAgainst, trust: (ti as unknown as { trust?: unknown }).trust, validations: (ti as unknown as { validations?: unknown }).validations })));
out.validation = t('validationView', () => validationView(s));
out.methods = t('methods', () => ({ policyOn: methodPolicyOn(s), owned: ownedMethods(s).map((id) => ({ id, q: t('mq' + id, () => methodQRange(s, id)) })) }));
out.framework = t('framework', () => ({ highL: worldHighL(s), fw: frameworkOf(s) }));
out.deployments = t('deps', () => p.deployments.map((d) => ({ id: d.id, channel: d.channel, status: d.status, versionId: (d as unknown as { versionId?: string }).versionId, lineup: (d as unknown as { lineup?: unknown }).lineup, guards: d.guards, safeguards: d.safeguards, meets: t('pm' + d.id, () => packageMeets(s, d)), pkg: t('pp' + d.id, () => previewPackage(s, d)) })));
out.oversightGaps = t('og', () => oversightGaps(s));
out.footholds = t('fh', () => footholdView(s));
out.spend = t('spend', () => safetySpend(s));
out.util = t('util', () => safetyUtilisation(s));
out.disclosure = t('disc', () => disclosurePolicy(s));
out.incidents = t('inc', () => incidentRows(s));
out.investigations = t('inv', () => p.safety.investigations);
out.uModes = t('um', () => uModeCards(s));
out.respOptions = t('ro', () => { const v = p.models.versions.find((x) => x.id === running[0]?.id)!; return responseOptions(s, v, undefined, 'RH'); });
out.agentsSafety = p.agents.safety;
out.errors = errors;
writeFileSync(process.argv[3] ?? 'design/ux/mockups/rd/data400c.json', JSON.stringify(clean(out), null, 1));
console.log('written', Object.keys(errors).length, 'errors', errors);
