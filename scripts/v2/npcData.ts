// N2a: shape checks on the NPC headline-lab data tables (src/data/v2/npcLabs.ts). Run: npx tsx scripts/v2/npcData.ts
import { KINDS, NPC_KIND_IDS, PUBLIC_NOISE, REALISTIC_CAST, type NpcKindId } from '../../src/data/v2/npcLabs';
import { toolsAtStart, type LabArchetype } from '../../src/data/v2/tools';

const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (!c) fails.push(m); };
const unit = (x: number) => x >= 0 && x <= 1;
const sum = (o: Record<string, number | undefined>) => Object.values(o).reduce<number>((a, b) => a + (b ?? 0), 0);

for (const k of NPC_KIND_IDS) {
  const p = KINDS[k];
  ok(!!p, `kind ${k} missing`);
  if (!p) continue;
  ok(p.computeGrowthPerYear === null ? !!p.chinaDirected : p.computeGrowthPerYear > 1 && p.computeGrowthPerYear < 10, `${k} compute growth`);
  ok(['parent', 'private', 'state'].includes(p.funding), `${k} funding`);
  ok(p.releaseLagDays > 0 && p.releaseLagDays < 400, `${k} release lag`);
  ok(p.releaseCadenceDays >= 30 && p.releaseCadenceDays <= 200, `${k} cadence`);
  ok(!!p.openness?.mode, `${k} openness`);
  ok(Math.abs(sum(p.focus.channels) - 1) < 1e-9, `${k} channel weights sum ${sum(p.focus.channels)}`);
  ok(Math.abs(sum(p.focus.sectors) - 1) < 1e-9, `${k} sector weights sum ${sum(p.focus.sectors)}`);
  ok(unit(p.safetyEmphasis) && unit(p.raceResponse), `${k} safety/race range`);
}
ok(Object.keys(KINDS).length === 7, 'seven kinds');

const ARCH: Record<NpcKindId, LabArchetype> = { leader: 'leader', safety: 'safety', bigtech: 'bigtech', openweights: 'openweights', racer: 'maverick', upstart: 'upstart', china: 'deepcent' };
const us = REALISTIC_CAST.filter((c) => c.kind !== 'china');
ok(us.length === 6, `6 US labs, got ${us.length}`);
ok(REALISTIC_CAST.filter((c) => c.kind === 'china').length === 1, 'one China lab');
ok(new Set(REALISTIC_CAST.map((c) => c.kind)).size === 7, 'one lab per kind');
ok(new Set(REALISTIC_CAST.map((c) => c.id)).size === REALISTIC_CAST.length, 'unique ids');
for (const c of REALISTIC_CAST) {
  ok(!!c.name && !!c.family, `${c.id} names`);
  ok(!/openbrain|deepcent/i.test(c.name + c.family), `${c.id} uses an AI 2027 name`);
  ok(c.start.startDate === '2025-07-01', `${c.id} start date`);
  ok(c.start.headcount > 0, `${c.id} headcount`);
  ok(c.kind === 'china' ? c.start.computeH100e === 'china-meter' : typeof c.start.computeH100e === 'number' && c.start.computeH100e > 0, `${c.id} compute`);
  ok(c.start.publicLagMonths === null || c.start.publicLagMonths >= 0, `${c.id} public lag`);
  const want = [...toolsAtStart(ARCH[c.kind])].sort().join();
  ok([...c.start.tools].sort().join() === want, `${c.id} tools differ from tools.ts toolsAtStart: ${want}`);
  ok(c.start.internalModel.rule === 'advanceByReleaseLag', `${c.id} internal model rule`);
}
const pub = Object.fromEntries(REALISTIC_CAST.map((c) => [c.kind, c.start.publicLagMonths]));
ok(pub.leader === 0 && pub.bigtech === 2.5 && pub.safety === 3 && pub.china === 6.5 && pub.openweights === 9.6 && pub.racer === 6.5, 'public lags per CAST-2025 §1');
ok(PUBLIC_NOISE.compute.china.sigmaLn === 0.5 && PUBLIC_NOISE.exact.length === 6, 'noise table');

if (fails.length) { console.log('FAIL\n' + fails.join('\n')); process.exit(1); }
console.log(`npcData ok: ${NPC_KIND_IDS.length} kinds, ${REALISTIC_CAST.length} cast labs`);
