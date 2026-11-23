// L3 state for lab.html#tip: research speed tooltip, locked, with a nested child tooltip on "AI share". Day-400 values.
(function () {
  const ic = (n, c = '') => `<svg class="i ${c}"><use href="#i-${n}"/></svg>`;
  const spark = (pts, w, h) => {
    const mn = 2.2, mx = 2.4;
    const p = pts.map(([x, v]) => `${(x * w).toFixed(1)},${(h - 3 - ((v - mn) / (mx - mn)) * (h - 6)).toFixed(1)}`).join(' ');
    return `<svg width="${w}" height="${h}" style="display:block"><line x1="0" y1="${h - 1}" x2="${w}" y2="${h - 1}" stroke="#33435a"/><polyline points="${p}" fill="none" stroke="#7fe0cf" stroke-width="2"/>${pts.map(([x, v]) => `<circle cx="${(x * w).toFixed(1)}" cy="${(h - 3 - ((v - mn) / (mx - mn)) * (h - 6)).toFixed(1)}" r="3" fill="#7fe0cf"/>`).join('')}</svg>`;
  };
  window.TIP_SPEED = `
  <div class="tip" style="left:200px;top:6px;width:470px">
    <div class="lockbar on"></div>
    <div class="bd">
      <h4>${ic('gauge', 's18')} Research speed <span class="n" style="margin-left:auto;font-size:20px">×3.0</span></h4>
      <div class="def">How fast your lab turns compute and people into research results, against the leading lab in Jul 2025.</div>
      <div class="cap" style="margin-bottom:5px">What it runs on</div>
      <div class="brk">
        <span>${ic('cpu', 's14')} <u>Research compute</u></span><span class="n">398k H100e</span>
        <span class="t3" style="padding-left:22px">Experiments 267k · AI staff 131k</span><span></span>
        <span>${ic('test-tube-diagonal', 's14')} Research engineers <span class="t3">15 teams</span></span><span class="n">×2.4 with AI</span>
        <span>${ic('telescope', 's14')} Scientists <span class="t3">10 teams</span></span><span class="n">×1.2 with AI</span>
      </div>
      <div class="cap" style="margin:11px 0 5px">AI staff's part</div>
      <div class="row" style="gap:14px;align-items:flex-end">
        <div style="flex:1;font-size:13px;line-height:1.5">
          Experiments: <u class="on">AI share</u> <b class="n w">35%</b>, <span class="n w">×2.36</span> the people alone<br>
          <span class="t3">90 days ago ×2.23 · 30 days ago ×2.30</span>
        </div>
        <div>${spark([[0, 2.232], [0.66, 2.299], [1, 2.363]], 96, 34)}<div class="t3" style="font-size:10.5px;display:flex;justify-content:space-between"><span>−90 d</span><span>now</span></div></div>
      </div>
      <div class="row" style="margin-top:11px;gap:8px;padding:7px 10px;border-radius:7px;background:rgba(58,138,224,.10);border:1px solid #36507a">
        ${ic('triangle-alert', 's14')}<span style="font-size:13px"><u>Limited by</u> <b class="w">compute</b></span><div class="sp"></div><span class="link sm">best move ${ic('chevron-right', 's12')}</span>
      </div>
      <div class="hint">${ic('lock', 's12')} Locked · hover underlined terms · Esc closes</div>
    </div>
  </div>
  <div class="tip" style="left:690px;top:214px;width:380px;z-index:61">
    <div class="lockbar"></div>
    <div class="bd">
      <h4>${ic('bot', 's18')} AI share</h4>
      <div class="def">Share of a job's work your AI staff do. It grows with the model's skill at the job and with the compute you give the AI staff.</div>
      <div class="brk">
        <span>Engineering <span class="mchip2">Atlas-2.8</span></span><span class="n">63%</span>
        <span>Experiments <span class="mchip2">Atlas-2.10</span></span><span class="n">35%</span>
        <span>Ideas <span class="mchip2">Atlas-2.8</span></span><span class="n">7%</span>
        <span>Safety <span class="t3">AI share allowed 0%</span></span><span class="n">0%</span>
      </div>
      <div class="row" style="margin-top:10px;gap:6px"><span class="link sm">skill at this job ${ic('chevron-right', 's12')}</span><span class="link sm">Workforce ${ic('chevron-right', 's12')}</span></div>
    </div>
  </div>`;
})();
