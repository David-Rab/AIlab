import { newGame, defaultSetup } from '../src/engine/init';
import { resolveEvent } from '../src/engine/events';
import { tick, progressBreakdown, bestRival } from '../src/engine/sim';
import { dateOf } from '../src/engine/time';
import { refCapCompute, multiplierAt } from '../src/data/world';
const s = newGame({ ...defaultSetup(), world: 'ai2027', seed: 1001, alignment: 'medium' });
s.allocation = { capabilities: 0.5, alignment: 0.12, product: 0.3, security: 0.08 };
s.staffSplit = { capabilities: 0.7, alignment: 0.2, security: 0.1 };
s.researchQueue = ['spec', 'honeypots', 'cotmon', 'probes', 'sl3', 'trusted', 'envhard', 'delib', 'organisms', 'sae', 'audit', 'noise', 'inoculate', 'w2s', 'sl4', 'resample', 'killswitch', 'cotkeep', 'debate', 'untrusted', 'lockdown', 'circuits', 'goaltrain', 'sl5', 'crossexam', 'mona', 'character', 'steer', 'fsf', 'safetycase'];
while (!s.ending && s.day < 365 * 3.3) {
  if (s.day % 30 === 0 && s.company.cash < 15 && s.day - s.company.lastRaiseDay > 120) { s.company.cash += s.company.valuation * 0.08; s.company.lastRaiseDay = s.day; }
  while (s.events.length) { const id = s.events[0].id; console.log('EVENT', dateOf(s).toISOString().slice(0,10), id, 'p=', s.p.toFixed(2)); resolveEvent(s, id === 'neuralese' ? 1 : id === 'rivalCatchup' ? 1 : 0); }
  tick(s);
  if (s.day % 60 === 0) {
    const b = progressBreakdown(s);
    const r = bestRival(s);
    console.log(dateOf(s).toISOString().slice(0, 7), `p=${s.p.toFixed(2)} M=${b.mult.toFixed(1)} rate=${b.rate.toFixed(2)} cf=${b.computeFactor.toFixed(2)} tal=${b.talentFactor.toFixed(2)} tax=${b.taxFactor.toFixed(2)} neu=${b.neuralese.toFixed(2)} silo=${b.silo} sab=${b.sabotage.toFixed(2)} comp=${(s.company.compute/1e6).toFixed(1)}M cap=${s.allocation.capabilities.toFixed(2)} ref=${(refCapCompute(s.world, s.day/365)/1e6).toFixed(1)}M | china p=${s.china.p.toFixed(2)} M=${multiplierAt(s.world, s.china.p).toFixed(1)} | rival p=${r.p.toFixed(2)} | paused=${s.flags.paused}`);
  }
}
