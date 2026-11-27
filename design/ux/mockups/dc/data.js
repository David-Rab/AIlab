// Data-centre mockup state: Jul 5, 2026 (Q3 26). L0 shell = the market mockup's day-369 values (same save).
// Site, chart and build-card values are computed by hand from design/DATACENTERS.md; see NOTES.md.
window.SHELL = {
  date: 'Jul 5, 2026', day: 369, speed: '13.0',
  lead: '195 d', leadWord: 'ahead of', leadColor: 'var(--good)', rival: 'DeepCent', cash: '$97.6B', runway: '3 qtrs', loc: '< 0.1%', locModel: '',
  alertCount: 10, alertText: '5 research · 5 other',
  badges: { lab: null, research: null, training: null, safety: null },
};

// Quarter index: 0 = Q1 25. Today = Q3 26 = 6.
window.DC = {
  now: 6, q0: 0, q1: 24, // site-row axis Q1 25 .. Q4 30
  // Capacity and fleet chart, Q3 25 .. Q1 29 (M H100e). Powered = live GW × 1.35M.
  chart: {
    q: ['Q3 25', 'Q4 25', 'Q1 26', 'Q2 26', 'Q3 26', 'Q4 26', 'Q1 27', 'Q2 27', 'Q3 27', 'Q4 27', 'Q1 28', 'Q2 28', 'Q3 28', 'Q4 28', 'Q1 29'],
    today: 4,
    own: [0.45, 0.55, 0.62, 0.70, 0.74, 0.95, 1.20, 1.40, 1.60, 1.80, 2.00, 2.20, 2.60, 3.00, 3.40],
    cloud: [0.30, 0.35, 0.40, 0.45, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0, 0],
    powered: [0.81, 0.81, 0.81, 0.81, 0.81, 0.81, 1.08, 1.08, 1.08, 1.08, 1.08, 1.08, 4.46, 4.46, 5.81],
  },
  sites: [
    { name: 'Abilene North', src: 'rent', gw: 0.3, stage: 'live', since: 'Q2 25' },
    { name: 'Abilene South', src: 'grid', gw: 0.3, stage: 'live', since: 'Q4 24' },
    { name: 'Ashburn Hall', src: 'rent', gw: 0.2, stage: 'hall', hall: [4, 8], live: 8 },
    { name: 'Lone Pine', src: 'gas', gw: 2.5, stage: 'build', permits: [3, 5], build: [6, 14], power: [5, 14], live: 14 },
    { name: 'Mesa Verde', src: 'gas', gw: 1.0, stage: 'permits', permits: [5, 7], build: [8, 16], power: [7, 16], live: 16, risk: { block: 12, delay: 30 }, pkg: 1.0 },
    { name: 'Red River', src: 'grid', gw: 1.0, stage: 'power', permits: [2, 3], build: [13, 21], power: [3, 21], live: 21 },
  ],
};
