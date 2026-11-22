/**
 * RD-L05 lint: no hard-coded display-level threshold in engine mechanics (src/engine/v2). The display level λ is a
 * readout: a mechanism that switches at a milestone reads the milestone predicate (departments/workfit milestonesOf,
 * `milestoneDays`), and a capability dose is stated in OOM of effective compute above V0 or in work-type coverage.
 *
 * Flags, outside comments: a level-like identifier (L, Lg, seenL, measuredL, …Lg, level…) compared with a number
 * literal, minus or divided by a number literal, and comparisons with LEVEL_KNOTS[i] / SC_LEVEL. Allowed: display /
 * readout files (ALLOW_FILES) and lines tagged `level-lint-ok: <reason>` (on the line or the line above). Lines tagged
 * `level-lint-left: <task>` are known leftovers owned by a later task: listed, not failed. Domain levels
 * (x.CYBER − 10, …) count as levels.
 *
 *   npx tsx scripts/v2/levellint.ts
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { HERE } from './lib';

const ROOT = join(HERE, '..', '..', 'src', 'engine', 'v2');

/** Display / readout code: may state levels (the λ map itself, views, glossary). */
const ALLOW_FILES: RegExp[] = [
  /View\.ts$/, // safety/dangerView, pressureView … readouts
  /readouts?\.ts$/,
  /glossary\.ts$/,
  /^ui\//,
];

const ID = String.raw`\b(?:L|Lg|[a-z]\w*L|\w*Lg|level\w*|Level\w*)\b(?:\([^()]*\))?`;
const NUM = String.raw`(?:\d+(?:\.\d+)?)(?![\w.]*e-)`;
const PATTERNS: [string, RegExp][] = [
  ['level compared with a number', new RegExp(`${ID}\\s*(?:>=|<=|>|<)\\s*${NUM}`)],
  ['number compared with a level', new RegExp(`${NUM}\\s*(?:>=|<=|>|<)\\s*${ID}`)],
  ['level minus a number', new RegExp(`${ID}\\s*-\\s*${NUM}`)],
  ['level divided by a number', new RegExp(`${ID}\\s*/\\s*${NUM}`)],
  ['domain level against a number', new RegExp(String.raw`\.(?:CODE|RSCH|REASON|AGENCY|SOCIAL|MEDIA|CYBER|BIO|PHYS)\s*(?:-|>=|<=|>|<)\s*` + NUM)],
  ['comparison with a level knot', /(?:>=|<=|>|<)\s*(?:LEVEL_KNOTS\[|SC_LEVEL\b)|(?:LEVEL_KNOTS\[\d\]|SC_LEVEL)\s*(?:>=|<=|>|<)/],
];
/** Not capability levels: WSL (security level), zero / epsilon guards. */
const IGNORE = [/\bWSL\b/, /\b\w+\s*(?:>=|<=|>|<)\s*0(?![.\d])/, /\b\w+\s*(?:>=|<=|>|<)\s*1e-/];

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(f)) out.push(p);
  }
  return out;
}

/** Strip comments (line, block) and string literals, keeping line numbers. */
function code(src: string): string[] {
  const s = src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(['"`])(?:\\.|(?!\1)[^\\\n])*\1/g, (m) => `'${' '.repeat(Math.max(0, m.length - 2))}'`)
    .replace(/\/\/.*$/gm, '');
  return s.split('\n');
}

const hits: string[] = [];
const left: string[] = [];
for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  if (ALLOW_FILES.some((r) => r.test(rel))) continue;
  const raw = readFileSync(file, 'utf8').split('\n');
  const lines = code(raw.join('\n'));
  lines.forEach((ln, i) => {
    const tag = (re: RegExp) => re.test(raw[i]) || (i > 0 && re.test(raw[i - 1]));
    if (tag(/level-lint-ok/)) return;
    for (const [what, re] of PATTERNS) {
      const m = re.exec(ln);
      if (!m) continue;
      if (IGNORE.some((r) => r.test(m[0]))) continue;
      (tag(/level-lint-left/) ? left : hits).push(`${rel}:${i + 1}: ${what}: ${raw[i].trim().slice(0, 140)}`);
      break;
    }
  });
}

if (left.length) {
  console.log(`levellint: ${left.length} known leftover(s) (level-lint-left):`);
  for (const h of left) console.log('  ' + h);
}
if (hits.length) {
  console.log(`levellint: ${hits.length} hard-coded display-level use(s) in engine mechanics:`);
  for (const h of hits) console.log('  ' + h);
  console.log('Read the milestone predicate, restate in OOM above V0 / coverage, or tag a readout `level-lint-ok: <reason>`.');
  process.exit(1);
}
console.log('levellint: ok (no hard-coded display level in engine mechanics)');
