// TRAINING › Next run (UI-IA §1 TRAINING ★3): prediction ruler · two-stage run plan · limits strip.
(function () {
  const { ic, skillRow, rulerHead } = window.C;
  const D = window.D2, T = D.train, R = D.ruler;
  const fmtSkill = (s) => (s > 0.05 ? `<span class="up">▲</span>` : s < -0.05 ? `<span class="dn">▼</span>` : '<span class="t3">—</span>');
  const risk = (r) => {
    const top = Object.entries(r).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
    const NAME = { please: 'People-pleasing', gaming: 'Gaming', deception: 'Deception', power: 'Power' };
    if (!top || Math.abs(top[1]) < 0.02) return '<span class="t3">—</span>';
    return `<span class="${top[1] > 0 ? 'rup' : 'rdn'}">${top[1] > 0 ? '▲' : '▼'} ${NAME[top[0]]}</span>`;
  };
  // option rows: [label, options [name, on, locked, eff {s, d, c, sx, r}]]
  const Z = { s: 0, d: 0, sx: 1, r: {} };
  const pre = [
    ['Start from', [['New base', true, false, Z], ['Use Atlas-3 (pretrained Jul 22)', false, false, { s: -0.47, d: -103, sx: 1, r: {} }], ['Continue', false, true], ['Distil', false, true]], 'open'],
    ['Size', [['1.1T parameters', true, false, Z]], 'size'],
    ['Data mix', [['Balanced', true, false, Z], ['Code & math', false, false, { s: -0.01, d: 0, sx: 1, r: { gaming: 0.003 } }], ['Science', false, true], ['Multimodal', false, true]]],
    ['Model design', [['Mixture of experts', true, false, Z], ['Dense', false, false, { s: -0.6, d: 0, sx: 1, r: {} }], ['Latent reasoning', false, true]]],
  ];
  const post = [
    ['Focus', [['Broad', true, false, Z], ['Coding', false, true], ['ML research', false, true]]],
    ['Budget', [['Standard', true, false, Z], ['Heavy', false, false, { s: 0.33, d: 105, sx: 1, r: { deception: 0.126, gaming: 0.09 } }], ['Light', false, false, { s: -0.51, d: -51, sx: 1, r: { gaming: -0.115 } }]]],
    ['Reasoning', [['Visible', true, false, Z], ['Pressured', false, false, { s: 0, d: 0, sx: 0.8, r: { deception: 0.227 } }]]],
    ['Preference', [['Constitution', true, false, Z], ['Engagement', false, false, { s: 0, d: 0, sx: 1, r: { please: 0.128 } }], ['Minimal', false, false, { s: -0.12, d: 0, sx: 1, r: { power: 0.066 } }]]],
    ['Safety training', [['Standard', true, false, Z], ['Heavy', false, false, { s: -0.1, d: 0, sx: 1, r: { deception: -0.087 } }], ['Minimal', false, false, { s: 0.04, d: 0, sx: 1, r: { power: 0.199 } }]]],
    ['Methods', [['Honesty & confession training', true, false, Z]]],
    ['Environments', [['6 families · realism 99% · loopholes 7%', true, false, Z]], 'env'],
  ];
  const optRow = ([label, opts, kind]) => {
    const pills = opts.map(([n, on, locked]) => `<span class="pill ${on ? 'on' : ''} ${locked ? 'lk' : ''}">${locked ? ic('lock', 's12') + ' ' : ''}${n}${on && kind !== 'size' && kind !== 'env' && opts.length > 1 ? '' : ''}</span>`).join('');
    let extra = '';
    if (kind === 'open') {
      extra = `<div class="otab">
        <div class="oh"><span></span><span>Skill</span><span>Time</span><span>Cost</span><span>Serving</span><span>Risk</span></div>
        ${opts.filter((o) => o[3]).map(([n, on, locked, e]) => `<div class="or ${on ? 'on' : ''}"><span>${n}${on && n !== 'Standard' ? ' <span class="std">Standard</span>' : ''}</span><span>${fmtSkill(e.s)}</span><span class="n">${e.d ? (e.d > 0 ? '+' : '−') + Math.abs(e.d) + ' d' : '—'}</span><span class="t3">—</span><span class="n">${e.sx !== 1 ? '×' + e.sx : '—'}</span><span>${risk(e.r)}</span></div>`).join('')}
      </div>`;
    }
    return `<div class="opt ${kind === 'open' ? 'opened' : ''}"><span class="k">${label}</span><span class="v">${pills}</span>${extra}</div>`;
  };
  const doms = D.DOM.map(([k, name, icon]) => skillRow({ name, icon, now: T.now[k][0], nowLo: T.now[k][1], nowHi: T.now[k][2], next: T.next[k][0], nextLo: T.next[k][1], nextHi: T.next[k][2] }, R)).join('');
  const xr = window.C.ruler(R.lo, R.hi);
  const axis = `<div class="sk" style="padding-top:0"><span></span><div class="rax">${D.rungs.filter((r) => r[1] <= R.hi).map(([n, L, met]) => `<span style="left:${(xr(L) * 100).toFixed(2)}%" class="${met ? 'met' : ''}">${n}${met ? ' ✓' : ''}</span>`).join('')}</div></div>`;
  const limits = [
    ['cpu', 'Compute', '104', 'days', 'uses 60% of training compute', 1, 'ok', 'Enough', 'training share'],
    ['calendar', 'Ready', 'Feb 3', '2027', 'pretraining ends Nov 17 · post-training 78 d', 1, 'ok', 'On plan', null],
    ['database', 'Data', '0.45', 'reads per token', 'no token read twice', 1, 'ok', 'Enough', 'data'],
    ['wallet', 'Cash', '$0', 'at launch', 'compute you own (worth $1.9B)', 1, 'ok', 'Enough', null],
    ['test-tube-diagonal', 'Run operations', '1', 'day setup', 'research engineers: 3 teams spare', 1, 'ok', 'Enough', 'run operations'],
  ];
  document.getElementById('main').innerHTML = `
  <div class="ph">
    <h1>${ic('rocket', 's22')} Training</h1>
    <div class="tabs"><span class="t on">Next run</span><span class="t">Data</span><span class="t">Environments</span><span class="t">Runs</span></div>
    <div class="sp"></div>
  </div>
  <div class="grid2">
    <div class="card pred">
      <div class="hd"><span class="ttl">${ic('brain', 's18')} <u>Prediction</u></span><span class="t3" style="font-size:13px">what this run should give you, against <b class="w">${T.from}</b>, your newest measured model</span></div>
      <div class="ms">${ic('milestone', 's18')}<span>Would meet <b>${T.milestone}</b></span><span class="t3">·</span><span>ready <b>${T.ready}</b></span><div class="sp"></div><span class="link sm">${T.waiting} pretraining know-how waiting ${ic('chevron-right', 's12')}</span></div>
      <div class="body">
        <div class="legend" style="margin:10px 0 4px">
          <span><i style="background:var(--cap)"></i>${T.from} today</span>
          <span><i style="background:repeating-linear-gradient(135deg, rgba(155,107,224,.6) 0 3px, rgba(155,107,224,.2) 3px 6px);box-shadow:inset 0 0 0 1px #c4a5f5"></i>this run</span>
          <span><i style="background:#c4a5f5;height:3px"></i><u>range</u></span>
          <span><i style="background:#8da2bd;width:2px;height:12px"></i><u>median expert</u></span>
          <span><i style="background:#fff;width:2px;height:12px"></i><u>best human</u></span>
        </div>
        ${rulerHead(R)}
        ${doms}${axis}
      </div>
      <div class="sightrow" style="margin-top:auto;margin-bottom:6px">${ic('eye', 's16')}<span><u>Your instruments</u> read hidden goals <b class="w">${T.sightAtNow}</b> of the time at ${T.from}'s level, <b class="warn">${T.sightAtNext}</b> at this run's</span><div class="sp"></div><span class="link sm">instruments ${ic('chevron-right', 's12')}</span></div>
    </div>
    <div class="card plan">
      <div class="hd"><span class="ttl">${ic('sliders-horizontal', 's18')} <u>Run plan</u></span><div class="sp"></div><span class="pill">Reset to Standard</span></div>
      <div class="stage"><div class="sh"><span class="num">1</span>Pretraining<div class="sp"></div><span class="t3" style="font-size:12.5px;font-weight:500">104 d</span></div>${pre.map(optRow).join('')}</div>
      <div class="stage"><div class="sh"><span class="num">2</span>Post-training<div class="sp"></div><span class="t3" style="font-size:12.5px;font-weight:500">78 d</span></div>${post.map(optRow).join('')}</div>
      <div class="pushrow"><span class="t3"><u>Pushes</u></span><span class="rup">▲ Deception</span><span class="rup sm">▲ Gaming</span><span class="t3">Power, People-pleasing: little</span><div class="sp"></div><span class="link sm">details ${ic('chevron-right', 's12')}</span></div>
    </div>
  </div>
  <div class="card limits">
    <div class="lh"><div class="ttl" style="font-size:15px;font-weight:650;color:#fff;display:flex;gap:8px;align-items:center">${ic('gauge', 's18')} <u>Limits</u></div><div class="t3" style="font-size:12.5px">what holds this run back</div></div>
    ${limits.map(([icon, name, v, unit, sub, fill, cls, word, link]) => `<div class="lim1 ${cls}"><div class="t">${ic(icon, 's14')} ${name}<div class="sp"></div><span class="vd ${cls}">${word}</span></div><div class="val">${v} <span class="u">${unit}</span></div><div class="t3" style="font-size:12px">${sub}${link ? ` <span class="link sm">${link} ${ic('chevron-right', 's12')}</span>` : ''}</div></div>`).join('')}
    <div class="launch"><span class="btn pri">${ic('rocket', 's16')} Launch</span></div>
  </div>`;
})();
