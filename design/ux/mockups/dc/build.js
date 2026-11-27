// COMPUTE › Overview, data-centre redesign (DATACENTERS.md). Injected into the real app (worktree build, day-400 fixture,
// options row open) by render.mjs, so everything the redesign does not touch is today's app as it is.
// Changes: Sites tab removed; Build data centre → Rent / Grid / Gas tiles with the expected live date (+ delay band) and
// size cap, four speed-ups in the options row, preview names what sets the date and the opposition odds; Red River
// marker → 1.0 GW; site rows under the chart (the grid-pool / transformer row is gone).
// window.DC_TIPS = true opens the Grid tile tooltip (locked) and the opposition tooltip.
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const css = document.createElement('style');
  css.textContent = `
  .cmp-main { grid-template-rows: 590px auto; align-items: start; }
  .cmp-main > .cfc { height: 590px; }
  .cmp-main > .cfc { grid-row: 1; grid-column: 1; }
  .cmp-main > .cac-col { grid-row: 1 / 3; grid-column: 2; }
  .cmp-main > .dcs { grid-row: 2; grid-column: 1; }
  .cac-tiles.c3 { grid-template-columns: repeat(3, minmax(0,1fr)); }
  .dc-gl { display: flex; flex-direction: column; align-items: center; line-height: 1.3; }
  .dc-gl b { color: #fff; font-family: var(--mono); font-weight: 600; }
  .dc-gl .bd { color: var(--watch); font-family: var(--mono); font-size: 11px; }
  .dc-gl .cp { color: var(--text-3); font-size: 11px; }
  .dcs .card2-hd { margin-bottom: 4px; }
  .dcs-row { display: grid; grid-template-columns: 168px 60px minmax(0,1fr) 58px 300px; gap: 10px; align-items: center; font-size: 12.5px; min-height: 30px; padding: 0 4px; border-top: 1px solid var(--line); }
  .dcs-row.ax { border: 0; min-height: 18px; }
  .dcs-name { display: flex; gap: 6px; align-items: center; white-space: nowrap; color: #fff; }
  .dcs-name .dim { font-size: 11.5px; }
  .dcs-mw { text-align: right; color: #fff; font-family: var(--mono); }
  .dcs-tr { position: relative; height: 20px; }
  .dcs-tr i { position: absolute; height: 7px; border-radius: 2px; }
  .dcs-tr i.t { top: 2px; } .dcs-tr i.b { top: 11px; } .dcs-tr i.f { top: 2px; height: 16px; }
  .dcs-tr i.pl { background-image: repeating-linear-gradient(135deg, transparent 0 3px, rgba(13,17,23,.75) 3px 6px) !important; }
  .dcs-tr .nl { position: absolute; top: -6px; bottom: -6px; width: 1px; background: rgba(255,255,255,.35); }
  .dcs-tr .lv { position: absolute; top: 3px; width: 9px; height: 14px; margin-left: -4px; background: var(--good); clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); }
  .dcs-tr .lv.rk { background: none; border: 0; box-shadow: inset 0 0 0 2px var(--good); }
  .dcs-tr .tk { position: absolute; top: 0; transform: translateX(-50%); font: 10.5px var(--mono); color: var(--text-3); }
  .dcs-tr .tk.now { color: #fff; font: 600 10.5px var(--sans); }
  .dcs-lv { font-family: var(--mono); color: #fff; }
  .dcs-st { display: flex; gap: 6px; align-items: center; white-space: nowrap; color: var(--text-2); }
  .dcs-leg { display: flex; gap: 14px; font-size: 11.5px; color: var(--text-2); padding: 6px 4px 0 242px; }
  .dcs-leg i { display: inline-block; width: 14px; height: 7px; border-radius: 2px; margin-right: 5px; }
  .dc-pill { display: inline-flex; gap: 4px; align-items: center; padding: 0 6px; border-radius: 9px; font-size: 11.5px; font-weight: 600; border: 1px solid rgba(239,107,107,.45); color: var(--bad); background: rgba(239,107,107,.12); }
  .dc-tip { position: absolute; z-index: 1000; }
  .dc-tip .tipcard { width: 100%; }
  .dc-spk { display: block; margin: 6px 0 2px; }
  .dc-spkax { display: flex; justify-content: space-between; font: 10.5px var(--mono); color: var(--text-3); }
  .tipcard-row.sub > span { color: var(--text-3); font-size: 11.5px; padding-left: 10px; }
  .tipcard-row.sum { border-top: 1px solid var(--line); padding-top: 3px; margin-top: 2px; font-weight: 600; color: #fff; }
  .dc-hov { box-shadow: 0 0 0 2px var(--accent) !important; border-radius: 6px; }
  `;
  document.head.appendChild(css);

  // ── tabs: Overview · Orders & market ──
  $$('[data-tab=sites]').forEach((t) => t.remove());

  // ── Build data centre ──
  const card = $('#ctl-sites');
  const multi = $('[data-opt=site-multi]', card);
  multi.classList.remove('locked'); multi.disabled = false; $('.otile-gl span', multi).classList.remove('dim');
  const lease = $('[data-opt=path-lease]', card).parentElement, grid = $('[data-opt=path-grid]', card).parentElement, gas = $('[data-opt=path-gas]', card).parentElement;
  const row = lease.parentElement;
  [$('[data-opt=path-brownfield]', card).parentElement, $('[data-opt=path-nuclear]', card).parentElement].forEach((e) => e.remove());
  row.append(lease, grid, gas); row.classList.replace('c5', 'c3');
  const tile = (w, label, live, band, cap) => {
    const b = w.querySelector('button');
    $('.otile-top span:last-child', b).textContent = label;
    $('.otile-gl', b).innerHTML = `<span class="dc-gl"><span><b>${live}</b>${band ? ` <span class="bd">+0–3q</span>` : ''}</span><span class="cp">≤ ${cap}</span></span>`;
  };
  tile(lease, 'Rent', 'Q3 27', false, '1 GW');
  tile(grid, 'Grid', 'Q3 30', true, '1 GW');
  tile(gas, 'Gas', 'Q1 29', true, '5 GW');
  grid.querySelector('button').id = 'dc-grid';

  const pay = $$('[data-test=pay-pv]', card);
  pay[0].textContent = 'PV $17.4B'; pay[0].nextElementSibling.textContent = '$18.9B total';
  pay[1].textContent = 'PV $18.0B'; pay[1].nextElementSibling.textContent = '$30.8B total';
  const lines = $('.cac-lines', card);
  lines.children[0].querySelector('b').textContent = '−$18.9B';
  lines.children[1].innerHTML = `<span class="cac-line"><span class="dim">racks for</span> <b class="num tone-pos">+1.4M H100e</b> <span class="dim">· <span class="term"><span>construction</span></span> sets the date</span></span>`;
  lines.insertAdjacentHTML('beforeend', `<span id="dc-risk"><span class="cac-line"><span class="dim"><span class="term"><span>opposition</span></span> decides Q1 27</span> <b class="num tone-warn">block 6% · delay 30%</b></span></span>`);
  const lim = $('[data-limit="site.mw"]', card); [...lim.childNodes].filter((n) => n.nodeType === 3).forEach((n) => n.remove()); lim.append('100 MW–5 GW');
  const opts = $('.cac-opts', card);
  const tg = (on, term, rest) => `<button class="toggle ${on ? 'on' : ''}"><span class="toggle-knob"></span><span class="toggle-label"><span class="term"><span>${term}</span></span> · ${rest}</span></button>`;
  [...opts.querySelectorAll('.toggle')].forEach((t) => t.remove());
  opts.insertAdjacentHTML('afterbegin',
    tg(false, 'Crash construction', '−4 q, +$4.9B, odds up') +
    tg(true, 'Rush power', '−1 q, +$0.9B') +
    tg(false, 'Fast-track permits', '−1 q, +$0.7B') +
    tg(true, 'Community package', 'block ×0.5, +$1.0B'));
  $('.cac-more b', card).textContent = 'Rush power'; $('.cac-more', card).insertAdjacentHTML('beforeend', '<span class="dim">&nbsp;· community package</span>');

  // ── chart marker: Red River under the 1 GW grid cap ──
  $$('.cfc svg text').forEach((t) => { if (t.textContent.includes('Red River')) t.textContent = t.textContent.replace('2.0 GW', '1.0 GW'); });

  // ── site rows under the chart ──
  const Q0 = 0, Q1 = 21, NOW = 6.4; // Q1 25 .. Q2 30; today Aug 5, 2026
  const X = (q) => `${((q - Q0) / (Q1 - Q0)) * 100}%`, W = (a, b) => `${((b - a) / (Q1 - Q0)) * 100}%`;
  const qL = (i) => `Q${(i % 4) + 1} ${25 + Math.floor(i / 4)}`;
  const COL = { perm: '#8a9bb0', cons: '#3a8ae0', pow: '#e9b44c', live: 'rgba(76,195,138,.55)' };
  const seg = (cls, a, b, c) => (a < NOW ? `<i class="${cls}" style="left:${X(a)};width:${W(a, Math.min(b, NOW))};background:${c}"></i>` : '') + (b > NOW ? `<i class="${cls} pl" style="left:${X(Math.max(a, NOW))};width:${W(Math.max(a, NOW), b)};background:${c}"></i>` : '');
  const S = [
    { n: 'Abilene North', p: 'rent', mw: '300 MW', live: true, since: 'Q1 24' },
    { n: 'Abilene South', p: 'grid', mw: '300 MW', live: true, since: 'Q3 24' },
    { n: 'Lone Pine', p: 'gas', mw: '1.2 GW', live: true, since: 'Q2 26' },
    { n: 'Mesa Verde', p: 'gas', mw: '1.0 GW', perm: [6, 8], cons: [9, 17], pow: [8, 17], at: 17, risk: true },
    { n: 'Red River', p: 'grid', mw: '1.0 GW', perm: [1, 2], cons: [11, 19], pow: [2, 19], at: 19, st: 'Waiting for grid', sub: 'build from Q4 27' },
  ];
  const ticks = [4, 8, 12, 16, 20].map((q) => `<span class="tk" style="left:${X(q)}">${2025 + q / 4}</span>`).join('') + `<span class="tk now" style="left:${X(NOW)}">today</span>`;
  const rows = S.map((s) => {
    let tr = `<span class="nl" style="left:${X(NOW)}"></span>`, st;
    if (s.live) { tr += `<i class="f" style="left:0;width:100%;background:${COL.live}"></i>`; st = `<span class="tone-pos">live</span><span class="dim">since ${s.since}</span>`; }
    else {
      tr += seg('f', s.perm[0], s.perm[1], COL.perm) + seg('t', s.cons[0], s.cons[1], COL.cons) + seg('b', s.pow[0], s.pow[1], COL.pow) + `<span class="lv ${s.risk ? 'rk' : ''}" style="left:${X(s.at)}"></span>`;
      st = s.risk ? `<span class="term"><span>Permits</span></span><span class="dc-pill">block 12%</span><span class="act-wrap"><span class="act-col"><button class="btn btn-sm act-btn"><span>Community package · $1.0B</span></button></span></span>`
        : `<span class="term"><span>${s.st}</span></span><span class="dim">${s.sub}</span>`;
    }
    return `<div class="dcs-row"><span class="dcs-name"><span class="dot" style="background:${s.live ? 'var(--good)' : s.risk ? '#8a9bb0' : 'var(--watch)'}"></span>${s.n}<span class="dim">${s.p}</span></span><span class="dcs-mw">${s.mw}</span><span class="dcs-tr">${tr}</span><span class="dcs-lv">${s.live ? '' : qL(s.at)}</span><span class="dcs-st">${st}</span></div>`;
  }).join('');
  $('.cmp-main').insertAdjacentHTML('beforeend', `
  <section class="card2 dcs" data-home="sites">
    <div class="card2-hd"><span class="card2-ttl"><span class="term"><span>Sites</span></span></span><span class="sp"></span>
      <span class="row-i small"><span class="dim">racks used / live</span><span style="display:inline-block;width:110px;height:8px;border-radius:4px;background:var(--line);position:relative"><i style="position:absolute;left:0;top:0;bottom:0;width:61%;border-radius:4px;background:var(--good)"></i></span><b class="num">1.1 GW / 1.8 GW</b></span></div>
    <div class="dcs-row ax"><span></span><span></span><span class="dcs-tr">${ticks}</span><span class="dim small">live</span><span></span></div>
    ${rows}
    <div class="dcs-leg"><span><i style="background:${COL.perm}"></i>permits</span><span><i style="background:${COL.cons}"></i>construction</span><span><i style="background:${COL.pow}"></i>power</span><span><i style="background:${COL.live}"></i>live</span><span><i style="background:#3a8ae0;background-image:repeating-linear-gradient(135deg,transparent 0 3px,rgba(13,17,23,.75) 3px 6px)"></i>planned</span></div>
  </section>`);

  if (!window.DC_TIPS) return;
  const tipAt = (anchor, html, dx, dy, w) => {
    const r = anchor.getBoundingClientRect();
    anchor.classList.add('dc-hov');
    document.body.insertAdjacentHTML('beforeend', `<div class="tip dc-tip" style="left:${r.left + dx}px;top:${r.top + dy}px;width:${w}px">${html}</div>`);
  };
  const pts = [12, 13, 14, 15, 16, 16.5, 17, 17.5, 18, 18.5, 19, 19.5, 20, 20];
  const sw = 368, sh = 46, yy = (v) => sh - 4 - ((v - 10) / 12) * (sh - 8);
  const spark = `<svg class="dc-spk" width="${sw}" height="${sh}"><line x1="0" x2="${sw}" y1="${yy(12)}" y2="${yy(12)}" stroke="#34445a" stroke-dasharray="3 3"/><polyline points="${pts.map((v, i) => `${(i / (pts.length - 1)) * sw},${yy(v)}`).join(' ')}" fill="none" stroke="#e9b44c" stroke-width="2"/><circle cx="${sw}" cy="${yy(20)}" r="3" fill="#e9b44c"/></svg>`;
  const R = (a, b, cls = '') => `<div class="tipcard-row ${cls}"><span>${a}</span><span>${b}</span></div>`;
  const T = (t) => `<span class="term"><span>${t}</span></span>`;
  tipAt($('#dc-grid'), `<div class="tipcard">
    <div class="tipcard-head"><span class="tipcard-title">${T('Grid')}</span><span class="tipcard-value">live Q3 30 · +0–3q</span></div>
    <div class="tipcard-body">A new connection from the utility. Your site keeps today's wait from the day you commit.</div>
    <div class="tipcard-rows">
      ${R(T('Permits'), '1 q')}
      ${R(T('Grid wait') + ' today', '20 q')}
      ${R(T('Rush power'), '−25% → 15 q', 'sub')}
      ${R(T('Construction'), '8 q, timed to end with power')}
      ${R('Live', '1 + 15 = 16 q · Q3 30', 'sum')}
      ${R(T('Opposition') + ' delay · 20%', '+1 to 3 q')}
      ${R('Block · 3%', 'money spent is lost')}
    </div>
    <div class="tipcard-rows">
      ${R('Largest site', '1 GW')}
      ${R(T('Upfront') + ' per GW', '$14.2B')}
      ${R(T('Power price'), '×1.0 grid')}
    </div>
    <div class="tipcard-rows" style="display:block">
      <div class="tipcard-row"><span>${T('Grid wait')}, 2023 → today</span><span>12 → 20 q</span></div>
      ${spark}<div class="dc-spkax"><span>2023</span><span>2024</span><span>2025</span><span>2026</span></div>
      ${R(T('Firm queue'), '150 GW')}
      ${R('you (Red River)', '1.0 GW', 'sub')}
      ${R('other AI labs', '6 GW', 'sub')}
      ${R('other industry', '143 GW', 'sub')}
      ${R('÷ ' + T('connections per year'), '30 GW')}
      ${R('Wait', '5.0 yr = 20 q', 'sum')}
    </div>
    <div class="tipcard-foot">A new 1 GW grid site adds 0.1 q to everyone's wait.</div>
  </div><div class="tip-lockbar" style="width:100%"></div>`, -440, -365, 400);
  tipAt($('#dc-risk'), `<div class="tipcard">
    <div class="tipcard-head"><span class="tipcard-title">${T('Opposition')}</span><span class="tipcard-value">medium</span></div>
    <div class="tipcard-body">Local opposition decides when permits end, Q1 27.</div>
    <div class="tipcard-rows">
      ${R('Gas site', '10%')}
      ${R(T('Public against data centres') + ' · rising', '×1.2')}
      ${R(T('Community package'), '×0.5')}
      ${R('Blocked', '6%', 'sum')}
      ${R('money spent so far is lost', '≈ $1.0B', 'sub')}
      ${R('Delayed', '30%', 'sum')}
      ${R('live date slips', '+1 to 3 q', 'sub')}
    </div>
    <div class="tipcard-foot">Crash construction raises both.</div>
  </div>`, -400, 26, 360);
})();
