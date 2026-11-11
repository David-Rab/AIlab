// Headless calibration run: `npm run sim [preset] [runs] [bot]`.
// Bot "race" plays like AI 2027's OpenBrain (grow compute ~3.5x/yr, ~3% alignment, first choice on events).
import { newGame, defaultSetup } from '../src/engine/init';
import { resolveEvent } from '../src/engine/events';
import { misalignment, tick, leadDays, bestRival } from '../src/engine/sim';
import { dateOf } from '../src/engine/time';
import { MILESTONES } from '../src/data/world';
import type { WorldPresetId } from '../src/engine/types';

const preset = (process.argv[2] ?? 'ai2027') as WorldPresetId;
const runs = Number(process.argv[3] ?? 5);
const bot = process.argv[4] ?? 'race';

const ym = (d: Date) => d.toISOString().slice(0, 7);

for (let r = 0; r < runs; r++) {
  const setup = { ...defaultSetup(), world: preset, seed: 1000 + r, alignment: 'medium' as const };
  const s = newGame(setup);
  if (bot === 'safe') {
    s.allocation = { capabilities: 0.5, alignment: 0.12, product: 0.3, security: 0.08 };
    s.staffSplit = { capabilities: 0.7, alignment: 0.2, security: 0.1 };
    s.researchQueue = ['spec', 'honeypots', 'cotmon', 'probes', 'sl3', 'trusted', 'envhard', 'delib', 'organisms', 'sae', 'audit', 'noise', 'inoculate', 'w2s', 'sl4', 'resample', 'killswitch', 'cotkeep', 'debate', 'untrusted', 'lockdown', 'circuits', 'goaltrain', 'sl5', 'crossexam', 'mona', 'character', 'steer', 'fsf', 'safetycase'];
    s.policies.whistleblowerProtection = true;
  } else {
    s.researchQueue = ['spec', 'honeypots', 'cotmon', 'sl3', 'trusted', 'envhard', 'sl4', 'probes', 'delib'];
  }
  while (!s.ending && s.day < 365 * 6) {
    // AI 2027 compute-by-use table: R&D share rises to ~77-83% in 2027 (race bot follows it)
    if (bot === 'race' && s.day === 550) s.allocation = { capabilities: 0.78, alignment: 0.02, product: 0.17, security: 0.03 };
    if (s.day % 30 === 0) {
      if (bot !== 'passive' && s.company.cash < 15 && s.day - s.company.lastRaiseDay > 120) {
        s.company.cash += s.company.valuation * 0.08;
        s.company.lastRaiseDay = s.day;
      }
      if (bot !== 'passive' && s.model.milestone <= 3 && s.p - s.model.publicP > 0.25) {
        s.model.publicP = s.p - 0.1;
        s.model.publicName = s.model.name + '-mini';
      }
    }
    while (s.events.length) {
      const id = s.events[0].id;
      // race/passive take the AI 2027 race choices; safe keeps English CoT and rolls back on red flags
      const pick = id === 'neuralese' && bot === 'safe' ? 1 : id === 'redFlags' ? (bot !== 'safe' || s.firedEvents.rolledBack ? 2 : 0) : id === 'rivalCatchup' ? 1 : id === 'treaty' && bot === 'race' ? 1 : 0;
      if (id === 'redFlags' && pick === 0) s.firedEvents.rolledBack = s.day;
      resolveEvent(s, pick);
    }
    tick(s);
  }
  const ms = Object.entries(s.milestoneDays).map(([i, d]) => `${MILESTONES[+i].short}:${ym(dateOf(s, d))}`).join(' ');
  console.log(
    `#${r} ${ms} | end=${s.ending?.id ?? '-'} ${ym(dateOf(s))} | M=${misalignment(s).toFixed(2)} est=${misalignment(s, true).toFixed(2)} | cash=${s.company.cash.toFixed(0)} rev=${s.company.revenueRun.toFixed(0)} val=${(s.company.valuation / 1000).toFixed(1)}T compute=${(s.company.compute / 1e6).toFixed(1)}M | chinaLead=${leadDays(s, s.china.p).toFixed(0)}d rivalLead=${leadDays(s, bestRival(s).p).toFixed(0)}d | appr=${s.pub.approval.toFixed(0)} gov=${s.gov.preset}/r${s.gov.rung} cn=${s.china.preset}/r${s.china.rung}${s.china.stoleWeights ? '/stole' : ''} | base0=${s.world.base0.toFixed(1)}`,
  );
  console.log("    traits " + Object.entries(s.model.traits).map(([k, t]) => `${k}=${t.value.toFixed(2)}/${t.est.toFixed(2)}`).join(" "));
  const sc = s.ending?.scores;
  if (sc) console.log(`    scores ${JSON.stringify(sc)}  events: ${Object.keys(s.firedEvents).join(',')}`);
}
