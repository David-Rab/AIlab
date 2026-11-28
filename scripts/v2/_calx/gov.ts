// CAL-X: GOV T1 Accept inputs on one RefBot classic run (seed arg). Run alone: npx tsx scripts/v2/_calx/gov.ts [seed]
import { dayOfDate } from '../../../src/engine/v2/core/time';
import { tick, resolve } from '../../../src/engine/v2/core/loop';
import { EVENT_BY_ID } from '../../../src/engine/v2/core/registry';
import { refBot } from '../../../src/engine/v2/bots/ref';
import { engine } from '../../../src/engine/v2/index';
import { newGame, defaultSetupV2 } from '../../../src/engine/v2/core/init';
import { worldMix } from '../../../src/engine/v2/worldfx/mix';
import { govAdviceG } from '../../../src/engine/v2/worldfx/control';
import { domainRefShift, levelOfG, domainScaleG } from '../../../src/engine/v2/models/capability';
import { internalVersion } from '../../../src/engine/v2/models/labs';
const s = newGame(defaultSetupV2({ seed: Number(process.argv[2] ?? 2027), world: 'tl-central', alignment: 'medium', tutorial: false }));
const w = s.hidden.timeline;
const END = dayOfDate('2025-07-01', '2028-04-01');
while (s.time.day < END) {
  for (const p of [...s.events.pending]) { const c = refBot.decide(s, p); if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0); }
  refBot.act(s, engine);
  tick(s, { skip: ['endings'] });
  if (s.time.day % 91 === 0) {
    const m = worldMix(s);
    const iv = internalVersion(s);
    const sh = domainRefShift(w, 'REASON');
    console.log(`d${s.time.day} adviser v2-L ${levelOfG(w, govAdviceG(s, m) + sh).toFixed(2)} GOV-market v2-L ${levelOfG(w, m.sec.US.GOV.g.REASON + sh).toFixed(2)} internal REASON v2-L ${iv ? levelOfG(w, domainScaleG(w, iv, 'REASON') + sh).toFixed(2) : '-'} internal Lg ${iv ? levelOfG(w, iv.G).toFixed(2) : '-'} briefing ${s.player.policies.govBriefing} gov products ${s.player.deployments.filter((d) => d.channel === 'vetted').length} accept ${s.world.control.GOV.accept.toFixed(3)}`);
  }
}
