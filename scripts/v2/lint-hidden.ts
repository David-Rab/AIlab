// Hidden-state lint (V2-SPEC §2.1, §7.5): no reads of truth under src/ui/v2/ except end/. Owner: WS6 (seeded by WS1).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { HERE, check, finish } from './lib';

const ROOT = join(HERE, '..', '..', 'src', 'ui', 'v2');
const RULES: [RegExp, string][] = [
  [/\bhidden\s*\./, '`hidden.` access'],
  [/\[\s*['"]hidden['"]\s*\]/, "`['hidden']` access"],
  [/\bselectHidden\b/, 'selectHidden'],
  [/\b\w+True\b/, '`*True` field (truth)'],
  [/\.pm\b|\.Lg\b|\bdoomThreshold\b|\bagendaEfficacy\b|\bparadigmSuccess\b/, 'hidden capability/world field'],
];

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f)) out.push(p);
  }
  return out;
}

const files = walk(ROOT).filter((f) => !relative(ROOT, f).split(sep).includes('end'));
let hits = 0;
for (const f of files) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (/^\s*(\/\/|\*)/.test(line)) return;
    for (const [re, what] of RULES) {
      if (re.test(line)) {
        hits++;
        console.log(`  ${relative(ROOT, f)}:${i + 1}  ${what}: ${line.trim()}`);
      }
    }
  });
}
check(hits === 0, `lint-hidden: ${files.length} UI file(s) outside end/ read no hidden state`, hits ? `${hits} hit(s)` : '');
finish('lint-hidden');
