// L2 for discoveries.html#drawer: Neuralese recurrence (tree node P17). Day-400 values: nodeStatus open, nodeOdds 0.70,
// effortOfNode XL, projectEta 586 d with 1 team / 527 d with 2; Faithful reasoning (P23) 0.75, 213 d with 1 team.
// Effects from the node's own text: +0.5 OOM effective compute on a new base (×3.2); monitorability 0.05 (P23: 0.98, −0.29 OOM = ×0.51).
(function () {
  const ic = (n, c = '') => `<svg class="i ${c}"><use href="#i-${n}"/></svg>`;
  window.DISC_DRAWER = `
  <div class="scrim"></div>
  <div class="drawer">
    <div class="row" style="gap:10px">
      <span class="t3">${ic('layers', 's20')}</span>
      <span style="font-size:20px;font-weight:650;color:#fff">Neuralese recurrence</span>
      <div class="sp"></div><span class="t3">${ic('circle-x', 's20')}</span>
    </div>
    <div class="row" style="gap:8px;margin-top:-8px">
      <span class="chip">one-off project</span><span class="tagx capability" style="font-size:11.5px;padding:1px 7px">capability</span><span class="t3" style="font-size:12.5px">Pretraining · can start now</span>
    </div>
    <div style="font-size:14px;color:var(--text)">Models think in their own internal vectors instead of in words. Much stronger reasoning per chip, but nobody can read the thinking any more.</div>

    <div class="gv">
      <div class="gbox up">
        <div class="cap">What it gives</div>
        <div class="big">×3.2</div>
        <div style="font-size:13px;color:#fff"><u>effective compute</u> for new base models built on it</div>
        <div class="t2" style="font-size:12.5px;margin-top:4px">${ic('git-branch', 's12')} opens <b class="w">Recurrent architectures</b>, a new ongoing programme</div>
      </div>
      <div class="gbox dn">
        <div class="cap" style="color:#f4d79a">What it costs</div>
        <div style="font-size:15px;font-weight:650;color:#fff">${ic('triangle-alert', 's14 warn')} Reasoning monitors go blind</div>
        <div style="font-size:13px;color:var(--text)">On models built this way your <u>Reasoning monitor</u> reads almost nothing, and the Readable reasoning programme loses its use.</div>
      </div>
    </div>

    <div class="sec">
      <div class="kv3">
        <span class="k"><u>Chance it works</u></span><span><b class="n w">70%</b> <span class="t3">likely</span></span>
        <span class="k"><u>Size</u></span><span>very large · <b class="w">~1.6 yr</b> with 1 team · ~1.4 yr with 2</span>
        <span class="k">Needs</span><span class="row" style="gap:10px">${ic('circle-check', 's14 good')} Visible reasoning ${ic('circle-check', 's14 good')} Long context + memory</span>
        <span class="k"><u>Takes effect</u></span><span>new base model</span>
      </div>
    </div>

    <div class="sec">
      <div class="cap">The other road</div>
      <div class="road">
        <div class="this"><b class="w">Neuralese recurrence</b><span>×3.2 effective compute</span><span class="warn">thinking unreadable</span><span class="t3">70% · ~1.6 yr</span></div>
        <div><b class="w">Faithful reasoning</b><span>×0.5 effective compute</span><span class="good">thinking stays readable</span><span class="t3">75% · ~7 months</span></div>
      </div>
      <div class="t3" style="font-size:12.5px">Each becomes an option in the run plan; a model reasons one way or the other.</div>
    </div>

    <div class="sec">
      <div class="cap">Also touches</div>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <span class="link sm">${ic('microscope', 's12')} Reasoning monitor · instrument ${ic('chevron-right', 's12')}</span>
        <span class="link sm">${ic('flask-conical', 's12')} Readable reasoning · programme ${ic('chevron-right', 's12')}</span>
        <span class="link sm">${ic('layers', 's12')} Pretraining recipe · know-how ${ic('chevron-right', 's12')}</span>
      </div>
    </div>

    <div class="row" style="gap:10px;margin-top:auto">
      <span class="btn pri">${ic('plus', 's14')} Add to Priority list</span>
      <span class="t2" style="font-size:13px">goes in at the bottom · takes a science team when one is free</span>
    </div>
  </div>`;
})();
