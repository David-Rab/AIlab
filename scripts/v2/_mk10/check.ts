// MK-10 check: the tool table (src/data/v2/tools.ts) against design/MARKET.md "Tools (M9)" and M14.
import { SECTOR_BY_ID, SECTOR_IDS } from '../../../src/data/v2/sectors';
import { COVER } from '../../../src/data/v2/workTypes';
import { ADAPT_COVER, CERT_SECTORS } from '../../../src/engine/v2/models/adaptations';
import { AGENT_TASK_HOURS, FEATURE_BY_ID, type FeatureFx } from '../../../src/data/v2/features';
import {
  ADAPT_EQUIV_DG, LAB_NAME, PRODUCT_TOOL_BY_ID, PRODUCT_TOOLS, TOOL_PRODUCTS, TOOL_FROM_FEATURE, harnessForAdaptation,
  shippedBy, toolCertSectors, toolCertTerms, toolUpkeepTW, type LabArchetype, type ProductToolId,
} from '../../../src/data/v2/tools';
import type { SectorId } from '../../../src/engine/v2/types';

const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (!c) fails.push(m); };
const PNAME: Record<string, string> = { consumer: 'Chat', api: 'API', enterprise: 'Enterprise', vetted: 'Vetted' };
const LABS = Object.keys(LAB_NAME) as LabArchetype[];
const scope = (w: 'all' | string[]) => (w === 'all' ? 'all' : w.join(','));
const fxText = (f: FeatureFx) =>
  f.kind === 'scaffold' ? `+${f.dG} OOM x${f.tokens} tok [${scope(f.work)}]`
  : f.kind === 'horizon' ? `horizon x${f.mult} [${scope(f.work)}]`
  : f.consumer ? `Chat appeal +${f.share}` : `enabler ${f.share} [${(f.sectors ?? []).join(',')}]`;

console.log('Tool | kind | products | sectors | effects | build (TW, $B) | upkeep TW/wk (in use / idle) | certifies | rivals by 2025-07-01 | by 2025-07-31');
for (const t of PRODUCT_TOOLS) {
  const fx = [...t.fx.map(fxText), ...(t.agentGateH ? [`agent-hours, gate h50 >= ${t.agentGateH} h`] : []), ...(t.afford ? [`afford +${t.afford}`] : []),
    ...Object.entries(t.hazard ?? {}).map(([k, v]) => `${k} x${v}`)];
  const r = (c: string) => LABS.filter((a) => shippedBy(t, a, c)).map((a) => LAB_NAME[a] + (t.shipped[a]!.checked ? '' : ' (nc)')).join(', ') || 'none';
  console.log([t.name, t.kind, t.products.map((p) => PNAME[p]).join(', '), t.sectors.join(', ') || '-', fx.join('; ') || '-',
    `${t.buildTW}, ${t.cash}`, `${toolUpkeepTW(t).toFixed(3)} / ${toolUpkeepTW(t, false).toFixed(4)}`, toolCertSectors(t).join(', ') || '-', r('2025-07-01'), r('2025-07-31')].join(' | '));
}
const ct = toolCertTerms();
console.log(`\nCertification (M14): ${ct.days} d, $${ct.cash}B, friction -${ct.frictionCut}; CERT_SECTORS ${CERT_SECTORS.join(', ')}`);

// Counts and kinds (MARKET.md: 7 harnesses, 5 general).
const harnesses = PRODUCT_TOOLS.filter((t) => t.kind === 'harness');
ok(PRODUCT_TOOLS.length === 12 && harnesses.length === 7, `counts ${PRODUCT_TOOLS.length} / ${harnesses.length}`);
ok(new Set(PRODUCT_TOOLS.map((t) => t.id)).size === 12, 'duplicate ids');
// Every business sector helped by at least one harness (Media by Creative studio).
for (const s of SECTOR_IDS) ok(harnesses.some((t) => t.sectors.includes(s)), `${s} has no harness`);
ok(PRODUCT_TOOL_BY_ID.creative.sectors.includes('MEDIA'), 'Media not by Creative studio');
// Products within the four channels; Defence Vetted-only; Companion Chat-only.
for (const t of PRODUCT_TOOLS) ok(t.products.length > 0 && t.products.every((p) => TOOL_PRODUCTS.includes(p)), `${t.name} products ${t.products}`);
ok(PRODUCT_TOOL_BY_ID.defence.products.join() === 'vetted', 'Defence not Vetted-only');
ok(PRODUCT_TOOL_BY_ID.companion.products.join() === 'consumer', 'Companion not Chat-only');
// MARKET.md's product and sector columns.
const MD: Record<ProductToolId, [string, SectorId[]]> = {
  coding: ['api,enterprise,vetted', ['SOFT', 'SCI']], research: ['api,enterprise,vetted', ['SCI', 'FIN', 'LEGAL']],
  backOffice: ['enterprise,vetted', ['OFFICE', 'FIN', 'LEGAL', 'GOV', 'EDU']], clinical: ['enterprise,vetted', ['HEALTH']],
  operations: ['enterprise,vetted', ['MFG', 'LOG', 'ENGY', 'SERV']], defence: ['vetted', ['MIL', 'GOV']],
  creative: ['consumer,api,enterprise', ['MEDIA']], agentMode: ['api,enterprise,vetted', []],
  computerUse: ['api,enterprise,vetted', ['OFFICE', 'FIN', 'LEGAL', 'GOV']], memory: ['consumer,api,enterprise,vetted', []],
  voiceVision: ['consumer,api,enterprise,vetted', []], companion: ['consumer', []],
};
for (const t of PRODUCT_TOOLS) {
  ok(t.products.join() === MD[t.id][0], `${t.name} products ${t.products} vs MARKET.md ${MD[t.id][0]}`);
  ok(t.sectors.join() === MD[t.id][1].join(), `${t.name} sectors ${t.sectors} vs MARKET.md`);
  // A general tool's sectors are its enablers' sectors.
  if (t.kind === 'general') ok(t.sectors.join() === t.fx.flatMap((f) => (f.kind === 'enabler' ? f.sectors ?? [] : [])).join(), `${t.name} sectors vs fx`);
  // A harness's fit acts only on its own sectors (Chat appeal aside).
  if (t.kind === 'harness') for (const f of t.fx) {
    if (f.kind === 'enabler' && f.consumer) continue;
    const w = f.kind === 'enabler' ? f.sectors ?? [] : f.work;
    ok(w !== 'all' && w.every((x) => t.sectors.includes(x as SectorId)), `${t.name} acts outside its sectors`);
  }
}
// MARKET.md "Shipped by Jul 2025" labs are all in the data (by 31 Jul).
const MD_SHIPPED: Partial<Record<ProductToolId, LabArchetype[]>> = {
  coding: ['leader', 'safety', 'bigtech'], research: ['leader', 'safety', 'bigtech'], backOffice: [], clinical: [], operations: [],
  defence: ['leader', 'safety', 'bigtech'], creative: ['leader', 'bigtech'],
};
for (const [id, labs] of Object.entries(MD_SHIPPED) as [ProductToolId, LabArchetype[]][]) {
  for (const a of labs) ok(shippedBy(PRODUCT_TOOL_BY_ID[id], a, '2025-07-31'), `${id}: MARKET.md has ${LAB_NAME[a]}`);
  const extra = LABS.filter((a) => shippedBy(PRODUCT_TOOL_BY_ID[id], a, '2025-07-31') && !labs.includes(a));
  if (extra.length) console.log(`note: ${PRODUCT_TOOL_BY_ID[id].name} also shipped (by 31 Jul, per §5) by ${extra.map((a) => LAB_NAME[a]).join(', ')}: not in MARKET.md's table`);
}
// Certification: harness sectors with a certification (FIN, HEALTH, GOV, MIL), each covered by some harness.
for (const s of CERT_SECTORS) ok(harnesses.some((t) => toolCertSectors(t).includes(s)), `no harness certifies ${s}`);
ok([...toolCertSectors(PRODUCT_TOOL_BY_ID.defence)].sort().join() === 'GOV,MIL', 'defence certs');
// Agent mode gate; only Agent mode has one.
ok(PRODUCT_TOOL_BY_ID.agentMode.agentGateH === AGENT_TASK_HOURS, 'Agent mode gate');
ok(PRODUCT_TOOLS.filter((t) => t.agentGateH).length === 1, 'gate on another tool');
// Carried-over values (renamed features keep their numbers).
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
ok(same(PRODUCT_TOOL_BY_ID.coding.fx[0], FEATURE_BY_ID.codingAgent.fx[0]), 'coding SOFT vs Coding agent');
ok(same(PRODUCT_TOOL_BY_ID.research.fx, FEATURE_BY_ID.deepResearch.fx), 'research vs Deep research');
ok(same(PRODUCT_TOOL_BY_ID.computerUse.fx, FEATURE_BY_ID.computerUse.fx) && PRODUCT_TOOL_BY_ID.computerUse.afford === FEATURE_BY_ID.computerUse.afford, 'computer use');
ok(same(PRODUCT_TOOL_BY_ID.memory.fx, FEATURE_BY_ID.memory.fx), 'memory');
ok(same(PRODUCT_TOOL_BY_ID.companion.fx, FEATURE_BY_ID.companion.fx) && same(PRODUCT_TOOL_BY_ID.companion.hazard, FEATURE_BY_ID.companion.hazard), 'companion');
ok(same(PRODUCT_TOOL_BY_ID.creative.fx[0], FEATURE_BY_ID.voiceVision.fx[1]), 'Media enabler not moved to Creative studio');
ok(!PRODUCT_TOOL_BY_ID.voiceVision.fx.some((f) => f.kind === 'enabler' && f.sectors?.includes('MEDIA')), 'Voice & vision still has Media');
for (const [f, t] of Object.entries(TOOL_FROM_FEATURE)) {
  const a = FEATURE_BY_ID[f as keyof typeof FEATURE_BY_ID], b = PRODUCT_TOOL_BY_ID[t];
  ok(a.buildTW === b.buildTW && a.cash === b.cash && a.node === b.node, `${f} -> ${t} cost / node`);
}
// Conversions stated in tools.ts.
const logit = (p: number) => Math.log(p / (1 - p));
const dG = (p0: number, p1: number) => COVER.s * (logit(p1) - logit(p0));
const eq = dG(0.5, 0.5 * (1 + ADAPT_COVER));
ok(Math.abs(eq - ADAPT_EQUIV_DG) < 0.01, `ADAPT_EQUIV_DG ${ADAPT_EQUIV_DG} vs ${eq}`);
console.log('\nConversions (dG = COVER.s x dlogit):');
const conv: [string, number, number][] = [
  ['adaptation x1.15 at a = 0.5', 0.5, 0.575], ['SWE-bench V 3.7 Sonnet std -> high', 0.637, 0.703], ['SWE-bench V Opus 4', 0.725, 0.794],
  ['SWE-bench V Sonnet 4', 0.727, 0.802], ['SWE-bench Lite shell -> SWE-agent', 0.11, 0.18], ['BrowseComp 4o browsing', 0.006, 0.019],
  ['GAIA prior best -> DR', 0.6364, 0.6736], ['MAI-DxO o3', 0.786, 0.819], ['MAI-DxO o3 ensemble', 0.786, 0.855], ['+11 pp at 0.5', 0.5, 0.61],
  ['LLM-Modulo GPT-4-Turbo', 0.044, 0.206],
];
for (const [n, a, b] of conv) console.log(`  ${n}: ${a} -> ${b}: dG ${dG(a, b).toFixed(2)}`);
// Migration map (M14): Military -> Vetted's suite.
ok(harnessForAdaptation('MIL', 'vetted') === 'defence', 'MIL -> defence');
console.log('\nAdaptation -> harness (Enterprise / API / Vetted):');
for (const s of SECTOR_IDS) console.log(`  ${SECTOR_BY_ID[s].name}: ${harnessForAdaptation(s, 'enterprise') ?? '-'} / ${harnessForAdaptation(s, 'api') ?? '-'} / ${harnessForAdaptation(s, 'vetted') ?? '-'}`);

if (fails.length) {
  console.log(`\nFAIL (${fails.length}):\n  ` + fails.join('\n  '));
  process.exit(1);
}
console.log('\nall ok');
