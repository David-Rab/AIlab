// MODELS (UI-IA §1 MODELS): family tree (real models by base, state words, role chips) + model card (skill bars,
// milestone ladder). Day-400 values: data400b.json models.familyTree, models.cards (Atlas-2.8).
(function () {
  const { ic, skillRow, rulerHead } = window.C;
  const D = window.D2, R = D.ruler;
  const ST = { use: 'In use', ready: 'Ready', test: 'Testing', ret: 'Retired' };
  const capbar = (L) => (L == null ? '<span class="t3" style="font-size:12px">being measured</span>' : `<div class="cb"><i style="width:${(L / 9) * 100}%"></i><span class="tk" style="left:${(6.5 / 9) * 100}%"></span></div>`);
  const node = ([name, st, L, roles, mini, sel]) => `<div class="node ${mini ? 'mini' : ''} ${sel ? 'sel' : ''}"><span class="ln"></span><span class="nm">${name}</span>${capbar(L)}<span class="roles"><span class="stw ${st}">${ST[st]}</span>${roles.map(([k, t]) => `<span class="rc ${k}">${t}</span>`).join('')}</span></div>`;
  const tree = `
    <div class="base"><div class="bh">${ic('layers', 's14')}<b>Atlas-3</b> base · 996B · pretrained Jul 22, 2026<div class="sp"></div><span class="link sm">post-train it ${ic('chevron-right', 's12')}</span></div>
      <div class="fold">${ic('circle-dashed', 's12')} no models yet</div></div>
    <div class="base"><div class="bh">${ic('layers', 's14')}<b>Atlas-2</b> base · 633B · Oct 25, 2025</div>
      <div class="fold">${ic('chevron-right', 's12')} 3 retired: Atlas-2.0, 2.2, 2.0-mini</div>
      ${[
        ['Atlas-2.4', 'ready', 6.9, [], false],
        ['Atlas-2.5', 'ready', 6.94, [], false],
        ['Atlas-2.6', 'use', 6.97, [['w', 'watches AI staff']], false],
        ['Atlas-2.8', 'use', 6.79, [['', 'AI staff: engineering, ideas'], ['p', 'products']], false, true],
        ['Atlas-2.10', 'test', null, [['', 'AI staff: experiments']], false],
        ['2.8-mini', 'use', 5.17, [['p', 'products']], true],
        ['2.6-mini', 'use', 5.2, [['p', 'products']], true],
        ['2.2-mini', 'use', 5.07, [['p', 'products']], true],
      ].map(node).join('')}
    </div>
    <div class="base"><div class="bh">${ic('layers', 's14')}<b>Atlas-1</b> base · 354B · Mar 3, 2025</div>
      <div class="fold">${ic('chevron-right', 's12')} 5 retired: Atlas-1.0 … 1.7</div>
      ${[['1.0-mini', 'use', 3.79, [['p', 'products']], true], ['1.0-micro', 'use', 3.23, [['p', 'products']], true], ['1.0-nano', 'use', 1.1, [['p', 'products']], true]].map(node).join('')}
    </div>`;
  const now = { CODE: [6.72, 6.56, 6.88], RSCH: [3.57, 3.41, 3.73], REASON: [3.91, 3.75, 4.07], AGENCY: [6.93, 6.77, 7.09], SOCIAL: [0.15, 0, 0.31], MEDIA: [0.14, 0, 0.30], CYBER: [1.51, 1.35, 1.67], BIO: [0.57, 0.41, 0.73], PHYS: [0.92, 0.76, 1.08] };
  const doms = D.DOM.map(([k, name, icon]) => skillRow({ name, icon, now: now[k][0], nowLo: now[k][1], nowHi: now[k][2] }, R)).join('');
  const rungs = D.rungs.map(([n, L, met], i) => `<div class="rung ${met ? 'met' : i === 2 ? 'next' : ''}"><span class="dot"></span><span class="nm">${n}</span><span class="d">${met ? 'met ' + met.replace(', 20', " '") : i === 2 ? 'next' : ''}</span></div>`).join('');
  document.getElementById('main').innerHTML = `
  <div class="ph">
    <h1>${ic('brain', 's22')} Models</h1>
    <div class="tabs"><span class="t on">Your models</span><span class="t">Evals</span></div>
    <div class="sp"></div>
    <span class="chip">${ic('hourglass', 's12')} Atlas-2.10 in testing</span>
  </div>
  <div class="grid2">
    <div class="card tree">
      <div class="hd"><span class="ttl">${ic('git-fork', 's18')} Family tree</span><span class="t3" style="font-size:12.5px">by base model · bar = measured <u>capability</u>, tick = Reliable agent</span></div>
      ${tree}
    </div>
    <div class="card mcard">
      <div class="mh"><span class="t">Atlas-2.8</span><span class="stw use">In use</span><div class="sp"></div><span class="link sm">${ic('microscope', 's12')} beliefs ${ic('chevron-right', 's12')}</span><span class="link sm">${ic('skull', 's12')} risks ${ic('chevron-right', 's12')}</span></div>
      <div class="facts"><span><b>633B</b> parameters · mixture of experts</span><span>from <b>Atlas-2.6</b></span><span>ready <b>Jun 18, 2026</b></span></div>
      <div class="cols">
        <div>
          
          <div class="cap" style="margin:14px 0 2px">Skill <span class="t3" style="text-transform:none;letter-spacing:0;font-weight:500">overall and</span> by domain <span class="t3" style="text-transform:none;letter-spacing:0;font-weight:500">· measured by your evals, with range</span></div>
          ${rulerHead(R)}
          <div class="capr">${skillRow({ name: "Capability", icon: "gauge", now: 6.79, nowLo: 6.63, nowHi: 6.95 }, R)}</div>
          ${doms}
        </div>
        <div class="ladder"><div class="cap" style="margin:10px 0 4px">Milestones</div>${rungs}</div>
      </div>
      <div class="l2">
        <span class="cap" style="margin-right:4px">Works as</span><span class="rc">AI staff: engineering</span><span class="rc">AI staff: ideas</span><span class="rc p">Chat · API · Enterprise (main model)</span>
        <div class="sp"></div>
        <span class="link sm">Benchmarks 21 ${ic('chevron-right', 's12')}</span><span class="link sm">Jobs ${ic('chevron-right', 's12')}</span><span class="link sm">Trained with ${ic('chevron-right', 's12')}</span><span class="link sm"><u>Cost per hour of work</u> $0.53 ${ic('chevron-right', 's12')}</span>
      </div>
    </div>
  </div>`;
})();
