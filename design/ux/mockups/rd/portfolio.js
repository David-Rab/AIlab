// RESEARCH › Portfolio (UI-IA §1 Portfolio): Limited-by strip · one board, two columns, one card grammar.
// State "#drawer" opens one card's L2 drill-down. Data: window.D.res (data.js).
(function () {
  const R = window.D.res;
  const ic = (n, c = '') => `<svg class="i ${c}"><use href="#i-${n}"/></svg>`;
  const STAGES = { programme: ['Ideas', 'Small test', 'Big test', 'Build-in'], project: ['Test', 'Build-in'], safety: ['Ideas', 'Small test', 'Big test', 'Validate'] };
  const track = (c) => {
    const st = STAGES[c.track];
    return `<div class="track">${st.map((s, i) => `<div class="stg ${i < c.stage ? 'done' : i === c.stage ? 'cur' : ''}"><div class="bb"><i style="width:${i < c.stage ? 100 : i === c.stage ? c.prog * 100 : 0}%"></i></div><div class="sl">${s}</div></div>`).join('')}</div>`;
  };
  const pips = (n, want) => `<span class="pips">${Array.from({ length: Math.max(n, want) }, (_, i) => `<i class="${i >= n ? 'w' : ''}"></i>`).join('')}</span>`;
  const card = (c, i) => `
    <div class="pc s-${c.side} ${c.sel ? 'sel' : ''} ${c.dim ? 'dim' : ''} ${c.failed ? 'failed' : ''}">
      <div class="r1">
        <span class="pr">${i + 1}</span>
        <span class="t3">${ic(c.icon, 's14')}</span>
        <span class="nm">${c.name}</span>
        <span class="kind">${c.kind}</span>
        ${c.out !== 'capability' ? `<span class="otag ${c.out}">${c.out}</span>` : ''}
        <span class="fld">${c.field}</span>
        <div class="sp"></div>
        ${c.ret ? `<span class="retp">${c.ret}</span>` : ''}
        ${c.lim ? `<span class="plim">${ic('triangle-alert', 's12')} limited by ${c.lim}</span>` : ''}
        <span class="teams">${c.teams ? pips(c.teams, c.wanted) + ` ${c.teams} team${c.teams > 1 ? 's' : ''}` : `${pips(0, c.wanted || 1)} <span class="${c.dim ? 'warn' : ''}">no team</span>`}</span>
      </div>
      ${c.failed ? `<div class="r2"><span class="chip bad">${ic('circle-x', 's12')} Failed</span><span class="t2" style="font-size:13px">${c.failed}</span><div class="sp"></div><span class="btn">Retry</span></div>` : `
      <div class="r2">
        ${track(c)}
        <span class="eta">${c.eta ? `next result <b>~${c.eta} d</b>` : '<span class="t3">waits for a team</span>'}</span>
        <span class="eff">${c.eff}</span>
        <span class="odds">${c.odds}</span>
      </div>`}
    </div>`;
  const cap = R.cards.filter((c) => c.side === 'cap'), saf = R.cards.filter((c) => c.side === 'saf');
  const LIM = [['cpu', 'Compute'], ['test-tube-diagonal', 'Research engineers'], ['telescope', 'Scientists'], ['lightbulb', 'Idea quality']];
  const main = document.getElementById('main');
  main.innerHTML = `
  <div class="ph">
    <h1>${ic('flask-conical', 's22')} Research</h1>
    <div class="tabs"><span class="t on">Portfolio</span><span class="t">Discoveries</span><span class="t">Know-how</span></div>
    <div class="sp"></div>
    <span class="btn">${ic('plus', 's14')} Add project</span>
  </div>
  <div class="card lim">
    <div class="lh"><div class="ttl">${ic('gauge', 's18')} <u>Limited by</u></div><div class="t3" style="font-size:12.5px">what would speed research most</div></div>
    ${LIM.map(([icn, nm], k) => {
      const v = R.limited[k];
      return `<div class="seg ${v.cls}"><span class="si">${ic(icn, 's18')}</span><div><div class="nm">${nm}</div><div class="vd">${v.word}</div></div>${v.cls === 'on' ? `<div class="sp"></div><span class="link sm">best move ${ic('chevron-right', 's12')}</span>` : ''}</div>`;
    }).join('')}
  </div>
  <div class="sbar">
    <span class="t3" style="font-size:12.5px"><u>Science teams</u></span>
    <span style="color:var(--cap);font-weight:650;font-size:13px">Capability <span class="n">${R.teams[0]}</span></span>
    <div class="b"><div style="flex:${R.teams[0]} 0 0;background:var(--cap)"></div><div style="flex:${R.teams[1]} 0 0;background:var(--saf)"></div></div>
    <span style="color:var(--saf);font-weight:650;font-size:13px"><span class="n">${R.teams[1]}</span> Safety</span>
    <span class="link sm">scientists ${ic('chevron-right', 's12')}</span>
  </div>
  <div class="board">
    <div class="colm">
      <div class="ch"><span class="tt" style="color:var(--cap)">${ic('brain', 's18')} Capability</span><span class="st">${R.capSub}</span><div class="sp"></div><span class="t3" style="font-size:12px">priority order · drag to change</span></div>
      ${cap.map(card).join('')}
    </div>
    <div class="colm">
      <div class="ch"><span class="tt" style="color:var(--saf)">${ic('microscope', 's18')} Safety</span><span class="st">${R.safSub}</span><div class="sp"></div>${R.safLink ? `<span class="link sm">${R.safLink} ${ic('chevron-right', 's12')}</span>` : ''}</div>
      ${saf.map(card).join('')}
      <div class="more">${ic('chevron-down', 's14')} ${R.safMore.n} more programmes, no team <span class="t3">·</span> <span class="olk Mixed">Mixed</span> <span class="n">${R.safMore.mixed}</span> <span class="olk Struggling">Struggling</span> <span class="n">${R.safMore.struggling}</span></div>
    </div>
  </div>`;

  if (location.hash === '#drawer') {
    const d = R.drawer;
    main.insertAdjacentHTML('beforeend', `<div class="scrim"></div><div class="drawer">${d}</div>`);
  }
})();
