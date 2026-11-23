// Shared mockup components: skill ruler (OQ-6: bars between median-expert and best-human ticks, plus a superhuman mark;
// no raw 0–15 numbers at L1). window.C.
(function () {
  const ic = (n, c = '') => `<svg class="i ${c}"><use href="#i-${n}"/></svg>`;
  /** Ruler geometry: levels lo..hi mapped to 0..1. */
  const ruler = (lo, hi) => (L) => Math.max(0, Math.min(1, (L - lo) / (hi - lo)));
  /**
   * One skill row. o = { name, icon, now, nowLo, nowHi, next?, nextLo?, nextHi?, sight? }, R = { lo, hi, med, best, sup }.
   * Bar = measured skill (range whisker); ghost = the prediction (range); ticks = median expert, best human, superhuman.
   */
  const skillRow = (o, R, opt = {}) => {
    const x = ruler(R.lo, R.hi);
    const pc = (L) => (x(L) * 100).toFixed(2) + '%';
    return `<div class="sk">
      <span class="skn">${o.icon ? ic(o.icon, 's14') : ''}<u>${o.name}</u></span>
      <div class="skr">
        <div class="tk med" style="left:${pc(R.med)}"></div><div class="tk best" style="left:${pc(R.best)}"></div>${R.sup != null ? `<div class="tk sup" style="left:${pc(R.sup)}"></div>` : ""}
        ${o.next != null ? `<div class="gh" style="left:${pc(o.now)};width:calc(${pc(o.next)} - ${pc(o.now)})"></div><div class="ghr" style="left:${pc(o.nextLo)};width:calc(${pc(o.nextHi)} - ${pc(o.nextLo)})"></div>` : ''}
        <div class="sb" style="width:${pc(o.now)}"></div>
        ${o.nowLo != null ? `<div class="wh" style="left:${pc(o.nowLo)};width:calc(${pc(o.nowHi)} - ${pc(o.nowLo)})"></div>` : ''}
        ${o.rival != null ? `<div class="rv" style="left:${pc(o.rival)}"></div>` : ''}
      </div>
      ${opt.right ? `<span class="skv">${opt.right}</span>` : ''}
    </div>`;
  };
  const rulerHead = (R) => {
    const x = ruler(R.lo, R.hi);
    const pc = (L) => (x(L) * 100).toFixed(2) + '%';
    return `<div class="sk skh"><span></span><div class="skr" style="background:none;box-shadow:none">
      <span class="tl" style="left:${pc(R.med)}">median expert</span><span class="tl" style="left:${pc(R.best)}">best human</span>${R.sup != null ? `<span class="tl" style="left:${pc(R.sup)}">superhuman</span>` : ""}</div></div>`;
  };
  window.C = { ic, skillRow, rulerHead, ruler };
})();
