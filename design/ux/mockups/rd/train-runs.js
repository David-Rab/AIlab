// TRAINING › Runs (UI-IA §1 TRAINING · Runs): runs timeline (Gantt) with results, each run's forecast vs measured, the run
// in flight. Dec 8, 2026 state of data400-b-runs.json C; older runs from data400-b.json RUNS. State #drawer: a finished run's card.
(function () {
  const { ic } = window.C;
  const T0 = new Date('Oct 1, 2025'), T1 = new Date('Mar 31, 2027');
  const X = (d) => ((new Date(d) - T0) / (T1 - T0) * 100);
  const pc = (d) => Math.max(0, X(d)).toFixed(2) + '%';
  const W = (a, b) => `calc(${(Math.max(X(b), 0) - Math.max(X(a), 0)).toFixed(2)}% )`;
  const bar = (cls, a, b, label, opt = {}) => `<div class="bar ${cls}" style="left:${pc(a)};width:max(${W(a, b)}, 6px);${opt.top ? `top:${opt.top}px;height:${opt.h || 14}px` : ''}">${opt.done ? `<i class="done" style="width:${opt.done}%"></i>` : ''}</div>${label ? `<span class="res ${opt.mini ? 'mini' : ''} ${opt.l ? 'l' : ''}" style="left:${opt.l ? pc(a) : pc(b)};${opt.ly != null ? `top:${opt.ly}px` : ''}">${label}</span>` : ''}`;
  const lanes = [
    ['Pretraining', 'layers', [
      bar('pre', 'Jul 15, 2025', 'Oct 25, 2025', 'base <b>Atlas-2</b>'),
      bar('pre', 'Apr 11, 2026', 'Jul 22, 2026', 'base <b>Atlas-3</b>'),
      bar('run', 'Aug 5, 2026', 'Jan 31, 2027', '<b>Pretraining 32</b> · 70% · due Jan 31', { done: 70 }),
    ].join('')],
    ['Post-training', 'sliders-horizontal', [
      ['Nov 4, 2025', 'Nov 29, 2025', 'Atlas-2.0'], ['Dec 16, 2025', 'Jan 6, 2026', '2.2'], ['Jan 27, 2026', 'Feb 15, 2026', '2.4'], ['Mar 10, 2026', 'Mar 26, 2026', '2.5'],
      ['Apr 21, 2026', 'May 9, 2026', '2.6'], ['Jun 2, 2026', 'Jun 18, 2026', '2.8'], ['Jul 14, 2026', 'Jul 27, 2026', '2.10'],
    ].map(([a, b, n]) => bar('post', a, b, `<b>${n}</b>`)).join('') + bar('post', 'Aug 5, 2026', 'Nov 23, 2026', '<b>Atlas-3.0</b> <span class="warn">▼</span>')],
    ['Distil', 'minimize-2', [
      ['Dec 2, 2025', 'Dec 6, 2025', '2.0-mini'], ['Jan 21, 2026', 'Jan 23, 2026', '2.2-mini'], ['May 27, 2026', 'May 29, 2026', '2.6-mini'], ['Jul 8, 2026', 'Jul 9, 2026', '2.8-mini'], ['Aug 5, 2026', 'Aug 7, 2026', '2.10-mini'],
    ].map(([a, b, n], i) => bar('dis', a, b, n, { mini: true, ly: i === 4 ? 56 : 4 })).join('')],
    ['Evals', 'clipboard-check', [
      bar('ev', 'Nov 23, 2026', 'Dec 7, 2026', 'Atlas-3.0 <b>measured</b>', { top: 24, h: 14, ly: 4 }),
      bar('evr', 'Dec 6, 2026', 'Dec 20, 2026', 'Atlas-2.10 re-test · due Dec 20', { top: 44, h: 14, ly: 62, l: true }),
    ].join('')],
  ];
  const months = ['Oct 1, 2025', 'Jan 1, 2026', 'Apr 1, 2026', 'Jul 1, 2026', 'Oct 1, 2026', 'Jan 1, 2027'];
  const mlabel = (d) => { const x = new Date(d); return x.toLocaleString('en-US', { month: 'short' }) + (x.getMonth() === 0 ? ' ' + x.getFullYear() : ''); };
  const gantt = `<div class="gt">
      ${lanes.map(([n, icon, html]) => `<div class="lane"><div class="ln">${ic(icon, 's16')} ${n}</div>${html}</div>`).join('')}
      <div class="today" style="left:${pc('Dec 8, 2026')};top:0;bottom:4px"><span style="top:auto;bottom:-16px">today</span></div>
      <div class="xa">${months.map((m) => `<span style="left:${pc(m)}">${mlabel(m)}</span>`).join('')}</div>
    </div>`;
  // forecast vs result: each row centred on its forecast; shared scale ±0.45 levels (numbers in the tooltip only)
  const S = 0.45;
  const R = (d) => (50 + d / S * 50).toFixed(2) + '%';
  const RW = (a, b) => ((b - a) / S * 50).toFixed(2) + '%';
  const fr = (name, sub, half, meas, verdict) => `<div class="fr">
      <div class="nm"><b>${name}</b><span>${sub}</span></div>
      <div class="rl"><div class="tk med" style="left:50%;background:#5d6f88"></div>
        <div class="band" style="left:${R(-half)};width:${RW(-half, half)}"></div>
        ${meas ? `<div class="wh" style="left:${R(meas[0] - meas[1])};width:${RW(meas[0] - meas[1], meas[0] + meas[1])}"></div><div class="dot" style="left:${R(meas[0])}"></div>` : ''}</div>
      <div class="verd">${verdict}</div></div>`;
  const fcs = `<div class="fr" style="padding:4px 0 0;border:0"><span></span><div class="rh"><span style="left:0;transform:none">lower</span><span style="left:50%">forecast</span><span style="right:0;left:auto;transform:none">higher</span></div><span></span></div>`
    + fr('Post-training 33 → Atlas-3.0', 'on base Atlas-3 · measured Dec 7', 0.12, [-0.172, 0.117], `<span class="warn">${ic('arrow-down', 's14')} Below forecast</span>`)
    + fr('Distil 34 → Atlas-2.10-mini', 'from Atlas-2.10 · measured Aug 21', 0.12, [0.072, 0.126], `<span class="good">${ic('check', 's14')} As forecast</span>`)
    + fr('Pretraining 32', 'running · due Jan 31, 2027', 0.141, null, `<span class="t3">${ic('loader', 's14')} Not yet</span>`);

  document.getElementById('main').innerHTML = `
  <div class="ph">
    <h1>${ic('rocket', 's22')} Training</h1>
    <div class="tabs"><span class="t">Next run</span><span class="t">Data</span><span class="t">Environments</span><span class="t on">Runs</span></div>
    <div class="sp"></div>
  </div>
  <div class="card gantt">
    <div class="hd"><span class="ttl">${ic('gantt-chart', 's18')} Runs</span><span class="q">what ran, what came out, what is running</span><div class="sp"></div>
      <div class="legend"><span><i style="background:#6d55a8"></i>Pretraining</span><span><i style="background:var(--cap)"></i>Post-training</span><span><i style="background:#b79ae8"></i>Distil</span><span><i style="background:#4f6d8f"></i>Evals</span><span><i style="background:repeating-linear-gradient(135deg, rgba(155,107,224,.6) 0 3px, rgba(155,107,224,.2) 3px 6px);box-shadow:inset 0 0 0 1px #c4a5f5"></i>to go</span></div></div>
    ${gantt}
    <div class="strip">${ic('cpu', 's14')} <u>Training compute</u> now<div class="sb"><i style="width:60%;background:#6d55a8"></i><i class="hatch" style="flex:1;background-color:#56677e"></i></div><span><b class="w n">60%</b> Pretraining 32 · <b class="warn n">40%</b> idle</span><span class="link sm">LAB ${ic('chevron-right', 's12')}</span></div>
  </div>
  <div class="grid">
    <div class="card">
      <div class="hd"><span class="ttl">${ic('crosshair', 's18')} <u>Forecast</u> vs result</span><span class="q">what you expected at launch, and what evals measured</span><div class="sp"></div>
        <span class="chip warn">1 of 2 inside the range</span></div>
      <div class="legend" style="margin:12px 20px 0 288px"><span><i style="background:repeating-linear-gradient(135deg, rgba(155,107,224,.6) 0 3px, rgba(155,107,224,.2) 3px 6px);box-shadow:inset 0 0 0 1px #c4a5f5"></i>forecast range at launch</span><span><i style="background:#fff;width:10px;height:10px;border-radius:50%"></i>measured, with its range</span></div>
      <div class="fc">${fcs}</div>
    </div>
    <div class="card now">
      <div class="hd"><span class="ttl">${ic('loader', 's18')} Running now</span><div class="sp"></div><span class="chip good">${ic('check', 's12')} on plan</span></div>
      <div class="prog">
        <div class="row" style="align-items:baseline"><b class="w" style="font-size:16px">Pretraining 32</b><span class="t3" style="font-size:12.5px;margin-left:8px">new base · 1.1T parameters</span><div class="sp"></div><span class="big">70%</span></div>
        <div class="pb" style="margin-top:8px"><i style="width:70%"></i></div>
      </div>
      <div class="kv">
        <span class="k">Due</span><span class="v"><b class="n">Jan 31, 2027</b> <span class="t3">· 54 d</span></span>
        <span class="k"><u>Training share</u></span><span class="v"><span class="n">60%</span> <span class="t3">of training compute</span></span>
        <span class="k">Holdups</span><span class="v">none</span>
        <span class="k"><u>Forecast</u></span><span class="v">would meet <b>Research agent</b></span>
        <span class="k">Then</span><span class="v t2">post-training, from the Next run plan</span>
      </div>
      <div class="row" style="gap:8px;padding:0 20px;margin-top:auto;margin-bottom:16px"><span class="link sm">Launch snapshot ${ic('chevron-right', 's12')}</span><span class="link sm">Next run ${ic('chevron-right', 's12')}</span></div>
    </div>
  </div>`;

  if (location.hash === '#drawer') {
    const RR = (L) => ((L - 6.2) / 3 * 100).toFixed(2) + '%';
    const RRW = (a, b) => ((b - a) / 3 * 100).toFixed(2) + '%';
    document.getElementById('main').insertAdjacentHTML('beforeend', `<div class="scrim"></div>
    <div class="drawer">
      <div class="dh">${ic('sliders-horizontal', 's20')} Post-training 33 <span class="t3" style="font-weight:500;font-size:14px">→ Atlas-3.0</span><div class="sp"></div><span class="t3" style="font-size:13px;font-weight:500">Esc</span></div>
      <div class="sec">
        <div class="row" style="margin-bottom:10px"><span class="cap">Forecast vs result</span><div class="sp"></div><span class="warn" style="font-weight:650;font-size:13px">${ic('arrow-down', 's14')} Below forecast</span></div>
        <div class="rl" style="height:34px;margin-top:22px">
          <div class="tk med" style="left:${RR(6.4)}"></div>
          <div class="ref" style="left:${RR(6.9)}"></div>
          <div class="band" style="left:${RR(8.502)};width:${RRW(8.502, 8.742)}"></div>
          <div class="wh" style="left:${RR(8.33)};width:${RRW(8.33, 8.57)}"></div><div class="dot" style="left:${RR(8.45)}"></div>
          <span style="position:absolute;top:-20px;left:${RR(6.9)};transform:translateX(-50%);font-size:11.5px;color:var(--text-3);white-space:nowrap">Atlas-2.8</span>
          <span style="position:absolute;top:-20px;left:${RR(6.4)};transform:translateX(-50%);font-size:11.5px;color:var(--text-3);white-space:nowrap">median expert</span>
        </div>
        <div class="snap" style="margin-top:16px">
          <span class="k">Forecast at launch</span><span class="w"><span class="n">+1.72</span> over Atlas-2.8 <span class="t3">(range +1.60 to +1.84)</span></span>
          <span class="k">Measured Dec 7</span><span class="w"><span class="n">+1.55</span> <span class="t3">(range +1.43 to +1.67)</span></span>
          <span class="k">Miss</span><span class="w">below the range; the forecast was <b>too sure</b></span>
        </div>
      </div>
      <div class="sec">
        <div class="cap" style="margin-bottom:10px">Time</div>
        <div class="snap"><span class="k">Launched</span><span class="w n">Aug 5, 2026</span><span class="k">Finished</span><span class="w"><span class="n">Nov 23, 2026</span> <span class="t3">· 110 d</span></span><span class="k">Evals</span><span class="w"><span class="n">Nov 23 → Dec 7</span> <span class="t3">· full suite</span></span><span class="k">Training share</span><span class="w n">20%</span></div>
      </div>
      <div class="sec">
        <div class="cap" style="margin-bottom:10px">Launch snapshot</div>
        <div class="snap">
          <span class="k">Start from</span><span class="w">base Atlas-3 <span class="t3">(pretrained Jul 22)</span></span>
          <span class="k">Focus · budget</span><span class="w">Broad · Standard</span>
          <span class="k">Reasoning</span><span class="w">Visible</span>
          <span class="k">Preference</span><span class="w">Constitution</span>
          <span class="k">Safety training</span><span class="w">Standard</span>
          <span class="k">Methods</span><span class="w">Honesty &amp; confession training</span>
          <span class="k">Environments</span><span class="w">6 families · <u>realism</u> 99% · <u>loopholes</u> 7%</span>
        </div>
      </div>
      <div style="margin-top:auto;padding:16px 20px;border-top:1px solid var(--line);display:flex;gap:10px"><span class="link">Atlas-3.0 ${ic('chevron-right', 's14')} Models</span><span class="link">Evals ${ic('chevron-right', 's14')}</span><span class="link">What it does to tendencies ${ic('chevron-right', 's14')} Safety</span></div>
    </div>`);
  }
})();
