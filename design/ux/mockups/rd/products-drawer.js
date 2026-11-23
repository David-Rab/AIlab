// L2 for products.html#drawer: Enterprise › Customers. Day-400 values: data400a.json products[D3].read (cust, econ).
(function () {
  const ic = (n, c = '') => `<svg class="i ${c}"><use href="#i-${n}"/></svg>`;
  const X = (v) => (v / 50) * 100; // 0–50 % axis
  const sec = [
    ['Admin, clerical, customer service', 33, 15],
    ['Software and IT', 37, 19],
    ['Finance, insurance, accounting', 37, 21, true],
    ['Retail, hospitality, services', 31, 12],
  ];
  const rows = sec.map(([n, now, tgt, cert]) => `
    <div class="sx">
      <span style="color:#fff">${n}${cert ? ` <span class="chip" style="margin-left:4px;font-size:11px">${ic('shield-check', 's12')}certifiable</span>` : ''}</span>
      <div class="trk"><div class="ax"></div>
        <div class="arr" style="left:${X(tgt)}%;width:${X(now) - X(tgt)}%"></div>
        <div class="tgt" style="left:${X(tgt)}%"></div><div class="now" style="left:${X(now)}%"></div>
      </div>
      <span class="n" style="text-align:right;color:#fff">${now}% <span class="dn">→ ${tgt}%</span></span>
    </div>`).join('');
  window.PRODUCTS_DRAWER = () => `
  <div class="scrim"></div>
  <div class="drawer">
    <div class="row" style="gap:10px">
      <span class="t3">${ic('building-2', 's20')}</span>
      <span style="font-size:20px;font-weight:650;color:#fff">Enterprise · Customers</span>
      <div class="sp"></div><span class="t3">${ic('circle-x', 's20')}</span>
    </div>

    <div class="sec">
      <div class="row"><span class="cap" style="flex:1">Your share of each sector's spend</span>
        <span class="row t3" style="gap:14px;font-size:12px"><span class="row" style="gap:5px"><i style="width:11px;height:11px;border-radius:50%;background:var(--you);display:inline-block"></i>now</span><span class="row" style="gap:5px"><i style="width:11px;height:11px;border-radius:50%;border:2px solid #cfe3ff;display:inline-block;box-sizing:border-box"></i>where buyers are heading</span></span></div>
      <div class="sx" style="padding:0"><span></span><div class="trk" style="height:14px">${[0, 10, 20, 30, 40, 50].map((t) => `<span class="n t3" style="position:absolute;left:${X(t)}%;transform:translateX(-50%);font-size:11px">${t}%</span>`).join('')}</div><span></span></div>
      ${rows}
      <div class="fold">${ic('chevron-right', 's12')} 10 more sectors, smaller spend</div>
      <div class="t2" style="font-size:13px">Shared with API: both sell to the same buyers. Buyers switch over <b class="w">~8 months</b>; at this pace your share reaches the target in <b class="w">~2 yr</b>.</div>
    </div>

    <div class="sec" style="padding:12px 14px;border-radius:9px;background:var(--warn-bg);border:1px solid rgba(233,180,76,.35)">
      <div class="row" style="gap:8px;font-size:14.5px;color:#fff;font-weight:650">${ic('gauge', 's18')} <u>Limited by</u>&nbsp;quality</div>
      <div style="font-size:13.5px;color:var(--text)">Buyers pick a model task by task, for value for money. Rivals' newest models now do more of these tasks at the price, so buyers drift to them. Price and serving compute are not the limit: all demand is served.</div>
    </div>

    <div class="sec">
      <div class="cap">What could win buyers back</div>
      <div class="opt"><span class="oi">${ic('brain', 's18')}</span><div><div class="ot">Add Atlas-2.10 to the lineup</div><div class="os">In testing now; its skill is known when the tests finish</div></div><span class="link sm">Models ${ic('chevron-right', 's12')}</span></div>
      <div class="opt"><span class="oi">${ic('rocket', 's18')}</span><div><div class="ot">Train a stronger model</div><div class="os">×1.5 pretraining know-how is waiting for a new base model</div></div><span class="link sm">Next run ${ic('chevron-right', 's12')}</span></div>
      <div class="opt"><span class="oi">${ic('shield-check', 's18')}</span><div><div class="ot">Certify Enterprise for Finance</div><div class="os">~1 wk of engineering, then 240 days and $4M · your Finance buyers adopt more easily</div></div><span class="btn" style="padding:4px 10px">Start</span></div>
    </div>

    <div class="sec">
      <div class="cap">Sold in a year</div>
      <div class="kv2">
        <span><u>Hours of work sold</u></span><span class="n">5.4B h</span>
        <span class="t3" style="padding-left:14px">tasks people hand over 2.2B · work done alone 3.2B</span><span></span>
        <span><u>Seats</u></span><span class="n">23.4M · $25 a month</span>
        <span>Serving cost</span><span class="n">$3.0B</span>
        <span>Margin</span><span class="n">60%</span>
      </div>
    </div>
  </div>`;
})();
