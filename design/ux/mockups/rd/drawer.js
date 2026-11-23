// L2 drill-down for portfolio.html#drawer: the Optimizer & architecture tweaks programme card. Day-400 values (data400.json C.capability.list[3]).
(function () {
  const ic = (n, c = '') => `<svg class="i ${c}"><use href="#i-${n}"/></svg>`;
  // expected-effect range strip: axis 0–8 %, range 0.7–6.7 %, best guess 3.7 %
  const X = (v) => 16 + (v / 8) * 560;
  const rangeSvg = `<svg width="600" height="58" style="display:block;margin-top:2px">
    <line x1="16" y1="26" x2="576" y2="26" stroke="#33435a" stroke-width="2"/>
    ${[0, 2, 4, 6, 8].map((t) => `<line x1="${X(t)}" y1="22" x2="${X(t)}" y2="30" stroke="#4a5b72"/><text x="${X(t)}" y="48" fill="#6b7c91" font-size="11.5" font-family="Cascadia Mono, Consolas, monospace" text-anchor="middle">×${(1 + t / 100).toFixed(2)}</text>`).join('')}
    <rect x="${X(0.69)}" y="17" width="${X(6.66) - X(0.69)}" height="18" rx="5" fill="rgba(155,107,224,.28)" stroke="#9b6be0"/>
    <line x1="${X(3.7)}" y1="11" x2="${X(3.7)}" y2="41" stroke="#fff" stroke-width="2.5"/>
    <text x="${X(3.7) + 7}" y="12" fill="#fff" font-size="12.5" font-weight="650" font-family="Segoe UI, sans-serif">×1.037 best guess</text>
    <text x="${X(0.69)}" y="12" fill="#9fb0c3" font-size="11.5" font-family="Segoe UI, sans-serif">likely</text>
  </svg>`;
  const results = `<svg width="270" height="70" style="display:block">
    <rect x="0" y="10" width="56" height="44" rx="3" fill="#9b6be0"/><text x="28" y="66" fill="#9fb0c3" font-size="11" text-anchor="middle" font-family="Segoe UI, sans-serif">first</text>
    <rect x="72" y="${10 + 44 * 0.13}" width="56" height="${44 * 0.87}" rx="3" fill="#7a52b8"/><text x="100" y="66" fill="#9fb0c3" font-size="11" text-anchor="middle" font-family="Segoe UI, sans-serif">next</text>
    <text x="146" y="30" fill="#fff" font-size="18" font-weight="650" font-family="Segoe UI, sans-serif">~⅞</text>
    <text x="146" y="48" fill="#9fb0c3" font-size="11.5" font-family="Segoe UI, sans-serif">the size of the first</text>
  </svg>`;
  window.D.res.drawer = `
    <div class="row" style="gap:10px">
      <span class="t3">${ic('layers', 's18')}</span>
      <span style="font-size:20px;font-weight:650;color:#fff">Optimizer &amp; architecture tweaks</span>
      <div class="sp"></div><span class="t3">${ic('circle-x', 's20')}</span>
    </div>
    <div class="row" style="gap:8px;margin-top:-8px">
      <span class="kind">ongoing</span><span class="otag capability">capability</span><span class="fld">Pretraining · priority 4</span>
    </div>

    <div class="sec">
      <div class="row" style="gap:16px;align-items:flex-end">
        <div class="track" style="width:420px">${['Ideas', 'Small test', 'Big test', 'Build-in'].map((s, i) => `<div class="stg ${i < 1 ? 'done' : i === 1 ? 'cur' : ''}"><div class="bb" style="height:9px"><i style="width:${i < 1 ? 100 : i === 1 ? 54 : 0}%"></i></div><div class="sl" style="font-size:12px">${s}</div></div>`).join('')}</div>
        <div class="eta" style="width:auto">next result <b>~14 d</b></div>
      </div>
    </div>

    <div class="sec">
      <div class="cap">The idea under test</div>
      <div style="font-size:14.5px;color:#fff">A mid-sized change to the training recipe. It looks good in small tests but has not been tried at scale, and may shrink there.</div>
      <div class="kv" style="margin-top:2px">
        <span class="k"><u>Expected effect</u></span><span>next base model <b class="n w">×1.037</b> <u>pretraining compute</u> <span class="t3 n">(×1.007–×1.067)</span> · fairly unsure</span>
      </div>
      ${rangeSvg}
      <div class="kv">
        <span class="k"><u>Rate</u></span><span><b class="n w">≈ ×1.10</b> / yr <u>pretraining recipe</u> <span class="t3" style="font-size:12.5px">at today's staffing: ~3.7 results a year</span></span>
        <span class="k"><u>At scale</u></span><span><span class="chip warn">shrinks</span> <span class="t3" style="font-size:12.5px">small-test effects tend to shrink in big runs</span></span>
        <span class="k"><u>Takes effect</u></span><span>new base model <span class="link sm">next run ${ic('chevron-right', 's12')}</span></span>
      </div>
    </div>

    <div class="sec">
      <div class="cap">Results so far</div>
      <div class="row" style="gap:22px;align-items:center">
        ${results}
        <div class="kv" style="grid-template-columns:130px 1fr;flex:1">
          <span class="k">Built in</span><span><b class="n w">4</b> results · <b class="n w">×1.13</b> pretraining compute</span>
          <span class="k">Dropped</span><span><b class="n w">4</b> ideas</span>
          <span class="k">In this test</span><span><b class="n w">3</b> ideas</span>
        </div>
      </div>
    </div>

    <div class="sec">
      <div class="cap">Gets</div>
      <div class="kv">
        <span class="k">Science</span><span><b class="n w">1</b> team · Pretraining <span class="chip good">${ic('check', 's12')} right field</span> <span class="t3" style="font-size:12.5px">wanted 1</span> <span class="btn" style="padding:1px 8px">${ic('minus', 's12')}</span><span class="btn" style="padding:1px 8px">${ic('plus', 's12')}</span></span>
        <span class="k">Research engineers</span><span><b class="n w">2</b> teams <span class="t3" style="font-size:12.5px">(the most one programme takes)</span></span>
        <span class="k">Experiment compute</span><span>⅙ of it · <b class="n w">44k</b> H100e <span class="link sm">experiment compute ${ic('chevron-right', 's12')}</span></span>
        <span class="k"><u>Limited by</u></span><span>compute <span class="t3" style="font-size:12.5px">(same as the lab)</span></span>
      </div>
    </div>

    <div class="sec">
      <div class="cap">Idea choice</div>
      <div class="row"><div class="seg3"><span>Safe</span><span class="on">Balanced</span><span>Bold</span></div><span class="t3" style="font-size:12.5px">which ideas the team tries first</span></div>
    </div>`;
})();
