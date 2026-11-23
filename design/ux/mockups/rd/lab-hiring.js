// LAB › Hiring & teams: teams you own per role (tiles; filling team; target), hiring target, payroll, time to hire,
// what the next team buys; team offers with leave-by dates; payroll, hiring speed, morale, star hires.
// Day-400 values: data400-b.json HIRE; "Next team buys" from data.js moves / wont (teamGain). Provenance: DATA-b.md.
(function () {
  const { ic } = window.C;
  const tile = (cls = '', f) => `<div class="tile ${cls}" ${f != null ? `style="--f:${f}%"` : ''}>${cls === 'goal' || cls === 'fill' ? '' : `<div class="q"><i class="on"></i><i class="on"></i><i></i></div>`}</div>`;
  const tiles = (n, fill, goal) => Array.from({ length: n }, () => tile()).join('') + (fill != null ? tile('fill', fill) : '') + (goal ? Array.from({ length: goal }, () => tile('goal')).join('') : '');
  const ROLE = {
    eng: ['Engineers', 'wrench', 750, 5, 6, '$525M', 17, '$105M', `<span class="t3">nothing now</span> · 77% spare`, 22, '32 of 150 · 8 wk left'],
    reCap: ['Research engineers', 'test-tube-diagonal', '1,500', 15, 15, '$1.2B', 14, '$80M', `<span class="t3">nothing now</span> · 3 teams spare`],
    sciCap: ['Scientists', 'telescope', 400, 10, 10, '$400M', 10, '$40M', `<span class="t3">little</span> · no programme waits for a team`],
    reSaf: ['Research engineers', 'test-tube-diagonal', 100, 1, 1, '$65M', 10, '$65M', `Safety results <b>+0.1</b> /yr · ends the 10-person shortage`],
    sciSaf: ['Scientists', 'telescope', 80, 2, 2, '$64M', 4, '$32M', `Safety results <b>+0.5</b> /yr`],
  };
  const row = (k) => {
    const [n, icon, ppl, teams, target, pay, wk, cost, buys, fill, fillTxt] = ROLE[k];
    return `<div class="tr">
      <div class="rn"><div class="ri">${ic(icon, 's18')}</div><div><b>${n}</b><span><span class="n">${ppl}</span> people · ${teams} team${teams === 1 ? '' : 's'}</span></div></div>
      <div class="tiles">${tiles(teams, fill)}${fillTxt ? `<span class="tcap">${ic('user-plus', 's12')} ${fillTxt}</span>` : ''}</div>
      <div><div class="step"><span class="b">−</span><span>${target}</span><span class="b">+</span></div><div class="t3" style="font-size:11.5px;margin-top:4px">${cost}/yr a team</div></div>
      <div><div class="pay">${pay}<span class="u"> /yr</span></div><div class="t3" style="font-size:11.5px;margin-top:4px">~${wk} wk a team</div></div>
      <div class="buys">${buys}</div>
    </div>`;
  };
  const offers = [
    ['wrench', 'Engineers', 'Strong · 150 people', '$105M/yr', 'Aug 11', '6 d', true],
    ['test-tube-diagonal', 'Safety research engineers', 'Strong · 100 people', '$65M/yr', 'Aug 18', '13 d', false],
    ['telescope', 'Scientists', 'Strong · 40 people · systems', '$40M/yr', 'Aug 25', '20 d', false],
    ['wrench', 'Engineers', 'Strong · 150 people', '$105M/yr', 'Sep 1', '27 d', false],
  ].map(([icon, n, s, c, d, left, soon]) => `<div class="offer"><div class="oi">${ic(icon, 's18')}</div>
      <div><b>${n}</b> <span class="t3" style="font-size:12.5px">${s}</span><div class="s"><span class="n w">${c}</span> · leaves <span class="leave ${soon ? 'warn' : 't2'}">${d} (${left})</span></div></div>
      <div class="row" style="gap:6px"><span class="btn">Pass</span><span class="btn pri">Hire</span></div></div>`).join('');
  const PAY = [['Engineers', 0.525, '#6f8fb5'], ['Capability research engineers', 1.2, 'var(--cap)'], ['Capability scientists', 0.4, 'var(--cap-2)'], ['Safety research engineers', 0.065, 'var(--saf)'], ['Safety scientists', 0.064, 'var(--saf-2)']];
  const tot = 2.277;
  document.getElementById('main').innerHTML = `
  <div class="ph">
    <h1>${ic('workflow', 's22')} Lab</h1>
    <div class="tabs"><span class="t">Allocation</span><span class="t on">Hiring &amp; teams</span><span class="t">AI staff &amp; needs</span><span class="t">Security</span></div>
    <div class="sp"></div>
  </div>
  <div class="grid">
    <div class="card" style="display:flex;flex-direction:column">
      <div class="hd"><span class="ttl">${ic('users', 's18')} Teams</span><span class="q">the people you employ, by role</span><div class="sp"></div>
        <span class="t3" style="font-size:12.5px"><u>Team quality</u> <span class="qp" style="display:inline-flex;gap:2px;vertical-align:1px"><i style="width:6px;height:6px;border-radius:50%;background:#d9c27a"></i><i style="width:6px;height:6px;border-radius:50%;background:#d9c27a"></i><i style="width:6px;height:6px;border-radius:50%;background:#56677e"></i></span> Strong</span></div>
      <div class="th"><span>Role</span><span>Teams</span><span><u>Hiring target</u></span><span>Payroll</span><span>Next team buys</span></div>
      ${row('eng')}
      <div class="band" style="color:var(--cap)">${ic('flask-conical', 's14')} Capability</div>
      ${row('reCap')}${row('sciCap')}
      <div class="band" style="color:var(--saf)">${ic('microscope', 's14')} Safety</div>
      ${row('reSaf')}${row('sciSaf')}
      <div class="row t3" style="font-size:12.5px;padding:12px 20px;margin-top:auto;gap:8px">${ic('info', 's14')} Scientists' split between capability and safety is set on <span class="link sm">Allocation ${ic('chevron-right', 's12')}</span></div>
    </div>
    <div class="rcol">
      <div class="card">
        <div class="hd" style="padding-bottom:10px"><span class="ttl">${ic('user-plus', 's18')} Team offers</span><span class="q">whole teams you can hire now</span><div class="sp"></div><span class="chip">4</span></div>
        ${offers}
      </div>
      <div class="card" style="flex:1">
        <div class="hd"><span class="ttl">${ic('wallet', 's18')} Payroll</span><div class="sp"></div><span class="n w" style="font-size:18px;font-weight:650">$2.28B<span class="t3" style="font-size:12.5px;font-family:var(--sans)"> /yr</span></span></div>
        <div class="pbar">${PAY.map(([, v, c]) => `<i style="width:${(v / tot * 100).toFixed(1)}%;background:${c};min-width:4px"></i>`).join('')}<i style="flex:1;background:#6f8fb5;opacity:.45"></i></div>
        <div class="pl">${PAY.map(([n, , c]) => `<span><i style="background:${c}"></i>${n}</span>`).join('')}</div>
        <div class="kv" style="margin-top:12px">
          <span><u>Hiring speed</u></span><span class="v">21 <span class="t3" style="font-family:var(--sans);font-size:12px">people a week</span> · 11 <span class="t3" style="font-family:var(--sans);font-size:12px">safety</span></span>
          <span><u>Morale</u></span><span class="row" style="gap:10px;justify-content:flex-end"><div class="mbar"><i style="width:70%"></i></div><span class="v">70</span></span>
          <span class="t2" style="padding-left:14px">Safety staff</span><span class="row" style="gap:10px;justify-content:flex-end"><div class="mbar"><i style="width:65%"></i></div><span class="v">65</span></span>
        </div>
        <div class="kv">
          <span><u>Star hire</u> <span class="t3" style="font-size:12.5px">· none on staff</span><div class="t3" style="font-size:12px;margin-top:2px">idea quality <span class="good">▲</span> · team cooperation <span class="bad">−20</span> · $300M</div></span><span class="btn">${ic('star', 's14')} Find a star</span>
        </div>
      </div>
    </div>
  </div>`;
})();
