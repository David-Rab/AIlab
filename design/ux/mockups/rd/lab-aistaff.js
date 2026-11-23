// LAB › AI staff & needs: AI staff per job (model, copies, compute, AI share, work done, cost per hour, watcher) and the
// needs lists of the three staff groups in priority order. Day-400 values: data400.json B (agents, workTypes, needs) as on
// the approved LAB board; provenance DATA-b.md.
(function () {
  const { ic } = window.C;
  // [job, icon, model, tested, copies, compute, % of compute, AI share, work ×, people, watcher]
  const JOBS = [
    ['Engineering', 'wrench', 'Atlas-2.8', true, '19.6k', '33k', '0.9%', 63, 6.1, 'Engineers · 5 teams', null],
    ['Experiments', 'test-tube-diagonal', 'Atlas-2.10', false, '63.9k', '106k', '2.8%', 35, 2.4, 'Research engineers · 15 teams', 'Atlas-2.6'],
    ['Ideas', 'telescope', 'Atlas-2.8', true, '14.7k', '25k', '0.6%', 7, 1.2, 'Scientists · 10 teams', 'Atlas-2.6'],
  ];
  const job = ([n, icon, m, tested, copies, h, pct, share, x, ppl, watch]) => {
    const hp = 100 - share;
    return `<div class="card job">
      <div class="jt"><div class="ji">${ic(icon, 's18')}</div>${n}<div class="sp"></div><span class="msel">${ic('bot', 's14')} ${m} ${ic('chevron-down', 's12')}</span></div>
      <div class="share"><b>${share}%</b><span><u>AI share</u> of the work</span>${tested ? '' : `<span class="chip" style="margin-left:auto">${ic('flask-conical', 's12')} model in evals</span>`}</div>
      <div><div class="wbar"><i class="hp" style="width:${hp.toFixed(1)}%"></i><i class="ap" style="flex:1"></i></div>
        <div class="wl" style="margin-top:4px"><span>people ${hp}%</span><span>AI staff ${share}%</span></div></div>
      <div class="row" style="gap:8px;font-size:13px;color:var(--text-2)"><u>Work done</u> <b class="w n" style="font-size:17px">×${x.toFixed(1)}</b> the people alone</div>
      <div class="kv">
        <span class="k"><u>Copies</u></span><span class="v">${copies}</span>
        <span class="k">Compute</span><span class="v">${h} H100e <span class="t3">· ${pct}</span></span>
        <span class="k">Cost per hour of work</span><span class="v">$0.29 <span class="t3">· people $560</span></span>
        <span class="k">Works with</span><span class="v s">${ppl}</span>
        <span class="k"><u>Watched by</u></span><span class="v s">${watch ? `<span class="msel" style="padding:0 7px;font-size:12px">${watch}</span>` : '<span class="warn">no watcher</span>'}</span>
      </div>
    </div>`;
  };
  const safety = `<div class="card job off">
      <div class="jt"><div class="ji" style="color:var(--saf)">${ic('microscope', 's18')}</div>Safety<div class="sp"></div><span class="msel" style="opacity:.6">${ic('bot', 's14')} Atlas-2.8 ${ic('chevron-down', 's12')}</span></div>
      <div class="share"><b>0%</b><span><u>AI share</u> of the work</span></div>
      <div><div class="wbar"><i class="hp" style="width:100%;border-radius:4px"></i></div>
        <div class="wl" style="margin-top:4px"><span>people 100%</span><span>AI staff 0%</span></div></div>
      <div class="row" style="gap:8px;font-size:13px;color:var(--text-2)"><u>Work done</u> <b class="w n" style="font-size:17px">×1.0</b> the people alone</div>
      <div class="kv">
        <span class="k"><u>AI share allowed</u></span><span class="v"><span class="row" style="gap:0;display:inline-flex;border:1px solid var(--line-2);border-radius:7px;overflow:hidden"><span style="padding:1px 8px;background:var(--panel-2);color:var(--text-2)">−</span><span style="padding:1px 10px">0%</span><span style="padding:1px 8px;background:var(--panel-2);color:var(--text-2)">+</span></span></span>
        <span class="k"><u>Spot-checks</u></span><span class="v s t3">none needed at 0%</span>
        <span class="k">Copies · compute</span><span class="v">0 · 0</span>
        <span class="k">Works with</span><span class="v s">Safety staff · 3 teams</span>
        <span class="k">Safeguards on AI staff</span><span class="v s"><span class="link sm">Safety ${ic('chevron-right', 's12')}</span></span>
      </div>
    </div>`;
  // needs: [name, fill 0..1, status, cls]
  const list = (rows) => rows.map(([n, f, st, cls], i) => `<div class="nd ${cls || ''}"><span class="rk">${cls === 'spare' ? '' : i + 1}</span><span class="nm">${cls === 'short' ? ic('triangle-alert', 's12') + ' ' : ''}${n}</span><div class="gb"><i style="width:${(f * 100).toFixed(0)}%"></i></div><span class="st">${st}</span></div>`).join('');
  const ENG = [['Run setups', 0, 'none', 'zero'], ['Upkeep', 1, '23%'], ['Build queue', 0, 'empty', 'zero'], ['Spare', 0.77, '77%', 'spare']];
  const RE = [['Run operations', 0, 'no run', 'zero'], ['Research experiments', 1, '12 teams'], ['Spare', 0.2, '3 teams', 'spare']];
  const SRE = [['Human review', 1, '19 people'], ['Spot-checks', 0, 'none', 'zero'], ['Cases', 0, 'none open', 'zero'], ['Validations', 1, '40 people'], ['Safety evals', 1, '20 people'], ['Foothold removal', 0, 'none', 'zero'], ['Research experiments', 0.68, '21 of 31', 'short']];
  document.getElementById('main').innerHTML = `
  <div class="ph">
    <h1>${ic('workflow', 's22')} Lab</h1>
    <div class="tabs"><span class="t">Allocation</span><span class="t">Hiring &amp; teams</span><span class="t on">AI staff &amp; needs</span><span class="t">Security</span></div>
    <div class="sp"></div>
    <span class="t3" style="font-size:13px"><b class="w n">98k</b> copies · <b class="w n">165k</b> H100e · <b class="w n">$1.35B</b>/yr</span>
  </div>
  <div class="row" style="gap:10px"><span class="cap">${ic('bot', 's14')} AI staff by job</span><div class="sp"></div>
    <div class="hlinks"><span class="link sm">${ic('wrench', 's12')} Lab tools: none owned, 3 to build ▸ Know-how</span><span class="link sm">How close AI is to each job ▸ Models</span></div></div>
  <div class="jobs" style="margin-top:-6px">${JOBS.map(job).join('')}${safety}</div>
  <div class="row" style="gap:10px"><span class="cap">${ic('list-ordered', 's14')} <u>Needs</u>, in priority order</span><span class="t3" style="font-size:12.5px">gets / needs · staff go to the top first · people and AI staff together</span></div>
  <div class="needs" style="margin-top:-6px">
    <div class="card ncard">
      <div class="hd"><span class="ttl">${ic('wrench', 's16')} Engineers</span><div class="sp"></div><span class="chip">77% spare</span></div>
      <div class="sum"><u>Build capacity</u> in use <b class="w n">23%</b></div>
      ${list(ENG)}
      <div class="foot">Upkeep: products 18% · watchers 3% · tools 2% · environments 1% <div class="sp"></div><span class="link sm">${ic('list-ordered', 's12')} Change order</span></div>
    </div>
    <div class="card ncard">
      <div class="hd"><span class="ttl">${ic('test-tube-diagonal', 's16')} Research engineers</span><span class="t3" style="font-size:12.5px">capability</span><div class="sp"></div><span class="chip">3 teams spare</span></div>
      <div class="sum">15 teams · 2 per programme at most</div>
      ${list(RE)}
      <div class="foot"><div class="sp"></div><span class="link sm">${ic('list-ordered', 's12')} Change order</span></div>
    </div>
    <div class="card ncard">
      <div class="hd"><span class="ttl">${ic('test-tube-diagonal', 's16')} Research engineers</span><span class="t3" style="font-size:12.5px">safety</span><div class="sp"></div><span class="chip warn">${ic('triangle-alert', 's12')} short 10 people</span></div>
      <div class="sum">100 people</div>
      ${list(SRE)}
      <div class="foot">Short: safety programmes slow down <div class="sp"></div><span class="link sm">${ic('list-ordered', 's12')} Change order</span></div>
    </div>
  </div>`;
})();
