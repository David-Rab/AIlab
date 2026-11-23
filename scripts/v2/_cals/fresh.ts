// CAL-S probe: a fresh game (default setup, one seed) at day 0 and day 1: what the default framework triggers.
import { newGame, defaultSetupV2 } from '../../../src/engine/v2/core/init';
import { tick } from '../../../src/engine/v2/core/loop';
import { frameworkOf, ruleTriggered, trainingHolds } from '../../../src/engine/v2/safety/framework';
import { measuredDomain } from '../../../src/engine/v2/actors/commitments';
import { beliefHi } from '../../../src/engine/v2/safety/detection';
import { RED_FLAG_TRAITS } from '../../../src/engine/v2/safety/common';
const world = (process.argv[2] ?? 'ai2027') as any;
const s = newGame(defaultSetupV2({ world, seed: 2027, tutorial: false }));
const show = () => {
  console.log(`== ${world} day ${s.time.day}`);
  for (const v of s.player.models.versions) {
    const dom = (['BIO', 'CYBER', 'RSCH', 'CODE', 'AGENCY'] as const).map((d) => `${d} ${v.domains[d]?.toFixed(2)}/${v.evals.suiteDay !== undefined ? measuredDomain(v, d).toFixed(2) : '-'}`).join(' ');
    console.log(`${v.id} ${v.name} [${v.status}] Lg ${v.Lg?.toFixed(2)} suite ${v.evals.suiteDay} (true/measured) ${dom}`);
    console.log('   top-90%: ' + RED_FLAG_TRAITS.map((t) => `${t} ${(v.beliefs[t]?.est ?? NaN).toFixed(2)}±${(v.beliefs[t]?.sd ?? NaN).toFixed(2)} hi ${beliefHi(v.beliefs[t]).toFixed(2)}`).join('; '));
    for (const r of frameworkOf(s).rules) { const w = ruleTriggered(s.hidden.timeline, r, v); if (w) console.log(`   TRIGGERS ${r.id}: ${w}`); }
  }
  console.log('training holds:', JSON.stringify(trainingHolds(s)), 'deploy held:', s.player.deployments.filter((d) => d.held).map((d) => d.id + ':' + d.channel));
  console.log('deployments:', s.player.deployments.map((d) => `${d.channel}/${d.safeguards}/${(d as any).guards?.join('+') ?? ''}`).join(', '));
};
show();
tick(s);
show();
