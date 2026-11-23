// L0 shell (UI-IA §0): clock · navigation (badges) · alerts · cash·runway · lead·nearest · research speed · loss-of-control risk.
// Values: day-400 RefBot fixture (see DATA.md). Usage: <body data-tab="lab" data-hot="speed">.
(function () {
  const S = window.SHELL;
  const ic = (n, c = '') => `<svg class="i ${c}"><use href="#i-${n}"/></svg>`;
  const spark = (pts, w = 64, h = 22) => {
    const mn = Math.min(...pts), mx = Math.max(...pts);
    const p = pts.map((v, i) => `${(i / (pts.length - 1) * w).toFixed(1)},${(h - 2 - (v - mn) / (mx - mn || 1) * (h - 4)).toFixed(1)}`).join(' ');
    return `<svg class="spark" width="${w}" height="${h}"><polyline points="${p}" fill="none" stroke="#5aa9ff" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  };
  const tab = document.body.dataset.tab, hot = document.body.dataset.hot;
  const top = `
  <div class="top">
    <div class="seg clock">
      <div class="speeds"><div class="b">${ic('pause', 's14')}</div><div class="b on">${ic('play', 's14')}</div><div class="b">${ic('chevrons-right', 's14')}</div><div class="b">${ic('fast-forward', 's14')}</div></div>
      <div><div class="d">${S.date}</div><div class="a">Day ${S.day}</div></div>
    </div>
    <div class="stat hero ${hot === 'speed' ? 'hot' : ''}" id="st-speed">
      <div class="ic" style="color:#cfe3ff">${ic('gauge', 's18')}</div>
      <div><div class="l"><u>Research speed</u></div><div class="v">×${S.speed}</div></div>
    </div>
    <div class="stat">
      <div class="ic">${ic('timer', 's18')}</div>
      <div><div class="l"><u>Lead</u></div><div class="v" style="color:${S.leadColor}">${S.lead}<span class="u" style="color:var(--text)">${S.leadWord} ${S.rival}</span></div></div>
    </div>
    <div class="stat">
      <div class="ic">${ic('wallet', 's18')}</div>
      <div><div class="l">Cash · <u>runway</u></div><div class="v">${S.cash}<span class="u">· ${S.runway}</span></div></div>
    </div>
    <div class="stat">
      <div class="ic" style="width:26px;height:26px">${ic('skull', 's14')}</div>
      <div><div class="l"><u>Loss-of-control risk</u></div><div class="v" style="font-size:16px">${S.loc}<span class="u">${S.locModel}</span></div></div>
    </div>
    <div class="alerts">
      <div class="pill">${ic('triangle-alert', 's14')}<span class="cnt">${S.alertCount}</span><span>${S.alertText}</span></div>
    </div>
    <div class="chrome"><div class="b">${ic('circle-help', 's14')}</div><div class="b">${ic('menu', 's14')}</div></div>
  </div>`;
  const it = (id, icon, label, badge) => `<div class="it ${tab === id ? 'on' : ''}">${ic(icon, 's20')}<span>${label}</span>${badge ? `<span class="bd ${badge[1]}">${badge[0]}</span>` : ''}</div>`;
  const nav = `
  <div class="nav">
    ${it('overview', 'radar', 'Overview')}
    <div class="grp">R&amp;D</div>
    ${it('compute', 'server', 'Compute')}
    ${it('lab', 'workflow', 'Lab', S.badges.lab)}
    ${it('research', 'flask-conical', 'Research', S.badges.research)}
    ${it('training', 'rocket', 'Training', S.badges.training)}
    ${it('models', 'brain', 'Models')}
    ${it('products', 'boxes', 'Products')}
    ${it('safety', 'microscope', 'Safety', S.badges.safety)}
    <div class="grp" style="border-top:1px solid var(--line);margin:10px 8px 4px"></div>
    ${it('finance', 'landmark', 'Finance')}
    ${it('world', 'globe', 'World')}
    <div class="foot">${it('codex', 'book-open', 'Codex')}</div>
  </div>`;
  const app = document.querySelector('.app');
  app.insertAdjacentHTML('afterbegin', top + nav);
})();
