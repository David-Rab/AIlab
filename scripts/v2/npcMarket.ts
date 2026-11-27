// N4 test: what NPC labs sell (engine/v2/npc/market.ts; design/npc/NPC-LABS.md §6). Run: npx tsx scripts/v2/npcMarket.ts
import { newGame, defaultSetupV2 } from '../../src/engine/v2/core/init';
import { tick } from '../../src/engine/v2/core/loop';
import { PRODUCT_TOOLS, PRODUCT_TOOL_BY_ID } from '../../src/data/v2/tools';
import { h50Of } from '../../src/engine/v2/models/capability';
import { npcDecodeU, npcServeOom } from '../../src/engine/v2/npc/model';
import { setNpcModel } from '../../src/engine/v2/npc/lab';
import { npcBuildDays, npcDomainDg, rivalToolStep, toolInFocus } from '../../src/engine/v2/npc/market';
import { decimalYear } from '../../src/engine/v2/core/time';
import type { GameStateV2, RivalLab } from '../../src/engine/v2/types';

let fails = 0;
const check = (ok: boolean, msg: string, detail = '') => { console.log(`${ok ? '  ok ' : 'FAIL '} ${msg}${detail ? `  (${detail})` : ''}`); if (!ok) fails++; };
const clone = (g: GameStateV2): GameStateV2 => JSON.parse(JSON.stringify(g));
const s = newGame(defaultSetupV2({ world: 'tl-central', start: 'challenger', seed: 7, tutorial: false }));
const coding = PRODUCT_TOOL_BY_ID.coding;
const w = s.hidden.timeline;

// (a) coding: gained exactly when the public h50 crosses 60 min (+ build time), and only if in focus.
for (const lab of s.rivals.filter((r) => r.npc && r.publicModel)) {
  const c = clone(s);
  const r = c.rivals.find((x) => x.core.id === lab.core.id)!;
  r.tools = (r.tools ?? []).filter((t) => t !== 'coding');
  const kind = r.npc!.kind;
  const yr = decimalYear(c);
  const pub = r.publicModel!;
  const set = (g: number) => setNpcModel(w, pub, g, r.core.computeOnline, yr, kind);
  // G where h50 just passes 60 min, found on this model's own readout
  let lo = -5, hi = 40;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; set(m); if (h50Of(w, pub) >= 60) hi = m; else lo = m; }
  const Gx = hi;
  set(Gx - 0.05);
  const below = h50Of(w, pub);
  let day = c.time.day;
  for (let i = 0; i < 300; i++) rivalToolStep(c, r, ++day);
  const noneBelow = !r.tools!.includes('coding');
  set(Gx + 0.05);
  const above = h50Of(w, pub);
  const cross = day + 1;
  let got = -1;
  for (let i = 0; i < 400 && got < 0; i++) { rivalToolStep(c, r, ++day); if (r.tools!.includes('coding')) got = day; }
  const tag = `${r.core.name} (${kind}) h50 ${below.toFixed(1)} -> ${above.toFixed(1)} min`;
  if (toolInFocus(kind, coding)) check(noneBelow && below < 60 && above >= 60 && got === cross + npcBuildDays(coding), `(a) ${tag}: coding on day ${got} = crossing ${cross} + build ${npcBuildDays(coding)}`);
  else check(noneBelow && got < 0, `(a) ${tag}: coding not in focus, never ships`);
}
check(s.rivals.some((r) => !toolInFocus(r.npc!.kind, coding)) && s.rivals.some((r) => toolInFocus(r.npc!.kind, coding)), '(a) the cast has labs with and without coding in focus');
const req = PRODUCT_TOOLS.filter((t) => t.npcHorizonMin !== undefined).map((t) => `${t.id}:${t.npcHorizonMin}`).sort().join(' ');
check(req === 'agentMode:120 coding:60 computerUse:20 research:11', '(a) requirements live on the tool data', req);

// (b) domains: G plus the focus offsets.
for (const r of s.rivals.slice(0, 3)) {
  const dg = npcDomainDg(r.npc!.kind);
  const tot = Object.values(dg).reduce((a, x) => a + (x ?? 0), 0);
  check(Math.abs(tot - 1) < 1e-9 && r.internal.domainDg?.CODE === dg.CODE, `(b) ${r.core.name} domain offsets = its kind's focus (sum ${tot.toFixed(2)} OOM)`, Object.entries(dg).map(([d, v]) => `${d} ${v!.toFixed(2)}`).join(' '));
}

// (c) 900 days.
const labs = (g: GameStateV2): RivalLab[] => [...g.rivals, g.china.lab];
const shares: Record<number, string[]> = {};
const toolDays: string[] = [];
const seenTools = new Map(labs(s).map((r) => [r.core.id, new Set(r.tools ?? [])]));
const pubSeen = new Map(labs(s).map((r) => [r.core.id, r.publicModel?.id]));
let lineupOk = true, lineupMsg = '', releases = 0;
let err: unknown;
try {
  while (s.time.day < 900) {
    tick(s, { skip: ['endings'] });
    for (const r of labs(s)) {
      for (const t of r.tools ?? []) if (!seenTools.get(r.core.id)!.has(t)) { seenTools.get(r.core.id)!.add(t); toolDays.push(`${r.core.name} +${t} d${s.time.day}`); }
      const pid = r.publicModel?.id;
      if (pid && pid !== pubSeen.get(r.core.id)) {
        pubSeen.set(r.core.id, pid);
        releases++;
        // on a release the previous public model stays on sale and the new one's students enter distillation
        if (!(r.distilling ?? []).some((m) => m.id.startsWith(pid))) { lineupOk = false; lineupMsg = `${r.core.name} day ${s.time.day}`; }
      }
    }
    if (s.time.day === 180 || s.time.day === 540) {
      const rows = [{ n: 'player', v: s.player.finance.revenueRun }, ...labs(s).map((r) => ({ n: r.core.name, v: r.finance.revenueRun }))];
      const T = rows.reduce((a, x) => a + x.v, 0);
      shares[s.time.day] = [...rows.map((x) => `${x.n} ${(100 * x.v / T).toFixed(1)}% ($${x.v.toFixed(1)}B)`), `total $${T.toFixed(1)}B/yr`];
    }
  }
} catch (e) { err = e; console.log(e); }
check(!err && s.time.day === 900, '(c) 900-day tl-central game ran without errors');
check(npcServeOom(s.time.day) > 0 && npcDecodeU(s) > 0.07, '(c) serving efficiency non-zero', `${npcServeOom(s.time.day).toFixed(3)} OOM at day 900`);
check(releases > 0 && lineupOk, `(c) lineup tiers present on every release (${releases} releases)`, lineupMsg);
check(labs(s).every((r) => (r.lineup ?? []).length > 0), '(c) every lab has lineup tiers at day 900', labs(s).map((r) => `${r.core.name} ${(r.lineup ?? []).length}`).join(', '));
console.log('     tool arrivals: ' + (toolDays.join('; ') || 'none'));
for (const d of [180, 540]) console.log(`     revenue share day ${d}: ${(shares[d] ?? []).join(' | ')}`);
console.log(fails ? `${fails} FAILED` : 'ok');
process.exit(fails ? 1 : 0);
