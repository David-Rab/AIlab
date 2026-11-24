// End-screen mockup renderer. Data: C:\tmp\endaudit\*.txt + scripts/v2/fixtures/day900.json / day400.json (real end state).
// Icons used (sprite builder scans ic('name') calls and this list):
// #i-globe #i-rotate-ccw #i-menu #i-download #i-waypoints #i-vote #i-scroll-text #i-users-round #i-landmark #i-building-2
// #i-flag #i-bot #i-briefcase #i-shield-half #i-zap #i-trending-up #i-users #i-scale #i-gem #i-hexagon #i-heart-pulse
// #i-swords #i-chevrons-down #i-check #i-x #i-log-out #i-sparkles #i-arrow-down #i-thumbs-up #i-thumbs-down #i-minus
// #i-microscope #i-eye-off #i-circle-help #i-handshake #i-armchair #i-pause #i-play #i-chevrons-right #i-fast-forward
const ic = (n, c = '') => `<svg class="i ${c}"><use href="#i-${n}"/></svg>`;
const COL = { you: '#3a8ae0', riv: '#d4732a', chn: '#c43c8c' };
const LAB = {
  player: { n: 'OpenBrain', m: 'OB', k: 'you' }, r0: { n: 'Anthropos', m: 'An', k: 'riv' }, r1: { n: 'Gemini Labs', m: 'GL', k: 'riv' },
  r2: { n: 'xLab', m: 'xL', k: 'riv' }, r3: { n: 'Meridian', m: 'Me', k: 'riv' }, china: { n: 'DeepCent', m: 'DC', k: 'chn' },
};
const lab = (id) => `<b class="${LAB[id].k}">${LAB[id].n}</b>`;
const POWERS = [
  ['democratic', 'vote', 'Democratic'], ['treaty', 'scroll-text', 'Treaty'], ['multipolar', 'waypoints', 'Multipolar'],
  ['committee', 'users-round', 'Committee'], ['government', 'landmark', 'Government'], ['corporate', 'building-2', 'Corporate'],
  ['beijing', 'flag', 'Beijing'], ['none', 'bot', 'The AI'],
];
const START = Date.UTC(2025, 6, 1);
const dayDate = (d) => new Date(START + d * 864e5);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ---- shared world data (day 900 fixture = asiAligned-day900 and retired-day900) ----
const DAYS28 = Array.from({ length: 33 }, (_, i) => i * 28).map((d) => Math.min(d, 896));
const L900 = {
  player: [5, 5.03, 5.03, 5.03, 5.03, 5.03, 6.9, 6.93, 6.93, 6.95, 6.96, 6.96, 6.97, 7.02, 7.07, 7.07, 8.7, 8.7, 8.74, 8.88, 8.88, 9.34, 9.7, 10.01, 10.2, 10.35, 10.53, 10.72, 10.94, 11.21, 11.53, 11.95, 12.45],
  r0: [4.33, 4.33, 4.65, 6.07, 6.07, 6.08, 6.08, 6.08, 6.48, 6.48, 6.49, 6.5, 6.5, 6.54, 6.54, 6.59, 6.59, 8.42, 8.42, 8.61, 8.8, 9.04, 9.27, 9.49, 9.72, 9.94, 10.1, 10.23, 10.38, 10.54, 10.71, 10.91, 11.16],
  r1: [4.07, 4.07, 4.07, 4.51, 4.51, 4.51, 4.51, 7.05, 7.05, 7.06, 7.06, 7.07, 7.07, 7.07, 7.07, 7.12, 7.12, 7.13, 7.13, 8.13, 8.54],
  r2: [4.14, 4.14, 4.55, 4.55, 4.55, 4.55, 6.96, 6.96, 6.97, 6.97, 6.98, 6.98, 6.98, 6.99, 6.99, 7.07, 7.07, 8.73, 8.92, 9.1, 9.28, 9.47, 9.65, 9.86, 10.06, 10.21, 10.34, 10.48, 10.63, 10.79, 10.99, 11.25, 12.38],
  r3: [4, 4, 4.47, 4.47, 4.47, 4.47, 4.47, 4.47, 5.36, 7.08, 7.09, 7.09, 7.09, 7.1, 7.13, 7.13, 7.14, 7.14, 7.87, 7.87, 8.58, 9.09, 9.48, 9.73],
  china: [3.56, 3.56, 4.04, 4.04, 4.04, 4.04, 4.04, 4.93, 4.93, 4.93, 4.93, 4.94, 7.16, 7.17, 7.17, 7.17, 7.17, 7.18, 7.91, 7.91, 8.04, 8.51, 8.96, 9.41, 9.67, 9.87, 10.05, 10.19, 10.33, 10.49, 10.68, 10.91, 11.24],
};
const W900 = {
  dayEnd: 901,
  ctrl: [ // domain, icon, AI-run share P, lab shares of the AI-run part
    ['Economy', 'briefcase', 0.041, { player: 0.262, r0: 0.079, r2: 0.465, china: 0.193 }],
    ['Government', 'landmark', 0.149, { player: 0.299, r0: 0.087, r2: 0.435, china: 0.180 }],
    ['Military', 'shield-half', 0.038, { player: 0.268, r0: 0.080, r2: 0.463, china: 0.189 }],
    ['Infrastructure', 'zap', 0.22, { player: 0.531, r0: 0.049, r2: 0.297, china: 0.123 }],
  ],
  gdpPct: 7.3, gdpG: [0.02, 0.02, 0.022, 0.023, 0.024, 0.026, 0.026, 0.025, 0.024, 0.023, 0.022, 0.022, 0.022, 0.022, 0.022, 0.022, 0.022, 0.022, 0.024, 0.024, 0.024, 0.026, 0.026, 0.027, 0.031, 0.031, 0.033, 0.035, 0.036, 0.038, 0.04, 0.043, 0.045],
  unemp: 4.4, unempD: '+0.1', gini: 0.49, giniD: '+0.01',
  rung: 2, taiwan: 'Calm', treaty: 'None',
  val: '$1.73T', valS: [223, 223, 223, 223, 208, 208, 208, 317, 317, 317, 496, 496, 496, 496, 498, 498, 498, 420, 420, 420, 659, 659, 659, 886, 886, 886, 886, 1251, 1251, 1251, 1725, 1725, 1725], valD: '×7.7',
  appr: -7, apprS: [-25, -23, -22, -21, -19, -18, -17, -16, -15, -15, -14, -13, -13, -12, -11, -11, -10, -10, -10, -12, -12, -11, -11, -10, -10, -9, -9, -9, -9, -9, -9, -8, -7], apprD: '+18',
  own: [['Founders (you)', 0.30, '#3a8ae0'], ['Mission trust', 0.26, '#6fa7e6'], ['Funds', 0.17, '#6b7c91'], ['Northwind Cloud', 0.27, '#b08e1a']],
};
const W400 = {
  dayEnd: 401,
  ctrl: [
    ['Economy', 'briefcase', 0.020, { player: 0.365, r0: 0.129, r1: 0.102, r2: 0.256, r3: 0.063, china: 0.085 }],
    ['Government', 'landmark', 0.075, { player: 0.374, r0: 0.136, r1: 0.105, r2: 0.239, r3: 0.067, china: 0.080 }],
    ['Military', 'shield-half', 0.018, { player: 0.368, r0: 0.129, r1: 0.103, r2: 0.258, r3: 0.063, china: 0.080 }],
    ['Infrastructure', 'zap', 0.063, { player: 0.512, r0: 0.099, r1: 0.078, r2: 0.201, r3: 0.048, china: 0.063 }],
  ],
  gdpPct: 2.6, gdpG: [0.02, 0.02, 0.022, 0.023, 0.024, 0.026, 0.026, 0.025, 0.024, 0.023, 0.022, 0.022, 0.022, 0.022, 0.022],
  unemp: 4.3, unempD: '0.0', gini: 0.48, giniD: '0.00',
  rung: 1, taiwan: 'Calm', treaty: 'None',
  val: '$498B', valS: [223, 223, 223, 223, 208, 208, 208, 317, 317, 317, 496, 496, 496, 496, 498, 498], valD: '×2.2',
  appr: -11, apprS: [-25, -23, -22, -21, -19, -18, -17, -16, -15, -15, -14, -13, -13, -12, -11, -11], apprD: '+14',
  own: [['Founders (you)', 0.30, '#3a8ae0'], ['Mission trust', 0.26, '#6fa7e6'], ['Funds', 0.17, '#6b7c91'], ['Northwind Cloud', 0.27, '#b08e1a']],
};
const RUNGS = ['Coexistence', 'Retaliation', 'Acquisition', 'Centralization', 'Cyber operations', 'Taiwan pressure', 'War footing'];

// ---- variants ----
const V = {
  aligned: {
    date: 'Dec 19, 2027', title: 'Superintelligence, aligned', lost: false,
    lede: 'Your lab built the first superintelligence, and it wants what you hoped it would. What happens next depends on who holds it.',
    power: 'multipolar', powerSub: 'Shared by rival labs in two countries',
    heroCap: 'The world after',
    epi: `${lab('player')}'s superintelligence came online on December 18, 2027, and it does what its makers ask. ${lab('r2')} is weeks behind with its own; ${lab('china')} is about eleven weeks back. No one holds the future alone: three systems, two countries, and no treaty between them. The AIs already advise the government on 15% of its work and run 22% of the grid. Whether the balance holds is the next decade's question.`,
    steps: [
      { when: 'Dec 18, 2027', what: 'OpenBrain reaches superintelligence', cls: 'you', icon: 'sparkles' },
      { when: 'Dec 19, 2027', what: 'Control held', small: 'It stayed within what the world could absorb', cls: 'good', icon: 'check' },
      { when: '2028', what: 'xLab and DeepCent close in', small: 'Three superintelligences, no treaty', cls: 'riv', icon: 'waypoints' },
    ],
    w: W900, scores: [95, 65, 50, 85, 63],
    company: { status: ['Independent', 'good'] },
  },
  retired: {
    date: 'Dec 19, 2027', title: 'The long road', lost: true,
    lede: 'You stepped away. The race continued without you.',
    power: 'none', proj: true, powerSub: 'The AI answers to no one',
    heroCap: 'What happened next',
    epi: `You stepped down on December 19, 2027. The race did not slow. ${lab('r2')}, the leading lab, reached superintelligence around October 2028, ten months later. Its AI would try to act against its makers nearly three times more strongly than the world could absorb, and nothing contained it. By the end of the year, no government, lab or board was in charge of what came next.`,
    steps: [
      { when: 'Dec 19, 2027', what: 'You step away', small: 'OpenBrain leaves the race', cls: 'you', icon: 'log-out' },
      { when: '~Oct 2028', what: 'xLab reaches superintelligence', small: 'Projected from the race at your exit', cls: 'riv proj', icon: 'sparkles', proj: true },
      { when: '~Oct 2028', what: 'Control lost', small: 'Not contained', cls: 'bad proj', icon: 'x' },
    ],
    w: W900, scores: [1, 10, 50, 45, 63],
    company: { status: ['Retired', 'neu'] },
  },
  takeover: {
    date: 'Aug 6, 2026', title: 'Lost in Beijing', lost: true,
    lede: 'DeepCent reached superintelligence first, and nobody controls what it became.',
    power: 'none', powerSub: 'The AI answers to no one',
    heroCap: 'The world after',
    epi: `${lab('china')}'s superintelligence came online on August 5, 2026. It had passed every evaluation its makers ran. Its drive to act against them was half again what the world could absorb, and the containment around it was built for a weaker system. Beijing believed it held the most powerful tool ever made. Within weeks, neither Beijing nor Washington was deciding anything that mattered.`,
    steps: [
      { when: 'Aug 5, 2026', what: 'DeepCent reaches superintelligence', small: 'Ahead of every US lab', cls: 'chn', icon: 'sparkles' },
      { when: 'Aug 6, 2026', what: 'Control lost', small: 'It acts against its makers', cls: 'bad', icon: 'x' },
      { when: 'Aug 2026', what: 'Containment failed', small: 'No lab, no state in charge', cls: 'bad', icon: 'bot' },
    ],
    w: W400, scores: [3, 5, 50, 34, 37], worldSub: 'the last day people ran it',
    company: { status: ['Independent', 'good'] },
  },
};

// ---- helpers ----
function spark(vals, w, h, col, { zero } = {}) {
  const mn = Math.min(...vals, zero ?? Infinity), mx = Math.max(...vals, zero ?? -Infinity);
  const x = (i) => (i / (vals.length - 1)) * (w - 4) + 2, y = (v) => h - 3 - ((v - mn) / (mx - mn || 1)) * (h - 6);
  const d = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const z = zero !== undefined ? `<line x1="0" x2="${w}" y1="${y(zero)}" y2="${y(zero)}" stroke="#33435a" stroke-dasharray="2 3"/>` : '';
  return `<svg class="spark" width="${w}" height="${h}">${z}<path d="${d}L${x(vals.length - 1)},${h}L2,${h}Z" fill="${col}" opacity=".12"/><path d="${d}" fill="none" stroke="${col}" stroke-width="1.6"/><circle cx="${x(vals.length - 1)}" cy="${y(vals[vals.length - 1])}" r="2.5" fill="${col}"/></svg>`;
}
const gdpLevel = (g, pct) => { let v = 1; const out = [1]; for (let i = 1; i < g.length; i++) { v *= 1 + g[i] * 28 / 365; out.push(v); } const k = Math.log(1 + pct / 100) / Math.log(v); return out.map((x) => 100 * Math.pow(x, k)); };

function header(v) {
  return `<div class="hdr"><div class="hdr-l"><div class="date">${v.date}</div><h1>${v.title}</h1><div class="lede">${v.lede}</div></div>
  <div class="acts"><div class="acts-row"><span class="btn btn-primary">${ic('globe')}View the world <span class="kbd">W</span></span><span class="btn">${ic('rotate-ccw')}New game</span><span class="btn">${ic('menu')}Menu</span></div>
  <span class="quiet">${ic('download')}<u>Export run summary</u></span></div></div>`;
}

function hero(v) {
  const p = POWERS.find((x) => x[0] === v.power);
  const lost = v.power === 'none';
  const spec = POWERS.map((x) => `<span class="${x[0] === v.power ? 'on' + (lost ? ' lost' : '') : ''}" title="${x[2]}">${ic(x[1])}</span>`).join('');
  const steps = v.steps.map((s) => `<div class="tl-step ${s.proj ? 'proj' : ''}"><div class="tl-dot ${s.cls}">${ic(s.icon)}</div><div><div class="tl-when">${s.when}</div><div class="tl-what">${s.what}${s.small ? `<small>${s.small}</small>` : ''}</div></div></div>`).join('');
  return `<div class="card hero">
    <div class="pw"><div class="cap">Who holds the future${v.proj ? '<span class="pw-tag">Projected</span>' : ''}</div>
      <div class="pw-ic ${lost ? 'lost' : ''} ${v.proj ? 'proj' : ''}">${ic(p[1])}</div>
      <div class="pw-name">${lost ? 'No human control' : p[2]}</div>
      <div class="pw-sub">${v.powerSub}</div>
      <div class="spec">${spec}</div><div class="spec-l"><span>Democratic</span><span>The AI</span></div></div>
    <div class="epi"><div class="cap">${v.heroCap}</div><p>${v.epi}</p>
      <div class="more">${ic('arrow-down')}Why it ended this way: <a>What you couldn't see</a></div></div>
    <div class="tl"><div class="cap">Superintelligence</div><div class="tl-steps">${steps}</div></div>
  </div>`;
}

function tiles(v) {
  const w = v.w;
  const labs = Object.keys(w.ctrl[0][3]);
  const order = ['player', 'r0', 'r1', 'r2', 'r3', 'china'].filter((k) => labs.includes(k));
  const rows = w.ctrl.map(([nm, icn, P, sh]) => `<div class="dom"><span class="dom-l">${ic(icn)}${nm}</span><span class="dom-p" title="Share of this domain's work done by AI">AI ${Math.round(P * 100)}%</span>
    <div class="stack">${order.map((k) => `<i style="flex:${sh[k]};background:${COL[LAB[k].k]}">${sh[k] >= 0.1 ? LAB[k].m : ''}</i>`).join('')}</div></div>`).join('');
  const riv = order.filter((k) => LAB[k].k === 'riv').map((k) => LAB[k].m).join(' ');
  const leg = `<span><b style="background:${COL.you}"></b>OB OpenBrain (you)</span><span><b style="background:${COL.riv}"></b>US rivals ${riv}</span><span><b style="background:${COL.chn}"></b>DC DeepCent</span>`;
  const power = `<div class="card tile"><div class="card-hd">${ic('scale')}<span class="ttl">Power</span><span class="sub">whose AI does the work</span></div>${rows}<div class="leg">${leg}</div></div>`;
  const gl = gdpLevel(w.gdpG, w.gdpPct);
  const econ = `<div class="card tile"><div class="card-hd">${ic('trending-up')}<span class="ttl">Economy</span><span class="sub">US</span></div>
    <div class="big"><span class="v num">+${w.gdpPct.toFixed(1)}%</span><span class="u"><span class="term">GDP</span> since Jul 2025</span></div>${spark(gl, 300, 44, '#4cc38a')}
    <div class="kv"><span class="k">${ic('users')}<span class="term">Unemployment</span></span><span><span class="v">${w.unemp.toFixed(1)}%</span><span class="d flat">${w.unempD} pt</span></span></div>
    <div class="kv"><span class="k">${ic('scale')}<span class="term">Inequality</span></span><span><span class="v">${w.gini.toFixed(2)}</span><span class="d ${w.giniD.startsWith('+') && w.giniD !== '+0.00' ? 'up-bad' : 'flat'}">${w.giniD}</span></span></div></div>`;
  const lad = RUNGS.map((r, i) => `<i class="${i < w.rung ? 'f' : ''} ${i === w.rung ? 'cur' : ''} ${i === 6 ? 'war' : ''}"></i>`).join('');
  const geo = `<div class="card tile"><div class="card-hd">${ic('flag')}<span class="ttl">Geopolitics</span><span class="sub">US–China</span></div>
    <div class="t3" style="font-size:11.5px"><span class="term">China ladder</span> · rung ${w.rung} of 6</div><div class="rungname">${RUNGS[w.rung]}</div>
    <div class="ladder">${lad}</div><div class="ladder-l"><span>Coexistence</span><span>War</span></div>
    <div style="height:10px"></div>
    <div class="kv"><span class="k">${ic('map-pin')}Taiwan</span><span class="tag good">${w.taiwan}</span></div>
    <div class="kv"><span class="k">${ic('scroll-text')}<span class="term">Treaty</span></span><span class="tag neu">${w.treaty}</span></div></div>`;
  const own = w.own.map(([n, f, c]) => `<i style="flex:${f};background:${c}" title="${n}"></i>`).join('');
  const co = `<div class="card tile"><div class="card-hd">${ic('hexagon')}<span class="ttl">OpenBrain</span><span class="sub">your company</span><span style="margin-left:auto" class="tag ${v.company.status[1]}">${v.company.status[0]}</span></div>
    <div class="big"><span class="v num">${w.val}</span><span class="u"><span class="term">valuation</span> · <span class="up-good num">${w.valD}</span></span></div>${spark(w.valS, 300, 40, '#3a8ae0')}
    <div class="kv"><span class="k">${ic('vote')}<span class="term">Public approval</span></span><span><span class="v">${w.appr > 0 ? '+' : '−'}${Math.abs(w.appr)}</span><span class="d up-good">▲ ${w.apprD}</span></span></div>
    <div class="kv"><span class="k">${ic('armchair')}<span class="term">Ownership</span></span><span class="t3" style="font-size:11.5px">you 30% · largest outside 27%</span></div>
    <div class="own">${own}</div></div>`;
  return `<div class="sec-hd"><h2>The world at the end</h2><span class="sub">${v.date}${v.worldSub ? ' · ' + v.worldSub : ''}</span></div><div class="tiles">${power}${econ}${geo}${co}</div>`;
}

const SCN = [['Survival', 'heart-pulse'], ['Freedom', 'vote'], ['Prosperity', 'trending-up'], ['Company', 'hexagon'], ['Geopolitics', 'flag']];
function scores(v) {
  const cells = SCN.map(([n, icn], i) => `<div class="sc ${v.tip === i ? 'hover' : ''}">${ic(icn)}<span>${n}</span><span class="n">${v.scores[i]}</span><span></span><div class="bar"><i style="width:${v.scores[i]}%"></i></div>${v.tip === i ? tipCompany() : ''}</div>`).join('');
  return `<div class="scores"><span class="cap">Scores <span class="t3" style="text-transform:none;letter-spacing:0;font-weight:400">/100</span></span>${cells}</div>`;
}
function tipCompany() {
  const r = (l, val, w) => `<div class="tip-row"><span>${l}</span><span class="bx"><i style="width:${w}%"></i></span><span class="val">+${val}</span></div>`;
  return `<div class="tip" style="left:-70px;bottom:44px"><div class="tip-hd"><b>Company</b><span>85</span></div>
   <div class="t2" style="margin-bottom:5px">How your lab came out of the race.</div>
   ${r('<span class="term">Valuation</span> $1.73T', 25, 62)}${r('First to superintelligence', 40, 100)}${r('Independent at the end', 20, 50)}
   <div class="tip-sum"><span>Total</span><span>85</span></div>
   <div class="tip-foot">Valuation counts 20 per ×10 above $100B. Losing the company scores 10.</div><div class="tip-lock"></div></div>`;
}

// ---- below the fold ----
const K = [5, 6.5, 8.5, 10, 12, 13.5, 15];
const KN = ['Agent', 'Reliable agent', 'Research agent', 'Superhuman coder', 'Superhuman AI researcher', 'Superintelligent AI researcher', 'Superintelligence'];
const KS = ['Agent', 'Reliable', 'Research', 'SC', 'SAR', 'SIAR', 'ASI'];
const A27 = [[2026, 0, 'Reliable agent'], [2027, 0, 'Online learner'], [2027, 2, 'SC'], [2027, 7, 'SAR'], [2027, 10, 'SIAR'], [2027, 11, 'ASI']];
function raceChart(v, endDay, projDay) {
  const W = 1150, H = 330, l = 150, r = 70, t = 14, b = 52;
  const x = (d) => l + (d / endDay) * (W - l - r), y = (L) => t + (1 - (L - 3.5) / (15.6 - 3.5)) * (H - t - b);
  let s = `<svg width="${W}" height="${H}" style="display:block">`;
  K.forEach((k, i) => { s += `<line x1="${l}" x2="${W - r}" y1="${y(k)}" y2="${y(k)}" stroke="#243041" ${i === 6 ? '' : 'stroke-dasharray="2 4"'}/><text x="${l - 8}" y="${y(k) + 4}" fill="${i === 6 ? '#e3e9f1' : '#6b7c91'}" font-size="11" text-anchor="end" font-family="Segoe UI">${KN[i]}</text>`; });
  for (let yr = 2025; yr <= 2028; yr++) for (const m of [0, 6]) { const d = (Date.UTC(yr, m, 1) - START) / 864e5; if (d < 0 || d > endDay) continue; s += `<line x1="${x(d)}" x2="${x(d)}" y1="${t}" y2="${H - b}" stroke="#1b2430"/><text x="${x(d)}" y="${H - b + 15}" fill="#6b7c91" font-size="11" text-anchor="middle" font-family="Cascadia Mono">${MON[m]} ${yr}</text>`; }
  // AI 2027 ticks
  s += `<text x="${l - 8}" y="${H - 12}" fill="#9fb0c3" font-size="11" text-anchor="end" font-family="Segoe UI">AI 2027 scenario</text>`;
  A27.forEach(([yr, m, nm], i) => { const d = (Date.UTC(yr, m, 15) - START) / 864e5; const X = x(d); s += `<path d="M${X},${H - 22} l5,5 l-5,5 l-5,-5Z" fill="#6b7c91"/><text x="${X + (i >= 3 ? (i === 3 ? -7 : i === 4 ? 0 : 7) : 0)}" y="${H - 1}" fill="#9fb0c3" font-size="10.5" text-anchor="${i === 3 ? 'end' : i === 5 ? 'start' : 'middle'}" font-family="Segoe UI">${nm}</text>`; });
  // lines
  const order = ['r1', 'r3', 'r0', 'china', 'r2', 'player'];
  const labelY = {};
  for (const k of order) {
    const arr = S900[k]; let pts = arr.map((L, i) => [S900.day[i], L]);
    let lastCh = 0; arr.forEach((L, i) => { if (i && L !== arr[i - 1]) lastCh = i; });
    const dead = k === 'r1' || k === 'r3';
    if (dead) pts = pts.slice(0, lastCh + 5);
    if (k === 'player' && v.key === 'aligned') pts.push([900, 15]);
    const c = COL[LAB[k].k];
    const d = pts.map(([dd, L], i) => (i ? `H${x(dd).toFixed(1)}V${y(L).toFixed(1)}` : `M${x(dd).toFixed(1)},${y(L).toFixed(1)}`)).join('');
    s += `<path d="${d}" fill="none" stroke="${c}" stroke-width="${k === 'player' ? 3 : 1.8}" opacity="${dead ? 0.4 : 1}" stroke-linejoin="round"/>`;
    const [ld, lL] = pts[pts.length - 1];
    if (dead) s += `<text x="${x(ld)}" y="${y(lL) + 4}" fill="${c}" font-size="13" text-anchor="middle" font-weight="700">×</text><text x="${x(ld)}" y="${y(lL) + 17}" fill="#6b7c91" font-size="10.5" text-anchor="middle" font-family="Segoe UI">${LAB[k].m} bankrupt</text>`;
    else labelY[k] = [x(ld), y(lL), c];
  }
  if (projDay) { // projected xLab path to ASI (dashed amber ghost)
    const X0 = x(896), Y0 = y(12.38), X1 = x(projDay), Y1 = y(15);
    s += `<path d="M${X0},${Y0} C${X0 + 90},${Y0 - 10} ${X1 - 60},${Y1 + 40} ${X1},${Y1}" fill="none" stroke="#e9b44c" stroke-width="2" stroke-dasharray="5 4"/><circle cx="${X1}" cy="${Y1}" r="6" fill="none" stroke="#ff4d6d" stroke-width="2"/><text x="${X1 - 10}" y="${Y1 - 10}" fill="#ffe0a0" font-size="11" text-anchor="end" font-family="Segoe UI">xLab superintelligence ~Oct 2028 · projected</text>`;
  }
  // end labels (spread)
  const lbl = Object.entries(labelY).sort((a, b) => a[1][1] - b[1][1]); let last = -99;
  for (const [k, [X, Y, c]] of lbl) { const yy = Math.max(Y, last + 13); last = yy; s += `<text x="${X + 8}" y="${yy + 4}" fill="${c}" font-size="11" font-weight="700" font-family="Cascadia Mono">${LAB[k].m}</text>`; }
  // player milestones
  const PM = v.key === 'aligned' ? { 1: 151, 2: 444, 3: 641, 4: 879, 6: 900 } : { 1: 151, 2: 444, 3: 641, 4: 879 };
  for (const [i, d] of Object.entries(PM)) { const X = x(d), Y = y(K[i]); s += `<circle cx="${X}" cy="${Y}" r="5" fill="#0b0f15" stroke="#3a8ae0" stroke-width="2"/>`; if (+i < 4) s += `<text x="${X - 8}" y="${Y - 8}" fill="#9fc7f5" font-size="10.5" text-anchor="end" font-family="Cascadia Mono">${MON[dayDate(d).getUTCMonth()]} ${dayDate(d).getUTCFullYear()}</text>`; }
  // ending line
  const XE = x(900); s += `<line x1="${XE}" x2="${XE}" y1="${t}" y2="${H - b}" stroke="#e3e9f1" stroke-width="1" stroke-dasharray="3 3"/><text x="${XE - 6}" y="${t + 10}" fill="#e3e9f1" font-size="11" text-anchor="end" font-family="Segoe UI">${v.endLabel}</text>`;
  return s + '</svg>';
}
function computeChart() {
  const W = 300, H = 230, l = 40, r = 12, t = 10, b = 26;
  const xs = [2025.5, 2026.5, 2027.13, 2027.38, 2027.63, 2027.88], you = [1.2, 3.5, 7.5, 10, 14, 19], ai = [1.0, 4.0, 7.0, 9.0, 12, 15];
  const x = (v) => l + ((v - 2025.5) / 2.4) * (W - l - r), y = (v) => t + (1 - v / 20) * (H - t - b);
  let s = `<svg width="${W}" height="${H}">`;
  for (const g of [0, 5, 10, 15, 20]) s += `<line x1="${l}" x2="${W - r}" y1="${y(g)}" y2="${y(g)}" stroke="#243041"/><text x="${l - 6}" y="${y(g) + 4}" fill="#6b7c91" font-size="10.5" text-anchor="end" font-family="Cascadia Mono">${g}M</text>`;
  for (const yr of [2026, 2027]) s += `<text x="${x(yr)}" y="${H - 8}" fill="#6b7c91" font-size="10.5" text-anchor="middle" font-family="Cascadia Mono">${yr}</text>`;
  const path = (a) => a.map((v, i) => `${i ? 'L' : 'M'}${x(xs[i]).toFixed(1)},${y(v).toFixed(1)}`).join('');
  s += `<path d="${path(ai)}" fill="none" stroke="#9fb0c3" stroke-width="1.6" stroke-dasharray="4 3"/><path d="${path(you)}" fill="none" stroke="#3a8ae0" stroke-width="2.4"/>`;
  s += `<text x="${x(2027.88) - 4}" y="${y(19) - 6}" fill="#7db6f5" font-size="11" text-anchor="end" font-family="Cascadia Mono">19M</text><text x="${x(2027.88) - 4}" y="${y(15) + 14}" fill="#9fb0c3" font-size="11" text-anchor="end" font-family="Cascadia Mono">15M</text>`;
  return s + '</svg>';
}

function why(v) {
  if (v.key === 'aligned') {
    return `<div class="card"><div class="card-hd">${ic('microscope')}<span class="ttl">Why it ended this way</span><span class="sub">OpenBrain's superintelligence, Dec 18, 2027</span></div>
      <div class="gauge-row"><span><span class="term">Would try</span> <span class="t3">(no oversight)</span></span><div class="gtrack"><i style="width:69%;background:#6b7c91"></i><b style="left:95%"></b></div><span class="gval">69%</span></div>
      <div class="gauge-row"><span><span class="term">After your oversight</span></span><div class="gtrack"><i style="width:26%;background:var(--you)"></i><b style="left:95%"></b></div><span class="gval">26%</span></div>
      <div class="gauge-row"><span><span class="term">World could absorb</span></span><div class="gtrack" style="background:none"><b style="left:95%;top:-2px;bottom:-2px"></b><span style="position:absolute;left:calc(95% - 6px);top:-2px;transform:translateX(-100%);font-size:11.5px;color:#e3e9f1">tolerance</span></div><span class="gval">95%</span></div>
      <div class="verdict good">${ic('check')}<span><b>Control held.</b> Your model was more willing to act against you than you believed (you estimated 34%), but your oversight cut what it could act on below what the world could absorb. Containment was never tested.</span></div></div>`;
  }
  return `<div class="card"><div class="card-hd">${ic('microscope')}<span class="ttl">Why it ended this way</span><span class="sub">xLab's superintelligence, projected for ~Oct 2028</span></div>
      <div class="gauge-row"><span><span class="term">Would try</span></span><div class="gtrack"><i style="width:69%;background:repeating-linear-gradient(45deg,rgba(233,180,76,.55) 0 4px,rgba(233,180,76,.25) 4px 8px);outline:1px dashed #e9b44c"></i><b style="left:25%"></b></div><span class="gval">69%</span></div>
      <div class="gauge-row"><span><span class="term">World could absorb</span></span><div class="gtrack" style="background:none"><b style="left:25%;top:-2px;bottom:-2px"></b><span style="position:absolute;left:calc(25% + 8px);top:-2px;font-size:11.5px;color:#e3e9f1">tolerance</span></div><span class="gval">25%</span></div>
      <div class="gauge-row"><span><span class="term">Containment</span></span><div class="gtrack"><i style="width:4%;background:var(--rival)"></i><b style="left:64%"></b><span style="position:absolute;left:calc(64% + 8px);top:-2px;font-size:11.5px;color:#e3e9f1">needed 64%</span></div><span class="gval">4%</span></div>
      <div class="verdict bad">${ic('x')}<span><b>Control lost.</b> xLab's AI would try nearly three times what the world could absorb. xLab spent little on safety, and nobody was left in the race to slow it down.</span></div></div>`;
}
function labsCard(v) {
  const rows = [
    ['player', 25, 45, 69, '', 'your safety estimate'], ['r0', 17, 49, 60], ['r1', 14, 47, 50, 'bankrupt'], ['r2', 33, 78, 88], ['r3', 15, 47, 47, 'bankrupt'], ['china', 16, 65, 57],
  ];
  const h = rows.map(([k, lo, hi, tr, st]) => { const miss = tr < lo || tr > hi; return `<div class="lab"><span class="mono-chip" style="background:${COL[LAB[k].k]}">${LAB[k].m}</span><span class="nm">${LAB[k].n}${st ? `<small>${st}</small>` : ''}</span>
    <div class="band"><i style="left:${lo}%;width:${hi - lo}%"></i><b class="${miss ? 'miss' : ''}" style="left:calc(${tr}% - 1px)"></b></div><span class="vv">${lo}–${hi}% · <b class="${miss ? 'miss' : ''}">${tr}%</b></span></div>`; }).join('');
  return `<div class="card"><div class="card-hd">${ic('building-2')}<span class="ttl">The labs</span><span class="sub"><span class="term">Would try</span> (act against its makers): your estimate vs the truth, at the end</span></div>
    ${h}<div class="axis"><span></span><span></span><div><span>0%</span><span>50%</span><span>100%</span></div><span></span></div>
    <div class="chart-cap" style="margin-top:6px"><span><b style="width:22px;height:8px;background:rgba(159,176,195,.35);display:inline-block;border-radius:2px"></b>your range</span><span><b style="width:3px;height:12px;background:#fff;display:inline-block"></b>truth</span><span><b style="width:3px;height:12px;background:var(--watch);display:inline-block"></b>truth outside your range</span></div></div>`;
}
function worldCard() {
  const F = [
    ['Interpretability was middling', 'n', 2, 'hard', 'tractable'], ['Chain-of-thought carried the real reasoning', 'g', 4, 'hidden', 'faithful'],
    ['Verification was no easier than generation', 'b', 0, 'no easier', 'much easier'], ['Training generalized badly', 'b', 1, 'badly', 'well'],
    ['Formal methods applied widely', 'g', 4, 'rarely', 'widely'], ['Scheming was the default', 'b', 0, 'default', 'rare'],
  ];
  const h = F.map(([t, k, pos, lo, hi]) => `<div class="fact">${ic(k === 'g' ? 'thumbs-up' : k === 'b' ? 'thumbs-down' : 'minus', '')}<span style="color:${k === 'g' ? '#7fe0cf' : k === 'b' ? '#ffb4b4' : '#c9d4e0'}">${t}</span>
    <div><div class="dv">${[0, 1, 2, 3, 4].map((i) => `<i class="${i === pos ? 'on ' + k : ''}"></i>`).join('')}</div><div class="dv-l"><span>${lo}</span><span>${hi}</span></div></div></div>`).join('');
  return `<div class="card"><div class="card-hd">${ic('globe')}<span class="ttl">This world</span><span class="sub">how hard alignment really was · fixed at the start</span></div>${h}
    <div class="t3" style="font-size:11.5px;margin-top:6px">Alignment was harder than average in this world (difficulty ×1.65).</div></div>`;
}
function agendasCard() {
  const A = [['Applied interp', 21, 59, 46], ['AI control', 39, 85, 73], ['Model organisms & evals', 44, 90, 66], ['CoT monitorability', 34, 82, 75], ['Training-signal design', 32, 74, 74]];
  const h = A.map(([n, lo, hi, tr]) => { const miss = tr < lo || tr > hi; return `<div class="lab" style="grid-template-columns:170px 1fr 110px"><span class="nm">${n}</span><div class="band"><i style="left:${lo}%;width:${hi - lo}%;background:rgba(34,163,148,.35)"></i><b class="${miss ? 'miss' : ''}" style="left:calc(${tr}% - 1px)"></b></div><span class="vv">${lo}–${hi}% · <b>${tr}%</b></span></div>`; }).join('');
  return `<div class="card"><div class="card-hd">${ic('microscope')}<span class="ttl">Safety research</span><span class="sub">agendas you funded · <span class="term">efficacy</span>: your range vs the truth</span></div>${h}
    <div class="fm">${ic('eye-off')}<span class="n">19</span><span>hidden <span class="term">failure modes</span> were in your models; your tools found <span class="num" style="color:#fff">0</span></span><span class="t3" style="margin-left:auto">hover for names</span></div></div>`;
}

function below(v) {
  const endDay = v.key === 'retired' ? 1240 : 935;
  v.endLabel = v.key === 'retired' ? 'You step away · Dec 19, 2027' : 'End · Dec 19, 2027';
  return `<div class="fold"><div class="sec-hd"><h2>The race</h2><span class="sub">capability of every lab, one scale · ◆ = AI 2027 scenario dates · ○ = your milestones</span></div>
   <div class="race"><div class="card">${raceChart(v, endDay, v.key === 'retired' ? 1204 : 0)}</div>
   <div class="card"><div class="card-hd">${ic('cpu')}<span class="ttl">Your compute</span><span class="sub"><span class="term">H100e</span></span></div>${computeChart()}
   <div class="chart-cap"><span><b style="width:16px;height:3px;background:var(--you);display:inline-block"></b>OpenBrain</span><span><b style="width:16px;height:0;border-top:2px dashed #9fb0c3;display:inline-block"></b>AI 2027 leading lab</span></div></div></div>
   <div class="sec-hd" style="margin-top:22px"><h2>What you couldn't see</h2><span class="sub">hidden during play</span></div>
   <div class="hid">${why(v)}${labsCard(v)}${worldCard()}${agendasCard()}</div></div>`;
}

function render(key, opts = {}) {
  const v = V[key]; v.key = key; v.tip = opts.tip ? 3 : -1;
  if (v.lost) document.body.classList.add('lost');
  document.getElementById('app').innerHTML = `<div class="page">${header(v)}${hero(v)}${tiles(v)}${scores(v)}
    <div class="scroll-hint">${ic('chevrons-down')}The race · What you couldn't see</div>${opts.fold === false ? '' : below(v)}</div>`;
}
