// Structure lint (STRUCTURE §8, rules R2/R3). Run: npx tsx scripts/v2/lint-structure.ts
// Cost: no sim (registry + a text walk of src/ and scripts/v2), about 3 CPU-s. Tier: quick, full.
// 1. Every engine system carries one STRUCTURE §4 system tag; every player action one R2 verb and one system.
//    (Both fields are required by the types; this guards casts and runtime-built defs.)
// 2. Every game system of §4 (people … world) has at least one engine system or action (no orphan system), and
//    every R2 verb is used by at least one action (no dead verb).
// 3. Action ids are unique and every action has a title of at most four words (one verb set, terse labels).
// 4. Model v3 F3: no reader of the retired progress coordinate pm = Φ(G) or the know-how readout pa (every lab's
//    capability is G, its display level λ(G) from models/capability.ts levelOfG) anywhere in src/ or scripts/v2/ (UB-3: no
//    exemptions since the save break deleted the migrations). Code only: comments, strings and regex
//    literals are stripped first.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTIONS, SYSTEMS } from '../../src/engine/v2/core/registry';
import type { ActionVerb, StructureSystem } from '../../src/engine/v2/types';

const SYSTEM_IDS: readonly StructureSystem[] = ['people', 'research', 'models', 'products', 'safety', 'compute', 'finance', 'relations', 'world', 'core'];
const VERBS: readonly ActionVerb[] = ['hire', 'research', 'train', 'launch', 'policy', 'deal', 'respond'];

let fails = 0;
const ok = (name: string, cond: boolean, detail = '') => {
  if (!cond) fails++;
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${detail ? `  ${detail}` : ''}`);
};
/** Known findings (a real rule hit in src data, owned by OPEN.md): printed WARN, listed by action id; any other hit fails. */
const KNOWN_LONG: Record<string, string> = {
  'research.safReAlloc': 'OPEN.md § Bugs: title "Safety research engineers by need" is 5 words (src/data, UI wording)',
};

const badSys = SYSTEMS.filter((s) => !SYSTEM_IDS.includes(s.system as StructureSystem)).map((s) => s.id);
ok(`Every engine system has a structure tag (${SYSTEMS.length})`, badSys.length === 0, badSys.join(', '));

const badVerb = ACTIONS.filter((a) => !VERBS.includes(a.verb as ActionVerb)).map((a) => a.id);
ok(`Every action has an R2 verb (${ACTIONS.length})`, badVerb.length === 0, badVerb.join(', '));
const badASys = ACTIONS.filter((a) => !SYSTEM_IDS.includes(a.system as StructureSystem)).map((a) => a.id);
ok(`Every action has a structure system (${ACTIONS.length})`, badASys.length === 0, badASys.join(', '));

const covered = new Set<string>([...SYSTEMS.map((s) => s.system), ...ACTIONS.map((a) => a.system)]);
const orphan = SYSTEM_IDS.filter((x) => x !== 'core' && !covered.has(x));
ok('Every §4 system has engine systems or actions', orphan.length === 0, orphan.join(', '));
const usedVerbs = new Set(ACTIONS.map((a) => a.verb));
const deadVerb = VERBS.filter((v) => !usedVerbs.has(v));
ok('Every R2 verb is used', deadVerb.length === 0, deadVerb.join(', '));

const ids = ACTIONS.map((a) => a.id);
const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
ok('Action ids unique', dup.length === 0, dup.join(', '));
const longAll = ACTIONS.filter((a) => a.title.trim().split(/\s+/).length > 4);
for (const a of longAll) if (KNOWN_LONG[a.id]) console.log(`WARN Action "${a.id}" title "${a.title}" > 4 words\n     known: ${KNOWN_LONG[a.id]}`);
const long = longAll.filter((a) => !KNOWN_LONG[a.id]).map((a) => `${a.id} "${a.title}"`);
ok('Action titles ≤ 4 words', long.length === 0, long.join(', '));

// 4. No pm / Φ / pa readers (model v3 F3).
{
  const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
  const ALLOW = new Set(['scripts/v2/lint-structure.ts']);
  const FORBIDDEN = [
    /\.pm\b/, /(^|[{,]\s*)pm\s*:/, // a model's pm (field read or written)
    /\.(pa|paSync|paIn|paAtStart|paTrack|openWeightsFrontier)\b/, // the know-how readout and its copies
    /\b(pmOfG|gOfPm|pmOfBuild|bestPm|truePm|pmOfLevel|levelOfPmV2|bridgeQ|capIndexV2|slopeL|paRef|syncPa|syncRivalPa|absorbKnowHow|paOfGEquiv|paOfRecipe)\b/, // the bridge's functions
    /(^|[^\w.])levelOf\s*\(/, // v2's levelOf(w, pm) (the one map is levelOfG)
  ];
  /** Code without comments, string literals and regex literals (a lint, not a parser: good enough for this tree). */
  const blank = (m: string) => m.replace(/[^\n]/g, ''); // keeps the line count
  const codeOf = (src: string) => src
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1')
    .replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g, blank)
    .replace(/([=(,:!&|?;{}[]\s*|return\s+)\/(?![*/])(?:\\.|\[(?:\\.|[^\]\n])*\]|[^/\\\n])+\/[dgimsuy]*/g, '$1/x/');
  const files: string[] = [];
  for (const dir of ['src', join('scripts', 'v2')]) {
    for (const f of readdirSync(join(root, dir), { recursive: true }) as string[]) if (/\.(ts|tsx)$/.test(f)) files.push(join(dir, f));
  }
  const bad: string[] = [];
  for (const f of files) {
    const rel = relative(root, join(root, f)).replace(/\\/g, '/');
    if (ALLOW.has(rel)) continue;
    codeOf(readFileSync(join(root, f), 'utf8')).split('\n').forEach((line, i) => {
      if (FORBIDDEN.some((re) => re.test(line))) bad.push(`${rel}:${i + 1}: ${line.trim().slice(0, 90)}`);
    });
  }
  ok(`No pm / Φ / pa readers (${files.length} files)`, bad.length === 0, bad.slice(0, 8).join(' | '));
}

// Summary table (verbs × systems), for the PROGRESS log.
const table: Record<string, Record<string, number>> = {};
for (const a of ACTIONS) ((table[a.system] ??= {})[a.verb] = (table[a.system][a.verb] ?? 0) + 1);
console.log('\nactions by system × verb');
console.log(['system'.padEnd(10), ...VERBS.map((v) => v.padStart(8))].join(''));
for (const sys of SYSTEM_IDS) if (table[sys]) console.log([sys.padEnd(10), ...VERBS.map((v) => String(table[sys][v] ?? '').padStart(8))].join(''));
console.log(`engine systems: ${SYSTEM_IDS.map((x) => `${x} ${SYSTEMS.filter((s) => s.system === x).length}`).join(' · ')}`);

console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
