// PRODUCTS (market redesign M1, M6, M9, M12, M13). L1 #1: totals strip (profit, serving compute, share of business buyers).
// L1 #2: one card per product, same scale, profit first. #swap: lineup popover on Enterprise › Atlas-3.0-mini.
(function () {
  const M = window.MKT, SK = window.SKILL;
  const ic = (n, c = '') => `<svg class="i ${c}"><use href="#i-${n}"/></svg>`;
  const swap = location.hash === '#swap';
  const MAXR = 56; // common $B/yr scale for every card's revenue bar
  const money = (v) => (v >= 10 ? `$${v.toFixed(1)}B` : v >= 1 ? `$${v.toFixed(2)}B` : `$${v.toFixed(2)}B`);

  const strip = `
  <div class="card strip">
    <div class="blk">
      <div class="cap"><u>Profit</u> from products</div>
      <div class="big">$${M.total.profit.toFixed(1)}B<span class="u">/yr</span></div>
      <div class="t3" style="font-size:12.5px">revenue <span class="n t2">$${M.total.revenue.toFixed(1)}B</span> − <u>serving cost</u> <span class="n t2">$${M.total.cost.toFixed(1)}B</span></div>
    </div>
    <div class="blk wide">
      <div class="row"><span class="cap"><u>Serving compute</u></span><span class="sp"></span><span class="link sm">${ic('server', 's12')} Compute ${ic('chevron-right', 's12')}</span></div>
      <div class="row" style="gap:10px;align-items:baseline"><span class="n w" style="font-size:20px;font-weight:650">${M.pool.served}</span><span class="t2">of ${M.pool.need} <u>H100e</u> needed</span><span class="sp"></span><span class="chip warn">${ic('triangle-alert', 's12')} short ${M.pool.short}</span></div>
      <div class="cbar big2"><i style="width:${M.pool.pct}%"></i></div>
      <div class="t3" style="font-size:12.5px">Buyers <u>turned away</u> <span class="n t2">$${M.pool.away.toFixed(1)}B/yr</span></div>
    </div>
    <div class="blk wide">
      <div class="row"><span class="cap">Business buyers</span><span class="sp"></span><span class="t3" style="font-size:12.5px">your <u>share</u> of their AI spend</span></div>
      <div class="trk">
        <div class="ax"></div>
        <div class="arr" style="left:${M.share.tgt * 2}%;width:${(M.share.now - M.share.tgt) * 2}%"></div>
        <div class="tgt" style="left:${M.share.tgt * 2}%"></div>
        <div class="rv" style="left:${M.share.rv * 2}%"></div>
        <div class="now" style="left:${M.share.now * 2}%"></div>
        ${[0, 25, 50].map((t) => `<span class="tl2" style="left:${t * 2}%">${t}%</span>`).join('')}
      </div>
      <div class="row" style="gap:8px;font-size:13px"><b class="n w">${M.share.now}%</b><span class="dn">→ ${M.share.tgt}%</span><span class="t3">in ${M.share.time}</span><span class="sp"></span><span style="color:var(--rival)">▼</span><span class="t2">${M.share.rival} ${M.share.rv}%</span></div>
    </div>
  </div>`;

  const lineupRows = (p) => {
    const chat = p.id === 'chat';
    const hd = `<div class="lu hd2"><span></span><span>model</span><span><u>skill</u></span><span>${chat ? 'serves' : '<u>hours sold</u>'}</span></div>`;
    const rows = p.lineup.map((m, i) => {
      const sel = swap && p.id === M.swap.product && m.name === M.swap.model;
      const dead = !chat && m.share === 0;
      return `<div class="lu row-m ${sel ? 'sel' : ''} ${dead ? 'dead' : ''}" ${sel ? 'id="selrow"' : ''}>
        <span class="ro">${i === 0 ? '1' : i + 1}</span>
        <span class="mn">${m.name}${i === 0 ? ' <span class="mtag">main</span>' : ''}</span>
        <span class="sk"><i style="width:${SK[m.name]}%"></i></span>
        ${chat ? `<span class="t2" style="font-size:12.5px">${m.serves}</span>`
          : dead ? `<span class="t3" style="font-size:12.5px">sells nothing</span>`
          : `<span class="row" style="gap:6px"><span class="hb" style="flex:1"><i style="width:${m.share}%"></i></span><span class="pc">${m.share}%</span></span>`}
      </div>`;
    }).join('');
    return hd + rows + `<div class="addm">${ic('plus', 's14')} Add a model <span class="t3">· ${p.more2} you could add</span></div>`;
  };

  const card = (p) => {
    const w = (v) => Math.max(0.6, (v / MAXR) * 100);
    const short = p.pct < 99.5;
    return `
    <div class="card pcard ${swap && p.id === M.swap.product ? 'focus' : ''}">
      <div class="ph2">
        <span class="pi">${ic(p.icon, 's18')}</span>
        <div style="min-width:0"><div class="pn">${p.name}</div><div class="who">${ic('users', 's12')} ${p.sells}</div></div>
      </div>

      <div class="pf">
        <div class="row" style="align-items:baseline;gap:8px"><span class="cap"><u>Profit</u></span><span class="sp"></span><span class="t3" style="font-size:12.5px"><u>margin</u> <b class="n t2">${p.margin}%</b></span></div>
        <div class="pbig">${money(p.profit)}<span class="u">/yr</span></div>
        <div class="rbar"><i class="pr" style="width:${w(p.profit)}%"></i><i class="co" style="left:${w(p.profit)}%;width:${(p.cost / MAXR) * 100}%"></i></div>
        <div class="rlbl"><span><i class="sw pr"></i>revenue <b class="n t2">${money(p.revenue)}</b></span><span><i class="sw co"></i><u>serving cost</u> <b class="n t2">${money(p.cost)}</b></span></div>
      </div>

      <div class="kv3">
        <div><div class="k"><u>${p.id === 'chat' ? 'Users' : 'Work sold'}</u></div><div class="v">${p.cust[0]}</div><div class="s">${p.cust[1]}</div></div>
        <div><div class="k"><u>Price</u></div><div class="v">${p.price}</div><div class="s">${p.per}${p.atCap ? ' · <u>at the cap</u>' : ''}</div></div>
      </div>

      <div class="sec2">
        <div class="sh"><span class="cap"><u>Serving compute</u></span><span class="sp"></span><span class="t3" style="font-size:12.5px"><span class="n t2">${p.served}</span> of ${p.need} needed</span></div>
        <div class="cbar"><i style="width:${p.pct}%"></i></div>
        ${p.freeLimited ? `<div class="away">${ic('timer', 's14')} <u>Free users rate-limited</u> <span class="t3">· paying users all served</span></div>`
          : short ? `<div class="away">${ic('door-open', 's14')} <span class="n">${p.away}/yr</span> of buyers <u>turned away</u></div>` : ''}
      </div>

      <div class="setrow"><span class="k"><u>Price stance</u></span>
        <span class="seg3"><span class="${p.stance === 'profit' ? 'on' : ''}">${ic('trending-up', 's12')} Best profit</span><span class="${p.stance === 'share' ? 'on' : ''}">${ic('users', 's12')} Win share</span></span>
      </div>

      <div class="sec2"><div class="sh"><span class="cap"><u>Lineup</u></span><span class="sp"></span><span class="t3" style="font-size:12px">${p.id === 'chat' ? '' : 'buyers pick per task'}</span></div>${lineupRows(p)}</div>

      <div class="sec2"><div class="sh"><span class="cap"><u>Tools</u></span></div>
        <div class="tools">
          ${p.tools.map(([n, i, cert]) => `<span class="tool">${ic(i, 's14')}<u>${n}</u>${cert ? `<span class="cert" >${ic('badge-check', 's12')}${cert}</span>` : ''}</span>`).join('')}
          <span class="tool add">${ic('plus', 's14')} Add a tool <span class="t3">· ${p.more} more fit</span></span>
        </div>
      </div>

      <div class="pfoot">
        <span class="link sm">${ic('users', 's12')} ${p.id === 'chat' ? 'Users' : 'Customers by sector'} ${ic('chevron-right', 's12')}</span>
        <span class="link sm">${ic('shield', 's12')} Safeguards ${ic('chevron-right', 's12')}</span>
        ${p.terms ? `<span class="link sm">${ic('scroll-text', 's12')} Usage terms ${ic('chevron-right', 's12')}</span>` : ''}
      </div>
    </div>`;
  };

  const pop = () => {
    const S = M.swap;
    const row = (o) => `
      <div class="po">
        <span class="mn">${o.name}${o.tag ? ` <span class="chip good" style="padding:0 6px;font-size:11px">${o.tag}</span>` : ''}</span>
        <span class="sk"><i style="width:${SK[o.name]}%"></i><b style="left:${SK[S.model]}%"></b></span>
        <span class="n t2">${o.cost}</span>
        <span class="n ${o.profit[0] === '+' ? 'good' : 'bad'}">${o.profit}</span>
        <span class="n ${o.hours[0] === '+' ? 'good' : 'bad'}">${o.hours}</span>
        <span class="n ${o.compute[0] === '−' ? 'good' : 'bad'}">${o.compute}</span>
      </div>${o.note ? `<div class="pnote">${ic('circle-check', 's12')} ${o.note}</div>` : ''}`;
    return `
    <div class="pop" id="pop">
      <div class="phd"><span class="w" style="font-weight:650">Replace ${S.model}</span><span class="sp"></span><span class="t3" style="font-size:12px">change per year</span><svg class="i s14 t3"><use href="#i-x"/></svg></div>
      <div class="po hd3"><span>model</span><span><u>skill</u></span><span><u>cost to serve</u></span><span><u>profit</u></span><span><u>hours sold</u></span><span><u>compute need</u></span></div>
      ${S.opts.map((o, i) => (i === 0 ? row(o).replace('<div class="po">', '<div class="po hov">') : row(o))).join('')}
      <div class="po rm">
        <span class="mn bad">${ic('trash-2', 's14')} Remove from lineup</span><span></span><span></span>
        <span class="n bad">${S.remove.profit}</span><span class="n bad">${S.remove.hours}</span><span class="n bad">${S.remove.compute}</span>
      </div>
    </div>`;
  };

  document.getElementById('main').innerHTML = `
  <div class="ph"><h1>${ic('boxes', 's22')} Products</h1><div class="sp"></div></div>
  ${strip}
  <div class="cards">${['chat', 'api', 'ent', 'vet'].map((id) => card(M.products.find((p) => p.id === id))).join('')}</div>
  ${swap ? pop() : ''}`;

  if (swap) {
    const r = document.getElementById('selrow').getBoundingClientRect();
    const mr = document.getElementById('main').getBoundingClientRect();
    const p = document.getElementById('pop');
    p.style.left = `${r.left - mr.left - p.offsetWidth - 16}px`;
    p.style.top = `${r.top - mr.top - 60}px`;
  }
})();
