// COMPUTE › Sites (DATACENTERS.md): L1 #1 power-capacity steps + site rows on one time axis; L1 #2 build card
// (size · power source · speed-ups · preview). #tips: grid-wait and opposition tooltips open.
(function () {
  const D = window.DC;
  const tips = location.hash === '#tips';
  const ic = (n, c = '') => `<svg class="i ${c}"><use href="#i-${n}"/></svg>`;
  const qL = (i) => `Q${(((i % 4) + 4) % 4) + 1} ${25 + Math.floor(i / 4)}`;
  const SRC = { rent: ['key-round', 'rent'], grid: ['utility-pole', 'grid'], gas: ['flame', 'gas'] };
  const X = (q) => `${((q - D.q0) / (D.q1 - D.q0)) * 100}%`;
  const W = (a, b) => `${((b - a) / (D.q1 - D.q0)) * 100}%`;
  const NOW = D.now + 0.05;

  // segment split at today: past solid, future hatched (planned)
  const seg = (cls, a, b, color) => {
    const out = [];
    if (a < NOW) out.push(`<i class="ln ${cls}" style="left:${X(a)};width:${W(a, Math.min(b, NOW))};background:${color}"></i>`);
    if (b > NOW) out.push(`<i class="ln ${cls} plan" style="left:${X(Math.max(a, NOW))};width:${W(Math.max(a, NOW), b)};background:${color}"></i>`);
    return out.join('');
  };

  const track = (x) => {
    let h = `<span class="now" style="left:${X(NOW)}"></span>`;
    if (x.stage === 'live') return h + `<i class="ln full" style="left:0;width:100%;background:var(--live);opacity:.75"></i>`;
    if (x.stage === 'hall') h += seg('full', x.hall[0], x.hall[1], 'var(--cons)');
    else {
      h += seg('full', x.permits[0], x.permits[1], 'var(--perm)');
      h += seg('top', x.build[0], x.build[1], 'var(--cons)');
      h += seg('bot', x.power[0], x.power[1], 'var(--pow)');
    }
    if (x.risk) h += `<span class="roll" style="left:${X(x.permits[1])}">${ic('megaphone', 's14')}</span>`;
    h += `<span class="dia ${x.risk ? 'risk' : ''}" style="left:${X(x.live)}"></span>`;
    return h;
  };

  const stage = (x) => {
    if (x.stage === 'live') return `<span class="good" style="font-weight:600">live</span><span class="sub">since ${x.since}</span>`;
    if (x.stage === 'hall') return `<u>Hall being built</u>`;
    if (x.stage === 'build') return `<u>Construction</u> <span class="t3">·</span> <u>turbines</u>`;
    if (x.stage === 'power') return `<u>Waiting for grid</u><span class="sub">build from ${qL(x.build[0])}</span>`;
    if (x.stage === 'permits') return `<u>Permits</u><span class="chip bad" id="mvrisk">${ic('megaphone', 's12')} block ${x.risk.block}%</span><span class="btn sm" style="padding:2px 8px;font-size:12px">${ic('handshake', 's12')} Package $${x.pkg.toFixed(1)}B</span>`;
    return '';
  };

  const rows = D.sites.map((x) => `
    <div class="srow site">
      <div class="sname"><span class="si">${ic(SRC[x.src][0], 's14')}</span><div><div class="nm">${x.name}</div><div class="ssrc">${SRC[x.src][1]}</div></div></div>
      <div class="gw">${x.gw >= 1 ? x.gw.toFixed(1) + ' GW' : Math.round(x.gw * 1000) + ' MW'}</div>
      <div class="trk2">${track(x)}</div>
      <div class="ldate ${x.stage === 'live' ? 'live' : ''}">${x.stage === 'live' ? '' : qL(x.live)}</div>
      <div class="stg">${stage(x)}</div>
    </div>`).join('');

  const years = [0, 4, 8, 12, 16, 20].map((q) => `<span style="left:${X(q)}">${2025 + q / 4}</span>`).join('') + `<span class="today" style="left:${X(NOW)}">today</span>`;

  const sites = `
  <div class="card">
    <div class="hd"><span class="ttl">${ic('warehouse', 's18')} <u>Sites</u></span><span class="q">power for your chips, by quarter</span></div>
    <div class="cbody" style="gap:6px">
      <div class="srow" style="align-items:stretch">
        <div class="capsum" style="justify-content:center">
          <span class="lbl"><u>Live power</u></span>
          <span class="big">0.60<span class="u">GW</span></span>
          <span class="ubar"><i style="width:${(D.live.used / D.live.cap) * 100}%"></i></span>
          <span class="t3" style="font-size:12.5px"><span class="n t2">0.55 GW</span> in use by chips</span>
          <span class="lbl" style="margin-top:16px"><u>Coming</u></span>
          <span class="big">+4.7<span class="u">GW by ${qL(21)}</span></span>
        </div>
        <div class="yax" id="yax" style="position:relative;display:block"></div>
        <div class="capc" id="capc"></div>
        <div></div><div class="leg" style="flex-direction:column;align-items:flex-start;gap:7px;justify-content:flex-end">
          <span><i style="background:var(--live)"></i>live power</span>
          <span><i style="background:transparent;border:1px dashed var(--live)"></i>at risk (permits)</span>
          <span><i style="background:transparent;border:1px dashed #8fbfff"></i>new site, if built</span>
        </div>
      </div>
      <div class="srow"><div></div><div></div><div class="axis2">${years}</div><div></div><div></div></div>
      <div class="srow hd2"><span>site</span><span style="text-align:right">size</span><span></span><span><u>live</u></span><span>stage</span></div>
      ${rows}
      <div class="leg" style="padding-left:288px">
        <span><i style="background:var(--perm)"></i><u>permits</u></span>
        <span><i style="background:var(--cons)"></i><u>construction</u></span>
        <span><i style="background:var(--pow)"></i><u>power</u></span>
        <span><i class="hatch" style="background-color:#56677e"></i>planned</span>
        <span>${ic('megaphone', 's14')} <u>opposition</u> decides</span>
      </div>
    </div>
  </div>`;

  // ── build card ──
  const MAXW = 24;
  const best = { wait: 'rent', cap: 'gas', up: 'rent', run: 'gas', opp: 'rent' };
  const src = (s) => `
    <div class="src ${s.on ? 'on' : ''}" id="src-${s.id}">
      <div class="sh">${ic(s.icon, 's18')} ${s.name}</div>
      <div><div class="wt" id="wt-${s.id}"><span class="n">${s.wait} q</span><span class="k"><u>${s.waitName}</u> today</span></div>
      <div class="wbar"><i style="width:${(s.wait / MAXW) * 100}%"></i></div></div>
      <div class="kv">
        <span class="k">Size</span><span class="v ${best.cap === s.id ? 'best' : ''}">≤ ${s.cap}</span>
        <span class="k"><u>Upfront</u></span><span class="v ${best.up === s.id ? 'best' : ''}">$${s.up.toFixed(1)}B</span>
        <span class="k"><u>Running</u></span><span class="v ${best.run === s.id ? 'best' : ''}">$${s.run.toFixed(1)}B/yr</span>
        <span class="k"><u>Opposition</u></span><span class="v ${best.opp === s.id ? 'best' : ''}" style="font-family:var(--sans)">${s.opp ? `<span class="pips3 l${s.opp}"><i></i><i></i><i></i></span> ` : ''}${s.oppW}</span>
      </div>
    </div>`;

  const lev = (l) => `
    <div class="lev ${l.on ? 'on' : ''}">
      <span class="tg"></span>
      <span class="ln2">${ic(l.icon, 's14')}<span class="nm"><u>${l.name}</u></span><span class="sb">${l.sub}</span></span>
      <span class="sv">${l.save}${l.side ? `<span class="side">${l.side}</span>` : ''}</span>
      <span class="pr">${l.price}</span>
    </div>`;

  const P = D.pv, PQ = 22;
  const px = (q) => `${(q / PQ) * 100}%`, pw = (a, b) => `${((b - a) / PQ) * 100}%`;
  const preview = `
    <div class="pvw">
      <div class="pvl"><span class="cap" style="font-size:10.5px">If you build</span><span class="pvax">${[0, 4, 8, 12, 16].map((i) => `<span style="left:${px(i + 2)}">${2027 + i / 4}</span>`).join('')}</span></div>
      <div class="pvl"><span><u>Permits</u></span><span class="tk"><i style="left:${px(P.permits[0])};width:${pw(...P.permits)};background:var(--perm)"></i><span class="rdy" style="left:${px(P.permits[1])}">${ic('megaphone', 's12')} <u>opposition</u> decides ${P.rollQ}</span></span></div>
      <div class="pvl"><span><u>Construction</u></span><span class="tk"><i style="left:${px(P.build[0])};width:${pw(...P.build)};background:var(--cons)"></i><span class="bind" style="left:${px(P.build[1])}">sets the date</span></span></div>
      <div class="pvl"><span><u>Power</u></span><span class="tk"><i style="left:${px(P.power[0])};width:${pw(...P.power)};background:var(--pow)"></i><span class="rdy" style="left:${px(P.power[1])}">turbines ready ${qL(6 + P.power[1])}</span></span></div>
      <div class="pvl"><span style="color:#fff;font-weight:650">Live</span><span class="pvlive">
        <span class="dia" style="left:${px(P.live)}"></span>
        <span class="lb main" style="left:calc(${px(P.live)} + 16px)">${P.liveQ}</span><span class="lb gh" style="left:calc(${px(P.live)} + 16px);transform:none;top:13px;margin-left:92px;color:var(--text-2);font-size:12.5px">in ${P.inQ} q</span>
        ${P.ghosts.map((g) => `<span class="dia gh" style="left:${px(g.q)}"></span><span class="lb gh" style="left:${px(g.q)}">${g.lbl}</span>`).join('')}
      </span></div>
    </div>`;

  const tot = `
    <div class="tot">
      <div><div class="k"><u>Upfront</u></div><div class="v">$${P.upfront.toFixed(1)}B</div><div class="s">spent ${qL(6)}–${qL(6 + P.live - 1)}</div></div>
      <div><div class="k"><u>Running</u></div><div class="v">$${P.run.toFixed(1)}B<span class="u">/yr</span></div><div class="s">fuel and upkeep</div></div>
      <div><div class="k">Holds</div><div class="v">${P.holds}</div><div class="s"><u>H100e</u></div></div>
      <div id="riskbox"><div class="k"><u>Opposition</u> <span style="text-transform:none;letter-spacing:0;font-weight:500">· ${P.level}</span></div><div class="v">${P.block}%<span class="u">block</span>&nbsp; ${P.delay}%<span class="u">delay</span></div><div class="s">decided ${P.rollQ}</div></div>
    </div>`;

  const build = `
  <div class="card" id="ctl-sites">
    <div class="hd"><span class="ttl">${ic('warehouse', 's18')} Build data centre</span></div>
    <div class="cbody" style="flex:1">
      <div class="lbl">Size</div>
      <div class="tiles5">${D.sizes.map((z) => `<div class="tl ${z.on ? 'on' : ''}">${z.gas ? `<span class="gtag">${ic('flame', 's12')}gas</span>` : ''}<span class="a">${z.name}</span><span class="b">${z.mw}</span><span class="c">${z.h} <u>H100e</u></span></div>`).join('')}</div>
      <div class="lbl">Power</div>
      <div class="tiles3">${D.sources.map(src).join('')}</div>
      <div class="lbl">Speed up <span class="t3">· saves, given your other choices</span></div>
      <div style="display:flex;flex-direction:column;gap:6px">${D.levers.map(lev).join('')}</div>
      ${preview}
      ${tot}
      <div class="foot">
        <span class="payc">${ic('chevron-right', 's14')} <u>Pay with</u> <b>Cash</b></span>
        <span class="sp"></span>
        <span class="btn pri big">${ic('warehouse', 's14')} Build · $${P.upfront.toFixed(1)}B</span>
      </div>
    </div>
  </div>`;

  document.getElementById('main').innerHTML = `
  <div class="ph"><h1>${ic('server', 's22')} Compute</h1>
    <div class="tabs"><span class="t">Overview</span><span class="t on">Sites</span><span class="t">Orders &amp; market</span></div>
    <div class="sp"></div></div>
  <div class="cols">${sites}${build}</div>`;

  // ── L1 #1 capacity steps (live GW), drawn on the rows' axis ──
  const box = document.getElementById('capc');
  const w = box.clientWidth, h = box.clientHeight, ymax = 7;
  const xq = (q) => ((q - D.q0) / (D.q1 - D.q0)) * w, yv = (v) => h - (v / ymax) * h;
  const step = (pts) => pts.map(([q, v], i) => (i ? `L${xq(q).toFixed(1)},${yv(pts[i - 1][1]).toFixed(1)} L${xq(q).toFixed(1)},${yv(v).toFixed(1)}` : `M${xq(q).toFixed(1)},${yv(v).toFixed(1)}`)).join(' ');
  const firm = [[0, 0.6], [8, 0.8], [14, 3.3], [21, 4.3], [24, 4.3]];
  const area = step(firm) + ` L${w},${h} L0,${h} Z`;
  const grid = [2, 4, 6].map((v) => `<line x1="0" x2="${w}" y1="${yv(v)}" y2="${yv(v)}" stroke="#243041"/>`).join('');
  box.innerHTML = `<svg width="${w}" height="${h}">
    ${grid}
    <path d="${area}" fill="rgba(76,195,138,.16)"/>
    <path d="${step(firm)}" fill="none" stroke="#4cc38a" stroke-width="2.5"/>
    <path d="M${xq(16)},${yv(3.3)} L${xq(16)},${yv(4.3)} L${xq(21)},${yv(4.3)} L${xq(21)},${yv(5.3)} L${w},${yv(5.3)}" fill="none" stroke="#4cc38a" stroke-width="2" stroke-dasharray="5 4"/>
    <path d="M${xq(16)},${yv(4.3)} L${xq(16)},${yv(5.3)} L${xq(21)},${yv(5.3)} L${xq(21)},${yv(6.3)} L${w},${yv(6.3)}" fill="none" stroke="#8fbfff" stroke-width="2" stroke-dasharray="5 4"/>
    <line x1="${xq(NOW)}" x2="${xq(NOW)}" y1="0" y2="${h}" stroke="rgba(255,255,255,.45)" stroke-width="2"/>
  </svg>`;
  document.getElementById('yax').innerHTML = [0, 2, 4, 6].map((v) => `<span style="position:absolute;right:2px;top:${yv(v) - 8}px">${v}${v === 6 ? ' GW' : ''}</span>`).join('');
  // firm line excludes Mesa Verde (permits pending)
  // (drawn: 0.6 → 0.8 Q1 27 → 3.3 Q3 28 → +1.0 Red River Q2 30; dashed +1.0 Mesa Verde Q1 29)

  if (tips) {
    const main = document.getElementById('main').getBoundingClientRect();
    const tipAt = (anchorId, html, dx, dy, width) => {
      const r = document.getElementById(anchorId).getBoundingClientRect();
      document.getElementById(anchorId).classList.add('hov');
      document.getElementById('main').insertAdjacentHTML('beforeend', `<div class="tip" style="width:${width}px;left:${r.left - main.left + dx}px;top:${r.top - main.top + dy}px">${html}</div>`);
    };
    // grid wait: 2023 → 2026 quarterly
    const pts = [12, 13, 14, 15, 16, 16.5, 17, 17.5, 18, 18.5, 19, 19.5, 20, 20];
    const sw = 380, sh = 54, mn = 10, mx = 22;
    const sp = pts.map((v, i) => `${((i / (pts.length - 1)) * sw).toFixed(1)},${(sh - 4 - ((v - mn) / (mx - mn)) * (sh - 8)).toFixed(1)}`).join(' ');
    const spark = `<svg class="spk" width="${sw}" height="${sh}"><line x1="0" x2="${sw}" y1="${sh - 4 - ((12 - mn) / (mx - mn)) * (sh - 8)}" y2="${sh - 4 - ((12 - mn) / (mx - mn)) * (sh - 8)}" stroke="#33435a" stroke-dasharray="3 3"/><polyline points="${sp}" fill="none" stroke="#d9a53a" stroke-width="2.2" stroke-linejoin="round"/><circle cx="${sw}" cy="${sh - 4 - ((20 - mn) / (mx - mn)) * (sh - 8)}" r="3.5" fill="#d9a53a"/></svg>`;
    tipAt('wt-grid', `<div class="lockbar on"></div><div class="bd">
      <h4>${ic('utility-pole', 's14')} Grid wait <span class="sp"></span><span class="n" style="font-size:15px">20 q</span></h4>
      <div class="def">Time from permits to a new grid connection. Your site keeps the wait it gets on the day you commit.</div>
      <div class="cap" style="font-size:10.5px">Wait for a new connection</div>
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
      <div class="def" style="margin:9px 0 0">A new 1 GW grid site would add <b class="n w">+0.1 q</b> to everyone's wait.</div>
      <div class="hint">${ic('lock', 's12')} Locked · hover a term for more · Esc closes</div></div>`, -470, -60, 412);

    tipAt('riskbox', `<div class="lockbar"></div><div class="bd">
      <h4>${ic('megaphone', 's14')} Opposition <span class="sp"></span><span style="font-size:13px;color:var(--warn)">medium</span></h4>
      <div class="def">Local opposition decides when permits end (${P.rollQ}). Shown as low / medium / high; these are the odds.</div>
      <div class="brk">
        <span>Gas site</span><span class="n">10%</span>
        <span><u>Public against data centres</u> · rising</span><span class="n bad">×1.2</span>
        <span><u>Community package</u></span><span class="n good">×0.5</span>
        <span class="sum">Blocked</span><span class="n sum">6%</span>
        <span class="sub2" style="padding-left:12px">money spent so far is lost</span><span class="n sub2">≈ $1.0B</span>
        <span class="sum" style="border:0">Delayed</span><span class="n sum" style="border:0">30%</span>
        <span class="sub2" style="padding-left:12px">live date slips</span><span class="n sub2">+1 to 3 q</span>
      </div>
      <div class="def" style="margin:9px 0 0">Crash construction would raise both.</div></div>`, -185, -345, 380);
  }
})();
