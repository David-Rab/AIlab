// SAFETY › Instruments (SAFETY-REDESIGN §3.2, §4.1 Q3 / Q6, §4.3; UI-IA SAFETY Instruments row). Day 400, Atlas-2.8.
// Reliability: instrumentReliability (data400c.json perModel[…].instr); reasons: reliability() parts (data400c-grid.json);
// validation history: instruments[].trust.evidence; queue: validationView; per-trait reading: sight.perTraitAtModelLevel
// (data400b.json). Provenance: DATA-c.md.
(function () {
  const { ic } = window.C;
  document.getElementById('main').innerHTML = window.SAFHEAD(400, 'Instruments') + '<div class="body2" id="body" style="grid-template-columns:minmax(0,1fr) 560px"></div>';
  const KIND = { internals: ['scan-eye', 'Internals'], tests: ['clipboard-check', 'Tests'], reasoning: ['message-square-text', 'Reasoning'] };
  // [name, kind, reads, hidden-goal reads, pct, lo, hi, history k of 20 (Atlas-2.5, 2.6, 2.8), reasons [[text, kind]], next (2.10) pct lo hi]
  const I = [
    ['Propensity evals', 'tests', 11, 6, 0.315, 0.177, 0.453, [9, 7, 9], [['notices tests ×0.69', 'warn'], ['approach works? 67%', ''], ['fades with skill ×0.93', '']], [0.317, 0.178, 0.456]],
    ['Linear probes', 'internals', 8, 6, 0.245, 0.065, 0.425, [4, 3, 7], [['approach works? 33%', 'warn']], [0.245, 0.065, 0.425]],
    ['Model organisms', 'tests', 5, 3, 0.175, 0.098, 0.252, [4, 8, 5], [['notices tests ×0.69', 'warn'], ['approach works? 67%', ''], ['fades with skill ×0.93', '']], [0.176, 0.099, 0.253]],
    ['Noise-injection elicitation', 'internals', 1, 1, 0.175, 0.047, 0.303, [3, 5, 5], [['approach works? 33%', 'warn']], [0.175, 0.047, 0.303]],
    ['CoT monitor', 'reasoning', 8, 6, 0.112, 0.053, 0.17, [3, 4, 3], [['reasoning hidden ×0.57', 'warn'], ['approach works? 58%', '']], [0.112, 0.053, 0.17]],
  ];
  const MX = 0.6, X = (v) => Math.min(100, (v / MX) * 100), P = (v) => Math.round(v * 100);
  const rb = (p, lo, hi, dash) => {
    const unk = hi - lo > 0.3;
    return `<div class="rb" style="height:14px">${[10, 20, 30, 40, 50].map((t) => `<span style="position:absolute;top:0;bottom:0;left:${X(t / 100)}%;border-left:1px solid rgba(51,67,90,.5)"></span>`).join('')}<span class="rg2 ${dash ? 'dash' : ''} ${unk ? 'unk' : ''}" style="left:${X(lo)}%;width:${X(hi) - X(lo)}%;${dash ? '' : 'background:rgba(34,163,148,.32);box-shadow:inset 0 0 0 1px var(--saf)'}"></span>${unk ? '' : `<span class="bg" style="left:${X(p)}%"></span>`}</div>`;
  };
  const vtxt = (p, lo, hi) => (hi - lo > 0.3 ? `<span class="unk">Unknown</span> <span class="t3 mono" style="font-size:11px">${P(lo)}–${P(hi)}%</span>` : `<b class="mono w">${P(p)}%</b> <span class="t3 mono" style="font-size:11px">${P(lo)}–${P(hi)}%</span>`);
  const hist = (h) => `<svg width="54" height="30" style="display:block"><line x1="0" y1="29.5" x2="54" y2="29.5" stroke="#33435a"/>${[0, 1, 2].map((i) => `<rect x="${3 + i * 18}" y="${29 - (h[i] / 10) * 28}" width="12" height="${(h[i] / 10) * 28}" rx="2" fill="${i === 2 ? '#22a394' : '#56677e'}"/>`).join('')}</svg>`;
  const G = 'display:grid;grid-template-columns:235px 250px 125px 150px 185px minmax(0,1fr);gap:16px;align-items:center;padding:0 18px';
  const head = `<div style="${G};padding-top:6px;padding-bottom:8px;border-bottom:1px solid var(--line)">
    <span class="th2">Instrument</span>
    <div><span class="th2"><u>Reliability</u> on Atlas-2.8</span><div style="position:relative;height:12px;margin-top:3px">${[0, 10, 20, 30, 40, 50, 60].map((v) => `<span class="mono t3" style="position:absolute;left:${X(v / 100)}%;transform:translateX(${v === 0 ? '0' : v === 60 ? '-100%' : '-50%'});font-size:10px">${v}%</span>`).join('')}</div></div>
    <span class="th2"></span><span class="th2">On Atlas-2.10<br><span style="text-transform:none;letter-spacing:0;font-weight:500">extrapolated</span></span>
    <span class="th2"><u>Validated</u> · found of 20</span><span class="th2">Main limit</span></div>`;
  const sm = ([p, lo, hi]) => `<div class="row" style="gap:8px"><div class="rb" style="width:92px;height:10px"><span class="rg2 dash ${hi - lo > 0.3 ? 'unk' : ''}" style="left:${X(lo)}%;width:${X(hi) - X(lo)}%"></span></div><span class="mono" style="font-size:11.5px;color:${hi - lo > 0.3 ? 'var(--warn)' : 'var(--text-2)'}">${hi - lo > 0.3 ? 'Unknown' : P(p) + '%'}</span></div>`;
  const rows = I.map(([n, k, reads, hg, p, lo, hi, h, rs, nx]) => `<div style="${G};padding-top:13px;padding-bottom:13px;border-bottom:1px solid rgba(36,48,65,.6)">
      <div style="line-height:1.3"><span class="row" style="gap:7px;color:#fff;font-size:14px">${ic(KIND[k][0], 's16')} <u>${n}</u></span><span class="t3" style="font-size:12px;padding-left:23px">${KIND[k][1]} · ${reads} trait${reads > 1 ? 's' : ''}${hg ? `, ${hg} hidden-goal` : ''}</span></div>
      ${rb(p, lo, hi)}
      <span>${vtxt(p, lo, hi)}</span>
      ${sm(nx)}
      <div class="row" style="gap:10px">${hist(h)}<div style="font-size:12px;line-height:1.3"><span class="w">Atlas-2.8: <span class="mono">${h[2]} of 20</span></span><br><span class="t3">by people · Jul 4</span></div></div>
      <div class="row" style="gap:5px;flex-wrap:wrap">${rs.filter(([, c]) => c).map(([t, c]) => `<span class="chip ${c}"><u>${t}</u></span>`).join('')}<span class="t3" style="font-size:11.5px">${rs.length > 1 ? `+${rs.length - 1} more` : ''}</span></div>
    </div>`).join('');
  const logs = `<div style="${G};padding-top:13px;padding-bottom:13px;border-bottom:1px solid rgba(36,48,65,.6)">
      <div style="line-height:1.3"><span class="row" style="gap:7px;color:var(--text-2);font-size:14px">${ic('activity', 's16')} <u>Real-use logs</u></span><span class="t3" style="font-size:12px;padding-left:23px">Logs · from monitors</span></div>
      <div class="rb" style="height:14px;opacity:.5"></div><span class="t3" style="font-size:12px">no readings yet</span><span></span><span></span>
      <div class="row" style="gap:6px"><span class="chip warn"><u>watched 1.2%</u></span><span class="link sm">Monitors ${ic('chevron-right', 's12')}</span></div></div>`;
  const left = `<div class="card fl">
    <div class="hd" style="padding-bottom:8px"><span class="ttl">${ic('telescope', 's16')} Your instruments on Atlas-2.8</span><span class="q">How often each shows a trait that is there</span><div class="sp"></div>
      <span class="row t3" style="font-size:12px;gap:12px"><span class="row" style="gap:5px"><span style="width:22px;height:8px;border-radius:3px;background:rgba(34,163,148,.32);box-shadow:inset 0 0 0 1px var(--saf)"></span>validated on this model</span><span class="row" style="gap:5px"><span style="width:22px;height:8px;border-radius:3px;border:1px dashed rgba(196,165,245,.8)"></span>extrapolated</span><span class="row" style="gap:5px"><span class="unk" style="font-size:10.5px">Unknown</span>range over 30 pts</span></span></div>
    ${head}${rows}${logs}
    <div style="padding:12px 18px;display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px 12px;font-size:12.5px;color:var(--text-2);border-bottom:1px solid var(--line)">
      <span class="t3">${ic('info', 's14')}</span><span>Validation plants the trait in a test copy and counts how many cases the instrument finds. Planted cases are easier than real ones, so reliability = share found × <span class="mono w">0.7</span>.</span>
      <span class="t3">${ic('bar-chart-3', 's14')}</span><span>History bars: planted found on Atlas-2.5, Atlas-2.6, Atlas-2.8. A drop when people run the validation is how a broken or sabotaged instrument shows.</span>
    </div>
    <div style="margin-top:auto;padding:12px 18px;display:flex;gap:10px;align-items:center;font-size:13px">
      <span class="t2">More reliable instruments come from safety research.</span><span class="link sm">Safety programmes ${ic('chevron-right', 's12')}</span><div class="sp"></div>
      <span class="t3" style="font-size:12.5px">None trained against · none waiting to be ported</span></div>
  </div>`;
  // right column
  const T = [['Scheming', 0.485], ['Power seeking', 0.485], ['Collusion', 0.442], ['Successor alignment to self', 0.421], ['Sandbagging', 0.406], ['Alignment faking', 0.399]];
  const sight = `<div class="card" style="padding-bottom:10px">
    <div class="hd"><span class="ttl">${ic('crosshair', 's16')} Hidden goals you can read on Atlas-2.8</span><div class="sp"></div><span class="link sm">Detection grid ${ic('chevron-right', 's12')}</span></div>
    <div class="sub" style="padding:3px 16px 6px">All your instruments together: chance a hidden goal that is there shows up</div>
    <div style="display:grid;grid-template-columns:200px minmax(0,1fr) 42px;gap:6px 12px;align-items:center;padding:0 16px">
      ${T.map(([n, v]) => `<span style="font-size:13px;color:#fff"><u>${n}</u></span><div class="rb" style="height:12px"><span style="position:absolute;left:0;top:2px;bottom:2px;width:${v * 100}%;background:var(--saf);border-radius:3px"></span><span style="position:absolute;top:-3px;bottom:-3px;left:50%;border-left:1.5px dashed var(--good)"></span></div><span class="mono w" style="font-size:12.5px">${P(v)}%</span>`).join('')}
      <span></span><div style="position:relative;height:12px"><span class="mono" style="position:absolute;left:50%;transform:translateX(-50%);font-size:10.5px;color:var(--good)">50%</span></div><span></span>
    </div>
    <div class="t2" style="font-size:12.5px;padding:2px 16px 0">All under 50%: on Atlas-2.8 you miss more hidden goals than you find.</div>
  </div>`;
  const queue = `<div class="card" style="padding-bottom:12px">
    <div class="hd"><span class="ttl">${ic('flask-conical', 's16')} Validation</span><div class="sp"></div><span class="link sm">Order in Lab ${ic('chevron-right', 's12')}</span></div>
    <div style="padding:10px 16px 0;display:flex;flex-direction:column;gap:10px">
      <div><div class="row" style="font-size:13.5px"><span class="w">5 instruments on <b>Atlas-2.10</b></span><span class="t3" style="font-size:12px">by people · 40 engineers</span><div class="sp"></div><span class="mono w" style="font-size:12.5px">7 d left</span></div>
        <div class="pbar" style="margin-top:6px"><i style="width:53%"></i></div>
        <div class="t3" style="font-size:12px;margin-top:5px">Until it finishes, Atlas-2.10's readings use reliability extrapolated from Atlas-2.8 (dashed).</div></div>
      <div style="border-top:1px solid rgba(36,48,65,.8);padding-top:9px"><div class="row" style="font-size:13.5px">${ic('syringe', 's14')}<span class="w"><u>Confession training</u> <span class="t3" style="font-weight:400">(method)</span></span><div class="sp"></div><span class="btn sm">${ic('flask-conical', 's14')} Validate</span></div>
        <div class="t3" style="font-size:12px;margin-top:3px">Not validated at Atlas-2.10's scale: its effect there could be <span class="mono w">0–2×</span> what was tested. <span class="mono">~15 d · 8 engineers</span></div></div>
      <div class="row" style="gap:8px;font-size:12.5px;border-top:1px solid rgba(36,48,65,.8);padding-top:9px">${ic('repeat', 's14')}<span class="t2">Validate every instrument on each new model</span><div class="sp"></div><span class="chip good">On</span></div>
    </div>
  </div>`;
  const dis = `<div class="card" style="flex:1;padding-bottom:12px">
    <div class="hd"><span class="ttl">${ic('git-compare', 's16')} <u>Disagreements</u></span><div class="sp"></div><span class="sub">two kinds read the same trait far apart</span></div>
    <div style="padding:10px 16px 0;font-size:13px">
      <div class="row" style="gap:8px"><span class="chip good">${ic('check', 's12')} None on Atlas-2.8</span></div>
      <div class="t3" style="font-size:12px;margin:10px 0 4px">Last one</div>
      <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px;align-items:center">
        <span><b class="w">Atlas-2.5 · Alignment faking</b> <span class="t3">· Apr 9</span></span><span></span>
        <span class="row" style="gap:6px">${ic('clipboard-check', 's14')} Tests <b class="mono w">92%</b><span class="t3">vs</span>${ic('message-square-text', 's14')} Reasoning reading <b class="mono w">21%</b></span><span class="link sm">Open case ${ic('chevron-right', 's12')}</span>
      </div>
    </div>
  </div>`;
  document.getElementById('body').innerHTML = left + `<div style="display:flex;flex-direction:column;gap:12px;min-height:0">${sight}${queue}${dis}</div>`;
})();
