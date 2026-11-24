// RD-T10 check: every option unlock comes from one table (option → node), no node lists its unlocks, no node books cash.
// Run alone: npx tsx scripts/v2/rdt10.ts
import { OPTION_NODE, OPTIONS_OF, TREE, TREE_BY_ID } from '../../src/data/v2/tree';
import { PRODUCT_TOOLS as FEATURES } from '../../src/data/v2/tools';
import { DEMO_BUILD } from '../../src/data/v2/suites';

let fail = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? 'pass' : 'FAIL'} ${msg}`);
  if (!ok) fail++;
};
const bad = TREE.filter((n) => ['options', 'cash', 'cashCost', 'price', 'unlocks'].some((k) => k in n));
check(bad.length === 0, `no node carries an unlock list or a cash cost (${bad.map((n) => n.id).join(', ')})`);
check(Object.values(OPTION_NODE).every((id) => !!TREE_BY_ID[id]), 'every option names a tree node');
const back = Object.entries(OPTIONS_OF).flatMap(([id, l]) => l.map(([s, v]) => `${s}:${v}=${id}`)).sort().join();
check(back === Object.entries(OPTION_NODE).map(([k, id]) => `${k}=${id}`).sort().join(), 'node option lists are exactly the table');
check(FEATURES.every((f) => !f.node || !!TREE_BY_ID[f.node]), 'every gated product tool names a tree node (ProductToolDef.node)');
const demo = TREE_BY_ID[DEMO_BUILD.needs];
check(!!demo && !demo.effect, 'the demos build names P12; P12 has no effect (a plain unlock, nothing bought)');
// The pre-T10 derived table (from the nodes' own lists), pinned: behaviour identical.
const PRE = 'shape:moe=moe,shape:dense=dense,curation:quality=qualityFilter,data:codeMath=codeMath,data:science=scienceData,data:multimodal=multimodal,data:synthetic=P10,cot:faithful=P23,shape:latent=P17,cot:visible=P01,pref:engagement=engagement,pref:persuasion=persuasion,rlFocus:math=rl.math,rlFocus:swe=rl.swe,rlFocus:mlResearch=rl.mlResearch,rlFocus:longHorizon=rl.longHorizon,rlFocus:cyber=rl.cyber,rlFocus:bio=rl.bio,rlFocus:computerUse=P06,pref:constitution=T-SPEC,inoculation:true=T-INOC,curation:hazard=T-FILTER,curation:safetyPretrain=safetyPretrain';
check(PRE.split(',').sort().join() === Object.entries(OPTION_NODE).map(([k, id]) => `${k}=${id}`).sort().join(), 'table equals the pre-T10 option → node map');
process.exit(fail ? 1 : 0);
