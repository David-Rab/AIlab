// W8b-1: the outside-world UI readouts (pure selectors) on the fixtures and on constructed cases: values finite, the concern parts
// sum to the target, progress fields consistent, the war and theft rows follow their mechanisms, no removed lever is named.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize, serialize } from '../../src/engine/v2/core/save';
import { riskLevers, riskSources, RISK_LEVERS } from '../../src/engine/v2/actors/intel';
import { approvalCauses, approvalParts, concernParts, concernTarget } from '../../src/engine/v2/world/public';
import { briefingEffect, stageProgress, trustCauses, USGOV } from '../../src/engine/v2/world/usgov';
import { CHINAGOV, chinaWarOdds, talksProgress, tensionProgress } from '../../src/engine/v2/world/chinagov';
import { lawStatus } from '../../src/data/v2/laws';
import { GLOSSARY_V2 } from '../../src/data/v2/glossary';
import type { GameStateV2 } from '../../src/engine/v2/types';
import { FIXTURE_DIR, check, finish } from './lib';

const states: GameStateV2[] = [0, 400, 900].map((d) => deserialize(readFileSync(join(FIXTURE_DIR, `day${d}.json`), 'utf8')));
const finite = (o: unknown): boolean => typeof o === 'number' ? Number.isFinite(o) : Array.isArray(o) ? o.every(finite) : o && typeof o === 'object' ? Object.values(o).every(finite) : true;
const near = (a: number, b: number, e = 1e-9) => Math.abs(a - b) <= e;
const copy = (s: GameStateV2) => deserialize(serialize(s));

for (const s of states) {
  const d = `@day ${s.time.day}`;
  const c = concernParts(s);
  check(finite(c) && near(Math.min(100, Math.max(0, c.base + c.milestones + c.jobs + c.incidents)), c.target) && near(c.target, concernTarget(s)), `concernParts ${d}: finite, parts sum to the target`);
  check(near(c.concern + c.change90d, c.in90Days), `concernParts ${d}: 90-day change consistent`);
  const a = approvalParts(s);
  check(finite(a) && near(a.concernTerm * a.attention, a.baseline), `approvalParts ${d}: finite, baseline = concern term x attention`);
  const tc = trustCauses(s, 8);
  check(tc.length <= 8 && tc.every((x) => Number.isFinite(x.delta) && x.reason.length > 0) && tc.every((x, i) => i === 0 || tc[i - 1]!.day >= x.day), `trustCauses ${d}: at most 8, newest first`);
  check(approvalCauses(s).length <= 8, `approvalCauses ${d}: at most 8`);
  for (const [name, p] of [['stage', stageProgress(s)], ['tension', tensionProgress(s)], ['talks', talksProgress(s)]] as const) {
    check(finite(p) && p.needs.length > 0 && p.heldDays >= 0 && p.heldDays <= p.needDays + (name === 'tension' ? 1e9 : 0), `${name}Progress ${d}: finite, hold fields consistent`);
    check((p.next === null) === (p.nextName === null), `${name}Progress ${d}: next and its name agree`);
  }
  const t = tensionProgress(s);
  check(t.met === (t.mode === 'any' ? t.parts.some((x) => x.met) : t.parts.every((x) => x.met)) || t.next === null, `tensionProgress ${d}: met follows its parts`);
  const ls = lawStatus(s);
  check(ls.length === 11 && ls.every((l) => l.on.length > 0 && l.off.length > 0 && (l.inForce === (l.since !== null))), `lawStatus ${d}: 11 laws, in force iff since is set`);
  for (const lv of [0, 1, 2] as const) {
    const b = briefingEffect(s, lv);
    check(finite(b) && (lv === 0 ? b.delayDays === null : b.delayDays !== null) && (lv === 2 || b.forcedFull || b.trustPerMonth === 0), `briefingEffect ${d} level ${lv}: delay and trust per level`);
  }
  const w = riskSources(s);
  check(w.every((r) => finite(r.estimate) && r.estimate >= 0 && r.estimate <= 1 && r.band[0] <= r.estimate + 1e-9 && r.estimate <= r.band[1] + 1e-9), `riskSources ${d}: estimates and bands in 0..1`);
  check(finite(riskLevers(s)), `riskLevers ${d}: finite`);
}

// Constructed: the war row follows the war rule.
const w = copy(states[1]!);
w.chinagov.tension = 4;
const q = CHINAGOV.warPerQuarter;
check(near(chinaWarOdds(w).p, 1 - Math.pow(1 - q, 4)), 'war: at tension 4 the real per-quarter chance annualised');
w.chinagov.tension = 2;
w.chinagov.rejected = false;
check(chinaWarOdds(w).p === 0, 'war: below tension 4 with no rejected treaty is 0');
w.chinagov.rejected = true;
w.chinagov.leadHist = [12, 12, 12, 12];
const p3 = (w.chinagov.tension = 3, chinaWarOdds(w).p);
const p2 = (w.chinagov.tension = 2, chinaWarOdds(w).p);
check(p3 >= p2 && p3 <= 1 - Math.pow(1 - q, 4), 'war: fewer rungs left never lowers the chance, never exceeds the war-footing chance');

// Theft row: zero below the theft rung, positive above it (with attention and a lead), and security level lowers it.
const th = copy(states[2]!);
th.chinagov.tension = 0;
check(riskSources(th).find((r) => r.id === 'theft')!.estimate === 0, 'theft: no attempts below the theft rung');
th.chinagov.tension = CHINAGOV.theftRung;
const ths = riskSources(th, { leadDays: 400 }).find((r) => r.id === 'theft')!;
const thsMore = riskSources(th, { leadDays: 400, wsl: 1 }).find((r) => r.id === 'theft')!;
check(thsMore.estimate <= ths.estimate, 'theft: one more weight security level never raises it');

// Levers name only levers that exist now.
const gone = /track-2|agreement|lobby|lobbying|defensive deals|export controls/i;
check(Object.values(RISK_LEVERS).flat().every((l) => !gone.test(l.how) && !gone.test(l.label)), 'risk levers: no deleted action named');

// Glossary: the W8b terms exist and every link resolves.
const need = ['lawSb53', 'lawRaise', 'lawEuGpai', 'lawExport', 'govBriefing', 'attention', 'publicFrontier', 'incidentHeat', 'usLeadOverChina', 'talksSteps', 'stageSecurity', 'stageClearances', 'stageOversight', 'stageConsolidation', 'automationShare', 'pledgePreDeploy', 'pledgeFramework', 'pledgeWhistleblower', 'controlIndex'];
check(need.every((k) => GLOSSARY_V2[k] !== undefined), 'glossary: every W8b term present', need.filter((k) => !GLOSSARY_V2[k]).join(','));
const bad: string[] = [];
for (const [k, t] of Object.entries(GLOSSARY_V2)) for (const m of t.body.matchAll(/\[\[([A-Za-z0-9_]+)(?:\|[^\]]*)?\]\]/g)) if (!GLOSSARY_V2[m[1]!]) bad.push(`${k}->${m[1]}`);
check(bad.length === 0, 'glossary: every [[link]] resolves', bad.slice(0, 8).join(', '));
void USGOV;
finish('worldUiReadouts');
