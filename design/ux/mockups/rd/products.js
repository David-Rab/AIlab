// PRODUCTS (UI-IA §1 PRODUCTS; DD-01..04): revenue by product with what limits it and served vs unserved (L1 #1); one card
// per product = lineup of real owned models + tools + customers + sector certification + price + thinking effort (L1 #2).
// #drawer: L2, Enterprise › Customers by sector. Day-400 values: data400a.json (see DATA-a.md).
(function () {
  const ic = (n, c = '') => `<svg class="i ${c}"><use href="#i-${n}"/></svg>`;
  // s.series.revenue, weekly, $B/yr (all revenue)
  const REV = [12, 12.557, 13.05, 13.5, 13.909, 14.283, 14.629, 14.954, 15.258, 15.547, 15.824, 16.1, 16.367, 16.627, 16.849, 17.065, 17.281, 17.498, 17.704, 17.91, 18.117, 18.325, 18.533, 18.711, 18.837, 18.936, 18.66, 20.978, 22.874, 24.565, 26.078, 27.381, 28.596, 29.695, 30.691, 31.594, 32.389, 33.121, 33.812, 34.443, 34.144, 33.825, 33.613, 33.491, 33.473, 33.529, 33.629, 33.783, 33.99, 34.17, 34.314, 34.459, 34.628, 34.173, 33.796, 33.518, 33.21, 32.951];
  const spark = (pts, w, h) => {
    const mn = 0, mx = 36;
    const xy = pts.map((v, i) => [(i / (pts.length - 1)) * w, h - 2 - ((v - mn) / (mx - mn)) * (h - 4)]);
    const p = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const [lx, ly] = xy[xy.length - 1];
    return `<svg width="${w}" height="${h + 16}" style="display:block">
      <polyline points="0,${h - 2} ${p} ${w},${h - 2}" fill="rgba(176,142,26,.14)" stroke="none"/>
      <polyline points="${p}" fill="none" stroke="#d9b638" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="${lx}" cy="${ly}" r="3.5" fill="#fff"/>
      <text x="0" y="${h + 13}" fill="#6b7c91" font-size="11" font-family="Cascadia Mono, Consolas, monospace">Jul 2025</text>
      <text x="${w}" y="${h + 13}" fill="#6b7c91" font-size="11" font-family="Cascadia Mono, Consolas, monospace" text-anchor="end">now</text>
    </svg>`;
  };

  const MAXR = 14;
  const rows = [
    { name: 'Enterprise', icon: 'building-2', rev: 13.69, why: "rivals' models win buyers" },
    { name: 'Chat', icon: 'message-circle', rev: 11.71, why: 'users mostly stay' },
    { name: 'API', icon: 'square-terminal', rev: 6.54, why: "rivals' models win buyers" },
  ];
  const revRows = rows.map((r) => `
    <div class="rr">
      <span class="nm">${ic(r.icon, 's18')}${r.name}</span>
      <div class="bar"><div class="sv" style="width:${(r.rev / MAXR) * 100}%"></div></div>
      <span class="val">$${r.rev.toFixed(1)}B<span class="u">/yr</span></span>
      <span class="srv">${ic('check', 's14')} <span>all demand <u>served</u></span></span>
      <span class="why"><span class="chip warn">${ic('gauge', 's12')} <u>Limited by</u>&nbsp;quality</span><span>${r.why}</span></span>
    </div>`).join('') + `
    <div class="rr" style="opacity:.75">
      <span class="nm" style="color:var(--text-2)">${ic('bot', 's18')}Agents</span>
      <div class="bar"><div style="position:absolute;inset:0;border:1px dashed var(--line-2);border-radius:4px"></div></div>
      <span class="val t3" style="font-size:13px;font-family:var(--sans);font-weight:500">not launched</span>
      <span></span><span></span>
    </div>`;

  // lineup rows: measured capability as a bar (no number at L1), share of hours sold, price per hour of work
  const lineup = (main, mini, pMain, pMini) => `
    <div class="lu hd2"><span></span><span>model</span><span style="text-align:left"><u>skill</u></span><span style="text-align:left">hours sold</span><span>per hour</span></div>
    <div class="lu"><span class="ro">1</span><span class="mn">Atlas-2.8</span><span class="sk"><i style="width:69%"></i></span><span class="row" style="gap:6px"><span class="hb" style="flex:1"><i style="width:${main}%"></i></span><span class="pc">${main}%</span></span><span class="pr">$${pMain}</span></div>
    <div class="lu"><span class="ro">2</span><span class="mn">Atlas-2.8-mini</span><span class="sk"><i style="width:52%"></i></span><span class="row" style="gap:6px"><span class="hb" style="flex:1"><i style="width:${mini}%"></i></span><span class="pc">${mini}%</span></span><span class="pr">$${pMini}</span></div>
    <div class="fold">${ic('chevron-right', 's12')}<span>4 more models sell nothing: Atlas-2.8-mini beats them on price for skill</span></div>`;
  const chatLineup = `
    <div class="lu hd2"><span></span><span>model</span><span style="text-align:left"><u>skill</u></span><span style="text-align:left">serves</span><span>per month</span></div>
    <div class="lu"><span class="ro">1</span><span class="mn">Atlas-2.8</span><span class="sk"><i style="width:69%"></i></span><span class="t2" style="font-size:12.5px">paying users</span><span class="pr">$22</span></div>
    <div class="lu"><span class="ro">2</span><span class="mn">Atlas-1.0-nano</span><span class="sk"><i style="width:11%"></i></span><span class="t2" style="font-size:12.5px"><u>Free tier</u></span><span class="pr">free</span></div>
    <div class="fold">${ic('chevron-right', 's12')}<span>5 more models in the lineup, unused by Chat</span></div>`;

  const XS = (v) => (v / 50) * 100;
  const custTrack = (c) => `
    <div class="ct"><div class="trk"><div class="ax"></div>
      ${c.tgt < c.now - 2 ? `<div class="arr" style="left:${XS(c.tgt)}%;width:${XS(c.now) - XS(c.tgt)}%"></div><div class="tgt" style="left:${XS(c.tgt)}%"></div>` : ''}
      <div class="rv" style="left:${XS(c.rv)}%"></div><div class="now" style="left:${XS(c.now)}%"></div>
      ${[0, 25, 50].map((t) => `<span class="tl2" style="left:${XS(t)}%">${t}%</span>`).join('')}</div>
      <div class="cv"><b class="n w">${c.now}%</b> ${c.tgt < c.now - 2 ? `<span class="dn">→ ${c.tgt}%</span> <span class="t3">in ${c.time}</span>` : '<span class="t3">holding</span>'}<div class="t3" style="font-size:12px"><span style="color:var(--rival)">▼</span> ${c.rival}</div></div>
    </div>
    <div class="t3" style="font-size:12.5px">${c.foot}</div>`;
  const certRow = `
    <div class="sec2"><div class="sh"><span class="cap"><u>Sector certification</u></span></div>
      <div class="cert">${ic('shield-check', 's14')}<span>None yet</span><span class="t3">· Finance, Healthcare, Government, Military can be certified</span></div>
      <div><span class="btn" style="padding:4px 10px;font-size:12.5px">${ic('plus', 's14')} Certify a sector</span></div>
    </div>`;
  const settings = (price) => `
    <div class="sec2">
      <div class="setrow"><span class="k"><u>Price</u></span><span class="seg3"><span>Low</span><span class="on">Standard</span><span>Premium</span></span><span class="t3" style="font-size:12.5px">${price}</span></div>
      <div class="setrow"><span class="k"><u>Thinking effort</u></span><span class="seg3"><span>Low</span><span class="on">Max</span><span class="lk">${ic('lock', 's12')} Deep</span></span><span></span></div>
    </div>`;
  const foot = `<div class="pfoot"><span class="link sm">${ic('users', 's12')} Customers by sector ${ic('chevron-right', 's12')}</span><span class="link sm">${ic('shield', 's12')} Safeguards ${ic('chevron-right', 's12')}</span><span class="sp"></span><span class="t3" style="font-size:12px">live since Jun 2025</span></div>`;

  const card = (o) => `
    <div class="card pcard">
      <div class="ph2"><span class="pi">${ic(o.icon, 's18')}</span><span class="pn">${o.name}</span><span class="live">Live</span><span class="sp"></span><span class="t3" style="font-size:12.5px">${o.who}</span></div>
      <div class="sec2"><div class="sh"><span class="cap"><u>Lineup</u></span><span class="t3" style="font-size:12px">buyers pick per task</span></div>${o.lineup}</div>
      <div class="sec2"><div class="sh"><span class="cap"><u>Tools</u></span><span class="t3" style="font-size:12px">where it helps</span></div>
        ${o.tools.map(([n, i, where, eff, cost]) => `<div class="tl"><span class="tool">${ic(i, 's14')}<u>${n}</u></span><span class="tw">${where}</span><span class="te">${eff}</span>${cost ? `<span></span><span></span><span class="tc">${cost} per task</span>` : ''}</div>`).join('')}
        <div><span class="tool add">${ic('plus', 's14')} Add a tool</span></div></div>
      <div class="sec2"><div class="sh"><span class="cap"><u>Customers</u></span><span class="t3" style="font-size:12px">${o.cust.what}, now → where buyers are heading</span></div>${custTrack(o.cust)}</div>
      ${o.cert}
      ${o.settings}
      ${foot}
    </div>`;

  const cards = [
    card({ name: 'Enterprise', icon: 'building-2', who: 'companies, by seat and by task',
      lineup: lineup(73, 27, '1.61', '0.21'),
      tools: [['Memory', 'brain-circuit', 'all work', 'tasks ×1.3 longer'], ['Research mode', 'telescope', 'Science, Finance, Legal', 'skill ×2 compute', '×3 cost']],
      cust: { what: 'share of sector spend', now: 29, tgt: 16, time: '~2 yr', rv: 30, rival: 'DeepCent 30%', foot: '23.4M seats · 5.4B hours of work a year' },
      cert: certRow, settings: settings('2.5× serving cost') }),
    card({ name: 'Chat', icon: 'message-circle', who: 'people, by subscription',
      lineup: chatLineup,
      tools: [['Memory', 'brain-circuit', 'all work', 'tasks ×1.3 longer'], ['Voice & vision', 'eye', 'Chat', 'appeal ×1.07']],
      cust: { what: 'share of consumer spend', now: 36, tgt: 35, time: '', rv: 17, rival: 'xLab 17%', foot: '605M weekly users · 7.3% pay' },
      cert: `<div class="sec2"><div class="sh"><span class="cap"><u>Sector certification</u></span></div><div class="cert t3">${ic('minus', 's14')} Not for consumer products</div></div>`,
      settings: settings('$22 a month') }),
    card({ name: 'API', icon: 'square-terminal', who: 'developers, by task',
      lineup: lineup(75, 25, '1.21', '0.21'),
      tools: [['Coding harness', 'code', 'Software & IT', 'skill ×2 compute', '×2 cost'], ['Computer use', 'mouse-pointer-2', 'Admin, Finance, Legal, Gov.', '+13% of tasks'], ['Voice & vision', 'eye', 'Creative & media', '+13% of tasks']],
      cust: { what: 'share of sector spend', now: 29, tgt: 16, time: '~2 yr', rv: 30, rival: 'DeepCent 30%', foot: '6.8B hours of work a year' },
      cert: certRow, settings: settings('2.5× serving cost') }),
  ].join('');

  const agents = `
    <div class="card pcard agents">
      <div class="ph2"><span class="pi">${ic('bot', 's18')}</span><span class="pn" style="color:var(--text)">Agents</span><span class="sp"></span><span class="chip">not launched</span></div>
      <div class="t2" style="font-size:13.5px">AI that works alone on multi-hour jobs, sold by the hour of work.</div>
      <div class="sec2"><div class="cap">Ready to launch?</div>
        <div class="row" style="gap:8px;font-size:13.5px">${ic('circle-check', 's14 good')}<span>Atlas-2.8 works <b class="n w">~22 h</b> alone</span><span class="t3">needs 4 h</span></div>
        <div class="row" style="gap:8px;font-size:13.5px">${ic('circle-check', 's14 good')}<span>Engineers have time</span><span class="t3">77% spare</span></div>
      </div>
      <div class="sec2"><div class="cap">It would sell</div>
        <div class="t2" style="font-size:13px">to the same buyers as API and Enterprise, whole jobs instead of single tasks</div>
      </div>
      <div style="margin-top:auto"><span class="btn pri">${ic('rocket', 's14')} Launch Agents</span> <span class="t3" style="font-size:12.5px;margin-left:6px">~1 wk of engineering</span></div>
    </div>`;

  document.getElementById('main').innerHTML = `
  <div class="ph">
    <h1>${ic('boxes', 's22')} Products</h1>
    <div class="sp"></div>
    <span class="link">${ic('server', 's14')} Serving compute: spare ${ic('chevron-right', 's12')}</span>
    <span class="btn">${ic('sliders-horizontal', 's14')} Policies <span class="t3" style="font-weight:500">2 on</span></span>
  </div>
  <div class="card rev">
    <div class="tot">
      <div class="cap">Revenue from products</div>
      <div class="big">$31.9B<span class="u">/yr</span></div>
      <div class="row" style="gap:6px;font-size:13px"><span class="dn">▼ 5%</span><span class="t3">since the Jul 2026 peak</span></div>
      <div style="margin-top:6px">${spark(REV, 258, 54)}</div>
    </div>
    <div class="rows">
      <div class="row legend t3" style="font-size:12.5px;gap:18px;padding-bottom:4px">
        <span><i style="background:var(--prod)"></i>served</span>
        <span><i class="hatch" style="background-color:var(--prod);opacity:.6"></i>wanted, not served</span>
      </div>
      ${revRows}
    </div>
  </div>
  <div class="cards">${cards}${agents}</div>
  ${location.hash === '#drawer' ? window.PRODUCTS_DRAWER() : ''}`;
  if (location.hash === '#drawer') document.querySelectorAll('.pcard')[0].style.boxShadow = '0 0 0 2px var(--you)';
})();
