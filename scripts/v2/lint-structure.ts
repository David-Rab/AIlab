// Structure lint (STRUCTURE §8, rules R2/R3). Run: npx tsx scripts/v2/lint-structure.ts
// 1. Every engine system carries one STRUCTURE §4 system tag; every player action one R2 verb and one system.
//    (Both fields are required by the types; this guards casts and runtime-built defs.)
// 2. Every game system of §4 (people … world) has at least one engine system or action (no orphan system), and
//    every R2 verb is used by at least one action (no dead verb).
// 3. Action ids are unique and every action has a title of at most four words (one verb set, terse labels).
import { ACTIONS, SYSTEMS } from '../../src/engine/v2/core/registry';
import type { ActionVerb, StructureSystem } from '../../src/engine/v2/types';

const SYSTEM_IDS: readonly StructureSystem[] = ['people', 'research', 'models', 'products', 'safety', 'compute', 'finance', 'relations', 'world', 'core'];
const VERBS: readonly ActionVerb[] = ['hire', 'research', 'train', 'launch', 'policy', 'deal', 'respond'];

let fails = 0;
const ok = (name: string, cond: boolean, detail = '') => {
  if (!cond) fails++;
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${detail ? `  ${detail}` : ''}`);
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
const long = ACTIONS.filter((a) => a.title.trim().split(/\s+/).length > 4).map((a) => `${a.id} "${a.title}"`);
ok('Action titles ≤ 4 words', long.length === 0, long.join(', '));

// Summary table (verbs × systems), for the PROGRESS log.
const table: Record<string, Record<string, number>> = {};
for (const a of ACTIONS) ((table[a.system] ??= {})[a.verb] = (table[a.system][a.verb] ?? 0) + 1);
console.log('\nactions by system × verb');
console.log(['system'.padEnd(10), ...VERBS.map((v) => v.padStart(8))].join(''));
for (const sys of SYSTEM_IDS) if (table[sys]) console.log([sys.padEnd(10), ...VERBS.map((v) => String(table[sys][v] ?? '').padStart(8))].join(''));
console.log(`engine systems: ${SYSTEM_IDS.map((x) => `${x} ${SYSTEMS.filter((s) => s.system === x).length}`).join(' · ')}`);

console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
