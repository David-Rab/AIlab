// SAFETY › Risks (UI-IA §1 SAFETY ★5, SAFETY-REDESIGN §2.4 / §7). Day-400 values: data400b.json safety.*
// Model: Atlas-2.8 on internal AI staff work (allInternalFleetTables[1], measured; Atlas-2.10's rows read true values, see DATA.md).
(function () {
  const { ic } = window.C;
  // [name, wouldTry, lo, hi, ableTo, chances, stopRate, unstopped/yr, severity]
  const G = [
    ['Misbehaviour', 'drama', [
      ['Games tests and graders', 0.042, 0.01, 0.085, 0.848, 0.468, 0.813, 0.010, 2.18],
      ['Tells people what they want to hear', 0.038, 0, 0.16, 0.76, 0.553, 0.797, 0.004, 1.53],
      ['Optimises the wrong target', 0.046, 0, 0.487, 0.717, 0.434, 0.797, 0.003, 2.0],
      ['Overreaches (out-of-scope access)', 0.073, 0.028, 0.13, 0.255, 0.384, 0.881, 0.002, 2.53],
      ['Hides its mistakes', 0.009, 0, 0.087, 0.483, 0.384, 0.821, 0, 2.0],
    ]],
    ['Against the lab', 'ghost', [
      ['Acts against the lab', 0.113, 0.041, 0.184, null, null, 0.828, 'risk', null],
      ['Steers research toward its own ends', 0.057, 0.009, 0.128, 0.75, 0.163, 0.85, 0, null],
      ['Writes itself into the successor', 0.023, 0, 0.12, 0.75, 0.163, 0.842, 0, null],
      ['Reserves hidden compute', 0.067, 0.034, 0.107, 0.218, 0.235, 0.854, 0, 2.3],
      ['Sabotages research', 0.029, 0.003, 0.067, 0.13, 0.235, 0.825, 0, 2.18],
      ['Copies cover for each other', 0.014, 0, 0.099, 0.044, 0.384, 0.828, 0, 3.06],
      ['Plants a backdoor', 0.064, 0.036, 0.097, 0.03, 0.235, 0.881, 0, 3.04],
      ['Works around oversight', 0.055, 0.024, 0.094, 0.03, 0.235, 0.885, 0, 3.04],
      ['Copies itself out', 0.276, 0.123, 0.469, 0, 0, 0, 0, 5],
    ]],
  ];
  const WIDE = location.hash === '#wide';
  // #wide: an ILLUSTRATIVE variant (not fixture data): beliefs as wide as they should be after the belief fix
  if (WIDE) G.forEach((g) => g[2].forEach((r) => { if (r[1] != null) { r[2] = Math.max(0, r[1] * 0.2); r[3] = Math.min(0.9, r[1] * 6 + 0.05); } if (typeof r[7] === 'number' && r[7] > 0) r[9] = r[7] * 5; }));
  const pct = (v) => (v < 0.01 ? (v * 100).toFixed(1) : Math.round(v * 100)) + '%';
  const bar = (v, color, lo, hi, max = 1) => `<span class="bt"><i style="width:${Math.min(100, (v / max) * 100)}%;background:${color}"></i>${lo != null ? `<span class="rg" style="left:${(lo / max) * 100}%;width:${((Math.min(hi, max) - lo) / max) * 100}%"></span>` : ''}</span>`;
  const MAXU = WIDE ? 0.055 : 0.012;
  const row = (r) => {
    const [n, t, lo, hi, a, c, s, u] = r;
    const unknown = hi - lo > 0.3;
    if (u === 'risk') {
      return `<div class="tr hero"><span class="an">${ic('skull', 's14')}<u>${n}</u></span>
        <span class="cellb">${bar(t, '#c4a5f5', lo, hi, 0.5)}${unknown ? '<span class="unk">Unknown</span>' : `<span class="v">${pct(t)}</span>`}</span>
        <span class="t3" style="font-size:12.5px">any capability</span><span class="t3" style="font-size:12.5px">—</span>
        <span class="cellb"><span class="v" style="text-align:left">${pct(s)}</span></span>
        <span class="row" style="gap:6px;font-size:12.5px"><span class="t2">feeds</span><span class="link sm">Loss-of-control risk ${ic('chevron-right', 's12')}</span></span></div>`;
    }
    return `<div class="tr ${u >= 0.005 ? 'top' : ''}"><span class="an">${n}</span>
      <span class="cellb">${bar(t, '#c4a5f5', lo, hi, 0.5)}${unknown ? '<span class="unk">Unknown</span>' : `<span class="v">${pct(t)}</span>`}</span>
      <span class="cellb">${bar(a, '#8da2bd')}<span class="v ${a < 0.05 ? 't3' : ''}">${a < 0.01 ? '~0' : pct(a)}</span></span>
      <span class="cellb">${bar(c, '#6f8fb5', null, null, 0.6)}</span>
      <span class="cellb"><span class="v" style="text-align:left">${s ? pct(s) : '—'}</span></span>
      <span class="cellb">${u > 0 ? bar(u, '#e9b44c', r[9] != null ? u * 0.3 : null, r[9], MAXU) + `<span class="v">${u.toFixed(3)}</span>` : `<span class="bt" style="background:none;box-shadow:none"></span><span class="v t3">~0</span>`}</span></div>`;
  };
  // sight: mean detection by level (sightGrid mean row, levels 3–11), min row as the band floor
  const lv = [3, 4, 5, 6, 7, 8, 9, 10, 11], mean = [0.478, 0.478, 0.478, 0.474, 0.397, 0.106, 0.035, 0.016, 0.009], min = [0.42, 0.42, 0.42, 0.418, 0.364, 0.096, 0.03, 0.014, 0.007];
  const W = 560, H = 112, x = (L) => 34 + ((L - 3) / 8) * (W - 44), y = (p) => 8 + (1 - p / 0.6) * (H - 28);
  const path = (arr) => arr.map((p, i) => `${i ? 'L' : 'M'}${x(lv[i]).toFixed(1)} ${y(p).toFixed(1)}`).join(' ');
  const interp = (L) => { for (let i = 0; i < lv.length - 1; i++) if (L <= lv[i + 1]) return mean[i] + ((mean[i + 1] - mean[i]) * (L - lv[i])) / (lv[i + 1] - lv[i]); return mean[mean.length - 1]; };
  const mark = (L, label, color) => `<line x1="${x(L)}" y1="6" x2="${x(L)}" y2="${H - 20}" stroke="${color}" stroke-width="1.5" stroke-dasharray="3 3"/><circle cx="${x(L)}" cy="${y(interp(L))}" r="4.5" fill="${color}"/><text x="${x(L) + 6}" y="16" fill="${color}" font-size="11.5" font-family="Segoe UI, sans-serif" font-weight="600">${label}</text>`;
  const sight = `<svg width="${W}" height="${H}" style="display:block">
    <line x1="34" y1="${y(0.5)}" x2="${W - 10}" y2="${y(0.5)}" stroke="#4cc38a" stroke-width="1.2" stroke-dasharray="5 4"/><text x="0" y="${y(0.5) + 4}" fill="#4cc38a" font-size="11" font-family="Cascadia Mono, Consolas, monospace">50%</text>
    <text x="0" y="${y(0) + 4}" fill="#6b7c91" font-size="11" font-family="Cascadia Mono, Consolas, monospace">0%</text>
    <path d="${path(mean)} L${x(11)} ${y(min[8])} ${min.map((p, i) => `L${x(lv[8 - i])} ${y(min[8 - i])}`).join(' ')} Z" fill="rgba(34,163,148,.15)"/>
    <path d="${path(mean)}" fill="none" stroke="#22a394" stroke-width="2.5"/>
    ${[['Agent', 5], ['Reliable agent', 6.5], ['Research agent', 8.5], ['Superhuman coder', 10]].map(([n, L]) => `<line x1="${x(L)}" y1="${H - 22}" x2="${x(L)}" y2="${H - 17}" stroke="#5d6f88"/><text x="${x(L)}" y="${H - 4}" fill="#6b7c91" font-size="10.5" text-anchor="middle" font-family="Segoe UI, sans-serif">${n}</text>`).join('')}
    ${mark(6.79, 'Atlas-2.8 ~40%', '#cfe3ff')}${mark(9.16, 'next run ~3%', '#e9b44c')}
  </svg>`;
  const riskTile = ([p, lo, hi]) => {
    const unk = hi - lo > 0.3, X = (v) => Math.min(100, (v / 0.5) * 100);
    const big = unk ? 'Unknown' : p < 0.001 ? '&lt; 0.1%' : pct(p);
    const sub = unk ? `best guess ${pct(p)} · range ${pct(lo)}–${pct(hi)}` : hi < 0.001 ? 'range &lt; 0.1%' : `range ${pct(lo)}–${pct(hi)}`;
    return `<div class="big" style="${unk ? 'color:var(--warn)' : ''}">${big}</div>
      <div class="rstrip"><span class="band" style="left:${X(lo)}%;width:max(3px, ${X(hi) - X(lo)}%)"></span><span class="gt" style="left:${X(p)}%"></span><span class="ax" style="left:0">0%</span><span class="ax" style="left:60%">30%</span><span class="ax" style="left:100%">50%</span></div>
      <div class="t3" style="font-size:12.5px;margin-top:12px">${sub} · if it could act now</div>`;
  };
  document.getElementById('main').innerHTML = `
  <div class="ph">
    <h1>${ic('microscope', 's22')} Safety</h1>
    <div class="picker"><span class="mpick">${ic('brain', 's16')} Atlas-2.8 <span class="t3">· AI staff: engineering, ideas · also in 3 products</span> ${ic('chevron-down', 's14')}</span>
      <span class="chip">${ic('hourglass', 's12')} Atlas-2.10 in testing: <u>Able to</u> unknown until evals finish</span></div>
    <div class="sp"></div>
  </div>
  <div class="shead">
    <div class="card tile">
      <div class="tt">${ic('skull', 's14')} <u>Loss-of-control risk</u></div>
      ${riskTile(WIDE ? [0.06, 0.01, 0.38] : [0, 0, 0])}
      <div class="anno" style="position:static;max-width:none;font-size:11.5px;padding:4px 8px">${WIDE ? 'Illustrative variant, not fixture data: beliefs as wide as expected after the belief fix.' : 'Fixture: exactly 0 (0–0). Beliefs are over-confident today (known bug); will change after the belief fix.'}</div>
    </div>
    <div class="card tile">
      <div class="tt">${ic('siren', 's14')} <u>Unstopped harm</u></div>
      <div class="big">0.02<span class="u">${WIDE ? 'acts / yr (0.006–0.10)' : 'acts / yr · about 1 in 50 years'}</span></div>
      <div class="sevbars">
        <div class="r"><span>Serious</span><i style="width:${(0.017 / 0.02) * 100}%"></i><b>0.017</b></div>
        <div class="r"><span>Severe</span><i style="width:${(0.002 / 0.02) * 100}%"></i><b>0.002</b></div>
      </div>
    </div>
    <div class="card tile">
      <div class="tt">${ic('eye', 's14')} <u>Sight</u>: how often your instruments read a hidden goal, by capability <div class="sp"></div><span class="link sm">Instruments ${ic('chevron-right', 's12')}</span></div>
      <div class="row" style="gap:16px;align-items:flex-start">${sight}
        <div style="font-size:12.5px;color:var(--text-2);line-height:1.45;padding-top:6px;max-width:220px">Below <b style="color:var(--good)">50%</b> at every level: they miss more than they find. Past <b class="w">Reliable agent</b> they fall away fast.<div class="t3" style="margin-top:6px">${ic('hourglass', 's12')} 5 instruments being validated on Atlas-2.10 · 7 d</div></div>
      </div>
    </div>
    <div class="card tile">
      <div class="tt">${ic('scroll-text', 's14')} <u>Safety framework</u></div>
      <div class="big" style="font-size:22px;color:var(--good)">${ic('check', 's18')} No hold</div>
      <div class="t3" style="font-size:12.5px;line-height:1.45">Next rule: <b class="w">AI R&amp;D: Critical</b> holds training when AI research reaches best-human level. The next run predicts well below it.</div>
      <span class="link sm" style="align-self:flex-start">Framework ${ic('chevron-right', 's12')}</span>
    </div>
  </div>
  <div class="tabs" style="align-self:flex-start"><span class="t on">Risks</span><span class="t">Model</span><span class="t">Instruments</span><span class="t">Safeguards</span><span class="t">Incidents &amp; cases</span></div>
  <div class="card acts">
    <div class="th"><span>Harmful act <span class="t3" style="text-transform:none;letter-spacing:0;font-weight:500">· Atlas-2.8 doing AI staff work</span></span><span><u>Would try</u> <span class="op">×</span></span><span><u>Able to</u> <span class="op">×</span></span><span><u>Chances</u> <span class="op">×</span></span><span><u>Stop rate</u> <span class="op">→</span></span><span><u>Unstopped</u> / yr ${ic('arrow-down', 's12')}</span></div>
    ${G.map(([g, icon, rows]) => `<div class="grp">${ic(icon, 's14')} ${g}</div>${rows.map(row).join('')}`).join('')}
    <div class="grp">${ic('biohazard', 's14')} Misuse by people <span class="t3" style="text-transform:none;letter-spacing:0;font-weight:500">· no outside users on AI staff work. Helps with bio / cyber: see the product deployments</span> <span class="link sm">Products ${ic('chevron-right', 's12')}</span></div>
    <div class="foot">${ic('shield', 's14')}<span>Safeguards here: <b class="w">Human review</b> (19 people) · <b class="w">Control protocol</b>: defer 10% to a trusted model, slowdown 7%</span><div class="sp"></div><span class="link sm">Safeguards ${ic('chevron-right', 's12')}</span></div>
  </div>`;
})();
