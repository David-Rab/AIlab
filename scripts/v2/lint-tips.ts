// Jank O1: "every number has a tooltip" (good-ui 4) as a static check over the v2 UI source (run from lint-ux.ts).
//
// A number site is a JSX child expression that formats a number (F.money, F.pct, …, fmtNum, pct, .toFixed). It is
// covered when an ancestor in the same JSX tree opens a tooltip (Tip, Why, Limit, Term, ActBtn, KV, OptionTile, Pill),
// when it is itself tooltip content (inside a `content` / `tip` attribute, a TipCard, or a component whose name ends in
// "Tip"), or when it is an SVG <text> label (axis ticks and chart labels; the chart's hover carries the reading).
// Anything else must be on ALLOW below, with the reason. The rendered-screen check (scripts/v2/uitest.mjs, "tooltip
// coverage") measures the same rule on real screens. Parser: oxc (rolldown/experimental, a vite dependency), since
// TypeScript 7 ships no JS compiler API.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { parseSync } from 'rolldown/experimental';

const ROOT = join(process.cwd(), 'src', 'ui', 'v2');
const NUM = /\bF\.(money|count|h100e|pct|pp|num|level|dLevel|days|lead|quarters|runway|mult|size|power|idx|short|minutes|bench)\(|\bfmt(B|Num|Pct|Mult|Signed|Days)\(|\bpct0?\(|\.toFixed\(|\bdays\(/;
const TIP_TAGS = new Set(['Tip', 'Why', 'Limit', 'Term', 'ActBtn', 'KV', 'TipCard', 'WhyCard', 'OptionTile', 'Pill', 'text']);
const TIP_ATTRS = new Set(['content', 'tip', 'rows', 'note', 'footer']);

/** Justified exceptions: [file (relative to src/ui/v2), substring of the expression ('' = whole file), reason]. */
export const ALLOW: [string, string, string][] = [
  ['panels/Codex.tsx', '', 'the codex is reference text (L3) itself'],
  ['shell/Onboarding.tsx', '', 'coach cards and goals are explanatory text (L3)'],
  ['setup/Setup.tsx', '', 'start picker: each start card is its own description'],
  ['panels/Agents.tsx', 'la.L', 'edit preview warning: the preview itself is the before → after breakdown'],
  ['panels/Agents.tsx', 'lb.L', 'edit preview warning: the preview itself is the before → after breakdown'],
  ['panels/Agents.tsx', 'v.sdAI', 'rendered inside the AI-share tooltip trigger of its lane'],
  ['panels/Products.tsx', 'row(', 'edit preview: the before → after rows are the breakdown'],
  ['panels/Products.tsx', 'r.cutH100e', 'lever label inside the binding chip, which opens the binding breakdown'],
  ['panels/Training.tsx', 'card.effShare', 'limit tile sub-line: the whole tile opens its breakdown (UB-7)'],
  ['panels/Training.tsx', 'card.poolShare', 'limit tile sub-line: the whole tile opens its breakdown (UB-7)'],
  ['panels/Training.tsx', 'F.pct(v)', 'run-share pills are button labels (UB-7)'],
  ['panels/Training.tsx', 'L.computeCost', 'limit tile sub-line: the whole tile opens its breakdown (UB-7)'],
  ['panels/Training.tsx', 're.idle', 'limit tile sub-line: the whole tile opens its breakdown (UB-7)'],
  ['panels/Training.tsx', 'Math.log10(L.fData)', 'limit tile sub-line: the whole tile opens its breakdown (UB-7)'],
  ['panels/Compute.tsx', 'last.empty', 'status tile sub-line: the tile opens the tab with the breakdown'],
  ['panels/Research.tsx', 'rp?.progress', 'needs list inside the node card (L2), each row clicks to its idea'],
  ['panels/Research.tsx', 'paused at', 'queue row status text; the row clicks to the idea card'],
  ['panels/WorldRisk.tsx', 'F.pct(t)', 'axis ticks'],
  ['panels/safetyKit.tsx', '', 'UB-C RangeVal: a belief cell; every caller sits it inside its row tooltip (best guess, 90% range, certainty)'],
  ['panels/Safety.tsx', 'lb.deadEndTM', 'tab badge'],
  ['panels/Safety.tsx', 't.strength', 'tools grid: the tool name in the same row opens its breakdown (strength, faded, M½)'],
  ['panels/Safety.tsx', '1 - t.decay', 'tools grid: the tool name in the same row opens its breakdown (strength, faded, M½)'],
  ['panels/Safety.tsx', 'severityEst', 'closed-case outcome tag; the case card carries clarity and staffing'],
  ['panels/Research.tsx', 'payoff', 'node card (L2): each number sits with its explanation in words'],
  ['panels/Research.tsx', 'F.pct(odds)', 'node card (L2): each number sits with its explanation in words'],
];

export interface TipSite { file: string; line: number; text: string; allowed?: string }

type N = { type: string; start: number; end: number; [k: string]: unknown };

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (f.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const nameOf = (n: N): string => {
  const o = (n.openingElement as N | undefined)?.name as N | undefined;
  if (!o) return '';
  if (o.type === 'JSXIdentifier') return String(o.name);
  if (o.type === 'JSXMemberExpression') return String((o.property as N).name);
  return '';
};

/** Containers that hold JSX are not leaves: their own number sites are visited with their own ancestors. */
function hasJsx(n: N): boolean {
  if (n.type === 'JSXElement' || n.type === 'JSXFragment') return true;
  for (const v of Object.values(n)) {
    if (Array.isArray(v)) { for (const c of v) if (c && typeof c === 'object' && typeof (c as N).type === 'string' && hasJsx(c as N)) return true; }
    else if (v && typeof v === 'object' && typeof (v as N).type === 'string' && hasJsx(v as N)) return true;
  }
  return false;
}

function covered(stack: N[]): boolean {
  for (let i = stack.length - 1; i >= 0; i--) {
    const n = stack[i];
    if (n.type === 'JSXElement' && TIP_TAGS.has(nameOf(n))) return true;
    if (n.type === 'JSXAttribute' && TIP_ATTRS.has(String((n.name as N).name))) return true;
    if (n.type === 'Property' && TIP_ATTRS.has(String(((n.key as N | undefined)?.name ?? ''))) && !n.computed) return true;
    if ((n.type === 'FunctionDeclaration' && /Tip$|TipCard$/.test(String((n.id as N | null)?.name ?? '')))
      || (n.type === 'VariableDeclarator' && /Tip$|TipCard$/.test(String((n.id as N | null)?.name ?? '')))) return true;
  }
  return false;
}

export function tipSites(): { sites: TipSite[]; total: number } {
  const sites: TipSite[] = [];
  let total = 0;
  for (const file of walk(ROOT)) {
    const rel = relative(ROOT, file).split(sep).join('/');
    if (rel.startsWith('end/')) continue; // end screen: the epilogue is the explanation
    const code = readFileSync(file, 'utf8');
    const lineOf = (pos: number) => code.slice(0, pos).split('\n').length;
    const { program } = parseSync(file, code, { lang: 'tsx' }) as unknown as { program: N };
    const stack: N[] = [];
    const visit = (node: N) => {
      const parent = stack[stack.length - 1];
      if (node.type === 'JSXExpressionContainer' && parent && (parent.type === 'JSXElement' || parent.type === 'JSXFragment')) {
        const e = node.expression as N;
        const text = code.slice(e.start, e.end);
        if (e.type !== 'JSXEmptyExpression' && NUM.test(text) && !hasJsx(e)) {
          total++;
          if (!covered(stack)) {
            const allow = ALLOW.find(([f, sub]) => rel === f && text.includes(sub));
            sites.push({ file: rel, line: lineOf(node.start), text: text.replace(/\s+/g, ' ').slice(0, 90), allowed: allow?.[2] });
          }
        }
      }
      stack.push(node);
      for (const v of Object.values(node)) {
        if (Array.isArray(v)) { for (const c of v) if (c && typeof c === 'object' && typeof (c as N).type === 'string') visit(c as N); }
        else if (v && typeof v === 'object' && typeof (v as N).type === 'string') visit(v as N);
      }
      stack.pop();
    };
    visit(program);
  }
  return { sites, total };
}

if (process.argv[1] && process.argv[1].endsWith('lint-tips.ts')) {
  const { sites, total } = tipSites();
  const bad = sites.filter((x) => !x.allowed);
  for (const x of bad) console.log(`  ${x.file}:${x.line}  ${x.text}`);
  console.log(`number sites ${total}, untipped ${sites.length} (allow-listed ${sites.length - bad.length}), failing ${bad.length}`);
}
