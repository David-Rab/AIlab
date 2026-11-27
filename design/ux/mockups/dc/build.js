// COMPUTE › Overview, data-centre redesign (DATACENTERS.md, §5b campuses). Injected into the real app (day-400 fixture,
// options row open) by render.mjs, so everything the redesign does not touch is today's app as it is.
// Changes: Sites tab removed; Build data centre → size = one building (100 MW · 300 MW · 1 GW), Buildings 1 · 3 · 5 row
// with the repetition saving and campus total, Rent / Grid / Gas tiles with the expected live date (a first → last range
// for campuses, + delay band) and size cap, four speed-ups in the options row, preview names the saving, campus H100e,
// what sets the dates and the opposition odds; Red River marker → 1.0 GW; site rows under the chart (campus rows show
// their buildings filling in).
// Shown state: Gas, 5 × 1 GW, no speed-ups (DATACENTERS.md §5b worked example: $74.5B, live +12…+16 q).
// window.DC_TIPS = true opens the Buildings tooltip (locked) and the Grid tile tooltip (size cap).
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
  .dc-gl .cp.bind { color: var(--watch); }
  .dc-sz { color: var(--text-3); font-size: 11px; }
  .dc-bld { display: flex; align-items: center; gap: 8px; margin: 6px 0 2px; font-size: 12px; padding: 2px 0; }
  .dc-bld .seg-btn { font-family: var(--mono); padding: 1px 10px; }
  .dc-bld .num { font-family: var(--mono); }
  .dcs .card2-hd { margin-bottom: 4px; }
  .dcs-row { display: grid; grid-template-columns: 150px 92px minmax(0,1fr) 104px 286px; gap: 10px; align-items: center; font-size: 12.5px; min-height: 30px; padding: 0 4px; border-top: 1px solid var(--line); }
  .dcs-row.ax { border: 0; min-height: 18px; }
  .dcs-name { display: flex; gap: 6px; align-items: center; white-space: nowrap; color: #fff; }
  .dcs-name .dim { font-size: 11.5px; }
  .dcs-mw { display: flex; justify-content: flex-end; align-items: center; gap: 6px; color: #fff; font-family: var(--mono); white-space: nowrap; }
  .dcs-bl { display: inline-flex; gap: 2px; }
  .dcs-bl i { width: 6px; height: 11px; border-radius: 1px; background: var(--line-2); }
  .dcs-bl i.on { background: var(--good); }
  .dcs-tr { position: relative; height: 20px; }
  .dcs-tr i { position: absolute; height: 7px; border-radius: 2px; }
  .dcs-tr i.t { top: 2px; } .dcs-tr i.b { top: 11px; } .dcs-tr i.f { top: 2px; height: 16px; }
  .dcs-tr i.pl { background-image: repeating-linear-gradient(135deg, transparent 0 3px, rgba(13,17,23,.75) 3px 6px) !important; }
  .dcs-tr .nl { position: absolute; top: -6px; bottom: -6px; width: 1px; background: rgba(255,255,255,.35); }
  .dcs-tr .lv { position: absolute; top: 3px; width: 9px; height: 14px; margin-left: -4px; background: var(--good); clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); }
  .dcs-tr .lv.rk { background: none; border: 0; box-shadow: inset 0 0 0 2px var(--good); }
  .dcs-tr .tk { position: absolute; top: 0; transform: translateX(-50%); font: 10.5px var(--mono); color: var(--text-3); }
  .dcs-tr .tk.now { color: #fff; font: 600 10.5px var(--sans); }
  .dcs-lv { font-family: var(--mono); color: #fff; white-space: nowrap; }
  .dcs-st { display: flex; gap: 6px; align-items: center; white-space: nowrap; color: var(--text-2); }
  .dcs-leg { display: flex; gap: 14px; font-size: 11.5px; color: var(--text-2); padding: 6px 4px 0 266px; align-items: center; }
  .dcs-leg i { display: inline-block; width: 14px; height: 7px; border-radius: 2px; margin-right: 5px; }
  .dcs-leg i.dm { width: 9px; height: 12px; border-radius: 0; background: var(--good); clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); vertical-align: -2px; }
  .dc-pill { display: inline-flex; gap: 4px; align-items: center; padding: 0 6px; border-radius: 9px; font-size: 11.5px; font-weight: 600; border: 1px solid rgba(239,107,107,.45); color: var(--bad); background: rgba(239,107,107,.12); }
  .dc-tip { position: absolute; z-index: 1000; }
  .dc-tip .tipcard { width: 100%; }
  .dc-gt { display: block; margin: 4px 0 2px; }
  .tipcard-row.sub > span { color: var(--text-3); font-size: 11.5px; padding-left: 10px; }
  .tipcard-row.sum { border-top: 1px solid var(--line); padding-top: 3px; margin-top: 2px; font-weight: 600; color: #fff; }
  .dc-hov { box-shadow: 0 0 0 2px var(--accent) !important; border-radius: 6px; }
  `;
  document.head.appendChild(css);

  // ── tabs: Overview · Orders & market ──
  $$('[data-tab=sites]').forEach((t) => t.remove());

  // ── Build data centre ──
  const card = $('#ctl-sites');
  // size = one building: 100 MW · 300 MW · 1 GW (construction 9.5 q × GW^0.4)
  const sizes = $('.cac-tiles', card);
  ['large', 'multi'].forEach((id) => $(`[data-opt=site-${id}]`, card).parentElement.remove());
  sizes.classList.replace('c5', 'c3');
  [['hall', '100 MW', '4 q to build'], ['building', '300 MW', '6 q to build'], ['campus', '1 GW', '10 q to build']].forEach(([id, l, g]) => {
    const b = $(`[data-opt=site-${id}]`, card);
    $('.otile-top span', b).textContent = l;
    $('.otile-gl', b).innerHTML = `<span class="dc-sz">${g}</span>`;
  });
  // Buildings 1 · 3 · 5 (hidden for Rent)
  sizes.insertAdjacentHTML('afterend', `<div class="dc-bld" id="dc-bld"><span class="term"><span>Buildings</span></span>
    <span class="seg"><button class="seg-btn">1</button><button class="seg-btn">3</button><button class="seg-btn active">5</button></span>
    <b class="num tone-pos">−15%</b><span class="sp" style="flex:1"></span><span class="num dim">5 × 1 GW =</span><b class="num" style="color:#fff">5 GW</b></div>`);

  const lease = $('[data-opt=path-lease]', card).parentElement, grid = $('[data-opt=path-grid]', card).parentElement, gas = $('[data-opt=path-gas]', card).parentElement;
  const row = lease.parentElement;
  [$('[data-opt=path-brownfield]', card).parentElement, $('[data-opt=path-nuclear]', card).parentElement].forEach((e) => e.remove());
  row.append(lease, grid, gas); row.classList.replace('c5', 'c3');
  const tile = (w, label, live, l2) => {
    const b = w.querySelector('button');
    $('.otile-top span:last-child', b).textContent = label;
    $('.otile-gl', b).innerHTML = `<span class="dc-gl"><b>${live}</b><span>${l2}</span></span>`;
  };
  tile(lease, 'Rent', 'Q3 27', '<span class="cp">≤ 1 GW</span>');
  tile(grid, 'Grid', 'Q4 31', '<span class="bd">+0–3q</span> <span class="cp bind">· 1 × 1 GW</span>');
  tile(gas, 'Gas', 'Q3 29 → Q3 30', '<span class="bd">+0–3q</span> <span class="cp">· ≤ 5 GW</span>');
  grid.querySelector('button').id = 'dc-grid';
  $('[data-opt=path-gas]', card).classList.add('on'); $('[data-opt=path-grid]', card).classList.remove('on');

  const pay = $$('[data-test=pay-pv]', card);
  pay[0].textContent = 'PV $66.0B'; pay[0].nextElementSibling.textContent = '$74.5B total';
  pay[1].textContent = 'PV $70.8B'; pay[1].nextElementSibling.textContent = '$121.4B total';
  const lines = $('.cac-lines', card);
  lines.children[0].innerHTML = `<span class="cac-line"><span class="dim">capex on the build schedule</span> <b class="num tone-neg">−$74.5B</b> <span class="dim">· repeat design saves</span> <b class="num tone-pos">$10.5B</b></span>`;
  lines.children[1].innerHTML = `<span class="cac-line"><span class="dim">racks for</span> <b class="num tone-pos">+7.0M H100e</b> <span class="dim">· 1.4M per <span class="term"><span>building</span></span> live · <span class="term"><span>construction</span></span> sets the dates</span></span>`;
  lines.insertAdjacentHTML('beforeend', `<span id="dc-risk"><span class="cac-line"><span class="dim"><span class="term"><span>opposition</span></span> decides Q1 27</span> <b class="num tone-warn">block 12% · delay 30%</b></span></span>`);
  const ba = $('.cac-ba', card); $$('.num', ba)[0].innerHTML = '$51.7B → <b>$48.0B</b>'; $$('.num', ba)[1].innerHTML = '8q+ → <b class="tone-warn">6q</b>';
  const lim = $('[data-limit="site.mw"]', card); [...lim.childNodes].filter((n) => n.nodeType === 3).forEach((n) => n.remove()); lim.append('100 MW–5 GW');
  const opts = $('.cac-opts', card);
  const tg = (on, term, rest) => `<button class="toggle ${on ? 'on' : ''}"><span class="toggle-knob"></span><span class="toggle-label"><span class="term"><span>${term}</span></span> · ${rest}</span></button>`;
  [...opts.querySelectorAll('.toggle')].forEach((t) => t.remove());
  opts.insertAdjacentHTML('afterbegin',
    tg(false, 'Crash construction', '−1 to −5 q, +$20.8B, odds up') +
    tg(false, 'Rush power', '0 q, +$4.5B') +
    tg(false, 'Fast-track permits', '−1 q, +$3.0B') +
    tg(false, 'Community package', 'block ×0.5, +$5.0B'));

  // ── chart marker: Red River under the 1 GW grid cap ──
  $$('.cfc svg text').forEach((t) => { if (t.textContent.includes('Red River')) t.textContent = t.textContent.replace('2.0 GW', '1.0 GW'); });

  // ── site rows under the chart ──
  const Q0 = 0, Q1 = 21, NOW = 6.4; // Q1 25 .. Q2 30; today Aug 5, 2026
  const X = (q) => `${((q - Q0) / (Q1 - Q0)) * 100}%`, W = (a, b) => `${((b - a) / (Q1 - Q0)) * 100}%`;
  const qL = (i) => `Q${(i % 4) + 1} ${25 + Math.floor(i / 4)}`;
  const COL = { perm: '#8a9bb0', cons: '#3a8ae0', pow: '#e9b44c', live: 'rgba(76,195,138,.55)' };
  const seg = (cls, a, b, c) => (a < NOW ? `<i class="${cls}" style="left:${X(a)};width:${W(a, Math.min(b, NOW))};background:${c}"></i>` : '') + (b > NOW ? `<i class="${cls} pl" style="left:${X(Math.max(a, NOW))};width:${W(Math.max(a, NOW), b)};background:${c}"></i>` : '');
  const blocks = (n, on) => `<span class="dcs-bl">${Array.from({ length: n }, (_, i) => `<i class="${i < on ? 'on' : ''}"></i>`).join('')}</span>`;
  const S = [
    { n: 'Abilene North', p: 'rent', mw: '300 MW', live: true, since: 'Q1 24' },
    { n: 'Abilene South', p: 'grid', mw: '300 MW', live: true, since: 'Q3 24' },
    // gas campus 5 × 300 MW: power Q4 25, buildings live Q4 25 … Q4 26 one per quarter; 4 of 5 live today
    { n: 'Lone Pine', p: 'gas', mw: '1.5 GW', bl: [5, 4], camp: [3, 4, 5, 6, 7] },
    // gas campus 3 × 300 MW in permits: turbines (9 q) bind, all three go live together Q2 29
    { n: 'Mesa Verde', p: 'gas', mw: '0.9 GW', bl: [3, 0], perm: [6, 8], cons: [11, 17], pow: [8, 17], at: 17, risk: true },
    { n: 'Red River', p: 'grid', mw: '1.0 GW', perm: [1, 2], cons: [11, 19], pow: [2, 19], at: 19, st: 'Waiting for grid', sub: 'build from Q4 27' },
  ];
  const ticks = [4, 8, 12, 16, 20].map((q) => `<span class="tk" style="left:${X(q)}">${2025 + q / 4}</span>`).join('') + `<span class="tk now" style="left:${X(NOW)}">today</span>`;
  const rows = S.map((s) => {
    let tr = `<span class="nl" style="left:${X(NOW)}"></span>`, st, lv = '';
    if (s.live) { tr += `<i class="f" style="left:0;width:100%;background:${COL.live}"></i>`; st = `<span class="tone-pos">live</span><span class="dim">since ${s.since}</span>`; }
    else if (s.camp) {
      const a = s.camp[0], z = s.camp[s.camp.length - 1];
      tr += seg('t', Q0, z, COL.cons) + `<i class="b" style="left:0;width:${W(0, a)};background:${COL.pow}"></i>` + `<i class="b" style="left:${X(a)};width:${W(a, z)};background:${COL.live}"></i>` + `<i class="f" style="left:${X(z)};width:${W(z, Q1)};background:${COL.live}"></i>`;
      tr += s.camp.map((q) => `<span class="lv ${q > NOW ? 'rk' : ''}" style="left:${X(q)}"></span>`).join('');
      lv = `${qL(a)} → ${qL(z)}`;
      st = `<span class="tone-pos">${s.bl[1]} of ${s.bl[0]} live</span><span class="dim">1 in construction</span>`;
    } else {
      tr += seg('f', s.perm[0], s.perm[1], COL.perm) + seg('t', s.cons[0], s.cons[1], COL.cons) + seg('b', s.pow[0], s.pow[1], COL.pow) + `<span class="lv ${s.risk ? 'rk' : ''}" style="left:${X(s.at)}"></span>`;
      lv = qL(s.at);
      st = s.risk ? `<span class="term"><span>Permits</span></span><span class="dc-pill">block 12%</span><span class="act-wrap"><span class="act-col"><button class="btn btn-sm act-btn"><span>Community package · $0.9B</span></button></span></span>`
        : `<span class="term"><span>${s.st}</span></span><span class="dim">${s.sub}</span>`;
    }
    const dot = s.live || s.camp ? 'var(--good)' : s.risk ? '#8a9bb0' : 'var(--watch)';
    return `<div class="dcs-row"><span class="dcs-name"><span class="dot" style="background:${dot}"></span>${s.n}<span class="dim">${s.p}</span></span><span class="dcs-mw">${s.bl ? blocks(...s.bl) : ''}${s.mw}</span><span class="dcs-tr">${tr}</span><span class="dcs-lv">${lv}</span><span class="dcs-st">${st}</span></div>`;
  }).join('');
  $('.cmp-main').insertAdjacentHTML('beforeend', `
  <section class="card2 dcs" data-home="sites">
    <div class="card2-hd"><span class="card2-ttl"><span class="term"><span>Sites</span></span></span><span class="sp"></span>
      <span class="row-i small"><span class="dim">racks used / live</span><span style="display:inline-block;width:110px;height:8px;border-radius:4px;background:var(--line);position:relative"><i style="position:absolute;left:0;top:0;bottom:0;width:61%;border-radius:4px;background:var(--good)"></i></span><b class="num">1.1 GW / 1.8 GW</b></span></div>
    <div class="dcs-row ax"><span></span><span></span><span class="dcs-tr">${ticks}</span><span class="dim small">live</span><span></span></div>
    ${rows}
    <div class="dcs-leg"><span><i style="background:${COL.perm}"></i>permits</span><span><i style="background:${COL.cons}"></i>construction</span><span><i style="background:${COL.pow}"></i>power</span><span><i style="background:${COL.live}"></i>live</span><span><i class="dm"></i><span class="term"><span>building</span></span> live</span><span><i style="background:#3a8ae0;background-image:repeating-linear-gradient(135deg,transparent 0 3px,rgba(13,17,23,.75) 3px 6px)"></i>planned</span></div>
  </section>`);

  if (!window.DC_TIPS) return;
  const tipAt = (anchor, html, left, top, w) => {
    anchor.classList.add('dc-hov');
    document.body.insertAdjacentHTML('beforeend', `<div class="tip dc-tip" style="left:${left}px;top:${top}px;width:${w}px">${html}</div>`);
  };
  const R = (a, b, cls = '') => `<div class="tipcard-row ${cls}"><span>${a}</span><span>${b}</span></div>`;
  const T = (t) => `<span class="term"><span>${t}</span></span>`;
  // campus schedule: quarters from commitment (Q3 26 = 0). Permits 0–2, turbines 2–11, building k built 2+k → 12+k.
  const gw = 394, lx = 62, rx = 76, pw = gw - lx - rx, NQ = 18, xq = (q) => lx + (q / NQ) * pw, rh = 15;
  const qn = (q) => { const i = 2 + q; return `Q${(i % 4) + 1} ${26 + Math.floor(i / 4)}`; };
  const gl = [['Permits', 0, 2, COL.perm, ''], ['Power', 2, 11, COL.pow, qn(11)], ...[0, 1, 2, 3, 4].map((k) => [`Building ${k + 1}`, 2 + k, 12 + k, COL.cons, qn(12 + k)])];
  const gh = gl.length * rh + 18;
  const gantt = `<svg class="dc-gt" width="${gw}" height="${gh}">
    ${[0, 4, 8, 12, 16].map((q) => `<line x1="${xq(q)}" x2="${xq(q)}" y1="0" y2="${gh - 14}" stroke="#243041"/><text x="${xq(q)}" y="${gh - 3}" fill="#7d8a9c" font-size="10" font-family="var(--mono)" text-anchor="middle">${qn(q)}</text>`).join('')}
    ${gl.map(([l, a, b, c, d], i) => { const y = i * rh + 2; const bld = l.startsWith('B');
      return `<text x="0" y="${y + 10}" fill="#aab4c2" font-size="11" font-family="var(--sans)">${l}</text><rect x="${xq(a)}" y="${y + 2}" width="${xq(b) - xq(a)}" height="8" rx="2" fill="${c}"/>`
        + (bld ? `<path d="M${xq(b)} ${y} l5 6 l-5 6 l-5 -6z" fill="#4cc38a"/><text x="${gw}" y="${y + 10}" fill="#fff" font-size="10.5" font-family="var(--mono)" text-anchor="end">${d} +1.4M</text>` : d ? `<text x="${gw}" y="${y + 10}" fill="#7d8a9c" font-size="10.5" font-family="var(--mono)" text-anchor="end">ready ${d}</text>` : ''); }).join('')}
  </svg>`;
  const bld = $('#dc-bld').getBoundingClientRect(), cardL = card.getBoundingClientRect().left;
  tipAt($('#dc-bld'), `<div class="tipcard">
    <div class="tipcard-head"><span class="tipcard-title">${T('Buildings')}</span><span class="tipcard-value">5 × 1 GW = 5 GW</span></div>
    <div class="tipcard-body">Copies of one building on one ${T('site')}. They start one per quarter and go live one by one as each is finished, or all together when power arrives later.</div>
    <div class="tipcard-rows" style="display:block">${gantt}</div>
    <div class="tipcard-rows">
      ${R('Building · 5 × $14.0B', '$70.0B')}
      ${R(T('Repeat design') + ' · 5 buildings', '−15% · −$10.5B', 'sub')}
      ${R('Turbines · 5 × $3.0B', '$15.0B')}
      ${R('Upfront', '$74.5B', 'sum')}
    </div>
    <div class="tipcard-rows">
      ${R('Saving by count', '1: 0% · 3: −10% · 5: −15%')}
      ${R('Shared', `${T('permit')} · ${T('opposition')} roll · ${T('power')} connection`)}
      ${R('Largest campus', 'grid 1 GW · gas 5 GW')}
      ${R('Grid · 3 × 300 MW', 'all live Q4 31: power is slower', 'sub')}
    </div>
    <div class="tipcard-foot">A block stops every building; money paid so far is lost.</div>
  </div><div class="tip-lockbar" style="width:100%"></div>`, cardL - 432, bld.top - 410, 420);
  const gr = $('#dc-grid').getBoundingClientRect();
  tipAt($('#dc-grid'), `<div class="tipcard">
    <div class="tipcard-head"><span class="tipcard-title">${T('Grid')}</span><span class="tipcard-value">live Q4 31 · +0–3q</span></div>
    <div class="tipcard-body">Grid sites take up to 1 GW: choosing Grid cuts this campus to 1 × 1 GW.</div>
    <div class="tipcard-rows">
      ${R(T('Permits'), '1 q')}
      ${R(T('Grid wait') + ' today', '20 q')}
      ${R(T('Construction'), '10 q, timed to end with power')}
      ${R('Live', '1 + 20 = 21 q · Q4 31', 'sum')}
      ${R('Fits on grid', '1 × 1 GW · 3 × 300 MW · 5 × 100 MW')}
    </div>
  </div>`, cardL - 432, gr.top + 52, 420);
})();
