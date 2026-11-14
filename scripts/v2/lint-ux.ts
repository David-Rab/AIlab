// UX engine/content checks (M5 UX). Run: npx tsx scripts/v2/lint-ux.ts
// 1. AUDIT #1 / PLAN B1 regression: switching the internal agent to an unevaluated child version must not drop the
//    displayed L to 0 or move U by more than 1.5 levels.
// 2. Glossary: every [[link]] in a glossary body, every <Term id="…"> and termId reference in src/ui/v2, and every
//    REQUIRED term resolves to an entry (IA rule 4: every technical or business term has a tooltip).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../src/engine/v2/core/save';
import { internalEval, internalVersion, measuredL, understanding } from '../../src/engine/v2/index';
import { GLOSSARY_V2 } from '../../src/data/v2/glossary';
import { FIXTURE_DIR } from './lib';

let fails = 0;
const ok = (name: string, cond: boolean, detail = '') => {
  if (!cond) fails++;
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${detail ? `  ${detail}` : ''}`);
};

// ── 1. internal-agent switch to an unevaluated version ──
for (const fx of ['day400.json', 'day900.json']) {
  const s = deserialize(readFileSync(join(FIXTURE_DIR, fx), 'utf8'));
  const v = internalVersion(s);
  if (!v) { ok(`${fx}: has an internal agent`, false); continue; }
  const L0 = measuredL(s);
  const U0 = understanding(s).U;
  const child = { ...structuredClone(v), id: `${v.id}-uxtest`, name: `${v.name}-test`, parentVersionId: v.id, status: 'evaluating' as const, evals: { bench: {}, safety: {} } };
  s.player.models.versions.push(child);
  s.player.models.internalAgent = child.id;
  const e = internalEval(s);
  const U1 = understanding(s).U;
  ok(`${fx}: L kept while evaluating`, Math.abs(e.L - L0) < 1e-9 && e.evaluating, `L ${L0} → ${e.L} (evaluating ${e.evaluating})`);
  ok(`${fx}: U stable on agent switch`, Math.abs(U1 - U0) <= 1.5, `U ${U0} → ${U1}`);
}

// ── 2. glossary resolution ──
const has = (id: string) => !!GLOSSARY_V2[id] || /^(trait|sig):/.test(id);
const bad: string[] = [];
for (const [id, t] of Object.entries(GLOSSARY_V2)) {
  for (const m of t.body.matchAll(/\[\[([a-zA-Z0-9_.:-]+)(?:\|[^\]]+)?\]\]/g)) if (!has(m[1])) bad.push(`${id} → [[${m[1]}]]`);
}
ok('Glossary links resolve', bad.length === 0, bad.slice(0, 12).join(', '));

const files: string[] = [];
const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(f)) files.push(p); } };
walk('src/ui/v2');
const used = new Set<string>();
for (const f of files) {
  const src = readFileSync(f, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l)).join('\n');
  for (const m of src.matchAll(/<Term\s+id="([^"]+)"/g)) used.add(m[1]);
  for (const m of src.matchAll(/\bterm(?:Id)?:\s*'([a-zA-Z0-9_]+)'/g)) used.add(m[1]);
  for (const m of src.matchAll(/\[\[([a-zA-Z0-9_.:-]+)(?:\|[^\]]+)?\]\]/g)) used.add(m[1]);
}
const missing = [...used].filter((id) => !has(id));
ok(`UI terms resolve (${used.size} used)`, missing.length === 0, missing.join(', '));

/** IA.md rule 4: the terms the user named, plus the core vocabulary of every panel. */
const REQUIRED = [
  'h100e', 'runway', 'covenant', 'dilution', 'evalaware', 'monitorability', 'rlIntensity', 'distill', 'spv', 'lta', 'wsl', 'U', 'L', 'gap',
  'bottleneck', 'computeBound', 'catRisk', 'lead', 'idleChips', 'computeOnline', 'pool', 'split', 'burn', 'netBurn', 'liquidity', 'ledger',
  'raiseCeiling', 'valuation', 'boardConf', 'rdmult', 'misalign', 'agenda', 'technique', 'finding', 'traitGraph', 'evidenceGrade', 'evalGate',
  'channel', 'servingShare', 'capacityBound', 'kyc', 'leverage', 'sector', 'trust', 'credibility', 'scrutiny', 'access', 'commitment', 'watch',
];
const req = REQUIRED.filter((id) => !GLOSSARY_V2[id]);
ok(`Required terms present (${REQUIRED.length})`, req.length === 0, req.join(', '));

console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
