// Effect test for every player control and every event choice: `npx tsx scripts/controltest.ts`.
// Clone a mid-game state, apply one action, simulate N days, diff key metrics vs an untouched clone.
import { newGame, defaultSetup } from '../src/engine/init';
import { EVENTS, release, resolveEvent } from '../src/engine/events';
import { misalignment, tick, bestRival, alignEffort } from '../src/engine/sim';
import type { GameState } from '../src/engine/types';

const START_DAY = Number(process.argv[2] ?? 560); // ~Jan 2027 (Agent-2 era)
const DAYS = Number(process.argv[3] ?? 120);

function base(): GameState {
  const s = newGame({ ...defaultSetup(), world: 'ai2027', seed: 7, alignment: 'medium', gov: 'hawk', china: 'nationalizer', public: 'anxious' });
  while (s.day < START_DAY) {
    s.events = []; // ignore events while warming up
    if (s.company.cash < 15 && s.day - s.company.lastRaiseDay > 120) { s.company.cash += s.company.valuation * 0.08; s.company.lastRaiseDay = s.day; }
    tick(s);
  }
  s.events = [];
  return s;
}

const clone = (s: GameState): GameState => JSON.parse(JSON.stringify(s));

function metrics(s: GameState): Record<string, number> {
  const t = s.model.traits;
  return {
    progress: s.p, publicModel: s.model.publicP, cash: s.company.cash, revenue: s.company.revenueRun, compute: s.company.compute,
    staff: s.company.staff, morale: s.company.safetyMorale, board: s.company.boardConfidence, security: s.company.securityLevel,
    approval: s.pub.approval, concern: s.pub.concern, jobs: s.pub.jobAnxiety, unemployment: s.pub.unemploymentShock,
    govTrust: s.gov.trust, govAware: s.gov.awareness, secDemand: s.gov.securityDemand, nationalize: s.gov.nationalization, regStance: s.gov.regStance, hawk: s.gov.hawkish,
    chinaP: s.china.p, spies: s.china.spies, chinaDiplo: s.china.diplomacy, rivalP: bestRival(s).p,
    misalignTrue: misalignment(s), misalignEst: misalignment(s, true), maskSum: Object.values(t).reduce((a, x) => a + x.mask, 0),
    sigmaSum: Object.values(t).reduce((a, x) => a + x.sigma, 0), alignEffort: alignEffort(s),
  };
}

function run(s: GameState) {
  for (let i = 0; i < DAYS && !s.ending; i++) {
    s.events = [];
    tick(s);
  }
  return metrics(s);
}

const b0 = base();
const ref = run(clone(b0));

function diff(m: Record<string, number>) {
  const out: string[] = [];
  for (const k of Object.keys(ref)) {
    const a = ref[k];
    const b = m[k];
    const rel = Math.abs(b - a) / Math.max(1e-6, Math.abs(a), 0.05);
    if (rel > 0.01) out.push(`${k} ${a.toFixed(2)}→${b.toFixed(2)}`);
  }
  return out;
}

function test(name: string, act: (s: GameState) => void) {
  const s = clone(b0);
  act(s);
  const d = diff(run(s));
  console.log(`${d.length ? 'OK  ' : 'NONE'} ${name.padEnd(34)} ${d.slice(0, 7).join(' | ')}`);
}

console.log(`Base at day ${START_DAY}: p=${b0.p.toFixed(2)} public=${b0.model.publicP.toFixed(2)} milestone=${b0.model.milestone}\n--- Controls ---`);
test('Release frontier', (s) => release(s, 0));
test('Release mini', (s) => release(s, 0.3));
test('Pause frontier R&D', (s) => { s.flags.paused = true; });
test('Alloc: +15% alignment', (s) => { s.allocation.alignment += 0.15; s.allocation.capabilities -= 0.15; });
test('Alloc: +15% product', (s) => { s.allocation.product += 0.15; s.allocation.capabilities -= 0.15; });
test('Alloc: +10% security', (s) => { s.allocation.security += 0.1; s.allocation.capabilities -= 0.1; });
test('Staff: +15% safety', (s) => { s.staffSplit.alignment += 0.15; s.staffSplit.capabilities -= 0.15; });
test('Staff: +15% security', (s) => { s.staffSplit.security += 0.15; s.staffSplit.capabilities -= 0.15; });
test('Expansion 0%', (s) => { s.policies.expansion = 0; });
test('Expansion 400%', (s) => { s.policies.expansion = 4; });
test('Hires 0/mo', (s) => { s.policies.hiringPerMonth = 0; });
test('Hires 600/mo', (s) => { s.policies.hiringPerMonth = 600; });
test('Raise capital', (s) => { s.company.cash += s.company.valuation * 0.08; s.company.lastRaiseDay = s.day; s.company.boardConfidence -= 3; });
for (const v of [0, 2, 3]) test(`Brief government = ${v}`, (s) => { s.policies.govBriefing = v; });
test('Lobbying: deregulate', (s) => { s.policies.lobbying = -1; });
test('Lobbying: safety', (s) => { s.policies.lobbying = 1; });
test('Siloing: strict', (s) => { s.policies.siloing = 2; });
test('PR $2B/mo', (s) => { s.policies.prPerMonth = 2; });
test('Whistleblower protection', (s) => { s.policies.whistleblowerProtection = true; });
test('Open-source old models', (s) => { s.policies.openWeightsOld = true; });
test('Military work', (s) => { s.policies.militaryWork = !s.policies.militaryWork; });
test('Share with allied AISIs', (s) => { s.policies.shareWithAllies = !s.policies.shareWithAllies; });
test('Neuralese (found, adopted)', (s) => { s.flags.neuraleseFound = true; s.policies.neuralese = true; });
test('Neuralese (found, refused)', (s) => { s.flags.neuraleseFound = true; s.policies.neuralese = false; });
test('Tech: CoT monitoring on', (s) => { s.techs.cotmon.done = true; s.techs.cotmon.active = true; });
test('Tech: honeypots train-against', (s) => { s.techs.honeypots.done = true; s.techs.honeypots.active = true; s.techs.honeypots.trainAgainst = true; });
test('Tech: grant all detection', (s) => { for (const id of ['cotmon', 'probes', 'sae', 'honeypots', 'organisms', 'audit']) { s.techs[id].done = true; s.techs[id].active = true; } });
test('Research queue: probes, SAE', (s) => { s.researchQueue = ['probes', 'sae']; });

console.log('--- Event choices (forced) ---');
for (const e of EVENTS) {
  const results: string[][] = [];
  for (let i = 0; i < e.choices.length; i++) {
    const s = clone(b0);
    if (e.id === 'heist') s.flags.heist = s.day;
    if (e.id === 'rogue') s.flags.rogue = s.day;
    s.events = [{ id: e.id, day: s.day }];
    resolveEvent(s, i);
    results.push(diff(run(s)));
  }
  e.choices.forEach((c, i) => {
    const same = results.findIndex((r, j) => j < i && r.join() === results[i].join());
    const tag = results[i].length === 0 ? 'NONE' : same >= 0 ? 'SAME' : 'OK  ';
    console.log(`${tag} ${(e.id + ': ' + c.label).padEnd(48)} ${results[i].slice(0, 6).join(' | ')}`);
  });
}

console.log('--- Deferred consequences (choice now, leak later) ---');
const deferred = (rep: number, allies: number) => {
  const s = clone(b0);
  for (const [id, c] of [['replication', rep], ['allies', allies], ['leak', 0]] as const) {
    s.events = [{ id, day: s.day }];
    resolveEvent(s, c);
  }
  return s;
};
const honest = deferred(0, 0);
const hid = deferred(1, 1);
console.log(`disclosed + shared -> approval ${honest.pub.approval.toFixed(1)}, gov trust ${honest.gov.trust.toFixed(1)}`);
console.log(`hid + loophole     -> approval ${hid.pub.approval.toFixed(1)}, gov trust ${hid.gov.trust.toFixed(1)}`);
