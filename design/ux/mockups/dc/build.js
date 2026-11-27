// COMPUTE › Overview with the data-centre redesign (DATACENTERS.md). Unchanged: status strip, Capacity and fleet chart,
// Order chips, Rent cloud. Changed: Build data centre (Rent/Grid/Gas with today's wait, speed-ups in the options row,
// preview names what sets the live date). Added: site rows under the chart. #tips: grid-wait + opposition tooltips.
(function () {
  const D = window.DC;
  const tips = location.hash === '#tips';
  const ic = (n, c = '') => `<svg class="i ${c}"><use href="#i-${n}"/></svg>`;
  const qL = (i) => `Q${(((i % 4) + 4) % 4) + 1} ${25 + Math.floor(i / 4)}`;
  const SRC = { rent: ['key-round', 'rent'], grid: ['utility-pole', 'grid'], gas: ['flame', 'gas'] };
  const X = (q) => `${((q - D.q0) / (D.q1 - D.q0)) * 100}%`;
  const W = (a, b) => `${((b - a) / (D.q1 - D.q0)) * 100}%`;
  const NOW = D.now + 0.05;

  // ── status strip (unchanged component, today's values) ──
  const status = `
  <div class="status">
    <div class="cst good"><span class="ci">${ic('check', 's18')}</span><div><div class="a">All delivered chips running</div><div class="b">No <u>idle chips</u></div></div>${ic('chevron-right', 's14')}</div>
    <div class="cst warn"><span class="ci">${ic('server', 's18')}</span><div><div class="a"><b>1.1M</b>H100e without <u>racks</u> by Q2 28</div><div class="b">Short from <b>Q4 26</b> until <b>Q3 28</b></div></div>${ic('chevron-right', 's14')}</div>
    <div class="cst good"><span class="ci">${ic('truck', 's18')}</span><div><div class="a"><b>100%</b><u>vendor fill</u></div><div class="b">HBM-bound</div></div>${ic('chevron-right', 's14')}</div>
  </div>`;

  const chartCard = `
  <div class="card chartc">
    <div class="hd"><span class="ttl">Capacity and fleet</span><span class="q">H100e by quarter · past, now and planned</span>
      <span class="lg"><span><i style="background:#fff"></i><u>Powered capacity</u></span><span><i style="background:var(--run)"></i>Running</span><span><i style="background:var(--cloudc)"></i>Cloud</span><span><i style="background:var(--bad)"></i>Idle</span><span><i class="hatch" style="background-color:#56677e;height:9px;vertical-align:0"></i>Planned</span></span></div>
    <div class="chart" id="chart"></div>
  </div>`;

  // ── site rows ──
  const seg = (cls, a, b, color) => {
    const out = [];
    if (a < NOW) out.push(`<i class="ln ${cls}" style="left:${X(a)};width:${W(a, Math.min(b, NOW))};background:${color}"></i>`);
    if (b > NOW) out.push(`<i class="ln ${cls} plan" style="left:${X(Math.max(a, NOW))};width:${W(Math.max(a, NOW), b)};background:${color}"></i>`);
    return out.join('');
  };
  const track = (x) => {
    let h = `<span class="now" style="left:${X(NOW)}"></span>`;
    if (x.stage === 'live') return h + `<i class="ln full" style="left:0;width:100%;background:var(--live);opacity:.7"></i>`;
    if (x.stage === 'hall') h += seg('full', x.hall[0], x.hall[1], 'var(--cons)');
    else {
      h += seg('full', x.permits[0], x.permits[1], 'var(--perm)');
      h += seg('top', x.build[0], x.build[1], 'var(--cons)');
      h += seg('bot', x.power[0], x.power[1], 'var(--pow)');
    }
    if (x.risk) h += `<span class="roll" style="left:${X(x.permits[1])}">${ic('megaphone', 's12')}</span>`;
    return h + `<span class="dia ${x.risk ? 'risk' : ''}" style="left:${X(x.live)}"></span>`;
  };
  const stage = (x) => {
    if (x.stage === 'live') return `<span class="good" style="font-weight:600">live</span><span class="sub">since ${x.since}</span>`;
    if (x.stage === 'hall') return `<u>Hall being built</u>`;
    if (x.stage === 'build') return `<u>Construction</u> · <u>power</u>`;
    if (x.stage === 'power') return `<u>Waiting for grid</u><span class="sub">build from ${qL(x.build[0])}</span>`;
    if (x.stage === 'permits') return `<u>Permits</u><span class="chip bad">${ic('megaphone', 's12')} block ${x.risk.block}%</span><span class="btn sm" style="padding:1px 8px;font-size:12px">${ic('handshake', 's12')} Package $${x.pkg.toFixed(1)}B</span>`;
    return '';
  };
  const rows = D.sites.map((x) => `
    <div class="srow site">
      <div class="sname">${ic(SRC[x.src][0], 's14')}<span class="nm">${x.name}</span><span class="ssrc">${SRC[x.src][1]}</span></div>
      <div class="gw">${x.gw >= 1 ? x.gw.toFixed(1) + ' GW' : Math.round(x.gw * 1000) + ' MW'}</div>
      <div class="trk2">${track(x)}</div>
      <div class="ldate">${x.stage === 'live' ? '' : qL(x.live)}</div>
      <div class="stg">${stage(x)}</div>
    </div>`).join('');
  const years = [4, 8, 12, 16, 20].map((q) => `<span style="left:${X(q)}">${2025 + q / 4}</span>`).join('') + `<span class="today" style="left:${X(NOW)}">today</span>`;
  const sites = `
  <div class="card">
    <div class="hd"><span class="ttl"><u>Sites</u></span><span class="rt"><u>Racks used</u> <span class="bar2" style="display:inline-block;width:110px;height:7px;border-radius:4px;background:var(--panel-3);position:relative;vertical-align:1px;margin:0 6px"><i style="position:absolute;left:0;top:0;bottom:0;width:92%;background:var(--good);border-radius:4px"></i></span><b>0.55 / 0.60 GW</b></span></div>
    <div class="cb" style="gap:3px;padding-top:6px">
      <div class="srow"><span class="lbl">site</span><span class="lbl" style="text-align:right">size</span><div class="axis2">${years}</div><span class="lbl"><u>live</u></span><span class="lbl">stage</span></div>
      ${rows}
      <div class="leg" style="padding:6px 0 0 242px"><span><i style="background:var(--perm)"></i><u>permits</u></span><span><i style="background:var(--cons)"></i><u>construction</u></span><span><i style="background:var(--pow)"></i><u>power</u></span><span><i style="background:var(--live)"></i>live</span><span><i class="hatch" style="background-color:#56677e"></i>planned</span><span>${ic('megaphone', 's12')} <u>opposition</u> decides</span></div>
    </div>
  </div>`;

  // ── right column ──
  const order = `
  <div class="card"><div class="hd"><span class="ttl">${ic('cpu', 's14')} Order chips</span><span class="rt">one batch</span></div>
    <div class="cb">
      <div class="tiles c5">${[['100K', '74 MW'], ['250K', '185 MW'], ['500K', '369 MW', 1], ['1.0M', '739 MW'], ['2.5M', '1.8 GW']].map(([a, b, on]) => `<div class="tl ${on ? 'on' : ''}"><span class="a">${a}</span><span class="b">${b}</span></div>`).join('')}</div>
      <div class="pills"><span class="pl cost">−$2.0B</span><span class="pl cost">−$4.7B</span><span class="pl gain">+500K H100e</span>arrives Q1 27</div>
      <div class="foot2"><span class="more">${ic('chevron-right', 's12')}<b>Standard</b> · any fab</span><span class="sp"></span><span class="btn sm pri">${ic('cpu', 's12')} Order</span></div>
    </div></div>`;

  const opt = (on, name, save, price, side) => `<div class="opt ${on ? 'on' : ''}"><span class="tg"></span><span class="nm"><u>${name}</u></span><span class="sv">${save}${side ? `<span class="side">${side}</span>` : ''}</span><span class="pr">${price}</span></div>`;
  const build = `
  <div class="card" id="ctl-sites"><div class="hd"><span class="ttl">${ic('warehouse', 's14')} Build data centre</span><span class="rt"><b>1.35M</b> H100e per GW</span></div>
    <div class="cb">
      <div class="tiles c5">${[['Hall', '100 MW'], ['Building', '300 MW'], ['Campus', '1.0 GW', 1], ['Large campus', '2.5 GW'], ['Multi-GW', '5.0 GW']].map(([a, b, on]) => `<div class="tl ${on ? 'on' : ''}"><span class="a">${a}</span><span class="b">${b}</span></div>`).join('')}</div>
      <div class="lbl">Power</div>
      <div class="tiles c3">${[['rent', 'Rent', 'key-round', 4, '1 GW'], ['grid', 'Grid', 'utility-pole', 20, '1 GW'], ['gas', 'Gas', 'flame', 9, '5 GW', 1]].map(([id, a, i, w, cap, on]) => `<div class="tl ${on ? 'on' : ''}" id="pt-${id}"><span class="a">${ic(i, 's12')}${a}</span><span class="b"><span class="wq">${w}q</span> wait · ≤ ${cap}</span></div>`).join('')}</div>
      <div class="lbl"><u>Pay with</u></div>
      <div class="tiles c2 paytl"><div class="tl on"><span class="a">Cash</span><span class="b g">PV $17.6B <span class="t3">· $18.9B total</span></span></div><div class="tl"><span class="a">Lease</span><span class="b">PV $18.3B <span class="t3">· $29.6B total</span></span></div></div>
      <div class="pills" id="pv"><span class="pl cost">−$18.9B</span><span class="pl gain">+1.35M H100e</span><span class="pl exp" id="riskpill">${ic('megaphone', 's12')} block 6% · delay 30%</span></div>
      <div class="pvl2">live ≈ <b>Q1 29</b> · <u>construction</u> sets the date <span class="t3">· power ready Q1 28</span></div>
      <div class="opts">
        ${opt(false, 'Crash construction', '−4 q', '+$4.9B', 'risk ↑')}
        ${opt(true, 'Rush power', '−1 q', '+$0.9B')}
        ${opt(false, 'Fast-track permits', '−1 q', '+$0.7B')}
        ${opt(true, 'Community package', 'block 12 → 6%', '+$1.0B')}
        <div class="row" style="font-size:12px;padding-top:2px"><span class="t3">Company default</span><span class="btn sm" style="padding:0 8px;font-size:11.5px">Package every site</span></div>
      </div>
      <div class="foot2"><span class="more">${ic('chevron-down', 's12')}<b>Rush power</b> · community package</span><span class="sp"></span><span class="btn sm pri">${ic('warehouse', 's12')} Build</span></div>
    </div></div>`;

  const cloud = `
  <div class="card"><div class="hd"><span class="ttl">${ic('cloud', 's14')} <u>Rent cloud</u></span><span class="rt"><b>$10.9K</b> / H100e-yr</span></div>
    <div class="cb">
      <div class="tiles c5">${[['100K'], ['250K', 1], ['500K'], ['1.0M'], ['2.5M']].map(([a, on]) => `<div class="tl ${on ? 'on' : ''}"><span class="a">${a}</span></div>`).join('')}</div>
      <div class="row" style="font-size:12.5px"><span class="t3">Term</span><span class="seg3"><span>1 yr</span><span class="on">3 yr</span><span>5 yr</span></span></div>
      <div class="pills"><span class="pl cost">−$2.7B</span><span class="pl gain">+250K H100e</span>online Q4 26</div>
      <div class="foot2"><span class="more">${ic('chevron-right', 's12')}<b>Firm</b> · take-or-pay</span><span class="sp"></span><span class="btn sm">${ic('cloud', 's12')} Sign</span></div>
    </div></div>`;

  document.getElementById('main').innerHTML = `
  <div class="ph"><h1>${ic('server', 's22')} Compute</h1>
    <div class="tabs"><span class="t on">Overview</span><span class="t">Orders</span><span class="t">Market</span></div>
    <div class="lk"><span>Compute online ›</span><span>Compute split ›</span></div></div>
  <div class="cols"><div class="lcol">${status}${chartCard}${sites}</div><div class="rcol">${order}${build}${cloud}</div></div>`;

  // ── Capacity and fleet chart ──
  const C = D.chart, el = document.getElementById('chart');
  const w = el.clientWidth, h = el.clientHeight, L = 34, B = 20, T = 18, ymax = 6;
  const n = C.q.length, bw = (w - L) / n, xb = (i) => L + i * bw, yv = (v) => T + (h - T - B) * (1 - v / ymax);
  let s = `<defs><pattern id="hp" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="none"/><line x1="0" y1="0" x2="0" y2="7" stroke="rgba(11,15,21,.75)" stroke-width="3.5"/></pattern></defs>`;
  for (let v = 0; v <= ymax; v++) s += `<line x1="${L}" x2="${w}" y1="${yv(v)}" y2="${yv(v)}" stroke="#1d2734"/><text x="${L - 8}" y="${yv(v) + 4}" fill="#6b7c91" font-size="11.5" text-anchor="end" font-family="Cascadia Mono, Consolas">${v ? v + 'M' : '0'}</text>`;
  C.q.forEach((q, i) => {
    const x = xb(i) + bw * 0.2, bwi = bw * 0.6, fut = i > C.today;
    const run = Math.min(C.own[i], C.powered[i]), idle = Math.max(0, C.own[i] - C.powered[i]);
    const parts = [[0, run, '#3a8ae0'], [run, run + idle, '#ef6b6b'], [run + idle, run + idle + C.cloud[i], '#6b7c91']];
    parts.forEach(([a, b, c]) => { if (b > a) { s += `<rect x="${x}" y="${yv(b)}" width="${bwi}" height="${yv(a) - yv(b)}" fill="${c}" opacity="${fut ? 0.75 : 1}"/>`; if (fut) s += `<rect x="${x}" y="${yv(b)}" width="${bwi}" height="${yv(a) - yv(b)}" fill="url(#hp)"/>`; } });
    s += `<text x="${xb(i) + bw / 2}" y="${h - 3}" fill="${i === C.today ? '#fff' : '#6b7c91'}" font-weight="${i === C.today ? 700 : 400}" font-size="11.5" text-anchor="middle" font-family="Segoe UI">${q}</text>`;
  });
  let p = `M${L},${yv(C.powered[0])}`;
  C.powered.forEach((v, i) => { p += ` L${xb(i)},${yv(v)} L${xb(i + 1)},${yv(v)}`; });
  s += `<path d="${p}" fill="none" stroke="#fff" stroke-width="2"/>`;
  const tx = xb(C.today + 1);
  s += `<line x1="${tx}" x2="${tx}" y1="${T - 6}" y2="${h - B}" stroke="#5aa9ff" stroke-dasharray="3 4"/><text x="${tx - 6}" y="${T}" fill="#fff" font-size="12" font-weight="700" text-anchor="end" font-family="Segoe UI">today</text><text x="${tx + 6}" y="${T}" fill="#6b7c91" font-size="12" font-family="Segoe UI">planned</text>`;
  s += `<text x="${xb(12) + 4}" y="${yv(4.46) - 8}" fill="#cfd8e3" font-size="12" font-family="Segoe UI">Lone Pine live</text>`;
  s += `<text x="${xb(13) + bw / 2}" y="${yv(3.0) - 8}" fill="#9fb0c3" font-size="12" text-anchor="middle" font-family="Segoe UI">Northwind Cloud ends</text>`;
  s += `<text x="${w - 4}" y="${T}" fill="#cfd8e3" font-size="12.5" text-anchor="end" font-family="Segoe UI">Red River (1.0 GW) ≈ Q2 30 ›</text>`;
  s += `<text x="${xb(8) + bw / 2}" y="${yv(2.1) - 8}" fill="#ef6b6b" font-size="12" text-anchor="middle" font-family="Segoe UI">no racks</text>`;
  el.innerHTML = `<svg width="${w}" height="${h}">${s}</svg>`;

  if (tips) {
    const main = document.getElementById('main').getBoundingClientRect();
    const tipAt = (anchorId, html, dx, dy, width) => {
      const r = document.getElementById(anchorId).getBoundingClientRect();
      document.getElementById(anchorId).classList.add('hov');
      document.getElementById('main').insertAdjacentHTML('beforeend', `<div class="tip" style="width:${width}px;left:${r.left - main.left + dx}px;top:${r.top - main.top + dy}px">${html}</div>`);
    };
    const pts = [12, 13, 14, 15, 16, 16.5, 17, 17.5, 18, 18.5, 19, 19.5, 20, 20];
    const sw = 380, sh = 54, mn = 10, mx = 22, yy = (v) => sh - 4 - ((v - mn) / (mx - mn)) * (sh - 8);
    const sp = pts.map((v, i) => `${((i / (pts.length - 1)) * sw).toFixed(1)},${yy(v).toFixed(1)}`).join(' ');
    const spark = `<svg class="spk" width="${sw}" height="${sh}"><line x1="0" x2="${sw}" y1="${yy(12)}" y2="${yy(12)}" stroke="#33435a" stroke-dasharray="3 3"/><polyline points="${sp}" fill="none" stroke="#d9a53a" stroke-width="2.2" stroke-linejoin="round"/><circle cx="${sw}" cy="${yy(20)}" r="3.5" fill="#d9a53a"/></svg>`;
    tipAt('pt-grid', `<div class="lockbar on"></div><div class="bd">
      <h4>${ic('utility-pole', 's14')} Grid <span class="sp"></span><span class="n" style="font-size:15px">20 q wait</span></h4>
      <div class="def">A new connection from the utility. Your site keeps the wait it gets on the day you commit.</div>
      <div class="brk" style="margin-bottom:8px">
        <span>Largest site</span><span class="n">1 GW</span>
        <span><u>Upfront</u> per GW</span><span class="n">$14.2B</span>
        <span><u>Power price</u></span><span class="n">×1.0 grid</span>
        <span><u>Opposition</u></span><span class="n warn">medium</span>
      </div>
      <div class="cap" style="font-size:10.5px">Grid wait</div>
      ${spark}
      <div class="spkax"><span>2023 · 12 q</span><span>2024</span><span>2025</span><span>today · 20 q</span></div>
      <div class="brk">
        <span><u class="on">Firm queue</u></span><span class="n">150 GW</span>
        <span class="sub2">&nbsp;&nbsp;you (Red River)</span><span class="n sub2">1.0 GW</span>
        <span class="sub2">&nbsp;&nbsp;other AI labs</span><span class="n sub2">6 GW</span>
        <span class="sub2">&nbsp;&nbsp;other industry</span><span class="n sub2">143 GW</span>
        <span>÷ <u>Connections per year</u></span><span class="n">30 GW</span>
        <span class="sum">Wait</span><span class="n sum">5.0 yr = 20 q</span>
      </div>
      <div class="def" style="margin:9px 0 0">A new 1 GW grid site adds <b class="n w">+0.1 q</b> to everyone's wait.</div>
      <div class="hint">${ic('lock', 's12')} Locked · hover a term for more · Esc closes</div></div>`, -845, -240, 412);
    tipAt('riskpill', `<div class="lockbar"></div><div class="bd">
      <h4>${ic('megaphone', 's14')} Opposition <span class="sp"></span><span style="font-size:13px;color:var(--warn)">medium</span></h4>
      <div class="def">Local opposition decides when permits end, Q1 27.</div>
      <div class="brk">
        <span>Gas site</span><span class="n">10%</span>
        <span><u>Public against data centres</u> · rising</span><span class="n bad">×1.2</span>
        <span><u>Community package</u></span><span class="n good">×0.5</span>
        <span class="sum">Blocked</span><span class="n sum">6%</span>
        <span class="sub2" style="padding-left:12px">money spent so far is lost</span><span class="n sub2">≈ $1.0B</span>
        <span class="sum" style="border:0">Delayed</span><span class="n sum" style="border:0">30%</span>
        <span class="sub2" style="padding-left:12px">live date slips</span><span class="n sub2">+1 to 3 q</span>
      </div>
      <div class="def" style="margin:9px 0 0">Crash construction would raise both.</div></div>`, -447, 30, 370);
  }
})();
