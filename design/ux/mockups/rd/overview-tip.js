// L2/L3 for overview.html#tip: the Meridian lead lane, locked tooltip with a nested child on "best internal model".
// Day-400 values: leadDays(Meridian) = −154 ± 46 d (intel.ts); intel report day 399; data400a.json lead[3].
(function () {
  const ic = (n, c = '') => `<svg class="i ${c}"><use href="#i-${n}"/></svg>`;
  const LO = -365, HI = 365, w = 410;
  const x = (d) => ((d - LO) / (HI - LO)) * w;
  const strip = `<svg width="${w}" height="44" style="display:block;margin:4px 0 2px">
    <line x1="0" y1="18" x2="${w}" y2="18" stroke="#33435a" stroke-width="2"/>
    <rect x="${x(0)}" y="4" width="${w - x(0)}" height="28" fill="rgba(239,107,107,.07)"/>
    <line x1="${x(0)}" y1="2" x2="${x(0)}" y2="34" stroke="#3a8ae0" stroke-width="2"/>
    <rect x="${x(79)}" y="13" width="${x(229) - x(79)}" height="10" rx="5" fill="#d4732a" opacity=".45"/>
    <circle cx="${x(154)}" cy="18" r="8" fill="#d4732a"/>
    <text x="${x(0)}" y="44" fill="#8fb8ea" font-size="11" text-anchor="middle" font-family="Segoe UI, sans-serif">you</text>
    <text x="${x(79)}" y="44" fill="#6b7c91" font-size="11" text-anchor="middle" font-family="Cascadia Mono, Consolas, monospace">79 d</text>
    <text x="${x(229)}" y="44" fill="#6b7c91" font-size="11" text-anchor="middle" font-family="Cascadia Mono, Consolas, monospace">229 d</text>
  </svg>`;
  window.OV_TIP = `
  <div class="tip" style="left:1150px;top:640px;width:446px">
    <div class="lockbar on"></div>
    <div class="bd">
      <h4>${ic('timer', 's18')} Meridian <span class="t3" style="font-weight:500;font-size:12.5px">US lab</span><span class="n ahead" style="margin-left:auto;font-size:19px">154 d ahead</span></h4>
      <div class="def">How long until your best model matches Meridian's <u class="on">best internal model</u>, by your estimate.</div>
      <div class="cap">Likely range</div>
      ${strip}
      <div class="cap" style="margin:10px 0 5px">How you know</div>
      <div class="brk">
        <span>Intel report</span><span class="n">Aug 4, 2026</span>
        <span>Their newest public model, plus the gap their safety framework allows before release</span><span></span>
        <span>Your best model</span><span class="n">Atlas-2.8</span>
      </div>
      <div class="row" style="gap:8px;margin-top:11px">
        <span class="link sm">${ic('globe', 's12')} Risk from their models ${ic('chevron-right', 's12')}</span>
        <span class="link sm">${ic('brain', 's12')} Their models on your evals ${ic('chevron-right', 's12')}</span>
      </div>
      <div class="hint">${ic('lock', 's12')} Locked · hover underlined terms · Esc closes</div>
    </div>
  </div>
  <div class="tip" style="left:1596px;top:672px;width:226px">
    <div class="lockbar"></div>
    <div class="bd">
      <h4 style="font-size:13.5px">Best internal model</h4>
      <div class="def" style="margin-bottom:0">A lab's most capable model, used inside the lab and not yet released. Labs see each other's only through public models and intel.</div>
    </div>
  </div>`;
})();
