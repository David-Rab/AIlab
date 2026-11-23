// LAB › Security: weight security level against the industry baseline and the attacker it stops; what each higher
// level costs, its theft risk and time to reach; theft risk and who wants the weights; access; budget and log.
// Day-400 values: data400-b.json SEC (p.security, securityFloorView, reqSpend, intel.ts theft row). Provenance DATA-b.md.
(function () {
  const { ic } = window.C;
  const X = (L) => ((L - 1) / 4.6 * 100).toFixed(2) + '%';
  const zones = [[1, 'SL1', 'amateur hackers'], [2, 'SL2', 'professional hackers'], [3, 'SL3', 'cybercrime groups, most insiders'], [4, 'SL4', 'state hacking teams'], [5, 'SL5', 'top state operations']];
  const LV = [['3.1', 0, '17%', 'now', true], ['3.5', 1.51, '10%', '70 d'], ['4.0', 2.36, '3%', '5 mo'], ['4.5', 3.71, '< 1%', '8 mo'], ['5.0', 5.81, '< 1%', '11 mo']];
  const CMAX = 6;
  const levels = LV.map(([L, c, risk, t, cur]) => `<div class="lvr ${cur ? 'cur' : ''}"><span class="L">${L}</span>
      <div class="cb">${cur ? '' : `<i style="width:${(c / CMAX * 100).toFixed(1)}%"></i>`}<div class="bud" style="left:${(0.3 / CMAX * 100).toFixed(1)}%"></div></div>
      <span class="n">${cur ? '<span class="t3">—</span>' : '$' + c.toFixed(2) + 'B'}</span><span class="n ${cur ? 'warn' : ''}">${risk}</span>
      <span class="n t2">${t}</span><span style="text-align:right">${cur ? '<span class="chip">baseline</span>' : '<span class="btn" style="padding:3px 12px;font-size:12.5px">Set</span>'}</span></div>`).join('');
  document.getElementById('main').innerHTML = `
  <div class="ph">
    <h1>${ic('workflow', 's22')} Lab</h1>
    <div class="tabs"><span class="t">Allocation</span><span class="t">Hiring &amp; teams</span><span class="t">AI staff &amp; needs</span><span class="t on">Security</span></div>
    <div class="sp"></div>
  </div>
  <div class="top2">
    <div class="col">
      <div class="card" style="padding-bottom:18px">
        <div class="hd"><span class="ttl">${ic('lock', 's18')} <u>Weight security</u></span><span class="q">how hard it is to steal your models</span><div class="sp"></div><span class="big">3.1</span></div>
        <div class="ruler">
          <div class="tr"></div><div class="fill" style="width:${X(3.08)}"></div>
          <div class="bl" style="left:${X(3.08)}"></div>
          <div class="bl" style="left:${X(3.3)};border-left-style:dotted;border-color:#7f8ea3"></div>
          <div class="tg" style="left:${X(2.4)}"></div>
          <span class="lab" style="left:${X(2.4)};top:-30px">your target <b>2.4</b></span>
          <span class="lab" style="left:${X(3.08)};top:-56px"><b>you · industry baseline</b></span>
          <span class="lab" style="left:${X(3.3)};top:-30px;transform:none;padding-left:6px">baseline 3.3 from Jan 2027</span>
        </div>
        <div class="sl">${zones.map(([L, n, who], i) => `<div class="z" style="left:${X(L)};width:${i < 4 ? (100 / 4.6).toFixed(2) + '%' : 'auto'}"><b>${n}</b>stops ${who}</div>`).join('')}</div>
        <div class="row" style="margin:8px 30px 0;gap:8px;padding:9px 12px;border-radius:8px;background:var(--warn-bg);border:1px solid rgba(233,180,76,.4);font-size:13px;color:#f4d79a">${ic('info', 's14')}<span>Your target is below the baseline, so the baseline sets your level. Your $0.30B a year holds nothing higher.</span></div>
      </div>
      <div class="pair">
        <div class="card">
          <div class="hd"><span class="ttl">${ic('hand', 's18')} <u>Theft risk</u></span><span class="q">your estimate</span><div class="sp"></div><span class="big warn" style="font-size:26px">17%</span></div>
          <div style="padding:14px 18px 4px">
            <div class="cap" style="margin-bottom:8px">What drives it</div>
            <div class="drv"><span>Weight security</span><div><div class="bb" style="width:60%;background:#6f8fb5"></div></div><span class="n t2">60%</span></div>
            <div class="drv"><span>China's intent</span><div><div class="bb" style="width:40%"></div></div><span class="n t2">40%</span></div>
          </div>
          <div class="kv">
            <span>Who wants your weights</span><span class="v s"><b class="w">DeepCent</b> <span class="t3">· China</span></span>
            <span><u>Theft intent</u></span><span class="v">16 <span class="t3" style="font-family:var(--sans);font-weight:500">of 100</span> <span class="link sm">World ${ic('chevron-right', 's12')}</span></span>
            <span>Thefts detected</span><span class="v s good">${ic('check', 's14')} none</span>
          </div>
        </div>
        <div class="card">
          <div class="hd"><span class="ttl">${ic('key-round', 's18')} Access</span><span class="q">who can reach the weights</span></div>
          <div class="kv" style="padding-top:16px">
            <span>People with access</span><span class="v" style="font-size:20px">2,830</span>
            <span><u>Need-to-know access</u></span><span class="v"><span class="seg3"><span class="on">Open</span><span>Partial</span><span>Strict</span></span></span>
            <span class="t3" style="padding-left:14px;font-size:12.5px">people with access</span><span class="v t3" style="font-size:12.5px">2,830 · 1,981 · 1,132</span>
            <span><u>Counter-intelligence</u></span><span class="v">10%</span>
            <span><u>Security clearances</u></span><span class="v s t2">not required</span>
            <span><u>Secrets security</u> <span class="t3" style="font-size:12.5px">· know-how</span></span><span class="v">2.5</span>
          </div>
        </div>
      </div>
    </div>
    <div class="col">
      <div class="card">
        <div class="hd" style="padding-bottom:4px"><span class="ttl">${ic('trending-up', 's18')} What a higher level costs</span><div class="sp"></div><span class="t3" style="font-size:12.5px"><span style="display:inline-block;width:2px;height:12px;background:var(--warn);vertical-align:-1px;margin-right:6px"></span>your budget $0.30B</span></div>
        <div class="lvr hd2"><span>Level</span><span>Spend to reach and hold</span><span style="text-align:right">a year</span><span style="text-align:right"><u>Theft risk</u></span><span style="text-align:right">to reach</span><span></span></div>
        ${levels}
      </div>
      <div class="card" style="flex:1;display:flex;flex-direction:column">
        <div class="hd"><span class="ttl">${ic('wallet', 's18')} Security budget</span><div class="sp"></div>
          <span class="row" style="gap:0;display:inline-flex;border:1px solid var(--line-2);border-radius:8px;overflow:hidden"><span style="padding:3px 10px;background:var(--panel-2);color:var(--text-2)">−</span><span class="n w" style="padding:3px 12px;font-weight:600">$0.30B/yr</span><span style="padding:3px 10px;background:var(--panel-2);color:var(--text-2)">+</span></span></div>
        <div class="cap" style="padding:16px 18px 6px">Security log</div>
        <div class="log"><span class="d">Feb 16, 2026</span><span>Defense contracts now carry security clauses for frontier labs.</span></div>
        <div class="log"><span class="d"></span><span class="t3">No thefts or leaks detected.</span></div>
      </div>
    </div>
  </div>`;
})();
