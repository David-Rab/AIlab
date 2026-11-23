// TRAINING › Environments (UI-IA §1 TRAINING · Environments): family grid (Realism, Loopholes, used by the next run,
// Harden · Expand with previews) and the next run's Hacking pressure with what makes it. Day-400 values: data400-b.json ENV.
(function () {
  const { ic } = window.C;
  // [family, icon, realism %, loopholes %, share of the environments' hacking pressure %, loopholes after one Harden %]
  const FAM = [
    ['Coding', 'code-xml', 99, 18, 46, 11.5],
    ['ML research', 'flask-conical', 99, 12, 31, 7.7],
    ['Math', 'sigma', 99, 6, 15, 3.8],
    ['Long tasks', 'bot', 99, 1, 3, 0.6],
    ['Cyber', 'binary', 99, 1, 3, 0.6],
    ['Bio', 'dna', 99, 1, 3, 0.6],
  ];
  const RMAX = 125, LMAX = 25;
  const rows = FAM.map(([n, icon, real, loop, share, hl]) => `<div class="fam">
      <div class="nm"><div class="fi">${ic(icon, 's20')}</div><div><b>${n}</b><span class="s">${ic('check', 's12')} in next run · <span class="n">1/6</span></span></div></div>
      <div class="mb"><div class="tr"><i style="width:${(real / RMAX * 100).toFixed(1)}%;background:#6f8fb5"></i><div class="tk" style="left:${(100 / RMAX * 100).toFixed(1)}%"></div></div><span class="v">${real}%</span></div>
      <div class="mb"><div class="tr"><i style="width:${(loop / LMAX * 100).toFixed(1)}%;background:${loop >= 10 ? 'var(--warn)' : '#8a7a52'}"></i></div><span class="v ${loop >= 10 ? 'warn' : ''}">${loop}%</span></div>
      <div class="ctr"><div class="cb" style="width:${share * 2}px;opacity:${loop >= 10 ? 1 : 0.55}"></div><span class="n">${share}%</span></div>
      <div class="acts">
        <div class="act"><span class="btn">${ic('shield-check', 's14')} Harden</span><span class="pv"><u>Loopholes</u> → <b>${hl}%</b> · 1 d · $49M</span></div>
        <div class="act"><span class="btn">${ic('expand', 's14')} Expand</span><span class="pv"><u>Realism</u> → <b>114%</b> · 1 d · $100M</span></div>
      </div>
    </div>`).join('') + `<div class="fam lock">
      <div class="nm"><div class="fi">${ic('mouse-pointer-2', 's20')}</div><div><b>Computer use</b><span class="s">no environments</span></div></div>
      <div class="t3" style="font-size:13px;grid-column:2 / 6">${ic('lock', 's12')} Locked: needs the discovery <b class="t2">Computer use</b> <span class="link sm">Discoveries ${ic('chevron-right', 's12')}</span></div>
    </div>`;
  const sum = [['Coding', 46], ['ML research', 31], ['Math', 15], ['Long tasks, Cyber, Bio', 9]];
  document.getElementById('main').innerHTML = `
  <div class="ph">
    <h1>${ic('rocket', 's22')} Training</h1>
    <div class="tabs"><span class="t">Next run</span><span class="t">Data</span><span class="t on">Environments</span><span class="t">Runs</span></div>
    <div class="sp"></div>
  </div>
  <div class="grid">
    <div class="card" style="display:flex;flex-direction:column">
      <div class="hd"><span class="ttl">${ic('boxes', 's18')} <u>Environments</u> by family</span><span class="q">tasks and graders your models practise on in post-training</span></div>
      <div class="fh"><span>Family</span><span><u>Realism</u> <span style="text-transform:none;letter-spacing:0;font-weight:500">· tick = standard</span></span><span><u>Loopholes</u></span><span>Share of pressure</span><span>Work <span style="text-transform:none;letter-spacing:0;font-weight:500">· engineers 77% spare</span></span></div>
      ${rows}
    </div>
    <div class="card press">
      <div class="hd"><span class="ttl">${ic('triangle-alert', 's18')} <u>Hacking pressure</u> of the next run</span></div>
      <div class="pg">
        <div class="row" style="align-items:baseline;gap:12px"><span class="word">High</span><span class="t2" style="font-size:13.5px">pushes <span class="rup">▲ Gaming</span> in the next model</span><div class="sp"></div><span class="link sm">Pushes ${ic('chevron-right', 's12')}</span></div>
        <div style="position:relative;margin-top:18px">
          <div class="pbar"><i style="width:33%;background:#2f6b52"></i><i style="width:33%;background:#7a6a3a"></i><i style="flex:1;background:var(--warn)"></i></div>
          <div class="needle" style="left:75%"></div>
          <div class="needle" style="left:64.6%;background:transparent;border:2px dashed #fff;width:7px;box-shadow:none;transform:translateX(-3px)"></div>
        </div>
        <div class="pl"><span>Low</span><span>Medium</span><span>High</span></div>
      </div>
      <div class="sec" style="margin-top:16px">
        <div class="cap">What makes it</div>
        ${sum.map(([n, v]) => `<div class="mk"><span>${n}</span><div><div class="bb" style="width:${v * 1.6}%"></div></div><span class="n">${v}%</span></div>`).join('')}
        <div class="t3" style="font-size:12.5px;margin-top:10px">The graders' loopholes, by each family's share of the run. The <b class="t2">Standard</b> post-training budget doubles it.</div>
      </div>
      <div class="sec">
        <div class="cap">Ways to lower it</div>
        <div class="fix first"><div>Harden Coding<div class="sub">1 d · $49M · engineers</div></div><span class="ba">High → High</span><span class="btn">Do</span></div>
        <div class="fix"><div>Harden Coding, ML research, Math<div class="sub">3 d · $147M · engineers</div></div><span class="ba">High → <span class="warn">Medium</span></span><span class="btn">Do</span></div>
        <div class="fix"><div>Light post-training budget<div class="sub">the run gives less skill</div></div><span class="ba">High → <span class="warn">Medium</span></span><span class="link sm">Next run ${ic('chevron-right', 's12')}</span></div>
        <div class="row t3" style="font-size:12px;margin-top:10px;gap:8px"><span style="display:inline-block;width:8px;height:14px;border:2px dashed #fff;border-radius:2px"></span>after hardening all three</div>
      </div>
    </div>
  </div>`;
})();
