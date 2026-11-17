// Shared v3 shell for the Company / Research / Safety mockups: L0 top strip, nav, bottom bar.
// Data: SCENARIO.md (12 Mar 2026, day 254, frontier leader). Page sets <body data-nav="company">.
// icons (for the sprite builder): #i-pause #i-play #i-chevrons-right #i-fast-forward #i-skip-forward #i-brain #i-eye-off
// #i-microscope #i-wallet #i-trending-up #i-timer #i-circle-help #i-menu #i-radar #i-workflow #i-users #i-flask-conical #i-boxes
// #i-server #i-landmark #i-handshake #i-globe #i-book-open #i-triangle-alert #i-file-search
(function () {
  const I = (n, c = '') => `<svg class="i ${c}"><use href="#i-${n}"/></svg>`;
  // race bar: shared 5–15 scale; L violet, U teal, gap hatched red
  const W = 376, x = (v) => 4 + (v - 5) / 10 * (W - 8);
  const L = 7.3, U = 6.9;
  const race = `<svg width="${W}" height="30"><defs><pattern id="hatchT" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="5" fill="#ef6b6b"/></pattern></defs>
    <rect x="4" y="2" width="${W - 8}" height="8" rx="4" fill="#243041"/><rect x="4" y="2" width="${x(L) - 4}" height="8" rx="4" fill="#9b6be0"/>
    <rect x="4" y="12" width="${W - 8}" height="8" rx="4" fill="#243041"/><rect x="4" y="12" width="${x(U) - 4}" height="8" rx="4" fill="#22a394"/>
    <rect x="${x(U)}" y="12" width="${x(L) - x(U)}" height="8" fill="url(#hatchT)"/>
    ${[[6.5, 'agent'], [8.5, 'research'], [12, 'SC'], [15, 'ASI']].map(([v, n]) => `<line x1="${x(v)}" x2="${x(v)}" y1="0" y2="21" stroke="#6b7c91" stroke-dasharray="2 2" opacity=".7"/><text x="${x(v) - (v === 15 ? 8 : 0)}" y="29" text-anchor="middle" fill="#6b7c91" font-size="8.5" font-family="Segoe UI">${n}</text>`).join('')}
  </svg>`;
  // risk gauge with band 4–18 on 0–100 (log-ish display: 0..40 scale)
  const arc = (cx, cy, r, a0, a1, col, w) => { const p = (a) => [cx + r * Math.cos(Math.PI * (1 - a)), cy - r * Math.sin(Math.PI * (1 - a))]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `<path d="M${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1}" stroke="${col}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`; };
  const RS = 40; // gauge full scale 40%
  const risk = `<svg width="48" height="32">${arc(24, 28, 19, 0, 1, '#243041', 5)}${arc(24, 28, 19, 4 / RS, 18 / RS, 'rgba(233,180,76,.35)', 5)}${arc(24, 28, 19, 0, 9 / RS, '#e9b44c', 5)}</svg>`;
  // runway gauge: distress <3q, tight <6q, healthy; needle at 7q
  const ang = (q) => Math.PI * (1 - Math.min(q, 10) / 10);
  const zarc = (q0, q1, col) => { const p = (q) => [31 + 22 * Math.cos(ang(q)), 26 - 22 * Math.sin(ang(q))]; const [x0, y0] = p(q0), [x1, y1] = p(q1); return `<path d="M${x0},${y0} A22,22 0 0 1 ${x1},${y1}" stroke="${col}" stroke-width="5" fill="none"/>`; };
  const a7 = ang(7);
  const runway = `<svg width="62" height="38">${zarc(0, 3, 'rgba(239,107,107,.55)')}${zarc(3, 6, 'rgba(233,180,76,.55)')}${zarc(6, 10, 'rgba(76,195,138,.45)')}
    <line x1="31" y1="26" x2="${31 + 19 * Math.cos(a7)}" y2="${26 - 19 * Math.sin(a7)}" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="31" cy="26" r="2.5" fill="#fff"/>
    <text x="31" y="37" text-anchor="middle" fill="#4cc38a" font-size="10" font-weight="700" font-family="Cascadia Mono, Consolas">7q</text></svg>`;

  const top = `<div class="top">
    <div class="seg">
      <div class="speed">
        <div class="b">${I('pause', 's14')}<span class="k">␣</span></div>
        <div class="b">${I('play', 's14')}<span class="k">1</span></div>
        <div class="b on">${I('chevrons-right', 's14')}<span class="k">2</span></div>
        <div class="b">${I('fast-forward', 's14')}<span class="k">3</span></div>
        <div class="b">${I('skip-forward', 's14')}<span class="k">F</span></div>
      </div>
      <div class="date col" style="gap:0"><span class="d">12 Mar 2026</span><span class="a">Day 254</span></div>
    </div>
    <div class="seg race">
      <div class="lbls">
        <span style="color:var(--cap)">${I('brain', 's12')} <u>CAPABILITY</u></span><b style="color:var(--cap)">7.3</b>
        <span class="sp"></span>
        <span class="tag" style="border-color:rgba(239,107,107,.5);color:var(--bad);background:var(--bad-bg)">${I('eye-off', 's12')} 0.4 BLIND</span>
        <span class="sp"></span>
        <b style="color:var(--und)">6.9</b><span style="color:var(--und)"><u>UNDERSTANDING</u> ${I('microscope', 's12')}</span>
      </div>${race}
    </div>
    <div class="stat">${risk}<div class="col" style="gap:1px"><span class="l"><u>CATASTROPHE RISK</u></span><span class="row" style="gap:6px"><span class="v" style="color:var(--warn)">9%</span><span class="sub num">4–18</span></span></div></div>
    <div class="stat"><div class="ic">${I('wallet', 's14')}</div><div class="col" style="gap:1px"><span class="l">CASH · <u>RUNWAY</u></span><span class="v">$31.2B</span></div>${runway}</div>
    <div class="stat"><div class="ic">${I('trending-up', 's14')}</div><div class="col" style="gap:1px"><span class="l"><u>REVENUE</u></span><span class="v">$14.0B<span class="u">/yr</span></span></div></div>
    <div class="stat" style="border-right:0"><div class="ic" style="color:var(--rival)">${I('timer', 's14')}</div><div class="col" style="gap:1px"><span class="l"><u>LEAD</u> · NEAREST</span><span class="row" style="gap:6px"><span class="v good">+41d</span><span class="sub">xLab ±20</span></span></div></div>
    <div class="stat" style="border-right:0;border-left:1px solid var(--line)"><div class="ic" style="color:var(--warn)">${I('triangle-alert', 's14')}</div><div class="col" style="gap:1px"><span class="l">ALERTS</span><span class="v">3</span></div></div>
    <div class="sp"></div>
    <div class="seg" style="border-right:0;border-left:1px solid var(--line)"><div class="speed"><div class="b">${I('circle-help', 's14')}</div><div class="b">${I('menu', 's14')}</div></div></div>
  </div>`;

  const items = [
    ['overview', 'radar', 'Overview'], ['company', 'workflow', 'Company'], ['research', 'flask-conical', 'Research'],
    ['models', 'brain', 'Models'], ['products', 'boxes', 'Products', 1], ['safety', 'microscope', 'Safety', 2],
    ['compute', 'server', 'Compute'], ['finance', 'landmark', 'Finance'], ['relations', 'handshake', 'Relations'], ['world', 'globe', 'World'],
  ];
  const cur = document.body.dataset.nav;
  const nav = `<nav class="nav">${items.map(([k, ic, n, b]) => `<div class="it${k === cur ? ' on' : ''}">${I(ic, 's18')}${n}${b ? `<span class="badge" style="background:var(--warn)">${b}</span>` : ''}</div>`).join('')}
    <div class="sp"></div><div class="it">${I('book-open', 's18')}Codex</div></nav>`;

  const bottom = `<div class="bottom">
    <span class="dchip">${I('triangle-alert', 's14')}<b>3 alerts</b></span>
    <span class="sp"></span>
    <span class="t2 small row" style="gap:6px">${I('file-search', 's14')} 2 Mar · Linear probes: works well</span>
  </div>`;

  const app = document.querySelector('.app');
  app.insertAdjacentHTML('afterbegin', top);
  app.querySelector('.body').insertAdjacentHTML('afterbegin', nav);
  document.querySelector('.app').style.gridTemplateRows = '60px minmax(0, 1fr)';
  // state variants: #hover, #node, #assign → body class
  if (location.hash) document.body.classList.add('st-' + location.hash.slice(1));
})();
