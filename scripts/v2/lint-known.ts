// Known-deviation lint (design/TESTING.md §5). Run: npx tsx scripts/v2/lint-known.ts
// Guards: every documented deviation (a KNOWN / KNOWN_* registration that turns a failing check into WARN) points at a
//   real row of design/OPEN.md, so no known failure lives only in a script comment.
// Cost: no sim, text only, well under 3 CPU-s. Tier: quick, full.
//
// Scanned: top-level scripts/v2/*.ts and *.mjs (not this file, not lib.ts). A registration is either
//   KNOWN[...] = <value>;            or an entry `key: <value>,` inside `const KNOWN... = {` ... `};`
// <value> must resolve statically: string literals ('…', "…", `…` without ${}) joined by +, or the name of a
// `const NAME = <literal>` in the same file. A dynamic value (e.g. safetyrates' `KNOWN[label] = r.gap`) must carry a
// marker comment on its line, `// lint-known: NAME, NAME`, naming the constants that can flow into it; each is checked.
// Anything else that cannot be resolved is a failure listed with file:line.
//
// Format of every value:  `OPEN.md § <Section>: <text>`
//   <Section> is an existing `## ` heading of design/OPEN.md.
//   <text> shares a distinctive phrase with a row of that section: 3 consecutive words (letters/digits, lower-cased,
//   punctuation ignored; at least one word of 4+ letters) that also occur, in that order, in the row's text.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, finish } from './lib';

const DIR = fileURLToPath(new URL('.', import.meta.url));
const OPEN = readFileSync(join(DIR, '../../design/OPEN.md'), 'utf8');

const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter(Boolean);
const trigrams = (s: string) => {
  const w = words(s);
  const out = new Set<string>();
  for (let i = 0; i + 2 < w.length; i++) {
    const g = w.slice(i, i + 3);
    if (g.some((x) => x.length >= 4)) out.add(g.join(' '));
  }
  return out;
};

// section name -> trigram sets of its table rows
const sections = new Map<string, Set<string>[]>();
{
  let cur: string | null = null;
  for (const line of OPEN.split(/\r?\n/)) {
    const h = /^## (.+?)\s*$/.exec(line);
    if (h) { cur = h[1]; sections.set(cur, []); continue; }
    if (cur && line.startsWith('|') && !/^\|\s*(Item|-)/.test(line)) sections.get(cur)!.push(trigrams(line));
  }
}

interface Entry { file: string; line: number; text: string }
const problems: string[] = [];
const entries: Entry[] = [];

const LIT = /^(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\$]|\\.)*`)$/s;
const unescape = (lit: string) => new Function(`return ${lit}`)() as string;

/** Split on top-level `+` (outside quotes). */
function splitPlus(expr: string): string[] {
  const parts: string[] = [];
  let q = '', cur = '';
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (q) { cur += c; if (c === '\\') cur += expr[++i]; else if (c === q) q = ''; continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; cur += c; continue; }
    if (c === '+') { parts.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  parts.push(cur.trim());
  return parts;
}

function resolve(expr: string, consts: Map<string, string>): string | null {
  let out = '';
  for (const p of splitPlus(expr.replace(/[;,]\s*(\/\/.*)?$/, '').trim())) {
    if (LIT.test(p)) out += unescape(p);
    else if (consts.has(p)) out += consts.get(p)!;
    else return null;
  }
  return out;
}

for (const f of readdirSync(DIR).filter((n) => /\.(ts|mjs)$/.test(n) && n !== 'lint-known.ts' && n !== 'lib.ts')) {
  const lines = readFileSync(join(DIR, f), 'utf8').split(/\r?\n/);
  const consts = new Map<string, string>();
  for (const l of lines) {
    const m = /^(?:export )?const (\w+)\s*(?::\s*string\s*)?=\s*(.+?);\s*(?:\/\/.*)?$/.exec(l);
    if (m) { const v = resolve(m[2], new Map()); if (v !== null) consts.set(m[1], v); }
  }
  let inBlock = false;
  lines.forEach((l, i) => {
    const at = `${f}:${i + 1}`;
    const marker = /\/\/ lint-known:\s*(.+)$/.exec(l);
    const reg = /\bKNOWN\w*\[[^\]]+\]\s*=(?!=)\s*(.+?)\s*$/.exec(l);
    if (reg) {
      if (marker) {
        for (const n of marker[1].split(',').map((s) => s.trim())) {
          if (consts.has(n)) entries.push({ file: f, line: i + 1, text: consts.get(n)! });
          else problems.push(`${at} marker names ${n}, which is not a literal const in the file`);
        }
        return;
      }
      const v = resolve(reg[1], consts);
      if (v === null) problems.push(`${at} KNOWN value cannot be resolved statically`);
      else entries.push({ file: f, line: i + 1, text: v });
      return;
    }
    if (/\bconst KNOWN\w*\b[^=]*=\s*\{\s*$/.test(l)) { inBlock = true; return; }
    if (inBlock) {
      if (/^\s*\}\s*;?\s*$/.test(l)) { inBlock = false; return; }
      const e = /^\s*(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|[\w.]+)\s*:\s*(.+?)\s*$/.exec(l);
      if (!e) return;
      const v = resolve(e[1], consts);
      if (v === null) problems.push(`${at} KNOWN value cannot be resolved statically`);
      else entries.push({ file: f, line: i + 1, text: v });
    }
  });
}

check(problems.length === 0, 'Every KNOWN value resolves statically (literals, + and file constants)', problems.join('; '));
check(entries.length > 0, `KNOWN registrations found (${entries.length})`);

const seen = new Set<string>();
for (const e of entries) {
  const key = `${e.file}:${e.line}:${e.text}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const at = `${e.file}:${e.line}`;
  const m = /^OPEN\.md § (.+?): (.+)$/s.exec(e.text);
  if (!m) { check(false, `${at} KNOWN text starts "OPEN.md § <Section>: "`, e.text.slice(0, 80)); continue; }
  const rows = sections.get(m[1]);
  if (!rows) { check(false, `${at} section "${m[1]}" is a heading of design/OPEN.md`, [...sections.keys()].join(' | ')); continue; }
  const mine = trigrams(m[2]);
  const hit = rows.some((r) => [...mine].some((g) => r.has(g)));
  check(hit, `${at} KNOWN text shares a 3-word phrase with a row of OPEN.md § ${m[1]}`, m[2].slice(0, 80));
}
finish('lint-known');
