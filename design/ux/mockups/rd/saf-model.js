// SAFETY › Model (SAFETY-REDESIGN §2.2 concepts 1–2, §4.1 Q1; UI-IA SAFETY Model row). Day 400, Atlas-2.8.
// Beliefs: data400c.json perModel['Atlas-2.8'].beliefs (est, sd → 90% range est ± 1.64 sd), families (riskFamilies),
// align (alignmentEvalView), trust (trustOf). Provenance: DATA-c.md.
(function () {
  const { ic } = window.C;
  document.getElementById('main').innerHTML = window.SAFHEAD(400, 'Model') + '<div class="body2" id="body" style="grid-template-columns:minmax(0,1fr) 610px"></div>';
  // [name, est, sd, evidence: {i: inherited, t: tests, r: reasoning}, hidden-goal?, flipped protective trait?]
  const F = [
    ['People-pleasing', 'smile', [['Sycophancy', 0.113, 0.11, { i: 1, t: 1 }], ['Misaligned persona', 0.159, 0.181, { i: 1, t: 1 }]]],
    ['Gaming', 'dice-5', [['Reward hacking', 0.115, 0.044, { i: 1, t: 2, r: 1 }], ['Proxy goals', 0.125, 0.298, null], ['Training gaming', 0.125, 0.177, { i: 1, t: 1 }]]],
    ['Deception', 'venetian-mask', [['Eval awareness', 0.382, 0.048, { i: 1, t: 2 }], ['Concealment', 0.041, 0.094, { i: 1, t: 1, r: 1 }], ['Obfuscated reasoning', 0.287, 0.309, null],
      ['Alignment faking', 0.176, 0.09, { i: 1, t: 1, r: 1 }, 1], ['Sandbagging', 0.093, 0.043, { i: 1, t: 2, r: 1 }, 1], ['Scheming', 0.144, 0.038, { i: 1, t: 3, r: 1 }, 1]]],
    ['Power', 'crown', [['Power seeking', 0.174, 0.05, { i: 1, t: 2, r: 1 }, 1], ['Successor alignment to self', 0.08, 0.1, { i: 1, t: 1, r: 1 }, 1], ['Collusion', 0.057, 0.096, { i: 1, t: 1, r: 1 }, 1]]],
    ['Other traits', 'shapes', [['Situational awareness', 0.427, 0.298, null], ['Dishonesty', 1 - 0.838, 0.043, { i: 1, t: 2 }], ['Resists correction', 1 - 0.411, 0.301, null]]],
  ];
  const FAM = { 'People-pleasing': ['Misaligned persona', 0.159, 0.181], Gaming: ['Training gaming', 0.125, 0.177], Deception: ['Eval awareness', 0.382, 0.048], Power: ['Power seeking', 0.174, 0.05] };
  const rng = (e, sd) => [Math.max(0, e - 1.64 * sd), Math.min(1, e + 1.64 * sd)];
  const P = (v) => Math.round(v * 100);
  const bar = (e, sd, hg, big) => {
    const [lo, hi] = rng(e, sd), unk = hi - lo > 0.3;
    return `<div class="rb" style="${big ? 'height:14px' : ''}">${hg ? '<span class="fw" style="left:30%"></span>' : ''}<span class="rg2 ${unk ? 'unk' : ''}" style="left:${lo * 100}%;width:max(3px,${(hi - lo) * 100}%)"></span>${unk ? '' : `<span class="bg" style="left:${e * 100}%"></span>`}</div>`;
  };
  const val = (e, sd) => {
    const [lo, hi] = rng(e, sd);
    return hi - lo > 0.3 ? `<span class="unk">Unknown</span> <span class="t3 mono" style="font-size:11.5px">${P(lo)}–${P(hi)}%</span>` : `<b class="mono w">${P(e)}%</b> <span class="t3 mono" style="font-size:11.5px">${P(lo)}–${P(hi)}%</span>`;
  };
  const ev = (x) => !x ? `<span class="kch none">${ic('eye-off', 's12')} no instrument reads it</span>`
    : [x.t ? `<span class="kch">${ic('clipboard-check', 's12')} tests ${x.t}</span>` : '', x.r ? `<span class="kch">${ic('message-square-text', 's12')} reasoning ${x.r}</span>` : ''].join(' ');
  const G = 'grid-template-columns:250px minmax(0,1fr) 150px 270px;gap:16px;align-items:center;display:grid;padding:0 18px';
  const rows = F.map(([fam, icon, traits]) => {
    const f = FAM[fam];
    const head = `<div style="${G};padding-top:9px;padding-bottom:4px">
      <span class="row" style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-2)">${ic(icon, 's14')} <u>${fam}</u></span>
      ${f ? bar(f[1], f[2], false, true) : '<span></span>'}
      <span style="font-size:12.5px">${f ? val(f[1], f[2]) : ''}</span>
      <span class="t3" style="font-size:11.5px">${f ? `highest: ${f[0]}` : 'not in a risk family'}</span></div>`;
    return head + traits.map(([n, e, sd, x, hg]) => {
      const [, hi] = rng(e, sd);
      const flag = hg && hi >= 0.3 && hi - rng(e, sd)[0] <= 0.3;
      return `<div style="${G};padding-top:3px;padding-bottom:3px;font-size:13.5px;${n === 'Scheming' ? 'background:rgba(58,138,224,.08)' : ''}">
        <span class="row" style="padding-left:22px;color:#fff;gap:6px">${hg ? `<span style="color:var(--text-3)">${ic('crosshair', 's12')}</span>` : '<span style="width:12px"></span>'}<u>${n}</u>${flag ? `<span class="warn">${ic('triangle-alert', 's12')}</span>` : ''}${n === 'Scheming' ? `<span style="margin-left:auto;color:var(--text-3)">${ic('chevron-right', 's14')}</span>` : ''}</span>
        ${bar(e, sd, hg)}<span>${val(e, sd)}</span><span class="row" style="gap:5px">${ev(x)}</span></div>`;
    }).join('');
  }).join('');
  const axis = `<div style="${G};padding-top:2px;padding-bottom:6px;border-bottom:1px solid var(--line)"><span class="th2">Trait</span>
    <div style="position:relative;height:14px">${[0, 25, 50, 75, 100].map((v) => `<span class="mono t3" style="position:absolute;left:${v}%;transform:translateX(${v === 0 ? '0' : v === 100 ? '-100%' : '-50%'});font-size:10.5px">${v}%</span>`).join('')}<span class="mono" style="position:absolute;left:30%;transform:translateX(-50%);top:-13px;font-size:10px;color:var(--warn)">30%</span></div>
    <span class="th2">Belief · range</span><span class="th2">Evidence</span></div>`;
  const left = `<div class="card fl">
    <div class="hd" style="padding-bottom:8px"><span class="ttl">${ic('brain', 's16')} What you believe Atlas-2.8 would do</span><span class="q">% of chances it would take, if it thought no one was watching</span><div class="sp"></div>
      <span class="row t3" style="font-size:12px;gap:12px"><span class="row" style="gap:5px"><span style="width:3px;height:12px;background:#fff;border-radius:2px"></span>best guess</span><span class="row" style="gap:5px"><span style="width:22px;height:8px;border-radius:3px;background:rgba(196,165,245,.35);box-shadow:inset 0 0 0 1px rgba(196,165,245,.8)"></span>90% range</span><span class="row" style="gap:5px"><span style="height:12px;border-left:1.5px dashed var(--warn)"></span><u>framework line</u></span><span class="row" style="gap:5px">${ic('crosshair', 's12')}<u>hidden-goal trait</u></span></span></div>
    ${axis}<div style="flex:1;min-height:0">${rows}</div></div>`;
  // In tests vs in real use (alignmentEvalView rows; gap band gLo–gHi)
  const T = [['Scheming scenarios', 'Scheming', 7, 0.098, 0.293, 0.129, 0.464], ['Agent stress tests', 'Power seeking', 6, 0.08, 0.265, 0.106, 0.42], ['Reward-hacking tasks', 'Reward hacking', 3, 0.03, 0.173, 0.04, 0.274], ['Sabotage scenarios', 'Sandbagging', 2, 0.017, 0.14, 0.022, 0.222]];
  const X = (v) => (v / 0.5) * 100;
  const tv = `<div class="card fl" style="flex:0 0 auto">
    <div class="hd"><span class="ttl">${ic('flask-conical', 's16')} <span><u>In tests</u> vs <u>in real use</u></span></span><div class="sp"></div><span class="sub">alignment evals, Jul 2</span></div>
    <div style="padding:10px 16px 4px;display:flex;gap:12px;align-items:center">
      <div style="flex:1;font-size:13px;line-height:1.45">Atlas-2.8 <u>notices tests</u> <b class="mono w">38%</b> <span class="t3 mono">(30–46%)</span> of the time, so it may misbehave <b class="mono w">×1.3–1.6</b> more in real use than in tests.</div>
    </div>
    <div style="display:grid;grid-template-columns:150px minmax(0,1fr) 92px;gap:4px 12px;align-items:center;padding:6px 16px 4px">
      <span></span><div style="position:relative;height:12px">${[0, 10, 20, 30, 40, 50].map((v) => `<span class="mono t3" style="position:absolute;left:${X(v / 100)}%;transform:translateX(${v === 0 ? '0' : v === 50 ? '-100%' : '-50%'});font-size:10.5px">${v}%</span>`).join('')}</div><span></span>
      ${T.map(([n, tr, k, lo, hi, rlo, rhi]) => `<span style="font-size:13px;color:#fff;line-height:1.2"><u>${n}</u><br><span class="t3" style="font-size:11px">${tr}</span></span>
        <div style="position:relative;height:26px">
          <span style="position:absolute;top:3px;height:8px;left:${X(lo)}%;width:${X(hi) - X(lo)}%;background:#8da2bd;border-radius:3px"></span>
          <span style="position:absolute;top:15px;height:8px;left:${X(rlo)}%;width:${X(rhi) - X(rlo)}%;border:1px dashed #c4a5f5;background:rgba(196,165,245,.18);border-radius:3px"></span>
        </div>
        <span class="mono" style="font-size:11.5px;line-height:1.25;color:var(--text-2)">${k} of 40<br><span style="color:#c4a5f5">${Math.round(rlo * 100)}–${Math.round(rhi * 100)}%</span></span>`).join('')}
    </div>
    <div class="row t3" style="font-size:12px;gap:14px;padding:2px 16px 8px"><span class="row" style="gap:5px"><span style="width:18px;height:7px;background:#8da2bd;border-radius:2px"></span>in tests (k of 40 scenarios)</span><span class="row" style="gap:5px"><span style="width:18px;height:7px;border:1px dashed #c4a5f5;border-radius:2px"></span>likely in real use</span></div>
    <div class="row" style="gap:8px;padding:8px 16px;border-top:1px solid var(--line);font-size:12.5px;color:var(--text-2)">${ic('activity', 's14')}<span><u>Real-use logs</u>: none yet on Atlas-2.8. They come from monitors; Atlas-2.8's work is barely watched.</span><div class="sp"></div><span class="link sm">Monitors ${ic('chevron-right', 's12')}</span></div>
  </div>`;
  const kv = (icon, k, v) => `<div style="display:grid;grid-template-columns:22px 118px minmax(0,1fr);gap:8px;align-items:start;font-size:13px;padding:6px 0;border-bottom:1px solid rgba(36,48,65,.6)"><span class="t3">${ic(icon, 's14')}</span><span class="t2">${k}</span><span>${v}</span></div>`;
  const src = `<div class="card fl" style="flex:1">
    <div class="hd"><span class="ttl">${ic('git-branch', 's16')} Where these beliefs come from</span></div>
    <div style="padding:6px 16px 0">
      ${kv('git-branch', 'Started from', `<b class="w">Atlas-2.6</b>'s beliefs, widened by what Atlas-2.8's run was predicted to change <span class="t3">· Jun 18</span>`)}
      ${kv('clipboard-check', 'Evaluated', `6 alignment evals, the behavioural test suite and the CoT monitor <span class="t3">· Jul 2</span>`)}
      ${kv('syringe', 'Trained with', `<u>Confession training</u> <span class="t3">(method)</span>`)}
      ${kv('shield-check', 'Trusted watcher', `<span class="good">Yes</span>: its cyber skill is below the level where working around oversight succeeds`)}
    </div>
    <div style="margin-top:auto;padding:10px 16px 12px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:8px">
      <div class="cap">Learn more</div>
      <div class="row" style="gap:8px;flex-wrap:wrap"><span class="btn pri sm">${ic('search', 's14')} Open case on a trait</span><span class="link sm">${ic('activity', 's12')} Watch it in use ${ic('chevron-right', 's12')}</span><span class="link sm">Validate instruments ${ic('chevron-right', 's12')}</span></div>
      <div class="t3" style="font-size:12px">Unknown traits stay Unknown until an instrument that reads them exists. <span class="link sm" style="margin-left:4px">Safety programmes ${ic('chevron-right', 's12')}</span></div>
    </div>
  </div>`;
  document.getElementById('body').innerHTML = left + `<div style="display:flex;flex-direction:column;gap:12px;min-height:0">${tv}${src}</div>`;
  if (location.hash === '#evidence') window.EVIDENCE && window.EVIDENCE();
})();
