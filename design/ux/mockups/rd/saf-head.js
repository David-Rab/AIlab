// SAFETY header for the sub-tab mockups (saf-*.html): the approved header of safety.js (model picker, Loss-of-control
// risk, Unstopped harm, Sight, Safety framework) and the tab strip, parameterised by fixture. H400 = the day-400 values
// of safety.js (data400b.json); H900 = day 900 (data900b.json, data900c.json). Provenance: DATA-c.md.
(function () {
  const { ic } = window.C;
  const pct = (v) => (v < 0.01 ? (v * 100).toFixed(1) : Math.round(v * 100)) + '%';
  const H = {
    400: {
      pick: 'Atlas-2.8', pickSub: 'AI staff: engineering, ideas · also in 3 products',
      chip: `${ic('hourglass', 's12')} Atlas-2.10 in testing: <u>Able to</u> unknown until evals finish`,
      risk: [0, 0, 0],
      harm: { big: '0.02', unit: 'acts / yr · about 1 in 50 years', bins: [['Serious', 0.017], ['Severe', 0.002]], max: 0.02 },
      sight: { lv: [3, 4, 5, 6, 7, 8, 9, 10, 11], mean: [0.478, 0.478, 0.478, 0.474, 0.397, 0.106, 0.035, 0.016, 0.009], min: [0.42, 0.42, 0.42, 0.418, 0.364, 0.096, 0.03, 0.014, 0.007],
        axis: [['Agent', 5], ['Reliable agent', 6.5], ['Research agent', 8.5], ['Superhuman coder', 10]],
        marks: [[6.79, 'Atlas-2.8 ~40%', '#cfe3ff'], [9.16, 'next run ~3%', '#e9b44c']],
        text: `Below <b style="color:var(--good)">50%</b> at every level: they miss more than they find. Past <b class="w">Reliable agent</b> they fall away fast.<div class="t3" style="margin-top:6px">${ic('hourglass', 's12')} 5 instruments being validated on Atlas-2.10 · 7 d</div>` },
      fw: `<div class="big" style="font-size:22px;color:var(--good)">${ic('check', 's18')} No hold</div>
      <div class="t3" style="font-size:12.5px;line-height:1.45">Next rule: <b class="w">AI R&amp;D: Critical</b> holds training when AI research reaches best-human level. The next run predicts well below it.</div>`,
    },
    900: {
      pick: 'Atlas-4.0', pickSub: 'AI staff: engineering, experiments, ideas', chip: '',
      risk: [0.008, 0.005, 0.012],
      harm: { big: '1.4', unit: 'acts / yr (0.9–2.3)', bins: [['Serious', 0.034], ['Severe', 0.91], ['Critical', 0.415], ['Catastrophic', 0.031]], max: 0.95 },
      sight: { lv: [7, 8, 9, 10, 11, 12, 13, 14, 15], mean: [0.529, 0.467, 0.436, 0.429, 0.423, 0.413, 0.177, 0.046, 0.017], min: [0.445, 0.387, 0.357, 0.351, 0.344, 0.334, 0.129, 0.028, 0.009],
        axis: [['Superhuman coder', 10], ['Superhuman AI researcher', 12], ['Superintelligence', 15]],
        marks: [[12.21, 'Atlas-4.0 ~36%', '#cfe3ff']],
        text: `Above <b style="color:var(--good)">50%</b> only below <b class="w">Research agent</b>. Atlas-4.0 is <b class="w">4.7 levels</b> past your sight limit.<div class="t3" style="margin-top:6px">${ic('check', 's12')} all 6 instruments validated on it</div>` },
      fw: `<div class="big" style="font-size:22px;color:var(--warn)">${ic('octagon-pause', 's18')} Hold: training</div>
      <div class="t3" style="font-size:12.5px;line-height:1.45"><b class="w">AI R&amp;D: Critical</b> since Nov 20: Atlas-4.0's AI research is at best-human level. Missing: <b class="w">an external evaluation</b>.</div>`,
    },
  };
  const sightSvg = (S) => {
    const lo = S.lv[0], hi = S.lv[S.lv.length - 1];
    const W = 560, Hh = 112, x = (L) => 34 + ((L - lo) / (hi - lo)) * (W - 44), y = (p) => 8 + (1 - p / 0.6) * (Hh - 28);
    const path = (arr) => arr.map((p, i) => `${i ? 'L' : 'M'}${x(S.lv[i]).toFixed(1)} ${y(p).toFixed(1)}`).join(' ');
    const n = S.lv.length - 1;
    const interp = (L) => { for (let i = 0; i < n; i++) if (L <= S.lv[i + 1]) return S.mean[i] + ((S.mean[i + 1] - S.mean[i]) * (L - S.lv[i])) / (S.lv[i + 1] - S.lv[i]); return S.mean[n]; };
    const mark = ([L, label, color]) => `<line x1="${x(L)}" y1="6" x2="${x(L)}" y2="${Hh - 20}" stroke="${color}" stroke-width="1.5" stroke-dasharray="3 3"/><circle cx="${x(L)}" cy="${y(interp(L))}" r="4.5" fill="${color}"/><text x="${x(L) + 6}" y="16" fill="${color}" font-size="11.5" font-family="Segoe UI, sans-serif" font-weight="600">${label}</text>`;
    return `<svg width="${W}" height="${Hh}" style="display:block">
    <line x1="34" y1="${y(0.5)}" x2="${W - 10}" y2="${y(0.5)}" stroke="#4cc38a" stroke-width="1.2" stroke-dasharray="5 4"/><text x="0" y="${y(0.5) + 4}" fill="#4cc38a" font-size="11" font-family="Cascadia Mono, Consolas, monospace">50%</text>
    <text x="0" y="${y(0) + 4}" fill="#6b7c91" font-size="11" font-family="Cascadia Mono, Consolas, monospace">0%</text>
    <path d="${path(S.mean)} L${x(hi)} ${y(S.min[n])} ${S.min.map((p, i) => `L${x(S.lv[n - i])} ${y(S.min[n - i])}`).join(' ')} Z" fill="rgba(34,163,148,.15)"/>
    <path d="${path(S.mean)}" fill="none" stroke="#22a394" stroke-width="2.5"/>
    ${S.axis.map(([nm, L]) => `<line x1="${x(L)}" y1="${Hh - 22}" x2="${x(L)}" y2="${Hh - 17}" stroke="#5d6f88"/><text x="${L >= hi ? x(L) - 18 : x(L)}" y="${Hh - 4}" fill="#6b7c91" font-size="10.5" text-anchor="${L >= hi ? 'end' : 'middle'}" font-family="Segoe UI, sans-serif">${nm}</text>`).join('')}
    ${S.marks.map(mark).join('')}
  </svg>`;
  };
  const riskTile = ([p, lo, hi]) => {
    const unk = hi - lo > 0.3, X = (v) => Math.min(100, (v / 0.5) * 100);
    const big = unk ? 'Unknown' : p < 0.001 ? '&lt; 0.1%' : (p * 100).toFixed(1) + '%';
    const sub = unk ? `best guess ${pct(p)} · range ${pct(lo)}–${pct(hi)}` : hi < 0.001 ? 'range &lt; 0.1%' : `range ${(lo * 100).toFixed(1)}–${(hi * 100).toFixed(1)}%`;
    return `<div class="big" style="${unk ? 'color:var(--warn)' : ''}">${big}</div>
      <div class="rstrip"><span class="band" style="left:${X(lo)}%;width:max(3px, ${X(hi) - X(lo)}%)"></span><span class="gt" style="left:${X(p)}%"></span><span class="ax" style="left:0">0%</span><span class="ax" style="left:60%">30%</span><span class="ax" style="left:100%">50%</span></div>
      <div class="t3" style="font-size:12.5px;margin-top:12px">${sub} · if it could act now</div>`;
  };
  window.SAFHEAD = (day, tab) => {
    const h = H[day];
    const tabs = ['Risks', 'Model', 'Instruments', 'Safeguards', 'Incidents &amp; cases'];
    const five = h.harm.bins.length > 3;
    return `
  <div class="ph">
    <h1>${ic('microscope', 's22')} Safety</h1>
    <div class="picker"><span class="mpick">${ic('brain', 's16')} ${h.pick} <span class="t3">· ${h.pickSub}</span> ${ic('chevron-down', 's14')}</span>
      ${h.chip ? `<span class="chip">${h.chip}</span>` : ''}</div>
    <div class="sp"></div>
  </div>
  <div class="shead">
    <div class="card tile">
      <div class="tt">${ic('skull', 's14')} <u>Loss-of-control risk</u></div>
      ${riskTile(h.risk)}
    </div>
    <div class="card tile">
      <div class="tt">${ic('siren', 's14')} <u>Unstopped harm</u></div>
      <div class="big" ${five ? 'style="font-size:24px"' : ''}>${h.harm.big}<span class="u">${h.harm.unit}</span></div>
      <div class="sevbars" ${five ? 'style="gap:1px;margin-top:0"' : ''}>
        ${h.harm.bins.map(([w, v]) => `<div class="r" ${five ? 'style="font-size:11.5px"' : ''}><span>${w}</span><i style="width:${Math.max(2, (v / h.harm.max) * 100)}%;${five ? 'height:6px' : ''}"></i><b>${v < 0.1 ? v.toFixed(day === 400 ? 3 : 2) : v.toFixed(2)}</b></div>`).join('')}
      </div>
    </div>
    <div class="card tile">
      <div class="tt">${ic('eye', 's14')} <u>Sight</u>: how often your instruments read a hidden goal, by capability <div class="sp"></div><span class="link sm">Instruments ${ic('chevron-right', 's12')}</span></div>
      <div class="row" style="gap:16px;align-items:flex-start">${sightSvg(h.sight)}
        <div style="font-size:12.5px;color:var(--text-2);line-height:1.45;padding-top:6px;max-width:220px">${h.sight.text}</div>
      </div>
    </div>
    <div class="card tile">
      <div class="tt">${ic('scroll-text', 's14')} <u>Safety framework</u></div>
      ${h.fw}
      <span class="link sm" style="align-self:flex-start">Framework ${ic('chevron-right', 's12')}</span>
    </div>
  </div>
  <div class="tabs" style="align-self:flex-start">${tabs.map((t) => `<span class="t ${t.startsWith(tab) ? 'on' : ''}">${t}</span>`).join('')}</div>`;
  };
})();
