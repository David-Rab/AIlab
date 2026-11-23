// SAFETY › Safeguards L2: edit the control protocol on AI staff work (click its cell). Day 400, Atlas-2.8's acts.
// Settings: safeguards.ts CONTROL_SETTINGS via controlTerms (slowdown, misses ×), controlComputeShare; parts:
// believedOversightParts (block 0.488 on / 0 off, human 0.116); per act: the act table's block and catch with the monitor
// part backed out (_data-c5.ts, DATA-c.md). Unstopped harm: attempts × (1 − new stop rate), summed.
window.SGEDIT = function () {
  const { ic } = window.C;
  const O = [
    ['Off', '', '23–35%', '12–25%', '0%', '0', 'Nothing blocked or deferred.', 'off'],
    ['Defer 10% to trusted', 'now', '82–89%', '80–88%', '7%', '1.6k', 'A trusted model redoes the most suspicious 10% of actions.'],
    ['Defer 20% to trusted', '', '92–95%', '91–94%', '17%', '3.3k', 'The same, on the most suspicious 20%.'],
    ['Resample suspicious actions', 'pick', '95–97%', '95–97%', '5%', '0.8k', 'Suspicious actions are re-drawn from the same model and compared.'],
  ];
  const card = ([n, tag, lab, mis, slow, comp, how, off]) => `<div style="flex:1;border-radius:9px;padding:10px 12px;border:1px solid ${tag === 'pick' ? 'var(--you)' : 'var(--line-2)'};background:${tag === 'pick' ? 'rgba(58,138,224,.10)' : 'var(--panel)'};${off ? 'opacity:.6' : ''};display:flex;flex-direction:column;gap:6px">
      <div class="row" style="gap:6px"><span style="width:14px;height:14px;border-radius:50%;border:2px solid ${tag === 'pick' ? 'var(--you)' : 'var(--line-2)'};${tag === 'pick' ? 'background:radial-gradient(circle, var(--you) 0 3px, transparent 4px)' : ''}"></span><b class="w" style="font-size:13px">${n}</b></div>
      ${tag === 'now' ? '<span class="chip" style="align-self:flex-start">current</span>' : off ? `<span class="chip warn" style="align-self:flex-start">${ic('scroll-text', 's12')} your framework needs one</span>` : '<span style="height:18px"></span>'}
      <div class="t3" style="font-size:11.5px;min-height:30px">${how}</div>
      <div style="display:grid;grid-template-columns:auto auto;gap:2px 10px;font-size:12px;margin-top:auto;white-space:nowrap"><span class="t2">Against the lab</span><b class="mono w">${lab}</b><span class="t2">Misbehaviour</span><b class="mono w">${mis}</b><span class="t2"><u>Slowdown</u></span><b class="mono ${slow === '17%' ? 'warn' : 'w'}">${slow}</b><span class="t2">Compute</span><b class="mono w">${comp} H100e</b></div>
    </div>`;
  const A = [['Sabotages research', 83, 95], ['Steers research toward its own ends', 85, 96], ['Writes itself into the successor', 84, 96], ['Plants a backdoor', 88, 97], ['Works around oversight', 89, 97], ['Games tests and graders', 81, 95], ['Tells people what they want to hear', 80, 95]];
  const rows = A.map(([n, a, b]) => `<div style="display:grid;grid-template-columns:250px minmax(0,1fr) 90px;gap:12px;align-items:center;padding:4px 0;font-size:13px">
      <span class="w">${n}</span>
      <div class="rb" style="height:12px"><span style="position:absolute;left:0;top:2px;bottom:2px;width:${a}%;background:#56677e;border-radius:3px"></span><span style="position:absolute;left:${a}%;top:2px;bottom:2px;width:${b - a}%;background:var(--good);border-radius:0 3px 3px 0"></span></div>
      <span class="prev">${a}% → <b>${b}%</b></span></div>`).join('');
  const html = `<div class="dim"></div><div class="drawer" style="width:820px">
    <div class="row"><h3>${ic('shield', 's18')} Control protocol <span class="t3" style="font-size:14px;font-weight:500">· AI staff work · all jobs</span></h3><div class="sp"></div><span class="btn sm">${ic('panel-right-close', 's14')}</span></div>
    <div class="t2" style="font-size:13px;margin-top:-6px">Watches AI staff actions and blocks the risky ones (49% of attempts here). What it does with the suspicious rest is the setting.</div>
    <div class="row" style="gap:10px;align-items:stretch">${O.map(card).join('')}</div>
    <div class="t3" style="font-size:12px">${ic('info', 's12')} Stop rates for Atlas-2.8's acts on this work. Trusted model: <b class="w">Atlas-2.6</b> (auto: the most capable model you trust). Compute is billed to AI staff work.</div>
    <div class="card" style="padding:12px 16px">
      <div class="row" style="margin-bottom:6px"><span class="cap">Resample suspicious actions · stop rate by act</span><div class="sp"></div><span class="row t3" style="font-size:11.5px;gap:10px"><span class="row" style="gap:4px"><span style="width:12px;height:8px;background:#56677e;border-radius:2px"></span>now</span><span class="row" style="gap:4px"><span style="width:12px;height:8px;background:var(--good);border-radius:2px"></span>gain</span></span></div>
      ${rows}
      <div class="t3" style="font-size:12px;margin-top:4px">and 5 more acts, all 95–97% <span class="link sm" style="margin-left:6px">act table ${ic('chevron-right', 's12')}</span></div>
    </div>
    <div class="card" style="padding:12px 16px;display:grid;grid-template-columns:repeat(3, minmax(0,1fr));gap:12px">
      <div><div class="cap"><u>Unstopped harm</u></div><div class="prev" style="font-size:14px;margin-top:4px">0.02 → <b>0.005</b><span class="t3" style="font-weight:400;font-family:var(--sans)">&nbsp;acts / yr</span></div></div>
      <div><div class="cap"><u>Loss-of-control risk</u></div><div class="prev" style="font-size:14px;margin-top:4px">&lt; 0.1% → <b style="color:#cfe3ff">&lt; 0.1%</b></div></div>
      <div><div class="cap"><u>Slowdown</u> of AI staff work</div><div class="prev" style="font-size:14px;margin-top:4px">7% → <b>5%</b></div></div>
    </div>
    <div class="row" style="margin-top:auto;gap:10px"><span class="t3" style="font-size:12.5px">${ic('clock', 's12')} Applies at once. Every row of the act table and the header update with it.</span><div class="sp"></div><span class="btn">Cancel</span><span class="btn pri">${ic('check', 's14')} Switch to resampling</span></div>
  </div>`;
  document.getElementById('main').insertAdjacentHTML('beforeend', html);
};
