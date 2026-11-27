// Data-centre mockup state: Jul 5, 2026 (Q3 26). L0 shell = the market mockup's day-369 values (same save).
// Site and build-card values are computed by hand from design/DATACENTERS.md tables; see NOTES.md for every number.
window.SHELL = {
  date: 'Jul 5, 2026', day: 369, speed: '13.0',
  lead: '195 d', leadWord: 'ahead of', leadColor: 'var(--good)', rival: 'DeepCent', cash: '$97.6B', runway: '3 qtrs', loc: '< 0.1%', locModel: '',
  alertCount: 10, alertText: '5 research · 5 other',
  badges: { lab: null, research: null, training: null, safety: null },
};

// Quarter index: 0 = Q1 25. Today = Q3 26 = 6.
window.DC = {
  now: 6, q0: 0, q1: 24, // site-row axis Q1 25 .. Q4 30
  h100ePerGW: 1.35, // M H100e per GW at 0.74 kW per H100e
  live: { used: 0.55, cap: 0.6 },
  sites: [
    { name: 'Abilene North', src: 'rent', gw: 0.3, stage: 'live', since: 'Q2 25', chips: 0.27 },
    { name: 'Abilene South', src: 'grid', gw: 0.3, stage: 'live', since: 'Q4 24', chips: 0.28 },
    { name: 'Ashburn Hall', src: 'rent', gw: 0.2, stage: 'hall', start: 4, hall: [4, 8], live: 8 },
    { name: 'Lone Pine', src: 'gas', gw: 2.5, stage: 'build', start: 3, permits: [3, 5], build: [6, 14], power: [5, 14], live: 14, passed: true },
    { name: 'Mesa Verde', src: 'gas', gw: 1.0, stage: 'permits', start: 5, permits: [5, 7], build: [8, 16], power: [7, 16], live: 16, risk: { block: 12, delay: 30, level: 'high' }, pkg: 1.0 },
    { name: 'Red River', src: 'grid', gw: 1.0, stage: 'power', start: 2, permits: [2, 3], build: [13, 21], power: [3, 21], live: 21, passed: true },
  ],
  // Build card, as selected: Campus 1 GW · Gas · rush power + community package.
  sizes: [
    { name: 'Hall', mw: '100 MW', h: '135K' },
    { name: 'Building', mw: '300 MW', h: '405K' },
    { name: 'Campus', mw: '1 GW', h: '1.35M', on: true },
    { name: 'Large campus', mw: '2.5 GW', h: '3.4M', gas: true },
    { name: 'Multi-GW', mw: '5 GW', h: '6.8M', gas: true },
  ],
  sources: [
    { id: 'rent', name: 'Rent', icon: 'key-round', waitName: 'Rent wait', wait: 4, cap: '1 GW', up: 4.0, run: 2.6, opp: 0, oppW: 'none' },
    { id: 'grid', name: 'Grid', icon: 'utility-pole', waitName: 'Grid wait', wait: 20, cap: '1 GW', up: 14.2, run: 0.8, opp: 2, oppW: 'medium' },
    { id: 'gas', name: 'Gas', icon: 'flame', waitName: 'Turbine wait', wait: 10, cap: '5 GW', up: 17.0, run: 0.4, opp: 3, oppW: 'high', on: true },
  ],
  levers: [
    { name: 'Crash construction', icon: 'hammer', sub: '8 q → 4 q', save: '−4 q', price: '+$4.9B', side: 'risk ↑', on: false },
    { name: 'Rush power', icon: 'zap', sub: 'used turbines', save: '−2 q', price: '+$0.9B', on: true },
    { name: 'Fast-track permits', icon: 'stamp', sub: '2 q → 1 q', save: '−1 q', price: '+$0.7B', on: false },
    { name: 'Community package', icon: 'handshake', sub: 'local investment', save: 'block 12% → 6%', price: '+$1.0B', on: true },
  ],
  // Preview axis: 0 = Q3 26 .. 22 = Q1 32
  pv: { permits: [0, 2], build: [2, 10], power: [2, 6], live: 10, liveQ: 'Q1 29', inQ: 10, roll: 2, rollQ: 'Q1 27',
    ghosts: [{ id: 'rent', q: 4, lbl: 'Rent Q3 27' }, { id: 'grid', q: 21, lbl: 'Grid Q4 31' }],
    upfront: 18.9, run: 0.4, holds: '1.35M', block: 6, delay: 30, level: 'medium' },
};
