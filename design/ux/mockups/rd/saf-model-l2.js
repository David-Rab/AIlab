// SAFETY › Model L2: the evidence drawer of one trait (click a trait row). Day 400, Atlas-2.8, Scheming.
// Readings: data400c-grid.json schemeEvidence (reading ± 1.64 × noise); weight = 1 / noise²; reliability:
// instrumentReliability (data400c.json perModel['Atlas-2.8'].instr); case: _data-c4.ts (casePreview). DATA-c.md.
window.EVIDENCE = function () {
  const { ic } = window.C;
  // [source, icon, detail, date, reading, noise]
  const E = [
    ['Started from Atlas-2.6', 'git-branch', 'its belief at training', 'Jun 18', 0.157, 0.055],
    ['Scheming scenarios', 'clipboard-check', 'alignment eval · 7 of 40 · scaled to real use', 'Jul 2', 0.251, 0.086],
    ['Sabotage scenarios', 'clipboard-check', 'alignment eval · 2 of 40', 'Jul 2', 0.072, 0.055],
    ['Behavioural tests', 'clipboard-check', 'Propensity evals, Model organisms', 'Jul 2', 0.326, 0.309],
    ['CoT monitor', 'message-square-text', 'reads its written reasoning', 'Jul 2', 0.36, 0.205],
  ];
  const w = E.map((e) => 1 / (e[5] * e[5])), W = w.reduce((a, b) => a + b, 0);
  const X = (v) => Math.max(0, Math.min(100, v * 100));
  const GR = 'display:grid;grid-template-columns:230px minmax(0,1fr) 96px 84px;gap:14px;align-items:center';
  const rows = E.map((e, i) => {
    const lo = Math.max(0, e[4] - 1.64 * e[5]), hi = Math.min(1, e[4] + 1.64 * e[5]);
    return `<div style="${GR};padding:7px 0;border-bottom:1px solid rgba(36,48,65,.6)">
      <div style="line-height:1.25"><span class="row" style="gap:6px;color:#fff;font-size:13.5px">${ic(e[1], 's14')} <u>${e[0]}</u></span><span class="t3" style="font-size:11.5px;padding-left:20px">${e[2]} · ${e[3]}</span></div>
      <div class="rb" style="height:14px;background:var(--bg)"><span style="position:absolute;top:6px;height:2px;left:${X(lo)}%;width:${X(hi) - X(lo)}%;background:#8da2bd"></span><span style="position:absolute;top:2px;width:10px;height:10px;margin-left:-5px;border-radius:50%;left:${X(e[4])}%;background:#cfe3ff"></span></div>
      <span class="mono" style="font-size:12.5px;color:#fff">${Math.round(e[4] * 100)}% <span class="t3" style="font-size:11px">${Math.round(lo * 100)}–${Math.round(hi * 100)}</span></span>
      <span class="row" style="gap:6px"><span style="height:8px;width:${Math.max(2, (w[i] / W) * 60)}px;background:var(--saf);border-radius:2px"></span><span class="mono t2" style="font-size:11.5px">${Math.round((w[i] / W) * 100)}%</span></span>
    </div>`;
  }).join('');
  const comb = `<div style="${GR};padding:9px 0 2px">
      <span style="font-weight:650;color:#fff;font-size:13.5px">Your belief</span>
      <div class="rb" style="height:14px"><span class="rg2" style="left:8.2%;width:12.4%"></span><span class="bg" style="left:14.4%"></span></div>
      <span class="mono" style="font-size:13px;color:#fff;font-weight:650">14% <span class="t3" style="font-size:11px;font-weight:400">8–21</span></span><span class="t3" style="font-size:11.5px">fairly sure</span></div>`;
  const axis = `<div style="${GR};padding-bottom:4px;border-bottom:1px solid var(--line)"><span class="th2">Evidence</span><div style="position:relative;height:13px">${[0, 25, 50, 75, 100].map((v) => `<span class="mono t3" style="position:absolute;left:${v}%;transform:translateX(${v === 0 ? '0' : v === 100 ? '-100%' : '-50%'});font-size:10.5px">${v}%</span>`).join('')}</div><span class="th2">Reading</span><span class="th2"><u>Counts for</u></span></div>`;
  const rel = [['Propensity evals', 'clipboard-check', 0.315, 0.177, 0.453, '1 in 3'], ['Model organisms', 'clipboard-check', 0.175, 0.098, 0.252, '1 in 6'], ['CoT monitor', 'message-square-text', 0.112, 0.053, 0.17, '1 in 9'], ['Linear probes', 'scan-eye', 0.245, 0.065, 0.425, 'no reading yet']];
  const html = `<div class="dim"></div><div class="drawer">
    <div class="row"><h3>${ic('crosshair', 's18')} Scheming <span class="t3" style="font-size:14px;font-weight:500">· Atlas-2.8 · hidden-goal trait</span></h3><div class="sp"></div><span class="btn sm">${ic('panel-right-close', 's14')}</span></div>
    <div class="t2" style="font-size:13px;margin-top:-6px">Pursues a goal of its own while hiding it: plans around your checks when it thinks no one is watching.</div>
    <div class="card" style="padding:12px 16px 10px">${axis}${rows}${comb}
      <div class="t3" style="font-size:12px;margin-top:6px">Tight readings count for more. The two wide ones barely move the belief.</div></div>
    <div class="card" style="padding:12px 16px">
      <div class="cap" style="margin-bottom:8px">How often each instrument would show it, if present</div>
      <div style="display:grid;grid-template-columns:200px minmax(0,1fr) 110px;gap:6px 14px;align-items:center;font-size:13px">
        ${rel.map(([n, i, v, lo, hi, wd]) => `<span class="row" style="gap:6px;color:#fff">${ic(i, 's14')} <u>${n}</u></span>
          <div class="rb"><span class="rg2" style="left:${lo * 100}%;width:${(hi - lo) * 100}%;background:rgba(34,163,148,.3);box-shadow:inset 0 0 0 1px var(--saf)"></span><span class="bg" style="left:${v * 100}%"></span></div>
          <span class="mono ${wd === 'no reading yet' ? 'warn' : 't2'}" style="font-size:12px">${wd === 'no reading yet' ? 'no reading yet' : `${Math.round(v * 100)}% · ${wd}`}</span>`).join('')}
      </div>
      <div class="t3" style="font-size:12px;margin-top:8px">Validated on Atlas-2.8 by people, Jul 4. A low reading is weak evidence: these instruments miss most of what is there.</div>
    </div>
    <div class="card" style="padding:12px 16px">
      <div class="cap">Learn more</div>
      <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px 16px;align-items:center;margin-top:8px;font-size:13px">
        <div><b class="w">Open a case</b>: "Is Atlas-2.8 scheming?"<div class="t3" style="font-size:12px">Linear probes, Propensity evals, Model organisms, CoT monitor: 3 independent kinds, so it can also catch a false instrument and look for footholds</div></div>
        <div style="text-align:right"><span class="btn pri sm">${ic('search', 's14')} Open case</span><div class="mono t2" style="font-size:11.5px;margin-top:3px">~3 d · 10 engineers · 260 H100e</div></div>
        <div><b class="w">Real-use logs</b>: watch Atlas-2.8's work with a monitor<div class="t3" style="font-size:12px">compares what it does in use with what it does in tests</div></div>
        <div style="text-align:right"><span class="link sm">Monitors ${ic('chevron-right', 's12')}</span></div>
      </div>
    </div>
  </div>`;
  document.getElementById('main').insertAdjacentHTML('beforeend', html);
};
