// Day-400 RefBot fixture (scripts/v2/fixtures/day400.json), read by _data.ts → data400.json. Provenance: DATA.md.
window.SHELL = {
  date: 'Aug 5, 2026', day: 400, speed: '3.0',
  lead: '154 d', leadWord: 'behind', leadColor: 'var(--bad)', rival: 'Meridian', cash: '$51.6B', runway: '8+ qtrs', loc: '0%', locModel: '',
  alertCount: 5, alertText: '3 research · 2 world',
  badges: { lab: ['idle', 'warn'], research: ['1', 'warn'], training: null, safety: null },
};
window.D = {
  lab: {
    alloc: {
      online: '3.8M', preset: 'Custom', autoSplit: 'off', idlePct: 46, idle: '1.75M',
      segs: [
        { name: 'Training', group: 'cap', pct: 39.6, h: '1.51M', idle: 39.6, why: 'no run queued' },
        { name: 'Data generation', group: 'cap', pct: 22.1, h: '845k', idle: 0 },
        { name: 'Research experiments', short: 'Experiments', group: 'cap', pct: 7.0, h: '267k', idle: 0 },
        { name: 'AI staff: engineering', ls: 'Engineering', group: 'cap', pct: 0.9, h: '33k', idle: 0, ai: true, small: true },
        { name: 'AI staff: experiments', ls: 'Experiments', group: 'cap', pct: 2.8, h: '106k', idle: 0, ai: true, small: true },
        { name: 'AI staff: ideas', ls: 'Ideas', group: 'cap', pct: 0.6, h: '25k', idle: 0, ai: true, small: true },
        { name: 'AI staff: safety', ls: 'Safety', group: 'saf', pct: 0, h: '0', idle: 0, ai: true, small: true },
        { name: 'Safety work', group: 'saf', pct: 0.3, h: '13k', idle: 0, small: true },
        { name: 'Safeguards', group: 'saf', pct: 0.1, h: '3k', idle: 0, small: true },
        { name: 'Products', group: 'prod', pct: 26.6, h: '1.01M', idle: 6.4, idleTxt: '244k' },
      ],
    },
    work: {
      maxEffort: 6.1,
      eng: { people: 750, teams: 5, q: 2, effort: '6.1', effortNum: 6.07, ai: { model: 'Atlas-2.8', copies: '19.6k', share: '63%' },
        needs: [{ name: 'Run setup', fill: 0, st: 'none' }, { name: 'Upkeep: products, tools', fill: 1, st: '20%' }, { name: 'Build queue', fill: 0, st: 'empty' }] },
      engSaf: { needs: [{ name: 'Upkeep: safeguards', fill: 1, st: '3%' }, { name: 'Spare (all engineers)', fill: 0.77, st: '77%', spare: true }] },
      reCap: { people: '1,500', teams: 15, q: 2, effort: '2.4', effortNum: 2.36, ai: { model: 'Atlas-2.10', copies: '63.9k', share: '35%' },
        needs: [{ name: 'Run operations', fill: 0, st: 'none' }, { name: 'Research experiments', fill: 1, st: '12 teams' }, { name: 'Spare', fill: 0.2, st: '3 teams', spare: true }] },
      sciCap: { people: 400, teams: 10, q: 2, effort: '1.2', effortNum: 1.19, ai: { model: 'Atlas-2.8', copies: '14.7k', share: '7%' },
        needs: [{ name: '6 programmes', fill: 1, st: '10 teams' }, { name: 'Idle', fill: 0, st: '0', spare: true }], link: 'Portfolio' },
      reSaf: { people: 100, teams: 1, q: 2, effort: '1.0', effortNum: 1, ai: null, aiNote: 'AI share allowed 0%',
        needs: [{ name: 'Human review', fill: 1, st: '19 people' }, { name: 'Validations', fill: 1, st: '40 people' }, { name: 'Safety evals', fill: 1, st: '20 people' }, { name: 'Research experiments', fill: 0.67, st: '21 of 31', short: true }], quiet: 'Cases, foothold removal: none open' },
      sciSaf: { people: 80, teams: 2, q: 2, effort: '1.0', effortNum: 1, ai: null, aiNote: 'AI share allowed 0%',
        needs: [{ name: '1 programme', fill: 1, st: '2 teams' }, { name: 'Idle', fill: 0, st: '0', spare: true }] },
      split: [10, 2],
      status: {
        eng: ['spare', '77% spare'], reCap: ['spare', '3 teams spare'], sciCap: ['ok', 'All on programmes'],
        reSaf: ['short', 'Short 10 people'], sciSaf: ['ok', 'All on programmes'],
      },
    },
    moves: [
      { kind: 'compute', what: 'Idle Training compute → Research experiments', target: 'Research speed', eff: '+66%', pre: '×3.0 → ×5.0', w: 1, cost: '+21% of compute (experiments ×4) · free until a run is queued' },
      { kind: 'hire', what: '+1 safety scientist team', target: 'Safety results', eff: '+0.5 /yr', w: 0.3, cost: '$32M/yr · ~4 wk to hire' },
      { kind: 'hire', what: '+1 safety research-engineer team', target: 'Safety results', eff: '+0.1 /yr', w: 0.12, cost: 'ends the 10-person shortage on safety experiments · $65M/yr · ~9 wk' },
    ],
    wont: ['Research engineers: 3 teams spare', 'Engineers: 77% spare', 'Scientists: no programme waits for ideas', 'More AI staff compute: no gain'],
  },
};
