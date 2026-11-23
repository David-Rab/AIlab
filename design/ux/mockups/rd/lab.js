// LAB screen: allocation bar · workforce board · best moves (UI-IA §1 LAB). Data: window.D.lab (data.js).
// State "#tip" shows the locked research-speed tooltip with a nested child tooltip.
(function () {
  const L = window.D.lab;
  const ic = (n, c = '') => `<svg class="i ${c}"><use href="#i-${n}"/></svg>`;
  const qp = (q) => `<span class="qp">${[1, 2, 3].map((k) => `<i class="${k <= q ? 'on' : ''}"></i>`).join('')}</span>`;
  const COL = { cap: ['#9b6be0', '#8558cc', '#7a52b8', '#b48cf0', '#a07ce6', '#9470dc'], saf: ['#2fb3a3', '#22a394', '#1a8a7d'], prod: ['#b08e1a'] };
  const GROUP = { cap: ['Capability', 'var(--cap)'], saf: ['Safety', 'var(--saf)'], prod: ['Products', 'var(--prod)'] };
  const segs = L.alloc.segs;
  const ci = { cap: 0, saf: 0, prod: 0 };
  segs.forEach((s) => (s.c = COL[s.group][ci[s.group]++ % COL[s.group].length]));

  const segHtml = (s, inLens) => {
    const usedW = s.pct ? (1 - s.idle / s.pct) * 100 : 0;
    const flex = inLens ? Math.max(s.pct, 0.35) : s.pct;
    if (!s.pct) return `<div class="s empty" style="flex:${flex} 0 0"></div>`;
    return `<div class="s ${s.ai ? 'ai' : ''}" style="flex:${flex} 0 0">
      <div class="used" style="width:${usedW}%;background:${s.c}"></div>
      <div class="idle hatch" style="width:${100 - usedW}%;background-color:${s.c}"></div>
      ${!inLens && !s.small ? `<span class="lbl2"><b>${s.short || s.name}</b><span>${s.pct}% · ${s.h}${s.idle && s.why ? ` · <span class="idw">all idle: ${s.why}</span>` : s.idle ? ` · <span class="idw">${s.idleTxt} idle</span>` : ''}</span></span>` : ''}
    </div>`;
  };
  const big = segs.map((s) => (s.small ? null : s));
  // main bar: small consecutive uses collapse into one bracketed cluster that the lens below expands
  let barHtml = '', cluster = [];
  const flush = () => { if (cluster.length) { const sum = cluster.reduce((a, s) => a + s.pct, 0); barHtml += `<div class="clu" id="clu" style="flex:${sum} 0 0">${cluster.map((s) => segHtml(s)).join('')}</div>`; cluster = []; } };
  segs.forEach((s) => { if (s.small) cluster.push(s); else { flush(); barHtml += segHtml(s); } });
  flush();
  const small = segs.filter((s) => s.small);
  const gsum = {}; segs.forEach((s) => (gsum[s.group] = (gsum[s.group] || 0) + s.pct));

  const main = document.getElementById('main');
  main.innerHTML = `
  <div class="ph">
    <h1>${ic('workflow', 's22')} Lab</h1>
    <div class="sp"></div>
    <span class="link">${ic('user-plus', 's14')} Hiring</span>
  </div>

  <div class="card alloc">
    <div class="hd">
      <span class="ttl">${ic('cpu', 's18')} <u>Compute allocation</u></span>
      <span class="link sm">of ${L.alloc.online} <u>H100e</u> online ${ic('chevron-right', 's12')}</span>
      <span class="glegend">${['cap', 'saf', 'prod'].map((g) => `<span><i style="background:${GROUP[g][1]}"></i>${GROUP[g][0]} <b class="n">${gsum[g] < 1 ? gsum[g].toFixed(1) : Math.round(gsum[g])}%</b></span>`).join('')}</span>
      <div class="sp"></div>
      <div class="idlechip">${ic('plug-zap', 's14')} <u>Idle</u> <b>${L.alloc.idlePct}%</b> <span class="n" style="color:var(--text-2)">${L.alloc.idle} H100e</span><span class="t3">·</span><span style="color:var(--text-2)"><u>Auto-split</u> ${L.alloc.autoSplit}</span></div>
    </div>
    <div class="barwrap">
      <div class="bar" id="bar">${barHtml}</div>
      <svg class="lensln" id="lensln"></svg>
      <div class="lens" id="lens">
        <div class="lgrp" id="lgrp"></div>
        <div class="lbar" id="lbar">${small.map((s) => segHtml(s, true)).join('')}</div>
        <div class="llab" id="llab">${small.map((s) => `<div><span class="${s.pct ? '' : 'zero'}">${s.ls || s.name}</span><span class="n">${s.pct ? s.pct + '% · ' + s.h : '0%'}</span></div>`).join('')}</div>
      </div>
    </div>
  </div>

  <div class="lower">
    <div class="card board">
      <div class="hd"><span class="ttl">${ic('users', 's18')} <u>Workforce</u></span>
        <div class="sp"></div>
      </div>
      <div class="wgrid" id="wgrid"></div>
    </div>
    <div class="card moves">
      <div class="hd" style="padding-bottom:8px"><span class="ttl">${ic('trending-up', 's18')} <u>Best moves</u></span><div class="sp"></div><span class="t3" style="font-size:12px">from your estimates</span></div>
      ${L.moves.map((m, i) => `
      <div class="mv ${i === 0 ? 'top' : ''}">
        <span class="rk">${i + 1}</span>
        <span style="color:${m.kind === 'hire' ? '#d9c27a' : '#cfe3ff'}">${ic(m.kind === 'hire' ? 'user-plus' : 'cpu', 's18')}</span>
        <div style="min-width:0">
          <div class="what">${m.what}</div>
          <div class="eff"><span>${m.target}</span> <b>${m.eff}</b>${m.pre ? `<span class="pre">${m.pre}</span>` : ''}</div>
          <div class="cost">${m.cost}</div>
        </div>
        <span class="btn ${i === 0 ? 'pri' : ''}">Do</span>
      </div>`).join('')}
      <div class="wont"><div class="cap" style="margin-bottom:6px">Won't help now</div>${L.wont.map((w) => `<div class="row" style="gap:7px">${ic('minus', 's12')}<span>${w}</span></div>`).join('')}</div>
    </div>
  </div>`;

  // lens: the small uses, magnified (each at least 104 px wide) + connector lines to the cluster in the main bar
  const bar = document.getElementById('bar');
  const W = bar.offsetWidth;
  const tot = small.reduce((a, x) => a + x.pct, 0), LW = 836;
  const ws = small.map((x) => Math.max(104, (x.pct / tot) * LW));
  const kk = LW / ws.reduce((a, b) => a + b, 0);
  const cols = ws.map((w) => (w * kk).toFixed(0) + 'px').join(' ');
  ['lbar', 'llab'].forEach((id) => { const e = document.getElementById(id); e.style.display = 'grid'; e.style.gridTemplateColumns = cols; e.style.gap = '2px'; });
  const nAi = small.filter((x) => x.ai).length, wAi = ws.slice(0, nAi).reduce((a, b) => a + b, 0) * kk;
  document.getElementById('lgrp').innerHTML = `<div style="width:${wAi}px">${ic('bot', 's12')} AI staff</div>`;
  const clu = document.getElementById('clu'), lens = document.getElementById('lens'), ln = document.getElementById('lensln');
  const bw = bar.getBoundingClientRect(), cr = clu.getBoundingClientRect(), lr = lens.getBoundingClientRect();
  const y1 = cr.bottom - bw.top, y2 = lr.top - bw.top;
  ln.setAttribute('width', W); ln.setAttribute('height', y2 + 2);
  ln.innerHTML = `<path d="M${cr.left - bw.left} ${y1} L${lr.left - bw.left} ${y2} M${cr.right - bw.left} ${y1} L${lr.right - bw.left} ${y2}" stroke="#5d6f88" stroke-width="1.2" stroke-dasharray="3 3" fill="none"/>`;

  // workforce: one line per role (people · AI staff · work done · short / spare); the needs list opens on click (#needs)
  const Wk = L.work;
  const ST = Wk.status;
  const needs = (c) => `
    <div class="needs">
    ${c.needs.map((n) => `<div class="nd ${n.short ? 'short' : ''} ${n.spare ? 'spare' : ''} ${!n.fill && !n.spare ? 'nil' : ''}"><span class="nm">${n.short ? ic('triangle-alert', 's12') + ' ' : ''}${n.name}</span><span class="gb"><i style="width:${Math.min(100, n.fill * 100)}%"></i></span><span class="st">${n.st}</span></div>`).join('')}
    ${c.quiet ? `<div class="t3" style="font-size:12px">${c.quiet}</div>` : ''}</div>`;
  const open = location.hash === '#needs' ? 'reSaf' : null;
  const row = (key, icon, name, c) => {
    const st = ST[key];
    return `<div class="wr ${open === key ? 'open' : ''}">
      <span class="rn">${ic(icon, 's18')}<u>${name}</u></span>
      <span class="pp"><b class="n">${c.people}</b> <span class="t3">people · ${c.teams} team${c.teams > 1 ? 's' : ''}</span> ${qp(c.q)}</span>
      <span class="ais">${c.ai ? `<span class="mchip">${ic('bot', 's12')} ${c.ai.model}</span> <span class="t3"><u>AI share</u></span> <b class="n w">${c.ai.share}</b>` : `<span class="t3">No AI staff</span>`}</span>
      <span class="wd"><span class="ebar"><span class="hp" style="flex:1 0 0"></span>${c.effortNum > 1 ? `<span class="ap" style="flex:${c.effortNum - 1} 0 0"></span>` : ''}<span style="flex:${Wk.maxEffort - c.effortNum} 0 0"></span></span><b class="n">×${c.effort}</b></span>
      <span class="stc ${st[0]}">${st[0] === 'short' ? ic('triangle-alert', 's14') : st[0] === 'spare' ? '<i class="sparesw"></i>' : ic('check', 's14')} ${st[1]}</span>
      <span class="t3">${ic(open === key ? 'chevron-down' : 'chevron-right', 's16')}</span>
    </div>
    ${open === key ? `<div class="wopen"><div class="row" style="margin-bottom:8px"><span class="cap"><u>Needs</u>, in priority order</span><span class="t3" style="font-size:12px">staff go to the top first</span><div class="sp"></div><span class="link sm">${ic('list-checks', 's12')} Change order</span></div>${needs(c)}<div class="row" style="margin-top:10px;gap:8px"><span class="t3" style="font-size:12.5px">${c.aiNote}</span><span class="link sm">AI staff ${ic('chevron-right', 's12')}</span><span class="link sm">Hiring ${ic('chevron-right', 's12')}</span></div></div>` : ''}`;
  };
  const engAll = { ...Wk.eng, needs: [...Wk.eng.needs.slice(0, 2), Wk.engSaf.needs[0], Wk.eng.needs[2], Wk.engSaf.needs[1]] };
  document.getElementById('wgrid').innerHTML = `
    <div class="wh"><span></span><span>People</span><span><u>AI staff</u></span><span><u>Work done</u> <span class="t3" style="text-transform:none;letter-spacing:0">vs the people alone</span></span><span>Short / spare</span><span></span></div>
    ${row('eng', 'wrench', 'Engineers', engAll)}
    <div class="wg" style="color:var(--cap)">${ic('brain', 's14')} Capability</div>
    ${row('reCap', 'test-tube-diagonal', 'Research engineers', Wk.reCap)}
    ${row('sciCap', 'telescope', 'Scientists', Wk.sciCap)}
    <div class="wg" style="color:var(--saf)">${ic('microscope', 's14')} Safety</div>
    ${row('reSaf', 'test-tube-diagonal', 'Research engineers', Wk.reSaf)}
    ${row('sciSaf', 'telescope', 'Scientists', Wk.sciSaf)}
    <div class="wfoot"><span class="t3">Scientists</span><div class="split">${ic('grip-vertical', 's14')}<span style="color:var(--cap)">Capability</span><div class="hbar"><div style="flex:${Wk.split[0]} 0 0;background:var(--cap);border-radius:3px 0 0 3px"></div><div style="flex:${Wk.split[1]} 0 0;background:var(--saf);border-radius:0 3px 3px 0"></div></div><span class="n w">${Wk.split[0]}</span><span class="t3">|</span><span class="n w">${Wk.split[1]}</span><span style="color:var(--saf)">Safety</span><span class="t3">teams</span></div><span class="link sm">Portfolio ${ic('chevron-right', 's12')}</span></div>
  `;

  if (location.hash === '#tip') {
    document.getElementById('st-speed').classList.add('hot');
    main.insertAdjacentHTML('beforeend', `<div class="scrim2"></div>${window.TIP_SPEED}`);
  }
})();
