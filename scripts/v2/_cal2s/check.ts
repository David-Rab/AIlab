// CAL2-S targeted check (run alone: npx tsx scripts/v2/_cal2s/check.ts): decisions 9 and 11 per world.
//  1. the default framework's Bio / Cyber High rules sit at the world's own median expert (to 0.1 L), Critical at 10;
//  2. the RL graders (traits.ts graderOoms) sit at the median expert's effective compute, G_SC − Δ_bm;
//  3. graderSound is 1 for a policy at the graders' level and below, < 1 above it;
//  4. the edit limit reads around the world's own High level.
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { gV0, medianExpertLevel } from '../../../src/engine/v2/models/capability';
import { graderOoms, graderSound } from '../../../src/engine/v2/safety/traits';
import { editRule, frameworkOf, worldFrameworkRules } from '../../../src/engine/v2/safety/framework';
import { FRAMEWORK_LEVEL_SLACK, FRAMEWORK_BELIEF_SLACK } from '../../../src/data/v2/framework';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const want: Record<string, number> = { ai2027: 6.4, authors2026: 8.0, slow: 9.2, fast: 9.2 }; // at the CAL-T presets (rd 0397bd2)
for (const world of Object.keys(want)) {
  const s = newGame(defaultSetupV2({ world: world as never, seed: 2027, tutorial: false }));
  const w = s.hidden.timeline;
  const me = medianExpertLevel(w);
  const rules = frameworkOf(s).rules;
  const lvl = (id: string) => { const r = rules.find((x) => x.id === id); return r?.trigger.kind === 'capability' ? r.trigger.level : NaN; };
  check(lvl('bio-high') === want[world] && lvl('cyber-high') === want[world] && Math.abs(lvl('bio-high') - me) < 0.05, `${world}: High at the world's median expert`, `median expert ${me.toFixed(2)}, bio ${lvl('bio-high')}, cyber ${lvl('cyber-high')}`);
  check(lvl('bio-critical') === 10 && lvl('cyber-critical') === 10 && lvl('aird-critical') === 10, `${world}: Critical at the best human (10)`);
  const g = graderOoms(s);
  const gme = w.v3.gSC - w.v3.dBM - gV0(w);
  check(Math.abs(g.human - gme) < 1e-12 && g.human < w.v3.gSC - gV0(w), `${world}: graders at G_SC − Δ_bm`, `${g.human.toFixed(2)} OOM above V0 (best human ${(w.v3.gSC - gV0(w)).toFixed(2)})`);
  const at = (oom: number) => graderSound(s, { oom, h50Min: 203 });
  check(at(0) === 1 && at(g.human) === 1 && at(g.human + 1) < 1, `${world}: graders sound up to their level, not above`, `+1 OOM ${at(g.human + 1).toFixed(3)}, at best human ${at(w.v3.gSC - gV0(w)).toFixed(3)}`);
  const slack = { level: FRAMEWORK_LEVEL_SLACK, belief: FRAMEWORK_BELIEF_SLACK };
  const okEdit = editRule(structuredClone(s), 'bio-high', { level: want[world] + 1.9 }, worldFrameworkRules(s), slack);
  const badEdit = editRule(structuredClone(s), 'bio-high', { level: want[world] + 2.1 }, worldFrameworkRules(s), slack);
  check(okEdit === undefined && badEdit !== undefined, `${world}: edit limit around the world's High`, String(badEdit));
}
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
